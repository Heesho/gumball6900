# Security invariants

This file defines the accounting identities used by the hardening tests. For Resonance and Bribe rewards, `P = 1e36`.
Quantities named `Scaled` already include their subsystem's precision unit.

> ADRs 0031, 0034, 0035, 0037, 0047, and 0048 make the SignalGBX, Bribe, Strategy settlement, and external-governance
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

`slot.tps` is written only when a slot receives a new miner. It is not rewritten by a time-based halving boundary or a
Fund redemption. On a handoff, only the outgoing slot is settled, then:

```text
newSlot.tps = globalTps(now - startTime) / 16
```

For a positive nonempty-slot payment:

```text
previousMinerClaim = floor(price * 8,000 / 10,000)
routerDeposit = price - previousMinerClaim
Mine USDG balance = totalClaimable
```

For an empty slot, `routerDeposit = price`; for a zero-price handoff both values are zero. Every nonzero token movement
checks exact sender debit and receiver credit. The deposit is Mine's terminal revenue action: a later permissionless
`ResonanceRouter.route()` call is neither part of nor a precondition for the handoff.

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

SignalGBX is the only caller accepted by Resonance's `addSignalFor` and `removeSignalFor`. Its public `moveSignal`
atomically calls removal for the source and addition for the destination; Resonance has no dedicated move hook, and a
failed addition rolls back the removal. SignalGBX balance owns the aggregate signal; the paired Bribe owns
account-by-Strategy and per-Strategy balances; Resonance owns only the active live-Strategy total. A separate
`allocatedBalance`, standalone stake/unstake state, or intermediate idle receipt is forbidden.

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
scheduledRevenue = left()
previewedStrategyLiability = sum(earned(strategy))
USDG.balanceOf(Resonance)
  = scheduledRevenue + previewedStrategyLiability + surplus
surplus >= 0
```

`surplus` includes global-index and per-Strategy floors, emission elapsed while active signal supply was zero, and USDG
sent directly without a Router notification. It is neither a Strategy nor Fund liability and there is no synchronization,
recovery, or later-allocation path. Strategy payouts reduce both the token balance and the matching whole reward.

For every active stream:

```text
periodFinish - mostRecentQualifyingNotification = 7 days
baseRateRaw = floor(scheduledRaw / 7 days)
rateRemainderRaw = scheduledRaw mod 7 days
releasedRaw(first x active seconds)
  = x * baseRateRaw
releasedRaw(7 days) = scheduledRaw - rateRemainderRaw
```

ResonanceRouter forwards only when its complete balance is at least `max(DURATION, left())`; otherwise `route` returns
zero. Resonance checkpoints elapsed emission and restarts a seven-day schedule at
`floor((routerBalance + leftBeforeNotification) / DURATION)`. The division remainder remains surplus.

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

Every accepted notification adds its raw amount to `lifetimeRewardNotified`; claims and later
balance changes never decrease it. Direct donations do not count because Bribe never indexes them. An over-cap amount
reverts before reward checkpointing or token transfer, so the rejection cannot mutate a stream or gate a signal exit.

```text
scheduledReward[token] = left(token)
previewedAccountRewards[token] = sum_account earned(account, token)
ERC20(token).balanceOf(Bribe)
  = scheduledReward[token] + previewedAccountRewards[token] + surplus[token]
surplus[token] >= 0
```

Notifications must satisfy `amount >= REWARD_DURATION` and `amount >= left(token)`. A valid notification checkpoints
the current index, pulls the standard token, and sets
`rewardRate = floor((amount + leftBeforeNotification) / REWARD_DURATION)`. Stream time continues at zero supply.
Rate, global-index, and account floors remain surplus; there are no queue, pause, carry, or Fund-reward buckets.

All-token claims are atomic across the registered set. Scalar claims touch only one token and therefore preserve
claim liveness when another registered token fails.

## Strategy settlement and BribeRouter buffering

```text
BPS = 10,000
0 <= appliedBribeBps <= 2,000
bribeAmount = floor(strategyPayment * appliedBribeBps / BPS)
fundAmount = strategyPayment - bribeAmount
strategyPayment = fundAmount + bribeAmount
```

Strategy snapshots `appliedBribeBps` before payment-token interaction, pulls the payment, transfers `fundAmount`
directly to Fund, and transfers nonzero `bribeAmount` to BribeRouter. There is no split carry or deferred Fund
liability; different payment partitions may differ by sub-token flooring. A failed Fund transfer reverts the purchase.

BribeRouter's complete compatible-token balance is the next candidate notification, including direct donations. Its
`distribute` operation returns zero until that balance is at least both `REWARD_DURATION` and the Bribe's `left` amount.
A failed notification reverts without moving the balance; a successful notification leaves the Router empty.

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
