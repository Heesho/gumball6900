# Core invariants

> These are target-development invariants under ADRs 0031 and 0032. Their implementation and executable tests are
> pending; see [ARCHITECTURE-IMPLEMENTATION-GAP.md](ARCHITECTURE-IMPLEMENTATION-GAP.md).

## GBX and Mine

- GBX creates exactly `20_000_000 ether` for genesis liquidity and has no protocol-defined economic maximum. It
  supports ERC-2612 permit approvals and carries no ERC20Votes checkpoints.
- `GBX.totalSupply() == GBX.lifetimeMinted() - GBX.lifetimeBurned()`.
- The temporary minter may permanently hand authority to one deployed Mine exactly once. After the handoff, neither
  the minter nor the lock can change.
- Mine capacity begins at one, only increases, and never exceeds sixteen.
- Every occupied slot accrues `elapsedSeconds * slot.ups`. Its `ups` is fixed from occupation until replacement.
- Checkpoints, cumulative-mining thresholds, redemptions, and capacity increases never reprice an occupied slot.
- A new occupation assigns `globalUps(totalMinedAfterCheckpoint) / capacity`; floor remainder is unissued.
- Global rates used for future handoffs halve at immutable cumulative-mining thresholds and never fall below the
  positive immutable tail.
- `Mine.effectiveTotalSupply() == GBX.totalSupply() + Mine.pendingEmission()` before a checkpoint.
- A replacement checkpoints all live slots before assigning the incoming tenure.
- A nonempty-slot USDG payment is exactly `80% displaced-miner claim + 20% routed revenue`. An empty-slot payment is
  100% routed revenue. A zero-price handoff transfers nothing.
- Mine USDG balance equals total outstanding pull claims; claim execution reduces both by the same exact amount.
- Every Fund redemption checkpoints Mine before its pre-burn supply snapshot.

## Signals, revenue, and Bribes

- SignalGBX supply is backed at least one-for-one by GBX held in SignalGBX, cannot be transferred, and is the
  ERC20Votes source for ProtocolGovernor. Direct GBX donations are stranded surplus and mint no receipt or votes;
  SignalGBX has no ERC-2612 approval permit.
- Idle SignalGBX is unreachable. Every mint atomically deposits exact GBX and creates an identical Strategy and paired-
  Bribe position; every burn atomically removes an identical position and returns exact GBX.
- SignalGBX is the sole external signal coordinator. `SignalGBX.balanceOf(account)` is the canonical account aggregate,
  each paired Bribe account and total-supply balance is the canonical account-by-Strategy and Strategy aggregate
  ledger, and Resonance reads those values rather than duplicating them. There is no separate `allocatedBalance`.
- For every account, SignalGBX balance equals the sum of its positions across every live and killed paired Bribe.
- SignalGBX total supply equals the sum of all paired Bribe total supplies across live and killed Strategies.
- Active Resonance `totalSignalWeight` equals the sum of recorded `strategySignalWeight` balances for live Strategies
  only. A killed Strategy keeps its recorded user and Bribe balances while its complete weight remains excluded from
  active `totalSignalWeight`.
- Before the first Strategy is created, live Strategy count may be zero and new signal is impossible. After bootstrap,
  live Strategy count never reaches zero; the final Strategy can be killed only after a replacement is added.
- An active Resonance schedule finishes seven days after its most recent qualifying notification. Its raw base rate and
  front-loaded remainder emit the complete scheduled raw USDG amount by that finish.
- During an active schedule, ResonanceRouter retains a nonzero balance smaller than `left(USDG)`. Once its complete
  balance is at least `left(USDG)`, it forwards all of it and Resonance restarts seven days with `reward + left`.
- The Resonance USDG balance is at least its exact scheduled remainder plus every Strategy's previewed whole reward.
  Index and Strategy floors, zero-active-signal emission, and direct donations are accepted unclassified surplus.
- Every signal mutation checkpoints elapsed stream revenue before changing weights, and every Strategy purchase
  checkpoints and pulls released revenue before reading inventory.
- Killing a Strategy checkpoints and preserves its accrued whole Resonance reward, excludes its complete live weight,
  blocks additions, and lets existing signalers remove without reducing active `totalSignalWeight` again.
- Before each Bribe signal-weight change, pending carry that cannot be indexed under the old weights moves to its
  explicit Fund remainder. A fully exiting Bribe account's sub-token remainder does likewise.
- Every accounted Bribe reward unit is represented by a live schedule, queue, carry, user liability, or Fund liability.
- Zero Bribe supply pauses rather than consumes stream time, and a live stream is never reset by a top-up.
- A Bribe has at most eight append-only reward tokens.
- `withdrawSignal` never depends on transferring a revenue, payment, or reward token other than its exact escrowed GBX
  return. Killed-Strategy positions remain movable out or withdrawable.
- Only Resonance can deploy through StrategyFactory or BribeFactory or maintain Bribe virtual balances.

## Governance

- ProtocolGovernor's SignalGBX, Timelock, Resonance, Mine, voting delay, voting period, proposal threshold, and quorum
  percentage are immutable.
- Every proposal call has zero ETH value, targets the immutable Resonance or Mine, and uses exactly one of
  `addStrategy`, `killStrategy`, `addBribeReward`, or `increaseCapacity` with canonical calldata length.
- ProtocolGovernor is the Timelock's only proposer. The zero-address executor leaves execution permissionless after the
  delay, and no external default admin remains after setup.
- The proposer may cancel only while a proposal is Pending. No multisig, guardian, or public path can cancel a queued
  proposal or replace the Timelock.

## Strategies, Fund, and liquidity

- Every nonzero Strategy acquired-asset payment is cumulatively classified as 90% fixed Fund liability and 10% fixed
  paired-Bribe reward liability. The fractional basis-point remainder is explicit and payment partitioning cannot
  change cumulative classification.
- Fund payment and paired-Bribe notification are isolated permissionless settlement legs. Neither liability can be
  redirected, consumed by failure of the other leg, or paid twice. Direct BribeRouter donations alter neither.
- A GBX-priced Strategy is supply-neutral until the Fund-classified GBX is explicitly burned after reaching Fund; the
  Bribe-classified GBX remains a reward liability and is not burned by settlement.
- Fund redemption uses one post-checkpoint, pre-burn supply snapshot for every selected token and is atomic with the
  GBX burn and every selected transfer.
- Redemption rejects GBX, the zero address, and duplicates. Fund has no asset registry or administrative withdrawal.
- LiquidityPosition accepts only its precommitted nonempty hookless v4 NFT and exact range.
- Every harvest leaves principal unchanged, routes all USDG through ResonanceRouter, and burns all collected GBX.
- Fund and LiquidityPosition are ownerless; the canonical NFT can never leave LiquidityPosition.
