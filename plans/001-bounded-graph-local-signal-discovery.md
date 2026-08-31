# Plan 001: Add bounded graph-local signal-position discovery without making metadata an exit dependency

> **REJECTED — DO NOT EXECUTE.** On 2026-08-31 the maintainer selected CEX-03 Option 2: no core membership or Solidity
> change and explicit acceptance of the event-history discovery dependency. The existing subgraph remains the selected
> initial-graph discovery layer. This document remains frozen proposal analysis only.

> **Executor instructions**: Do not execute this plan unless the maintainer explicitly reverses the CEX-03 decision and
> the status row in `plans/README.md` is changed from REJECTED to TODO. Follow the plan step by step.
> Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions
> occurs, stop and report; do not improvise. When done, update the status row in `plans/README.md`, unless a reviewer
> dispatched you and said they maintain the index.
>
> **Drift check (run first)**:
>
> ```bash
> SOURCE_BASELINE="PENDING_SOURCE_BASELINE"
> test "${#SOURCE_BASELINE}" -eq 40
> git cat-file -e "${SOURCE_BASELINE}^{commit}"
> git merge-base --is-ancestor "$SOURCE_BASELINE" HEAD
> test -z "$(git diff --name-only "$SOURCE_BASELINE"..HEAD -- . ':!plans')"
> git diff --stat "$SOURCE_BASELINE"..HEAD -- \
>   AGENTS.md docs/adr docs/ARCHITECTURE.md docs/facts/gumball-6900-facts.md \
>   docs/reference/contracts.md docs/reference/sdk \
>   packages/contracts/src/core/Resonance.sol packages/contracts/src/core/README.md \
>   packages/contracts/src/periphery/README.md packages/contracts/test/minimal \
>   packages/contracts/test/integration packages/contracts/audit \
>   packages/sdk/src packages/sdk/tests packages/sdk/README.md packages/subgraph/abis/Resonance.json
> ```
>
> If any in-scope file changed since this plan was written, compare the Current state excerpts against live code. A
> semantic mismatch is a STOP condition. The source-baseline placeholder is deliberately unresolved while this plan is
> BLOCKED. Before changing the status to TODO: (1) the audit owner commits the intended audit harness/tests as the source
> baseline; (2) replaces the command/status placeholder with that full SHA and changes the index to TODO; and (3) commits
> only the approved plan/index as a later plan-approval commit. The dispatcher starts the executor from that later commit.
> The commands above prove the source baseline is an ancestor and that only `plans/` differs between the two. This avoids
> embedding a commit's own SHA inside itself. Never reset, clean, checkout, or overwrite current audit work to manufacture
> either baseline.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `70091b6`, 2026-08-31
- **Source baseline**: `PENDING_SOURCE_BASELINE` (audit harness/tests; replace before TODO)
- **Executor start**: the later plan-approval commit supplied by the dispatcher; do not embed its self-referential SHA

## Why this matters

At the planned commit, an account can have positive sGBX and a fully recoverable Bribe weight while no bounded current
core read reveals the Strategy address required by `SignalGBX.removeSignal`. Losing wallet or event history can therefore
make exact GBX principal operationally inaccessible even though the known-key scalar exit still works. The smallest core
improvement is an address-only membership set inside each Resonance, with count/index reads and work proportional only to
that account's positive positions.

This is not a second accounting ledger and must never become an exit precondition. Bribe weights remain canonical; a
metadata inconsistency must not make a valid scalar removal revert. The repair proves bounded Strategy discovery only
within a known Resonance graph. It does not discover an unknown historical Resonance address after Mine switches Routers,
so the audit disposition must preserve that residual instead of claiming full closure of the original cross-graph
property.

## Current state

### Frozen target and confirmed reproduction

- `packages/contracts/audit/gauntlet/findings.json:6-41` records confirmed Medium CEX-03 at the planned commit. Its strict
  property requires every exit key to be discoverable without a website, SDK, subgraph, keeper, or retained event
  history.
- `packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol:198-210` creates 100 ether of signal, calls
  the stateless Lens with an empty Strategy list, and observes an aggregate receipt of 100 ether but zero position rows;
  the paired Bribe still records the full canonical weight.
- `packages/contracts/src/periphery/SignalPortfolioLens.sol:11-15,47-79` takes a caller-supplied Strategy array and has no
  registry.

Relevant current reproduction excerpt:

```solidity
// packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol:198-210
function test_Repro_LensCannotDiscoverSignalWithoutCallerStrategyKey() external {
    _signalDefault(ALICE, 100 ether);
    SignalPortfolioLens lens = new SignalPortfolioLens();
    address[] memory noKnownStrategies = new address[](0);
    (AccountView memory accountView, StrategyAccountView[] memory views) =
        lens.portfolio(signalGBX, resonance, ALICE, noKnownStrategies);
    assertEq(accountView.totalSignal, 100 ether);
    assertEq(views.length, 0);
    assertEq(targetBribe.signalWeightOf(ALICE), 100 ether);
}
```

The type names above are abbreviated only in this plan excerpt; use the exact qualified names already present in the
test when editing it.

### Canonical signal transitions

`packages/contracts/src/core/Resonance.sol:84-95` currently stores registered/live Strategy state and each Strategy's
Bribe, but no account membership:

```solidity
mapping(address strategy => bool registered) public isStrategyRegistered;
mapping(address strategy => bool live) public isStrategyLive;
mapping(address strategy => address bribe) public bribeFor;
mapping(address strategy => address router) public bribeRouterFor;
```

`packages/contracts/src/core/Resonance.sol:246-285` changes canonical weight only through SignalGBX:

```solidity
function addSignalFor(address account, address strategy, uint256 amount) external nonReentrant onlySignalGBX {
    // validation and revenue checkpoint
    totalSignalWeight += amount;
    Bribe(bribeFor[strategy]).addSignalWeight(account, amount);
    emit SignalAdded(account, strategy, amount);
}

function removeSignalFor(address account, address strategy, uint256 amount) external nonReentrant onlySignalGBX {
    // validation
    Bribe bribe = Bribe(bribeFor[strategy]);
    uint256 allocated = bribe.signalWeightOf(account);
    if (amount > allocated) revert InsufficientSignal(strategy, allocated, amount);
    // checkpoint and live-weight update
    bribe.removeSignalWeight(account, amount);
    emit SignalRemoved(account, strategy, amount);
}
```

