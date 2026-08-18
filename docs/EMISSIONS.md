# Mine emission and handoff rules

Mine is a Farplace-shaped multislot mechanism with no oracle, random selection, team fee, or upgrade path.

## Slot auction

```text
replacement window = 1 hour
price(t)           = initialPrice - floor(initialPrice * t / 1 hour)
price(t >= 1 hour) = 0
next initial price = clamp(floor(price * multiplier), immutable minimum, absolute maximum)
```

Callers supply the expected slot epoch, deadline, and maximum price for frontrun protection. Slots can be replaced at
any moment, including at zero after one hour.

## Payment

For an occupied slot, 80% of the paid USDG accrues to the displaced miner and 20% routes to ResonanceRouter. Claims are
pull-based and permissionless to trigger, but always pay the entitled account. An empty slot has no displaced miner, so
its complete first payment routes to ResonanceRouter.

## GBX accrual

Every occupied slot accrues `elapsed seconds * assigned TPS`. Mine caches the sum of occupied TPS and the emission
accrued through one global timestamp, making total pending emission constant-time. A replacement settles and mints
only the outgoing slot, then gives the incoming tenure the current global TPS divided by sixteen.

## Fixed slots and fairness

Mine has exactly 16 ownerless slots. An occupied slot keeps its assigned TPS across cumulative-mining thresholds. This
prevents a miner's reward from changing mid-tenure. Aggregate issuance may temporarily exceed the current global TPS
after a halving until old-rate slots turn over.

## Infinite tail

Global handoff rates follow cumulative-mining halvings down to a constructor-fixed positive tail. The tail never reaches
zero, so GBX issuance and mining-sourced USDG revenue can continue indefinitely. Integer division by sixteen may leave
unissued rate residue, but the minimum tail bound ensures every newly assigned tenure receives a positive TPS.
