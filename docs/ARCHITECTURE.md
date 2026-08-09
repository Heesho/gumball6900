# Architecture

The active Solidity graph is intentionally small and non-upgradeable.

```text
Fundraiser -> ResonanceRouter -> Resonance -> Strategy
                                  |      |
SignalGBX ------------------------+      +-> payment token -> BribeRouter -> 100% Fund liability

independent reward funder -> Bribe -> Strategy signalers
GBX in Fund -> permissionless burn

GBX holder -> Fund.redeem(selected tokens) -> in-kind assets

Uniswap v4 position -> LiquidityPosition -> caller adds 0.20% liquidity
                                        -> caller takes the accrued fees
```

Fundraiser accounts for contribution epochs and routes every USDG contribution immediately. Resonance maintains an
indexed USDG allocation using unrestricted, absolute per-Strategy SignalGBX (`sGBX`) signals. StrategyFactory and
BribeFactory are bound to Resonance, so each admitted Strategy is created with a dedicated Bribe and BribeRouter. Every
auction payment becomes a fixed Fund liability; Bribes receive only independently notified rewards. A Bribe's
append-only reward-token list is capped at eight. Exact scaled carry preserves index and stream remainders; fixed Fund
liabilities move transfers out of signal-exit and Strategy settlement paths.

Fund is a raw-balance treasury with no asset registry. Redemption operates on unique token arrays selected by the
caller, using EIP-1153 transient storage for O(n) duplicate detection. Fund has no migration or administrative exit.

GBX mints exactly 20 million tokens to the genesis-liquidity recipient before its minter is locked to Fundraiser.
LiquidityPosition validates and holds one precommitted, nonempty, hookless GBX/USDG position NFT with the reviewed
single-sided range. Permissionless compounding adds a fixed 0.20% liquidity and removes no principal.

See [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md) for contract-level responsibilities.
