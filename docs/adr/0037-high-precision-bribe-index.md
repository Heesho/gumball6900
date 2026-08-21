# ADR 0037: High-precision Bribe reward index

- Status: implemented in the development tree; independent review and deployment approval remain pending
- Date: 2026-08-21
- Supersedes: ADR 0035's `1e18` Bribe precision and corresponding numeric lifetime-notification cap
- Preserves: ADR 0027's old-denominator carry policy, ADR 0028's closed-pool behavior, ADR 0035's monotonic lifetime
  bound, exact raw stream remainders, selective claims, and the fixed eight-token limit

## Context

Bribe previously used `REWARD_PRECISION = 1e18` while virtual SignalGBX balances also use 18 decimals. With total signal
supply `S` and emitted raw reward amount `E`, its global reward-per-signal index advanced only when:

```text
E * REWARD_PRECISION >= S
```

If `W` whole sGBX was assigned to a Strategy, `S = W * 1e18`, so the minimum indexable reward was `W` raw reward units.
At five million sGBX this meant 5 whole units of a 6-decimal token or 0.05 units of an 8-decimal token. A completed
smaller stream remained accounted in `pendingRewardScaled`, but multiple signalers could not claim it. A later signal
deposit or withdrawal correctly prevented cross-denominator capture by classifying that complete pending amount to
Fund, which could redirect economically material low-decimal rewards away from the incumbent signalers.

The stream's quotient-plus-remainder schedule was already exact. The defect was index resolution, not rate scheduling,
token custody, or signal-exit liveness. Reading token-reported decimals would add an untrusted external dependency and
still require a safe maximum internal scale.

## Decision

Every Bribe uses one token-independent fixed precision:

```text
P = REWARD_PRECISION = 1e36
MAX_LIFETIME_REWARD_AMOUNT = floor((2^256 - 1) / P)
```

The existing monotonic `lifetimeRewardNotified[token]` check remains coupled to `REWARD_PRECISION`; increasing precision
therefore reduces the raw-unit lifetime cap from `max / 1e18` to `max / 1e36`. The cap is still approximately `1.158e41`
raw units: about `1.158e35` whole units for a 6-decimal token, `1.158e33` for an 8-decimal token, and `1.158e23` for an
18-decimal token.

Bribe does not call `decimals()` and does not rescale individual tokens. All registered standard, non-rebasing ERC-20s
share the same internal precision. Existing scaled fields and events retain their ABI types but now use `1e36` units.

For `W` whole sGBX, the minimum global indexable raw reward becomes:

```text
ceil((W * 1e18) / 1e36) = ceil(W / 1e18)
```

Thus one raw reward unit advances the global index for any Strategy with at most `1e18` whole sGBX of signal. A raw
unit may still be indivisible among multiple users. Such sub-raw entitlements remain in account-specific
`userRewardRemainder` and can combine with later rewards. If an account fully exits, its remaining sub-raw precision is
classified to Fund under ADR 0027; no later signaler receives it.

## Safety argument

For lifetime admitted raw rewards `N`, precision `P`, total signal supply `S`, and an account balance `b <= S`:

```text
pendingRewardScaled <= N * P <= type(uint256).max
rewardPerTokenStored <= N * P <= type(uint256).max
b * rewardDelta <= S * rewardDelta <= N * P <= type(uint256).max
```

The coupled lifetime cap therefore bounds active scaling, the cumulative index, and direct account multiplication. A
one-raw-unit signal supply still attains the worst-case cumulative-index bound, so `floor(max / P)` remains the largest
history-independent safe notification cap. Claims, Fund payments, stream restarts, zero supply, and Strategy death do
not reopen capacity.

## Consequences

- Realistic 6- and 8-decimal rewards no longer require economically large accumulation before multiple signalers can
  claim.
- Signal-supply changes classify only residual global precision smaller than one raw unit at ordinary supply sizes,
  rather than whole low-decimal tokens.
- Per-user sub-raw rounding remains unavoidable because ERC-20 balances are integers. It stays account-specific until
  later accrual or full exit.
- The lower lifetime cap remains far beyond plausible standard-token supply, but interfaces and monitoring must read
  the onchain constant rather than retain the ADR 0035 numeric value.
- The runtime bytecode and constant values change. The ABI shape, storage layout, authority graph, and governance
  surface do not.
- Production remains blocked pending complete testing, mutation analysis, independent review, and the other unresolved
  release gates.
