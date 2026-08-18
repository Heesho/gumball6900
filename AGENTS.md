# Repository execution guide

This file governs automated contributors working in this repository. The protocol is not audited, deployed, or
authorized for user funds. A green local build is engineering evidence, never a release or deployment claim.

## Protocol starting point

- Build the core contracts as a minimal adaptation of the pinned give.fun and Liquid Signal Governance contracts.
  Preserve their simple contract boundaries and behavior unless this file or a recorded ADR explicitly changes them.
- Use these protocol names consistently: `GBX`, `Mine`, `LiquidityPosition`, `SignalGBX`, `ResonanceRouter`, `Resonance`,
  `StrategyFactory`, `Strategy`, `BribeFactory`, `BribeRouter`, `Bribe`, `Fund`, and `ProtocolGovernor`.
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
  GBX retains ERC-2612 permit approvals but does not carry ERC20Votes checkpoints or governance weight.
- Mine has exactly 16 immutable slots. Each slot uses an independent hourly reverse Dutch replacement auction and may
  change hands at any time. Mine is ownerless and has no capacity or all-slot checkpoint operation.
- A slot's assigned GBX tokens-per-second (`tps`) rate is locked for that miner's complete tenure. Redemptions and
  cumulative-mining threshold crossings must not reprice or dilute an occupied slot. Only a newly occupied or replaced
  slot receives `current global tps / 16`. Accept that aggregate issuance can temporarily exceed the current global
  rate while legacy-rate miners remain.
- Mine must maintain `aggregateTps` and a timestamped `storedPendingEmission` so total pending emission is available in
  constant time. Before one slot changes rate, accrue the old aggregate through the current timestamp; settle and mint
  only the replaced slot; then replace its contribution to `aggregateTps`. Halvings use
  `totalMined + pendingEmission()` so miners cannot postpone a threshold by delaying their own replacement.
- Global rates use constructor-immutable cumulative-mining halvings and a strictly positive tail rate. Do not add a
  rate setter, emissions controller, migration authority, oracle, entropy source, team fee, or claim redirection.
- `SignalGBX` is the non-transferable, one-for-one GBX escrow receipt, the ERC20Votes governance token on the default
  block-number clock, and the sole public signal coordinator. Idle sGBX is forbidden: every successful raw-unit mint
  must atomically deposit the same GBX amount, assign the same amount to one live Strategy through Resonance, and give
  the account the same virtual balance in the paired Bribe. The public user operations are `signal`,
  underlying-GBX-permit `signalWithPermit`, `moveSignal`, and `withdrawSignal`. A signal made while the holder has no
  current delegate self-delegates. `withdrawSignal` performs the exact inverse of `signal`: it removes the paired
  Strategy and Bribe balance, burns the same sGBX amount, and returns the same GBX amount atomically. `moveSignal`
  checkpoints both Strategies under their prior weights but changes neither GBX custody, sGBX supply, nor governance
  voting units. SignalGBX has no ERC-2612 approval permit, staking withdrawal lock, signal cooldown, epoch restriction,
  or once-per-period allocation rule. Standalone `stake`/`unstake`, allocation from an idle receipt, removal into an
  idle receipt, and the redundant `stakeAndSignal`, `stakeAndSignalWithPermit`, and `removeSignalAndUnstake` workflows
  are not permitted.
- `Resonance` holds received USDG in one global seven-day Bribe-style stream and allocates each elapsed interval among
  live Strategies according to the SignalGBX weights active during that interval. Every signal change checkpoints
  elapsed revenue before changing weights, and every Strategy purchase checkpoints and pulls that Strategy's released
  USDG. During an active period, ResonanceRouter retains its balance while it is smaller than the exact scheduled USDG
  left. Once the Router balance is at least that amount, it forwards its complete balance; Resonance checkpoints the
  elapsed interval, combines the notification with the amount left, and restarts the combined schedule for seven days.
  The raw USDG schedule uses quotient-plus-front-loaded-remainder release, while the global reward-per-signal index uses
  `1e36` precision. Global-index and per-Strategy floors are accepted surplus rather than explicit carry. Revenue that
  elapses while active signal supply is zero, and direct USDG donations, also remain unscheduled or unclaimable surplus
  in Resonance. Strategy and Bribe deployment follows the Liquid Signal shape: Resonance uses `StrategyFactory` and
  `BribeFactory`, and each Strategy has a corresponding `BribeRouter` and `Bribe`.
