# Isolated production execution ceremony

This repository contains an operator-invoked execution path for the `deploy`, `execute`, `fund-genesis`, and
`settle-genesis` phases. It is tooling only. It does not authorize a deployment, provide custody isolation, select a
production RPC, or make any release claim. The `schedule` phase is deliberately excluded: nonlocal scheduling remains
the keyless Safe Transaction Builder bundle flow.

No CI or release workflow invokes these commands. An operator must explicitly select an `operator:production:*`
script and provide every input outside the worktree.

## Two-pass keyless planning

Planning runs only through `robinhoodForkPlanner` or `robinhoodTestnetForkPlanner`. `PRODUCTION_FORK_RPC_URL` must be a
loopback HTTP(S) URL for a locally managed Anvil or Hardhat fork pinned at the exact block recorded by both signed Safe
evidence records. The block must still satisfy the verifier's recency window. The planner checks `web3_clientVersion`,
proves snapshot/revert support, proves account impersonation support, simulates
the whole phase from the signed broadcaster and nonce, records every ordered `chainId/from/to/value/data/nonce` call,
and reverts the snapshot. It rejects every signer-secret environment variable and never opens a key file.

First run the appropriate command without `PRODUCTION_EXECUTION_AUTHORIZATION_PATH`:

```bash
pnpm contracts:operator:production:plan:testnet
# or, only for a separately approved mainnet ceremony:
pnpm contracts:operator:production:plan:mainnet
```

The operator must provide:

- `DEPLOYMENT_EXECUTION_MODE=production-keyless-plan`
- `DEPLOYMENT_PHASE` (`deploy`, `execute`, `fund-genesis`, or `settle-genesis`)
- absolute paths in `DEPLOYMENT_AUTHORIZATION_PATH`, `DEPLOYMENT_CONFIG_PATH`, and `DEPLOYMENT_STATE_PATH` (the state
  path must be absent for `deploy`)
- `PRODUCTION_EXECUTION_ID`, `PRODUCTION_EXECUTION_ISSUED_AT`, and `PRODUCTION_EXECUTION_EXPIRES_AT`
- absent external output paths in `PRODUCTION_EXECUTION_CANDIDATE_PATH`, `PRODUCTION_EXECUTION_RUNNER_PATH`, and
  `PRODUCTION_EXECUTION_VERIFIER_PATH`

The resulting candidate is unsigned. Reviewers independently reproduce the bundles and plan, then threshold-sign the
candidate's canonical unsigned payload hash using EIP-191. Its 30-minute maximum lifetime must fit entirely inside the
already signed deployment authorization. The envelope binds the existing authorization ID and payload hash, clean git
commit, lockfile, runner/verifier source and bundle bytes, canonical config, predecessor state or absent-state
sentinel, target chain, phase, broadcaster, exact nonce window, ordered call-plan hash, exact fork block anchor, and
simulated successor-state template hash. It also binds the entire reverted simulation transcript (fork client,
anchor, and the ordered simulated receipt hash/block mapping), so that mapping cannot be changed independently of the
reviewer signatures.

The planner does not accept caller-selected trust roots. It reads the exact committed
`packages/config/deployments/deployment-authorization-policy.json` and
`packages/config/deployments/safe-control-plane-policy.json` bytes from the clean reviewed commit. Both committed
files are currently explicit `unconfigured` sentinels, so nonlocal production planning and release remain blocked
until separate organizational and Safe-runtime reviews replace them with configured policies. The deployment policy
requires at least two distinct authorized EOA signers and a threshold of at least two. The Safe policy allowlists the
exact network, singleton address/runtime hash, and proxy runtime hash; each Safe must also have at least two owners, a
threshold of at least two, no enabled modules, and zero guard and fallback handler.

Run the planner again with the signed envelope at `PRODUCTION_EXECUTION_AUTHORIZATION_PATH` and a new absent
`PRODUCTION_EXECUTION_ARTIFACT_PATH`. The second run must reproduce the unsigned payload byte-for-byte before it emits
the signed artifact. Any plan, block, code, lockfile, config, state, nonce, or dependency change requires a fresh
authorization; signatures are never copied to a changed candidate.

## Operator execution

There is intentionally no pnpm, tsx, Hardhat, or repository wrapper for key-bearing execution. Those dependency-rich
launchers observe process arguments and environment before the measured verifier can establish its boundary. Invoke
the exact generated verifier bundle directly with a pinned Node binary and an empty environment:

