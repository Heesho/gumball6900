# Protocol specification

The executable specification is the Solidity under `packages/contracts/src/core` and the integration suite at
`packages/contracts/test/minimal/StartingPoint.t.sol`.

The required behavior is:

1. GBX creates 20 million genesis-liquidity tokens and permanently assigns all later minting to one immutable Mine.
2. Mine starts with one hourly reverse-Dutch slot. Timelock governance may only increase capacity, to at most sixteen.
3. Each mining tenure has a fixed GBX-per-second rate. Checkpoints, cumulative-mining thresholds, redemptions, and capacity
   increases do not dilute an incumbent; only a new occupant receives current global rate divided by current capacity.
4. A nonempty-slot replacement checkpoints all accrual, makes 80% of the exact USDG price claimable by the displaced
   miner, and routes 20% through ResonanceRouter. An empty slot routes 100%; there is no team fee.
5. Global rates used for future handoffs halve at immutable cumulative-mining thresholds and continue at a positive
   immutable tail. GBX therefore has no protocol-defined economic maximum; its inherited ERC20Votes accounting still
   has the `uint208` implementation ceiling.
6. SignalGBX uses incremental absolute per-Strategy amounts, has no withdrawal lock, and lets users withdraw any
   unallocated balance immediately.
7. Resonance creates uniform acquisition Strategies through bound factories. Every Strategy payment becomes a 100%
   fixed Fund liability; Bribes are funded independently.
8. Fund checkpoints all Mine slots before every redemption denominator snapshot, then performs registry-free,
   caller-selected in-kind redemption atomically with the GBX burn.
9. LiquidityPosition permanently holds one precommitted single-sided GBX/USDG v4 position at fixed principal. Anyone
   may harvest fees; USDG routes through ResonanceRouter and GBX is burned through Fund atomically.
10. TimelockController owns Resonance and Mine. Fund and LiquidityPosition are ownerless. No core contract is
    upgradeable or migratable.
11. Each Bribe has at most eight append-only reward tokens. Revenue and reward floor remainders remain explicit carry,
    and broken payout tokens do not block signal removal or unstaking.

Detailed mechanics are in [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), with risks in
[THREAT_MODEL.md](THREAT_MODEL.md).
