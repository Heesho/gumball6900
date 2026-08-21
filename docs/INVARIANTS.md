# Core invariants

> These are development invariants under ADRs 0031, 0034, 0035, 0036, and 0037. Governance execution remains an unselected
> external integration and contributes no production invariant until separately reviewed.

## GBX and Mine

- GBX creates exactly `20_000_000 ether` for genesis liquidity and has no protocol-defined economic maximum. It
  supports ERC-2612 permit approvals and carries no ERC20Votes checkpoints.
- `GBX.totalSupply() == GBX.lifetimeMinted() - GBX.lifetimeBurned()`.
- The temporary minter may permanently hand authority to one deployed Mine exactly once. After the handoff, neither
  the minter nor the lock can change.
- Mine has exactly sixteen immutable, ownerless slots.
- Every occupied slot accrues `elapsedSeconds * slot.tps`. Its `tps` is fixed from occupation until replacement.
- Cumulative-mining thresholds and redemptions never reprice an occupied slot.
- A new occupation assigns `globalTps(totalMined + pendingEmission) / 16`; floor remainder is unissued.
- Global rates used for future handoffs halve at immutable cumulative-mining thresholds and never fall below the
  positive immutable tail.
- `Mine.aggregateTps() == sum(Mine.getSlot(i).tps)` across all sixteen slots.
- `Mine.effectiveTotalSupply() == GBX.totalSupply() + Mine.pendingEmission()`.
- A replacement settles only its outgoing slot before assigning the incoming tenure.
- A nonempty-slot USDG payment is exactly `80% displaced-miner claim + 20% routed revenue`. An empty-slot payment is
  100% routed revenue. A zero-price handoff transfers nothing.
- Mine USDG balance equals total outstanding pull claims; claim execution reduces both by the same exact amount.
- Every Fund redemption uses Mine's constant-time effective supply without checkpointing or mutating Mine.

## Signals, revenue, and Bribes

- SignalGBX supply is backed at least one-for-one by GBX held in SignalGBX, cannot be transferred, and retains
  ERC20Votes checkpoints for a future external governance integration. Direct GBX donations are stranded surplus and
  mint no receipt or votes; SignalGBX has no ERC-2612 approval permit.
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
- For every Bribe reward token,
  `lifetimeRewardNotified[token] <= floor(type(uint256).max / Bribe.REWARD_PRECISION())`. The counter increases by each
  accepted raw notification, never decreases, and excludes direct donations. A notification that would exceed the cap
  reverts before checkpointing or transfer. The previewed reward-per-token index cannot exceed
  `lifetimeRewardNotified[token] * Bribe.REWARD_PRECISION()`.
- `withdrawSignal` never depends on transferring a revenue, payment, or reward token other than its exact escrowed GBX
  return. Killed-Strategy positions remain movable out or withdrawable.
- Only Resonance can deploy through StrategyFactory or BribeFactory or maintain Bribe virtual balances.

## Governance

- The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter.
- SignalGBX retains ERC20Votes checkpoints on its default block-number clock, but the core assigns them no proposal
  threshold, quorum, voting period, cancellation, delay, or execution semantics.
- Resonance is the only core contract with continuing custom owner authority after its one-time router binding. Those
  methods are `addStrategy`, `killStrategy`, `addBribeReward`, and bounded global `setBribeBps`; inherited ownership
  transfer and renunciation remain. SignalGBX, StrategyFactory, and BribeFactory retain setup-only inherited ownership
  shells after their one-time bindings, with no remaining custom owner action.
- `0 <= Resonance.bribeBps() <= 2_000`, its deployment default is 1,000, and Fund's classification rate is always
  `10_000 - bribeBps`. There is no per-Strategy rate or separately configurable Fund rate.
- The external Resonance owner is unselected. No production ownership, voting, permission, upgrade, batching, delay, or
  cancellation invariant exists until a later ADR selects the exact external integration, so deployment is blocked.

## Strategies, Fund, and liquidity

- For Strategy acquired-asset payments `a_i` classified at global rates `r_i`, cumulative paired-Bribe liability is
  `floor(sum(a_i * r_i) / 10_000)`, cumulative Fund liability is the remaining `sum(a_i)`, and the Router remainder is
  `sum(a_i * r_i) mod 10_000`. The fractional basis-point remainder survives rate changes unchanged. Partitioning
  payments classified at the same rate cannot change the result.
- A rate change is prospective: it changes no prior classification, existing Router liability, Bribe stream, queued
  reward, accrued claim, or split remainder. At rate zero, new payments create only Fund liability and add no Bribe
  numerator; signaling, moving signal, withdrawing signal, killed-Strategy exit, existing reward settlement, and
  independently funded rewards remain live.
- Fund payment and paired-Bribe notification are isolated permissionless settlement legs. Neither liability can be
  redirected, consumed by failure of the other leg, or paid twice. Direct BribeRouter donations alter neither.
- If the paired Bribe has exhausted a token's lifetime notification cap, notification failure leaves the complete
  automatic Bribe liability in BribeRouter while Fund settlement remains independently available.
- A GBX-priced Strategy is supply-neutral until the dynamically Fund-classified GBX is explicitly burned after reaching
  Fund; any Bribe-classified GBX remains a reward liability and is not burned by settlement.
- Fund redemption uses one effective pre-burn supply snapshot for every selected token and is atomic with the
  GBX burn and every selected transfer.
- Redemption rejects GBX, the zero address, and duplicates. Fund has no asset registry or administrative withdrawal.
- LiquidityPosition accepts only its precommitted nonempty hookless v4 NFT and exact range.
- Every harvest leaves principal unchanged, routes all USDG through ResonanceRouter, and burns all collected GBX.
- Fund and LiquidityPosition are ownerless; the canonical NFT can never leave LiquidityPosition.
