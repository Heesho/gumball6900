# Repository execution guide

This file governs automated contributors working in this repository. The protocol is not audited, deployed, or
authorized for user funds. A green local build is engineering evidence, never a release or deployment claim.

## Protocol starting point

- Build the core contracts as a minimal adaptation of the pinned give.fun and Liquid Signal Governance contracts.
  Preserve their simple contract boundaries and behavior unless this file or a recorded ADR explicitly changes them.
- Use these protocol names consistently: `GBX`, `Fundraiser`, `LiquidityPosition`, `SignalGBX`, `ResonanceRouter`, `Resonance`,
  `StrategyFactory`, `Strategy`, `BribeFactory`, `BribeRouter`, `Bribe`, and `Fund`.
- `packages/contracts/src` is the single Solidity source tree shared by Foundry and Hardhat. Core contracts use direct,
  non-upgradeable deployments. `StrategyFactory` and `BribeFactory` are allowed only as Resonance-controlled factories;
  do not add generic public factories, arbitrary vault calls, NAV/price oracles, or a conventional DAO.

## Revenue, signaling, and acquisitions

- The normal revenue flow is:
  `Fundraiser -> ResonanceRouter -> Resonance -> Strategy`.
  All USDG revenue produced by contributions goes to `ResonanceRouter`; it must not be diverted directly to `Fund`.
- GBX creates exactly 20 million tokens for the genesis-liquidity recipient. Its remaining 980 million lifetime mint
  capacity is permanently assigned to `Fundraiser` through the one-time minter handover.
- Fundraiser uses the fixed daily sequential-floor schedule inherited from the previous implementation: an initial
  emission of `465152.749681042811702004 GBX`, daily decay `0.999525354337060160`, and a four-year/1,460-day
  half-life. Empty epochs forfeit that day's emission without carry. Permissionless bounded settlement must preserve
  sequential rounding; do not replace it with configurable halvings or restore separate mining/controller contracts.
- `SignalGBX` represents staked GBX. There is no staking withdrawal lock, signal cooldown, epoch restriction, or
  once-per-period allocation rule. A signaler may replace or reset allocations at any time and may withdraw after reset.
- `Resonance` distributes received USDG among active Strategies according to current SignalGBX allocations. Strategy and
  Bribe deployment follows the Liquid Signal shape: Resonance uses `StrategyFactory` and `BribeFactory`, and each Strategy
  has a corresponding `BribeRouter` and `Bribe`.
- A normal acquisition is a bounded reverse Dutch Strategy. Acquisition proceeds flow 90% to `Fund` and 10% through
  `BribeRouter` to the Strategy's `Bribe`. The bribe share starts at 10% and may be changed through timelocked
  governance, but may never exceed 50%. When there are no eligible signalers, the bribe share returns to `Fund`.
- A buyback Strategy accepts GBX for USDG and burns the received GBX. Buybacks do not pay signal rewards: 100% of the
  received GBX is burned atomically.
- GBX lifetime minting is capped cumulatively at one billion tokens.

## Fund behavior

- `Fund` is a permissionless raw-token treasury, not a curated asset registry. Any ERC-20 sent to it may become GBX
  backing. Official protocol/index membership is represented by Strategies registered in Resonance, not by a Fund
  asset list.
- Anyone may burn GBX already held by `Fund` through the dedicated burn function. Protocol buybacks should burn their
  received GBX atomically rather than leave it accumulated.
- Redemption is unpausable and does not enumerate Fund assets. A redeemer supplies `gbxAmount`, a receiver, and a
  caller-selected array of unique non-GBX token addresses. For every selected token, transfer:

  `floor(Fund token balance * gbxAmount / GBX total supply before the burn)`

- Take the supply and balance snapshots before burning, and make the burn and every selected transfer atomic. A failed
  selected-token transfer reverts the entire redemption, including the burn.
- A redeemer may omit any token, including a broken or unwanted token. Claims for omitted tokens are permanently
  forfeited and remain for the post-redemption GBX supply. There is no asset-count cap beyond transaction gas and no
  general recovery function for unsolicited tokens.
