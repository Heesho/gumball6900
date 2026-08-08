# Threat model

## Primary risks

- A compromised multisig can schedule any owner call exposed by Resonance, Fund, or LiquidityPosition through the
  standard timelock.
- Unrestricted signaling permits rapid allocation movement and wallet-splitting; it deliberately provides no
  epoch-level stability or anti-churn guarantee.
- A malformed caller-selected token can revert that redemption or migration batch, but cannot block batches that omit
  it.
- Omitted redemption assets are forfeited to the remaining GBX supply.
- Unsolicited tokens sent to Fund become available backing without review or registration.
- Strategy buyers face price movement and competing fills; expected epoch, deadline, and maximum payment protect the
  submitted transaction.
- Bribe reward streaming and rounding may leave small residual balances.
- A one-way Fund successor cannot be replaced if it is configured incorrectly.
- An incorrect genesis v4 price or range can strand the initial position out of market; the custody contract validates
  the committed pool, token ID, ticks, and nonzero liquidity but cannot reconstruct the amount deposited.
- An incorrect LiquidityPosition successor cannot be replaced after it is bound, although compatibility checks prevent
  changing its PositionManager, assets, fee route, pool, range, or token ID.

## Explicitly absent protections

The starting point has no pause guardian, proxy upgrade path, price oracle, NAV calculation, curated Fund asset list,
or per-user signal cooldown. These omissions are deliberate simplifications and must be reconsidered through testing
and audit before production use.
