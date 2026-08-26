# Signal and Resonance executable specification

Status: review target reconciled through ADR 0051 on 2026-08-26. ADR 0051's renamed scalar entrypoints, batch loops,
aggregate custody transitions, read Lens, SDK helpers, and subgraph position index are not covered by the received V12
export for `3ae171b`. Earlier focused ADR-0048 move and gas evidence predates this breaking change and cannot clear it.
The complete deterministic, integration, workspace, gas, mutation, and independent-review matrix requires a current
rerun. This is engineering evidence only: the external governance integration is unselected, and nothing is deployed
or authorized for user funds.

## SignalGBX state machine

`SignalGBX` is the only user-facing signal entry point. `addSignal` transfers GBX into custody, mints the same sGBX
amount, and adds the same account position to one live Strategy and its paired Bribe in one reverting transaction.
`removeSignal` removes one live or killed Strategy position, burns the same sGBX amount, and returns the same GBX
amount atomically. A holder without a delegate self-delegates on mint.

`addSignalMany` and `removeSignalMany` accept `Allocation[]`, where each entry contains `strategy` and `amount`. The add
path checked-sums, deposits, and mints the aggregate once before applying every addition. The remove path applies every
removal before burning and returning the aggregate once. Empty arrays and any zero amount revert; duplicates execute
sequentially; and any failed entry reverts the complete batch. Scalar removal remains the bounded fallback.

The runtime contains no `signal`, `signalWithPermit`, `moveSignal`, `withdrawSignal`, `stake`, `unstake`,
`stakeAndSignal`, `stakeAndSignalWithPermit`, idle-balance allocation, or `removeSignalAndUnstake` selector. sGBX
transfers are permanently disabled. Direct GBX donations to SignalGBX are surplus and create no receipt, signal, vote,
or withdrawal entitlement.

## Canonical identities

For every reachable state:

```text
SignalGBX.balanceOf(account)
  == sum(Bribe.signalWeightOf(account) for every registered Strategy, live or killed)

SignalGBX.totalSupply()
  == sum(Bribe.totalSignalWeight() for every registered Strategy, live or killed)

GBX.balanceOf(SignalGBX) >= SignalGBX.totalSupply()

Resonance.totalSignalWeight()
  == sum(Bribe.totalSignalWeight() for live Strategies only)
```

The paired Bribe owns account-by-Strategy balances and Strategy supply. SignalGBX owns aggregate account balance and
receipt supply. Resonance owns only the live aggregate. Only SignalGBX may invoke Resonance's retained add/remove
signal hooks; Resonance exposes no dedicated move hook.

No shared write-through Router can preserve this ownership model: SignalGBX intentionally treats `msg.sender` as the
GBX, sGBX, signal, and withdrawal account. Smart wallets may atomically bundle approval with direct SignalGBX calls.
`SignalPortfolioLens`, SDK reads, and subgraph `SignalPosition` records are replaceable discovery periphery; clients
must refresh canonical paired-Bribe and Strategy state onchain before constructing state-sensitive writes.

## Resonance revenue

Resonance is a USDG-only, virtual-staking Bribe derivative. Its schedule and per-Strategy accounting are scalar: there
is no reward-token registry, token-keyed revenue state, or redundant token parameter on revenue views. The canonical
deployment assumes six-decimal USDG, but the contracts account only in raw units and neither read nor enforce token
decimals. The period is exactly seven days, and the global revenue-per-signal index uses `1e36`. Each scalar or batch
entry checkpoints elapsed revenue under the old weights. Later entries in one transaction observe the same timestamp,
so no elapsed interval is reassigned between batch entries. A Strategy purchase calls
`Resonance.distributeRevenue(strategy)` before taking its USDG inventory snapshot.

The raw stream uses the ordinary Synthetix schedule. A notification during an active period combines the incoming
amount with `remainingSeconds * revenueRate`, divides the result by seven days, and restarts the period. There is no
front-loaded rate remainder. Rate flooring, global-index flooring, per-Strategy flooring, direct donations, and
revenue elapsed with zero live signal remain unallocated Resonance surplus. Distribution is permissionless, always
pays the fixed Strategy entitlement, clears its recorded claim before interaction, and uses `SafeERC20` under the
standard-token assumption.

ResonanceRouter retains its complete USDG balance below
`max(REWARD_DURATION, Resonance.remainingRevenue())`. Once the balance qualifies, any caller may invoke `route()` to
approve and notify the complete balance. Routing does not execute itself and has no role, bounty, or liveness
guarantee.

## Strategy lifecycle

Only live Strategies accept new signal. A killed Strategy is checkpointed, loses its complete weight from the live
denominator exactly once, earns no future Resonance revenue, and remains a valid scalar or batched removal source.
`liveStrategyCount` tracks registered live Strategies; killing the final live Strategy reverts.

The killed Strategy's paired Bribe is closed to new signal under ADR 0028, but not to reward funding. Incumbent
signalers may stay, claim, or remove signal, and new rewards remain permissionlessly notifiable while the token has
lifetime headroom. If the last signaler exits during an active stream, reward time continues at zero supply and the
later elapsed reward remains unallocated Bribe surplus. There is no queue, pause, retirement withdrawal, refund,
rescue, sweep, migration, Fund reclassification, or killed-Strategy escape hatch.

