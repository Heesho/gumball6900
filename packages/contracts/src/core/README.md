# GUM BALL 6900 core contracts

This is the canonical development source, not a deployment or authorization for user funds.

## System flow

```text
mining:       replacement USDG -> 80% displaced-miner claim + 20% ResonanceRouter
empty slot:   first-payment USDG -> 100% ResonanceRouter
issuance:     Mine checkpoint -> accrued GBX to current slot miners
acquisitions: buyer payment -> BribeRouter -> Fund liability -> Fund
redemptions:  Mine checkpoint -> user GBX burn -> selected Fund assets to receiver
liquidity:    accrued USDG -> ResonanceRouter; accrued GBX -> Fund -> atomic burn
```

## Contracts

| Contract            | Responsibility                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `GBX`               | Creates 20M genesis-liquidity GBX, binds Mine as minter, and retains ERC-2612 permit approvals.       |
| `Mine`              | One-to-sixteen hourly reverse-Dutch replacement slots with fixed-tenure GBX rates and 80/20 payments. |
| `LiquidityPosition` | Permanently holds one canonical GBX/USDG v4 NFT at fixed principal and routes fees.                   |
| `SignalGBX`         | Non-transferable staked GBX, ERC20Votes governance power, and sole user-facing signal coordinator.    |
| `ResonanceRouter`   | Forwards a complete USDG balance once it meets Resonance's current live-period threshold.             |
| `Resonance`         | Bribe-shaped seven-day USDG rewards over Strategy signal weights, plus Strategy and Bribe creation.   |
| `StrategyFactory`   | Resonance-only Strategy and BribeRouter deployment.                                                   |
| `Strategy`          | Uniform bounded reverse-Dutch acquisition whose complete payment is owed to Fund.                     |
| `BribeFactory`      | Resonance-only Bribe deployment.                                                                      |
| `BribeRouter`       | Records every Strategy payment as a fixed, permissionlessly payable Fund liability.                   |
| `Bribe`             | Seven-day reward streams over virtual signal balances, with at most eight reward tokens.              |
| `Fund`              | Ownerless raw treasury, GBX burn boundary, and caller-selected in-kind redemption.                    |

Mine starts at one slot and can only grow to sixteen. A slot's assigned GBX/second rate never changes during that
miner's tenure. Capacity expansion and halving thresholds affect new occupations only. This deliberately prevents
governance or other users from diluting a miner after entry, while temporarily allowing aggregate issuance above the
current global rate until old slots turn over.

A nonempty-slot replacement makes 80% of its USDG payment claimable by the displaced miner and routes 20% through
ResonanceRouter. An empty slot routes 100%. There is no team fee. GBX has no protocol-defined economic supply cap, with
immutable cumulative-mining halvings for future handoffs and a positive tail. GBX is permit-enabled but has no voting
checkpoints; governance power is the SignalGBX minted when GBX is staked.

SignalGBX owns each account's aggregate allocation and is the only external signaling entrypoint. Paired Bribes own
account-by-Strategy balances and per-Strategy supply; Resonance owns only the active live-Strategy total. Standalone
stake, signal, move, remove, and unstake calls remain available alongside atomic stake-and-signal and
remove-signal-and-unstake workflows. Idle sGBX can vote but directs no revenue or Bribe rewards.

ResonanceRouter forwards a nonzero balance when it is at least the active period's exact remaining reward; smaller
balances wait in the Router without reverting Mine or liquidity-fee collection. A qualifying notification checkpoints
elapsed rewards and restarts seven days with the new USDG plus the old remainder. Resonance uses a `1e36` index and a
raw quotient with a front-loaded remainder. Per-index and per-Strategy flooring, elapsed zero-signal revenue, and direct
Resonance donations remain explicit surplus. Killing a Strategy checkpoints its pre-kill claim, removes its complete
weight from the active denominator, blocks additions and future rewards, and leaves every incumbent free to exit.

Bribe applies the same denominator-boundary rule to independently notified rewards. Before virtual signal supply
changes, unindexable old-supply carry becomes fixed Fund precision; when an account fully exits, its sub-token user
remainder does likewise instead of being reallocated to remaining signalers.

## Fund redemption

`redeem(gbxAmount, receiver, tokens)` checkpoints every mining slot before calculating payouts, then uses one post-
checkpoint, pre-burn supply snapshot. EIP-1153 transient storage rejects duplicate selected assets without a registry.
The complete basket must also leave every selected address with at least its snapshot less its own payout, rejecting
different facades that debit one shared ledger. Omitted assets remain for the post-redemption supply.

## Administration

TimelockController owns Resonance and Mine. SignalGBX holders operate its sole proposer, ProtocolGovernor, whose
immutable filter permits only Resonance Strategy addition/killing, Bribe reward registration, and increase-only Mine
capacity. Execution is open after the delay; there is no multisig bypass, guardian, or queued veto. Fund and
LiquidityPosition are ownerless. There is no proxy, migration, rescue, successor, emission setter, or capacity
decrease.

## Credit

The core adapts give.fun, Liquid Signal Governance, and Farplace MineRig. Strategy's auction also credits Euler Fee
Flow. Exact repository pins and unresolved licensing status are recorded in `NOTICE`.
