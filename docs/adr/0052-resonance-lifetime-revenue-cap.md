# ADR 0052: Cap lifetime Resonance revenue notifications

- Status: accepted for development after reproducing V12-249695 on the current `f991253` graph; not independently
  audited, deployed, or approved for user funds; ADR 0055 later permits Mine to route future revenue to a replacement
  graph but does not recover USDG already buffered against an exhausted Resonance
- Date: 2026-08-29
- Builds on: ADR 0025's global revenue stream, ADR 0037's `1e36` index precision, and ADR 0046's USDG-only Resonance
- Preserves: the scalar Synthetix schedule, existing rounding/surplus rules, permissionless Router and distribution
  calls, signal ownership and exit paths, and the absence of rescue, reset, migration, or additional authority

## Context

Resonance admits fresh USDG through a single seven-day schedule and records a monotonic, `1e36`-scaled
revenue-per-signal index. Before this ADR, `notifyRevenue` bounded a new active-period amount against the scheduled
remainder but placed no lifetime bound on fresh notifications.

With one raw signal unit, a sufficiently large admitted history can place the index near `uint256` maximum. A later
elapsed schedule then makes `revenuePerSignal()` overflow. Every signal change checkpoints that index before changing
weight, so the overflow blocks `SignalGBX.removeSignal` before it can burn sGBX and return the corresponding GBX.
V12-249695 identified this arithmetic path. The current audit reproduced it through public Mine, Router, Resonance,
SignalGBX, Strategy, and Bribe functions against `f991253`; no storage mutation was used.

The required volume is fantastically large for intended six-decimal USDG, but the core does not read or enforce
decimals, token supply, or an external issuance cap. Exitability therefore must follow from an onchain invariant rather
than an operational supply assumption.

## Decision

Resonance tracks a monotonic `lifetimeRevenueNotified` counter containing only fresh raw USDG accepted by successful
notifications. Direct donations do not consume the counter because they never enter the schedule. Rolled-over
remaining revenue is not counted again because it was already admitted by an earlier fresh notification.

With `P = REWARD_PRECISION = 1e36`, the immutable maximum is:

```text
MAX_LIFETIME_REVENUE_AMOUNT = floor((2^256 - 1) / P)
```

Before checkpointing the old schedule or interacting with USDG, `notifyRevenue(amount)` checks both the existing
active-remainder threshold and the new lifetime headroom. It rejects:

```text
amount > MAX_LIFETIME_REVENUE_AMOUNT - lifetimeRevenueNotified
```

The new rejection uses `RevenueLifetimeCapExceeded(notified, requested, maximum)`. A successful notification records
the fresh amount only after custody and the replacement schedule are stored. The counter has no reset, setter,
decrement, governance override, or escape hatch.

## Safety argument

At every notification, elapsed emission and remaining scheduled revenue partition value already admitted; restarting a
stream cannot duplicate it. Consequently cumulative emitted revenue is no greater than cumulative fresh admitted
revenue. The smallest positive active signal denominator is one raw unit, so each emitted raw USDG unit can increase
the cumulative index by at most `P`:

```text
lifetimeRevenueNotified <= floor((2^256 - 1) / P)
revenuePerSignal <= lifetimeRevenueNotified * P <= 2^256 - 1
```

Changing signal weights, completing or restarting streams, distributing Strategy revenue, claims, and periods with
zero active signal never restore admission headroom. The bound therefore covers the complete contract lifetime rather
than only its current balance or schedule.

## Consequences

- Normal routing, seven-day rollover, rate and index flooring, Strategy distribution, and signal accounting are
  unchanged below the cap.
- At six decimals, the cap is approximately `1.158e35` whole USDG. It is a representability boundary, not an economic
  supply forecast or a claim about USDG issuance.
- Once the cap is exhausted, later qualifying USDG remains in ResonanceRouter after each reverted route. There is no
  rescue or alternate revenue destination. This permanently strands later protocol revenue but does not revert the
  Mine replacement that deposited it.
- Existing Strategy distributions, Bribe claims, and scalar or batched signal removals remain available at cap. In
  particular, the cap failure occurs before the old revenue index is checkpointed or USDG custody changes.
- The ABI gains the constant getter, lifetime counter getter, and custom error. Generated SDK and subgraph consumers
  must be regenerated from compiler output.
- The original vulnerable public-function PoC remains stored with a noncompiled extension, and the compiled regression
  fills the exact remaining lifetime headroom, rejects another routed schedule, proves Router custody unchanged, and
  removes the signal principal successfully.
