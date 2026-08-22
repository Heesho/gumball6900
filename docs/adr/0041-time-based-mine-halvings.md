# ADR 0041: Time-based Mine halvings

- Status: time-based shape accepted for development; provisional period and rates superseded by ADRs 0042 and 0043;
  not approved for deployment or user funds
- Partially superseded by: ADR 0042 replaces the provisional period and initial rate; ADR 0043 replaces the tail rate
- Date: 2026-08-21
- Supersedes: ADR 0024's cumulative-mining halving model and ADR 0038's `HALVING_AMOUNT`

## Context

The handoff mechanism traces to Donut Miner, whose prospective emission rate halves according to elapsed time from
deployment. This repository had replaced that rule with geometric cumulative-mining thresholds beginning at 490 million
GBX. The local ADRs pinned that value but did not justify why a supply-driven schedule was preferable.

The cumulative model made the rate depend on minted plus pending emission, required iterative threshold calculation,
and made calendar timing depend on occupancy and legacy-rate turnover. That complexity is not necessary to preserve the
core fairness rule that an occupied slot keeps its assigned rate for its complete tenure.

## Decision

Mine anchors its prospective global-rate schedule at `startTime = block.timestamp` during construction. The rate for a
newly occupied or replaced slot is:

```text
halvings = floor((now - startTime) / HALVING_PERIOD)
prospectiveGlobalTps = max(INITIAL_TPS >> halvings, TAIL_TPS)
newSlotTps = prospectiveGlobalTps / 16
```

`HALVING_PERIOD` is provisionally fixed at `4 * 365 days` while independent economic research compares candidate
periods. It is a code constant rather than a constructor parameter or mutable setting. `INITIAL_TPS` remains 4 GBX per
second and `TAIL_TPS` remains 0.01 GBX per second.

An occupied slot is never repriced at a time boundary. It retains its assigned TPS until replacement, so aggregate
issuance may remain above the prospective global rate while legacy tenures remain. Pending emission remains exact and
constant-time for effective-supply accounting, but it no longer selects the prospective rate.

## Consequences

- Mine removes `HALVING_AMOUNT`, `_rateState`, and the threshold loop and exposes immutable `startTime` plus
  `HALVING_PERIOD`.
- The SDK's `miningRateAt` first argument changes semantically from cumulative raw GBX to elapsed seconds, even though
  both are represented as `bigint`; development consumers must migrate explicitly.
- The schedule advances even when every slot is empty. A delay between Mine deployment and public launch consumes part
  of the first period and must be minimized and reported in deployment evidence.
- A handoff immediately before a boundary can lock the outgoing era's higher TPS for the complete new tenure. This is a
  visible consequence of tenure locking, not timestamp-triggered repricing.
- A transaction submitted before a boundary but executed after it receives the lower rate. `epochId` and
  `maximumPrice` do not protect TPS; a caller that requires the quoted rate must set `deadline` strictly before the
  next boundary. Timestamp ordering near a boundary can therefore have tenure-long consequences.
- With the provisional period, the prospective rate first halves after exactly 1,460 days and reaches the 0.01 tail at
  the ninth boundary, after 13,140 days. These are fixed-day intervals, not calendar-anniversary arithmetic.
- Changing the provisional period after research requires a source change, model regeneration, tests, and a superseding
  ADR. No deployed Mine can be reconfigured.

## Provenance and review

Donut Miner's source uses deployment-time halvings with a 30-day period. This ADR adopts the simpler time-based shape,
not that economic duration. The four-year development value is provisional and must not be described as economically
approved, audited, or deployment-ready.
