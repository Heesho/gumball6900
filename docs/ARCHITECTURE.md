# Architecture

The active graph is direct, immutable, and deliberately small.

```text
slot replacement USDG -> Mine --20%--> ResonanceRouter -> Resonance -> Strategy
                              \--80%--> displaced miner pull claim

Mine --continuous GBX--> current slot miners
SignalGBX -------------------------------> Resonance allocation weights
Strategy payment -> BribeRouter -> fixed Fund liability
independent reward funder -> Bribe -> Strategy signalers
GBX holder -> Fund.redeem(selected tokens) -> in-kind assets
Uniswap v4 fees -> LiquidityPosition -> USDG revenue / GBX burn
```

GBX creates only the 20 million genesis-liquidity allocation. A one-time deployment binding permanently assigns all
later mint authority to Mine. Mine starts with one hourly reverse-Dutch slot and has an increase-only capacity cap of 16. Each occupied slot keeps its GBX-per-second rate until it is replaced. Capacity expansion therefore does not dilute
incumbents; newly filled slots divide the current global rate by current capacity.

Fund checkpoints all Mine slots before its redemption supply snapshot. This crystallizes pending GBX so a miner's
earned but unminted balance cannot be excluded from the denominator. The complete checkpoint is bounded by 16 slots.

Resonance distributes routed USDG using unrestricted absolute SignalGBX allocations. StrategyFactory and BribeFactory
are bound once to Resonance. Each Strategy has a dedicated Bribe and BribeRouter; complete auction payments are fixed
Fund liabilities, while Bribes receive only independently notified rewards.

Fund is an ownerless raw-token treasury with caller-selected redemption arrays and no registry or migration path.
LiquidityPosition permanently holds the precommitted, fixed-principal Uniswap v4 NFT.

See [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md) and [ADR 0024](adr/0024-immutable-multislot-mine.md).
