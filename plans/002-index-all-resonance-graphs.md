# Plan 002: Optional single-manifest indexing for every Resonance graph

> **Status: DEFERRED; not approved for execution.** The maintainer selected the existing subgraph for the initial graph
> and separate retained subgraph deployments only if a future Mine Router cutover occurs. This larger single-manifest
> design is preserved as optional analysis. Do not execute it without a new explicit maintainer decision.
>
> If it is approved later, follow every step and verification gate. If a STOP condition occurs, stop and report; do not
> improvise. When done, update the status row in `plans/README.md`, unless a reviewer dispatched you and said they
> maintain the index.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat 70091b642006f0b2788bd89a6a0e734a632619cf..HEAD -- \
>   docs/adr packages/subgraph packages/sdk/README.md packages/sdk/src/subgraph.ts \
>   packages/sdk/tests/subgraph.test.ts docs/reference/sdk
> ```
>
> If any in-scope file changed since this plan was written, compare the Current state excerpts to live code. A semantic
> mismatch is a STOP condition. Also run
> `git status --short -- packages/subgraph docs/adr packages/sdk/README.md packages/sdk/src/subgraph.ts packages/sdk/tests/subgraph.test.ts docs/reference/sdk plans/reviews`
> and preserve every pre-existing user change. Never reset, clean, checkout, or overwrite a dirty file.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: explicit future approval and demonstrated multi-generation operational need
- **Category**: migration
- **Planned at**: commit `70091b6`, 2026-08-31

## Why this matters

The current subgraph statically indexes one SignalGBX/ResonanceRouter/Resonance triplet. Mine can later switch future
revenue to a separately deployed graph while every old claim and signal exit remains in the old graph. A consumer that
keeps the current subgraph misses all replacement-graph positions; a consumer that replaces the old sources can hide
still-exitable old positions.

Creating new data sources only when `Mine.ResonanceRouterUpdated` fires is not history-complete. Graph data-source
templates process their creation block and later blocks, not earlier blocks. ADR 0055 requires the replacement graph to
be deployed and bound before Mine switches last, so setup, Strategy, and even position events may already exist in prior
blocks. The safe design is an append-only reviewed graph inventory that renders static sources for every generation from
its origin block, scopes state by Resonance, retains old sources forever, and treats the Mine event only as an activation
pointer.

This is an optional alternative to the selected per-generation deployment model. It does not make the subgraph
authoritative, and it does not close CEX-03's bounded-current-state requirement. Every removal still requires current
onchain Bribe and Strategy reads. A subgraph-independent raw-RPC account-position recovery path is a separate optional
resilience improvement rather than a prerequisite for this plan or a current release requirement.

## Current state

### Only one graph is indexed

`packages/subgraph/subgraph.yaml:70-160` contains exactly one static source for each graph-local contract:

```yaml
- name: SignalGBX
  source: { abi: SignalGBX, address: '0x0000000000000000000000000000000000000000', startBlock: 0 }
- name: ResonanceRouter
  source: { abi: ResonanceRouter, address: '0x0000000000000000000000000000000000000000', startBlock: 0 }
- name: Resonance
  source: { abi: Resonance, address: '0x0000000000000000000000000000000000000000', startBlock: 0 }
```

`packages/subgraph/subgraph.yaml:185-225` defines dynamic templates only for each Strategy's Bribe and BribeRouter. It
has no replacement Resonance graph template or static graph inventory.

`packages/subgraph/networks.json:1-10` is a flat six-source object with intentional zero placeholders. The production
validator at `packages/subgraph/scripts/validate-network-config.mjs:8-35` requires exactly `GBX`, `Mine`, `SignalGBX`,
`ResonanceRouter`, `Resonance`, and `Fund`, rejects zero/startBlock zero, and rejects duplicate addresses. Production
validation must remain fail-closed until reviewed deployment evidence exists.

### Mine changes pointers but creates no graph sources

`packages/subgraph/src/mine.ts:110-119` currently does only this:

```ts
export function handleResonanceRouterUpdated(event: ResonanceRouterUpdated): void {
  const protocol = getProtocol(event);
  protocol.mineRevenueResonance = event.params.newResonance;
  protocol.mineRevenueRouter = event.params.newRouter;
  protocol.save();
  // records the event only
}
```

The corresponding test at `packages/subgraph/tests/minimal-core.test.ts:188-214` explicitly expects migration "without
replacing the indexed Resonance graph." That expectation must be removed.

### Graph-local state is currently global

`packages/subgraph/schema.graphql:1-49,68-101` stores all of these without a Resonance-generation key:

- `ProtocolState.bribeBps`, Strategy/live counts, revenue totals, and active pointers;
- `Account.signaledGBXRaw`, signal weight, current delegate, delegated votes, and derived positions;
- `Strategy` keyed only by address; and
- `SignalPosition` linked only to the chain-wide Account and Strategy.

`packages/subgraph/src/ids.ts:16-18` currently builds position IDs as `chain-account-strategy`. The entity helpers at
`packages/subgraph/src/entities.ts:82-117` key Strategy only by address and position only by account/Strategy.

`packages/subgraph/src/resonance.ts:18-153` mutates singleton counters and pointers. In particular,
`handleResonanceRouterSet` sets the active protocol Resonance/Router. With several statically indexed replacement graphs,
that setup event would incorrectly activate a merely predeployed graph before Mine switches. Likewise,
`packages/subgraph/src/signal-gbx.ts:61-64` overwrites the singleton Resonance during every graph's one-time binding.

### Current discovery warning is correct but incomplete

`packages/subgraph/README.md:15-28` correctly says `SignalPosition` is discovery-only, killing does not delete an incumbent
position, and clients must refresh the Bribe weight and Strategy status at one pinned onchain block. Preserve and extend
this warning with graph-source coverage health.

### Protocol boundary that must be preserved

ADR 0055 at `docs/adr/0055-governed-mine-revenue-router-migration.md:71-94` says:

- deploy and bind the complete replacement graph, then switch Mine last;
- old Router/Resonance balances, Strategy claims, Bribe balances, and account signal positions stay in the old graph;
- users claim and unsignal through the old graph;
- each graph has a different SignalGBX; and
- old and new Routers continue independently.

The subgraph is replaceable discovery periphery. It must never be a correctness or liveness dependency of a core action.

## Commands you will need

Run from the repository root.

| Purpose         | Command                                                                                                                                         | Expected on success                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Toolchain       | `test "$(node --version)" = v22.23.1 && test "$(pnpm --version)" = 10.14.0`                                                                     | exit 0                                 |
| Renderer tests  | `node --test packages/subgraph/scripts/render-manifest.test.mjs`                                                                                | all tests pass                         |
| Config tests    | `node --test packages/subgraph/scripts/validate-network-config.test.mjs`                                                                        | all tests pass                         |
| Spec tests      | `pnpm --filter @gumball-6900/subgraph spec:test`                                                                                                | all tests pass                         |
| Codegen         | `pnpm --filter @gumball-6900/subgraph codegen`                                                                                                  | exit 0; generated bindings compile     |
| Matchstick      | `pnpm --filter @gumball-6900/subgraph test`                                                                                                     | all mapping tests pass                 |
| Dry-run build   | `pnpm --filter @gumball-6900/subgraph build:dry-run`                                                                                            | two-graph resolved fixture builds      |
| Normal build    | `pnpm subgraph:build`                                                                                                                           | unresolved development manifest builds |
| SDK docs/tests  | `pnpm sdk:test && pnpm --filter @gumball-6900/sdk typecheck && pnpm docs:check`                                                                 | exit 0                                 |
| Full repository | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm sdk:abi:check && pnpm subgraph:build && pnpm web:test:e2e` | every command exits 0                  |

