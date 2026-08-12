# Threat model

## Primary risks

- A compromised multisig can schedule any owner call exposed by Resonance or increase Mine capacity through the
  standard timelock. It cannot reduce capacity or reprice occupied slots. Fund and LiquidityPosition are ownerless.
- A capacity increase can temporarily raise aggregate GBX issuance above the current global rate because incumbents
  keep their fixed tenure rates while new slots receive divided rates. This is an accepted fairness tradeoff.
- Miners face rollover risk: without a replacement, an incumbent continues earning GBX but never receives the 80%
  handoff claim. A replacement can also occur at zero USDG after the hourly price reaches zero.
- Accrued Mine rewards are unminted until checkpointed. Fund checkpoints atomically before redemption, but ordinary
  wallet and indexer supply displays must distinguish minted supply from effective supply.
- Mine handoffs and redemptions checkpoint up to sixteen slots. The loop is bounded, but gas rises linearly with
  capacity and a failure in any required GBX mint reverts the whole operation.
- Unrestricted signaling permits rapid allocation movement and wallet-splitting; it deliberately provides no
  epoch-level stability or anti-churn guarantee.
- Sub-index Resonance and Bribe carry is conserved but indexed against the signal supply present when the threshold is
  crossed. A late signal can therefore share value received or emitted before entry (A-09), especially for
  low-decimal supported tokens.
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
- Fee harvesting has no caller bounty. Accrued fees may remain unharvested until someone voluntarily pays gas, and a
  failing Resonance route or Fund burn reverts the entire harvest until the destination is usable again.

## Explicitly absent protections

The starting point has no pause guardian, proxy upgrade path, Mine replacement authority, emission setter, price
oracle, NAV calculation, curated Fund asset list, or per-user signal cooldown. Signal changes are caller-bounded
scalar or batch operations; there is no forced
whole-account reset. These omissions are deliberate simplifications and must be reconsidered through testing and audit
before any deployment. Current internal hardening does not replace independent security review.
