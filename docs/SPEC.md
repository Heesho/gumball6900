# Protocol specification

This is the authoritative target-development specification under ADRs 0031 and 0032. The current development tree
implements these decisions and reconciles their generated consumers. This remains unaudited local engineering
evidence, not deployment approval or authorization for user funds.

The required behavior is:

1. GBX creates 20 million genesis-liquidity tokens and permanently assigns all later minting to one immutable Mine
   only after the Mine identifies that same GBX.
2. Mine has exactly sixteen ownerless hourly reverse-Dutch slots and no all-slot checkpoint.
3. Each mining tenure has a fixed GBX TPS. Cumulative-mining thresholds and redemptions do not dilute an incumbent;
   only a new occupant receives current global TPS divided by sixteen.
4. A nonempty-slot replacement settles only that slot's accrual, makes 80% of the exact USDG price claimable by the displaced
   miner, and routes 20% through ResonanceRouter. An empty slot routes 100%; there is no team fee.
5. Global rates used for future handoffs halve at immutable cumulative-mining thresholds and continue at a positive
   immutable tail. GBX therefore has no protocol-defined economic maximum. It retains ERC-2612 permit but has no
   ERC20Votes checkpoints.
6. SignalGBX accepts `signal` or underlying-GBX-permit `signalWithPermit` only after reciprocal Resonance binding and
   only for a registered live Strategy. Each call atomically deposits exact GBX, mints the same non-transferable
   ERC20Votes sGBX amount, adds the same Strategy signal, and mirrors it into the paired Bribe. Idle sGBX and standalone
   staking or unstaking do not exist. `moveSignal` changes allocation but not GBX custody, sGBX supply, or voting units.
   `withdrawSignal` atomically removes the selected Strategy and Bribe position, burns the same sGBX, and returns the
   same GBX. SignalGBX has no ERC-2612 approval permit or withdrawal lock.
7. Resonance uses one active seven-day USDG schedule. During an active period ResonanceRouter holds a balance below the
   exact amount left; once its complete balance is at least that amount, Resonance checkpoints and restarts seven days
   with `reward + left`. The raw schedule uses quotient-plus-front-loaded-remainder release, while the global reward
   index uses `1e36` precision. Index and Strategy floors, zero-active-signal emission, and direct donations are accepted
   Resonance surplus rather than Fund liabilities. SignalGBX-coordinated changes checkpoint prior elapsed flow and Strategy purchases
   atomically pull released USDG. An irreversible Strategy kill preserves its pre-kill claim, excludes its complete
   weight from future rewards, blocks additions, and still permits incumbent exits. Resonance creates uniform
   acquisition Strategies through bound factories. Every acquired-asset Strategy payment is classified cumulatively
   and immutably as 90% fixed Fund liability and 10% fixed paired-Bribe reward liability. Explicit split-remainder
   accounting makes the result independent of payment partitioning. The automatic Bribe reward is the acquired payment
   asset, not USDG; additional independent Bribe funding remains possible.
8. Fund reads Mine's constant-time effective supply before every redemption denominator snapshot, then performs registry-free,
   caller-selected in-kind redemption atomically with the GBX burn.
9. LiquidityPosition permanently holds one precommitted single-sided GBX/USDG v4 position at fixed principal. Anyone
   may harvest fees; USDG transfers to ResonanceRouter, which may retain it until the balance qualifies, and GBX is
   burned through Fund atomically.
10. TimelockController owns Resonance. Its sole proposer is an immutable ProtocolGovernor using SignalGBX's
    block-number vote checkpoints. The Governor permits only exact zero-value calls to `Resonance.addStrategy`,
    `Resonance.killStrategy`, and `Resonance.addBribeReward`; it has no mutable settings,
    generic relay, Timelock replacement, nonzero-value execution, multisig bypass, guardian, or queued-proposal veto. Fund and
    LiquidityPosition are ownerless. After the first Strategy is registered, `killStrategy` cannot remove the final
    live Strategy; a replacement is added before the old Strategy is killed in one permitted batch. No core contract
    is upgradeable or migratable.
11. Each Bribe has at most eight append-only reward tokens. Bribe reward remainders remain explicit carry; old-supply
    Bribe carry and fully exiting user precision become fixed Fund classification before supply changes. Broken payout
    tokens do not block signal movement or withdrawal.
12. `SignalGBX.balanceOf(account)` is the canonical account aggregate signal, each paired Bribe owns canonical
    account-by-Strategy balances and Strategy supply, and Resonance owns only the active total across live Strategies.
    SignalGBX maintains no separate `allocatedBalance` duplicate. SignalGBX supply equals the sum of every paired Bribe
    supply across live and killed Strategies, and its GBX escrow balance is at least that supply.

Detailed mechanics are in [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), with risks in
[THREAT_MODEL.md](THREAT_MODEL.md).