The paired Bribe's `signalWeightOf(account)` is the canonical per-account amount. `killStrategy` at
`Resonance.sol:442-459` marks the Strategy dead and removes its total from active allocation, but deliberately preserves
each account's incumbent weight so it remains removable.

### Applicable design decisions

- ADR 0051 at `docs/adr/0051-scalar-and-batched-signal-entrypoints.md:73-88` currently chooses event/subgraph discovery
  and a stateless caller-supplied Lens. The approved remediation must explicitly supersede only that discovery choice.
- ADR 0055 at `docs/adr/0055-governed-mine-revenue-router-migration.md:71-94` requires the complete replacement graph to
  be deployed before Mine switches last and leaves all old signal positions in the old graph. There is no cross-graph
  accounting copy or migration.
- `AGENTS.md` forbids a cross-graph registry, forced signal move, write-through Router, operator approval, `removeAll`,
  or another owner-gated method. Scalar removal is the bounded liveness fallback.
- Contract body order is types, constants, immutables/state, events, errors, modifiers, constructor, state-changing
  functions, public views, internal state-changing helpers, internal views. Match the existing layout.

### Library behavior to rely on

The pinned OpenZeppelin 5.6.1 `EnumerableSet.AddressSet` implementation documents O(1) add/remove/length/index access and
no ordering guarantee. Its `values()` method copies the full set and warns of unbounded cost. Use `add`, `remove`,
`length`, and `at`; do not expose `values()`.

### Existing consumers and verification harnesses

- `packages/sdk/src/readers.ts:369-414` says Strategy discovery is offchain and reads a caller-supplied Lens portfolio at
  one pinned/revalidated block.
- `packages/contracts/test/minimal/Invariants.t.sol:123-194`,
  `packages/contracts/test/minimal/utils/ProtocolHandler.sol:472-484`, and
  `packages/contracts/audit/harness/ProtocolStateMachineCampaign.sol:595-613,896-912` currently scan the test's global
  Strategy registry. That makes CEX-03 exit discovery tautological and must become an independent oracle, not the
  production-path discovery mechanism.
- `packages/contracts/audit/check-echidna-results.mjs:7-35` has a strict 27-property manifest. Any new or renamed property
  must be wired into the checker, checker tests, Medusa checker, Foundry campaign assertion, and nightly runner.
- At plan time, several audit and invariant files were intentionally dirty from the active audit. Preserve those exact
  changes; never replace a whole file from the planned commit. They are not reproducible from `70091b6` alone, which is
  why the approval transition must first create and record the full implementation-baseline commit above.

## Commands you will need

Run commands from the repository root unless the command begins with `cd packages/contracts`.

