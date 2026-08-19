# Signal and Resonance executable specification

Status: implemented locally on 2026-08-16 and reconciled for ADRs 0034 and 0035 on 2026-08-19; engineering evidence
only. The external governance integration is unselected, current-tree gates require rerun, and nothing is
independently audited, deployed, or authorized for user funds.

## SignalGBX state machine

`SignalGBX` is the only user-facing signal entry point. `signal` and `signalWithPermit` transfer an exact amount of GBX
into custody, mint the same sGBX amount, and add the same account position to one live Strategy and its paired Bribe in
one reverting transaction. A holder without a delegate self-delegates on mint. `moveSignal` changes the source and
destination Bribe positions without changing custody, sGBX supply, or voting units. `withdrawSignal` removes one
Strategy position, burns the same sGBX amount, and returns the same GBX amount atomically.

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
receipt supply. Resonance owns only the live aggregate. Only SignalGBX may invoke Resonance signal hooks.

## Resonance rewards

Resonance is a single-token, virtual-staking Bribe derivative. USDG is six decimals, the period is exactly seven days,
and the global reward-per-signal index uses `1e36`. Each signal change checkpoints elapsed revenue under the old
weights. A move checkpoints both Strategies before either Bribe balance changes. A Strategy purchase calls
`Resonance.distribute(strategy)` before taking its USDG inventory snapshot.

The raw stream schedules `quotient * 7 days + remainder`; remainder units are front-loaded one per second. A qualifying
active-period reset checkpoints the old period and schedules the incoming amount plus the exact amount left. Global
index flooring, per-Strategy flooring, direct donations, and revenue elapsed with zero live signal remain accepted
Resonance surplus. Distribution is permissionless but always pays the Strategy and clears its recorded claim before
the exact transfer.

## Strategy lifecycle

Only live Strategies accept new signal or a move destination. A killed Strategy is checkpointed, loses its complete
weight from the live denominator exactly once, earns no future Resonance revenue, and remains a valid move source and
withdrawal source. `liveStrategyCount` tracks registered live Strategies; killing the final live Strategy reverts.

The killed Strategy's paired Bribe remains a closed reward pool under ADR 0028. Incumbent signalers may stay, claim,
move, or withdraw, and new rewards remain permissionlessly notifiable while the token has lifetime headroom. If the
last signaler exits with active or queued rewards, those rewards can remain permanently unreachable. There is no
retirement withdrawal, refund, rescue, sweep, migration, or killed-Strategy escape hatch.

## Bribe reward lifetime bound

Each token/Bribe pair tracks a monotonic `lifetimeRewardNotified[token]`. Every successful automatic or independently
funded notification consumes this counter; claims, Fund classification and payment, stream completion, zero signal
supply, and Strategy death never reduce it. Direct token donations do not consume the counter because they never enter
reward accounting.

With `P = REWARD_PRECISION = 1e18`, the immutable maximum is:

```text
MAX_LIFETIME_REWARD_AMOUNT = floor((2^256 - 1) / P)
lifetimeRewardNotified[token] <= MAX_LIFETIME_REWARD_AMOUNT
rewardPerTokenStored[token] <= lifetimeRewardNotified[token] * P
```

Before checkpointing or interacting with the reward token, `notifyRewardAmount` rejects any amount greater than the
remaining lifetime headroom with `RewardLifetimeCapExceeded`. Because one raw signal unit is the smallest nonzero
denominator, each admitted reward unit contributes at most `P` cumulative-index units. The limit therefore prevents a
claimed or Fund-paid current balance from reopening index-overflow capacity. At the cap, existing claims, moves, and
withdrawals remain available; only later notifications for that token and Bribe fail. The current-accounted-balance
scale check remains defense in depth.

## Acquired-asset settlement

Every Strategy payment is pulled once by its immutable BribeRouter and cumulatively classified as:

```text
bribe cumulative entitlement = floor(cumulative payment * 1,000 / 10,000)
Fund cumulative entitlement   = cumulative payment - bribe cumulative entitlement
```

`splitRemainder` retains the basis-point numerator remainder, making the result independent of fill partitioning.
Fund and Bribe liabilities are fixed, separately permissionless to settle, cleared before interaction, and restored by
transaction rollback on failure. The Bribe leg notifies the acquired asset as a reward. Direct Router donations are
surplus and cannot satisfy or enlarge either liability. If the Bribe's lifetime cap rejects an automatic notification,
the Router retains that exact Bribe liability; its independent Fund liability remains settleable.

## Governance boundary

The core contains no Governor or protocol Timelock. SignalGBX retains non-transferable ERC20Votes checkpoints, but the
core assigns them no proposal, quorum, delay, execution, or cancellation semantics. Resonance remains owner-gated for
`addStrategy`, `killStrategy`, and `addBribeReward`; inherited ownership transfer and renunciation also remain. Mine
has no administrative surface.

Production is blocked until a later ADR selects the exact external governance provider and release, verifies
SignalGBX compatibility, permissions, admin/upgrade and emergency paths, voting and execution behavior, and transfers
Resonance directly from the temporary setup owner to the reviewed external executor.

## Supported-token assumption

GBX, USDG, Strategy payment tokens, and owner-registered Bribe rewards must be conventional, non-rebasing ERC-20s with
exact observable debits and credits. Exact-delta guards reject fee, surcharge, missing-balance, and other asymmetric
behavior. The lifetime limit is measured in raw units: at 18 decimals it is approximately `1.158e41` whole tokens, but
unusually high-decimal assets can reach it at a much smaller displayed amount. Broken Fund assets remain
caller-omittable; broken reward tokens retain scalar/selective claim paths, but freeze, blocklist, rebase, and other
nonconventional behavior remains unsupported.
