# ADR 0036: Governed global acquired-asset Bribe share

- Status: partially superseded by ADR 0047; the bounded global prospective rate remains, while weighted carry and
  deferred settlement are historical. ADR 0051 supersedes the signal-function names below; independent review and
  deployment approval remain pending
- Date: 2026-08-21
- Supersedes: ADR 0032's immutable 90% Fund / 10% paired-Bribe classification and ADR 0034's three-method continuing
  Resonance administration list
- Preserves: 100% of earned USDG flowing from Resonance to the entitled Strategy, acquired-payment-asset rewards,
  Fund-held GBX burning, the Bribe reward-token cap, and independently funded additional Bribe rewards

## Context

ADR 0032 fixed every Strategy acquisition payment at 90% Fund and 10% paired Bribe. That rule is simple, but it gives
the protocol no way to test or adapt the automatic signaler incentive without replacing the core contracts. The
desired operating range includes disabling only the automatic auction-funded reward, retaining the original 10%, and
experimenting with intermediate or higher rates such as 5% and 20%.

The rate must not become a per-Strategy favoritism lever, retroactively reclassify completed payments, or make signal
entry and exit depend on whether a Bribe reward is currently being funded. It must also retain exact cumulative
rounding across rate changes so governance cannot create or erase value by changing the rate or payment frequency.

## Decision

### One global prospective rate

Resonance stores the single automatic acquired-asset Bribe rate used by every registered Strategy and BribeRouter:

```solidity
uint256 constant BPS = 10_000;
uint256 constant DEFAULT_BRIBE_BPS = 1_000;
uint256 constant MAX_BRIBE_BPS = 2_000;

uint256 bribeBps = DEFAULT_BRIBE_BPS;
```

`Resonance.setBribeBps(uint256 newBribeBps)` is a continuing `onlyOwner` administration method. It accepts every value
from 0 through `MAX_BRIBE_BPS`, inclusive, and emits the previous and new values. The Fund rate is always derived as
`BPS - bribeBps`; it is not independently configurable. There is no per-Strategy override and no BribeRouter-local
owner or setter.

The default remains 10%. Governance may select 0%, 5%, 10%, 20%, or any other basis-point value in the bounded range.
The 20% maximum ensures that, over the complete weighted payment history, at least 80% of acquired assets are
classified to Fund. It does not imply that each individual raw-unit payment visibly splits 80/20, because a later
payment may realize sub-token carry accumulated by earlier payments.

A completed Strategy purchase snapshots the then-current `Resonance.bribeBps()` when its BribeRouter classifies the
payment. A rate change affects that classification and later classifications only. It does not alter:

- a Fund or Bribe liability already recorded in any BribeRouter;
- a reward already notified, queued, scheduled, indexed, or claimable in a Bribe;
- a prior Strategy purchase or Fund balance; or
- the destination of any already-classified amount.

Rate-setting transaction order is therefore economically observable. A purchase executed before a setter transaction
uses the old rate; one executed after it uses the new rate. The eventual external governance system's delay and
execution rules remain a separate unresolved deployment gate under ADR 0034.

### Exact weighted cumulative carry

Each BribeRouter retains one `splitRemainder` in basis-point numerator units. For completed payments `a_i` classified
at the snapshotted rates `r_i`, define:

```text
weightedBribeNumerator = sum_i(a_i * r_i)
cumulativeBribeClassification = floor(weightedBribeNumerator / BPS)
cumulativeFundClassification = sum_i(a_i) - cumulativeBribeClassification
splitRemainder = weightedBribeNumerator mod BPS
```

One classification is implemented with full-precision arithmetic equivalent to:

```text
weightedPayment = payment * appliedBribeBps
bribeNumerator = weightedPayment + priorSplitRemainder
bribeAmount = floor(bribeNumerator / BPS)
nextSplitRemainder = bribeNumerator mod BPS
fundAmount = payment - bribeAmount
```

The implementation must avoid overflowing `payment * appliedBribeBps`, for example by combining full-precision
division with `mulmod`. It must not reset, rescale, discard, or reclassify `splitRemainder` when the global rate
changes. The remainder represents fractional Bribe entitlement earned under the historical rates that produced it.

For a 0% period, each payment contributes zero to `weightedBribeNumerator`, creates no new Bribe liability, and is
classified entirely to Fund. Any pre-existing remainder stays below `BPS` and therefore remains unchanged and cannot
produce a Bribe unit during the 0% period. If governance later restores a nonzero rate, subsequent weighted payments
may eventually realize that preserved historical fraction.

Partition independence applies to payments made at the same rate, and weighted-history independence applies across
rate changes: any two histories with the same ordered rate-weighted payment totals produce the same cumulative
liabilities and remainder. Changing the rate between two payments intentionally changes the weighted history.

### Zero-rate liveness

Setting `bribeBps` to zero disables only new automatic acquired-payment rewards. It does not disable or unregister a
Strategy, BribeRouter, or Bribe. In particular:

- scalar and batched `addSignal` and `removeSignal` retain identical balance and checkpoint behavior;
- killed-Strategy positions remain removable, and smart accounts may reallocate through direct remove/add calls;
- existing BribeRouter liabilities remain independently payable and retryable;
- existing Bribe streams, queued rewards, accrued claims, and Fund liabilities remain claimable or settleable;
- independently funded Bribe rewards remain permitted within the token-count and lifetime-notification caps; and
- raising the rate later resumes automatic rewards without redeploying or re-registering the Strategy graph.

`notifyBribeReward` must return without calling `Bribe.notifyRewardAmount` when its current liability is zero, because
zero is not a valid reward notification. A zero automatic rate is never a reason for signal mutation or GBX withdrawal
to touch an acquired payment token. Broken payment or reward tokens therefore cannot turn the 0% setting into an exit
lock.

### Settlement remains isolated

`routePayment` still pulls the exact complete payment and records fixed Fund and Bribe liabilities using the applied
rate. `payFundPayment` and `notifyBribeReward` remain independent permissionless settlement legs. Failure on either leg
preserves its liability without consuming or blocking the other. Direct BribeRouter donations remain unaccounted
surplus and do not affect liabilities, the applied rate, or split carry.

For a GBX-priced Strategy, the dynamically Fund-classified portion remains Fund-bound GBX and is permissionlessly
burnable only after reaching Fund. The dynamically Bribe-classified portion, if nonzero, remains a paired GBX reward.
The Strategy purchase itself burns neither portion.

## Consequences

- Resonance gains one additional bounded continuing governance method, `setBribeBps`.
- Governance can stop new automatic rewards without pausing acquisitions, signaling, independent rewards, claims, or
  exits.
- Governance can redirect up to 20% of cumulative rate-weighted acquired payments to signalers; Fund receives the
  complementary amount and at least 80% across the complete history.
- Users and interfaces must read the current global rate and treat transaction ordering around a scheduled rate change
  as economically meaningful.
- Historical liabilities and fractional carry survive every rate transition, including 10% to 0% to 5% or 20%.
- The new authority expands the external-governance threat model. Deployment remains blocked until ADR 0034's exact
  executor, permissions, delay, cancellation, batching, and ownership handoff are selected and reviewed.
- Implementation requires coordinated contract, test, invariant, model, ABI, SDK, subgraph, application, operational,
  and generated-reference updates. Local conformance is engineering evidence, not an audit or deployment approval.