| Purpose         | Command                                                                                                                                              | Expected on success                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Toolchain       | `test "$(node --version)" = v22.23.1 && test "$(pnpm --version)" = 10.14.0`                                                                          | exit 0                                      |
| Focused core    | `cd packages/contracts && forge test --match-path test/minimal/Resonance.t.sol -vv`                                                                  | all selected tests pass                     |
| Signal flow     | `cd packages/contracts && forge test --match-path test/minimal/SignalGBX.t.sol -vv`                                                                  | all selected tests pass                     |
| Exit regression | `cd packages/contracts && forge test --match-path test/minimal/audit-exitability/HistoricalFindings.t.sol -vv`                                       | CEX-03 affirmative regression passes        |
| Invariants      | `cd packages/contracts && FOUNDRY_PROFILE=ci forge test --match-path test/minimal/Invariants.t.sol -vv`                                              | all invariants pass without handler reverts |
| Integration     | `cd packages/contracts && FOUNDRY_PROFILE=integration forge test --match-contract CampaignHarnessTest -vv`                                           | all campaign properties pass                |
| Hardhat parity  | `pnpm contracts:test:hardhat`                                                                                                                        | all Hardhat tests pass                      |
| SDK             | `pnpm sdk:abi:generate && pnpm sdk:abi:check && pnpm sdk:test && pnpm --filter @gumball-6900/sdk typecheck && pnpm --filter @gumball-6900/sdk build` | exit 0; generated ABI is clean              |
| Subgraph ABI    | `pnpm --filter @gumball-6900/subgraph abi:sync && pnpm --filter @gumball-6900/subgraph abi:check`                                                    | exit 0; ABI is clean                        |
| Solidity shape  | `cd packages/contracts && forge fmt --check && forge build --sizes`                                                                                  | exit 0; no EIP-170 regression               |
| Full repository | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm sdk:abi:check && pnpm subgraph:build && pnpm web:test:e2e`      | every command exits 0                       |

## Scope

**In scope: the only production and documentation files that may change**

- `plans/README.md` — status row only.
- `AGENTS.md` — update the signal-discovery rule and preserve the cross-graph residual.
- `docs/adr/0056-bounded-graph-local-signal-discovery.md` — create the approved decision record.
- `docs/adr/0051-scalar-and-batched-signal-entrypoints.md` — mark only its discovery paragraph as superseded by ADR 0056.
- `docs/ARCHITECTURE.md`
- `docs/facts/gumball-6900-facts.md`
- `packages/contracts/src/core/Resonance.sol`
- `packages/contracts/src/core/README.md`
- `packages/contracts/src/periphery/README.md`
- `packages/sdk/src/readers.ts`
- `packages/sdk/src/index.ts` only if the new reader is not already re-exported by the current index pattern.
- `packages/sdk/src/generated-abis.ts` — generated only.
- `packages/sdk/tests/readers.test.ts`
- `packages/sdk/README.md`
- `packages/subgraph/abis/Resonance.json` — generated only.
- `docs/reference/contracts.md` and the directly generated files under `docs/reference/sdk/` for the new reader/ABI.

**In scope: tests and audit evidence**

- `packages/contracts/test/minimal/Resonance.t.sol`
- `packages/contracts/test/minimal/SignalGBX.t.sol`
- `packages/contracts/test/minimal/SignalPortfolioLens.t.sol`
- `packages/contracts/test/minimal/Invariants.t.sol`
- `packages/contracts/test/minimal/utils/ProtocolHandler.sol`
- `packages/contracts/test/minimal/SignalGas.t.sol`
- `packages/contracts/test/minimal/audit-exitability/HistoricalFindings.t.sol`
- `packages/contracts/test/minimal/audit-exitability/AuditGas.t.sol`
- `packages/contracts/test/integration/CampaignHarness.t.sol`
- `packages/contracts/audit/harness/ProtocolStateMachineCampaign.sol`
- `packages/contracts/audit/check-echidna-results.mjs`
- `packages/contracts/audit/check-echidna-results.test.mjs`
- `packages/contracts/audit/check-medusa-results.mjs`
- `packages/contracts/audit/check-medusa-results.test.mjs`
- `packages/contracts/audit/check-fuzzer-wiring.test.mjs`
- `packages/contracts/audit/check-cex03-fix-scope.mjs` — create the source-baseline-to-fix allowlist gate.
- `packages/contracts/audit/check-cex03-fix-scope.test.mjs` — create.
- `packages/contracts/audit/freeze-cex03-evidence.mjs` — create a deterministic reviewed manifest from ignored raw receipts.
- `packages/contracts/audit/freeze-cex03-evidence.test.mjs` — create.
- `packages/contracts/audit/check-gauntlet-findings.mjs` — create.
- `packages/contracts/audit/check-gauntlet-findings.test.mjs` — create.
- `packages/contracts/audit/run-nightly.sh`
- `packages/contracts/audit/run-signal-resonance-mutations.mjs`
- `packages/contracts/audit/MUTATION-TESTING.md`
- `packages/contracts/audit/FINDINGS.md` — update the reviewed CEX-03 disposition and evidence links.
- `packages/contracts/audit/gauntlet/findings.json`
- `packages/contracts/audit/gauntlet/evidence/post-cex03-evidence.json` — create the normalized, committed evidence manifest;
  never copy raw tool output here.
- `packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md` — create the immutable dispatch target.
- `packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-1.md` — create.
- `packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-2.md` — create.
- Do not edit raw ignored tool output by hand.

**Out of scope**

- `packages/contracts/src/core/SignalGBX.sol`, `Bribe.sol`, `Mine.sol`, and `IResonance.sol`. Their selectors, custody,
  amount accounting, and migration boundaries do not need to change. If a core consumer unexpectedly requires the new
  getters in `IResonance`, STOP and report the exact caller before expanding scope.
- Any cross-graph history registry, graph migration, backfill, rescue/sweep, `removeAll`, `moveSignal`, write-through
  Router, operator approval, signature relay, pause, proxy, or new authority.
- An unbounded `signalStrategies(account)` array return or any state-changing loop over the complete membership set.
- A duplicate per-account amount mapping in Resonance.
- Any change to Bribe reward accounting, Curve/Euler reference semantics, Strategy auction economics, Mine routing,
  Fund redemption, launcher behavior, governance, deployment configuration, or subgraph schema/mappings.
- Deployment, verification, role transfer, funding, package publication, website publication, or release claims.
- Unrelated existing user work, including landing-page files, cinematic media, `tmp/`, or audit work outside the exact
  CEX-03 integration hunks.

## Git workflow

- Before TODO, the audit owner must create the source-baseline commit containing the exact intended audit harness/tests,
  replace the placeholder in the drift command/status field, and commit only the approved plan/index on top. The executor
  must not infer or reconstruct uncommitted state from `70091b6`.
- Work in an isolated branch/worktree named `codex/cex03-known-graph-discovery` from the later plan-approval commit. Verify
  that its only diff from the recorded source baseline is under `plans/`. Before any edit, record that full HEAD as
  `CEX03_EXECUTOR_START` and preserve the value through Step 9. Do not create it until approval.
- Use conventional commits matching the repository, for example `fix(protocol): add bounded signal discovery` and
  `test(audit): prove signal membership exactness`.
- Keep production, generated-consumer, and audit-evidence commits logically separable for review.
- Do not push, open a PR, merge, deploy, or publish unless the operator separately instructs it.

## Steps

### Step 1: Record the exact approved property and residual in ADR 0056

Create `docs/adr/0056-bounded-graph-local-signal-discovery.md`. Record all of the following without broadening them:

1. Given a Resonance address and account, current state enumerates exactly the account's positive live-or-killed Strategy
   addresses with work proportional only to that account's current position count.
2. Each paired Bribe remains the only canonical amount ledger. Membership is address-only discovery metadata.
3. Scalar `removeSignal` never checks membership and remains usable if metadata were somehow stale.
4. Membership is inserted after a successful canonical add and removed only after a successful final canonical removal.
5. Kills never remove membership. Duplicate batch entries retain sequential amount semantics but one set member.
6. Enumeration order is unstable; count/index reads must be pinned to one block.
7. There is no unbounded getter, `removeAll`, cross-graph registry, backfill, migration, or new authority.
8. Direct, non-upgradeable deployments cannot retrofit this storage into an already deployed Resonance.
9. Unknown historical Resonance graph addresses still require authenticated event/deployment/index history. The original
   CEX-03 strict property remains partially open unless the maintainer accepts that residual.

Update ADR 0051 only to link this superseding decision. Update `AGENTS.md`, architecture, facts, and core/periphery
README prose consistently. Do not say "closed", "audited", "verified", or "release-ready".

**Verify**:

```bash
pnpm docs:check
rg -n "known Resonance|historical Resonance|canonical.*Bribe|unstable" \
  docs/adr/0056-bounded-graph-local-signal-discovery.md AGENTS.md \
  docs/ARCHITECTURE.md docs/facts/gumball-6900-facts.md \
  packages/contracts/src/core/README.md packages/contracts/src/periphery/README.md
