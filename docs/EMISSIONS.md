# Mine emission and replacement rules

Mine is a fixed-economics multislot mechanism with no oracle, random selection, team fee, or upgrade path. ADR 0054
also gives it one fixed deployment-only genesis-liquidity issue that is separate from slot emission. ADR 0055 gives its
`Ownable2Step` owner one custom method to validate and change the Router for future revenue only; it cannot change
emissions or slot economics.

## Fixed genesis liquidity issuance

GBX itself constructs with zero supply. After GBX is permanently bound to Mine, Mine's temporary
`genesisAuthority` may issue exactly `1,000 ether` GBX once to a contract recipient. The canonical launcher is that
authority and sends the complete amount directly to the validated USDG/GBX Pair. Mine consumes the flag and clears the
authority before the mint; it cannot change the amount, mint twice, or redirect later mining.

`Mine.totalMined()` continues to count only GBX settled from completed slot tenures. Lifetime issuance therefore
reconciles as:

```text
GBX.lifetimeMinted
    = Mine.totalMined
    + (Mine.genesisLiquidityMinted ? Mine.GENESIS_LIQUIDITY_GBX : 0)
```

## Slot auction

```text
replacement window = 1 hour
price(t)           = initialPrice - floor(initialPrice * t / 1 hour)
price(t >= 1 hour) = 0
next initial price = clamp(price * 2, 1 USDG, absolute maximum)
```

Callers supply the expected slot epoch, deadline, and maximum payment for frontrun protection. Slots can be replaced at
any moment, including at zero after one hour.

## Payment

For an occupied slot, 80% of the nominal paid USDG accrues to the outgoing tenure miner and Mine transfers the 20% remainder
into ResonanceRouter. Mine uses `SafeERC20` and trusts canonical USDG without sender/receiver balance-delta checks.
Claims are pull-based and permissionless to trigger, but always pay the entitled account. An
empty slot has no outgoing tenure miner, so its complete first payment is deposited into ResonanceRouter.

Mine does not call `ResonanceRouter.route()` during the replacement. `Mine.RevenueDeposited` records the nominal Router
deposit, which is treated as delivered under the supported USDG model; it does not mean the USDG reached Resonance or
entered a stream. Anyone may route later, but absent a manual,
frontend, keeper, or cron caller the balance may remain in the Router indefinitely.

## GBX accrual

Every occupied slot accrues `elapsed seconds * assigned TPS`. Mine caches the sum of occupied TPS and the emission
accrued through one global timestamp, making total pending emission constant-time. A replacement settles and mints
only the outgoing slot, then gives the incoming tenure the current global TPS divided by sixteen.

## Fixed slots and fairness

Mine has exactly 16 immutable slots. An occupied slot keeps its assigned TPS across time-based halving boundaries. This
prevents a miner's reward from changing mid-tenure. Aggregate issuance may exceed the current global TPS after a
halving for as long as old-rate slots remain; turnover is not guaranteed.

## Infinite tail

The prospective global rate begins at 64 GBX per second, halves after each provisional 69-day period measured from Mine
deployment, and stops at a fixed 1 GBX-per-second tail at the sixth boundary, day 414. The tail never reaches zero, so
GBX issuance and mining-sourced USDG revenue can continue indefinitely. Integer division by sixteen may leave unissued
rate residue.

If all slots are occupied, refreshed and settled exactly at every boundary and no GBX is burned, pre-tail mining is
751,161,600 GBX at day 414. The completed canonical launch adds the fixed 1,000-GBX genesis amount, making the gross
no-burn supply reference 751,162,600 GBX. Annual scheduled tail flow is 31,536,000 GBX, initially about 4.198% of that
synchronized reference supply and declining as supply grows. Legacy tenures can retain higher rates and exceed this
reference; empty slots can undershoot it, and burns change the actual denominator.
