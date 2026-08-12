# ADR 0024: Immutable multislot Mine with tenure-locked rates

- Status: accepted for development; not approved for deployment or user funds
- Date: 2026-08-12
- Supersedes: ADR 0023 and the Fundraiser/supply portions of ADR 0014

## Context

The daily pooled Fundraiser allowed late contributions to change earlier contributors' effective mining price and
encouraged last-block or MEV-heavy participation. The desired mechanism is a continuously clearing market in which a
miner can be replaced at any time, USDG enters frequently, and rollover risk disciplines the price.

Farplace's MineRig provides a previously exercised hourly reverse-Dutch handoff shape. This repository adapts the
mechanism rather than importing its complete graph.

## Decision

GBX creates only 20 million genesis-liquidity tokens. Deployment permanently hands its only mint authority to one
non-upgradeable Mine. There is no protocol-defined economic maximum supply and no successor minter. The inherited
ERC20Votes `uint208` safe-supply ceiling remains an implementation bound far beyond any modeled issuance horizon.

Mine starts with one slot. Each slot can be replaced at any time and has a USDG price that decays linearly to zero
over one hour. A handoff checkpoints the outgoing miner's accrued GBX, gives 80% of a nonempty-slot payment to the
displaced miner as a pull claim, and routes 20% through ResonanceRouter. An empty slot routes its complete first payment
because nobody was displaced.

There is no team fee, randomness, oracle, metadata, generic factory, migration, or upgrade mechanism.

## Capacity and miner fairness

The timelock may only increase capacity, from one to a hard maximum of 16. It cannot reduce capacity or change any
other mining parameter.

A miner's assigned GBX-per-second rate is fixed for the complete slot tenure. Checkpoints, Fund redemptions, supply
thresholds, and capacity increases do not reprice occupied slots. A newly occupied or replaced slot receives the
current global rate divided by current capacity.

This prevents governance from diluting a miner after they paid to enter. The accepted cost is temporary aggregate
issuance above the current undivided global rate when old-rate miners coexist with later divided-rate slots.

## Emission curve

Constructor-immutable cumulative-mining thresholds halve the global rate used for future handoffs. A strictly positive
tail rate continues forever. Capacity division floors; the remainder is unissued. Constructor validation keeps the tail
large enough that a new slot remains positive at maximum capacity.

Exact production values for initial rate, halving amount, tail, minimum USDG price, and multiplier are deployment
inputs and remain release blockers until independently modeled, reviewed, and signed.

## Redemption denominator

Mining rewards accrue continuously but are minted only at checkpoints. Fund calls `checkpointAll` before taking its
pre-burn supply snapshot. The hard capacity bound makes this operation bounded and ensures accrued mining supply cannot
be omitted from a redemption denominator.

## Administration

OpenZeppelin TimelockController owns Mine solely for `increaseCapacity`. Resonance retains its three existing methods.
Fund and LiquidityPosition stay ownerless. The system remains direct and non-upgradeable.

## Consequences

- USDG can enter on every slot handoff instead of once per daily pooled epoch.
- Miners face rollover risk: without a replacement they receive no 80% exit payment.
- Existing miners cannot be diluted by later capacity expansion or a halving.
- GBX supply is infinite but its marginal rate falls to a positive immutable tail.
- A replacement checkpoints up to 16 slots, so gas grows linearly but remains bounded.
- The prior one-billion supply and 980-million Fundraiser reserve no longer describe the protocol.

## Provenance

The adaptation reviewed Farplace at commit `8cf7423016b108e7bd8d7854c14e0ac6585bb935`, principally
`packages/hardhat/contracts/rigs/mine/MineRig.sol` (SHA-256
`57b8a2940986b21adcdacb5f447ed5f9dcb598b8b64de82bd77176c8362cfdc2`). Licensing/provenance clearance remains a
release blocker; see `NOTICE` and `docs/LEGAL-PROVENANCE-BLOCKER.md`.