## Bribe rewards

Each paired Bribe maintains Resonance-controlled virtual signal weights and at most sixteen append-only reward tokens.
Every token has its own seven-day `periodFinish`, `rewardRate`, `lastUpdateTime`, and `rewardPerSignalStored` state. A
permissionless notification must be at least `REWARD_DURATION` raw units and at least the current `remainingReward`.
It
combines with `remainingSeconds * rewardRate`, applies ordinary integer division over seven days, and restarts the
period.

Reward time does not pause at zero supply and notifications do not queue. Rate, index, and account floors remain
unallocated Bribe balance; there are no carry buckets, exact-remainder schedules, Fund reward liabilities, or surplus
telemetry. `claimRewards(account)` is the bounded all-token convenience path. `claimReward(account, token)` checkpoints
and pays one token so an unrelated broken token does not block it; caller-selected batches are outside the core.

## Bribe reward lifetime bound

Each token/Bribe pair tracks a monotonic `lifetimeRewardNotified[token]`. Every successful automatic or independently
funded notification consumes this counter; claims, stream completion, zero signal supply, and Strategy death never
reduce it. Direct token donations to Bribe do not consume the counter because they never enter reward accounting.

With `P = REWARD_PRECISION = 1e36`, the immutable maximum is:

```text
MAX_LIFETIME_REWARD_AMOUNT = floor((2^256 - 1) / P)
lifetimeRewardNotified[token] <= MAX_LIFETIME_REWARD_AMOUNT
rewardPerSignalStored[token] <= lifetimeRewardNotified[token] * P
```

Before checkpointing or interacting with the reward token, `notifyReward` rejects any amount greater than the
remaining lifetime headroom with `RewardLifetimeCapExceeded`. Because one raw signal unit is the smallest nonzero
denominator, each admitted reward unit contributes at most `P` cumulative-index units. The limit therefore prevents a
claimed stream from reopening index-overflow capacity. At the cap, existing claims and signal removals remain
available; only later notifications for that token and Bribe fail. No current-balance scale guard, reset, setter, or
escape hatch exists.

## Acquired-asset settlement

Before any payment-token interaction, Strategy snapshots Resonance's global prospective rate. For one purchase amount
`a` and its snapshotted rate `r`:

```text
0 <= r <= 2,000
bribeAmount = floor(a * r / 10,000)
fundAmount  = a - bribeAmount
```

Strategy pulls the complete payment, transfers `fundAmount` directly to its immutable Fund, and transfers any nonzero
`bribeAmount` to its paired BribeRouter. Every purchase floors independently; there is no cumulative split carry and no
deferred Fund or Bribe liability. A failed Fund transfer reverts the complete purchase. A successful purchase is final
once Fund and the Bribe-only Router have received their respective amounts.

BribeRouter exposes only its paired Bribe, payment token, and permissionless `route()`. It buffers its complete balance
until that balance is at least the Bribe's `REWARD_DURATION` and `remainingReward` thresholds, then approves and
notifies the complete balance. A failed notification reverts only `route`, leaving the buffered balance retryable without
reverting the earlier Strategy purchase. Compatible direct donations join the next notification. At a 0% rate, the
complete purchase goes to Fund and BribeRouter receives nothing; independent Bribe funding and all signal operations
remain available.

The core creates, owns, and manages no liquidity position. A reviewed, externally created fungible Uniswap v2-style
USDG-GBX LP ERC-20 may be registered as an ordinary Strategy payment token and receives exactly the same Fund/Bribe
split and token handling as every other supported Strategy payment token.

## Governance boundary

The core contains no Governor or protocol Timelock. SignalGBX retains non-transferable ERC20Votes checkpoints, but the
core assigns them no proposal, quorum, delay, execution, or cancellation semantics. Resonance remains owner-gated for
`addStrategy`, `killStrategy`, `addBribeRewardToken`, and bounded global `setBribeBps`; inherited ownership transfer and
renunciation also remain. Mine has no administrative surface.

Production is blocked until a later ADR selects the exact external governance provider and release, verifies
SignalGBX compatibility, permissions, admin/upgrade and emergency paths, voting and execution behavior, and transfers
Resonance directly from the temporary setup owner to the reviewed external executor.

## Supported-token assumption

GBX, USDG, Strategy payment tokens, and owner-registered Bribe rewards must be conventional, non-rebasing ERC-20s whose
successful transfer moves the requested amount. Mine, SignalGBX, Strategy, Resonance,
ResonanceRouter, BribeRouter, and Bribe use
`SafeERC20` but do not duplicate sender/receiver balance checks or support fee-on-transfer, surcharge, rebasing,
shared-ledger, or mutable blocklist behavior. Those mechanics may revert, underfund accounting, consume surplus, or
make a registered market unusable; deployment and governance are responsible for admitting suitable assets. Fund
redemption alone retains exact payout deltas and basket guards because selected assets are arbitrary.

The Bribe lifetime limit is measured in raw units: at 18 decimals it is approximately `1.158e23` whole tokens, but
unusually high-decimal assets can reach it at a much smaller displayed amount. Broken Fund assets remain
caller-omittable. A broken Bribe reward token can be isolated with the scalar claim, while the all-token convenience
claim remains atomic and can be blocked by any included transfer failure; caller-selected batch claims belong in
periphery.
