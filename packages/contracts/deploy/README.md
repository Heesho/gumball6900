# Deployment runbook

Deployment is deliberately split into irreversible phases. Every protocol contract is deployed directly; there is no
public factory, proxy, generic executor, or post-launch dependency initializer.

Copy `config.example.json`, replace every placeholder, and have a second operator review the chain ID, token decimals,
external runtime code, roles, eligibility mode, asset IDs, and launch parameters. The config has a fixed kind, protocol,
schema version, exact chain/name pair, and strict nested key sets; unknown or missing fields fail. Numeric token amounts
and reference rates are decimal strings so JSON tooling cannot round them.

Canonical USDG has 6 decimals, so every USDG amount in the execution config is a raw 1e6-scaled integer. Auction
reference rates are different: they are human-normalized target tokens per USDG scaled by 1e18 (for example, `1e18`
means 1 target token per USDG regardless of either token's decimals). Contracts derive both token decimal counts,
reject values above 18, round required taker payment up, and round observed clearing rates down.

This execution config does not replace either signed artifact. A deployment authorization is the short-lived,
pre-broadcast approval for one exact phase and input state. The canonical release manifest is post-deployment evidence:
it requires transaction hashes, blocks, verified runtime code, and privilege closure, so it cannot authorize phase one.
The runner records the observations from which that final release manifest is built.

Read-only/keyless environment variables:

```text
DEPLOYMENT_CONFIG_PATH=/absolute/path/to/reviewed-config.json
DEPLOYMENT_STATE_PATH=/absolute/path/to/deployment-state.json
DEPLOYMENT_AUTHORIZATION_PATH=/absolute/path/to/signed-phase-authorization.json
DEPLOYMENT_AUTHORIZATION_LEDGER_PATH=/absolute/path/to/protected-shared-ledger
```

Do not export deployment private keys before invoking repository tooling. The dependency-free keyless bootstrap rejects
the historical signer-variable names and Node preload controls. Nonlocal EOA phases are disabled; only unsigned Safe
schedule generation is supported in-repository.

The external USDG, PoolManager, PositionManager, Permit2, eligibility dependency, target tokens, and canonical CREATE2
deployer must already have runtime code. `NoopEligibilityModule` is rejected on Robinhood mainnet (chain ID 4663).
`unrestricted-test` mines `LaunchGuardHook` with exactly `beforeInitialize`. `permissioned` additionally requires and
hash-checks the official adapter factory, Permissioned Position Manager, Universal Router, V4Quoter, and
MixedRouteQuoterV2; it mines `GumBallPermissionedHook` with exactly `beforeInitialize`, `beforeAddLiquidity`,
`beforeSwap`, and `afterSwap`.

Phase one also deploys the typed GumBallRouter and records the exact GBX contract-holder list and rationale. Before
funding genesis, both runners require live code and `canHold` success for GenesisClaims, MiningClaims,
LiquidityManager, StakedGBX, BuybackBurnStrategy, and GumBallRouter. The unrestricted graph also checks PoolManager;
the permissioned graph checks the adapter that custodies underlying GBX while PoolManager holds its one-for-one
wrapper. PositionManager and Permit2 are operators rather than custodians and are not holder entries.

## Foundry

Authorization schema v1 does not permit Foundry broadcast. The Foundry scripts' split phase-two schedule file does not
provide one canonical predecessor state for every later phase, so pretending to bind it would leave a replay/state
gap. Every raw Foundry entrypoint now fails on a nonlocal chain before reading a key. It remains available only for an
explicit local simulation rehearsal on chain ID 31337; omit `--broadcast`:

```sh
DEPLOYMENT_EXECUTION_MODE=rehearsal \
  forge script script/foundry/DeployPhase1.s.sol:DeployPhase1 --rpc-url http://127.0.0.1:8545
```

Supporting live Foundry broadcast requires a reviewed unified state artifact and a new authorization schema version.

## Hardhat

The TypeScript deployment logic uses the same JSON config and maintains an atomic state manifest with constructor
arguments, transaction hashes, runtime code hashes, CREATE2 salt, and timelock operations. Do not invoke its raw command
for a nonlocal network. The reviewed wrapper currently accepts only a newly signed `schedule` authorization and emits
an unsigned Safe proposal:

```sh
pnpm contracts:deploy:authorized -- \
  --authorization /outside/worktree/phase-authorization.json \
  --config /outside/worktree/reviewed-config.json \
  --state /outside/worktree/deployment-state.json \
  --ledger /outside/worktree/protected-shared-ledger
```

Use `pnpm contracts:deploy:testnet -- ...` with the same arguments for testnet. That narrower alias requires the
authorization and config to target Robinhood testnet chain `46630`; it cannot be used with a mainnet artifact or a
non-schedule phase.

### Contract proposer / Safe schedule phase

On a nonlocal chain, `ProtocolTimelock.PROPOSER_MULTISIG()` and `EmergencyGuardian.operator()` must resolve to
distinct, reviewed Safe-compatible contracts. The production runner never loads a private key purporting to equal
either contract. First capture immutable, read-only observations for both roles from the exact state, network, and
block; each output directory must already exist and be outside the worktree:

```sh
SAFE_CONTROL_PLANE_BLOCK_NUMBER=123456 \
DEPLOYMENT_STATE_PATH=/outside/worktree/deployment-state.json \
SAFE_CONTROL_PLANE_EVIDENCE_OUTPUT=/outside/worktree/protocol-admin-safe-evidence.json \
pnpm contracts:protocol-admin-safe:evidence:testnet

SAFE_CONTROL_PLANE_BLOCK_NUMBER=123456 \
DEPLOYMENT_STATE_PATH=/outside/worktree/deployment-state.json \
SAFE_CONTROL_PLANE_EVIDENCE_OUTPUT=/outside/worktree/emergency-guardian-safe-evidence.json \
pnpm contracts:emergency-guardian-safe:evidence:testnet

pnpm config:authorization:hash-json -- \
  --file /outside/worktree/protocol-admin-safe-evidence.json
pnpm config:authorization:hash-json -- \
  --file /outside/worktree/emergency-guardian-safe-evidence.json
```

Review each evidence record's chain, exact block number/hash/timestamp, Safe proxy and singleton runtime hashes,
singleton address, ordered owners, threshold, nonce, guard, enabled modules, and fallback handler. The signed schedule
authorization contains both records; it sets `broadcaster` to the protocol-admin Safe and adds:

```json
{
  "safeSchedule": {
    "format": "safe-transaction-builder",
    "controlPlaneEvidenceHash": "0x...canonical-SHA-256...",
    "safeAddress": "0x...Safe...",
    "safeNonce": "..."
  }
}
```

Its nonce-window start must equal `safeNonce` and its transaction count must be exactly one, representing at most one
Safe batch. Generate the unsigned proposal artifact with a fresh, nonexistent output path:

```sh
pnpm contracts:deploy:testnet -- \
  --authorization /outside/worktree/schedule-authorization.json \
  --config /outside/worktree/reviewed-config.json \
  --state /outside/worktree/deployment-state.json \
  --ledger /outside/worktree/protected-shared-ledger \
  --protocol-admin-safe-evidence /outside/worktree/protocol-admin-safe-evidence.json \
  --emergency-guardian-safe-evidence /outside/worktree/emergency-guardian-safe-evidence.json \
  --safe-bundle /outside/worktree/initial-timelock-schedules.safe.json
```

Before consuming the one-use authorization, the runner re-reads the complete Safe control plane at the evidence block,
verifies that exact block's identity, and requires every current-head control surface and nonce to remain unchanged.
The deterministic JSON is importable by Safe
Transaction Builder. Each transaction is a zero-value `CALL` to ProtocolTimelock with exact `schedule(target,data,salt)`
calldata. GUM BALL metadata records the Safe nonce, operation IDs, calldata/call hashes, canonical authorization,
config, prior-state and control-plane-evidence hashes, plus an overall bundle hash. Safe's Transaction Builder checksum is also
populated.

EmergencyGuardian's constructor and delayed rotation reject code-less operators, but code presence is only a minimum
contract check. It does not prove Safe identity or policy. Before scheduling any future guardian rotation, capture and
review typed, block-pinned evidence for the candidate Safe and bind it to the intended guardian role and network.

Generation does not sign, propose, submit, or broadcast anything. Transaction Builder does not enforce the custom
review metadata, so Safe owners must independently compare every binding and explicitly set or confirm the recorded
Safe nonce before proposing. The GUM BALL bundle hash is an audit hash, not the final Safe transaction hash; Safe may
wrap multiple calls in MultiSend.

The generator queries every operation before emitting calls. Already queued or already-applied operations are recorded
and omitted. After Safe execution, run the schedule phase again with a new authorization, current state hash, newly
captured Safe control-plane evidence, and a new bundle output path. A fully reconciled run emits no transactions, marks the
artifact `fully-reconciled`, and advances state to `TIMELOCK_OPERATIONS_SCHEDULED`.

The dependency-free bootstrap runs before `tsx` or Hardhat, refuses inherited signer-secret variables and Node loader
controls, and supplies an allowlisted child environment. The schedule path then recovers the EIP-191 threshold against
the fixed authorized-commit policy, verifies expiry, exact Git commit/raw tracked-tree bytes, RPC chain, config, state,
Safe and block-pinned control-plane evidence, and atomically consumes the authorization ID. It executes from canonical ledger
snapshots. The wrapper and raw Hardhat entrypoint reject `deploy`, `execute`, `fund-genesis`, and `settle-genesis` on
nonlocal chains and construct no EOA wallet for them.

### Local execution-plan handoff

An exact runner handoff can be rehearsed only against an already-running chain-31337 Hardhat/Anvil RPC. Preparation
simulates the selected real deployment phase inside an EVM snapshot using an unlocked local account, records every
creation/call's address, value, calldata and nonce, creates a byte-reproducible standalone runner bundle, writes a
strictly local-only artifact, and reverts the snapshot:

```sh
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

The artifact binds exact verifier/runner bytes, lockfile and entrypoint hashes, config/state hashes, local unsigned
authorization, anchor block, broadcaster, expiry, nonce window, and complete ordered call plan. The dependency-free
verifier accepts either that unlocked local account or an owner-only `--key-file` containing a local test key. It opens
the file only after measuring itself, the runner, public inputs, local chain, anchor, and nonce; the runner receives only
an inherited descriptor and reads it after its own checks plus atomic replay reservation. The verifier streams the
already measured runner bytes over stdin, closing a path-replacement window before Node evaluates the bundle. It refuses
nonlocal chains and emits hash-bound receipt evidence. See `docs/DEPLOYMENT.md` for the execution command and threat
boundary. Never use a real key for this rehearsal. Independently compare both generated-file hashes with the artifact
and start the verifier through the documented `env -i` command so Node preload variables never enter its initial
process environment.

Production custody, fee policy, hardware/remote signing, and distributed replay storage require external reviewed
infrastructure. Until that exists, every nonlocal EOA phase remains fail-closed.

For the unsigned Safe proposal, the Safe nonce and protected authorization ledger remain the replay boundaries. The
local execution runner atomically reserves its preparation hash and refuses a second attempt. Neither mechanism is a
substitute for a reviewed distributed production ceremony.

Once the recorded delay matures, `execute` remains permissionless at ProtocolTimelock. This repository intentionally
provides no nonlocal gas-payer key path; a separately reviewed external ceremony is required.

Verify runtime bytecode, every set-once edge, router peers, migration selectors/delays/pause state, holder eligibility,
maximal genesis principal plus constrained residual conservation, and post-genesis zero ERC-20/Permit2 allowances
with:

```sh
DEPLOYMENT_CONFIG_PATH=/outside/worktree/reviewed-testnet-config.json \
DEPLOYMENT_STATE_PATH=/outside/worktree/testnet-deployment-state.json \
RELEASE_MANIFEST_PATH=/outside/worktree/signed-testnet-release-manifest.json \
pnpm contracts:verify:testnet

DEPLOYMENT_CONFIG_PATH=/outside/worktree/reviewed-mainnet-config.json \
DEPLOYMENT_STATE_PATH=/outside/worktree/mainnet-deployment-state.json \
RELEASE_MANIFEST_PATH=/outside/worktree/signed-mainnet-release-manifest.json \
pnpm contracts:verify:mainnet
```

When the mainnet config selects `permissioned`, schema v2 additionally requires the exact raw evidence files named by
the signed manifest:

```sh
RELEASE_PERMISSIONED_POOL_GRAPH_PATH=/outside/worktree/permissioned-pool-graph.json \
RELEASE_PERMISSIONED_POOL_OFFICIAL_SOURCE_BUILD_PATH=/outside/worktree/permissioned-pool-official-source-build.json \
RELEASE_PERMISSIONED_POOL_FORK_REHEARSAL_PATH=/outside/worktree/permissioned-pool-robinhood-fork-rehearsal.json \
pnpm contracts:verify:mainnet
```

The verifier checks each raw SHA-256 before parsing it, then cross-binds upstream source pins and reproduced runtime
hashes, every permissioned graph relationship, adapter backing, the canonical PoolKey, the four positions, and a
distinct successful post-genesis permissionless swap. Supplying paths or editing descriptor hashes cannot manufacture
authorization; the signed evidence bytes and all ordinary release gates must agree.

Mainnet release verification additionally requires the exact prepared reviewed candidate and the paired late official
registry artifact/raw response (`RELEASE_ASSET_CANDIDATE_PATH`, `RELEASE_ROBINHOOD_REGISTRY_REVALIDATION_PATH`, and
`RELEASE_ROBINHOOD_REGISTRY_RESPONSE_PATH`). Set `RELEASE_REGISTRY_REVALIDATION_STAGE` to `preliminary` only for the
technical fork gate and to `protected-final` at the protected authorization boundary. The verifier also requires the
verified `RELEASE_EVIDENCE_COMMIT`, canonical UTC `RELEASE_EVIDENCE_COMMITTED_AT`, `RELEASE_SOURCE_COMMIT`,
`RELEASE_TAG_OBJECT`, and original repository-relative `RELEASE_MANIFEST_REPOSITORY_PATH`. The release workflow derives
these values from the verified tag and prepared bytes; do not substitute mutable environment facts.

Both commands select the matching Hardhat network and reject another connected chain. Set
`SUBMIT_EXPLORER_VERIFICATION=true` only for a separately authorized external action; explorer submission uses the
recorded constructor arguments after all local code-hash and wiring checks pass. Hardhat pins the Robinhood mainnet and
testnet Blockscout API/browser URLs under `etherscan.customChains` and reads `ROBINHOOD_BLOCKSCOUT_API_KEY` or
`ROBINHOOD_TESTNET_BLOCKSCOUT_API_KEY`, respectively. Independently confirm every submitted verification.

Release authorization must confirm that declarative `verificationStatus` fields still agree with Blockscout. The
read-only `verifyBlockscoutDeploymentVerifications(manifest)` helper in
`script/hardhat/blockscout-verification.ts` implements that boundary without submitting source or a transaction. Call it
only after validating the signed manifest and before authorizing the release candidate. It derives each
`GET /api/v2/smart-contracts/{address_hash}` endpoint from the corresponding signed `verificationUrl`; no endpoint or
address override is accepted. The implementation follows Blockscout's
[v2 smart-contract response](https://docs.blockscout.com/api-reference/get-smart-contract) and requires full verification,
unchanged bytecode, the exact Solidity 0.8.26 commit, optimizer enabled with 10,000 runs, and Cancun EVM evidence. The
reported deployed bytecode must also hash to the runtime hash in the signed manifest.

The helper accepts only the canonical Robinhood mainnet or testnet Blockscout origin selected by the manifest chain ID,
requires the browser path to contain the same deployed address, and accepts only an empty fragment or `#code`. Requests
reject redirects, use a 15-second timeout per contract, require a JSON content type, and stream through a 16 MiB response
bound. Any missing or contradictory top-level or nested compiler setting fails closed. Unit tests inject a mocked fetch
function and perform no live explorer requests.

`pnpm test:hardhat` first builds with Foundry and then compares every deployable protocol source's init and runtime
bytecode against Hardhat artifacts before running integration tests. Both compiler configurations disable the metadata
CBOR trailer in addition to using Solidity 0.8.26, Cancun, optimizer runs 10,000, and no bytecode hash.
