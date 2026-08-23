# ADR 0026: Exact active-plus-successor Resonance revenue stream

- Status: superseded by ADR 0029 and its exact-schedule successor later superseded by ADR 0047; never approved for
  deployment or user funds
- Date: 2026-08-13
- Supersedes: ADR 0025's router thresholds, rolling reset, `1e18` Resonance precision, and Resonance carry-boundary policy
- Superseded by: [ADR 0029](0029-bribe-based-resonance.md), which restores a qualifying rolling reset and accepts
  unclassified Resonance surplus

## Context

ADR 0025 removed the atomic signal → revenue → stale-auction capture by placing routed USDG in a global seven-day
stream. Its historical Bribe-style routing gates nevertheless left a terminal balance below 604,800 raw units
(`0.6048 USDG`) in ResonanceRouter forever unless more revenue arrived. Qualifying top-ups also combined with the
unreleased balance and reset seven days, so an arrival could raise or lower the live rate and change its finish.

The protocol needs to accept arbitrary Mine and LiquidityPosition payments, preserve the interval weights that earned
the revenue, keep checkpoint work bounded, and expose every raw six-decimal USDG unit in an exact accounting identity.

## Decision

ResonanceRouter forwards its complete balance on every nonzero permissionless `route` call. There is no amount or live-
remainder threshold.

Resonance maintains one active seven-day stream and one aggregate successor:

- If no stream is active, a notification starts a seven-day stream at the current timestamp.
- If a stream is active, the complete notification adds to `queuedRevenue`. It cannot change the active rate, remainder
  schedule, or finish.
- When a checkpoint reaches the active finish, the aggregate successor starts at that finish, not at the later
  checkpoint timestamp. The same call catches it up to the current timestamp.
- A checkpoint processes at most the active stream and one successor. If both periods have elapsed, both complete and
  later notified revenue starts a new stream at the notification timestamp.

Revenue uses `P = 1e36` scaled units. For raw amount `A`, duration `D = 604800`, and stream start `S`:

```text
scaled = A * P
baseRate = floor(scaled / D)
rateRemainder = scaled mod D
release([from, to)) = (to - from) * baseRate
                      + overlap([from, to), [S, S + rateRemainder))
```

The quotient-plus-remainder schedule releases exactly `A * P` by the finish, including when `A = 1`. Resonance rejects
an accounted balance only if multiplying it by `P` would overflow `uint256`.

Every signal mutation checkpoints elapsed revenue and updates the affected Strategy under the old weights. If scaled
carry is still too small to advance the old global index, that carry is irrevocably assigned to
`fundRevenueRemainderScaled` before the denominator changes. Whole raw units materialize as the existing permissionless
Fund liability. Likewise, a Strategy's remainder moves to the Fund remainder when its weight reaches zero. This fixed
dust destination prevents a later signaler from receiving revenue released under an earlier denominator without
introducing historical buckets or a Strategy loop.

## Consequences

- A 100 USDG stream topped up with 10 USDG after one day continues releasing the original 100 USDG through day seven.
  The 10 USDG successor then runs from day seven through day fourteen.
- A 100 USDG stream topped up with 90 USDG near its finish behaves the same way: the original finish and rate do not
  move, and 90 USDG begins afterward.
- Repeated 0.10 USDG Mine payments route immediately and add into one successor storage word. They do not create a list,
  reset the active period, or increase checkpoint complexity.
- A final 0.50 USDG balance routes and streams exactly without future revenue or a keeper-specific role.
- A same-transaction signal, notification, and Strategy purchase releases zero of the new notification because no
  timestamp interval elapsed. Existing inventory and revenue released before the signal remain separate timing risks.
- Signals still have no cooldown, epoch, or withdrawal lock. A signal earns only intervals after its mutation
  checkpoint; any old-denominator allocation carry goes to Fund rather than crossing the boundary.
- Top-ups can determine the next period's aggregate rate but cannot slow, accelerate, or extend the active period.
- Storage and gas stay constant in the number of notifications. Lazy progress remains permissionless through routing,
  signaling, distribution, purchase, synchronization, indexing, and Fund-payment paths.
- `RevenueQueued` and `RevenueCarryFunded` make successor and scaled-Fund state transitions observable. The scheduled
  event records the exact start, finish, base rate, and rate remainder.
- A-09 no longer applies to Resonance revenue carry. ADR 0027 applies the same fixed Fund-boundary policy to
  independently funded Bribe reward carry.
