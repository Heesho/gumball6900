# Architecture

The active graph is direct, immutable, and deliberately small.

```text
slot replacement USDG -> Mine --20%--> ResonanceRouter -> Resonance --7-day stream--> Strategy
                              \--80%--> displaced miner pull claim

Mine --continuous GBX--> current slot miners
SignalGBX -------------------------------> Resonance allocation weights
Strategy payment -> BribeRouter -> fixed Fund liability
independent reward funder -> Bribe -> Strategy signalers
GBX holder -> Fund.redeem(selected tokens) -> in-kind assets
Uniswap v4 fees -> LiquidityPosition -> USDG revenue / GBX burn
```

GBX creates only the 20 million genesis-liquidity allocation. A one-time deployment binding permanently assigns all
later mint authority to a Mine that identifies the same GBX. Mine starts with one hourly reverse-Dutch slot and has an increase-only capacity cap of 16. Each occupied slot keeps its GBX-per-second rate until it is replaced. Capacity expansion therefore does not dilute
incumbents; newly filled slots divide the current global rate by current capacity.

Fund checkpoints all Mine slots before its redemption supply snapshot. This crystallizes pending GBX so a miner's
earned but unminted balance cannot be excluded from the denominator. The complete checkpoint is bounded by 16 slots.

Resonance holds routed USDG in one global seven-day stream and uses unrestricted absolute SignalGBX allocations for
each elapsed interval. Signal mutations checkpoint elapsed revenue before changing weights. A Strategy purchase also
checkpoints and pulls its released allocation before reading the auction inventory. ResonanceRouter forwards every
nonzero balance. New revenue aggregates into one successor and cannot change the active stream's rate or finish.
Exact `1e36` quotient-plus-remainder accounting releases every raw USDG unit; carry that cannot be indexed before a
signal-weight change becomes explicit Fund remainder. StrategyFactory and BribeFactory are bound once to Resonance.
Each Strategy has a dedicated Bribe and BribeRouter; complete auction payments are fixed Fund liabilities, while
Bribes receive only independently notified rewards. Bribe old-supply carry and fully exiting user precision become
fixed Fund classification before virtual signal supply changes.

Fund is an ownerless raw-token treasury with caller-selected redemption arrays and no registry or migration path.
LiquidityPosition permanently holds the precommitted, fixed-principal Uniswap v4 NFT.

See [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), [ADR 0024](adr/0024-immutable-multislot-mine.md),
[ADR 0026](adr/0026-exact-successor-revenue-stream.md), and [ADR 0027](adr/0027-bribe-carry-boundaries.md).
