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
its complete first payment routes to Resonance.

## GBX accrual

Every occupied slot accrues `elapsed seconds * assigned UPS`. `checkpointAll` crystallizes all live slots without
resetting auction clocks or changing their rates. Replacement checkpoints first, then gives the incoming miner the
current global rate divided by current capacity.

## Capacity and fairness

Capacity starts at one and can only rise, through the timelock, to 16. An occupied slot keeps its assigned rate across
capacity changes and cumulative-mining thresholds. This prevents governance from reducing a miner's reward mid-tenure. Aggregate
issuance may temporarily exceed the undivided current global rate until old-rate slots turn over.

## Infinite tail

Global handoff rates follow cumulative-mining halvings down to a constructor-fixed positive tail. The tail never reaches
zero, so GBX issuance and mining-sourced USDG revenue can continue indefinitely. Integer division by capacity may leave
unissued rate residue, but the minimum tail bound ensures a newly assigned slot always receives a positive rate at the
maximum capacity.