```bash
env -i PATH=/usr/bin:/bin HOME="$HOME" LANG=C \
  /absolute/path/to/pinned-node /absolute/path/to/measured-verifier.mjs \
  --verifier /absolute/path/to/measured-verifier.mjs \
  --runner /absolute/path/to/measured-runner.mjs \
  --verifier-source /reviewed/source/production-execution-verifier.ts \
  --runner-source /reviewed/source/production-execution-runner.ts \
  --lockfile /reviewed/source/pnpm-lock.yaml \
  --artifact /ceremony/execution-artifact.json \
  --deployment-authorization /ceremony/deployment-authorization.json \
  --execution-authorization /ceremony/execution-authorization.json \
  --trusted-policy /reviewed/source/packages/config/deployments/deployment-authorization-policy.json \
  --safe-control-policy /reviewed/source/packages/config/deployments/safe-control-plane-policy.json \
  --config /ceremony/deployment-config.json \
  --state /ceremony/predecessor-state.json \
  --output-state /ceremony/absent-successor-state.json \
  --evidence /ceremony/absent-execution-evidence.json \
  --ledger /protected/persistent-ledger \
  --key-file /protected/operator-key \
  --rpc-url http://127.0.0.1:9545
```

All file arguments are absolute. The key is a mode-0600 operator-owned regular file. The verifier requires a
credential-free HTTP(S) loopback RPC root URL (`localhost`, `127.0.0.1`, or `::1`) with no username, password, query,
fragment, or non-root path. Remote hosts, including API keys embedded in hostnames, are rejected. Many hosted provider
URLs carry credentials in their path; do not pass those directly because process arguments can be observed. Terminate
authentication at a separately protected local proxy and give the verifier a credential-free root endpoint such as
`http://127.0.0.1:9545`.

The measured verifier completes every public check before it opens the key file:

1. verifier/runner bytes, reviewed entrypoint source, exact lockfile, embedded source commit and both embedded fixed
   policy hashes, clean-commit binding, and artifact integrity;
2. cryptographic quorum and trusted-policy validation for both the existing deployment authorization and the separate
   execution-plan authorization;
3. canonical config and exact predecessor state (or the deploy absent-state sentinel), phase, plan, and successor-state
   template;
4. signed chain, canonical recent block anchor, authorization time windows, and current pending nonce;
5. both Safes re-observed at the same exact latest block, with identity and nonce unchanged from the signed anchor
   evidence; and
6. atomic single-use reservation of the deployment authorization in the protected ledger.

Only then does it atomically open the key without following symlinks, verify ownership/type/mode on the opened file
descriptor, and pass that descriptor to the measured runner. The runner rechecks public inputs, chain, anchor, and
nonce before its first key-material read. The signed transaction plan includes transaction type, gas limit, the full
legacy or EIP-1559 fee envelope, access list, chain, sender, recipient, value, calldata, and nonce; unsupported types are
rejected. Before each send the runner rechecks expiry and pending nonce and requires the RPC response to match that
entire envelope. After successful receipts it independently checks live phase state (all deployment code hashes,
the complete configured registry asset/strategy graph and liveness, exact sponsor escrow plus contribution state, or
the receipt-block-pinned genesis supply/backing/price/position/custody/approval invariants) before emitting receipt
evidence and successor state.

The verifier cannot prove its own provenance. Embedding the source commit and fixed policy hashes prevents a reviewed,
measured verifier from accepting caller-substituted trust roots; it does not make an arbitrary executable trustworthy.
The ceremony must independently obtain or reproduce the verifier from the clean reviewed commit, compare its measured
digest through a separate trusted channel, and invoke that exact binary with the pinned Node runtime.

The `GENESIS_SETTLED` successor remains provisional after the runner succeeds. The runner cannot derive the canonical
external Uniswap v4 StateView address from deployment config alone, and a one-confirmation receipt is not release
finality. After the required confirmation policy is satisfied, construct and threshold-sign the release-approved
manifest that binds the exact successor state, then run `pnpm contracts:verify:testnet` or
`pnpm contracts:verify:mainnet` at its signed observation block with explorer submission disabled. That full manifest
verifier must prove canonical v4 `slot0`, position ownership/liquidity, all runtime and external dependency evidence,
and every release gate. Do not accept the settled state as canonical, publish it, or use release-ready language until
that verifier passes.

Every post-reservation failure writes a permanent failure record when possible. The reservation is never removed, and
blind retry is forbidden. Reconcile the transaction hash and onchain receipt first; any further action requires a new
phase authorization and a new signed execution plan.
