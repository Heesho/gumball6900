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
SignalGBX.allocatedBalance(account) = accountSignalWeight(account)
sum_strategy Bribe(strategy).balanceOf(account) = SignalGBX.allocatedBalance(account)
sum_account accountSignals[account][strategy] = strategySignalWeight[strategy]
sum_live_strategies strategySignalWeight[strategy] = totalSignalWeight
Bribe(strategy).balanceOf(account) = accountSignals[account][strategy]
Bribe(strategy).totalSupply() = strategySignalWeight[strategy]
accountSignalWeight[account] <= SignalGBX.balanceOf(account)
```

Removing signal changes only accounting and virtual balances. Unallocated SignalGBX remains withdrawable even if a
fixed payout or reward token is blocked. A killed Strategy's recorded `strategySignalWeight` and paired Bribe supply
remain, but its balance is excluded from active `totalSignalWeight`.

SignalGBX is the only caller accepted by Resonance's `addSignalFor`, `removeSignalFor`, and `moveSignalFor`. SignalGBX
owns the aggregate allocation reservation; the paired Bribe owns account-by-Strategy and per-Strategy balances;
Resonance owns only the active live-Strategy total. Atomic combined workflows must produce the same final state as their
standalone stake, signal, remove, and unstake components.

## Governance authority

```text
Governor voting token = SignalGBX
Governor clock = blocknumber
Timelock proposers = {ProtocolGovernor}
allowed calls = {
  Resonance.addStrategy,
  Resonance.killStrategy,
  Resonance.addBribeReward,
  Mine.increaseCapacity
}
value for every allowed call = 0
executor msg.value = 0
```

The Governor's voting parameters, quorum percentage, Timelock, and two targets are immutable. Its generic relay and
Timelock replacement paths always revert. Open execution does not create proposal authority. A proposal may be
canceled by its proposer only while Pending; queued operations have no guardian or cancellation path.

## Resonance USDG solvency and surplus

Resonance intentionally uses a solvency inequality rather than exact carried accounting. Across every registered
Strategy at one block:

```text
scheduledRevenue = left(USDG)
previewedStrategyLiability = sum(earned(strategy, USDG))
USDG.balanceOf(Resonance)
  = scheduledRevenue + previewedStrategyLiability + surplus
surplus >= 0
```

`surplus` includes global-index and per-Strategy floors, emission elapsed while active signal supply was zero, and USDG
sent directly without a Router notification. It is neither a Strategy nor Fund liability and there is no synchronization,
recovery, or later-allocation path. Exact Strategy payouts reduce both the token balance and the matching whole reward.

For every active stream:

```text
periodFinish - mostRecentQualifyingNotification = 7 days
baseRateRaw = floor(scheduledRaw / 7 days)
rateRemainderRaw = scheduledRaw mod 7 days
releasedRaw(first x active seconds)
  = x * baseRateRaw + min(x, rateRemainderRaw)
releasedRaw(7 days) = scheduledRaw
```

During an active schedule, a Router balance below `left(USDG)` stays in ResonanceRouter and `route` returns zero. A
complete Router balance at least equal to `left(USDG)` is pulled exactly. Resonance checkpoints elapsed emission and
restarts a seven-day schedule whose amount is `routerBalance + leftBeforeNotification`; there is no successor queue.

For positive active signal supply, elapsed raw emission advances the global reward-per-signal index by
`floor(emittedRaw * P / totalSignalWeight)`. Strategy checkpointing accrues
`floor(strategyWeight * indexDelta / P)`. Neither floor retains a remainder. At zero active supply the index is unchanged
while stream time advances, so that elapsed emission enters `surplus`.

Elapsed revenue is checkpointed before a signal weight changes. `Strategy.buy` checkpoints and transfers its released
allocation before it snapshots auction inventory. In one block, newly notified revenue has zero elapsed stream time.

Killing a live Strategy checkpoints its whole accrued reward, preserves that claim, and subtracts its complete recorded
weight from active `totalSignalWeight`. The recorded account, Strategy, and Bribe balances remain. Later removals reduce
those three balances but do not subtract the already excluded weight from active `totalSignalWeight`; additions are
forbidden.

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
