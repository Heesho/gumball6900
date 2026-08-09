# Protocol specification

The executable specification is the Solidity under `packages/contracts/src/core` and the integration suite at
`packages/contracts/test/minimal/StartingPoint.t.sol`.

The required behavior is:

1. USDG contributions route through Fundraiser, ResonanceRouter, and Resonance.
2. SignalGBX signaling uses incremental absolute per-Strategy amounts. It has no time-based withdrawal lock, and any
   unallocated balance can be unstaked immediately.
3. Resonance creates uniform acquisition Strategies through bound factories.
4. Every Strategy payment becomes a 100% fixed Fund liability. Auction proceeds never fund Bribes, and GBX payments
   remain unburned until anyone pays the liability and calls Fund's permissionless burn function.
5. Fund supports registry-free selective in-kind redemption and has no migration or administrative withdrawal path.
6. GBX creates 20 million genesis-liquidity tokens and permanently reserves the remaining 980 million capacity for
   Fundraiser's fixed daily four-year-half-life schedule.
7. LiquidityPosition holds one precommitted single-sided GBX/USDG v4 position permanently at fixed principal.
   Anyone may harvest fees; USDG routes through ResonanceRouter and GBX is sent to Fund and burned atomically.
8. Resonance administration passes through OpenZeppelin `TimelockController`. Fund and LiquidityPosition are
   ownerless.
9. Each Bribe's append-only reward-token list is permanently capped at eight, bounding signal removal and reward claims.
10. Revenue and reward floor remainders are retained as explicit scaled carry. Zero-supply reward streams pause,
    notifications queue, and Fund-bound value is paid through fixed permissionless liabilities rather than inline
    signal-exit transfers.

Detailed mechanics are in [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), with risks in
[THREAT_MODEL.md](THREAT_MODEL.md).