```

Expected: `docs:check` exits 0; the search shows explicit canonical-ledger, unstable-order, and historical-graph residual
language in the new decision and the relevant protocol guidance.

### Step 2: Add the minimal address-only set to Resonance

In `packages/contracts/src/core/Resonance.sol`:

1. Import OpenZeppelin `EnumerableSet` and add
   `using EnumerableSet for EnumerableSet.AddressSet;` next to the existing `SafeERC20` use clause.
2. Add exactly one private state mapping:

   ```solidity
   mapping(address account => EnumerableSet.AddressSet strategies) private _signalStrategies;
   ```

3. After `Bribe(...).addSignalWeight(account, amount)` succeeds, call
   `_signalStrategies[account].add(strategy)`. Call it on every successful add; set idempotence keeps duplicates unique
   and also repairs a missing metadata entry. Ignore the returned boolean. Do not add an assertion or new revert.
4. Preserve the existing pre-removal `allocated` read. After `bribe.removeSignalWeight(account, amount)` succeeds, call
   `_signalStrategies[account].remove(strategy)` only when `amount == allocated`. Ignore the returned boolean. This makes
   a missing metadata entry unable to block exact principal exit.
5. Do not touch membership in `killStrategy`.
6. In the public view section, expose only:

   ```solidity
   function signalStrategyCount(address account) external view returns (uint256 count);
   function signalStrategyAt(address account, uint256 index) external view returns (address strategy);
   ```

   Implement them with `length()` and `at()`. Document O(1) access, unstable ordering, and the inherited deterministic
   out-of-bounds revert. Do not expose `values()` or `contains()`.

7. Add no events, errors, owner methods, amount storage, or mutation selectors.

Place every declaration and function according to the repository's Solidity body-order check.

**Verify**:

```bash
cd packages/contracts
forge fmt --check
forge build --sizes
forge test --match-path test/minimal/Resonance.t.sol -vv
forge test --match-path test/minimal/SignalGBX.t.sol -vv
```

Expected: every command exits 0; all selected tests pass; `Resonance` remains below EIP-170. Do not loosen an existing gas
or size threshold.

### Step 3: Replace the negative reproduction with exhaustive deterministic regressions

Write tests using the existing `ProtocolFixture` and current scalar/batch helpers. Cover, at minimum:

1. unknown account count is zero and index zero reverts;
2. first scalar add, repeated add, partial remove, final remove, then re-add;
3. two or more Strategies, removing a non-final set slot and verifying the exact remaining set without assuming order;
4. separate accounts never share membership;
5. duplicate `addSignalMany` entries produce one member and the correct summed Bribe weight;
6. duplicate `removeSignalMany` entries preserve membership after the partial entry and delete after the final entry;
7. duplicate over-removal reverts the complete batch, restoring membership, Bribe weights, sGBX, GBX custody, votes,
   global active weight, and events;
8. a later invalid or killed Strategy in an add batch rolls back an earlier membership insertion;
9. a later over-removal in a removal batch rolls back an earlier final deletion;
10. kill retains membership; adding to the killed Strategy reverts unchanged; partial and final scalar/batch exits work;
11. kill between enumeration and removal does not invalidate the old key or exit;
12. Mine Router cutover after discovering an old graph does not affect old-graph scalar exit;
13. reward lifetime-cap exhaustion and a broken reward token do not block membership discovery or scalar principal exit;
14. unauthorized direct Resonance hook calls and every failed add/remove leave membership unchanged;
15. the 32-position capped-gas batch rollback test retains every member, after which scalar exits empty the set and return
    exact GBX principal; and
16. a Foundry-only fault-injection helper starts from a legitimate positive Bribe weight, uses the compiler-reported
    Resonance storage layout plus `vm.store` to clear only that account/Strategy's discovery-set membership, proves
    `signalStrategyCount(account) == 0` while the paired Bribe weight remains positive, then performs scalar final removal
    and recovers exact GBX principal without revert. If the exact private-set slots cannot be derived and asserted against
    `forge inspect Resonance storage-layout`, STOP rather than guessing storage.

Rewrite the CEX-03 test at `HistoricalFindings.t.sol:198-210` as an affirmative regression: omit the Strategy from every
external list, enumerate it only through `Resonance.signalStrategyCount/At`, read the canonical paired-Bribe weight, call
scalar `removeSignal`, and prove exact GBX recovery plus zero final membership. Keep the Lens stateless and add a small
test/documentation assertion that it accepts the newly discovered list rather than discovering it itself.

**Verify**:

```bash
cd packages/contracts
forge test --match-path test/minimal/Resonance.t.sol -vv
forge test --match-path test/minimal/SignalGBX.t.sol -vv
forge test --match-path test/minimal/SignalPortfolioLens.t.sol -vv
forge test --match-path test/minimal/audit-exitability/HistoricalFindings.t.sol -vv
forge test --match-path test/minimal/audit-exitability/AuditGas.t.sol -vv
forge test --match-path test/minimal/SignalGas.t.sol -vv
```

Expected: all selected tests pass, the affirmative CEX-03 test discovers and exits without a supplied Strategy list, and
the gas tests retain their pre-existing thresholds.

### Step 4: Make production discovery and the independent oracle impossible to confuse

Update the Foundry invariant handler and external campaign as two distinct paths:

- **Production path**: enumerate through `signalStrategyCount/At`; use those addresses for snapshot/scalar exits.
- **Independent oracle**: continue scanning every Strategy in the test registry and compare its canonical Bribe weight
  to the production set.

For every tracked account, prove:

1. each enumerated address is registered and unique;
2. every enumerated canonical Bribe weight is positive;
3. every globally scanned positive account/Bribe position appears exactly once;
4. every zero-weight position is absent;
5. killed positive positions remain present;
6. the sum of enumerated canonical weights equals `SignalGBX.balanceOf(account)`;
7. killing a Strategy leaves membership unchanged;
8. enumerating and executing scalar removals empties membership and sGBX and returns exact GBX principal;
9. failed batches roll back membership along with every canonical ledger.

Do not let campaign guards make duplicate, partial/final, kill/remove, re-add, rollback, or many-account paths
unreachable. Retain explicit action reachability checks. Strengthen or add one externally visible property, then update
all strict property manifests and `_assertAllProperties`; a property that is absent from either Echidna or Medusa is a
failure.

**Verify**:

```bash
cd packages/contracts
FOUNDRY_PROFILE=ci forge test --match-path test/minimal/Invariants.t.sol -vv
FOUNDRY_PROFILE=integration forge test --match-contract CampaignHarnessTest -vv
node --test \
  audit/check-echidna-results.test.mjs \
  audit/check-medusa-results.test.mjs \
  audit/check-fuzzer-wiring.test.mjs
