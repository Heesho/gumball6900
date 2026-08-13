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

| Contract            | Responsibility                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `GBX`               | Creates 20M genesis-liquidity GBX and permanently binds its only mint authority to one Mine.            |
| `Mine`              | One-to-sixteen hourly reverse-Dutch replacement slots with fixed-tenure GBX rates and 80/20 payments.   |
| `LiquidityPosition` | Permanently holds one canonical GBX/USDG v4 NFT at fixed principal and routes fees.                     |
| `SignalGBX`         | Non-transferable one-for-one staked GBX; unallocated sGBX is immediately withdrawable.                  |
| `ResonanceRouter`   | Permissionlessly forwards every nonzero complete USDG balance to Resonance.                             |
| `Resonance`         | Exact active-plus-successor USDG streaming, signal allocation, Strategy creation, and Bribe accounting. |
| `StrategyFactory`   | Resonance-only Strategy and BribeRouter deployment.                                                     |
| `Strategy`          | Uniform bounded reverse-Dutch acquisition whose complete payment is owed to Fund.                       |
| `BribeFactory`      | Resonance-only Bribe deployment.                                                                        |
| `BribeRouter`       | Records every Strategy payment as a fixed, permissionlessly payable Fund liability.                     |
| `Bribe`             | Seven-day reward streams over virtual signal balances, with at most eight reward tokens.                |
| `Fund`              | Ownerless raw treasury, GBX burn boundary, and caller-selected in-kind redemption.                      |

Mine starts at one slot and can only grow to sixteen. A slot's assigned GBX/second rate never changes during that
miner's tenure. Capacity expansion and halving thresholds affect new occupations only. This deliberately prevents
governance or other users from diluting a miner after entry, while temporarily allowing aggregate issuance above the
current global rate until old slots turn over.

A nonempty-slot replacement makes 80% of its USDG payment claimable by the displaced miner and routes 20% through
ResonanceRouter. An empty slot routes 100%. There is no team fee. GBX has no protocol-defined economic supply cap, with
immutable cumulative-mining halvings for future handoffs and a positive tail; inherited ERC20Votes accounting retains
its `uint208` safety ceiling.

ResonanceRouter forwards every nonzero balance. Resonance streams it at `1e36` precision through one active seven-day
period and one aggregate successor. A live top-up cannot change the active rate or finish. Signal mutations checkpoint
the old interval first and assign any carry too small for the old index to an explicit Fund remainder.

Bribe applies the same denominator-boundary rule to independently notified rewards. Before virtual signal supply
changes, unindexable old-supply carry becomes fixed Fund precision; when an account fully exits, its sub-token user
remainder does likewise instead of being reallocated to remaining signalers.

## Fund redemption

`redeem(gbxAmount, receiver, tokens)` checkpoints every mining slot before calculating payouts, then uses one post-
checkpoint, pre-burn supply snapshot. EIP-1153 transient storage rejects duplicate selected assets without a registry.
The complete basket must also leave every selected address with at least its snapshot less its own payout, rejecting
different facades that debit one shared ledger. Omitted assets remain for the post-redemption supply.

## Administration

TimelockController owns Resonance and Mine. Its continuing surface is Resonance Strategy addition/removal and Bribe
reward registration, plus increase-only Mine capacity. Fund and LiquidityPosition are ownerless. There is no proxy,
migration, rescue, successor, emission setter, or capacity decrease.

## Credit

The core adapts give.fun, Liquid Signal Governance, and Farplace MineRig. Strategy's auction also credits Euler Fee
Flow. Exact repository pins and unresolved licensing status are recorded in `NOTICE`.
