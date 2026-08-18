# Architecture

The target graph is direct, immutable, and deliberately small.

> Target-development architecture: ADRs 0031 and 0032 are authoritative, but their Solidity and integration work is
> pending. See [ARCHITECTURE-IMPLEMENTATION-GAP.md](ARCHITECTURE-IMPLEMENTATION-GAP.md). This document describes the
> target and is not a claim that the current contracts already conform.

```text
slot replacement USDG -> Mine --20%--> ResonanceRouter -> Resonance --7-day stream--> Strategy
                              \--80%--> displaced miner pull claim

Mine --continuous GBX--> current slot miners
GBX --signal deposit--> SignalGBX --signal coordination--> Resonance allocation weights
                                  \--block-clock votes----> ProtocolGovernor -> Timelock
Strategy acquired-asset payment -> BribeRouter --90%--> fixed Fund liability
                                              \--10%--> paired Bribe reward liability
additional reward funder ------------------------------> Bribe -> Strategy signalers
GBX holder -> Fund.redeem(selected tokens) -> in-kind assets
Uniswap v4 fees -> LiquidityPosition -> USDG revenue / GBX burn
```

GBX creates only the 20 million genesis-liquidity allocation. A one-time deployment binding permanently assigns all
later mint authority to a Mine that identifies the same GBX. Mine has exactly sixteen ownerless hourly reverse-Dutch
slots. Each occupied slot keeps its TPS until replacement; newly filled slots divide the current global TPS by sixteen.

Fund reads Mine's constant-time effective supply before its redemption snapshot. Pending GBX is included in the
denominator without minting it, iterating slots, or changing mining state.

SignalGBX is a non-transferable one-for-one GBX escrow token, the ERC20Votes governance source, and the only external
signal coordinator. Idle sGBX is invalid. `signal` and `signalWithPermit` atomically deposit GBX, mint the same sGBX,
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

StrategyFactory and BribeFactory are bound once to Resonance. Each Strategy has a dedicated Bribe and BribeRouter;
every acquired-asset payment is cumulatively classified 90% to a fixed Fund liability and 10% to a fixed paired-Bribe
reward liability. The split is immutable and uses explicit remainder accounting; Fund payment and Bribe notification
are permissionless isolated settlement legs. Bribes may also receive independently notified rewards. Bribe old-supply
carry and fully exiting user precision become fixed Fund classification before virtual signal supply changes. Killing
a Strategy checkpoints and preserves its accrued Resonance claim, removes its complete weight from active reward
supply, and leaves its Bribe as a closed pool for existing signalers; no new signal can enter, and a final exit can
permanently abandon unfinished rewards. After bootstrap, the final live Strategy cannot be killed until a replacement
has been added, while killed-Strategy positions remain movable out or withdrawable.

Fund is an ownerless raw-token treasury with caller-selected redemption arrays and no registry or migration path.
LiquidityPosition permanently holds the precommitted, fixed-principal Uniswap v4 NFT.

ProtocolGovernor binds immutable SignalGBX, Timelock, Resonance, block-clock voting parameters, and quorum. Its
proposal filter admits only the three exact zero-value Resonance calls. It is the Timelock's sole proposer; open
execution follows the delay and rejects nonzero executor `msg.value`, with no multisig bypass, guardian, or
queued-proposal veto.

See [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), [ADR 0024](adr/0024-immutable-multislot-mine.md),
[ADR 0027](adr/0027-bribe-carry-boundaries.md), [ADR 0028](adr/0028-closed-bribe-pools-after-strategy-death.md), and
[ADR 0029](adr/0029-bribe-based-resonance.md),
[ADR 0030](adr/0030-signalgbx-coordination-and-token-governance.md),
[ADR 0031](adr/0031-mandatory-signal-backed-signalgbx.md), and
[ADR 0032](adr/0032-fixed-90-10-acquired-asset-settlement.md).
