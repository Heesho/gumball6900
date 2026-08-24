# Mine emission and handoff rules

Mine is a fixed-economics multislot mechanism with no oracle, random selection, team fee, or upgrade path.

## Slot auction

```text
replacement window = 1 hour
price(t)           = initialPrice - floor(initialPrice * t / 1 hour)
price(t >= 1 hour) = 0
next initial price = clamp(price * 2, 1 USDG, absolute maximum)
```

Callers supply the expected slot epoch, deadline, and maximum price for frontrun protection. Slots can be replaced at
any moment, including at zero after one hour.

## Payment

For an occupied slot, 80% of the nominal paid USDG accrues to the displaced miner and Mine transfers the 20% remainder
into ResonanceRouter. Mine uses `SafeERC20` and trusts canonical USDG without sender/receiver balance-delta checks.
Claims are pull-based and permissionless to trigger, but always pay the entitled account. An
empty slot has no displaced miner, so its complete first payment is deposited into ResonanceRouter.

Mine does not call `ResonanceRouter.route()` during the handoff. `Mine.RevenueDeposited` records the nominal Router
deposit, which is treated as delivered under the supported USDG model; it does not mean the USDG reached Resonance or
entered a stream. Anyone may route later, but absent a manual,
frontend, keeper, or cron caller the balance may remain in the Router indefinitely.

## GBX accrual

Every occupied slot accrues `elapsed seconds * assigned TPS`. Mine caches the sum of occupied TPS and the emission
accrued through one global timestamp, making total pending emission constant-time. A replacement settles and mints
only the outgoing slot, then gives the incoming tenure the current global TPS divided by sixteen.

## Fixed slots and fairness

Mine has exactly 16 ownerless slots. An occupied slot keeps its assigned TPS across time-based halving boundaries. This
prevents a miner's reward from changing mid-tenure. Aggregate issuance may exceed the current global TPS after a
halving for as long as old-rate slots remain; turnover is not guaranteed.

## Infinite tail

The global handoff rate begins at 64 GBX per second, halves after each provisional 69-day period measured from Mine
deployment, and stops at a fixed 1 GBX-per-second tail at the sixth boundary, day 414. The tail never reaches zero, so
GBX issuance and mining-sourced USDG revenue can continue indefinitely. Integer division by sixteen may leave unissued
rate residue.

GBX starts with zero supply. If all slots are occupied, refreshed and settled exactly at every boundary and no GBX is
burned, pre-tail mining and gross supply are both 751,161,600 GBX at day 414. Annual scheduled tail flow is 31,536,000
GBX, initially about 4.198% of that synchronized reference supply and declining as
supply grows. Legacy tenures can retain higher rates and exceed this reference; empty slots can undershoot it, and burns
change the actual denominator.
