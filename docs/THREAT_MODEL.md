# Threat model

## Primary risks

- A compromised multisig can schedule any owner call exposed by Resonance, Fund, or LiquidityPosition through the
  standard timelock.
- Unrestricted signaling permits rapid allocation movement and wallet-splitting; it deliberately provides no
  epoch-level stability or anti-churn guarantee.
- A dead Strategy whose revenue transfer to Fund reverts can still block removal of the signal assigned to that
  Strategy. It cannot block unstaking an account's unallocated balance or removing signals from other Strategies.
- A malformed caller-selected token can revert that redemption or migration batch, but cannot block batches that omit
  it.
- Omitted redemption assets are forfeited to the remaining GBX supply.
- Unsolicited tokens sent to Fund become available backing without review or registration.
- Strategy buyers face price movement and competing fills; expected epoch, deadline, and maximum payment protect the
  submitted transaction.
- Bribe reward streaming and rounding may leave small residual balances. Its per-token work remains linear, but the
  append-only reward-token list is permanently capped at eight.
- Fund assets are permanently committed: with no successor or recovery path, an asset that redeemers omit stays in
  Fund for the remaining GBX supply indefinitely.
- An incorrect genesis v4 price or range can strand the initial position out of market; the custody contract validates
  the committed pool, token ID, ticks, and nonzero liquidity but cannot reconstruct the amount deposited.
- The canonical v4 position is locked in LiquidityPosition permanently. A deployment error in its pool, range, or
  token ID cannot be corrected afterwards; admission checks are the only defense, and they run once, on receipt.

## Explicitly absent protections

The starting point has no pause guardian, proxy upgrade path, price oracle, NAV calculation, curated Fund asset list,
or per-user signal cooldown. Signal changes are caller-bounded scalar or batch operations; there is no forced
whole-account reset. These omissions are deliberate simplifications and must be reconsidered through testing and audit
before production use.
