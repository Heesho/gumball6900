# Audit Scope

Status: audit-ready scope definition. No independent audit is represented as complete.

## In-scope source

- Every Solidity contract, interface, library, Foundry script, Hardhat deployment/verification script, mock used to
  establish a security property, and dependency pin under `packages/contracts`.
- Supply, genesis, mining, claims, vault, staking/signals, allocation indices, auctions, manager rewards, buyback,
  revenue routing, eligibility, bounded access control, v4 hook, positions, fees, sweep, and migration.
- The ADR-0011 review candidate: permissioned hook identity semantics, adapter verification/recycling, successor
  LiquidityManager accounting, exact official wrapper graph, PoolKey currency substitution, and fail-closed release
  gating. Inclusion in scope does not represent production authorization.
- Signed-manifest/config validation, CREATE2 derivation, external bytecode checks, ABI synchronization, and role
  closure in `packages/config` and deployment tooling.
- SDK financial math/calldata, simulation reference models, subgraph financial mappings, and every web flow that can
  construct or submit a transaction.
- CI/static-analysis scripts, dependency overrides/exceptions, release evidence workflow, threat model, and incident
  controls insofar as they support a security claim.

## Required review questions

1. Can any path violate `totalSupply = cumulativeMinted - cumulativeBurned` or the lifetime mint cap?
2. Can genesis mint or seed liquidity without sufficient, atomically settled backing?
3. Can claims be replayed, redirected, underfunded, or administratively withdrawn?
4. Can redemption use a denominator other than pre-burn total supply, skip an asset, or be paused/swept?
5. Can virtual budgets exceed physical USDG, survive redemption incorrectly, or be consumed twice?
6. Can stake/signal timing capture rewards without mature weight or leave votes after immediate unstake?
7. Can a target token, taker, receiver, hook, or callback obtain USDG before accounted target delivery?
8. Can manager reward/index rounding create or lose a material liability?
9. Can buyback release USDG without first receiving and really burning GBX?
10. Can any privileged or deployment path execute arbitrary calls, choose a value recipient, replace a core peer, or
    transfer canonical NFTs to an EOA?
11. Are PoolKey orientation, hook bits, ticks, liquidity amounts, fee collection, completed sweep, and migration
    correct against the exact external Uniswap deployment?
12. Do SDK, Python, TypeScript, subgraph, and UI calculations match Solidity atomic rounding?
13. Can any unapproved wrapper spoof a permissioned trader, can adapter verification strand or create GBX, or can the
    successor graph be mistaken for a release-authorized deployment?

## Adversarial environment

Review includes reentrancy, ERC-777-style callbacks, fee-on-transfer/false/no-return/reverting ERC-20s, rebasing or
multiplier-changing assets, unexpected donations, stale IDs/deadlines, front/back-running, long empty periods, full
supply redemption, tiny remainder campaigns, guardian/timelock compromise, initialization races, chain reorgs, and
external token freezes.

## External dependencies

Audit the exact pinned OpenZeppelin, Uniswap v4 core/periphery, Permit2, Solidity compiler, Foundry, and Hardhat
integration assumptions. Production review must additionally inspect runtime bytecode/proxy state for every signed
external address on Robinhood Chain.

## Out of scope but release-blocking

- Legal, regulatory, tax, sanctions, privacy, issuer, and securities analysis.
- Economic guarantees, market-maker availability, token price, stablecoin value, or auction profitability.
- Robinhood Chain, issuer, bridge, wallet, RPC, explorer, browser-extension, and Uniswap implementation internals
  beyond the protocol's integration and pin verification.
- A production deployment, Blockscout verification, multisig ceremonies, and operational readiness rehearsal.

These are not dismissed risks. They remain separate blocking gates in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

## Evidence and finding policy

Publish the final commit, tool versions, full CodeQL/static reports, test seeds/corpora, normalized Foundry/Hardhat
coverage summaries and LCOV artifacts, gas/size artifacts, fork blocks, deployment manifest, and reviewer identities.
Findings are tracked in `packages/contracts/audit/FINDINGS.md`; no finding may be silently suppressed. A justification
states impact, exploitability, affected assumptions, reviewer, expiry/revisit trigger, and compensating test or control.

Generated review surfaces are committed as the [contract API reference](reference/contracts.md) and the
[TypeScript SDK API reference](reference/sdk/README.md). `pnpm docs:check` recompares both references with fresh,
isolated generation output; a green result is reproducibility evidence, not an independent review.
