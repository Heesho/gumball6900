# GUM BALL 6900 Economics

This document records the integer arithmetic implemented by the contracts. It is an accounting specification, not
a promise of market value, liquidity, yield, or profitable auction execution. All divisions round down unless a
ceiling is stated explicitly.

## Units

- GBX and sGBX use 18 decimals.
- Mining prices use 18-decimal USDG-per-GBX WAD values.
- Auction rates use human-normalized target tokens per USDG, scaled by 1e18. Shared decimal-aware math converts raw
  token amounts with ceil-on-quote and floor-on-clearing semantics.
- Vault custody and redemption always use each token's raw atomic units.
- Allocation and manager-reward indices use `1e27` precision.

No contract adds unlike assets into an onchain NAV. Any USD display value is non-authoritative presentation data.

## Lifetime supply

```text
totalSupply = cumulativeMinted - cumulativeBurned
cumulativeMinted <= 1,000,000,000 GBX
```

Every mint increments `cumulativeMinted`. Every burn increments `cumulativeBurned` and reduces `totalSupply`.
Burning never reduces `cumulativeMinted`, so it never creates new mint capacity.

## Sponsor-backed genesis

Let `C` be accepted community USDG, `M = 80,000,000 GBX`, and `L = 20,000,000 GBX`.

```text
genesisPrice = C / M
requiredSponsorUSDG = ceil(C * L / M)
```

Ceiling rounding is the smallest atomic sponsor amount satisfying:

```text
requiredSponsorUSDG * M >= C * L
```

The full `M + L` supply is minted atomically with the transfer of community and required sponsor USDG into
GumBallVault. The LP allocation therefore has the same claim value per GBX as the community allocation at the
genesis clearing price. Excess sponsor escrow is returned; a failed launch is refundable.

Genesis claims are claim-on-behalf and can be submitted individually or as a batch of at most 64 distinct
beneficiaries. Every transfer is fixed to the recorded beneficiary. A batch consumes all entitlements before making
payments, so a duplicate, zero-entitlement, expired, or otherwise invalid entry reverts every mutation and transfer.

## Recurring mining

The first post-genesis daily schedule is:

```text
427,181.096645855643 GBX
```

For each epoch, the next schedule is floor-rounded sequentially:

```text
nextScheduled = floor(currentScheduled * 0.999525354337060160)
```

The schedule advances on empty epochs. Unused scheduled emission is forfeited.

For a funded epoch:

```text
scheduled = min(currentScheduled, remaining lifetime mint capacity)
minimumPrice = max(1 atomic WAD unit, floor(referencePrice * 95%))
affordable = normalizedEpochUSDG / minimumPrice
actualEmission = min(scheduled, affordable)
```

If `affordable >= scheduled`, the clearing price is `normalizedEpochUSDG / scheduled`; otherwise it is the minimum
price. The one-unit lower bound matters only after an extreme empty-epoch tail and prevents a later funded epoch
from dividing by zero.

The reference update mirrors Solidity's two independent floors:

```text
rawNext = floor(previous * 80%) + floor(clearing * 20%)
next = clamp(rawNext, minimumPrice, floor(previous * 150%))
```

An empty or invalidated epoch moves directly to `minimumPrice`. This reference is endogenous mining history, not an
asset-price oracle.

Each beneficiary's claim is:

```text
floor(beneficiaryUSDG * actualEmission / totalEpochUSDG)
```

The complete emission is minted to MiningClaims at settlement. Per-user floor dust remains in that claims escrow
until the two-year expiry, when it is burned with every other unclaimed unit.

## Signals and virtual USDG budgets

sGBX is a non-transferable 1:1 receipt. New or increased signals activate after 24 hours; decreases and unstaking
reduce weight immediately after reward checkpointing.

AllocationVoter never holds USDG. When live weight is nonzero, a revenue notification updates a global index. The
implementation carries the exact scaled numerator remainder:

```text
baseDelta = floor(revenue * P / totalWeight)
combined = (revenue * P mod totalWeight) + previousScaledRemainder
indexDelta = baseDelta + floor(combined / totalWeight)
nextScaledRemainder = combined mod totalWeight
```

where `P = 1e27`. A strategy lazily realizes `weight * indexDelta / P`, with its own scaled remainder. With zero
live weight, revenue remains idle USDG and is not allocated retroactively. Physical USDG remains in GumBallVault
until a live strategy consumes its virtual budget during a valid fill.

## Acquisition and manager rewards

