# ADR 0043: Provisional one-GBX Mine tail

- Status: accepted provisionally for development; independent economic review remains required; not approved for
  deployment or user funds
- Date: 2026-08-22
- Supersedes: ADR 0042's `TAIL_TPS` value only

## Context

ADR 0042 selected a provisional 64 GBX/second initial rate, 69-day periods, and a 0.5 GBX/second tail. Subsequent
development review preferred a 1 GBX/second permanent tail. This keeps the bit-shift schedule especially simple and
doubles the fixed annual tail flow, but selection and deterministic modelling still do not establish economic safety.

## Decision

The Mine development constants are now:

```text
GENESIS_LIQUIDITY_ALLOCATION = 20,000,000 GBX
INITIAL_TPS                  = 64 GBX/second
HALVING_PERIOD               = 69 days = 5,961,600 seconds
TAIL_TPS                     = 1 GBX/second
```

ADR 0042's genesis allocation, initial rate, and period remain unchanged. ADR 0041's deployment-time anchor,
bit-shifted formula, positive-tail clamp, and tenure-locked slot rates also remain unchanged. The constants are fixed
in source and are neither constructor arguments nor governance settings.

For a new slot tenure at elapsed era `k`:

```text
k = floor((now - startTime) / 69 days)
prospectiveGlobalTps = max(64 GBX/second >> k, 1 GBX/second)
newSlotTps = prospectiveGlobalTps / 16
```

The prospective path is 64, 32, 16, 8, 4, 2, then 1 GBX per second. The 1 GBX-per-second tail begins at the sixth
boundary, day 414, and remains fixed thereafter.

## Synchronized reference calculation

For one deliberately simplified path—every slot occupied from deployment, all sixteen slots refreshed and settled
exactly at every boundary, and no burns—the six pre-tail eras emit 751,161,600 GBX. Including the unchanged 20,000,000
genesis allocation gives gross supply of 771,161,600 GBX at day 414. The scheduled tail flow is 31,536,000 GBX per
365-day year, or about 4.089% of that reference gross supply initially. Because the absolute flow is fixed, that ratio
declines as the reference supply grows.

| Boundary | Elapsed days | Fresh global rate | Gross supply |
| -------- | ------------ | ----------------- | ------------ |
| Launch   | 0            | 64 GBX/s          | 20,000,000   |
| 1        | 69           | 32 GBX/s          | 401,542,400  |
| 2        | 138          | 16 GBX/s          | 592,313,600  |
| 3        | 207          | 8 GBX/s           | 687,699,200  |
| 4        | 276          | 4 GBX/s           | 735,392,000  |
| 5        | 345          | 2 GBX/s           | 759,238,400  |
| 6 (tail) | 414          | 1 GBX/s           | 771,161,600  |

Once the synchronized path reaches the tail, its no-burn gross supply grows linearly:

| Time after tail | Gross supply  | Annual tail flow / listed supply |
| --------------- | ------------- | -------------------------------- |
| Tail begins     | 771,161,600   | 4.089%                           |
| 1 year          | 802,697,600   | 3.929%                           |
| 2 years         | 834,233,600   | 3.780%                           |
| 5 years         | 928,841,600   | 3.395%                           |
| 10 years        | 1,086,521,600 | 2.902%                           |

These figures are a synchronized, fully occupied, fully refreshed, fully settled, no-burn reference only. They are
not a supply cap, actual-supply forecast, or guaranteed inflation rate. Empty slots can reduce issuance; legacy
tenures keep their earlier rates indefinitely and can make aggregate issuance and effective or minted supply exceed
the synchronized path; burns change the live denominator.

## Consequences

- The first prospective halving boundary remains 69 days after Mine deployment, while the tail now begins at the sixth
  boundary, day 414. Fixed-day arithmetic is used, not calendar months.
- The permanent scheduled tail flow doubles from ADR 0042's historical 15,768,000 GBX per year to 31,536,000 GBX per
  year. On the synchronized reference, the initial annual tail-flow ratio rises from about 2.029% to about 4.089%.
- Deployment-to-exposure delay still consumes the first era even while slots are empty.
- A handoff just before a boundary may lock that era's higher rate for the entrant's complete tenure. Aggregate
  issuance does not automatically step down with the prospective schedule because turnover is not guaranteed.
- Any later change requires source edits, synchronized model and documentation regeneration, tests, and another
  superseding ADR. A deployed Mine cannot be reconfigured.

## Review status

This is the agreed development candidate, not independent economic approval. Finding M-04 remains open, and no
deployment or user-funds authorization follows from this ADR or its deterministic reference calculation.
