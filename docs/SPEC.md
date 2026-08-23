# Protocol specification

This is the authoritative target-development specification under ADRs 0031 and 0033-0048 in whole or in their
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
   staking or unstaking do not exist. `moveSignal` atomically calls `Resonance.removeSignalFor` for the source and then
   `Resonance.addSignalFor` for the live destination; failure of the addition rolls back the removal. Resonance has no
   dedicated move hook. A successful move changes allocation but not GBX custody, sGBX supply, or voting units.
   `withdrawSignal` atomically removes the selected Strategy and Bribe position, burns the same sGBX, and returns the
   same GBX. SignalGBX has no ERC-2612 approval permit or withdrawal lock.
7. Resonance uses one scalar seven-day USDG schedule. ResonanceRouter buffers until its balance is at least both
   `DURATION` raw units and the active amount left. A qualifying call checkpoints and restarts seven days using
   ordinary Synthetix leftover rollover. Rate, index, and Strategy floors, zero-active-signal emission, and direct
   donations are accepted Resonance surplus. The global reward index uses `1e36` precision. SignalGBX-coordinated
   changes checkpoint prior elapsed flow and Strategy purchases
   atomically pull released USDG. An irreversible Strategy kill preserves its pre-kill claim, excludes its complete
   weight from future rewards, blocks additions, and still permits incumbent exits. Resonance creates uniform
   acquisition Strategies through bound factories. Strategy snapshots the global `bribeBps` before payment-token
   interaction, transfers `floor(payment * bribeBps / 10,000)` to its BribeRouter, and transfers the complement
   directly to Fund. The rate defaults to 1,000 basis points, is owner-settable from 0 through 2,000, and has no
   per-Strategy override or cumulative split carry. BribeRouter only buffers and permissionlessly notifies the paired
   Bribe. Bribes use Synthetix rollover and floor semantics with fixed token and lifetime caps. At 0%, new payments go
   entirely to Fund while signaling, moving, withdrawal, existing rewards, and independent funding remain live.
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
11. Each Bribe has at most sixteen append-only reward tokens and uses a `1e36` reward-per-signal index. For each token, its
    monotonic lifetime accepted-notification total cannot exceed `floor(type(uint256).max / 1e36)` raw units and has no reset, setter, or escape hatch. The cap is
    checked before checkpointing or transfer; reaching it stops later notifications for only that token and Bribe, not
    claims, signal movement, or withdrawal. Streams continue at zero supply; notifications are not queued; and rate,
    index, and account floors remain unallocated Bribe surplus rather than carry or Fund liabilities. Bribe exposes an
    all-token claim plus an independent scalar-token claim, while broken payout tokens do not block signal movement or
    withdrawal.
12. `SignalGBX.balanceOf(account)` is the canonical account aggregate signal, each paired Bribe owns canonical
    account-by-Strategy balances and Strategy supply, and Resonance owns only the active total across live Strategies.
    SignalGBX maintains no separate `allocatedBalance` duplicate. SignalGBX supply equals the sum of every paired Bribe
    supply across live and killed Strategies, and its GBX escrow balance is at least that supply.

Detailed mechanics are in [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), with risks in
[THREAT_MODEL.md](THREAT_MODEL.md).