## Suggested executor toolkit

- Read The Graph's official data-source-template documentation before changing the source lifecycle:
  <https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/>. Templates can process their creation
  block and later blocks, but not prior blocks.
- Use the existing Matchstick 0.6.0 helpers in `packages/subgraph/tests/helpers.ts`; do not substitute an unreviewed test
  framework or publish a subgraph.

## Scope

**In scope: decision, schema, and documentation**

- `plans/README.md` — status row only.
- `plans/reviews/002-review-target.md` — create the immutable reviewer-dispatch target record.
- `plans/reviews/002-review-1.md` and `plans/reviews/002-review-2.md` — create the two independent review records.
- `docs/adr/0057-versioned-resonance-graph-indexing.md` — create.
- `packages/subgraph/README.md`
- `packages/sdk/README.md`
- `packages/sdk/src/subgraph.ts`
- `packages/sdk/tests/subgraph.test.ts`
- The directly generated SDK reference files for the new coverage assertion under `docs/reference/sdk/`.
- `packages/subgraph/schema.graphql`

**In scope: deterministic source inventory and gates**

- `packages/subgraph/graph-inventory.json` — create; canonical nested inventory.
- `packages/subgraph/graph-inventory-baseline.json` — create; points to and hashes the last approved Git snapshot used
  as the mandatory append-only comparison.
- `packages/subgraph/history-validation.json` — create only as unresolved placeholder/schema example; never fabricate a
  passing receipt.
- `packages/subgraph/networks.json` — generated flat Graph CLI network file.
- `packages/subgraph/subgraph.template.yaml` — create.
- `packages/subgraph/subgraph.yaml` — generated deterministically; never hand-edit after the renderer exists.
- `packages/subgraph/package.json`
- `packages/subgraph/scripts/render-manifest.mjs` — create.
- `packages/subgraph/scripts/render-manifest.test.mjs` — create.
- `packages/subgraph/scripts/validate-network-config.mjs`
- `packages/subgraph/scripts/validate-network-config.test.mjs` — create.
- `packages/subgraph/scripts/validate-graph-history.mjs` — create.
- `packages/subgraph/scripts/validate-graph-history.test.mjs` — create.
- `packages/subgraph/scripts/check-spec-coverage.mjs`
- `packages/subgraph/scripts/check-spec-coverage.test.mjs`
- `packages/subgraph/scripts/check-plan002-scope.mjs` — create the baseline-to-reviewed-commit path allowlist gate.
- `packages/subgraph/scripts/check-plan002-scope.test.mjs` — create.
- `packages/subgraph/tests/fixtures/graph-inventory.resolved.json` — create.
- `packages/subgraph/tests/fixtures/graph-inventory.initial.resolved.json` — create append-only prior fixture.
- `packages/subgraph/tests/fixtures/graph-inventory.two-graphs.resolved.json` — create.
- `packages/subgraph/tests/fixtures/graph-history.two-graphs.json` — create synthetic validation evidence.
- `packages/subgraph/tests/fixtures/subgraph.two-graphs.yaml` — generated deterministically.
- `packages/subgraph/tests/fixtures/networks.resolved.json` — generated flat Graph CLI fixture.
- `packages/subgraph/tests/fixtures/networks.two-graphs.resolved.json` — create.

**In scope: graph-scoped mappings and tests**

- `packages/subgraph/src/constants.ts`
- `packages/subgraph/src/ids.ts`
- `packages/subgraph/src/entities.ts`
- `packages/subgraph/src/mine.ts`
- `packages/subgraph/src/resonance.ts`
- `packages/subgraph/src/resonance-router.ts`
- `packages/subgraph/src/signal-gbx.ts`
- `packages/subgraph/src/bribe.ts`
- `packages/subgraph/src/bribe-router.ts`
- `packages/subgraph/tests/helpers.ts`
- `packages/subgraph/tests/minimal-core.test.ts`
- `packages/subgraph/tests/signal-gbx-delegation.test.ts`
- `packages/subgraph/tests/multi-graph-replay.test.ts` — create.

**Out of scope**

- Every Solidity file under `packages/contracts/src`; this plan changes no protocol behavior or ABI.
- A dynamic Mine-cutover template as the completeness source, historical log reconstruction inside a mapping, or deletion
  of old sources after cutover.
- Any onchain graph registry, Mine storage/selector change, forced signal migration, rescue, or new authority.
- Treating subgraph amounts, source coverage, or event observations as authorization for a write.
- Inventing a deployment address, start block, code hash, signed manifest, provenance, governance approval, or claim that
  an unresolved graph is trusted.
- Deploying or publishing the subgraph, contracts, SDK, website, or packages.
- Changing the core signal-membership implementation from Plan 001. The plans are independent.
- Unrelated schema/product features, dashboards, frontend queries, economic models, or landing-page/media files.

## Git workflow

- Work in an isolated branch/worktree named `codex/multi-resonance-subgraph` from the exact approved baseline.
- Preserve any current user changes. If an in-scope file is dirty and ownership/integration is unclear, STOP.
- Keep all Plan 002 implementation changes uncommitted until the scope gate at the start of Step 8 proves that
  `packages/contracts/src` has no diff
  against the branch's starting `HEAD`. After that gate, make the exact implementation→baseline-anchor→review-target
  commit chain specified in Step 8; do not squash or reorder it before reviews. Use conventional commit subjects such as
  `feat(subgraph): index versioned resonance graphs`, `chore(subgraph): anchor approved graph inventory`, and
  `chore(audit): bind Plan 002 review target`.
- Do not push, open a PR, merge, deploy, or publish without separate operator instruction.

## Steps

### Step 1: Record the source-lifecycle and trust decision in ADR 0057

Create `docs/adr/0057-versioned-resonance-graph-indexing.md` with these exact decisions:

1. GBX, Mine, and Fund are one immutable singleton source group.
2. Every reviewed Resonance generation contributes one SignalGBX, ResonanceRouter, and Resonance static-source triplet.
3. The inventory is append-only. Each source begins no later than its deployment/earliest relevant event block, and old
   sources remain forever because old claims and exits remain valid.
4. Replacement graphs are indexed and synchronized before a planned Mine cutover when operationally possible. An
   emergency core switch never depends on the subgraph; the next subgraph version can backfill from origin blocks.
5. Mine's cutover event changes only the active future-revenue pointer. Setup events from a predeployed graph do not
   activate it.
6. A→B→A is reachable and produces two immutable activation records without duplicate sources or counters.
7. A Mine cutover missing from processed inventory irreversibly sets explicit mapping coverage false. Graph Node sync and
   indexing errors are checked separately through `_meta`; empty positions are complete only when the SDK joins both
   checks with validated origin-block inventory at the same required block.
