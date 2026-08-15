# Architecture

The active graph is direct, immutable, and deliberately small.

```text
slot replacement USDG -> Mine --20%--> ResonanceRouter -> Resonance --7-day stream--> Strategy
                              \--80%--> displaced miner pull claim

Mine --continuous GBX--> current slot miners
GBX --stake--> SignalGBX --signal coordination--> Resonance allocation weights
                         \--block-clock votes----> ProtocolGovernor -> Timelock
Strategy payment -> BribeRouter -> fixed Fund liability
independent reward funder -> Bribe -> Strategy signalers
GBX holder -> Fund.redeem(selected tokens) -> in-kind assets
Uniswap v4 fees -> LiquidityPosition -> USDG revenue / GBX burn
```

GBX creates only the 20 million genesis-liquidity allocation. A one-time deployment binding permanently assigns all
later mint authority to a Mine that identifies the same GBX. Mine starts with one hourly reverse-Dutch slot and has an increase-only capacity cap of 16. Each occupied slot keeps its GBX-per-second rate until it is replaced. Capacity expansion therefore does not dilute
incumbents; newly filled slots divide the current global rate by current capacity.

Fund checkpoints all Mine slots before its redemption supply snapshot. This crystallizes pending GBX so a miner's
earned but unminted balance cannot be excluded from the denominator. The complete checkpoint is bounded by 16 slots.

SignalGBX is a non-transferable one-for-one staked-GBX token, the ERC20Votes governance source, and the only external
signal coordinator. Idle sGBX can govern while directing no revenue or Bribe rewards. Holders can stake and signal,
move signal, or remove signal and unstake atomically; the permit-combined path tolerantly attempts an underlying GBX
permit and relies on the exact GBX transfer, because sGBX itself has no ERC-2612 permit.

Resonance holds routed USDG in one global seven-day stream and uses unrestricted absolute SignalGBX allocations for
each elapsed interval. SignalGBX calls Resonance's restricted coordination hooks, which checkpoint elapsed revenue
before changing weights. A Strategy purchase also
checkpoints and pulls its released allocation before reading the auction inventory. During an active period,
ResonanceRouter holds a nonzero balance until it is at least the exact USDG left in the schedule. A qualifying complete-
balance notification checkpoints elapsed emission, combines the new reward with the amount left, and restarts the
combined schedule for seven days. The raw schedule releases quotient plus a front-loaded remainder; its reward-per-
signal index uses `1e36` precision. Index and Strategy flooring, zero-active-signal emission, and direct donations remain
unclassified surplus rather than Fund liabilities.

Signal state is deliberately split rather than duplicated: SignalGBX stores each account's aggregate allocated
balance, the paired Bribe stores account-by-Strategy balances and each Strategy's complete supply, and Resonance stores
the active total across live Strategies.

StrategyFactory and BribeFactory are bound once to Resonance. Each Strategy has a dedicated Bribe and BribeRouter;
complete auction payments are fixed Fund liabilities, while Bribes receive only independently notified rewards. Bribe
old-supply carry and fully exiting user precision become fixed Fund classification before virtual signal supply changes.
Killing a Strategy checkpoints and preserves its accrued Resonance claim, removes its complete weight from active reward
supply, and leaves its Bribe as a closed pool for existing signalers; no new signal can enter, and a final exit can
permanently abandon unfinished rewards.

Fund is an ownerless raw-token treasury with caller-selected redemption arrays and no registry or migration path.
LiquidityPosition permanently holds the precommitted, fixed-principal Uniswap v4 NFT.

ProtocolGovernor binds immutable SignalGBX, Timelock, Resonance, Mine, block-clock voting parameters, and quorum. Its
proposal filter admits only the four exact zero-value administrative calls. It is the Timelock's sole proposer; open
execution follows the delay and rejects nonzero executor `msg.value`, with no multisig bypass, guardian, or
queued-proposal veto.

See [STARTING_CONTRACTS.md](STARTING_CONTRACTS.md), [ADR 0024](adr/0024-immutable-multislot-mine.md),
[ADR 0027](adr/0027-bribe-carry-boundaries.md), [ADR 0028](adr/0028-closed-bribe-pools-after-strategy-death.md), and
[ADR 0029](adr/0029-bribe-based-resonance.md), and
[ADR 0030](adr/0030-signalgbx-coordination-and-token-governance.md).
