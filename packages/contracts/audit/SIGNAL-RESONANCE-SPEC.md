# Signal and Resonance executable specification

Status: implemented locally and reconciled through ADR 0048 on 2026-08-23. The focused migration suites pass 104/104,
covering the sixteen-token bound, composed remove-then-add move, rollback, checkpoint ordering, removed Resonance
selector, and maximum-bound gas. The largest focused measurement is 1,890,938 gas for a composed move with sixteen
active streams on both Bribes. The revised focused mutation campaign kills 47/47 mutants. The complete deterministic,
integration, and workspace matrix recorded for ADR 0047 predates ADR 0048 and requires rerun. This is engineering
evidence only: the external governance integration is unselected, and nothing is independently audited, deployed, or
authorized for user funds.

## SignalGBX state machine

`SignalGBX` is the only user-facing signal entry point. `signal` and `signalWithPermit` transfer an exact amount of GBX
into custody, mint the same sGBX amount, and add the same account position to one live Strategy and its paired Bribe in
one reverting transaction. A holder without a delegate self-delegates on mint. `moveSignal` calls
`Resonance.removeSignalFor` for the source and then `Resonance.addSignalFor` for the destination in one transaction;
destination failure rolls back the removal. A successful move changes the source and destination Bribe positions
without changing custody, sGBX supply, or voting units. `withdrawSignal` removes one Strategy position, burns the same
sGBX amount, and returns the same GBX amount atomically.

The runtime contains no `stake`, `unstake`, `stakeAndSignal`, `stakeAndSignalWithPermit`, idle-balance `signal`,
`removeSignal`, or `removeSignalAndUnstake` selector. sGBX transfers are permanently disabled. Direct GBX donations to
SignalGBX are surplus and create no receipt, signal, vote, or withdrawal entitlement.

## Canonical identities

For every reachable state:

```text
SignalGBX.balanceOf(account)
  == sum(Bribe.balanceOf(account) for every registered Strategy, live or killed)

SignalGBX.totalSupply()
  == sum(Bribe.totalSupply() for every registered Strategy, live or killed)

GBX.balanceOf(SignalGBX) >= SignalGBX.totalSupply()

Resonance.totalSignalWeight()
  == sum(Bribe.totalSupply() for live Strategies only)
```

The paired Bribe owns account-by-Strategy balances and Strategy supply. SignalGBX owns aggregate account balance and
receipt supply. Resonance owns only the live aggregate. Only SignalGBX may invoke Resonance's retained add/remove
signal hooks; Resonance exposes no dedicated move hook.

## Resonance rewards

Resonance is a USDG-only, virtual-staking Bribe derivative. Its schedule and per-Strategy accounting are scalar: there
is no reward-token registry, token-keyed reward state, or redundant token parameter on reward views. USDG is six
decimals, the period is exactly seven days, and the global reward-per-signal index uses `1e36`. Each signal change
checkpoints elapsed revenue under the old weights. In a move, source removal checkpoints before removal and destination
addition checkpoints before addition; no time elapses between the calls. A Strategy purchase calls
`Resonance.distribute(strategy)` before taking its USDG inventory snapshot.

The raw stream uses the ordinary Synthetix schedule. A notification during an active period combines the incoming
amount with `remainingSeconds * rewardRate`, divides the result by seven days, and restarts the period. There is no
front-loaded rate remainder. Rate flooring, global-index flooring, per-Strategy flooring, direct donations, and
revenue elapsed with zero live signal remain unallocated Resonance surplus. Distribution is permissionless, always
pays the fixed Strategy entitlement, clears its recorded claim before interaction, and uses `SafeERC20` under the
standard-token assumption.

ResonanceRouter retains its complete USDG balance below `max(DURATION, Resonance.left())`. Once the balance qualifies,
any caller may invoke `route()` to approve and notify the complete balance. Routing does not execute itself and has no
role, bounty, or liveness guarantee.

