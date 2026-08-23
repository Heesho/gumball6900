# ADR 0021: Uniform Strategy settlement into Fund

- Status: superseded by ADR 0032 and then ADR 0047; retained as historical development context; never approved for
  deployment or user funds
- Date: 2026-08-09
- Supersedes: ADR 0013 and ADR 0016 provisions for acquisition splits, buyback settlement, and `setBribeBps`
- Superseded by: ADR 0032's paired-Bribe settlement and ultimately ADR 0047's direct Strategy-to-Fund settlement

## Context

Strategy previously had two settlement modes. An acquisition split its payment between Fund and Bribe, while a buyback
required GBX and burned the complete payment atomically. That distinction coupled asset identity to settlement policy
and duplicated a burn decision already exposed permissionlessly by the ownerless Fund.

Fund-held GBX remains part of total supply until it is burned. A redeemer can therefore settle outstanding GBX Fund
liabilities and burn `Fund.pendingGBX()` before redemption, without requiring Strategy to burn during an auction fill.

## Decision

There is one Strategy type. Every nonzero auction payment, including GBX, is pulled into the paired BribeRouter and
classified entirely as a fixed Fund liability. The deferred transfer preserves the liveness property introduced by ADR
0020: a payment token that temporarily rejects Fund cannot prevent the buyer from removing USDG from Strategy.

Auction proceeds never fund Bribe rewards. BribeRouter therefore exposes only the complete-payment route and fixed
Fund liability; its legacy reward queue and reward-split entry points are removed. Bribes remain independently fundable
through explicit notifications of registered reward tokens. The `Strategy.Kind` enum, GBX-only buyback validation,
atomic buyback burn path, `Resonance.bribeBps`, its bounds and setter, and the kind fields in Strategy creation events
are removed.

After a GBX liability is paid to Fund, anyone may call `Fund.burnGBX`. Burning is not automatic on receipt or during
Strategy settlement.

## Consequences

- Every acquired asset follows one auditable settlement rule: 100% is owed to Fund.
- GBX can accumulate in BribeRouter liabilities or Fund until a permissionless caller settles and burns it.
- A redeemer who wants the full post-maintenance pro-rata basket should first pay pending GBX liabilities and burn all
  Fund-held GBX. Redeeming first uses the larger pre-burn supply denominator and permanently forfeits the difference.
- Signalers receive no automatic share of auction proceeds. Any Bribe reward must be funded explicitly and independently.
- Resonance's ongoing owner-authorized surface shrinks to `addStrategy`, `killStrategy`, and `addBribeReward`.
