# ADR 0027: Fix Bribe carry before signal-supply boundaries

- Status: accepted for development; not approved for deployment or user funds
- Date: 2026-08-13
- Builds on: ADR 0020's Bribe exact-reward accounting
- Historical comparison: ADR 0026's Resonance carry policy, superseded by ADR 0029

## Context

Bribe conserves every scaled reward unit, but `pendingRewardScaled` previously survived a virtual-supply change when
it was too small to advance the old index. A later deposit or withdrawal could therefore make reward value emitted
under old weights index under a new denominator. A late signaler could receive pre-entry rewards, or a remaining
signaler could receive carry accumulated before another account exited. A fully exiting account's sub-token user
remainder was also returned to global carry and could be reallocated.

Historical carry buckets would preserve attribution but add storage, branches, and harder-to-bound accounting to each
of the eight reward-token loops. The protocol already uses an immutable Fund destination for reward precision that
cannot remain attributable after all signalers exit.

## Decision

Before every nonzero Bribe virtual-supply change:

- checkpoint the active streams and the changing account under the old supply;
- classify all still-unindexable global carry into `fundRewardRemainder` and `fundRewardLiability`;
- only then change `totalSupply` and the account's virtual balance.

When an account's virtual balance reaches zero, classify its remaining sub-token user precision to the same fixed
Fund destination instead of returning it to global carry. Existing indexed value and whole user liabilities remain
payable to their original accounts. No reward token moves during signal mutation.

## Consequences

- Reward value emitted before entry cannot accrue to the entrant.
- Old-denominator carry cannot be reassigned solely because another signaler exits.
- Low-decimal rewards or very large signal denominators can classify economically meaningful raw units to Fund at a
  boundary. This is explicit, conserved, observable as Fund liability, and preferable to transferring historical
  entitlement to a later participant.
- The fixed eight-token loop and existing conservation identity remain unchanged in shape.
- This resolves A-09 in the development candidate but does not constitute an independent audit or deployment approval.