## Strategy lifecycle

Only live Strategies accept new signal or a move destination. A killed Strategy is checkpointed, loses its complete
weight from the live denominator exactly once, earns no future Resonance revenue, and remains a valid move source and
withdrawal source. `liveStrategyCount` tracks registered live Strategies; killing the final live Strategy reverts.

The killed Strategy's paired Bribe remains a closed reward pool under ADR 0028. Incumbent signalers may stay, claim,
move, or withdraw, and new rewards remain permissionlessly notifiable while the token has lifetime headroom. If the
last signaler exits during an active stream, reward time continues at zero supply and the later elapsed reward remains
unallocated Bribe surplus. There is no queue, pause, retirement withdrawal, refund, rescue, sweep, migration, Fund
reclassification, or killed-Strategy escape hatch.

## Bribe rewards

Each paired Bribe maintains Resonance-controlled virtual balances and at most sixteen append-only reward tokens. Every
token has its own seven-day `periodFinish`, `rewardRate`, `lastUpdateTime`, and `rewardPerTokenStored` state. A
permissionless notification must be at least `REWARD_DURATION` raw units and at least the current `left` amount. It
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
rewardPerTokenStored[token] <= lifetimeRewardNotified[token] * P
```

Before checkpointing or interacting with the reward token, `notifyRewardAmount` rejects any amount greater than the
remaining lifetime headroom with `RewardLifetimeCapExceeded`. Because one raw signal unit is the smallest nonzero
denominator, each admitted reward unit contributes at most `P` cumulative-index units. The limit therefore prevents a
claimed stream from reopening index-overflow capacity. At the cap, existing claims, moves, and withdrawals remain
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

BribeRouter exposes only its paired Bribe, payment token, and permissionless `distribute()`. It buffers its complete
balance until that balance is at least the Bribe's duration and active-left thresholds, then approves and notifies the
complete balance. A failed notification reverts only `distribute`, leaving the buffered balance retryable without
reverting the earlier Strategy purchase. Compatible direct donations join the next notification. At a 0% rate, the
complete purchase goes to Fund and BribeRouter receives nothing; independent Bribe funding and all signal operations
remain available.

## Governance boundary

The core contains no Governor or protocol Timelock. SignalGBX retains non-transferable ERC20Votes checkpoints, but the
core assigns them no proposal, quorum, delay, execution, or cancellation semantics. Resonance remains owner-gated for
`addStrategy`, `killStrategy`, `addBribeReward`, and bounded global `setBribeBps`; inherited ownership transfer and
renunciation also remain. Mine has no administrative surface.

Production is blocked until a later ADR selects the exact external governance provider and release, verifies
SignalGBX compatibility, permissions, admin/upgrade and emergency paths, voting and execution behavior, and transfers
Resonance directly from the temporary setup owner to the reviewed external executor.

## Supported-token assumption

USDG, Strategy payment tokens, and owner-registered Bribe rewards must be conventional, non-rebasing ERC-20s whose
successful transfer moves the requested amount. Strategy, Resonance, ResonanceRouter, BribeRouter, and Bribe use
`SafeERC20` but do not duplicate sender/receiver balance checks or support fee-on-transfer, surcharge, rebasing,
shared-ledger, or mutable blocklist behavior. Those mechanics may revert, underfund accounting, consume surplus, or
make a registered market unusable; governance is responsible for admitting suitable assets. Mine, SignalGBX, Fund
redemption, and LiquidityPosition retain their separate custody-critical exact-delta checks.

The Bribe lifetime limit is measured in raw units: at 18 decimals it is approximately `1.158e23` whole tokens, but
unusually high-decimal assets can reach it at a much smaller displayed amount. Broken Fund assets remain
caller-omittable. A broken Bribe reward token can be isolated with the scalar claim, while the all-token convenience
claim remains atomic and can be blocked by any included transfer failure; caller-selected batch claims belong in
periphery.