8. Structural getter checks prove reciprocal identities only, not bytecode provenance, owner safety, or governance
   approval.
9. The subgraph remains replaceable discovery. Every removal refreshes canonical Bribe weight and Strategy status at
   one pinned block.
10. Dynamic sources created at cutover cannot backfill prior blocks and are not the completeness mechanism.

Update the subgraph and SDK READMEs consistently. Do not use release language.

**Verify**:

```bash
rg -n "append-only|origin block|coverage|A.*B.*A|pinned|not authoritative|prior block" \
  docs/adr/0057-versioned-resonance-graph-indexing.md packages/subgraph/README.md packages/sdk/README.md
pnpm docs:check
```

Expected: the search finds every boundary; `docs:check` exits 0.

### Step 2: Add an append-only canonical inventory and keep Graph CLI inputs generated and flat

Adopt this semantic shape in the new canonical `packages/subgraph/graph-inventory.json` and resolved fixtures:

```json
{
  "robinhood": {
    "chainId": 4663,
    "evidence": {
      "inventoryVersion": "unresolved",
      "topologySha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "validatedThroughBlock": 0,
      "validatedThroughBlockHash": "0x0000000000000000000000000000000000000000000000000000000000000000"
    },
    "singletons": {
      "GBX": {
        "address": "0x...",
        "startBlock": 0,
        "earliestRelevantEventBlock": 0,
        "historyStartValidated": false
      },
      "Mine": {
        "address": "0x...",
        "startBlock": 0,
        "earliestRelevantEventBlock": 0,
        "historyStartValidated": false
      },
      "Fund": {
        "address": "0x...",
        "startBlock": 0,
        "earliestRelevantEventBlock": 0,
        "historyStartValidated": false
      }
    },
    "resonanceGraphs": [
      {
        "generation": "initial",
        "initial": true,
        "SignalGBX": { "address": "0x...", "startBlock": 0 },
        "ResonanceRouter": { "address": "0x...", "startBlock": 0 },
        "Resonance": { "address": "0x...", "startBlock": 0 },
        "earliestRelevantEventBlock": 0,
        "historyStartValidated": false
      }
    ]
  }
}
```

Create `graph-inventory-baseline.json` with this separate shape:

```json
{
  "schemaVersion": 1,
  "approvedCommit": "0000000000000000000000000000000000000000",
  "inventoryPath": "packages/subgraph/graph-inventory.json",
  "inventorySha256": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

Development mode permits those explicit placeholders only until the Step 8 anchor commit. Never put a credential, URL,
branch name, or mutable symbolic ref in this file.

Keep zero-address/startBlock/evidence placeholders in the real unresolved inventory; do not invent production values.
The renderer produces a conventional flat `networks.json`, keyed by every rendered data-source name, solely for Graph CLI
compatibility. Both normal and fixture builds may use that flat generated file. Never pass the nested inventory directly
to `graph build --network-file`. Production validation must reject every unresolved placeholder.

The validator must reject, with deterministic tests:

- missing/extra singleton keys or an empty graph array;
- any wrong chain ID;
- invalid/zero address or nonpositive/unsafe start block in resolved mode;
- duplicate generation labels or labels unsafe for Graph source names;
- zero or more than one `initial: true` graph;
- duplicate addresses across every singleton, graph, and role;
- a Resonance, Router, or SignalGBX reused in another generation or role;
- unordered/rewritten historical inventory relative to the mandatory approved baseline in resolved mode; and
- any singleton or graph source start block greater than its independently supplied earliest relevant event block;
- any singleton or graph `historyStartValidated != true` in resolved mode;
- a missing/zero topology SHA, validation block, or validation hash in resolved mode;
- an evidence topology SHA that differs from the validator's canonical topology hash; and
- a validation block/hash inconsistent with the synthetic cutover/identity evidence fixture.

The two-graph fixture must contain distinct nonzero addresses and realistic positive blocks, with graph B deployed before
its Mine activation. It is test data, not a candidate deployment.

Implement this exact offline validator CLI; do not infer arguments from positional paths:

```bash
node scripts/validate-network-config.mjs \
  --inventory graph-inventory.json \
  --baseline graph-inventory-baseline.json \
  --mode development

node scripts/validate-network-config.mjs \
  --inventory tests/fixtures/graph-inventory.two-graphs.resolved.json \
  --mode resolved \
  --prior-inventory tests/fixtures/graph-inventory.resolved.json \
  --history-evidence tests/fixtures/graph-history.two-graphs.json
```

`development` validates schema, exact keys, labels, deterministic order, collisions, and the baseline-file shape while
allowing only the explicit zero/false placeholders. `resolved` rejects every placeholder and requires append-only
comparison plus a history-evidence receipt. `--prior-inventory` is allowed only for isolated fixtures. Canonical resolved
validation must instead load `graph-inventory-baseline.json`, require a full approved commit SHA that is an ancestor of
`HEAD`, retrieve `packages/subgraph/graph-inventory.json` from that commit with Git, and verify its recorded lowercase
SHA-256 before comparison. The comparison permits one-time zero-to-reviewed resolution of placeholders, append-only new
graph generations, and advancing evidence; it rejects deletion, reorder, reuse, or change of any previously nonzero
address/start block. The baseline file is never silently regenerated.

The receipt schema is: schema version, chain ID, topology SHA-256 computed canonically over schema version, chain ID,
singleton roles, ordered graph generations, each `initial` flag, contract roles/addresses/start blocks, while excluding
mutable validation-evidence fields, pinned block number/hash,
one code-origin/start check per singleton and graph contract, the complete Mine cutover list through the pin, reciprocal
getter results, and no credential or RPC URL. Package scripts must map exactly:

- `network:validate:development` to the first command;
- `network:validate` to resolved mode against canonical inventory, mandatory `graph-inventory-baseline.json`, and
  `history-validation.json` (it fails while any is absent, unresolved, or hash-inconsistent);
- `network:validate:fixture` to the second command; and
- `network:baseline:check` to a read-only check that verifies the baseline commit/path/hash and, when the baseline file
  changed in `HEAD`, requires that commit to change only the baseline file, point at its immediate parent, and hash the
  inventory in that parent; the all-zero sentinel passes only while the canonical inventory itself is explicitly
  unresolved and Step 8 has not claimed completion; and
- `network:history:test` to `node --test scripts/validate-graph-history.test.mjs`.

**Verify**:

```bash
node --test packages/subgraph/scripts/validate-network-config.test.mjs
pnpm --filter @gumball-6900/subgraph network:validate:development
pnpm --filter @gumball-6900/subgraph network:baseline:check
pnpm --filter @gumball-6900/subgraph network:validate:fixture
if pnpm --filter @gumball-6900/subgraph network:validate; then
  echo "ERROR: unresolved production placeholders unexpectedly passed" >&2
  exit 1
