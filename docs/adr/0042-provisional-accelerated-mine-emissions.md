# ADR 0042: Provisional accelerated Mine emissions

- Status: partially superseded by ADR 0043's `TAIL_TPS` value; the 64 GBX/second initial rate and 69-day period remain
  accepted provisionally for development; independent economic review remains required; not approved for deployment
  or user funds
- Partially superseded by: ADR 0043 replaces the 0.5 GBX/second tail with 1 GBX/second
- Date: 2026-08-22
- Supersedes: ADR 0038's `INITIAL_TPS` and `TAIL_TPS` values and ADR 0041's provisional `HALVING_PERIOD`

## Context

ADR 0041 replaced cumulative-mining thresholds with a constant-time schedule measured from Mine deployment. It
deliberately left the four-year period provisional. Subsequent development analysis considered the initial rate, period,
tail, and 20 million-token genesis allocation together rather than treating the period as an isolated parameter.

The intended development curve needs an active early distribution phase, a finite transition to a meaningful permanent
tail, and no constructor or governance flexibility. This remains an economic hypothesis to test, not evidence that the
curve is safe, liquid, or suitable for deployment.

The 69-day interval is a GBX branding choice informed by Dogecoin's historical one-minute target and 100,000-block
halving cadence (nominally about 69.4 days), while the declining percentage inflation of a fixed tail is informed by
Monero's permanent-tail pattern. See the primary [Dogecoin Core FAQ](https://github.com/dogecoin/dogecoin/blob/master/doc/FAQ.md)
and [Zero to Monero](https://web.getmonero.org/library/Zero-to-Monero-2-0-0.pdf). These analogies do not validate GBX's
different sixteen-slot, tenure-locked issuance mechanism.

## Decision

The fixed development constants are:

```text
GENESIS_LIQUIDITY_ALLOCATION = 20,000,000 GBX
INITIAL_TPS                  = 64 GBX/second
HALVING_PERIOD               = 69 days = 5,961,600 seconds
TAIL_TPS                     = 0.5 GBX/second
```

The genesis allocation is unchanged. The three Mine values remain public code constants: they are neither constructor
arguments nor mutable governance settings. ADR 0041's deployment-time anchor, bit-shifted halving formula, positive-tail
clamp, and tenure-locked slot rates remain unchanged.

For a new slot tenure at elapsed era `k`:

```text
k = floor((now - startTime) / 69 days)
prospectiveGlobalTps = max(64 GBX/second >> k, 0.5 GBX/second)
newSlotTps = prospectiveGlobalTps / 16
```

The prospective path is 64, 32, 16, 8, 4, 2, 1, then 0.5 GBX per second. The 0.5 GBX-per-second tail begins at the
seventh boundary, day 483, and remains fixed thereafter.

## Synchronized reference calculation

For one deliberately simplified reference path—every slot occupied from deployment, all sixteen slots refreshed and
settled exactly at every boundary, and no burns—the first seven 69-day eras emit 757,123,200 GBX. Including the unchanged
20,000,000-token genesis allocation gives a gross supply of 777,123,200 GBX at day 483. The scheduled tail flow is
15,768,000 GBX per 365-day year, or about 2.029% of that reference gross supply initially, declining as supply grows.

The same synchronized reference produces the following boundary supplies. “Fresh global rate” is the rate assigned to
new tenures beginning at that boundary; it does not reprice incumbents.

| Boundary | Elapsed days | Fresh global rate | Gross supply |
| -------- | ------------ | ----------------- | ------------ |
| Launch   | 0            | 64 GBX/s          | 20,000,000   |
| 1        | 69           | 32 GBX/s          | 401,542,400  |
| 2        | 138          | 16 GBX/s          | 592,313,600  |
| 3        | 207          | 8 GBX/s           | 687,699,200  |
| 4        | 276          | 4 GBX/s           | 735,392,000  |
| 5        | 345          | 2 GBX/s           | 759,238,400  |
| 6        | 414          | 1 GBX/s           | 771,161,600  |
| 7 (tail) | 483          | 0.5 GBX/s         | 777,123,200  |

Once the synchronized path reaches the tail, its no-burn gross supply grows linearly:

| Time after tail | Gross supply |
| --------------- | ------------ |
| 1 year          | 792,891,200  |
| 2 years         | 808,659,200  |
| 5 years         | 855,963,200  |
| 10 years        | 934,803,200  |

Those figures are a synchronized, fully occupied, fully refreshed, fully settled, no-burn reference only. They are not
a supply cap, actual-supply forecast, or guaranteed inflation rate. Empty slots can reduce issuance; old tenures retain
their earlier rates indefinitely and can make aggregate issuance and effective or minted supply exceed the synchronized
path; burns change the live denominator.

## Consequences

- The first prospective halving boundary is 69 days after Mine deployment and the tail begins at the seventh boundary,
  day 483. Fixed-day arithmetic is used, not calendar months.
- Deployment-to-exposure delay consumes part of the first era even while slots are empty.
- A handoff just before a boundary may lock that era's higher rate for the entrant's complete tenure. Aggregate issuance
  does not automatically step down with the prospective schedule because turnover is not guaranteed.
- The higher initial rate increases early issuance and makes boundary timing, slow-turnover, permanent-incumbent, demand,
  liquidity, redemption, and MEV scenarios especially important in independent review.
- Any later change requires source edits, synchronized model and documentation regeneration, tests, and another
  superseding ADR. A deployed Mine cannot be reconfigured.

## Review status

The schedule is the agreed development candidate, not independent economic approval. Finding M-04 remains open, and no
deployment or user-funds authorization follows from this ADR or its deterministic reference calculation.
