# Threat model

## Primary risks

- A compromised multisig can schedule any owner call exposed by Resonance through the standard timelock. Fund and
  LiquidityPosition are ownerless.
- Unrestricted signaling permits rapid allocation movement and wallet-splitting; it deliberately provides no
  epoch-level stability or anti-churn guarantee.
- A broken or blocklisting token can prevent its own deferred Fund or user payout. The fixed liability remains
  observable and retryable, while signal removal and unstaking remain available because neither path transfers it.
- A malformed caller-selected token can revert that redemption, but cannot block redemptions that omit
  it.
- Omitted redemption assets are forfeited to the remaining GBX supply.
- Unsolicited tokens sent to Fund become available backing without review or registration.
- Strategy buyers face price movement and competing fills; expected epoch, deadline, and maximum payment protect the
  submitted transaction.
- Bribe work remains linear in the append-only reward-token list, permanently capped at eight. All mandatory entry,
  removal, settlement, and claim paths are therefore bounded, but a broken selected token can still revert that
  token's payout.
- Fund assets are permanently committed: with no successor or recovery path, an asset that redeemers omit stays in
  Fund for the remaining GBX supply indefinitely.
- An incorrect genesis v4 price or range can strand the initial position out of market; the custody contract validates
  the committed pool, token ID, ticks, and nonzero liquidity but cannot reconstruct the amount deposited.
- The canonical v4 position is locked in LiquidityPosition permanently. A deployment error in its pool, range, or
  token ID cannot be corrected afterwards; admission checks are the only defense, and they run once, on receipt.
- A compounder chooses the market price at which the fixed 0.20% liquidity increase occurs. Without an oracle or
  swap, range width and transaction-level price movement can change the token composition required for the increase.

## Explicitly absent protections

The starting point has no pause guardian, proxy upgrade path, price oracle, NAV calculation, curated Fund asset list,
or per-user signal cooldown. Signal changes are caller-bounded scalar or batch operations; there is no forced
whole-account reset. These omissions are deliberate simplifications and must be reconsidered through testing and audit
before any deployment. Current internal hardening does not replace independent security review.
