# Repository execution guide

This file governs automated contributors working in this repository. The protocol is not audited, deployed, or
authorized for user funds. A green local build is engineering evidence, never a release or deployment claim.

## Protocol starting point

- Build the core contracts as a minimal adaptation of the pinned give.fun and Liquid Signal Governance contracts.
  Preserve their simple contract boundaries and behavior unless this file or a recorded ADR explicitly changes them.
- Use these protocol names consistently: `GBX`, `Mine`, `LiquidityPosition`, `SignalGBX`, `ResonanceRouter`, `Resonance`,
  `StrategyFactory`, `Strategy`, `BribeFactory`, `BribeRouter`, `Bribe`, and `Fund`.
- `packages/contracts/src` is the single Solidity source tree shared by Foundry and Hardhat. Core contracts use direct,
  non-upgradeable deployments. `StrategyFactory` and `BribeFactory` are allowed only as Resonance-controlled factories;
  do not add generic public factories, arbitrary vault calls, NAV/price oracles, or a conventional DAO.

## Revenue, signaling, and acquisitions

- Mining revenue follows `Mine -> ResonanceRouter -> Resonance seven-day stream -> Strategy`. On a nonempty-slot replacement, 80% of
  the USDG payment becomes a pull claim for the displaced miner and 20% routes to Resonance. The first occupation of
  an empty slot routes 100% to Resonance. There is no team fee.
- GBX creates only 20 million tokens for the genesis-liquidity recipient. Deployment permanently hands its sole mint
  authority to one deployed `Mine`; the handover is one-time and cannot be replaced or reopened. There is no
  protocol-defined economic supply cap, and supply reconciles as `totalSupply == lifetimeMinted - lifetimeBurned`.
- Mine starts with one slot. Timelock governance may only increase capacity, never decrease it, up to the hard cap of 16. Each slot uses an hourly reverse Dutch replacement auction and may change hands at any time.
- A slot's assigned GBX-per-second rate is locked for that miner's complete tenure. Checkpoints, redemptions, capacity
  increases, and cumulative-mining threshold crossings must not reprice or dilute an occupied slot. Only a newly occupied or
  replaced slot receives `current global rate / current capacity`. Accept that capacity expansion can temporarily
  increase aggregate issuance while legacy-rate miners remain.
- Global rates use constructor-immutable cumulative-mining halvings and a strictly positive tail rate. Do not add a
  rate setter, emissions controller, migration authority, oracle, entropy source, team fee, or claim redirection.
- `SignalGBX` represents staked GBX. There is no staking withdrawal lock, signal cooldown, epoch restriction, or
  once-per-period allocation rule. Signals are absolute per-Strategy amounts changed by incremental deltas; a signaler
  may add or remove them at any time and may immediately withdraw any unallocated SignalGBX balance.
- `Resonance` holds received USDG in one global seven-day stream and allocates each elapsed interval among active
  Strategies according to the SignalGBX weights active during that interval. Every signal change checkpoints elapsed
  revenue before changing weights, and every Strategy purchase checkpoints and pulls that Strategy's released USDG.
  ResonanceRouter holds USDG until its complete balance is at least 604,800 raw units and strictly exceeds the whole
  USDG left in the active stream. A qualifying notification combines with the remaining stream and resets a fresh
  seven-day period. Strategy and Bribe deployment follows the Liquid Signal shape: Resonance uses `StrategyFactory`
  and `BribeFactory`, and each Strategy has a corresponding `BribeRouter` and `Bribe`.
- Each Bribe may register at most eight append-only reward tokens. The cap is fixed in code and is not governable.
- Every Strategy is the same bounded reverse Dutch acquisition mechanism. Its complete payment, regardless of token,
  becomes a fixed `Fund` liability through the paired `BribeRouter`; auction proceeds never fund `Bribe` rewards.
  Bribes are funded independently by explicit reward notifications.
- A Strategy priced in GBX does not burn during settlement. After its fixed liability is paid into `Fund`, anyone may
  burn that GBX through `Fund.burnGBX`. Users should settle and burn pending Fund GBX before calculating a redemption.
- Before every redemption denominator snapshot, Fund must checkpoint all Mine slots so accrued unminted GBX is
  included. Capacity remains bounded so this call stays bounded.

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
- The position retains fixed principal and removes zero liquidity. `harvestFees` is permissionless: it collects fees
  through a zero-liquidity PositionManager decrease, verifies principal is unchanged, routes USDG through
  `ResonanceRouter`, and sends GBX to `Fund` for an atomic burn. Do not add caller funding, Permit2 approvals, a keeper
  role, an oracle, a swap, a fee split, a caller bounty, or a governance parameter to this mechanism.
- Position fees are protocol revenue. Harvested USDG follows the normal `ResonanceRouter -> Resonance stream -> Strategy`
  route, while harvested GBX is burned from Fund in the same harvest transaction.
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
- The remaining administrative surface is `Resonance.addStrategy`, `Resonance.killStrategy`,
  `Resonance.addBribeReward`, and `Mine.increaseCapacity`. Nothing else is owner-gated after one-time setup.
- Resonance and Mine ownership remain behind OpenZeppelin `TimelockController`, with the project multisig holding proposer and
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