```

Expected: zero handler reverts; all invariants and checker tests pass; checker output proves the exact same property set is
wired into Foundry, Echidna, and Medusa.

### Step 5: Add one-block SDK discovery and regenerate consumers

In `packages/sdk/src/readers.ts`, add a typed reader for one known Resonance graph. Use this exact continuation contract:

```ts
export interface SignalStrategyPageOptions extends ReadOptions {
  readonly offset?: bigint;
  readonly limit?: number;
}

export interface SignalStrategyPage {
  readonly account: Address;
  readonly resonance: Address;
  readonly strategies: readonly Address[];
  readonly offset: bigint;
  readonly nextOffset: bigint | null;
  readonly total: bigint;
  readonly snapshot: BlockSnapshot;
}
```

The implementation must:

1. normalize the Resonance and account addresses;
2. pin one block with the existing `snapshot` helper;
3. read the account's count and requested indexes at that exact block;
4. default `offset` to `0n` and `limit` to 64; require `0 <= offset <= total` and integer `1 <= limit <= 128`;
5. read exactly the indexes in `[offset, min(total, offset + BigInt(limit)))`; `offset == total` returns an empty tail
   page with `nextOffset == null`, while `offset > total` rejects;
6. return the complete `BlockSnapshot`, including block hash, plus normalized addresses and page metadata;
7. set `nextOffset` to the exclusive end only when that end is less than total;
8. revalidate the pinned block with `revalidateBlockSnapshot` before returning;
9. require every later page, Lens call, and direct Bribe/Strategy read in the same composition to use
   `{ atBlock: page.snapshot.blockNumber, expectedBlockHash: page.snapshot.blockHash }`; and
10. leave `readSignalPortfolio` caller-selected and treat set order as unstable across different snapshots.

Name the function `readSignalStrategyPage`. Tests must prove empty, exact-tail, partial-tail, one-page, multi-page,
normalization, offset greater than total, limits 0/129/non-integer, count/index failure, continuation using the same
block hash, a reorg between pages, and final revalidation. Never assume set order across snapshots.

Regenerate the concrete Resonance ABI and derived SDK/subgraph ABI files; do not hand-edit generated arrays or JSON.
Regenerate only directly affected reference docs.

**Verify**:

```bash
pnpm sdk:abi:generate
pnpm sdk:abi:check
pnpm sdk:test
pnpm --filter @gumball-6900/sdk typecheck
pnpm --filter @gumball-6900/sdk build
pnpm --filter @gumball-6900/subgraph abi:sync
pnpm --filter @gumball-6900/subgraph abi:check
pnpm docs:generate
pnpm docs:check
git diff --check
```

Expected: all commands exit 0; a second `sdk:abi:check`, subgraph `abi:check`, and `docs:check` report no stale generated
files.

### Step 6: Add targeted mutations and record gas without weakening gates

Extend `packages/contracts/audit/run-signal-resonance-mutations.mjs` with test-killed CEX-03 mutants for:

- omitted membership addition;
- wrong account or Strategy key on addition;
- omitted final deletion;
- deletion on partial removal;
- deletion during kill;
- incorrect count/index getter behavior;
- a broken full-remove/re-add path; and
- reverting or asserting when final `_signalStrategies[account].remove(strategy)` returns false. The fault-injected
  absent-membership exit regression must test-kill this mutant.

Do not replace or remove any existing mutant. Compile-killed mutants do not count as evidence for these semantics. Update
the mutation manifest count and durable documentation only from actual runner output.

Record gas separately for first add, repeated add, partial removal, final removal, a killed exit with sixteen reward
tokens, sixteen duplicate allocations, twenty-six distinct maximum-reward positions, and the thirty-two-position capped
rollback followed by scalar recovery. Membership writes must roll back in the capped failure and be zero after scalar
recovery. Do not loosen existing thresholds merely to obtain green output.

**Verify**:

```bash
cd packages/contracts
node audit/run-signal-resonance-mutations.mjs --match=CEX03- --no-report
node audit/run-signal-resonance-mutations.mjs --no-report
forge test --match-path test/minimal/SignalGas.t.sol -vv
forge test --match-path test/minimal/audit-exitability/AuditGas.t.sol -vv
forge build --sizes
```

Expected: every new CEX03 mutant is test-killed; the complete mutation set has zero survivors and zero compile-kills;
gas tests pass unchanged thresholds; Resonance remains below EIP-170. These are iteration runs only. Step 8 reruns both
sets against the immutable fix commit with durable reports; `--no-report` output is never review evidence.

### Step 7: Re-run accounting differentials and fresh hostile campaigns

There is no honest Curve MultiRewards or Euler Fee Flow analogue for protocol-specific address membership. Use the
global Strategy scan plus canonical Bribe weights as the differential shadow model. Re-run all existing Curve/Euler
accounting differentials to prove reward amounts, indexes, event ordering, settlement, and claims are unchanged.

Run hostile sequences where an unrelated caller attempts to corrupt another account, duplicates interleave with final
removals, kill occurs between enumeration and exit, and Mine cuts over after old-graph discovery. Fresh Echidna and
Medusa runs must use the strict checkers, exact seed/config manifests, source LCOV, action reachability, and the same
property list. Missing native tools, Docker, LCOV, or strict receipts is a blocker, not a skip or pass.

Extend the mutation runner and nightly wrapper with an evidence mode used after the fix is committed. The mutation runner
accepts `--expected-source-commit=<full SHA>`; the nightly wrapper accepts `CEX03_EXPECTED_SOURCE_COMMIT` and
`CEX03_REPORT_DIR`. Both must reject if the audited Solidity, campaign/test sources, runner/checker, or config inputs differ
from that commit. Their JSON evidence embeds the source commit, exact command/seed, tool version, input paths plus
SHA-256, output/LCOV paths plus SHA-256, property/action counts, and final verdict. Diagnostic `--no-report` runs never
satisfy this mode.

**Verify**:

```bash
cd packages/contracts
FOUNDRY_PROFILE=ci forge test
pnpm test:hardhat
pnpm test:integration
bash audit/run-nightly.sh
```

Expected: all Foundry/Hardhat/differential tests pass; the nightly runner records fresh strict-checked Echidna and Medusa
campaigns with at least 100,000 calls each and non-vacuous membership/exit coverage.

### Step 8: Re-audit the change and record a partial, evidence-bounded disposition

After all implementation commits, bind the exact range before dispatch. Read `CEX03_SOURCE_BASELINE` from this plan's
resolved Status field, retain the execution-start value recorded before edits, and set `CEX03_FIX_COMMIT` to the current
`HEAD`. Create `check-cex03-fix-scope.mjs` with an exact allowlist matching this plan's Scope (including only the documented
generated-prefix exceptions). It must require source baseline→executor start to change only `plans/`, require executor
start→fix to change only the implementation Scope, reject every other path, and explicitly require
`apps/landing/next-env.d.ts` and every other landing/media/deployment path to be byte-identical across both ranges. With
`--current=HEAD`, it must also require fix→current committed changes to be limited to the target, the normalized CEX-03
evidence manifest, the two exact reviews, the two CEX-03 disposition registers, and the `plans/README.md` status row; any
later source/test/runner/config change fails and forces a new fix target and two fresh reviews.

Create `post-cex03-known-graph-review-target.md` with exactly these fields, then commit only that file immediately on top
of the fix commit:

```text
Implementer: <nonempty identity>
Source baseline: <resolved source-baseline full 40-hex SHA>
Executor start: <recorded plan-approval/executor-start full 40-hex SHA>
Reviewed commit: <CEX03_FIX_COMMIT full 40-hex SHA>
```

Use `apply_patch` for the record. If local commits are not authorized, STOP and request an immutable dispatch mechanism.
Derive the canonical target later as the latest commit on the current branch that touched this exact target path; do not
accept a target SHA chosen only by the review reports. Require that target commit to be an ancestor of `HEAD`, to have the
fix commit as its direct parent, to change only the target file, and to match the current target file byte-for-byte. Any
post-target production, test, runner, config, or evidence-input correction invalidates both reviews: update the target in
a new target-only commit directly after the corrected fix and rerun both reviews.

Before dispatch, produce fresh commit-bound receipts:

```bash
node packages/contracts/audit/check-cex03-fix-scope.mjs \
  --source-baseline="$CEX03_SOURCE_BASELINE" \
  --executor-start="$CEX03_EXECUTOR_START" \
  --fix-commit="$CEX03_FIX_COMMIT" \
  --current=HEAD
