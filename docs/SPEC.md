# Protocol specification

This is the authoritative target-development specification under ADRs 0031 and 0033-0045 in whole or in their
recorded unsuperseded parts. The current
development tree implements these decisions and reconciles their generated consumers. This remains unaudited local
engineering evidence, not deployment approval or authorization for user funds.

The required behavior is:

1. GBX creates 20 million genesis-liquidity tokens and permanently assigns all later minting to one immutable Mine
   only after the Mine identifies that same GBX.
2. Mine has exactly sixteen ownerless hourly reverse-Dutch slots and no all-slot checkpoint.
3. Each mining tenure has a fixed GBX TPS. Time-based halving boundaries and redemptions do not dilute an incumbent;
   only a new occupant receives current global TPS divided by sixteen.
4. A nonempty-slot replacement settles only that slot's accrual, makes 80% of the exact USDG price claimable by the displaced
   miner, and exact-transfers the 20% remainder into ResonanceRouter. An empty slot deposits 100%; there is no team
   fee. Mine then ends without calling `route()`. Its `RevenueDeposited` event proves only Router deposit, while the later
   Router-to-Resonance action is permissionless and may be manual or automated without a role or bounty.
5. Global rates used for future handoffs halve at immutable intervals measured from Mine deployment and continue at a positive
   immutable tail. GBX therefore has no protocol-defined economic maximum. It retains ERC-2612 permit but has no
   ERC20Votes checkpoints.
6. SignalGBX accepts `signal` or underlying-GBX-permit `signalWithPermit` only after reciprocal Resonance binding and
   only for a registered live Strategy. Each call atomically deposits exact GBX, mints the same non-transferable
   ERC20Votes sGBX amount, adds the same Strategy signal, and mirrors it into the paired Bribe. Idle sGBX and standalone
   staking or unstaking do not exist. `moveSignal` changes allocation but not GBX custody, sGBX supply, or voting units.
   `withdrawSignal` atomically removes the selected Strategy and Bribe position, burns the same sGBX, and returns the
   same GBX. SignalGBX has no ERC-2612 approval permit or withdrawal lock.
7. Resonance uses one active seven-day USDG schedule. During an active period ResonanceRouter may hold a balance below
   or above the exact amount left until someone calls `route`; on a qualifying call, Resonance checkpoints and restarts seven days
   with `reward + left`. The raw schedule uses quotient-plus-front-loaded-remainder release, while the global reward
   index uses `1e36` precision. Index and Strategy floors, zero-active-signal emission, and direct donations are accepted
   Resonance surplus rather than Fund liabilities. SignalGBX-coordinated changes checkpoint prior elapsed flow and Strategy purchases
   atomically pull released USDG. An irreversible Strategy kill preserves its pre-kill claim, excludes its complete
   weight from future rewards, blocks additions, and still permits incumbent exits. Resonance creates uniform
   acquisition Strategies through bound factories. Every acquired-asset Strategy payment is classified at the one
   global `bribeBps` current when the payment is routed. The rate defaults to 1,000 basis points, is owner-settable from
   0 through 2,000 basis points, and has no per-Strategy override; Fund receives the complement. For payments `a_i`
   classified at rates `r_i`, cumulative Bribe classification is `floor(sum(a_i * r_i) / 10,000)`, with the exact
   numerator remainder carried across rate changes. A setter changes no prior liability, remainder, stream, or claim.
   At 0%, new payments classify entirely to Fund while signaling, moving, withdrawal, existing reward settlement, and
   independent Bribe funding remain live. The automatic Bribe reward is the acquired payment asset, not USDG.
8. Fund reads Mine's constant-time effective supply before every redemption denominator snapshot, then performs registry-free,
   caller-selected in-kind redemption atomically with the GBX burn.
9. LiquidityPosition permanently holds one precommitted single-sided GBX/USDG v4 position at fixed principal. Anyone
   may harvest fees; USDG transfers to ResonanceRouter and the harvest still attempts `route()` in the same atomic
   transaction, while GBX is burned through Fund atomically. This downstream coupling is specific to fee harvesting,
   not Mine handoffs.
10. The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. SignalGBX
    retains non-transferable ERC20Votes checkpoints on the block-number clock for a future external integration, but
    the core assigns them no proposal, quorum, delay, cancellation, or execution semantics. Resonance is the only core
    contract with continuing custom owner authority after its one-time binding: `addStrategy`, `killStrategy`,
    `addBribeReward`, and bounded global `setBribeBps`, plus inherited ownership transfer and renunciation. SignalGBX,
    StrategyFactory, and BribeFactory retain inherited ownership shells after their one-time bindings, but no remaining
    custom owner action. The production Resonance owner and ownership-shell cleanup remain unselected, and deployment is
    blocked until a later ADR pins and reviews the exact external governance integration and handoff. Fund and
    LiquidityPosition are ownerless. After the first Strategy is registered, `killStrategy` cannot remove the final
    live Strategy; a replacement must be added before the old Strategy is killed. No core contract is upgradeable or
    migratable.
11. Each Bribe has at most eight append-only reward tokens and uses a `1e36` reward-per-signal index. For each token, its
    monotonic lifetime accepted-notification total cannot exceed `floor(type(uint256).max / 1e36)` raw units and has no reset, setter, or escape hatch. The cap is
    checked before checkpointing or transfer; reaching it stops later notifications for only that token and Bribe, not
    claims, signal movement, or withdrawal. Bribe reward remainders remain explicit carry; old-supply Bribe carry and
    fully exiting user precision become fixed Fund classification before supply changes. Broken payout tokens do not
    block signal movement or withdrawal.
12. `SignalGBX.balanceOf(account)` is the canonical account aggregate signal, each paired Bribe owns canonical
    account-by-Strategy balances and Strategy supply, and Resonance owns only the active total across live Strategies.
    SignalGBX maintains no separate `allocatedBalance` duplicate. SignalGBX supply equals the sum of every paired Bribe
    supply across live and killed Strategies, and its GBX escrow balance is at least that supply.

Detailed mechanics are in [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), with risks in
[THREAT_MODEL.md](THREAT_MODEL.md).
