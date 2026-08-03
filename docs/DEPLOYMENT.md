# GUM BALL 6900 Deployment

Status: deployment runbook baseline. No environment described here is approved for user funds. A valid schema,
successful script, or green CI job is evidence for one gate only; it is not deployment authorization.

## Deployment principles

- Fail closed on unknown chain IDs, unresolved dependencies, address drift, missing bytecode, code-hash drift,
  interface mismatch, inactive registry state, unsigned manifests, or incomplete reviews.
- Re-read mutable facts from primary sources immediately before every testnet rehearsal and mainnet deployment.
- Keep live API/RPC verification out of ordinary CI. Pull requests use captured fixtures so third-party availability or
  data drift cannot make an unrelated build nondeterministic.
- Never place provider credentials, private keys, or signed legal artifacts in generated public JSON.
- Mainnet transactions require a separate reviewed operator ceremony. GitHub Actions packages evidence but never
  broadcasts a mainnet deployment.
- Core contracts are direct and non-upgradeable. Wiring, constructor inputs, CREATE2 salts, and roles must be correct
  before contributions open.

## Current network facts

The typed baseline in `packages/config` records:

| Environment             | Chain ID | Public RPC reference                      | Explorer                                       |
| ----------------------- | -------: | ----------------------------------------- | ---------------------------------------------- |
| Robinhood Chain         |     4663 | `https://rpc.mainnet.chain.robinhood.com` | `https://robinhoodchain.blockscout.com`        |
| Robinhood Chain Testnet |    46630 | `https://rpc.testnet.chain.robinhood.com` | `https://explorer.testnet.chain.robinhood.com` |

Public RPCs are rate limited and are not production dependencies. Use named archive-capable providers in private
environment configuration; generated manifests record only a provider label, never a credential-bearing URL.