cd packages/contracts
node audit/run-signal-resonance-mutations.mjs \
  --match=CEX03- \
  --expected-source-commit="$CEX03_FIX_COMMIT" \
  --report-dir=audit/reports/post-cex03
node audit/run-signal-resonance-mutations.mjs \
  --expected-source-commit="$CEX03_FIX_COMMIT" \
  --report-dir=audit/reports/post-cex03
CEX03_EXPECTED_SOURCE_COMMIT="$CEX03_FIX_COMMIT" \
  CEX03_REPORT_DIR=audit/reports/post-cex03 \
  bash audit/run-nightly.sh
node audit/freeze-cex03-evidence.mjs \
  --source-commit="$CEX03_FIX_COMMIT" \
  --review-target-commit="$CEX03_TARGET_COMMIT" \
  --focused-mutation=audit/reports/post-cex03/signal-resonance-mutation-cex03.json \
  --full-mutation=audit/reports/post-cex03/signal-resonance-mutation-all.json \
  --nightly=audit/reports/post-cex03/campaign-evidence.json \
  --output=audit/gauntlet/evidence/post-cex03-evidence.json
```

Expected: the scope gate passes; focused/full mutation JSON and the nightly campaign-evidence JSON all embed the same fix
commit and hash-bind their actual inputs and outputs. The freezer first runs the strict mutation/Echidna/Medusa validators,
then writes a deterministic normalized manifest with exactly `focused_mutation`, `full_mutation`, and `nightly_campaign`
records; the nightly record must contain both accepted Echidna and Medusa subrecords. It stores relative raw paths,
SHA-256 values, commands/config/input hashes, source/target commits, counts, and verdicts, but no raw stdout, LCOV body,
absolute path, timestamp, or credential. Keep raw outputs ignored. Commit the normalized manifest with the later reviewed
disposition evidence so a clean checkout retains the evidence boundary without violating the raw-output policy.

Dispatch two reviewers who did not implement the fix. If independent agent or human review is unavailable, STOP and ask
the maintainer; the implementer cannot author either review. Give both reviewers the exact fix commit and require each to
inspect the final diff, reproduce the affirmative exit test, inspect mutation/fuzzer receipts, and report findings with
severity/evidence. Their rubric must cover scalar exit independence, rollback, killed positions, duplicates,
swap-and-pop enumeration, SDK block-hash continuation, and cross-graph overclaim.

Write their independent records to exactly:

- `packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-1.md`
- `packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-2.md`

Each record must contain these literal fields, followed by scope, exact commands/results, a receipt table containing at
least the exact normalized manifest path
`packages/contracts/audit/gauntlet/evidence/post-cex03-evidence.json` and its lowercase SHA-256, a findings table, and
residual-risk notes. During the fresh review, both reviewers must also open and spot-check all three ignored raw receipt
categories against the manifest; after review, the committed manifest and review attestations are the durable record.

```text
Implementer: <same nonempty identity in both reports>
Reviewer: <identity distinct from the implementer and other reviewer>
Independent: YES
Review target commit: <same canonical target full 40-hex SHA>
Reviewed commit: <same full 40-hex fix commit SHA>
Verdict: NO_NEW_MEDIUM_OR_HIGHER | BLOCKED_BY_MEDIUM_OR_HIGHER
```

Any reported Medium-or-higher issue or blocking verdict blocks disposition. A report without at least one existing,
hash-matching receipt is not review evidence.

Create `check-gauntlet-findings.mjs` and tests so the register cannot be updated by loose prose. For CEX-03 require this
exact machine shape after both reviews pass:

- `status`: `partially_remediated`
- `decision_state`: `approved_narrow_fix_historical_graph_residual_accepted`
- `fix_commit`: the reviewed full 40-hex commit SHA
- `fix_review_evidence`: exactly two objects, one per exact review path, each containing exactly `implementer`, `reviewer`,
  `review_target_commit`, `review_path`, `review_sha256`, `reviewed_commit`, `verdict`, and nonempty `receipt_evidence`;
  `receipt_evidence` must contain exactly one item for the normalized manifest, with exactly `path`, lowercase `sha256`,
  `source_commit`, and the exact category list `focused_mutation`, `full_mutation`, `nightly_campaign`
- `residual_risk`: nonempty and explicitly states that an unknown historical Resonance address still requires
  authenticated history/configuration

The validator must parse the six literal report fields, independently derive/validate the canonical target commit,
recompute each report and normalized-manifest hash, parse the manifest's source/target commits, exact three categories,
input hashes, counts, and verdicts, and require the JSON evidence to match them exactly. Normal clean-checkout mode does
not require ignored raw files to exist. Initial disposition mode uses `--require-raw-receipts` and must re-open/re-hash all
raw paths from the manifest before either report is accepted. It rejects missing/extra review paths or object keys, an
empty/mismatched implementer, duplicate reviewers, either reviewer equal to the implementer, any missing/extra category,
divergent manifest evidence between reviewers, commit mismatch, stale/alternate review target, a manifest/input not bound
to the fix commit, malformed hashes, any recomputed hash mismatch, a blocking verdict, full-closure status, or absent
residual.
It also validates the matching CEX-03 entry in `packages/contracts/audit/FINDINGS.md`: that durable disposition must say
`partially_remediated`, link the normalized evidence manifest, both exact reports, and the fix commit, and state the
historical-graph residual without any full-closure claim.

Update both `packages/contracts/audit/gauntlet/findings.json` and `packages/contracts/audit/FINDINGS.md` only after this
validation format exists. The permitted disposition is:

- graph-local Strategy-key discovery within a known Resonance: remediated if every gate passes;
- historical Resonance graph-address discovery: explicit residual requiring authenticated history/configuration;
- overall original strict CEX-03: partially remediated or accepted residual, not fully closed.

Do not count these focused reviewers as the final two whole-system red-team passes required after every finding decision.

**Verify**:

```bash
git diff --check
CEX03_TARGET_COMMIT=$(git log -1 --format=%H -- \
  packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md)