fi
```

Expected: validator tests and the resolved fixture pass; missing, rewritten, non-ancestor, or hash-mismatched canonical
baselines fail. The current production config fails specifically on unresolved address/startBlock/evidence placeholders.
That expected production failure is a release blocker, not a green deployment gate.

### Step 3: Render manifests and flat Graph CLI network files deterministically

Create `subgraph.template.yaml` and `scripts/render-manifest.mjs`. The renderer must:

1. preserve singleton source names `GBX`, `Mine`, and `Fund`;
2. preserve the initial graph source names `SignalGBX`, `ResonanceRouter`, and `Resonance` so existing generated ABI type
   imports remain available;
3. render later names deterministically as `<Role>_<safeGeneration>`;
4. render each graph's own contract address and start block;
5. attach `DataSourceContext` fields to every graph source: stable `graphId`, generation, role, `initial`, each declared
   source start block, inventory version, computed topology SHA-256, validation block/hash, and `historyStartValidated`;
6. use `graphId = 4663-resonance-<lowercase Resonance address>`;
7. keep the existing Bribe and BribeRouter templates, which receive `graphId` and full graph-scoped `strategyId` when a
   Strategy is created;
8. attach inventory version, computed topology SHA-256, validation block/hash, Mine start block, and Mine
   `historyStartValidated` context to the singleton Mine source so cutover handlers can record which validated inventory
   observed the event;
9. emit a flat Graph CLI network file keyed by every rendered source name, containing only address/startBlock entries;
10. generate byte-for-byte stable output and support `--check` without writing;
11. make tracked `subgraph.yaml`, `networks.json`, and fixture manifests/network files generated-only; and
12. make codegen/build/test scripts fail when any tracked generated input is stale.

Implement this exact CLI contract:

```bash
node scripts/render-manifest.mjs \
  --inventory graph-inventory.json \
  --manifest subgraph.yaml \
  --network-file networks.json \
  --path-prefix .

node scripts/render-manifest.mjs \
  --inventory tests/fixtures/graph-inventory.two-graphs.resolved.json \
  --manifest tests/fixtures/subgraph.two-graphs.yaml \
  --network-file tests/fixtures/networks.two-graphs.resolved.json \
  --path-prefix ../..
```

`--path-prefix` must rewrite every schema, ABI, and mapping file reference so a fixture manifest under
`tests/fixtures/` resolves the package-root files. `--check` accepts the same arguments and compares both outputs without
writing. Add package scripts:

- `manifest:generate` and `manifest:check` for both canonical and tracked fixture outputs;
- `precodegen`/`pretest`/`prebuild` gates that run `manifest:check`;
- `build:dry-run` that runs validator/spec tests, then
  `graph codegen tests/fixtures/subgraph.two-graphs.yaml` and
  `graph build tests/fixtures/subgraph.two-graphs.yaml --network robinhood --network-file tests/fixtures/networks.two-graphs.resolved.json --output-dir build-dry-run`;
- canonical `codegen` as `graph codegen subgraph.yaml`; and
- canonical `build` as
  `graph build subgraph.yaml --network robinhood --network-file networks.json`.

Do not create replacement graph sources from a Mine mapping. Test one and two generations, deterministic ordering,
context values, unique names, stale-check failure, and malformed config.

If Graph codegen cannot compile one shared mapping import against later uniquely named sources while the initial source
retains its canonical name, STOP and report the exact generated-type error. Do not silently switch to dynamic-only
sources.

**Verify**:

```bash
pnpm --filter @gumball-6900/subgraph manifest:generate
pnpm --filter @gumball-6900/subgraph manifest:check
node --test packages/subgraph/scripts/render-manifest.test.mjs
pnpm --filter @gumball-6900/subgraph codegen
pnpm --filter @gumball-6900/subgraph build:dry-run
git diff --check -- packages/subgraph/graph-inventory.json packages/subgraph/networks.json \
  packages/subgraph/subgraph.template.yaml packages/subgraph/subgraph.yaml \
  packages/subgraph/tests/fixtures/subgraph.two-graphs.yaml \
  packages/subgraph/tests/fixtures/networks.two-graphs.resolved.json \
  packages/subgraph/scripts/render-manifest.mjs
