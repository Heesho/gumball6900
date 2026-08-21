# Architecture

The target graph is direct, immutable, and deliberately small.

> Development architecture: ADRs 0031, 0034, 0035, 0036, and 0037 are authoritative. Governance execution remains an
> unselected external integration, so this document is not deployment approval or evidence of a complete production
> graph.

```text
slot replacement USDG -> Mine --20%--> ResonanceRouter -> Resonance --7-day stream--> Strategy
                              \--80%--> displaced miner pull claim

Mine --continuous GBX--> current slot miners
GBX --signal deposit--> SignalGBX --signal coordination--> Resonance allocation weights
                                  \--IVotes checkpoints---> external governance (unselected) --owns--> Resonance
Strategy acquired-asset payment -> BribeRouter --(100% - global bribeBps)--> fixed Fund liability
                                              \--global bribeBps (0%-20%)--> paired Bribe reward liability
additional reward funder ------------------------------> Bribe -> Strategy signalers
GBX holder -> Fund.redeem(selected tokens) -> in-kind assets
Uniswap v4 fees -> LiquidityPosition -> USDG revenue / GBX burn
```

GBX creates only the 20 million genesis-liquidity allocation. A one-time deployment binding permanently assigns all
later mint authority to a Mine that identifies the same GBX. Mine has exactly sixteen ownerless hourly reverse-Dutch
slots. Each occupied slot keeps its TPS until replacement; newly filled slots divide the current global TPS by sixteen.

Fund reads Mine's constant-time effective supply before its redemption snapshot. Pending GBX is included in the
denominator without minting it, iterating slots, or changing mining state.

SignalGBX is a non-transferable one-for-one GBX escrow token, retains ERC20Votes checkpoints for a future external
governance integration, and is the only external signal coordinator. Idle sGBX is invalid. `signal` and
`signalWithPermit` atomically deposit GBX, mint the same sGBX,
assign the same amount to one live Strategy through Resonance, and mirror it into the paired Bribe. `moveSignal`
changes allocation without changing custody, supply, or votes. `withdrawSignal` removes the Strategy and Bribe
position, burns the same sGBX, and returns the same GBX. The permit path uses underlying GBX authorization; sGBX itself
has no ERC-2612 approval permit.

Resonance holds routed USDG in one global seven-day stream and uses unrestricted absolute SignalGBX allocations for
each elapsed interval. SignalGBX calls Resonance's restricted coordination hooks, which checkpoint elapsed revenue
before changing weights. A Strategy purchase also
checkpoints and pulls its released allocation before reading the auction inventory. During an active period,
ResonanceRouter holds a nonzero balance until it is at least the exact USDG left in the schedule. A qualifying complete-
balance notification checkpoints elapsed emission, combines the new reward with the amount left, and restarts the
combined schedule for seven days. The raw schedule releases quotient plus a front-loaded remainder; its reward-per-
signal index uses `1e36` precision. Index and Strategy flooring, zero-active-signal emission, and direct donations remain
unclassified surplus rather than Fund liabilities.

Signal state is deliberately split rather than duplicated: `SignalGBX.balanceOf(account)` is each account's aggregate
signal, the paired Bribe stores account-by-Strategy balances and each Strategy's complete supply, and Resonance stores
the active total across live Strategies. There is no separate `allocatedBalance` duplicate.

StrategyFactory and BribeFactory are bound once to Resonance. Each Strategy has a dedicated Bribe and BribeRouter.
Resonance stores one global acquired-asset `bribeBps`, defaulting to 10% and bounded from 0% through 20%; Fund receives
the complement. Every payment snapshots the rate when classified, and each Router preserves one weighted numerator
remainder across rate changes. Changing the rate cannot alter an existing liability, reward schedule, claim, or carry.
At 0%, new payments create only Fund liability, while Bribe balance accounting, signals, exits, existing rewards, and
independent reward funding remain live. Fund payment and Bribe notification are permissionless isolated settlement
legs. Bribes may also receive independently notified rewards. Bribe old-supply carry and fully exiting user precision
become fixed Fund classification before virtual signal supply changes. Bribes use `1e36` reward precision, and each
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
[ADR 0034](adr/0034-external-governance-ownership.md),
[ADR 0035](adr/0035-bribe-lifetime-reward-cap.md), and
[ADR 0036](adr/0036-governed-global-bribe-share.md).