Mainnet USDG, WETH, and Uniswap v4 addresses in the source tree are provisional specification-date inputs. The
official [Robinhood token-contract page](https://docs.robinhood.com/chain/contracts/) and
[Uniswap v4 deployment registry](https://developers.uniswap.org/docs/protocols/v4/deployments) remain authoritative.

The following stock-token candidates were captured from Robinhood's official
[`/rhj/assets` registry](https://docs.robinhood.com/chain/stock-token-apis/) on 2026-08-01:

| Symbol | Mainnet candidate                            | Registry UID suffix                |
| ------ | -------------------------------------------- | ---------------------------------- |
| AAPL   | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` | `c2425be3658540dd8e2424cbf3c5c649` |
| NVDA   | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` | `915f477416294f5099a5e0e09f327ce5` |
| QQQ    | `0xD5f3879160bc7c32ebb4dC785F8a4F505888de68` | `2470b933c52d47ccad017ed9ee80c9ed` |
| SPCX   | `0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa` | `1aa9c9cc0bf34c5e95cfe7168463d310` |
| TSLA   | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` | `cfece3244ea34bb29414dd9488b32d9f` |

These are drift tripwires, not approvals. The complete UIDs live in the typed baseline and captured fixture.

## Hard unresolved gates

The repository intentionally does not invent or approve values for:

- a release-approved canonical wrapped-BTC identity and bridge/custodian review. A dated exact-block,
  bridge-derived candidate exists, but it remains provisional and does not pass this gate;
- the remaining canonical testnet stock-token, wrapped-BTC, and Uniswap v4 core/periphery deployments (USDG, WETH,
  and Permit2 are provisional inputs, not release approvals);
- production compliance mode, eligibility module, registry owner, change delay, signer threshold, or permitted
  alternate redemption receiver; or
- Robinhood deployments and exact runtime hashes for the ADR-0011 permissioned-pool factory, adapter, hook,
  Permissioned Position Manager, Universal Router 2.2+, both quoters, and verification escrow.

The deployment-manifest schema permits these gates to remain `unresolved` in a draft but rejects
`release-approved` while any gate is not `passed`. Do not substitute an Ethereum, Base, or arbitrary ticker-matching
address.

## Environment setup

Copy `.env.example` to a local ignored `.env` and populate only the environment being rehearsed. Required live-tool
inputs include:

```text
ROBINHOOD_MAINNET_RPC_URL
ROBINHOOD_TESTNET_RPC_URL
ROBINHOOD_MAINNET_ARCHIVE_RPC_URL
ROBINHOOD_TESTNET_ARCHIVE_RPC_URL
ROBINHOOD_BLOCKSCOUT_API_KEY
ROBINHOOD_TESTNET_BLOCKSCOUT_API_KEY
MANIFEST_OBSERVED_AT
EXPECTED_BYTECODE_HASHES_PATH
DEPLOYMENT_MANIFEST_PATH
SAFE_CONTROL_PLANE_EVIDENCE_OUTPUT
SAFE_CONTROL_PLANE_BLOCK_NUMBER
```

Use an explicit RFC-3339 `MANIFEST_OBSERVED_AT`; the tooling never inserts the local clock into signed output. Keep
the deployer key out of shell history and CI. Prefer a hardware-wallet or reviewed multisig transaction flow.

Install and verify the workspace:

```bash
pnpm install --frozen-lockfile
pnpm --filter @gumball-6900/config typecheck
pnpm config:test
```

`config:test` is fully offline. It validates captured Robinhood registry data, simulated onchain interface responses,
bytecode pin behavior, deterministic JSON, and deployment-schema gates.

The separate `permissioned-pool:graph:validate` command validates the successor graph. Its example is a
non-authorizing draft and its schema requires `releaseEligible` to equal `false`. It is review evidence, not a
transaction authorization artifact:

```bash
pnpm --filter @gumball-6900/config permissioned-pool:graph:validate -- \
  deployments/permissioned-pool-graph.example.json
```

The Hardhat runner has an explicit `permissioned` branch. It verifies the five configured upstream runtime hashes,
deploys the checker and purpose-limited adapter controller, creates the adapter with the controller as owner from
birth, configures the four official wrappers plus fixed verification escrow, allows the canonical hook, binds the
hook and escrow once to `PermissionedLiquidityManager`, and records a distinct post-genesis swap-activation
transaction. A local full-genesis rehearsal proves the one-wei verification cycle and one-for-one 20,000,000 GBX
adapter backing. The Foundry deployment runner remains unrestricted local-test tooling.

Release-manifest schema v1 still fails explicitly on this branch. Schema v2 is reserved for the permissioned successor
and can authorize it only when the signed manifest and verifier bind three distinct raw JSON artifacts: the exact
permissioned graph, a reproducible build of the pinned official Uniswap sources, and a fresh Robinhood testnet-fork
rehearsal. The graph must in turn bind independent security-review and legal-decision evidence. No populated production
version of those artifacts is committed, so this mechanism does not make the current repository release-authorized.

## Fork verification

The mainnet fork suite accepts no compiled-in dependency baseline. The release workflow deterministically exports its
exact block/hash plus every USDG proxy/implementation/authority, USDG, WETH, wrapped-BTC, stock-token, and complete
Uniswap v4 address/runtime hash from the prepared signed manifest and hash-bound deployment config. The suite proves
the signed block hash on a one-block-newer archive view, returns to the exact signed state, checks USDG proxy authority,
verifies token symbols, manifest decimals, stock UIDs and multipliers, then deploys a fresh protocol
graph and performs a real guarded pool initialization plus four-position genesis seed through the canonical
PoolManager, PositionManager, and Permit2. It also proves maximal per-range integer liquidity, exact
principal-plus-residual conservation, position-NFT custody, and post-seed allowance revocation. The real-v4 lifecycle
tests additionally swap USDG/GBX in both directions, collect and burn GBX fees, route USDG fees and completed-range
principal to the vault, sweep a terminal position, and execute a timelocked canonical migration through the real
PositionManager. The pinned 1:1 vector has a 188,254 wei GBX residual as documented in ADR-0005.
The same fork state also runs nonzero `transfer` and `transferFrom` through every signed stock-token runtime using
synthetically supplied raw balances. This exercises real token code at the signed observation block without claiming
that an existing production holder or its offchain eligibility was discovered.

Run it only with an archive-capable endpoint after exporting the required values from prepared release inputs with
`scripts/release/export-mainnet-fork-context.mjs`: 88 fields for schema v1 or 92 for permissioned schema v2. The
exporter also requires the exact late-registry artifact, its raw official response archive, expected stage, and
E/C/tag linkage; setting only an RPC URL intentionally fails closed:

```bash
cd packages/contracts
ROBINHOOD_MAINNET_RPC_URL="$ROBINHOOD_MAINNET_ARCHIVE_RPC_URL" \
  forge test --match-path 'test/foundry/fork/*' -vv
```

Every executed fork requires the complete fresh signed context. With no RPC the local suite explicitly skips; with an
RPC, any missing value or bytecode/block drift fails rather than falling back to a source constant.

When its RPC is set, the testnet suite requires an exact block, its parent-block hash, and every address and code hash
listed under `ROBINHOOD_TESTNET_*` in `.env.example`. It validates chain ID, pinned block ancestry, bytecode identity,
and USDG/WETH token metadata. Release and main-branch gates export those facts only from the committed
`packages/config/deployments/robinhood-testnet-fork-evidence.json`; the current `unconfigured` sentinel fails closed.
Configured evidence carries `observedAt` and `expiresAt`, has at most a 24-hour validity window, and must still be fresh
when a release exports it. For a release, the reviewed snapshot is part of source commit `C`, which the signed manifest
binds. Mutable CI variables cannot change it. The harness never copies mainnet addresses and cannot pass as a
chain-only check.

## Generate a live stock-token candidate manifest

Run only from a reviewed workstation with a trusted Robinhood archive RPC:

```bash
pnpm config:manifest:assets -- \
  --rpc-url "$ROBINHOOD_MAINNET_ARCHIVE_RPC_URL" \
  --block-number "$ROBINHOOD_MAINNET_STOCK_OBSERVATION_BLOCK" \
  --observed-at "$MANIFEST_OBSERVED_AT" \
  --output "$ASSET_MANIFEST_OUTPUT"
```

The generator fetches only `https://api.robinhood.com/rhj/assets`, pins one RPC block, and aborts the complete output
unless every selected asset passes all checks:

- RPC chain ID is exactly 4663;
- exactly one registry record and one chain-4663 deployment exist for each expected symbol;
- registry status is active;
- address and UID match the reviewed provisional candidate;
- runtime bytecode is nonempty;
- onchain `symbol()` and `decimals()` return the expected symbol and 18;
- onchain `uid()` equals the full registry UID; and
- onchain `uiMultiplier()` is callable and equals the registry's 18-decimal multiplier;
- `balanceOf(address)` returns a standard ABI-encoded `uint256`; and
- a pinned-block `eth_call` simulation of `transfer(probe, 0)` from the probe account succeeds and returns `true`;
- the five runtimes are the same EIP-1967 `BeaconProxy` shell, every beacon slot resolves to the same beacon, and each
  token's immutable `ACCESS_CONTROLLED_REGISTRY()` resolves to that beacon;
- beacon, implementation, and proxy runtime hashes are nonzero, `implementation()` resolves to the recorded
  implementation, and the implementation's immutable registry resolves back to the beacon;
- beacon `paused()` and every token's `paused()`, `tokenPaused()`, and `oraclePaused()` are false; and
- the beacon's complete control-event history from its archive-discovered creation block replays consistently through
  the pinned block. The generator reconstructs every known role and blocklist state from `RoleGranted`, `RoleRevoked`,
  `RoleAdminChanged`, `Blocked`, and `Unblocked`, checks the final state through `hasRole`, `getRoleAdmin`, and
  `isBlocked`, reconciles `Upgraded`, `Paused`, and `Unpaused`, and records a deterministic log digest and range.

`source.blockHash`, `source.blockNumber`, and `source.blockTimestamp` identify the pinned observation. Supply an exact
positive `--block-number`; omitting it is supported only for interactive collection and selects the RPC head. The
requested `--observed-at` must be the same instant as that block timestamp. Event-bearing block hashes and the pinned block are
re-read before output, and token/beacon/implementation code, relationships, and pause state are rechecked. An RPC
without archive code/state, an incomplete log stream, a reorg, or any inconsistent response fails the generation.
Each current role member is sorted by address and records either its pinned runtime hash or an explicit EOA marker.

## Generate an exact-block wrapped-BTC bridge candidate

Robinhood's published token table does not currently list a standalone wrapped-BTC address. Its bridge documentation
instead defines the canonical L2 address through the L2 gateway router's `calculateL2TokenAddress` function. Capture a
review candidate from a trusted archive RPC at an explicit block:

```bash
pnpm config:manifest:wrapped-btc -- \
  --rpc-url "$ROBINHOOD_MAINNET_ARCHIVE_RPC_URL" \
  --block-number "$ROBINHOOD_MAINNET_WBTC_OBSERVATION_BLOCK" \
  --output packages/config/deployments/robinhood-mainnet-wrapped-btc.YYYY-MM-DD.candidate.json
```

The resolver requires chain ID 4663, derives the L2 token from Ethereum WBTC through the official router, verifies the
selected gateway and token metadata/L1-L2 bindings, and resolves the token's EIP-1967 beacon and implementation. It
also resolves both bridge transparent-proxy implementations, their shared ProxyAdmin, the ProxyAdmin's upgradeable
role-based owner and implementation, and the expected admin/executor role identifiers. It records every observed
runtime hash and rereads the pinned block before output to reject a reorg.

The output is explicitly provisional and sets `deploymentApproved` to `false`. It does not reconstruct the bridge
executor's role-member or control-event history. Release approval still requires that complete authority review, a
nonzero transfer rehearsal, bridge/custodian and proxy-admin review, fresh independent reproduction, signature-policy
approval, and the legal/security gates. Testnet never inherits this mainnet candidate.

The zero-value simulation is an interface and transfer-policy tripwire, not proof that a funded account can transfer
under all issuer states. Testnet/fork rehearsals must additionally exercise nonzero observed balance deltas, freezes,
eligibility restrictions, and any issuer-specific transfer controls before a token can be release-approved.

Assets are sorted by code-unit order, object keys are canonicalized, a source-payload SHA-256 is recorded, and output
is written atomically. The result remains `generated-candidate`, has `deploymentApproved: false`, and explicitly
leaves wrapped-BTC approval, the still-unpublished testnet stock/v4 dependencies, and compliance unresolved. Official
testnet USDG, WETH, and Permit2 are separately recorded as provisional typed inputs; they do not clear the complete
testnet dependency or exact-block fork-evidence gates.

The web client may explicitly consume a signed remote `testnet-candidate` manifest whose bespoke v4 core/periphery
contracts have their own verified testnet evidence while still enforcing the official Permit2 input. That candidate is
UI testnet evidence only: it does not resolve the typed canonical v4 manifest, authorize canonical deployment, clear
the fork/rehearsal gates, or become reusable mainnet evidence.

`ASSET_MANIFEST_OUTPUT` intentionally points inside the ignored
`packages/config/deployments/generated/` directory. That workstation output is collection evidence, not reviewed
source, and must not be staged or used directly by deployment tooling. After humans reconcile the registry response,
onchain observations, and independent providers, copy the unchanged canonical JSON into this dated candidate path:

```text
packages/config/deployments/robinhood-mainnet-assets.YYYY-MM-DD.candidate.json
```

The filename date must equal the UTC date in `source.observedAt`. Commit that file as part of the reviewed source
commit, then prove the path, schema, canonical bytes, nonexecutability, and exact `HEAD` binding:

```bash
pnpm config:manifest:assets:reviewed:validate -- \
  --file packages/config/deployments/robinhood-mainnet-assets.2026-08-01.candidate.json \
  --source-commit "$(git rev-parse HEAD)"
```

The validator rejects ignored/generated paths, untracked or symlinked files, byte or mode drift from `HEAD`, a filename
date that differs from `source.observedAt`, noncanonical JSON, and any manifest that is not still an unapproved
`generated-candidate`. Passing this check records reviewed candidate evidence only; it does not set
`deploymentApproved`, clear any unresolved gate, or authorize a deployment.

### Late official-registry revalidation

Release automation performs a separate, read-only late fetch from exactly `https://api.robinhood.com/rhj/assets`. It
consumes the exact reviewed version-2 candidate, signed deployment-config bytes, and signed manifest bytes from evidence
commit E. It does not generate, replace, approve, or write a stock candidate. Redirects, a non-JSON content type, an
oversized/empty response, a duplicate or missing selected symbol, inactive status, or any address, UID, token name, or
multiplier drift fails closed.

Each fetch preserves the exact raw response as `robinhood-registry-response.json` and emits canonical
`robinhood-registry-revalidation.json`. The latter records the fetch time and exact 24-hour expiry, raw response digest,
selected-record digest, record count, archive filename/digest, exact candidate/config/manifest raw digests, candidate
block/hash/timestamp, signed release-observation block/hash, source/evidence commits, annotated tag object, release tag,
and signature-policy ID. `prepare-release.mjs`, the offline packager, and an independent Hardhat implementation all
recompute and check those relationships from the raw files.

The resolve-tag fetch is `stage: "preliminary"` with `authorizationEligible: false`; it can feed reproducibility and
fork gates but cannot authorize a release. Only a new `stage: "protected-final"` fetch performed after
`release-approval` may set `authorizationEligible: true`, and that final artifact and its exact raw response are retained
together. A missing, expired, future-dated, pre-E, substituted, or preliminary artifact fails the protected boundary.
The boolean is only a stage invariant; it does not itself attest GitHub reviewer approval. Operators must additionally
verify the checksummed artifact's provenance to the successful protected-environment job and its recorded repository,
workflow SHA, run ID, and attempt.

The official registry is an offchain source, so the late fetch does not invent a new onchain observation block. Its
`releaseLinkage.candidatePin` must exactly equal the reviewed candidate's block/hash/timestamp, while
`releaseLinkage.releaseObservation` separately identifies the signed release observation. The protected authorization
job independently validates the protected-final artifact and raw response, exports the signed observation fork context,
and only then runs the complete pinned mainnet fork suite, including nonzero `transfer` and `transferFrom` balance-delta
checks through every selected stock-token runtime.
Those checks use synthetically supplied fork balances: they exercise the exact production bytecode but do not prove that
an existing funded holder or its offchain eligibility was discovered. The revalidation and fork steps make no broadcast,
candidate mutation, or other persistent external-state change.

Any address/UID change requires human investigation and a reviewed source update. Do not add an “accept drift” flag.

## Collect and pin canonical bytecode hashes

Canonical USDG/WETH and every configured Uniswap v4 address require nonempty runtime bytecode and exact hash pins.
Because USDG is an EIP-1967 UUPS proxy, a release manifest additionally requires its implementation address/hash,
raw admin-slot evidence, upgrade-authority address/hash, and positive verification block. Pinning only proxy runtime
bytecode does not clear the canonical-token gate.
Collection is deliberately unapproved:

```bash
pnpm config:manifest:bytecode -- \
  --rpc-url "$ROBINHOOD_MAINNET_ARCHIVE_RPC_URL" \
  --block-number "$ROBINHOOD_MAINNET_BYTECODE_OBSERVATION_BLOCK" \
  --observed-at "$MANIFEST_OBSERVED_AT" \
  --collect-unpinned \
  --output "$BYTECODE_VERIFICATION_OUTPUT"
```

Review collected addresses and hashes against official sources and at least two independent RPC providers. Create a
reviewed expected-hash JSON matching `expectedBytecodeHashesSchema`; its keys must exactly equal all canonical target
keys. It records chain ID, observation block/time, a non-secret provider label, and the provisional hashes.

`packages/config/deployments/provisional-mainnet-bytecode-hashes.2026-08-01.json` records a public-RPC observation at
block 25,010,482. It is a dated drift baseline only, not evidence of independent-provider review or deployment
approval.

Then run the fail-closed comparison:

```bash
pnpm config:manifest:bytecode -- \
  --rpc-url "$ROBINHOOD_MAINNET_ARCHIVE_RPC_URL" \
  --block-number "$ROBINHOOD_MAINNET_BYTECODE_OBSERVATION_BLOCK" \
  --observed-at "$MANIFEST_OBSERVED_AT" \
  --expected-hashes "$EXPECTED_BYTECODE_HASHES_PATH" \
  --output "$BYTECODE_VERIFICATION_OUTPUT"
```

Verification mode rejects a missing pin, extra/missing target key, empty code, chain mismatch, timestamp mismatch,
block drift, or hash mismatch. The output binds the exact block, parent hash, and timestamp. A
complete exact match emits `matched-provisional-pins`, but retains `deploymentApproved: false`: matching a provisional
pin set is reproducibility evidence, never deployment authorization.

## Deployment manifest

`deploymentManifestSchema` is the canonical structural gate. A manifest records:

- protocol, schema version, release version, exact 40-character commit, and creation time;
- network identity and a non-secret archive-provider label;
- canonical external addresses, observed block, and runtime bytecode hashes;
- registered asset addresses, decimals, UIDs, status, code hashes, and acquisition/redemption flags;
- every deployed contract, transaction, block, verification URL, constructor parameter, and CREATE2 salt;
- deployer, timelock, guardian, and multisig ownership state, including the protocol-admin Safe proxy/singleton code
  hashes, owners, threshold, nonce, guard, modules, fallback handler, and exact observation block;
- the exact reviewed GBX contract-holder set, each holder's code record, and why that account receives GBX;
- explicit canonical-token, v4, wrapped-BTC, stock-token, testnet, compliance, audit, economic, legal, role, rehearsal,
  and incident-readiness gates; and
- payload hash and EIP-191/EIP-712 signatures.

Validate a candidate:

```bash
pnpm config:manifest:validate -- --file "$DEPLOYMENT_MANIFEST_PATH"
```

Use `--print-canonical` to normalize the complete artifact. Use `--print-signing-payload` to canonicalize the manifest
with an empty signature array; its SHA-256 is the required `payloadHash` for every attached signature. Pass `--output`
to avoid package-manager log text in redirected stdout.

The exact supported signing convention is EIP-191 over the raw 32 bytes represented by `payloadHash`:

1. Canonicalize the complete unsigned manifest as deterministic, two-space JSON with sorted object keys,
   `signatures: []`, and one trailing newline.
2. SHA-256 those UTF-8 bytes. Store the lowercase result as `payloadHash`.
3. Sign the raw 32-byte hash, not the printable 66-character `0x...` string and not the JSON document. With viem this
   is `account.signMessage({ message: { raw: payloadHash } })`.
4. Record the recovered EOA address as `signer`. The validation CLI performs EIP-191 recovery and rejects a mismatch,
   malformed signature, changed payload, EIP-712 entry, or unsupported algorithm.

`signaturePolicy` is part of the signed canonical payload. It carries a nonzero `policyId`, unique authorized EOA
signers, and a positive threshold for every signed mainnet candidate or release-approved manifest. Those fields are not
self-authenticating: validation requires exact equality with the configured policy at the fixed committed path
`packages/config/deployments/release-manifest-signature-policy.json` before recovering signatures.

The Git binding uses two commits to avoid asking a tracked manifest to contain the hash of its own commit. The
manifest's `release.gitCommit` names reviewed source/policy commit **C**. A verified annotated release tag peels to a
single-parent evidence commit **E**, whose parent is C and whose sole tree changes are adding the signed manifest plus
the exact deployment-config and deployment-state JSON snapshots declared by that manifest. All three must be regular
nonexecutable `100644` blobs, and the manifest binds each snapshot's raw-file SHA-256. The policy must already exist as
the same `100644` blob in C and E. The release workflow additionally requires C to equal the exact protected-main
workflow SHA that dispatched the run. The CLI
requires a clean E checkout, proves that topology and exact policy identity, and verifies every tracked worktree file's
raw bytes and mode against E before validating signatures. Release builds and their build ID remain source-bound to C;
metadata records both C and E.

Release automation invokes the CLI with `--require-release-evidence`. That mode also requires the exact E blob to
remain `release-approved`, so a dependency lifecycle mutation cannot downgrade it to an inactive draft and bypass the
trust-root/topology checks. It rejects future `createdAt`/`observedAt` values, expired observations, and observation
windows longer than 24 hours. Omit that flag only for non-authorizing draft or explicit local/testnet fixture
validation.

The committed policy is currently an explicit `state: "unconfigured"` sentinel with no signer addresses. This is a
release blocker, not a policy template: no signed mainnet candidate, release-approved manifest, production web runtime,
or release workflow can pass until reviewed organizational signers, threshold, and a nonzero policy ID replace it in
the release commit. Drafts and explicit testnet/local-rehearsal candidates may use only the inactive form: zero policy
ID, empty signer list, threshold zero, and no signatures. A threshold-zero mainnet candidate is never trusted.

A release-approved artifact also has an exact deployment graph, not an open-ended address list. The schema requires
the 21 fixed logical instances recorded by the deployment rehearsal plus one `AcquisitionStrategy:<ASSET>` and one
`ManagerRewards:<ASSET>` for each of WETH, wrapped BTC, QQQ, TSLA, SPCX, NVDA, and AAPL. `EligibilityModule` is the
logical manifest name for the reviewed implementation selected by deployment configuration. Extra, missing, or renamed
instances fail validation.

Every deployed-contract record links explicitly to:

- a logical instance `name` and actual compiled `contractName` (asset-scoped instances therefore identify
  `AcquisitionStrategy` or `ManagerRewards` without losing their unique asset identity);
- one unique `constructorParametersKey` whose strict record contains the ordered JSON `arguments` array and exact
  ABI-encoded `encodedArguments` bytes (`arguments: []` and `encodedArguments: "0x"` record a zero-argument
  constructor);
- one unique `transactionKey` whose transaction hash exactly matches the contract record; and
- a nullable `create2SaltKey`. `LaunchGuardHook` must be the sole record linked to the sole nonzero CREATE2 salt in
  schema v1; `GumBallPermissionedHook` is the sole linked record in permissioned schema v2.

The validator additionally binds the ProtocolTimelock and eligibility-module addresses to their role/compliance
records, checks the ProtocolTimelock, EmergencyGuardian, and GBX constructor role parameters, links every acquisition
strategy and rewards contract to its asset and peer strategy, requires the exact seven GBX custodians, and requires
canonical USDG/WETH asset evidence to equal the corresponding external-contract evidence. The config test suite builds
and cryptographically validates a complete positive signed release fixture, then re-signs one-field mutations to prove
that each graph/linkage rule fails closed.

The deployment config pins the stable protocol-admin Safe identity without a nonce or block. Each phase authorization
then signs a complete block-pinned observation of that identity plus the current nonce. Preflight replays the full
observation at the signed block and immediately at the current head; a changed proxy/singleton, owner ordering,
threshold, guard, module ordering, fallback handler, nonce, block hash, or timestamp fails closed. A schedule bundle
additionally binds its Safe address and nonce to that same signed evidence and records the evidence's canonical
SHA-256, preventing a detached Transaction Builder envelope.

Nonlocal Safes require at least two owners and threshold two, with no enabled modules and zero guard/fallback handler.
The fixed committed Safe control-plane policy must additionally approve the exact chain, singleton address/runtime
hash, and proxy runtime hash for both roles. Its committed unconfigured sentinel deliberately blocks authorization and
release until that trust root is independently reviewed. Both Safe evidence records use the same exact block number,
hash, and timestamp.

When a real policy is reviewed and committed, validation proves EOA authenticity, exact anchored-policy membership,
and threshold. The policy-review ceremony must still establish that those public addresses belong to the approved
people. Offline validation does not yet call EIP-1271, so Safe/contract-wallet signatures and onchain multisig policy
cannot be proven by this path; do not encode a Safe as an EOA signer. EIP-712 also remains fail-closed until an exact
typed-data domain and message schema are reviewed.

```bash
pnpm config:manifest:validate -- \
  --file "$DEPLOYMENT_MANIFEST_PATH" \
  --print-signing-payload \
  --output deployment-manifest.signing-payload.json
```

The fixture `packages/config/tests/fixtures/deployment-manifest.draft.json` demonstrates an intentionally blocked
draft. It is not a deployment template with valid role addresses.

## Pre-broadcast deployment authorization

The `release-approved` manifest cannot be reused as predeployment authorization. Its schema deliberately requires the
complete observed deployment graph, transaction hashes, positive block numbers, verified runtime code, closed deployer
privileges, and every release gate to have passed. Those facts do not exist before phase one. Treating a draft or an
invented future transaction record as approval would weaken both artifacts.

`deploymentAuthorizationSchema` is the distinct, short-lived authorization for exactly one irreversible Hardhat
phase. Its signed payload binds:

- a nonzero, single-use 32-byte `authorizationId`;
- exact clean `releaseGitCommit`, Robinhood chain ID/name, and `commandFamily: "hardhat"`;
- the exact phase broadcaster plus canonical nonce start and expected transaction count (maximum 512), forming a
  bounded EOA account-nonce window for broadcast phases;
- complete, distinct `protocolAdminSafe` and `emergencyGuardianSafe` evidence at the same exact block: proxy and
  singleton runtime hashes, singleton address, ordered owners, threshold, nonce, guard, enabled modules, fallback
  handler, and network envelope; every protected phase binds each record to its configured/onchain role and
  re-observes both identities before it may reserve its authorization;
- for `schedule`, a `safeSchedule` object that binds the contract proposer Safe address, Safe nonce, canonical
  control-plane-evidence SHA-256, and `safe-transaction-builder` format; the broadcaster must equal the Safe, nonce-window
  start must equal the Safe nonce, and transaction count must be exactly one Safe batch;
- exactly one of `deploy`, `schedule`, `execute`, `fund-genesis`, or `settle-genesis`;
- SHA-256 of deterministic canonical JSON for the complete deployment config;
- SHA-256 of deterministic canonical JSON for the exact prior state, or the phase-one absent-state sentinel
  `0xdceb7fac0f8670058c44b5639c125957c78070756b6cc2499f240b633150e342`;
- RFC-3339 issuance/expiry no more than 24 hours apart; and
- at least two distinct authorized EOAs, a threshold of at least two, canonical payload hash, and signatures.

The referenced deployment config is itself a strict, versioned artifact. It must have exactly the documented full
shape, including `kind: "gumball-6900-deployment-config"`, `protocol: "GUM BALL 6900"`, `schemaVersion: 1`, and one
exact `network` pair: Robinhood mainnet `4663`, Robinhood testnet `46630`, or local rehearsal `31337`. Unknown fields,
missing fields, a chain/name mismatch, or a provider chain different from the config all fail before signer creation.
The authorization preflight independently requires the config network to equal the signed authorization network.

The authorization's signer policy is not self-authenticating. Preflight requires it to equal the fixed
`packages/config/deployments/deployment-authorization-policy.json` in the captured authorized commit. The repository
ships only an intentionally invalid `.example.json`; real organizational signer addresses, threshold, and a nonzero
policy ID must be reviewed and committed before any live preflight can pass. Changing that policy requires a new clean
commit and new phase authorizations.

Git discovery is bound to the real repository directory derived from the reviewed script's own module path, not the
operator's current directory. Every Git child strips inherited `GIT_*` variables before adding fixed no-replacement,
no-prompt, and isolated system/global-config settings; an ambient `GIT_DIR`, `GIT_WORK_TREE`, replacement ref, alternate
index, or object directory cannot redirect the proof to a decoy. Git's reported top level must resolve to that exact
script root. Preflight captures the authorized commit, rejects a later `HEAD` change immediately before reservation,
and walks every entry in that commit's tree. It rejects hidden index/fsmonitor flags, an index that differs from the
captured tree, symlink or submodule entries, symlinked ancestors, type or executable-bit differences, and malformed or
non-confined paths. For each regular file it computes the Git blob ID locally from the current raw bytes and compares
that ID with the literal tree object ID. Clean filters, line-ending normalization, stat-cache tricks, ignore rules,
assume-unchanged flags, and untracked lookalikes therefore cannot replace reviewed execution bytes. The fixed policy
must additionally be exactly one nonexecutable regular `100644 blob` at its canonical path in that same captured tree.

The expected predecessor state phases are `DEPLOYED_AND_WIRED` (or recorded recovery state `TIMELOCK_SCHEDULING`) for
`schedule`, `TIMELOCK_OPERATIONS_SCHEDULED` (or `TIMELOCK_EXECUTING`) for `execute`, `REGISTRY_CONFIGURED` for
`fund-genesis`, and `GENESIS_OPENED` for `settle-genesis`. Recovery requires a new authorization over the exact
partially updated state. A schedule recovery also requires new control-plane evidence for the then-current Safe state
and nonce, plus a new
bundle output. Other broadcast recovery authorizations bind only the remaining EOA nonce count. A new authorization ID
and signatures are required for every attempt. Phase one additionally requires that the selected state output not
exist.

Compute canonical hashes without changing the reviewed files:

```bash
pnpm config:authorization:hash-json -- --file /outside/worktree/reviewed-config.json
pnpm config:authorization:hash-json -- --file /outside/worktree/deployment-state.json
pnpm config:authorization:hash-json -- --file /outside/worktree/protocol-admin-safe-evidence.json
pnpm config:authorization:hash-json -- --file /outside/worktree/emergency-guardian-safe-evidence.json
```

The authorization uses the same EIP-191 convention as the release manifest: sign the raw 32 bytes of the SHA-256
canonical unsigned-payload hash. EIP-712 and EIP-1271/Safe signatures remain fail-closed until their exact schemas and
policy checks are reviewed. Print the unsigned signing payload, attach signatures, then validate recovery and quorum:

```bash
pnpm config:authorization:validate -- \
  --file /outside/worktree/phase-authorization.json \
  --print-signing-payload \
  --output /outside/worktree/phase-authorization.signing-payload.json

pnpm config:authorization:validate -- --file /outside/worktree/phase-authorization.json
```

The signing/validation CLI itself requires a clean worktree whose `HEAD` exactly equals the candidate's
`releaseGitCommit`, and loads the trusted policy only through the tracked regular-HEAD-blob check. It will not print
signing material for a candidate that names another checkout.

Authorization, config, state, control-plane-evidence, and replay-ledger paths must be absolute and outside the Git worktree. The
worktree must be completely clean. The repository's authorized wrapper is now keyless and Safe-schedule-only. A
dependency-free Node bootstrap rejects every repository-recognized signer-secret variable and Node preload control
before it starts `tsx` or Hardhat, then passes an allowlisted environment to the child. The wrapper and raw Hardhat
entrypoint both reject `deploy`, `execute`, `fund-genesis`, and `settle-genesis` on every nonlocal chain. They contain no
reachable EOA wallet construction for those phases. The authorization schema, nonce window, snapshots, and preflight
logic remain the review contract for a future external runner, but they are not permission to broadcast with this
repository.

The production `schedule` phase is different: `broadcaster` is the contract proposer Safe, not an EOA. It loads no Safe
private key and sends no transaction. Preflight compares the latest Safe `nonce()` with the signed nonce, replays the
same call at the reviewed evidence block, validates that block's hash/number/timestamp, and snapshots the canonical
evidence beside config/state. Any nonce advance, block mismatch, evidence substitution, proposer mismatch, missing Safe
code, or invalid owner threshold fails before proposal generation.

Use the reviewed wrapper only to generate a nonlocal unsigned Safe schedule proposal. It derives the Hardhat network
and phase from the validated artifact and constructs a fixed command rather than accepting arbitrary child arguments.
Any other phase fails before Hardhat starts and does not consume the authorization ledger:

```bash
pnpm contracts:deploy:authorized -- \
  --authorization /outside/worktree/phase-authorization.json \
  --config /outside/worktree/reviewed-config.json \
  --state /outside/worktree/deployment-state.json \
  --ledger /outside/worktree/protected-shared-ledger
```

For an explicitly authorized testnet Safe schedule, use the narrower command with the same four base inputs:

```bash
pnpm contracts:deploy:testnet -- \
  --authorization /outside/worktree/testnet-phase-authorization.json \
  --config /outside/worktree/reviewed-testnet-config.json \
  --state /outside/worktree/testnet-deployment-state.json \
  --ledger /outside/worktree/protected-shared-ledger
```

That alias pins chain ID `46630` in addition to the normal cryptographic checks. It rejects a mainnet authorization, a
mainnet config, any authorization/config network mismatch, or any non-schedule phase before invoking Hardhat. It does
not weaken the clean worktree, policy, Safe control-plane, expiry, state-hash, or external-path requirements, and it never runs
from CI.

### Safe schedule proposal ceremony

Capture reviewed observations for both control planes without loading any key. Each role-specific command is pinned
to the selected Hardhat network, reads its role from the exact deployment state, and records at one identified block
the Safe proxy/singleton runtime hashes, singleton address, ordered owners, threshold, `nonce()`, guard, enabled
modules, fallback handler, and exact block number/hash/timestamp. Use the same block for both records. Each output
directory must already exist outside the worktree and each output file must not exist:

```bash
SAFE_CONTROL_PLANE_BLOCK_NUMBER=123456 \
DEPLOYMENT_STATE_PATH=/outside/worktree/testnet-deployment-state.json \
SAFE_CONTROL_PLANE_EVIDENCE_OUTPUT=/outside/worktree/testnet-protocol-admin-safe.json \
pnpm contracts:protocol-admin-safe:evidence:testnet

SAFE_CONTROL_PLANE_BLOCK_NUMBER=123456 \
DEPLOYMENT_STATE_PATH=/outside/worktree/testnet-deployment-state.json \
SAFE_CONTROL_PLANE_EVIDENCE_OUTPUT=/outside/worktree/testnet-emergency-guardian-safe.json \
pnpm contracts:emergency-guardian-safe:evidence:testnet

pnpm config:authorization:hash-json -- \
  --file /outside/worktree/testnet-protocol-admin-safe.json
pnpm config:authorization:hash-json -- \
  --file /outside/worktree/testnet-emergency-guardian-safe.json
```

Review both complete records and include both in the signed authorization. Place the protocol-admin record's canonical
SHA-256, Safe address, and Safe nonce in `safeSchedule`. Set the authorization broadcaster to that same Safe, the
nonce-window start to the same nonce, and transaction count to one. Then generate a deterministic, unsigned proposal
file:

```bash
pnpm contracts:deploy:testnet -- \
  --authorization /outside/worktree/testnet-schedule-authorization.json \
  --config /outside/worktree/reviewed-testnet-config.json \
  --state /outside/worktree/testnet-deployment-state.json \
  --ledger /outside/worktree/protected-shared-ledger \
  --protocol-admin-safe-evidence /outside/worktree/testnet-protocol-admin-safe.json \
  --emergency-guardian-safe-evidence /outside/worktree/testnet-emergency-guardian-safe.json \
  --safe-bundle /outside/worktree/testnet-initial-schedules.safe.json
```

The output follows Safe Transaction Builder batch version `1.0` and includes its compatible checksum. Each included
transaction has the ProtocolTimelock as `to`, value `"0"`, operation `0` (`CALL`), and exact encoded
`schedule(target,data,salt)` calldata plus decoded method inputs. The namespaced GUM BALL metadata binds:

- chain ID, Safe address and reviewed Safe nonce;
- signed authorization ID and payload SHA-256;
- canonical deployment-config, predecessor-state, and complete Safe control-plane-evidence SHA-256 values;
- the protocol config Keccak-256 already recorded by phase one;
- each timelock operation ID, underlying target/data/salt, calldata hash, call hash, and required delay; and
- pending/reconciled operation sets and an overall bundle Keccak-256.

The custom bundle hash is an audit binding, not the final Safe transaction hash. Safe may wrap a multi-call batch in
MultiSend, and Transaction Builder does not enforce custom metadata or the recorded nonce. Owners must independently
compare the artifact, set or confirm the exact reviewed Safe nonce in the proposal UI, obtain the required Safe
signatures, and submit through their separately reviewed ceremony. This repository command never signs, proposes,
submits, or broadcasts the bundle.

The schedule generator reconciles every operation against `operationReadyAt` and the registry effect. It omits calls
that are already queued or already applied and refuses inconsistent prior records. After owners execute the Safe batch,
capture fresh control-plane evidence and run `schedule` again using a newly signed authorization over the current state and a
new output path. When no call remains, the emitted artifact is marked `fully-reconciled`, contains an empty transaction
array, and the deployment state advances to `TIMELOCK_OPERATIONS_SCHEDULED`; do not submit that empty artifact.

After the recorded delay matures, ProtocolTimelock execution remains permissionless. A future external execution
ceremony may use an authorized gas payer, but this repository does not accept `TIMELOCK_EXECUTOR_KEY` and does not
broadcast the nonlocal `execute` phase.

The raw Hardhat entrypoint independently rejects every nonlocal EOA phase, so invoking it directly does not recover the
old in-process key path. Authorization schema v1 does not permit Foundry broadcast: each Foundry phase entrypoint fails
on any nonlocal chain before reading its local rehearsal key. Foundry remains available only as explicit chain-31337
rehearsal with `DEPLOYMENT_EXECUTION_MODE=rehearsal` and no `--broadcast`.

### Reproducible local signer-isolation rehearsal

The repository includes a proof of the intended handoff, restricted to an already-running chain-31337 Hardhat or Anvil
RPC. Its dependency-free bootstrap refuses signer secrets and Node preload controls, and the preparation child uses an
unlocked local account only to simulate the selected real phase inside `evm_snapshot`. It records every resulting
creation/call `to`, `value`, calldata, chain ID, broadcaster, and sequential nonce, then reverts the snapshot. Preparation
never receives a key file.

All three output files must be new paths in an operator-owned, non-group/world-writable directory outside the worktree.
For `deploy`, `--state` must name an absent path. For every later phase, it must name the exact predecessor state:

```bash
mkdir -m 700 /outside/worktree/local-preparation
LOCAL_REHEARSAL_RPC_URL=http://127.0.0.1:8545 \
pnpm contracts:prepare:local -- \
  --phase execute \
  --config /outside/worktree/local-config.json \
  --state /outside/worktree/local-prior-state.json \
  --artifact /outside/worktree/local-preparation/execute.prepared.json \
  --runner /outside/worktree/local-preparation/execute.runner.mjs \
  --verifier /outside/worktree/local-preparation/execute.verifier.mjs
```

The artifact is explicitly `local-rehearsal-only` and its authorization is explicitly unsigned. It binds the canonical
SHA-256 of config and predecessor state (or the phase-one absent-state sentinel), anchor block, broadcaster, exact nonce
window, expiry, complete ordered phase call plan, pnpm lockfile, runner entrypoint, exact standalone esbuild bundle bytes,
and the dependency-free verifier bytes. Both generated executables are tested for byte-for-byte reproducibility. This is
engineering evidence, not production approval.

Execute only against the unchanged local anchor. The runner refuses every chain except `31337`, atomically consumes the
preparation hash in an existing protected ledger, rechecks every binding before obtaining signer capability, and
rechecks expiry plus pending nonce before each send:

```bash
mkdir -m 700 /outside/worktree/local-execution-ledger
env -i HOME="$HOME" PATH="$PATH" LANG="${LANG:-C}" \
node /outside/worktree/local-preparation/execute.verifier.mjs \
  --verifier /outside/worktree/local-preparation/execute.verifier.mjs \
  --runner /outside/worktree/local-preparation/execute.runner.mjs \
  --artifact /outside/worktree/local-preparation/execute.prepared.json \
  --config /outside/worktree/local-config.json \
  --state /outside/worktree/local-prior-state.json \
  --ledger /outside/worktree/local-execution-ledger \
  --evidence /outside/worktree/execute.evidence.json \
  --rpc-url http://127.0.0.1:8545
```

Before invoking it, independently compare both generated-file SHA-256 values and byte lengths with the preparation
artifact. The `env -i` boundary is required for the optional key-file ceremony: it prevents Node preload controls or
ambient signer variables from entering the verifier process at startup. The verifier and runner independently reject
those variables as defense in depth.

By default, the verified runner uses the exact unlocked local broadcaster. For a local key-file boundary rehearsal
only, add `--key-file /absolute/path/to/local-test-key` to the verifier command, using an owner-only regular file. The
verifier measures itself, the runner, artifact, config/state, chain, anchor, and nonce before it opens that file. It
passes only an inherited file descriptor—not the key or its path—to the measured runner. The runner independently
rechecks the inputs and atomic replay reservation before reading that descriptor. To close a runner-path replacement
window, the verifier streams the already measured bundle bytes to Node over stdin instead of asking Node to reopen the
runner path. Neither process accepts key contents in an argument or environment variable. No real or production key
should be used. Receipt evidence binds every successful transaction hash/block and calldata hash back to the
preparation, authorization, plan, and runner hashes.

This local proof deliberately does not claim to solve production custody, hardware-wallet interaction, remote signing,
fee policy, protected-ledger distribution, or attestation. Production EOA execution remains fail-closed until an
independently reviewed isolated runner or signing service implements those controls and consumes an authorization that
also binds its exact executable transaction plan.

For schedule, the reviewed Safe nonce prevents generation after the Safe has advanced, while the single-use
authorization ledger prevents repeating the same generation approval; generation itself does not reserve or consume
that Safe nonce. The ledger must be protected, persistent, and shared across operator hosts; its per-ID directory
creation is atomic, and an ID is consumed even if subsequent work fails. Deleting or rolling back that storage is
prohibited. A future production EOA ceremony must add a separately reviewed cross-host nonce/replacement and
distributed-replay policy. A status environment flag, unsigned receipt, local-only ledger copy, manual hash comparison,
or successful schema parse is never authorization.

## Post-deployment verification commands

The verifier must run through Hardhat on the exact target network; it refuses the default local network and rechecks
the connected chain ID before reading config or state. Read-only graph verification is the default:

```bash
DEPLOYMENT_CONFIG_PATH=/outside/worktree/reviewed-testnet-config.json \
DEPLOYMENT_STATE_PATH=/outside/worktree/testnet-deployment-state.json \
pnpm contracts:verify:testnet

DEPLOYMENT_CONFIG_PATH=/outside/worktree/reviewed-mainnet-config.json \
DEPLOYMENT_STATE_PATH=/outside/worktree/mainnet-deployment-state.json \
pnpm contracts:verify:mainnet
```

A mainnet release verification also requires the prepared reviewed-candidate path and both late-registry files through
`RELEASE_ASSET_CANDIDATE_PATH`, `RELEASE_ROBINHOOD_REGISTRY_REVALIDATION_PATH`, and
`RELEASE_ROBINHOOD_REGISTRY_RESPONSE_PATH`. Bind the verifier to the exact ceremony with
`RELEASE_REGISTRY_REVALIDATION_STAGE`, `RELEASE_EVIDENCE_COMMIT`, canonical UTC
`RELEASE_EVIDENCE_COMMITTED_AT`, `RELEASE_SOURCE_COMMIT`, `RELEASE_TAG_OBJECT`, and the original repository-relative
`RELEASE_MANIFEST_REPOSITORY_PATH`. Technical fork gates accept only `preliminary`; protected authorization requires
`protected-final`. The release workflow sets these from its verified tag and prepared files rather than mutable
repository variables.

Permissioned schema v2 additionally receives the three prepared evidence files through
`RELEASE_PERMISSIONED_POOL_GRAPH_PATH`, `RELEASE_PERMISSIONED_POOL_OFFICIAL_SOURCE_BUILD_PATH`, and
`RELEASE_PERMISSIONED_POOL_FORK_REHEARSAL_PATH`. Each must be the repository-confined regular blob and raw SHA-256
declared by the signed manifest; the verifier does not accept a synthesized or path-only substitute.

Explorer submission additionally requires `SUBMIT_EXPLORER_VERIFICATION=true` and the matching
`ROBINHOOD_TESTNET_BLOCKSCOUT_API_KEY` or `ROBINHOOD_BLOCKSCOUT_API_KEY`. Submission is an explicitly authorized
external action; these commands are not run by ordinary CI, and a successful request still requires independent
Blockscout confirmation.

## Release-candidate evidence

The protected manual workflow in `.github/workflows/release.yml` is documented in [RELEASE.md](RELEASE.md). It accepts
only a GitHub-verified annotated SemVer tag and a repository-confined manifest tracked by that tag. The run must itself
be dispatched from that exact tag, with GitHub reporting both the event commit and workflow-definition commit as
evidence commit `E`. For schema v1 it proves that `E` adds only three evidence blobs to its sole parent/source commit
`C`: the signed `release-approved` manifest and its deployment-config and deployment-state snapshots. Permissioned
schema v2 permits exactly three additional manifest-declared JSON blobs: the graph, official-source build, and
Robinhood fork rehearsal. The manifest must name `C`, and each checkout must match the commit intended for its gate
before the workflow reruns the available offline, fork, static, documentation, browser, and reproducibility gates.

The resolve-tag job also archives an exact late official-registry response and a canonical preliminary revalidation
artifact. Build and fork jobs download those same bytes, and preparation rejects them unless their release linkage,
candidate pin, selected identities, raw response digest, and 24-hour window revalidate. The preliminary stage is
explicitly nonauthorizing. The mainnet fork gate prepares schema v1's three or schema v2's six exact E evidence blobs
plus those two untracked read-only evidence files, validates signatures and freshness while checked out at E, then
compiles source C. At the
signed observation block/hash it independently re-hashes both snapshots, requires
the state to be `GENESIS_SETTLED`, matches config/assets/externals/roles and every logical address to state, checks each
nonexternal creation receipt/input against the source-C Hardhat artifact and signed constructor encoding (including the
canonical CREATE2 hook), binds the recorded `genesis:settle` receipt and calldata to the finalized community amount and
official-SDK-derived square-root-price witness, verifies every protocol-admin Safe control surface at that exact block,
and runs the complete set-once, registry, eligibility, and backed-genesis graph verifier.

Protected-environment approval cannot indefinitely preserve that earlier result. After approval, the authorization job
performs a new protected-final official-registry fetch, archives its exact raw response, re-proves exact E/C topology,
manifest signatures, snapshot hashes, registry identity/linkage, and both 24-hour expiries, then queries mainnet
again immediately before reporting authorization. Both that query and the full graph verifier read the signed header,
the current head, and the signed header again. The header timestamp may be at most 15 minutes before `observedAt`; the
signed block must have at least 64 newer blocks; and the current head must be within 5 minutes of the verifier clock and
no more than 60 seconds in the future. This fail-closed policy detects stale RPCs and obvious reorg/finality hazards; it
does not assert that a fixed block count proves Robinhood Chain finality. The verifier also observes the complete Safe
control plane at that current head and rejects any identity or nonce drift from the signed release evidence.

The workflow produces checksummed candidate archives for source, contracts, ABI, SDK, subgraph, web, Storybook, and
contract docs, plus a distinct protected bundle containing the final registry artifact and exact raw response. It does
not call `forge script --broadcast`, explorer submission, a package registry, a subgraph deploy
endpoint, or a web host. Publication and verification remain separately authorized protected stages. Missing archive
RPC secrets are hard failures rather than skipped fork evidence, and unresolved `LICENSE`, `NOTICE`, or private security
contacts prevent candidate authorization.

## Testnet rehearsal sequence

1. Revalidate the provisional testnet USDG, WETH, and Permit2 records; resolve wrapped BTC, any selected stock tokens,
   and every remaining v4 contract; record all code hashes in a testnet-specific reviewed manifest.
2. Deploy directly from the reviewed commit using the exact pinned Solidity/optimizer/EVM settings.
3. Finalize all set-once peer wiring before accepting contributions.
4. Assert token minter, bootstrap/mining callers, vault/voter, strategy/reward peers, eligibility module, guardian, and
   timelock against the manifest. Verify the typed GumBallRouter's three immutable peers, LiquidityManager's immutable
   stateless GenesisLiquidityCalculator, and the complete unique GBX contract-holder list against live code and
   `canHold`.
5. Rehearse sponsor exact/over/one-unit-under funding, community cap/minimum, refund state, and every atomic launch
   failure point.
6. Execute a complete genesis with 80 million GBX in claims and a fully backed 20 million GBX liquidity allocation.
   Verify maximal v4 principal plus the constrained integer-liquidity residual equals 20 million exactly, sponsor
   backing is rounded per ADR-0002, LiquidityManager reports the fixed 16-position cap and exactly four active genesis
   positions, and the initial price, allocation notification, and sponsor excess refund match. Derive the settlement
   witness only after contributions close, using the finalized raw `communityUSDG`, the sorted GBX/USDG addresses, and
   the pinned official Uniswap SDK `encodeSqrtRatioX96`; the contract independently proves the exact floor and v4
   bounds. The Hardhat settlement phase performs this derivation. The local-only Foundry phase requires that same
   reviewed value as `GENESIS_SQRT_PRICE_X96`; a wrong value reverts without consuming settlement state.
7. Rehearse mining, settlement, claim, stake, delayed signal, immediate unstake, acquisition, manager reward, buyback,
   redemption, fee collection, completed-range sweep, and constrained migration.
8. Verify source on the testnet explorer and attach transaction, event, role-scan, state snapshot, and test evidence.
9. Complete incident-response exercises, including a token transfer pause and compromised guardian.

The mainnet gate cannot pass merely because testnet dependencies are unavailable; they must be resolved and the
rehearsal completed.

## Mainnet deployment ceremony

1. Freeze the reviewed commit and dependency lockfile. Reproduce build hashes independently.
2. Re-run live registry generation and bytecode verification at an explicit block and observation time.
3. Freshly regenerate wrapped BTC from official bridge/token sources and repeat interface, bridge, transfer,
   custodian/proxy-admin, and code-hash review before marking the signed-manifest gate passed.
4. Attach final security audit, economic review, legal decision, compliance architecture, and incident rehearsal.
5. Review every constructor input, lot/rate bound, cap, salt, deterministic address, PoolKey, hook permission bit,
   token ordering, price conversion, tick, range, and role.
6. Deploy the non-upgradeable contracts without opening contributions.
7. Independently scan deployed code hashes, peer wiring, roles, pause bounds, and forbidden authority.
8. Transfer guardian and timelock control to published multisigs; renounce or prove irrelevant deployer privilege.
9. Verify all source on Blockscout.
10. Produce canonical JSON, hash it, collect the approved signer quorum, validate it, and publish it before bootstrap.
11. Open sponsor/community bootstrap only after the public manifest and monitoring are live.
12. After contributions close, independently reproduce the official-SDK square-root-price witness from the exact
    onchain community amount and sorted token addresses. Execute atomic genesis settlement only when that witness and
    all sponsor, compliance, pool, and operational checks are green.

No deployment step may add an arbitrary vault call, temporary sweep, upgrade proxy, unreviewed rescue, or redemptive
asset skip to make the ceremony easier.

## Abort and recovery

Before genesis settlement, abort by pausing new contributions only if permissionless refunds remain available. Never
withdraw community USDG administratively. A failed atomic settlement leaves launch state unchanged.

After genesis, core contracts cannot be upgraded. Recovery is bounded to disabling new acquisition, pausing new risk,
claim/refund continuation, constrained liquidity migration, or a separately reviewed voluntary successor deployment.
See [OPERATIONS.md](OPERATIONS.md) and [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md).