```

Expected: renderer/check/tests/codegen/dry-run exit 0; both manifests and both flat network files are stable; the fixture
build compiles two static triplets without requiring the executor to invent Graph CLI orchestration.

### Step 4: Introduce graph-scoped entities and IDs

Extend `schema.graphql` with:

- `ResonanceGraph`, keyed by `graphId`, containing generation, Resonance, Router, SignalGBX, USDG/Fund when observed,
  graph-local Bribe rate, strategy/live counts, routed/notified/distributed revenue, signaled/active weight totals,
  each declared source start block, inventory version, topology SHA-256, `historyStartValidated`, inventory validation
  block/hash,
  `currentlyReceivesMineRevenue`, activation count, and latest activation position;
- `GraphActivation`, immutable and keyed by `eventId`, containing nullable prior/new graph relations, nonnull raw previous
  Router/new Router/new Resonance addresses, inventory version, block/timestamp/tx/log, and whether the new graph was found
  in the processed static inventory;
- `GraphAccount`, keyed by graph plus account, containing that SignalGBX's event-observed escrow, signal weight, delegate,
  delegated votes, and derived positions;
- `GraphContract`, keyed by chain/role/address, mapping each configured Resonance, Router, and SignalGBX to its graph; and
- `ProtocolState.observedCutoversCovered`, initialized true and irreversibly set false if a Mine activation cannot load a
  structurally matching configured graph; and raw current Mine Router/Resonance addresses even when the trusted graph
  relation is null; plus Mine source start block, topology SHA-256, and `mineHistoryStartValidated` copied from Mine
  context.

Do not store or infer Graph Node sync completion in protocol entities. A mapping cannot know that. Sync and indexing
error health comes only from GraphQL `_meta`; origin/start-block health comes only from the reviewed inventory metadata;
observed-cutover coverage comes only from the Mine mapping. Step 7 defines the exact client-side conjunction.

Keep chain-wide Mine/GBX/Fund aggregates on `ProtocolState` and `Account`. Move graph-specific delegate/vote/receipt and
signal-weight state to `GraphAccount`. Add a graph relation to every Strategy and SignalPosition. Use:

```text
graphId        = chainId + "-resonance-" + resonance
graphAccountId = graphId + "-account-" + account
strategyId     = graphId + "-strategy-" + strategy
positionId     = graphId + "-account-" + account + "-strategy-" + strategy
activationId   = eventId(event)
```

Retain event IDs as chain + transaction hash + log index. Never key activation only by graph because A→B→A is valid.
Delete a SignalPosition only when its canonical incremental Resonance event-observed amount reaches zero; kill and graph
deactivation never delete it.

Since no reviewed production subgraph deployment exists, a schema migration may be direct. If a deployed consumer or
indexed production endpoint is discovered, STOP and require a versioned compatibility/migration plan rather than
silently breaking it.

**Verify**:

```bash
pnpm --filter @gumball-6900/subgraph codegen
pnpm --filter @gumball-6900/subgraph spec:test
pnpm --filter @gumball-6900/subgraph spec:check
```

Expected: codegen and specification checks exit 0; the spec checker requires every new entity, graph relation, context,
and handler shape and no longer assumes one copy of a graph-role source.

### Step 5: Route every mapping mutation through its graph context

Update helpers and mappings so:

1. SignalGBX, ResonanceRouter, and Resonance handlers read `graphId` from `dataSource.context()` and load exactly that
   graph.
2. Bribe and BribeRouter templates receive both graphId and full graph-scoped strategyId.
3. `handleSignalResonanceSet` and `handleResonanceRouterSet` populate/validate graph identity but never activate a
   non-initial predeployed graph. Only the source marked `initial` may initialize an empty active pointer.
4. `handleResonanceRouterUpdated` appends one `GraphActivation`, marks the previous graph inactive, marks the configured
   new graph active, and moves only `ProtocolState.currentMineRevenueGraph`/address pointers.
5. If the new graph is absent or structurally inconsistent, the handler records raw activation addresses, leaves the
   nullable `newGraph` and current trusted graph relation null, and irreversibly sets `observedCutoversCovered = false`.
   It must not create a configured/trusted placeholder graph or invent trust.
6. `Mine.RevenueDeposited` resolves its emitted Router through `GraphContract` and attributes the amount to that graph
   while retaining any intended protocol-wide aggregate.
7. Late old-graph Router, Resonance, SignalGBX, Strategy, Bribe, reward, claim, kill, and exit events mutate only old
   graph entities and never move the active pointer.
8. Graph B setup before the Mine event never clobbers Graph A's active pointer, Bribe rate, counts, balances, delegates,
   or votes.
9. A→B→A increments activation history twice but creates no sources, Strategies, templates, or event totals twice.
10. Physical source uniqueness is guaranteed by config validation. If an early processed-log guard is added, it must run
    before every counter mutation and use the global event ID; do not add a partial guard that protects only some totals.

Preserve sequential duplicate batch arithmetic. Do not infer canonical current balances from setup events or coverage
flags.

**Verify**:

```bash
pnpm --filter @gumball-6900/subgraph codegen
pnpm --filter @gumball-6900/subgraph spec:test
pnpm --filter @gumball-6900/subgraph test
```

Expected: codegen/spec/Matchstick exit 0; no old test still asserts that migration leaves only one indexed graph.

### Step 6: Add a full two-graph replay and fail-closed coverage tests

In `multi-graph-replay.test.ts`, replay this exact chain order:

1. Graph A SignalGBX/Router/Resonance bindings.
2. Graph A Strategy creation and account signal addition.
3. Kill the Graph A Strategy while its position stays positive.
4. Graph B bindings and Strategy creation in a block before Mine cutover.
5. Mine A→B cutover.
6. The same account opens a Graph B position.
7. Old Graph A gets a partial removal after cutover.
8. Old and new Routers route; both Resonances notify/distribute; rewards/claims remain graph-scoped.
9. Final removal from the killed Graph A Strategy.
10. Mine B→A reactivation.

Assert:

- old and new positions coexist before the old final removal;
- one graph's removal, kill, reward, route, delegate, vote, receipt, rate, or counter never changes the other;
- Graph B setup does not activate it early;
- killed Graph A membership remains until its final removal;
- Graph A final removal does not touch Graph B principal;
- both old and new routing remain indexed after cutover;
- A→B→A yields two immutable activations and no duplicate source/template/counter;
- all graph-local mutable entity IDs (`GraphAccount`, `Strategy`, and `SignalPosition`) include graph scope;
  `GraphContract` retains its globally unique chain/role/address lookup ID but must resolve to the correct graph, while
  `ProtocolEvent` and `GraphActivation` retain the global chain/transaction/log event ID;
- duplicate allocation events preserve sequential arithmetic;
- missing graph inventory or wrong role/address flips `observedCutoversCovered` false and leaves the activation's trusted
  graph relation null while preserving its raw addresses;
- late source start is rejected by offline inventory validation; and
- incomplete Graph Node sync/indexing errors are rejected by the SDK `_meta` coverage assertion in Step 7.

Add renderer/config fixtures proving every historical triplet appears exactly once and the earlier deployment blocks are
retained when a later graph is appended. The spec checker must support repeated mapping handlers across multiple static
sources without treating expected source repetition as a duplicate-handler defect.

**Verify**:

```bash
node --test \
  packages/subgraph/scripts/render-manifest.test.mjs \
  packages/subgraph/scripts/validate-network-config.test.mjs \
  packages/subgraph/scripts/check-spec-coverage.test.mjs
pnpm --filter @gumball-6900/subgraph test
pnpm --filter @gumball-6900/subgraph build:dry-run
```

Expected: every test passes; the resolved two-graph fixture renders/builds both triplets; the replay preserves both
histories; missing inventory is explicit rather than represented by a trusted empty graph.

### Step 7: Join offline inventory evidence, mapping coverage, and Graph `_meta` in one fail-closed SDK check

Implement this exact read-only future operator command; `--rpc-env` names an environment variable and the tool must never
print its value:

```bash
node scripts/validate-graph-history.mjs \
  --inventory graph-inventory.json \
  --rpc-env ROBINHOOD_RPC_URL \
  --block <decimal-block> \
  --block-hash <0x-prefixed-32-byte-hash> \
  --output history-validation.json
