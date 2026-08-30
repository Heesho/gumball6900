# Initial findings checkpoint

- Checkpoint time: 2026-08-29 UTC
- Authoritative checkout: `f9912533e999454f1a3fd49276558bd85e1390da`
- Branch: `main`
- Prior V12 target: `3ae171b997254b56602298d873b3918d1575b3c7`
- Production Solidity changes made before this checkpoint: none

This file records the initial manual-review checkpoint required before any possible change to
`packages/contracts/src`. It is deliberately preliminary: candidate severity, reachability, and remediation remain
subject to executable reproduction and full-system review. Existing reports and tests are treated as claims, not
clearance.

The IDs below are the preliminary IDs assigned at this checkpoint. The final report later inserted the independently
identified position-discovery issue as CEX-03, so preliminary CEX-03 / V12-249702 appears as final CEX-04. The
checkpoint text is retained to preserve the pre-remediation record.

## Reopened confirmed behaviors

1. **CEX-01 / V12-249695: Resonance cumulative-index overflow can block signal principal exit.**
   `Resonance.revenuePerSignal()` checked-adds an unbounded lifetime sequence of `1e36`-scaled increments, and
   `SignalGBX.removeSignal()` must checkpoint Resonance before returning GBX. The impact is a global or class-wide
   principal-exit failure if the boundary is reached. Reachability through public functions, exact arithmetic bounds,
   recirculation of a finite canonical USDG supply, likelihood, and a permanent regression are still being reproduced.

2. **CEX-02 / V12-249705: permissionless claims can force account-level Bribe flooring.**
   `Bribe.claimReward(account, token)` lets an unrelated caller advance the beneficiary's paid index after a floored
   account checkpoint. Repeated calls can destroy sub-raw-unit reward accrual. This affects reward realization rather
   than signal principal; the maximum loss and wallet-native remediation are still being quantified.

3. **CEX-03 / V12-249702: an empty Mine slot can be occupied before the permanent GBX minter handoff.**
   The first occupation does not mint, so a public deployment candidate can be touched before binding and the tenure
   can be settled after binding. Current documentation treats this as a mandatory pre-exposure abandon-and-redeploy
   control. The reproduction and deployment-state-machine classification are being revalidated.

## Initial unresolved evidence gaps

- The prior external export covers `3ae171b`, not ADR 0051 or the current scalar/batch signaling and read periphery.
- No current signed deployment manifest or selected external governance executor exists.
- Historical Robinhood Chain EIP-1153 evidence is not yet current target-chain execution evidence for this review.
- The active shell initially selected Node 20, while the repository requires Node 22.23.1. The exact pinned runtime is
  available and is being used for audit commands.
- The existing Foundry invariant suite attempts complete scalar signal exits after arbitrary prefixes, but initial
  inspection has not yet established equivalent post-prefix escape attempts for Fund redemption, every miner claim,
  every occupied Mine slot, and isolated healthy Bribe rewards.

## Initial rejected or bounded candidates

- Caller-sized signal batches and Fund baskets can exceed a block gas limit, but current source retains scalar
  `removeSignal` and one-token `Fund.redeem` fallbacks whose cost does not grow with global Strategy or Fund-asset count.
  Worst-case scalar gas remains to be measured in this campaign.
- A broken registered Bribe reward token is not called during signal removal; removal checkpoints arithmetic only.
  Whether every arithmetic state remains safe is part of CEX-01 and the Bribe lifetime-bound review.
- Router inactivity delays revenue or rewards but is not called by signal removal, Fund redemption, Mine replacement,
  or already-accrued scalar Bribe claims.

This checkpoint is internal engineering work. It is not an independent audit, safety claim, or deployment
authorization.
