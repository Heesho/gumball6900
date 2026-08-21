# GUM BALL 6900 core contracts

This is the canonical development source, not a deployment or authorization for user funds.

## System flow

```text
mining:       replacement USDG -> 80% displaced-miner claim + 20% ResonanceRouter
empty slot:   first-payment USDG -> 100% ResonanceRouter
issuance:     Mine checkpoint -> accrued GBX to current slot miners
acquisitions: buyer payment -> BribeRouter -> complementary Fund + global 0%-20% paired-Bribe liabilities
redemptions:  Mine checkpoint -> user GBX burn -> selected Fund assets to receiver
liquidity:    accrued USDG -> ResonanceRouter; accrued GBX -> Fund -> atomic burn
```

## Contracts

| Contract            | Responsibility                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `GBX`               | Creates 20M genesis-liquidity GBX, binds Mine as minter, and retains ERC-2612 permit approvals.       |
| `Mine`              | One-to-sixteen hourly reverse-Dutch replacement slots with fixed-tenure GBX rates and 80/20 payments. |
| `LiquidityPosition` | Permanently holds one canonical GBX/USDG v4 NFT at fixed principal and routes fees.                   |
| `SignalGBX`         | Non-transferable signal-backed GBX, ERC20Votes governance power, and sole signal coordinator.         |
| `ResonanceRouter`   | Forwards a complete USDG balance once it meets Resonance's current live-period threshold.             |
| `Resonance`         | Bribe-shaped seven-day USDG rewards over Strategy signal weights, plus Strategy and Bribe creation.   |
| `StrategyFactory`   | Resonance-only Strategy and BribeRouter deployment.                                                   |
| `Strategy`          | Uniform bounded reverse-Dutch acquisition whose payment becomes fixed Fund/Bribe liabilities.         |
| `BribeFactory`      | Resonance-only Bribe deployment.                                                                      |
| `BribeRouter`       | Applies the global bounded Bribe rate with weighted carry and isolates permissionless liabilities.    |
| `Bribe`             | Seven-day reward streams with at most eight tokens and a fixed per-token lifetime notification cap.   |
| `Fund`              | Ownerless raw treasury, GBX burn boundary, and caller-selected in-kind redemption.                    |

Mine has exactly sixteen slots. A slot's assigned GBX/second rate never changes during that miner's tenure. Halving
thresholds affect new occupations only. This deliberately prevents other users from diluting a miner after entry,
while temporarily allowing aggregate issuance above the current global rate until old slots turn over.

A nonempty-slot replacement makes 80% of its USDG payment claimable by the displaced miner and routes 20% through
ResonanceRouter. An empty slot routes 100%. There is no team fee. GBX has no protocol-defined economic supply cap, with
immutable cumulative-mining halvings for future handoffs and a positive tail. GBX is permit-enabled but has no voting
checkpoints; governance power is the SignalGBX minted when GBX is deposited directly into a Strategy signal.

SignalGBX is the only external signaling entrypoint. Every mint atomically deposits GBX and adds the same amount of
signal to one live Strategy; every burn atomically removes signal and returns the same GBX. Paired Bribes own
account-by-Strategy balances and per-Strategy supply, while Resonance owns only the active live-Strategy total.
Signal may move between Strategies without minting or burning, and no idle sGBX state is reachable.

BribeRouter classifies Strategy payments at Resonance's global `bribeBps`, which defaults to 10% and is bounded from
0% through 20%; Fund receives the complement. Weighted basis-point carry persists across rate changes. Each
destination is paid through its own permissionless function, so failure at one does not block the other. At 0%, new
payments create only Fund liability while signals, exits, existing rewards, and independent rewards remain live.
Donations remain surplus.

ResonanceRouter forwards a nonzero balance when it is at least the active period's exact remaining reward; smaller
balances wait in the Router without reverting Mine or liquidity-fee collection. A qualifying notification checkpoints
elapsed rewards and restarts seven days with the new USDG plus the old remainder. Resonance uses a `1e36` index and a
raw quotient with a front-loaded remainder. Per-index and per-Strategy flooring, elapsed zero-signal revenue, and direct
Resonance donations remain explicit surplus. Killing a Strategy checkpoints its pre-kill claim, removes its complete
weight from the active denominator, blocks additions and future rewards, and leaves every incumbent free to exit.

Bribe applies the same denominator-boundary rule to independently notified rewards. Before virtual signal supply
changes, unindexable old-supply carry becomes fixed Fund precision; when an account fully exits, its sub-token user
remainder does likewise instead of being reallocated to remaining signalers.

Each Bribe uses a `1e36` reward-per-signal index. For each reward token, it accepts at most
`floor(type(uint256).max / 1e36)` raw units across its complete lifetime.
The monotonic total has no reset, setter, or escape hatch. An excess notification reverts before checkpointing or token
transfer, so existing claims, signal moves, and withdrawals remain usable. At this cap an automatic payment reward
stays as a BribeRouter liability while the Fund leg remains independently payable; replacing the Strategy creates a
new paired Bribe without reopening the old closed reward pool.

## Fund redemption

`redeem(gbxAmount, receiver, tokens)` checkpoints every mining slot before calculating payouts, then uses one post-
checkpoint, pre-burn supply snapshot. EIP-1153 transient storage rejects duplicate selected assets without a registry.
The complete basket must also leave every selected address with at least its snapshot less its own payout, rejecting
different facades that debit one shared ledger. Omitted assets remain for the post-redemption supply.

## Administration

Resonance retains four continuing protocol administration methods: add a Strategy, kill a Strategy, register a Bribe
reward token, and set the bounded global acquired-asset Bribe rate. SignalGBX exposes ERC20Votes checkpoints, but
governance execution is an unselected external integration and is not implemented in this repository. A production
deployment remains blocked until an exact external governance executor is reviewed and receives Resonance ownership.
Mine, Fund, and LiquidityPosition are ownerless. There is no core proxy, migration, rescue, successor, emission setter,
or capacity change.

## Credit

The core adapts give.fun, Liquid Signal Governance, and Farplace MineRig. Strategy's auction also credits Euler Fee
Flow. Exact repository pins and unresolved licensing status are recorded in `NOTICE`.
