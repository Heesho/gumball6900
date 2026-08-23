# Architecture

The target graph is direct, immutable, and deliberately small.

> Development architecture: ADRs 0031 and 0033-0048 are authoritative in whole or in their recorded unsuperseded
> parts. Governance execution remains an
> unselected external integration, so this document is not deployment approval or evidence of a complete production
> graph.

```text
slot replacement USDG -> Mine --20% deposit--> ResonanceRouter --permissionless route()--> Resonance
                              \--80%--> displaced miner pull claim                    \--7-day stream--> Strategy

Mine --continuous GBX--> current slot miners
GBX --signal deposit--> SignalGBX --signal coordination--> Resonance allocation weights
                                  \--IVotes checkpoints---> external governance (unselected) --owns--> Resonance
Strategy acquired-asset payment --(100% - global bribeBps)--> Fund
                                \--global bribeBps (0%-20%)--> BribeRouter buffer --> paired Bribe
additional reward funder ------------------------------> Bribe -> Strategy signalers
GBX holder -> Fund.redeem(selected tokens) -> in-kind assets
Uniswap v4 fees -> LiquidityPosition -> USDG revenue / GBX burn
```

The core keeps custody and accounting invariants inside the contracts that own them, while optional transaction
composition and liveness automation stay in periphery. In particular, a paid Mine handoff exact-transfers its protocol
share into ResonanceRouter and then ends. `Mine.RevenueDeposited` records that deposit only. A manual caller, frontend,
volunteer keeper, or cron process may later call the permissionless `route()` function; there is no role, bounty, or
guaranteed caller, so even a qualifying balance may wait indefinitely. A future frontend-facing helper could compose
`mine()` and `route()`, but Mine correctness and handoff liveness must never depend on that optional call succeeding.

GBX creates only the 20 million genesis-liquidity allocation. A one-time deployment binding permanently assigns all
later mint authority to a Mine that identifies the same GBX. Mine has exactly sixteen ownerless hourly reverse-Dutch
slots. Each occupied slot keeps its TPS until replacement; newly filled slots divide the current global TPS by sixteen.

Fund reads Mine's constant-time effective supply before its redemption snapshot. Pending GBX is included in the
denominator without minting it, iterating slots, or changing mining state.

SignalGBX is a non-transferable one-for-one GBX escrow token, retains ERC20Votes checkpoints for a future external
governance integration, and is the only external signal coordinator. Idle sGBX is invalid. `signal` and
`signalWithPermit` atomically deposit GBX, mint the same sGBX,
assign the same amount to one live Strategy through Resonance, and mirror it into the paired Bribe. `moveSignal`
atomically composes the restricted `removeSignalFor` source hook and `addSignalFor` destination hook; Resonance has no
dedicated move hook. A failed destination addition rolls back the complete move. The successful composition changes
allocation without changing custody, supply, or votes. `withdrawSignal` removes the Strategy and Bribe position, burns
the same sGBX, and returns the same GBX. The permit path uses underlying GBX authorization; sGBX itself has no ERC-2612
approval permit.

Resonance holds forwarded USDG in one scalar global seven-day stream, with no reward-token registry or token-keyed
reward state, and uses unrestricted absolute SignalGBX allocations for
each elapsed interval. SignalGBX calls Resonance's restricted coordination hooks, which checkpoint elapsed revenue
before changing weights. A Strategy purchase also
checkpoints and pulls its released allocation before reading the auction inventory. During an active period,
ResonanceRouter holds a nonzero balance until it is at least both `DURATION` raw USDG units and the whole reward left
at the active rate. A qualifying complete-balance notification checkpoints elapsed emission, combines the new reward
with `remainingSeconds * rewardRate`, and restarts the schedule for seven days. The Synthetix-style rate uses ordinary
integer division; rate, index, and Strategy floors, zero-active-signal emission, and direct donations remain
unclassified surplus. The reward-per-signal index uses `1e36` precision.

Signal state is deliberately split rather than duplicated: `SignalGBX.balanceOf(account)` is each account's aggregate
signal, the paired Bribe stores account-by-Strategy balances and each Strategy's complete supply, and Resonance stores
the active total across live Strategies. There is no separate `allocatedBalance` duplicate.