- Signal state has one canonical owner at each level: `SignalGBX.balanceOf(account)` is the account's aggregate signal,
  each Strategy's paired Bribe stores account-by-Strategy balances and its complete signal supply, and Resonance stores
  only the active live-Strategy total. Do not maintain a separate `SignalGBX.allocatedBalance` value that must duplicate
  `balanceOf`. Resonance's `addSignalFor`, `removeSignalFor`, and `moveSignalFor` hooks are callable only by SignalGBX;
  do not restore direct user signaling on Resonance or duplicate these ledgers.
- Killing a Strategy is irreversible. The kill checkpoints and preserves its accrued Resonance claim, excludes its
  complete weight from active reward supply, rejects later signal additions, and lets existing signalers remove their
  allocations without subtracting the excluded weight again. The killed Strategy earns no later Resonance revenue.
  Resonance tracks `liveStrategyCount`: before bootstrap it may be zero, but after the first Strategy is registered,
  `killStrategy` must not remove the final live Strategy. Governance replaces the final Strategy by atomically batching
  an addition before the old Strategy's kill. Do not add a fake abstain Strategy. Killed-Strategy positions must remain
  movable to a live Strategy and withdrawable.
- Each Bribe may register at most eight append-only reward tokens. The cap is fixed in code and is not governable.
- Before a Bribe signal-supply change, classify unindexable old-supply reward carry to its fixed Fund remainder. When
  an account fully exits, classify its sub-token user remainder to Fund rather than reallocating it to other signalers.
- Every Strategy is the same bounded reverse Dutch acquisition mechanism. Its complete acquired-asset payment enters
  the paired `BribeRouter` and is classified cumulatively as 90% fixed `Fund` liability and 10% fixed paired-`Bribe`
  reward liability. The acquired payment asset, not USDG, is the automatic Bribe reward. `BPS = 10_000`,
  `FUND_BPS = 9_000`, and `BRIBE_BPS = 1_000` are immutable; use explicit cumulative split-remainder accounting so
  payment partitioning cannot starve either destination. `BribeRouter.routePayment` only pulls and classifies the exact
  payment. Permissionless `payFundPayment` and `notifyBribeReward` isolate the two fixed settlement legs so failure of
  either preserves its liability without blocking or consuming the other. Direct donations to BribeRouter are
  unaccounted surplus. Additional independently funded Bribe rewards remain permitted within the fixed token cap.
- A Strategy priced in GBX does not burn during settlement. After the 90% Fund liability is paid into `Fund`, anyone
  may burn that GBX through `Fund.burnGBX`; the 10% Bribe liability funds the paired GBX reward stream. Users should
  settle and burn pending Fund GBX before calculating a redemption.
- Before every redemption denominator snapshot, Fund must read Mine's constant-time effective supply so accrued
  unminted GBX is included without a checkpoint or any slot iteration.

## Fund behavior

- `Fund` is a permissionless raw-token treasury, not a curated asset registry. Any ERC-20 sent to it may become GBX
  backing. Official protocol/index membership is represented by Strategies registered in Resonance, not by a Fund
  asset list.
- Anyone may burn GBX already held by `Fund` through the dedicated burn function. GBX may accumulate there until a
  permissionless caller burns it; burning before redemption removes Fund-held GBX from the payout denominator.
- Redemption is unpausable and does not enumerate Fund assets. A redeemer supplies `gbxAmount`, a receiver, and a
  caller-selected array of unique non-GBX token addresses. For every selected token, transfer:

  `floor(Fund token balance * gbxAmount / (GBX total supply + pending mining emission) before the burn)`

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
- The remaining administrative surface is `Resonance.addStrategy`, `Resonance.killStrategy`, and
  `Resonance.addBribeReward`. Nothing else is owner-gated after one-time setup.
- `ProtocolGovernor` uses SignalGBX ERC20Votes checkpoints and immutable, constructor-selected block-clock voting delay,
  period, proposal threshold, quorum percentage, Timelock, and Resonance dependencies. It may propose only exact
  zero-value calls for the three continuing administrative selectors. It is the Timelock's sole proposer and sole
  canceller-role holder; there is no multisig bypass, guardian, or queued-proposal veto. Standard Governor cancellation
  remains available only to the proposer while a proposal is pending.
- The Timelock should own Resonance, use a documented minimum delay, have no external default admin after
  setup, and grant the executor role to the zero address for permissionless execution. Create every reviewed initial
  Strategy while the temporary setup owner still controls Resonance, then transfer Resonance to the Timelock
  and renounce setup authority. Do not leave a deployer, multisig, or alternate proposer path.
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
