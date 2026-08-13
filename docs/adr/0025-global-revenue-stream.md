# ADR 0025: Global seven-day Resonance revenue stream

- Status: accepted for development; not approved for deployment or user funds
- Date: 2026-08-12
- Supersedes: immediate routed-revenue allocation in ADR 0013 and ADR 0020

## Context

Immediate allocation joined two independently timed markets. A Strategy auction price could decay while its USDG
inventory remained tiny. In one transaction, a large sGBX holder could signal that Strategy, cause a Mine payment to
route under the new weights, and fill the enlarged inventory at the stale low auction price. A weekly signal lock would
make the maneuver costly to exit but would not remove the stale-inventory coupling, and it would conflict with the
protocol's no-lock signaling rule.

Beradrome-style per-Strategy Gauge contracts can stream assigned revenue, but they add a factory, one contract per
Strategy, and another routing boundary. The protocol needs time-weighted flow, not independent gauge administration.

## Decision

Resonance holds all routed and synchronized USDG in one global stream. A fresh balance streams for seven days. Accounting
uses `1e18`-scaled USDG units per second so six-decimal USDG and sub-base-unit-per-second schedules remain smooth.

Every signal addition or removal first releases elapsed revenue and indexes it under the weights that governed that
interval. The weight changes only afterward. There is no cooldown, epoch, once-per-period rule, or withdrawal lock.
Every Strategy purchase calls `Resonance.distribute(strategy)` before reading its USDG balance, making the released
inventory snapshot atomic with the purchase.

The routing boundary adopts the historical Liquid Signal Bribe anti-grief gates. ResonanceRouter retains its complete
USDG balance unless:

```text
pending >= 604800 raw units
pending > whole USDG left in the active stream
```

For six-decimal USDG the absolute floor is `0.6048 USDG`. Waiting can satisfy the second condition as the live remainder
decays, but it cannot satisfy the absolute floor. When both conditions hold, Resonance checkpoints the old schedule,
adds the pending balance to the exact scaled remainder, sets the rate to `ceil(combined / 7 days)`, and resets the finish
to seven days from the current timestamp. A qualifying reset may lower the live rate, but requires at least as much new
whole-unit revenue as remains, preventing cheap dust resets. Anyone may retry routing; no keeper role is required.
Revenue released while no signal weight exists becomes a fixed Fund liability. Sub-index rounding remains explicit
carry under ADR 0020.

Streaming is lazy accounting. No transaction runs each second; signal mutations, notifications, distributions,
Strategy purchases, and Fund-revenue payments materialize the elapsed interval. This is economically time-based even
though token transfers occur only when a caller triggers a checkpoint.

## Consequences

- A same-transaction signal shift, Mine payment, and auction fill captures none of the new payment because its stream
  has zero elapsed time.
- A signal held for real time receives the corresponding future flow and may be removed immediately after its final
  checkpoint. The mechanism prices time rather than imposing a lock.
- There are no Gauge or GaugeFactory contracts and no new governance surface.
- An insufficient balance remains visible in ResonanceRouter until more USDG arrives or the live remainder decays below
  it. Once qualifying, it resets a fresh seven-day stream and may raise or lower the prior rate.
- Balances below 604,800 raw units never route by waiting alone. With six-decimal USDG this is a maximum permanently
  pending dust amount of less than `0.6048 USDG`, unless later revenue is added.
- Strategy balances still arrive in discrete transfers when someone calls a checkpointing path. Auction pricing does
  not depend on inventory size, so buyers and interfaces must account for newly claimable inventory at execution.
- Existing inventory, transaction ordering across different blocks, validator timestamp discretion, and ADR 0020's
  sub-index carry boundary remain separate risks. This decision does not claim to eliminate every timing strategy.