StrategyFactory and BribeFactory are bound once to Resonance. Each Strategy has a dedicated Bribe and BribeRouter.
Resonance stores one global acquired-asset `bribeBps`, defaulting to 10% and bounded from 0% through 20%. Before token
interaction, Strategy snapshots that rate, transfers the floored Bribe share to its BribeRouter, and pays the
complement directly to Fund. There is no cumulative split carry or deferred Fund liability. At 0%, new payments go
entirely to Fund, while Bribe balance accounting, signals, exits, existing rewards, and independent reward funding
remain live. BribeRouter simply buffers the Bribe share until its complete balance satisfies the Bribe's minimum and
active-left notification gates. Bribes use ordinary Synthetix rollover and floor semantics, with no queue, pause,
carry, or Fund rounding state. Each Bribe has a fixed append-only limit of sixteen reward tokens. They retain `1e36`
reward precision, and each
reward token has a monotonic lifetime notification cap of `floor(type(uint256).max / 1e36)` raw units, checked
before checkpointing or transfer so index overflow cannot block signal exits. Killing a Strategy checkpoints and
preserves its accrued Resonance claim, removes its complete weight from active reward supply, and leaves its Bribe as a
closed pool for existing signalers; no new signal can enter, and a final exit can permanently abandon unfinished
rewards. After bootstrap, the final live Strategy cannot be killed until a replacement has been added, while killed-
Strategy positions remain movable out or withdrawable.

Fund is an ownerless raw-token treasury with caller-selected redemption arrays and no registry or migration path.
LiquidityPosition permanently holds the precommitted, fixed-principal Uniswap v4 NFT.

The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. Resonance is its
only contract with continuing custom owner authority and retains `addStrategy`, `killStrategy`, `addBribeReward`, and
bounded global `setBribeBps`, plus inherited ownership transfer and renunciation. SignalGBX, StrategyFactory, and
BribeFactory retain setup-only inherited ownership shells after their one-time bindings. A production setup must
transfer Resonance from its temporary bootstrap owner directly to the exact external governance executor selected by a
later ADR and renounce those consumed setup-only ownership shells. That integration's release, permissions, voting
rules, administrators, upgrade model, batching, delay, and cancellation semantics remain unselected, so deployment is
blocked.

See [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), [ADR 0024](adr/0024-immutable-multislot-mine.md),
[ADR 0027](adr/0027-bribe-carry-boundaries.md), [ADR 0028](adr/0028-closed-bribe-pools-after-strategy-death.md),
[ADR 0029](adr/0029-bribe-based-resonance.md),
[ADR 0030](adr/0030-signalgbx-coordination-and-token-governance.md),
[ADR 0031](adr/0031-mandatory-signal-backed-signalgbx.md),
[ADR 0032](adr/0032-fixed-90-10-acquired-asset-settlement.md),
[ADR 0033](adr/0033-fixed-mine-slots-and-constant-time-pending-emission.md),
[ADR 0034](adr/0034-external-governance-ownership.md),
[ADR 0035](adr/0035-bribe-lifetime-reward-cap.md),
[ADR 0036](adr/0036-governed-global-bribe-share.md),
[ADR 0037](adr/0037-high-precision-bribe-index.md),
[ADR 0038](adr/0038-fixed-mine-economics.md),
[ADR 0039](adr/0039-event-only-mine-messages.md),
[ADR 0040](adr/0040-deployment-time-mine-authority-verification.md),
[ADR 0041](adr/0041-time-based-mine-halvings.md),
[ADR 0042](adr/0042-provisional-accelerated-mine-emissions.md),
[ADR 0043](adr/0043-provisional-one-gbx-tail.md),
[ADR 0044](adr/0044-decouple-mine-from-revenue-routing.md),
[ADR 0045](adr/0045-defer-mine-router-token-verification.md),
[ADR 0046](adr/0046-usdg-only-resonance-accounting.md), and
[ADR 0047](adr/0047-synthetix-shaped-rewards-and-strategy-settlement.md), and
[ADR 0048](adr/0048-expand-bribe-rewards-and-compose-signal-moves.md).
