# Protocol specification

The executable specification is the Solidity under `packages/contracts/src/core` and the integration suite at
`packages/contracts/test/minimal/StartingPoint.t.sol`.

The required behavior is:

1. USDG contributions route through Fundraiser, ResonanceRouter, and Resonance.
2. SignalGBX signaling is unrestricted and has no time-based withdrawal lock.
3. Resonance creates and funds acquisition or buyback Strategies through bound factories.
4. Acquisition payments grow Fund and reward signalers; buyback payments burn GBX.
5. Fund supports registry-free selective in-kind redemption and one-way batched migration.
6. GBX creates 20 million genesis-liquidity tokens and permanently reserves the remaining 980 million capacity for
   Fundraiser's fixed daily four-year-half-life schedule.
7. LiquidityPosition holds one precommitted single-sided GBX/USDG v4 position, never removes principal during fee
   collection, burns GBX fees, and routes USDG fees to ResonanceRouter.
8. Resonance, Fund, and LiquidityPosition administration passes through OpenZeppelin `TimelockController`.

Detailed mechanics are in [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), with risks in
[THREAT_MODEL.md](THREAT_MODEL.md).
