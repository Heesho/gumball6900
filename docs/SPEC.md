# Protocol specification

The executable specification is the Solidity under `packages/contracts/src/core` and the integration suite at
`packages/contracts/test/minimal/StartingPoint.t.sol`.

The required behavior is:

1. GBX creates 20 million genesis-liquidity tokens and permanently assigns all later minting to one immutable Mine
   only after the Mine identifies that same GBX.
2. Mine starts with one hourly reverse-Dutch slot. Timelock governance may only increase capacity, to at most sixteen.
3. Each mining tenure has a fixed GBX-per-second rate. Checkpoints, cumulative-mining thresholds, redemptions, and capacity
   increases do not dilute an incumbent; only a new occupant receives current global rate divided by current capacity.
4. A nonempty-slot replacement checkpoints all accrual, makes 80% of the exact USDG price claimable by the displaced
   miner, and routes 20% through ResonanceRouter. An empty slot routes 100%; there is no team fee.
5. Global rates used for future handoffs halve at immutable cumulative-mining thresholds and continue at a positive
   immutable tail. GBX therefore has no protocol-defined economic maximum. It retains ERC-2612 permit but has no
   ERC20Votes checkpoints.
6. SignalGBX accepts stakes only after reciprocal Resonance binding, mints non-transferable ERC20Votes sGBX, and is the
   sole external signal coordinator. It uses incremental absolute per-Strategy amounts, has no ERC-2612 approval permit
   or withdrawal lock, and lets users withdraw any unallocated balance immediately. Idle sGBX may vote without
   directing revenue or Bribe rewards. Stake-and-signal, underlying-GBX-permit stake-and-signal, signal movement, and
   remove-and-unstake are available as atomic workflows.
7. Resonance uses one active seven-day USDG schedule. During an active period ResonanceRouter holds a balance below the
   exact amount left; once its complete balance is at least that amount, Resonance checkpoints and restarts seven days
   with `reward + left`. The raw schedule uses quotient-plus-front-loaded-remainder release, while the global reward
   index uses `1e36` precision. Index and Strategy floors, zero-active-signal emission, and direct donations are accepted
   Resonance surplus rather than Fund liabilities. SignalGBX-coordinated changes checkpoint prior elapsed flow and Strategy purchases
   atomically pull released USDG. An irreversible Strategy kill preserves its pre-kill claim, excludes its complete
   weight from future rewards, blocks additions, and still permits incumbent exits. Resonance creates uniform
   acquisition Strategies through bound factories. Every Strategy payment becomes a 100% fixed Fund liability; Bribes
   are funded independently.
8. Fund checkpoints all Mine slots before every redemption denominator snapshot, then performs registry-free,
   caller-selected in-kind redemption atomically with the GBX burn.
9. LiquidityPosition permanently holds one precommitted single-sided GBX/USDG v4 position at fixed principal. Anyone
   may harvest fees; USDG transfers to ResonanceRouter, which may retain it until the balance qualifies, and GBX is
   burned through Fund atomically.
10. TimelockController owns Resonance and Mine. Its sole proposer is an immutable ProtocolGovernor using SignalGBX's
    block-number vote checkpoints. The Governor permits only exact zero-value calls to `Resonance.addStrategy`,
    `Resonance.killStrategy`, `Resonance.addBribeReward`, and `Mine.increaseCapacity`; it has no mutable settings,
    generic relay, Timelock replacement, nonzero-value execution, multisig bypass, guardian, or queued-proposal veto. Fund and
    LiquidityPosition are ownerless. No core contract is upgradeable or migratable.
11. Each Bribe has at most eight append-only reward tokens. Bribe reward remainders remain explicit carry; old-supply
    Bribe carry and fully exiting user precision become fixed Fund classification before supply changes. Broken payout
    tokens do not block signal removal or unstaking.
12. SignalGBX owns the canonical account aggregate allocation, each paired Bribe owns canonical account-by-Strategy
    balances and Strategy supply, and Resonance owns only the active total across live Strategies.

Detailed mechanics are in [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), with risks in
[THREAT_MODEL.md](THREAT_MODEL.md).