```

The command first fetches the pinned header and rejects a number/hash mismatch. At that exact block it validates:

- Router points to the configured Resonance and canonical USDG;
- Resonance points to the configured Router, SignalGBX, USDG, and Fund;
- SignalGBX points to canonical GBX and the configured Resonance;
- every Mine cutover through the pinned block resolves to a configured graph;
- each configured source starts no later than its earliest relevant event; and
- every historical graph remains present in the rendered manifest.

For every configured source, require empty code at `startBlock - 1`, nonempty code at the pin, locate the first nonempty
code block at or after `startBlock` by binary search, and record it as the deployment block. This proves the source did
not begin after deployment while allowing a deliberately earlier start. Scan Mine cutover logs from the validated Mine
start block through the pin. The output follows the receipt schema from Step 2 and is written only after every check
passes; failures leave the prior file untouched. Tests use a local mocked JSON-RPC server/transport and must cover chunked
log scans, block/hash mismatch, code-origin mismatch, omitted cutover, getter mismatch, and redacted errors. No network
call occurs in normal unit tests.

Keep pure validation logic separately testable with synthetic RPC/event fixtures. Do not make live RPC a normal unit-test
dependency. These reciprocal getters prove consistency, not honest bytecode, ownership, governance, or legal/release
approval.

After a human reviews the receipt, the operator may copy only its exact topology SHA, pinned block/hash, and per-source
passed origin flags into a new inventory revision, then run resolved validation to prove the topology SHA and receipt
still match.
The validator never mutates topology or Graph entities. Mappings copy the reviewed declarations from source context into
`ProtocolState`/`ResonanceGraph`; they are attestations about the reviewed inventory, not observations of Graph Node sync.

In `packages/sdk/src/subgraph.ts`, add `readSignalDiscoveryCoverage`. It accepts the expected reviewed inventory version,
topology SHA-256, validation block, validation block hash, and subgraph deployment ID from authenticated deployment
configuration, plus graph ID and `requiredBlock`. Its one GraphQL request must read, at exact `requiredBlock`, the chain
ProtocolState and selected graph; query `_meta(block: { number: expectedValidationBlock })` for the validation block
number/hash/deployment; and query latest `_meta` for deployment, sync height, and indexing errors. It must throw
`SubgraphRequestError` unless every clause is true:

1. the graph entity exists and its addresses/generation are nonempty;
2. graph `historyStartValidated == true` and ProtocolState `mineHistoryStartValidated == true`;
3. entity inventory version/topology SHA/block/hash exactly equal the expected authenticated values, and the entity
   topology SHA equals the validator's canonical computed topology SHA;
4. expected/entity `inventoryValidatedThroughBlock >= requiredBlock` and hashes are nonzero;
5. validation `_meta.block.number/hash` exactly equal the expected validation block/hash;
6. validation and latest `_meta.deployment` exactly equal the nonempty authenticated subgraph deployment ID;
7. `ProtocolState.observedCutoversCovered == true` at `requiredBlock`;
8. latest `_meta.hasIndexingErrors == false`; and
9. latest `_meta.block.number >= expectedValidationBlock`.

The helper returns the exact required block, graph ID, inventory version, topology SHA-256, matched validation block/hash,
and deployment ID. A position query may be called history-complete only when it is issued against the same endpoint with
Graph's `block: { number: requiredBlock }` argument and this helper succeeds. The README must say that an empty array
without this successful coverage object is `unknown`, never proof of no position. This is client-side composition;
mappings do not claim to know sync completion.

Test missing protocol/graph, false graph/Mine start validation, expected/entity inventory or topology mismatch, validation
block behind required block, zero validation hash, validation `_meta` hash mismatch, absent/wrong `_meta.deployment`,
endpoint/RPC chain mismatch, unknown observed cutover, indexing error, indexer behind validation block, malformed
response, and the exact passing conjunction. Use mocked GraphQL responses; no live endpoint.

Because the real `graph-inventory.json` and reviewed subgraph deployment ID are unresolved at the planned commit, do not
fabricate a passing live receipt or deployment binding. Document the future command and its required non-secret
environment variable name; the current production gate and SDK coverage check remain fail-closed prerequisites.

**Verify**:

```bash
node --test packages/subgraph/scripts/validate-network-config.test.mjs
node --test packages/subgraph/scripts/validate-graph-history.test.mjs
pnpm --filter @gumball-6900/subgraph network:validate:fixture
pnpm sdk:test
pnpm --filter @gumball-6900/sdk typecheck
pnpm docs:generate
pnpm docs:check
```

Expected: synthetic valid history passes; omitted cutover, identity mismatch, late start block, duplicate role, and changed
pinned block/hash fail deterministically; every coverage conjunction test passes; no secret or RPC URL appears in output.

### Step 8: Bind the implementation range, rebuild evidence, and re-audit old/new exit discovery

Before committing, record the current branch `HEAD` as `PLAN002_BASELINE`, prove Solidity is untouched, and prove that
this is the first introduction of `packages/subgraph/graph-inventory.json`. The seed-anchor workflow below is valid only
when that path does not exist at the recorded baseline; if it does exist, STOP and validate the candidate inventory
against the already approved baseline instead of advancing the pointer. This makes it impossible to hide a deletion or
reorder by comparing a pre-existing inventory to itself.

Make exactly one in-scope implementation commit on top of that baseline. Then populate
`graph-inventory-baseline.json` with that implementation commit and the SHA-256 of its canonical initial unresolved
inventory, and make exactly one anchor commit that changes only the baseline file. The anchor commit is
`PLAN002_FIX_COMMIT`, the commit reviewers inspect. This two-commit shape avoids a self-referential Git SHA and seeds the
mandatory prior snapshot for future append-only changes; it is not a general baseline-advancement procedure.

Create `check-plan002-scope.mjs` with an exact allowlist matching this plan's Scope and deterministic rejection tests. It
must compare the complete baseline-to-reviewed-commit Git range, reject every Solidity, landing/media, deployment, or
other out-of-scope path, and allow only the explicitly listed generated SDK-reference prefix. A clean current working tree
does not substitute for this committed-range check. With `--current=HEAD`, it also limits reviewed-commit→current changes
to the target file, the two exact review reports, and the `plans/README.md` status row; any later implementation/config/test
correction fails and requires a new target-only commit directly after the corrected reviewed commit plus two fresh reports.

Use `apply_patch` to populate the baseline file; do not generate it with an ad hoc shell redirect. Prove this exact chain:

```bash
PLAN002_BASELINE=$(git rev-parse HEAD)
git diff --exit-code "$PLAN002_BASELINE" -- packages/contracts/src
if git cat-file -e "$PLAN002_BASELINE:packages/subgraph/graph-inventory.json" 2>/dev/null; then
  echo "STOP: canonical graph inventory already exists at the Plan 002 baseline" >&2
  exit 1
fi
# Commit the complete in-scope implementation once, excluding every plans/reviews/002-* file.
PLAN002_IMPLEMENTATION_COMMIT=$(git rev-parse HEAD)
test "$(git rev-parse "${PLAN002_IMPLEMENTATION_COMMIT}^")" = "$PLAN002_BASELINE"
pnpm --filter @gumball-6900/subgraph network:validate:development
pnpm --filter @gumball-6900/subgraph network:validate:fixture
# Populate graph-inventory-baseline.json with PLAN002_IMPLEMENTATION_COMMIT and the inventory hash, then commit only it.
PLAN002_FIX_COMMIT=$(git rev-parse HEAD)
test "$(git rev-parse "${PLAN002_FIX_COMMIT}^")" = "$PLAN002_IMPLEMENTATION_COMMIT"
test "$(git diff --name-only "$PLAN002_IMPLEMENTATION_COMMIT" "$PLAN002_FIX_COMMIT")" = \
  packages/subgraph/graph-inventory-baseline.json
pnpm --filter @gumball-6900/subgraph network:baseline:check
node packages/subgraph/scripts/check-plan002-scope.mjs \
  --baseline="$PLAN002_BASELINE" \
  --reviewed-commit="$PLAN002_FIX_COMMIT" \
  --current=HEAD
```

Expected: the baseline has no canonical inventory; Solidity has no diff; the implementation commit directly follows the
recorded baseline; the anchor directly follows the implementation and changes only the baseline file; the recorded
inventory hash is recomputed from the implementation commit; and the complete reviewed range changes only this plan's
allowlist. Do not include either review report or the review-target file in the fix commit. If the operator has not
authorized local commits, STOP and ask for an immutable review-baseline mechanism; do not invent commit SHAs.

Before dispatching reviewers, create `plans/reviews/002-review-target.md` with exactly the following three literal fields
using the values captured above, commit only that file, and record the resulting target commit:

```text
Implementer: <nonempty identity>
Baseline commit: <PLAN002_BASELINE full SHA>
Reviewed commit: <PLAN002_FIX_COMMIT full SHA>
```

```bash
PLAN002_TARGET_COMMIT=$(git rev-parse HEAD)
test "$(git rev-parse "${PLAN002_TARGET_COMMIT}^")" = "$PLAN002_FIX_COMMIT"
test "$(git diff --name-only "$PLAN002_FIX_COMMIT" "$PLAN002_TARGET_COMMIT")" = \
  plans/reviews/002-review-target.md