The reverse Dutch rate is target-token units per USDG. It begins at 125% of the reference, decays linearly for one
day, and stops at a nonzero 80% floor. Required target input rounds up so the taker cannot underpay by atomic dust.
The signed `maxTargetAmount` bounds both that quote and the taker's observed balance decrease, so a sender surcharge
limited to the pull cannot silently charge above the accepted maximum.

For actual observed target receipt `T`:

```text
managerAmount = floor(T * 2% )
vaultAmount = T - managerAmount
```

Assigning split dust to the vault guarantees managers never receive more than 2%. With zero active strategy weight,
ManagerRewards redirects its entire received share to GumBallVault. Both that redirect and every manager claim
require an exact observed receiver-balance increase and sender-balance decrease, so a token that later enables either
a receiver-deducted fee or sender-paid surcharge cannot silently consume the nominal reward liability. Acquisition
distribution applies the same two-sided check and also requires each observed vault and ManagerRewards delta to equal
its nominal 98/2 leg; offsetting transfer behavior cannot preserve the total while shifting value between recipients.

ManagerRewards uses the same scaled-numerator carry pattern as allocation. User accrual also carries a per-user
`1e27` fractional remainder, so repeated tiny rewards can eventually become claimable while manager weight remains
live. When the voter individually checkpoints and removes the final live weight, ManagerRewards fixes a terminal
remainder cycle. It retains the aggregate unpaid whole-token entitlement, clears notification and per-user fractional
carry for that cycle, and finalizes the residual whole-token dust into a generation-and-cycle queue without calling
the reward token. Therefore:

```text
notified rewards = cumulative whole-token entitlements + finalized terminal dust
finalized terminal dust = redirected terminal dust + pending terminal dust
accounted rewards >= aggregate unpaid whole-token entitlements + pending terminal dust
```

Anyone may sweep a nonzero queued amount, but the destination and amount are fixed by ManagerRewards: the complete
pending cycle amount goes to GumBallVault using the same exact debit and receipt checks as a claim. Pending dust stays
in `accountedRewards`, so it cannot be presented again as an unaccounted reward notification. A failed sweep leaves
the queue intact for retry and does not affect the already completed signal reset, vote change, or unstake. A zero-dust
terminal cycle creates no sweepable entry. A manager that later re-signals starts in a fresh remainder cycle and
cannot revive a fraction already finalized as dust. Only the immutable associated strategy can notify; arbitrary
bribes are not indexed.

Disabling a strategy closes its current ManagerRewards index before AllocationVoter increments the strategy
generation. The closed generation records its unresolved stored weight and defers terminal dust until every such
weight receives its final checkpoint. An uncheckpointed old signal settles only through that fixed terminal index,
even if the strategy is later reactivated and new managers earn rewards. This preserves latent whole claims without
letting stale weight or fractional carry cross a reactivation boundary. Once those checkpoints complete, the old
generation queues its terminal dust without introducing a reward-token dependency into the cleanup path.

## Redemption

For shares `x`, pre-burn supply `S`, and each registered raw vault balance `B[i]`:

```text
assetOut[i] = floor(B[i] * x / S)
```

`S` is total supply, not a circulating-supply estimate. It includes wallet, staking, claims, and liquidity-manager
balances. Outstanding virtual USDG budgets are scaled by `(S - x) / S` before GBX burns. Every registered asset
transfer is atomic and succeeds only when the vault debit and receiver credit both equal `assetOut[i]`; independent
floor dust stays in the vault for remaining holders. Strategy USDG release applies the same exact debit/credit rule
to the consumed virtual budget. A token that enables a receiver fee or sender surcharge after onboarding therefore
reverts the burn or fill instead of silently shifting value between redeemers, takers, or remaining holders.

## Buyback

BuybackBurnStrategy receives GBX, measures the actual balance increase, burns all of it, and only then releases its
budgeted USDG. It pays no manager reward.

```text
net supply change = newly emitted GBX - actually burned GBX
```

The contracts do not assert that a buyback is accretive because they do not calculate basket NAV. A buyback funded
by mining USDG has different economics from one funded by non-emission fees or external revenue, and the web app
must label that distinction.

## Oracleless risk

Oracleless removes an external price feed from mint, redemption, signal, and auction state transitions. It does not
guarantee fair execution. Mining references can lag, auction reference resets use bounded human review, market
makers may disappear, Uniswap liquidity can be thin, and external assets can depeg, freeze, or become untradeable.
The hard protocol exit is an in-kind pro-rata basket redemption when every registered token remains transferable.
