# Threat model

## Primary risks

- SignalGBX governance can authorize only four exact zero-value calls through the selector-bounded ProtocolGovernor and
  Timelock. A voting-power capture can misuse Strategy addition, Strategy death, Bribe reward registration, or
  increase-only Mine capacity, but cannot reach another target or selector. Fund and LiquidityPosition are ownerless.
- SignalGBX uses historical block-number snapshots. A holder may acquire and stake GBX before the snapshot, then remove
  every signal and unstake after the snapshot while retaining that proposal's voting weight. Governance does not create
  a staking lock, and low staked supply lowers the absolute quorum represented by a fixed quorum percentage.
- Once a successful proposal is queued, no multisig, guardian, or Governor caller can cancel it. The Timelock delay is
  an observation and exit window, not an emergency veto. Incorrect immutable voting parameters or role setup cannot be
  repaired.
- A capacity increase can temporarily raise aggregate GBX issuance above the current global rate because incumbents
  keep their fixed tenure rates while new slots receive divided rates. This is an accepted fairness tradeoff.
- Miners face rollover risk: without a replacement, an incumbent continues earning GBX but never receives the 80%
  handoff claim. A replacement can also occur at zero USDG after the hourly price reaches zero.
- Accrued Mine rewards are unminted until checkpointed. Fund checkpoints atomically before redemption, but ordinary
  wallet and indexer supply displays must distinguish minted supply from effective supply.
- Mine handoffs and redemptions checkpoint up to sixteen slots. The loop is bounded, but gas rises linearly with
  capacity and a failure in any required GBX mint reverts the whole operation.
- Unrestricted signaling permits rapid allocation movement and wallet-splitting; it deliberately provides no
  epoch-level stability or anti-churn guarantee. Elapsed revenue is checkpointed before each weight change, so a
  same-block flash signal earns no newly notified USDG, but a signal held over real time earns that interval's flow.
- Resonance streaming is lazy. USDG entitlement accrues with time, but token balances move to Strategies only when a
  caller triggers a signal change, notification, distribution, purchase, or other checkpointing path. Interfaces must
  preview released revenue rather than treating the Strategy's raw balance as its complete executable inventory.
- A qualifying live-stream top-up checkpoints elapsed emission, combines the new reward with the amount left, and
  restarts seven days from the current timestamp. It may raise or lower the rate and extend the prior finish. The new
  reward must be at least the complete amount left, so forcing an early reset requires economically matching that
  remainder; timing influence is nevertheless intentional and accepted.
- ResonanceRouter retains its complete balance while it is nonzero but smaller than the active amount left. Mine and
  LiquidityPosition delivery may therefore wait in the Router before becoming a Resonance notification. The balance has
  no absolute minimum and eventually qualifies as the active remainder decays, but interfaces must distinguish delivery
  to the Router from delivery into the active stream.
- Resonance does not carry global-index or per-Strategy division remainders. `1e36` precision makes ordinary individual
  floors small, but checkpoint frequency and protocol lifetime can accumulate unclassified USDG surplus. No exact
  conservation or lifetime dust bound is claimed.
- Stream time continues when active signal supply is zero, leaving that interval's emission permanently unclaimable.
  Direct USDG donations to Resonance are likewise unscheduled. Neither category becomes Fund backing, can be assigned to
  later signalers, or has a synchronization, rescue, or recovery path.
- Bribe carry remains conserved and assigned to Fund before a signal denominator changes, so a late Bribe signaler
  cannot receive value emitted before entry. A fully exiting Bribe account's sub-token remainder also becomes fixed Fund
  precision rather than being reallocated to remaining signalers.
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
- Killing a Strategy checkpoints and preserves its pre-kill Resonance claim, then excludes its complete recorded weight
  from active reward supply. Existing allocations stay reserved and removable, but no later removal subtracts that
  weight again. Killing the final live weighted Strategy can therefore create the accepted zero-active-supply condition
  even while dead-Strategy allocations remain recorded.
- Killing a Strategy turns its Bribe into a closed reward pool. Existing signalers may remain indefinitely, earn and
  claim independently funded Bribe rewards, or exit incrementally, but neither they nor new accounts can add signal.
  If the final signaler exits before active and queued rewards finish, the remainder is permanently abandoned in the
  Bribe. A notification made after signal supply reaches zero is likewise unrecoverable. This amount is unbounded and
  is accepted by ADR 0028 without a retirement, refund, rescue, or Fund-redirection mechanism.
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
oracle, NAV calculation, curated Fund asset list, or per-user signal cooldown. Signal changes are caller-bounded scalar
operations coordinated only by SignalGBX; there is no batch or forced whole-account reset. These omissions are
deliberate simplifications and must be reconsidered through testing and audit before any deployment. Current internal
hardening does not replace independent security review.