test -n "$CEX03_TARGET_COMMIT"
git merge-base --is-ancestor "$CEX03_TARGET_COMMIT" HEAD
CEX03_FIX_COMMIT=$(git show "$CEX03_TARGET_COMMIT":packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md | sed -n 's/^Reviewed commit: //p')
CEX03_SOURCE_BASELINE=$(git show "$CEX03_TARGET_COMMIT":packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md | sed -n 's/^Source baseline: //p')
CEX03_EXECUTOR_START=$(git show "$CEX03_TARGET_COMMIT":packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md | sed -n 's/^Executor start: //p')
test "$(git rev-parse "${CEX03_TARGET_COMMIT}^")" = "$CEX03_FIX_COMMIT"
test "$(git diff --name-only "$CEX03_FIX_COMMIT" "$CEX03_TARGET_COMMIT")" = \
  packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md
git diff --exit-code "$CEX03_TARGET_COMMIT" -- \
  packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md
node packages/contracts/audit/check-cex03-fix-scope.mjs \
  --source-baseline="$CEX03_SOURCE_BASELINE" \
  --executor-start="$CEX03_EXECUTOR_START" \
  --fix-commit="$CEX03_FIX_COMMIT" \
  --current=HEAD
node --test \
  packages/contracts/audit/check-cex03-fix-scope.test.mjs \
  packages/contracts/audit/freeze-cex03-evidence.test.mjs \
  packages/contracts/audit/check-gauntlet-findings.test.mjs \
  packages/contracts/audit/check-static-findings.test.mjs
node packages/contracts/audit/freeze-cex03-evidence.mjs \
  --source-commit="$CEX03_FIX_COMMIT" \
  --review-target-commit="$CEX03_TARGET_COMMIT" \
  --focused-mutation=packages/contracts/audit/reports/post-cex03/signal-resonance-mutation-cex03.json \
  --full-mutation=packages/contracts/audit/reports/post-cex03/signal-resonance-mutation-all.json \
  --nightly=packages/contracts/audit/reports/post-cex03/campaign-evidence.json \
  --output=packages/contracts/audit/gauntlet/evidence/post-cex03-evidence.json \
  --check
node packages/contracts/audit/check-gauntlet-findings.mjs --require-raw-receipts
node packages/contracts/audit/check-gauntlet-findings.mjs
test "$(rg -l '^Verdict: NO_NEW_MEDIUM_OR_HIGHER$' \
  packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-{1,2}.md | wc -l | tr -d ' ')" = 2
```

Expected: checks exit 0; exactly two independent reports have the passing verdict; the freezer is byte-stable; initial
validation re-hashes every ignored raw artifact; normal validation succeeds from the committed normalized manifest alone;
and both modes bind the independently derived target/fix range and reject a missing category, full closure, or an omitted
historical-graph residual.

### Step 9: Run the complete repository handoff gates in the isolated executor worktree

Run under Node 22.23.1 and pnpm 10.14.0 in the isolated executor worktree from the Git workflow, never in the user's
original checkout. Record the pre-gate hash of `apps/landing/next-env.d.ts`; the root build is known to be able to rewrite
that tracked generated file. The rewrite is a verification-only side effect: it must stay unstaged, must not enter any
fix/evidence commit, and must never be copied or merged back. No other out-of-scope path may change.

```bash
CEX03_TARGET_COMMIT=$(git log -1 --format=%H -- \
  packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md)
CEX03_FIX_COMMIT=$(git show "$CEX03_TARGET_COMMIT":packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md | sed -n 's/^Reviewed commit: //p')
CEX03_SOURCE_BASELINE=$(git show "$CEX03_TARGET_COMMIT":packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md | sed -n 's/^Source baseline: //p')
CEX03_EXECUTOR_START=$(git show "$CEX03_TARGET_COMMIT":packages/contracts/audit/gauntlet/rounds/post-cex03-known-graph-review-target.md | sed -n 's/^Executor start: //p')
node packages/contracts/audit/check-cex03-fix-scope.mjs \
  --source-baseline="$CEX03_SOURCE_BASELINE" \
  --executor-start="$CEX03_EXECUTOR_START" \
  --fix-commit="$CEX03_FIX_COMMIT" \
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
node packages/contracts/audit/check-cex03-fix-scope.mjs \
  --source-baseline="$CEX03_SOURCE_BASELINE" \
  --executor-start="$CEX03_EXECUTOR_START" \
  --fix-commit="$CEX03_FIX_COMMIT" \
  --current=HEAD
