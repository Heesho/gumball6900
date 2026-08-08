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

The canonical v4 position begins single-sided with the 20 million GBX genesis allocation. Anyone may collect fees
without removing position liquidity. Collected or directly transferred GBX is burned; USDG is routed through
ResonanceRouter and allocated by current signals.

## Revenue allocation

Resonance distributes USDG by current SignalGBX (`sGBX`) allocation. When no signal weight exists, new revenue goes to Fund.
Strategies with weight accrue indexed revenue and may be distributed individually or in bounded ranges.

## Signal-directed asset accumulation

An `sGBX` holder can allocate signal to the active acquisition Strategy for an asset they want to accumulate. When that
Strategy completes an acquisition, its payment token is the acquired asset: the Fund receives the Fund share, while
BribeRouter streams the configured signal-reward share pro rata across eligible signalers. The Strategy must exist and
successfully settle an acquisition before any such reward is earned.

## Strategy settlement

A Strategy sells its entire USDG balance at a linearly declining price. Acquisition payments begin at 90% to Fund and
10% through BribeRouter; governance may set the signal-reward share between 0% and 50%. A buyback accepts GBX and burns the
entire payment without a Bribe split.

## Redemption

For every token selected by a redeemer:

```text
payout = floor(Fund token balance * GBX burned / GBX total supply before burn)
```

Omitted assets remain for the post-redemption supply. There is no NAV, price oracle, or registered basket.
