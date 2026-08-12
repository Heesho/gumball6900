# Core invariants

## GBX and Mine

- GBX creates exactly `20_000_000 ether` for genesis liquidity and has no protocol-defined economic maximum. The
  inherited ERC20Votes `uint208` ceiling remains an implementation bound.
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

- SignalGBX supply is backed one-for-one by GBX held in SignalGBX and cannot be transferred.
- An account may unstake exactly the balance not currently allocated to Strategies.
- Account signals sum to `accountSignalWeight`, Strategy signals sum to `strategySignalWeight`, and Strategy weights
  sum to `totalSignalWeight`.
- Each Bribe account balance mirrors its Strategy signal, and each Bribe supply mirrors its Strategy weight.
- Every accounted Resonance USDG unit is represented by carry, a live Strategy liability, or a fixed Fund liability.
- Pending carry conservation does not prove historical attribution; A-09 remains an explicit documented limitation.
- Every accounted Bribe reward unit is represented by a live schedule, queue, carry, user liability, or Fund liability.
- Zero Bribe supply pauses rather than consumes stream time, and a live stream is never reset by a top-up.
- A Bribe has at most eight append-only reward tokens.
- Signal removal and unstaking never depend on transferring a revenue, payment, or reward token.
- Only Resonance can deploy through StrategyFactory or BribeFactory or maintain Bribe virtual balances.

## Strategies, Fund, and liquidity

- Every nonzero Strategy payment is fully classified as a fixed Fund liability; no auction proceeds fund Bribes.
- A GBX-priced Strategy is supply-neutral until GBX is explicitly burned after reaching Fund.
- Fund redemption uses one post-checkpoint, pre-burn supply snapshot for every selected token and is atomic with the
  GBX burn and every selected transfer.
- Redemption rejects GBX, the zero address, and duplicates. Fund has no asset registry or administrative withdrawal.
- LiquidityPosition accepts only its precommitted nonempty hookless v4 NFT and exact range.
- Every harvest leaves principal unchanged, routes all USDG through ResonanceRouter, and burns all collected GBX.
- Fund and LiquidityPosition are ownerless; the canonical NFT can never leave LiquidityPosition.
