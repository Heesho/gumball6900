# Security invariants

This file defines the accounting identities used by the hardening tests. For Resonance, `P = 1e36`; for Bribe rewards,
`P = 1e18`. Quantities named `Scaled` already include their subsystem's precision unit.

## Supply and mining

```text
genesis mint = 20,000,000e18
totalSupply = lifetimeMinted - lifetimeBurned
pendingEmission = sum_live_slots((now - lastAccruedAt) * slot.ups)
effectiveTotalSupply = totalSupply + pendingEmission
```

`slot.ups` is written only when a slot receives a new miner. It is not rewritten by checkpointing, a cumulative-mining
threshold, a Fund redemption, or `increaseCapacity`. On a handoff, all old accrual is checkpointed first, then:

```text
newSlot.ups = globalUps(totalMinedAfterCheckpoint) / currentCapacity
```

For a positive nonempty-slot payment:

```text
previousMinerClaim = floor(price * 8,000 / 10,000)
routedRevenue = price - previousMinerClaim
Mine USDG balance = totalClaimable
```

For an empty slot, `routedRevenue = price`; for a zero-price handoff both values are zero. Every nonzero token movement
checks exact sender debit and receiver credit.

## Signals and virtual Bribe balances

```text
sum_strategy accountSignals[account][strategy] = accountSignalWeight[account]
sum_account accountSignals[account][strategy] = strategySignalWeight[strategy]
sum_strategy strategySignalWeight[strategy] = totalSignalWeight
Bribe(strategy).balanceOf(account) = accountSignals[account][strategy]
Bribe(strategy).totalSupply() = strategySignalWeight[strategy]
accountSignalWeight[account] <= SignalGBX.balanceOf(account)
```

Removing signal changes only accounting and virtual balances. Unallocated SignalGBX remains withdrawable even if a
fixed payout or reward token is blocked.

## Resonance USDG conservation

```text
accountedRevenueBalance * P
  = revenueStreamRemainingScaled
  + queuedRevenue * P
  + pendingRevenueScaled
  + indexedRevenueScaled
  + sum(strategyRevenueRemainder)
  + (totalClaimableRevenue + fundRevenueLiability) * P
  + fundRevenueRemainderScaled
```

`syncRevenue` moves only actual unaccounted surplus into this identity. Exact payouts reduce both balance and the
matching whole liability. Before any signal denominator change, pending carry that cannot be indexed under the old
weights is assigned to the Fund remainder; it cannot cross into later weights.

For every active stream:

```text
revenueStreamRateScaled > 0
revenueStreamFinish - revenueStreamLastUpdate <= 7 days
revenueStreamRemainingScaled = exact unreleased active amount
queuedRevenue = sum(nonzero notifications received during the active period)
active rate and finish are unchanged by a top-up
releasedScaled(duration) = scheduledRaw * P exactly
```

Elapsed revenue is checkpointed before a signal weight changes. `Strategy.buy` checkpoints and transfers its released
allocation before it snapshots auction inventory. In one block, newly notified revenue has zero elapsed stream time.
ResonanceRouter transfers every nonzero complete balance, and a Resonance checkpoint processes at most the active
stream and one successor.

## Bribe reward-token conservation

```text
accountedRewardBalance[token] * P
  = scheduledRewards[token] * P
  + queuedRewards[token] * P
  + pendingRewardScaled[token]
  + indexedRewardScaled[token]
  + sum_account userRewardRemainder[account][token]
  + accruedRewardLiability[token] * P
  + fundRewardLiability[token] * P
  + fundRewardRemainder[token]
```

Zero supply pauses stream boundaries. A live top-up queues instead of resetting the stream. Before virtual supply
changes, unindexable old-supply carry moves to the fixed Fund classification; a fully exiting account's sub-token
remainder does likewise. Claims clear only selected token liabilities.

## BribeRouter conservation

```text
accountedPaymentBalance = fundPaymentLiability
```

Direct donations remain unaccounted surplus. Auction payments never enter Bribe reward accounting.

## Fund and liquidity

Fund first checkpoints Mine, then every selected payout uses the same post-checkpoint, pre-burn supply and raw balance:

```text
payout(token) = floor(balanceBefore(token) * gbxAmount / totalSupplyBeforeBurn)
```

The checkpoint, GBX burn, and every selected transfer are atomic. Every successful redemption also satisfies:

```text
finalBalance(token) >= balanceBefore(token) - payout(token)
```

This basket-wide postcondition prevents distinct selected token addresses backed by one shared ledger from consuming
the same backing twice.

Every successful liquidity fee harvest satisfies:

```text
liquidityAfter = liquidityBefore
USDG balance after = 0; collected USDG = USDG routed through ResonanceRouter
GBX balance after = 0; collected GBX = GBX transferred to Fund and burned
```

No function transfers the canonical position NFT out or removes principal.