```

The target commit is the immutable dispatch record, not part of the reviewed implementation range.

Run the complete subgraph pipeline, then dispatch two separate fresh-context agents or two human reviewers who did not
implement the change. The implementer cannot fill either role, and the two reviewers must not collaborate on one report.
If two independent reviewers are unavailable, STOP and request maintainer coordination.

Give both the same reviewed commit and rubric: inspect rendered flat/manifest inputs, origin-block evidence, graph-scoped
IDs/state, nullable missing-inventory activation, A→B→A, SDK coverage conjunction, and pinned onchain warning; replay a
pre-cutover Graph B event and a post-cutover Graph A killed-position exit; report every issue with severity and exact
evidence. A schema diff or passing build alone is insufficient.

Write exactly `plans/reviews/002-review-1.md` and `plans/reviews/002-review-2.md`. Each must contain these literal fields:

```text
Implementer: <identity>
Reviewer: <identity distinct from implementer and other reviewer>
Independent: YES
Review target commit: <same PLAN002_TARGET_COMMIT full 40-hex SHA>
Baseline commit: <same full 40-hex SHA that preceded Plan 002>
Reviewed commit: <same full 40-hex SHA>
Verdict: NO_NEW_MEDIUM_OR_HIGHER | BLOCKED_BY_MEDIUM_OR_HIGHER
```

Each also includes scope, commands/results, two-graph fixture and build hashes, a findings table, and residual-risk notes.
Any Medium-or-higher finding or blocking verdict returns the plan to IN PROGRESS. Do not edit the gauntlet register from
this subgraph-only plan; send the exact commit/report paths and hashes to the audit owner. Do not mark CEX-03 fully closed.

**Verify**:

```bash
pnpm --filter @gumball-6900/subgraph abi:check
pnpm --filter @gumball-6900/subgraph codegen
pnpm --filter @gumball-6900/subgraph spec:test
pnpm --filter @gumball-6900/subgraph test
pnpm --filter @gumball-6900/subgraph build:dry-run
pnpm subgraph:build
pnpm sdk:test
pnpm --filter @gumball-6900/sdk typecheck
pnpm docs:check
git diff --check
TARGET_COMMIT=$(git log -1 --format=%H -- plans/reviews/002-review-target.md)
test -n "$TARGET_COMMIT"
git cat-file -e "${TARGET_COMMIT}^{commit}"
git merge-base --is-ancestor "$TARGET_COMMIT" HEAD
git diff --exit-code "$TARGET_COMMIT" -- plans/reviews/002-review-target.md
TARGET_IMPLEMENTER=$(git show "$TARGET_COMMIT":plans/reviews/002-review-target.md | sed -n 's/^Implementer: //p')
TARGET_BASELINE=$(git show "$TARGET_COMMIT":plans/reviews/002-review-target.md | sed -n 's/^Baseline commit: //p')
TARGET_FIX=$(git show "$TARGET_COMMIT":plans/reviews/002-review-target.md | sed -n 's/^Reviewed commit: //p')
test "$(git rev-parse "${TARGET_COMMIT}^")" = "$TARGET_FIX"
test "$(git rev-parse "${TARGET_FIX}^^")" = "$TARGET_BASELINE"
test "$(git diff --name-only "$TARGET_FIX" "$TARGET_COMMIT")" = plans/reviews/002-review-target.md
test "$(git diff --name-only "${TARGET_FIX}^" "$TARGET_FIX")" = packages/subgraph/graph-inventory-baseline.json
node packages/subgraph/scripts/check-plan002-scope.mjs \
  --baseline="$TARGET_BASELINE" \
  --reviewed-commit="$TARGET_FIX" \
  --current=HEAD
node --test packages/subgraph/scripts/check-plan002-scope.test.mjs
for review in plans/reviews/002-review-1.md plans/reviews/002-review-2.md; do
  test -s "$review"
  rg -q '^Independent: YES$' "$review"
  rg -q '^Review target commit: [0-9a-f]{40}$' "$review"
  rg -q '^Baseline commit: [0-9a-f]{40}$' "$review"
  rg -q '^Reviewed commit: [0-9a-f]{40}$' "$review"
  rg -q '^Verdict: NO_NEW_MEDIUM_OR_HIGHER$' "$review"
  test "$(sed -n 's/^Implementer: //p' "$review")" = "$TARGET_IMPLEMENTER"
  test "$(sed -n 's/^Review target commit: //p' "$review")" = "$TARGET_COMMIT"
  test "$(sed -n 's/^Baseline commit: //p' "$review")" = "$TARGET_BASELINE"
  test "$(sed -n 's/^Reviewed commit: //p' "$review")" = "$TARGET_FIX"
  test "$(sed -n 's/^Reviewer: //p' "$review")" != "$TARGET_IMPLEMENTER"
done
test "$(rg '^Reviewer:' plans/reviews/002-review-{1,2}.md | sed 's/^[^:]*:Reviewer: //' | sort -u | wc -l | tr -d ' ')" = 2
test "$(rg '^Baseline commit:' plans/reviews/002-review-{1,2}.md | sed 's/^[^:]*:Baseline commit: //' | sort -u | wc -l | tr -d ' ')" = 1
test "$(rg '^Reviewed commit:' plans/reviews/002-review-{1,2}.md | sed 's/^[^:]*:Reviewed commit: //' | sort -u | wc -l | tr -d ' ')" = 1
```

Expected: every command exits 0; the reports match the independently committed dispatch target and its exact
baseline→implementation→inventory-anchor chain; two distinct non-implementing reviewers report no new
Medium-or-higher issue. Production validation remains unresolved/fail-closed unless separately reviewed deployment values
now exist.

### Step 9: Run complete repository handoff gates and re-prove the reviewed range did not touch Solidity

Resolve the target as the latest current-branch commit touching the immutable target path, not from self-declared report
agreement; verify the reports still match it and compare that entire reviewed range. Any post-target implementation
correction requires a new target-only commit directly on the corrected fix and two fresh reports. Run root gates in the isolated executor worktree,
never the user's original checkout. Record any `apps/landing/next-env.d.ts` rewrite caused by `pnpm build` as an unstaged,
verification-only side effect; never stage, commit, copy, or merge it, and reject any other out-of-scope change.

```bash
PLAN002_TARGET_COMMIT=$(git log -1 --format=%H -- plans/reviews/002-review-target.md)
git merge-base --is-ancestor "$PLAN002_TARGET_COMMIT" HEAD
git diff --exit-code "$PLAN002_TARGET_COMMIT" -- plans/reviews/002-review-target.md
PLAN002_BASELINE=$(git show "$PLAN002_TARGET_COMMIT":plans/reviews/002-review-target.md | sed -n 's/^Baseline commit: //p')
PLAN002_FIX_COMMIT=$(git show "$PLAN002_TARGET_COMMIT":plans/reviews/002-review-target.md | sed -n 's/^Reviewed commit: //p')
git cat-file -e "${PLAN002_BASELINE}^{commit}"
git cat-file -e "${PLAN002_FIX_COMMIT}^{commit}"
git diff --exit-code "$PLAN002_BASELINE" "$PLAN002_FIX_COMMIT" -- packages/contracts/src
node packages/subgraph/scripts/check-plan002-scope.mjs \
  --baseline="$PLAN002_BASELINE" \
  --reviewed-commit="$PLAN002_FIX_COMMIT" \
  --current=HEAD
