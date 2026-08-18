# ADR 0033: Fixed Mine slots and constant-time pending emission

- Status: accepted for development; not approved for deployment or user funds
- Date: 2026-08-18
- Supersedes: ADR 0024's capacity, checkpoint, emission-settlement, redemption-denominator, and Mine-administration decisions

## Context

ADR 0024 began with one slot, allowed governance to grow capacity to sixteen, and required `Fund.redeem` to call
`Mine.checkpointAll`. The intended interface is now a permanent 4-by-4 market: sixteen independent hourly auctions,
with no capacity governance and no redemption path whose success depends on mutating every mining position.

The difficult accounting requirement is that all sixteen slots can start at different times and retain different
tenure-locked rates. Pending emission must still be exact and available in constant time. A cumulative-mining halving
must depend on economically accrued emission, not on when a miner chooses to realize it.

## Decision

Mine deploys with exactly sixteen empty slots and no owner. Every empty slot begins at the immutable minimum USDG
price. A first occupation routes its complete payment to Resonance. A nonempty replacement gives 80% to the displaced
miner as a pull claim and routes 20% to Resonance. Every slot price decays linearly to zero in one hour. A zero-price
replacement, including self-replacement, is valid and restarts the slot at the minimum price.

Each new tenure receives:

`slot.tps = globalTps(totalMined + pendingEmission()) / 16`

The rate is never changed during that tenure. Mine names rates `tps` (tokens per second), not `ups`.

Mine maintains three aggregate values:

- `aggregateTps`, the sum of all occupied slots' locked rates;
- `storedPendingEmission`, emission accrued through `pendingUpdatedAt` but not minted; and
- `pendingUpdatedAt`, the accumulator timestamp.

The constant-time view is:

`pendingEmission = storedPendingEmission + (now - pendingUpdatedAt) * aggregateTps`

Before a handoff, Mine advances that accumulator at the old aggregate rate. It then settles only the outgoing slot:
`(now - slot.lastAccruedAt) * slot.tps` is removed from stored pending emission, added to `totalMined`, and minted to
the displaced miner. Finally, the old slot TPS is replaced in `aggregateTps` by the new tenure TPS. No unrelated slot
is iterated, checkpointed, or minted.

Fund validates the permanently bound reciprocal Mine and uses `Mine.effectiveTotalSupply()`, defined as minted GBX
supply plus constant-time pending emission, for the pre-burn redemption denominator. Redemption does not call Mine or
change any mining timestamp.

## Invariants

- `aggregateTps == sum(slots[i].tps for i in 0..15)`.
- `pendingEmission() == sum(pendingEmission(i) for i in 0..15)`.
- In the absence of burns, `GBX.totalSupply == genesis allocation + totalMined`.
- `totalMined + pendingEmission()` changes only by exact elapsed aggregate emission.
- Settling one slot moves its accrual from pending to minted without changing their sum.
- Claim timing cannot delay a halving because new-tenure rates use minted plus pending economic emission.
- Fund redemption includes pending emission exactly once and does not settle it.

## Consequences

- The mining market is permanently legible as sixteen slots and can map directly to a 4-by-4 interface.
- Small miners can choose one slot while routers can fill multiple slots in one transaction by calling `mine` for each.
- There is no capacity action, Mine owner, Mine Timelock dependency, or all-slot checkpoint failure mode.
- A current miner realizes GBX only when that slot is replaced; after one hour they may self-replace for zero USDG.
- Aggregate issuance may temporarily exceed the current global rate after a halving because incumbents keep prior TPS.
- Production pending-supply reads and handoffs are constant time. Tests deliberately traverse all sixteen slots as an
  independent differential oracle.