- Reject GBX, the zero address, and duplicate addresses in redemption arrays. Duplicate detection should use
  EIP-1153 transient storage so arrays may be in any order without permanent registration, IDs, nonce mappings, or
  persistent writes. Clear transient marks before a successful call returns so multiple redemptions in one transaction
  remain independent. Keep redemption non-reentrant.

## Genesis liquidity

- The canonical market position is one precommitted, hookless GBX/USDG Uniswap v4 position held by
  `LiquidityPosition`. It begins outside the active price range with GBX only, using the 20 million genesis allocation.
- Fee collection is permissionless and removes zero principal. All GBX held after collection is burned and all USDG
  is routed through `ResonanceRouter`; no searcher-only compounding or fee diversion belongs in the starting point.
- The position NFT cannot be withdrawn to an arbitrary receiver. Timelocked governance may bind one compatible
  `LiquidityPosition` successor exactly once, after which anyone may migrate the exact NFT.

## Migration and administration

- Keep the initial system migratable through explicit contract-level powers rather than an arbitrary Fund withdrawal.
- `Fund` may bind one successor exactly once through timelocked governance. The successor must use the same GBX
  token. After activation, anyone may migrate complete balances of caller-selected non-GBX tokens to that successor in
  batches. Do not allow an arbitrary receiver or partial administrative withdrawal.
- GBX held by the old Fund is burned, never migrated. The old Fund's redemption remains available for omitted or broken
  tokens after a successor is set.
- Administrative work remains behind OpenZeppelin `TimelockController`, with the project multisig holding proposer and
  canceller roles. The timelock should own Resonance, Fund, and LiquidityPosition, use a documented minimum delay, have no
  external default admin after setup, and may grant the executor role to the zero address for permissionless execution.
- CI must never broadcast mainnet transactions.

## Source and generated artifacts

- Edit Solidity under `packages/contracts/src`, then run Forge and Hardhat against the same source. Do not hand-edit
  compiler output under `artifacts`, `cache`, `out`, or `typechain-types`.
- SDK ABI files are generated from Foundry artifacts with `pnpm sdk:abi:generate`; verify with
  `pnpm sdk:abi:check`. Synchronize subgraph ABIs with `pnpm --filter @gumball-6900/subgraph abi:sync` after every
  relevant event or ABI change.
- Economic JSON fixtures and SVGs are committed reproducibility evidence. Change the independent models first, then
  regenerate and run `pnpm simulations:fixtures:check`; never patch expected numbers to hide a model mismatch.
- Files under `packages/config/deployments` are dated candidates or evidence unless a signed manifest explicitly
  clears every gate. Never invent an unresolved canonical address, signer, code hash, legal approval, or review.
- Raw audit output belongs in `packages/contracts/audit/reports` and is ignored. Reviewed dispositions belong in
  `packages/contracts/audit/FINDINGS.md`.

## Required checks

Run narrow package checks while iterating, then the applicable repository gates before handoff:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm sdk:abi:check
pnpm subgraph:build
pnpm web:test:e2e
```

Contract changes additionally require `forge fmt --check`, `forge build --sizes`, the configured Foundry suite, and
Hardhat tests. Event changes require subgraph codegen/build/Matchstick tests. Economic changes require both Python and
TypeScript models. Fork results count only when the exact RPC capability and block pin are recorded; a skipped fork is
not a pass.

## Safety and release language

- Never commit or print secrets, credential-bearing URLs, private keys, signer material, or private legal artifacts.
- Never deploy, verify live contracts, sign a manifest, transfer roles, fund genesis, publish packages, or release a
  public site unless the user explicitly authorizes that external action and all documented prerequisites are met.
- Preserve provisional, unresolved, demo, preview, and stale-state labels. Do not use “live,” “launched,” “audited,”
  “verified,” or “release-ready” unless the exact signed manifest and external evidence support the statement.
- Preserve user work in a dirty tree. Do not overwrite deployment state or rerun a partially broadcast Foundry phase;
  reconcile receipts and onchain state first.
- Any implementation/prose mismatch blocks production until it is resolved, tested, and recorded in an ADR when the
  protocol or trust model changes.