echo "landing next-env pre-gate SHA-256"
shasum -a 256 apps/landing/next-env.d.ts
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm sdk:abi:check
pnpm subgraph:build
pnpm web:test:e2e
git diff --check
git diff --cached --exit-code -- apps/landing/next-env.d.ts
echo "landing next-env post-gate SHA-256"
shasum -a 256 apps/landing/next-env.d.ts
git diff -- apps/landing/next-env.d.ts
git status --short
```

Expected: the target-bound reviewed Plan 002 range has no Solidity diff and every gate exits 0. The landing pre/post
hashes and any diff are recorded; it remains unstaged and excluded, and no other out-of-scope path changes.
Review/evidence files may be committed separately only after this succeeds. Do not rewrite or erase Plan 001 to
manufacture a green scope check.

## Test plan

- Renderer unit tests: zero, one, and two graphs; stable output; source names; contexts; start blocks; stale check;
  malformed inventory.
- Validator unit tests: exactly one initial graph; all role/address uniqueness; append-only prior inventory; origin-block
  evidence; pinned cutover completeness; structural identity mismatch; secret-safe errors.
- Spec checker tests: graph-scoped entities/relations and every handler/context are required; repeated sources do not
  weaken handler coverage.
- Matchstick unit tests: current one-graph behavior rewritten around `ResonanceGraph` and `GraphAccount`.
- Full replay: Graph A setup/position/kill, Graph B pre-cutover setup, A→B, B position, old A exit/rewards/routing, B→A.
- Coverage-health tests: offline validation rejects late sources; mappings flag unknown observed cutovers; the SDK rejects
  missing inventory metadata, an unsynced/erroring indexer, or a validation block behind the requested block.
- No test may create a production address, assert a subgraph amount is write-authoritative, or depend on publishing.

## Done criteria

All must hold:

- [ ] Explicit maintainer approval is recorded and the plan moved out of BLOCKED before implementation.
- [ ] ADR 0057 records append-only origin-block sources, active-pointer semantics, coverage health, and periphery status.
- [ ] The inventory separates GBX/Mine/Fund singletons from one or more Resonance graph triplets.
- [ ] Canonical resolved validation loads and hashes a mandatory approved Git inventory baseline; the anchor commit is
      baseline-file-only and points to its immediate parent.
- [ ] The initial seed proved no canonical inventory existed at the source baseline; no pre-existing inventory was
      self-compared or overwritten.
- [ ] The real unresolved config retains placeholders and production validation still fails closed.
- [ ] The renderer is deterministic, checkable, and emits every historical triplet exactly once with graph context.
- [ ] No Mine-cutover dynamic template is used as the history-complete mechanism.
- [ ] Graph-local rates, counters, receipt/vote/delegate state, Strategies, and positions are graph-scoped.
- [ ] Old graph sources/entities remain active indefinitely and killed positions persist until final removal.
- [ ] Only initial configuration and Mine events change the active future-revenue graph.
- [ ] A→B→A records two activations without duplicate sources, templates, or totals.
- [ ] Offline origin validation, mapping-observed cutover coverage, and SDK `_meta` sync/error checks are separate and all
      required before a position query can be called complete.
- [ ] Coverage binds the canonical topology SHA and authenticated `_meta.deployment`, not only a free-form inventory label.
- [ ] The SDK compares the authenticated validation block hash to `_meta` at that exact block and rejects chain/reorg
      mismatch.
- [ ] The two-graph replay includes Graph B activity before cutover and Graph A exit after cutover.
- [ ] Clients are still instructed to pin and refresh canonical onchain state before removal.
- [ ] Renderer, validator, spec, codegen, Matchstick, dry-run, SDK, docs, and full repository gates pass.
- [ ] Two distinct non-implementing review records match the immutable review-target commit and have
      `NO_NEW_MEDIUM_OR_HIGHER` verdicts.
- [ ] No Solidity source, deployment state, release artifact, or unrelated user file is staged or committed; any isolated
      `next-env.d.ts` verification rewrite is recorded/excluded and the user's original checkout is untouched.
- [ ] CEX-03 is not marked fully closed by this operational hardening.
- [ ] `plans/README.md` status is updated.

## STOP conditions

Stop and report; do not improvise if:

- The maintainer has not explicitly approved this work.
- Any Current state excerpt differs semantically or a deployed production consumer/index is discovered.
- An in-scope dirty file overlaps the plan and no instruction preserves the user's work.
- A proposed design indexes replacement graphs only from the Mine cutover block or deletes old sources.
- A configured source starts after an earlier relevant event, or a historical cutover graph is absent.
- Graph codegen cannot compile the shared mapping against multiple unique static sources.
- Setup events from a non-active graph can change the active pointer or another graph's counters.
- Graph-specific delegate/vote/receipt state remains on the chain-wide Account.
- Position or Strategy identity can collide across graphs, or A→B→A duplicates processing.
- An SDK/client path can label an empty result complete without the exact required-block coverage conjunction.
- The endpoint's `_meta` hash at the validation block differs from the authenticated inventory evidence.
- Fixing the issue requires Solidity, an onchain registry, migration authority, forced movement, or deployment action.
- A live validator would need to print a credential-bearing RPC URL or invent missing deployment evidence.
- Production zero placeholders unexpectedly pass validation.
- The canonical inventory already exists at the recorded Plan 002 baseline, the committed-range scope allowlist fails,
  the target is not the latest target-path commit on the current branch, or any post-target correction lacks two fresh
  reviews.
- A verification step fails twice after one reasonable, in-scope correction.
- Two independent non-implementing reviewers are unavailable or either review reports a Medium-or-higher issue.
- Fixing a failure requires touching an out-of-scope file.

## Maintenance notes

- Step 8's seed-anchor procedure is one-time only. Every later inventory revision must first validate the candidate
  against the baseline file's existing approved commit/hash and complete independent review. Only afterward may a
  baseline-only anchor commit advance the pointer to the newly reviewed inventory; deleting/reordering prior entries or
  advancing the pointer in the candidate implementation commit is forbidden.
- A changed topology requires a new topology SHA and authenticated subgraph deployment ID. Reusing an inventory label,
  block, or old deployment ID cannot establish history completeness.
- Old graph sources are never removed merely because Mine later reactivates or replaces another graph.

## Maintenance notes

- Every future Mine cutover requires appending the reviewed graph triplet and origin blocks; never replace old entries.
- Planned cutovers should backfill and synchronize the expanded subgraph before switching Mine, but emergency core
  liveness never waits for indexing.
- Review source start blocks against the earliest event, not merely the Mine activation block.
- Keep activation history event-keyed because a graph can become active more than once.
- Every future graph-local entity must include graph scope; chain-wide Account/ProtocolState fields are only for genuine
  cross-graph aggregates.
- Subgraph coverage health is evidence about indexing, never evidence that a contract is canonical, reviewed, or safe.
- Plan 001 supplies current-state Strategy discovery within a known graph. This plan supplies durable operational graph
  discovery. Neither alone satisfies the original strict unknown-history property across lost historical graph keys.
