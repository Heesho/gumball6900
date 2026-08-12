# ADR 0023: Fixed GBX supply and pre-funded Fundraiser reserve

> Superseded on 2026-08-12 by [ADR 0024](0024-immutable-multislot-mine.md). Retained as historical decision context;
> it does not describe the active implementation.

- Status: accepted for development; not approved for deployment or user funds
- Date: 2026-08-12
- Supersedes: ADR 0014's GBX mint authority, claim minting, and empty-epoch non-minting clauses

## Context

GBX previously created only the 20 million genesis-liquidity allocation. Fundraiser later minted contributor rewards
under a one-time locked minter role, up to a cumulative one-billion ceiling.

Fund redemption divides each selected Fund balance by the current GBX total supply. Under mint-on-claim, Fund could
receive backing before contributors claimed the corresponding GBX. An earlier holder could then redeem against a
denominator below the intended fully diluted one-billion supply. Correct deployment did not remove that timing
mismatch because claims were intentionally asynchronous.

The sequential emission curve also has a deterministic `818184994828`-wei residual, and each independently floored
pro-rata claim can leave less than one wei of additional dust.

## Decision

GBX creates exactly `1_000_000_000 ether` at construction:

- `20_000_000 ether` for the genesis-liquidity recipient; and
- `980_000_000 ether` for the Fundraiser reserve recipient.

GBX has no post-construction mint function, minter role, minter handover, or reusable mint capacity. Its supply
identity is `totalSupply == MAX_SUPPLY - lifetimeBurned`.

Fundraiser is pre-funded with the complete 980-million reserve before launch. A successful claim transfers the
floor-rounded reward from that reserve and does not change total supply. Permissionless settlement aggregates the
scheduled amounts of empty epochs in the requested batch and burns that aggregate once after updating all epoch state.
Strict sequential decay and bounded catch-up remain unchanged.

Schedule residual, per-account claim-floor dust, and unclaimed rewards remain in Fundraiser indefinitely. No sweep,
recovery role, terminal redistribution, or dust assignment rule is added.

Because GBX and Fundraiser reference each other, a simple deployment may create the reserve at a temporary deployment
coordinator, deploy Fundraiser, and transfer the complete reserve before launch. Deployment evidence must prove the
final exact Fundraiser balance. This coordinator has no protocol authority after the transfer.

## Consequences

- Fund redemption starts with the intended fully diluted denominator. Fundraiser claims cannot dilute holders or
  change a redemption fraction.
- Empty epochs now reduce total supply when they are settled. A user seeking the maintained redemption denominator can
  permissionlessly settle ended epochs before redeeming.
- The mint role, handover state, cap checks, mint events, and their consumer/indexer surfaces are removed.
- Reserve solvency follows from the fixed schedule: distributed claims plus empty-epoch burns cannot exceed the
  980-million allocation. Claims may distribute less because of floor rounding or remain unclaimed.
- At most one additional GBX wei is stranded per claimed account per epoch. The deterministic full-curve residue is
  approximately `0.000000818 GBX`; this is too small to justify a privileged cleanup mechanism.
- Deployment must verify the exact reserve transfer. An underfunded Fundraiser would eventually make settlement or
  claims revert and is therefore a launch-blocking configuration error.
