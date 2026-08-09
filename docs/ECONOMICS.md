# Economics

## GBX supply

No more than one billion GBX may ever be minted cumulatively. GBX creates 20 million tokens for the initial
single-sided Uniswap v4 position and reserves the remaining 980 million lifetime capacity for Fundraiser. The
deployment minter cannot mint before permanently handing authority to Fundraiser. Burns reduce circulating supply but
never restore mint capacity.

## Contributions

Each daily Fundraiser epoch assigns its fixed sequentially decayed GBX emission pro rata to USDG contributions. The
first emission is `465152.749681042811702004 GBX`; multiplying by `0.999525354337060160` with a floor after every day
produces a four-year/1,460-day half-life. An empty day advances the schedule and permanently forfeits its emission.
Every contributed USDG is routed into Resonance in the same transaction.

## Liquidity fees

The canonical v4 position begins single-sided with the 20 million GBX genesis allocation and compounds its own
fees forever. Anyone may call `compound`, which grows the position by 0.20% of its current liquidity and pays the
caller everything the position had accrued. Uniswap v4 nets accrued fees against an increase, so the caller funds
only the shortfall and keeps the surplus.

The result is a self-running incentive with no keeper, oracle, or incentive budget: while accrued fees are worth less
than 0.20% of the position the call costs money and nobody makes it, and the moment they are worth more a searcher is
paid to compound. Position liquidity is therefore monotonically non-decreasing, and principal is never withdrawn.

Liquidity fees do not fund the protocol. They are the compounding incentive, so Fundraiser contributions are the only
source of USDG revenue reaching Resonance, and position fees no longer burn GBX.

## Revenue allocation

Resonance distributes USDG by current SignalGBX (`sGBX`) allocation. Global and per-Strategy scaled carry retain every
floor remainder. When no signal weight exists, or when a killed Strategy accrues revenue, the exact whole-token value
becomes a fixed liability to Fund. Anyone may later call `payFundRevenue`; a Fund transfer failure cannot block signal
removal or unstaking. Direct USDG donations are visible through `unaccountedRevenue` and can be classified with
`syncRevenue`.

## Signal-directed asset accumulation

An `sGBX` holder can allocate signal to the active Strategy for an asset they want the protocol to accumulate. When that
Strategy completes an acquisition, its complete payment token amount becomes Fund-bound. Signal rewards are separate:
anyone may explicitly notify a registered token to the Strategy's Bribe, which streams that independently supplied
reward across eligible signalers.

## Strategy settlement

A Strategy sells its entire USDG balance at a linearly declining price. BribeRouter pulls each complete payment once
and records 100% as a fixed Fund liability, so a token that temporarily rejects Fund cannot strand the Strategy's USDG.
There is no acquisition/buyback mode and no auction-proceeds reward split. If the payment token is GBX, supply remains
unchanged until the liability is paid to Fund and anyone later calls `burnGBX`.

Each Bribe retains exact whole-token rate remainders, scaled global and per-user allocation carry, and pauses active
stream time while signal supply is zero. Notifications received behind an active stream or with zero supply are
queued. A user may claim one token, a selected unique set, or all registered tokens; the append-only registry remains
permanently capped at eight.

## Redemption

For every token selected by a redeemer:

```text
payout = floor(Fund token balance * GBX burned / GBX total supply before burn)
```

Omitted assets remain for the post-redemption supply. There is no NAV, price oracle, or registered basket.
Because Fund-held GBX remains in total supply, a redeemer should first pay any GBX Strategy liabilities and burn all
`pendingGBX`; redeeming without that maintenance produces a smaller payout and permanently forfeits the difference.