```

Expected: every gate exits 0; the landing pre/post hashes and any generated diff are recorded as verification evidence;
the only permitted out-of-scope working-tree change is that unstaged generated landing file. Any other out-of-scope
change is a STOP. Report code/tests, fresh campaign evidence, audit disposition, generated-file side effects, and Git
status separately. A green build is engineering evidence only, not deployment or release evidence.

## Test plan

- Use `packages/contracts/test/minimal/Resonance.t.sol` for direct getter and membership-transition semantics.
- Use `packages/contracts/test/minimal/SignalGBX.t.sol` for scalar/batch atomicity, duplicates, votes, custody, and rollback.
- Replace the negative CEX-03 reproduction in `HistoricalFindings.t.sol` with current-state discovery and exact scalar
  principal recovery.
- Model killed/reward-cap/broken-token liveness on the existing audit-exitability tests; do not create a privileged test
  shortcut that production lacks.
- Keep the test registry only as the completeness oracle. Production-path invariant exits enumerate via Resonance.
- Add SDK mocked-client tests following the existing `readSignalPortfolio` block-snapshot/revalidation patterns in
  `packages/sdk/tests/readers.test.ts`.
- Add mutation IDs prefixed `CEX03-` and require test kills.
- Fresh fuzz campaigns must reach positive membership insertion, duplicate no-op insertion, partial retention, final
  deletion, killed exit, failed-batch rollback, and exact principal recovery.

## Done criteria

All must hold:

- [ ] Explicit maintainer approval is recorded and `plans/README.md` was moved out of BLOCKED before implementation.
- [ ] The drift command/status contain the same source-baseline SHA, and the executor-start commit differs from it only
      under `plans/`.
- [ ] ADR 0056 defines only known-graph bounded discovery and preserves the historical-graph residual.
- [ ] Resonance stores only an address set; Bribe remains the canonical amount ledger.
- [ ] Scalar removal never checks membership and survives an absent membership entry.
- [ ] Count/index are O(1), order-unstable, and the only new public getters.
- [ ] Killed positions remain enumerable until successful final removal.
- [ ] Duplicate, partial/final, re-add, rollback, account-isolation, reward-failure, and gas regressions pass.
- [ ] Production-path invariants enumerate through Resonance; the global registry is only the independent oracle.
- [ ] The SDK reader pins and revalidates one block and supports bounded pages.
- [ ] Concrete SDK and subgraph ABIs are generator-clean.
- [ ] Every new membership mutant is test-killed; the full mutation set has no survivors or compile-kills.
- [ ] Fresh strict Echidna and Medusa campaigns each execute at least 100,000 calls with non-vacuous coverage.
- [ ] Two independent focused fix reviews report no new Medium-or-higher issue in this change.
- [ ] The immutable review target and scope checker bind both reviews, every receipt/input hash, and the exact allowed
      source-baseline-to-fix range; any correction forces fresh reviews.
- [ ] The committed normalized evidence manifest contains exactly focused mutation, full mutation, and nightly
      Echidna-plus-Medusa evidence; initial validation re-hashed raw receipts and clean-checkout validation needs no raw
      tool output.
- [ ] `FINDINGS.md` and `gauntlet/findings.json` agree on the partial disposition and historical-graph residual.
- [ ] The finding is not marked fully closed across unknown historical Resonance graphs.
- [ ] Every repository handoff gate exits 0.
- [ ] No out-of-scope file is staged or committed; any isolated-worktree `next-env.d.ts` build rewrite is recorded and
      excluded, and the user's original checkout is untouched.
- [ ] `plans/README.md` status is updated.

## STOP conditions

Stop and report; do not improvise if:

- The maintainer has not explicitly approved the narrow CEX-03 remediation.
- The source-baseline command/status field is unresolved, it is not an ancestor of executor `HEAD`, or non-plan files
  differ before implementation begins.
- Any Current state excerpt or selector differs semantically from the live code.
- An in-scope dirty audit/test file overlaps the planned hunk and no integration instruction preserves the user's work.
- The intended property is still described as full no-history discovery across unknown historical Resonance addresses.
- Implementation appears to require a cross-graph registry, SignalGBX selector change, Bribe amount change, `IResonance`
  expansion for a core caller, migration/backfill, new authority, or deployment action.
- Any metadata check, assertion, or returned-boolean requirement can make otherwise valid scalar removal revert.
- A killed positive position disappears before its final canonical removal.
- A failed scalar/batch operation changes membership or any canonical balance.
- The fault-injected absent-membership case cannot exit exact principal, or the returned-boolean revert mutant survives.
- Enumeration relies on stable index ordering across blocks.
- A targeted mutant survives or is only compile-killed.
- A fuzzer property/checker manifest differs, a required action is unreachable, LCOV is absent, or a campaign is skipped.
- Two non-implementing reviewers are unavailable, either review reports Medium-or-higher, or audit-register validation
  fails.
- The target is not the latest target-path commit on the current branch, the target/fix parent relation fails, the
  source-baseline-to-fix scope allowlist fails, or any post-target correction lacks two fresh reviews.
- Gas thresholds must be loosened, Resonance exceeds EIP-170, or an existing Curve/Euler differential changes.
- A verification step fails twice after one reasonable, in-scope correction.
- Fixing a failure requires touching an out-of-scope file.

## Maintenance notes

- Any future add/remove signaling path must update membership on the same canonical transition and add mutation coverage.
- Any future Strategy-kill change must preserve account membership until final removal.
- Clients must pin the count/index page and canonical Bribe reads to one block; swap-and-pop order is not stable.
- A future cross-graph registry proposal is a new protocol/trust decision, not an extension of this plan.
- Reviewers should scrutinize failure ordering: set changes occur only after successful canonical Bribe changes, and EVM
  rollback restores both when any later batch entry fails.
- Plan 002 is a deferred optional single-manifest design and is never a substitute for this known-graph current-state
  proof.
