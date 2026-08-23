# ADR 0035: Cap lifetime Bribe reward notifications

- Status: lifetime-cap design retained; numeric `1e18` precision and cap superseded by ADR 0037; not independently
  audited or deployed; not approved for user funds; inherited eight-token loop references are superseded by ADR 0048
- Date: 2026-08-19
- Builds on: ADR 0020's exact Bribe accounting and ADR 0027's signal-supply carry boundaries
- Preserves: ADR 0028's closed reward-pool behavior after Strategy death

## Context

Each Bribe uses a cumulative `1e18`-scaled reward-per-signal index for every registered reward token. The prior overflow
guard bounded only the token's currently accounted balance. Claims and Fund payments reduced that balance, but they did
not reduce the lifetime cumulative index.

A token with an extremely large raw-unit supply could therefore fill the index close to `uint256` maximum, complete
the stream, reclaim the reward, and then notify another small stream. Its next checkpoint would overflow the cumulative
index. Because every signal deposit, move, and withdrawal checkpoints all registered tokens, the persistent overflowing
schedule could prevent signalers from recovering escrowed GBX.

Ordinary 18-decimal tokens cannot practically reach the required amount. Freely mintable, upgradeable, or unusually
high-decimal tokens make the raw-unit boundary a credible defensive concern once registered.

## Decision

For each reward token in each Bribe, maintain a monotonic `lifetimeRewardNotified` counter. Every successful automatic
or independently funded call to `notifyRewardAmount` consumes the same counter. Claims, Fund classification, Fund
payments, stream completion, Strategy death, and a return to zero signal supply never reduce it.

The immutable maximum is:

```text
P = REWARD_PRECISION = 1e18
MAX_LIFETIME_REWARD_AMOUNT = floor((2^256 - 1) / P)
```

Before checkpointing or interacting with the reward token, reject a notification when:

```text
amount > MAX_LIFETIME_REWARD_AMOUNT - lifetimeRewardNotified[token]
```

The rejection uses `RewardLifetimeCapExceeded` and leaves the caller's tokens, all Bribe schedules, and every liability
unchanged. Direct token donations do not consume the cap because they never enter the reward index.

No unchecked index wrapping, epoch reset, retirement withdrawal, rescue path, or killed-Strategy escape hatch is
introduced.

## Safety argument

One admitted raw reward unit contributes at most `P` scaled units to the global accounting. The smallest possible
virtual supply is one raw signal unit, so the worst case gives the complete scaled amount to the cumulative index.
With lifetime notifications `N`:

```text
rewardPerTokenStored <= N * P
N <= floor((2^256 - 1) / P)
```

Therefore the stored and previewed cumulative index remain representable. A one-unit virtual supply attains this
bound, so the selected cap is also the largest history-independent limit that is safe for arbitrary supply changes.

## Consequences

- Existing rewards, claims, signal moves, and withdrawals remain available after the cap is reached; only new
  notifications for that token and Bribe are rejected.
- At 18 decimals, the cap is approximately `1.158e41` whole tokens and is not a practical constraint for a conventional
  honest asset. The limit is intentionally measured in raw units and can constrain unusually high-decimal tokens.
- If an automatic Strategy-payment reward reaches the cap, its BribeRouter preserves the unpaid Bribe liability. Its
  Fund liability remains independently settleable. No value is silently consumed or redirected.
- A Strategy can be killed and a replacement created through the ordinary lifecycle, but the protocol adds no special
  migration or recovery authority for a capped Bribe.
- The existing current-balance scale check remains as defense in depth. Direct donations remain unaccounted surplus.
- Notification adds one monotonic storage update. The fixed eight-token checkpoint loop and signal-exit path do not add
  new work.
