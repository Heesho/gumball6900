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
  once-per-period allocation rule. Signals are absolute per-Strategy amounts changed by incremental deltas; a signaler
  may add or remove them at any time and may immediately withdraw any unallocated SignalGBX balance.
- `Resonance` distributes received USDG among active Strategies according to current SignalGBX allocations. Strategy and
  Bribe deployment follows the Liquid Signal shape: Resonance uses `StrategyFactory` and `BribeFactory`, and each Strategy
  has a corresponding `BribeRouter` and `Bribe`.
- Each Bribe may register at most eight append-only reward tokens. The cap is fixed in code and is not governable.
- Every Strategy is the same bounded reverse Dutch acquisition mechanism. Its complete payment, regardless of token,
  becomes a fixed `Fund` liability through the paired `BribeRouter`; auction proceeds never fund `Bribe` rewards.
  Bribes are funded independently by explicit reward notifications.
- A Strategy priced in GBX does not burn during settlement. After its fixed liability is paid into `Fund`, anyone may
  burn that GBX through `Fund.burnGBX`. Users should settle and burn pending Fund GBX before calculating a redemption.
- GBX lifetime minting is capped cumulatively at one billion tokens.

## Fund behavior

- `Fund` is a permissionless raw-token treasury, not a curated asset registry. Any ERC-20 sent to it may become GBX
  backing. Official protocol/index membership is represented by Strategies registered in Resonance, not by a Fund
  asset list.
- Anyone may burn GBX already held by `Fund` through the dedicated burn function. GBX may accumulate there until a
  permissionless caller burns it; burning before redemption removes Fund-held GBX from the payout denominator.
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
- The position auto-compounds and removes zero principal. `compound` is permissionless: it grows position liquidity
  by the fixed `COMPOUND_BPS` (0.20%) and pays the caller everything the position accrued. Uniswap v4 nets accrued
  fees against the increase, so the caller funds only the shortfall. Do not add a keeper role, an oracle, a swap, a
  fee split, or a governance parameter to this mechanism; the fixed threshold is the entire incentive.
- Position fees are the compounding incentive and are not protocol revenue. They do not burn GBX and do not reach
  `ResonanceRouter`. Fundraiser contributions are the only USDG revenue source for Resonance.
- The position NFT can never be withdrawn, to any receiver, by any caller. `LiquidityPosition` is ownerless and has no
  successor or migration path: once the precommitted NFT is accepted it stays there permanently.

## Immutability and administration

- The protocol targets maximum decentralization with minimal governance, per ADR 0016 and ADR 0017. Do not add an
  upgrade path, proxy, pause switch, rescue or sweep function, arbitrary-call executor, successor binding, migration
  routine, or any new owner role. When a design choice trades governance flexibility against immutability, choose
  immutability and record the accepted consequence.
- `Fund` and `LiquidityPosition` are ownerless. `Fund` assets move only when a GBX holder burns their own tokens
  through redemption; assets that redeemers omit stay in `Fund` for the remaining GBX supply indefinitely. GBX held by
  `Fund` is burnable by anyone through the dedicated burn function.
- `Resonance` holds the entire remaining administrative surface: `addStrategy`, `killStrategy`, and `addBribeReward`.
  Nothing else is owner-gated anywhere in the protocol.
- That administration remains behind OpenZeppelin `TimelockController`, with the project multisig holding proposer and
  canceller roles. The timelock should own Resonance, use a documented minimum delay, have no external default admin
  after setup, and may grant the executor role to the zero address for permissionless execution.
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
