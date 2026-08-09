# Security invariants

This file defines the accounting identities used by the production-hardening tests. `P` is `1e18`. Quantities named
`Scaled` are already in precision units; whole-token liabilities are multiplied by `P` in the identity.

## Supply and emission

```text
GBX lifetimeMinted <= 1,000,000,000e18
remaining lifetime mint capacity = MAX_LIFETIME_MINT - lifetimeMinted
burning never increases remaining lifetime mint capacity
genesis mint = 20,000,000e18
Fundraiser capacity = 980,000,000e18
```

Fundraiser settlement is sequential. Each ended day applies exactly one floor-rounded multiplication by
`0.999525354337060160`; an empty epoch advances the schedule and forfeits that day without carry.

## Signals and virtual Bribe balances

```text
sum_strategy accountSignals[account][strategy] = accountSignalWeight[account]
sum_account accountSignals[account][strategy] = strategySignalWeight[strategy]
sum_strategy strategySignalWeight[strategy] = totalSignalWeight
Bribe(strategy).balanceOf(account) = accountSignals[account][strategy]
Bribe(strategy).totalSupply() = strategySignalWeight[strategy]
accountSignalWeight[account] <= SignalGBX.balanceOf(account)
```

Removing signal changes only accounting and the Resonance-created Bribe's virtual balance. It does not transfer USDG,
a Strategy payment token, or a reward token. Unallocated SignalGBX can therefore be unstaked immediately even if a
fixed payout token is blocked.

## Resonance USDG conservation

For all registered Strategies:

```text
accountedRevenueBalance * P
  = pendingRevenueScaled
  + indexedRevenueScaled
  + sum(strategyRevenueRemainder)
  + (totalClaimableRevenue + fundRevenueLiability) * P
```

`unaccountedRevenue = actual USDG balance - accountedRevenueBalance`. `syncRevenue` moves only that surplus into the
identity. A Strategy or Fund payout reduces both `accountedRevenueBalance` and the matching whole liability exactly.

## Bribe reward-token conservation

For each registered token, including all account remainders in the test/model state:

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

An exact stream of `A` units emits `floor(A / 604800)` each second plus one additional unit during its first
`A mod 604800` seconds. Zero supply pauses all stream boundaries. A notification behind an active stream queues rather
than resetting it. A completed exact claim clears only the selected token liability.

## BribeRouter conservation

```text
accountedPaymentBalance = fundPaymentLiability
```

Direct donations are `actual balance - accountedPaymentBalance` and are not silently assigned to Fund. Auction
payments never enter Bribe accounting.

## Fund and liquidity

Every selected Fund payout uses the same pre-burn supply and pre-transfer balance snapshot:

```text
payout(token) = floor(balanceBefore(token) * gbxAmount / totalSupplyBeforeBurn)
```

The GBX burn and every selected transfer are atomic. LiquidityPosition only accepts its exact precommitted hookless
NFT and range. Every successful compound satisfies:

```text
liquidityAfter >= liquidityBefore + floor(liquidityBefore * 20 / 10000)
```

No function transfers the position NFT out or removes principal.
