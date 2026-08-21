# Security invariants

This file defines the accounting identities used by the hardening tests. For Resonance and Bribe rewards, `P = 1e36`.
Quantities named `Scaled` already include their subsystem's precision unit.

> ADRs 0031, 0034, 0036, and 0037 make the SignalGBX, BribeRouter, Bribe lifetime bound, and external-governance
> boundary below authoritative. Governance execution remains unselected and contributes no production invariant until
> separately reviewed.

## Supply and mining

```text
genesis mint = 20,000,000e18
totalSupply = lifetimeMinted - lifetimeBurned
aggregateTps = sum_slots(slot.tps)
pendingEmission = storedPendingEmission + (now - pendingUpdatedAt) * aggregateTps
pendingEmission = sum_slots((now - lastAccruedAt) * slot.tps)
effectiveTotalSupply = totalSupply + pendingEmission
```

`slot.tps` is written only when a slot receives a new miner. It is not rewritten by a cumulative-mining threshold or a
Fund redemption. On a handoff, only the outgoing slot is settled, then:

```text
newSlot.tps = globalTps(totalMined + pendingEmission) / 16
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
SignalGBX.balanceOf(account) = accountSignalWeight(account)
sum_strategy Bribe(strategy).balanceOf(account) = SignalGBX.balanceOf(account)
sum_strategy Bribe(strategy).totalSupply() = SignalGBX.totalSupply()
GBX.balanceOf(SignalGBX) >= SignalGBX.totalSupply()
sum_account accountSignals[account][strategy] = strategySignalWeight[strategy]
sum_live_strategies strategySignalWeight[strategy] = totalSignalWeight
Bribe(strategy).balanceOf(account) = accountSignals[account][strategy]
Bribe(strategy).totalSupply() = strategySignalWeight[strategy]
```

Every successful `signal` or `signalWithPermit` deposits exact GBX, mints the same SignalGBX amount, and creates the
same Strategy and Bribe position atomically. Every successful `withdrawSignal` removes the same position, burns the
same SignalGBX amount, and returns exact GBX atomically. `moveSignal` changes neither escrow custody, SignalGBX supply,
nor voting units. Excess escrow GBX is unsolicited surplus and creates no receipt, signal, or withdrawal entitlement.
A killed Strategy's recorded `strategySignalWeight` and paired Bribe supply remain, but its balance is excluded from
active `totalSignalWeight` and remains movable out or withdrawable.

SignalGBX is the only caller accepted by Resonance's `addSignalFor`, `removeSignalFor`, and `moveSignalFor`. SignalGBX
balance owns the aggregate signal; the paired Bribe owns account-by-Strategy and per-Strategy balances; Resonance owns
only the active live-Strategy total. A separate `allocatedBalance`, standalone stake/unstake state, or intermediate idle
receipt is forbidden.

Before the first Strategy is registered, `liveStrategyCount = 0` and new signal is impossible. After registration:

```text
liveStrategyCount >= 1
liveStrategyCount = sum_strategy(isStrategyAlive(strategy) ? 1 : 0)
```

Killing the final live Strategy reverts. Adding a replacement before killing the old Strategy preserves the invariant;
whether an external governance system can batch those calls atomically remains an unselected integration property.

## Governance authority

```text
in-repository Governor = none
in-repository Timelock = none
SignalGBX IVotes clock = blocknumber
continuing Resonance owner calls = {
  Resonance.addStrategy,
  Resonance.killStrategy,
  Resonance.addBribeReward,
  Resonance.setBribeBps
}
inherited Resonance owner calls = {
  transferOwnership,
  renounceOwnership
}
```

SignalGBX retains non-transferable ERC20Votes checkpoints, but the core assigns them no proposal threshold, quorum,
voting period, permission, batching, delay, cancellation, or execution semantics. The external Resonance owner remains
unselected; deployment is blocked until a later ADR pins and reviews that integration and its ownership handoff.
`setBribeBps` is globally bounded and satisfies:

```text
BPS = 10,000
DEFAULT_BRIBE_BPS = 1,000
0 <= bribeBps <= MAX_BRIBE_BPS = 2,000
fundBps = BPS - bribeBps
```

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
forbidden. The transition also decrements `liveStrategyCount` and reverts if the Strategy is the final live one.

## Bribe reward-token conservation

For Bribe precision `P = 1e36`, every token in every Bribe satisfies:

```text
0 <= lifetimeRewardNotified[token] <= floor(type(uint256).max / P)
previewedRewardPerToken[token] <= lifetimeRewardNotified[token] * P <= type(uint256).max
```

Every accepted notification adds its raw amount to `lifetimeRewardNotified`; claims, Fund classification, and later
balance changes never decrease it. Direct donations do not count because Bribe never indexes them. An over-cap amount
reverts before reward checkpointing or token transfer, so the rejection cannot mutate a stream or gate a signal exit.

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
BPS = 10,000
0 <= appliedBribeBps_i <= 2,000
weightedBribeNumerator = sum_i(strategyPayment_i * appliedBribeBps_i)

cumulativeBribeClassification
  = floor(weightedBribeNumerator / BPS)
cumulativeFundClassification
  = sum_i(strategyPayment_i) - cumulativeBribeClassification
splitRemainder
  = weightedBribeNumerator mod BPS

accountedPaymentBalance
  = fundPaymentLiability + bribeRewardLiability
```

Equivalent partitions classified at the same applied rate produce identical cumulative classifications. A rate change
does not mutate `splitRemainder` or either outstanding liability. A zero-rate payment adds no weighted numerator,
creates no Bribe liability, and leaves prior remainder unchanged. `payFundPayment` consumes only the fixed Fund
liability; `notifyBribeReward` consumes only the fixed Bribe liability and schedules the acquired payment asset in the
paired Bribe. A zero liability returns without making a zero reward notification. Failure preserves the affected
liability and cannot change or consume the other. Direct donations remain unaccounted surplus and alter neither
liabilities nor split remainder. If the paired Bribe's lifetime cap for the payment token is exhausted, the automatic
Bribe liability remains in BribeRouter and its Fund liability remains independently payable.

Signal and exit liveness is independent of `bribeBps`: `signal`, `signalWithPermit`, `moveSignal`, and
`withdrawSignal` do not require a new automatic liability or settlement of an acquired payment token. This remains
true at 0% and for killed-Strategy exits.

## Fund and liquidity

Fund first reads Mine's effective supply, then every selected payout uses the same effective pre-burn supply and raw
balance:

```text
payout(token) = floor(balanceBefore(token) * gbxAmount / totalSupplyBeforeBurn)
```

The GBX burn and every selected transfer are atomic. Every successful redemption also satisfies:

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
