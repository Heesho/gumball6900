# Threat model

> Development threat model under ADRs 0031, 0034, 0035, 0036, and 0037. The external governance integration remains
> unselected and must receive a separate threat model before deployment.

## Primary risks

- The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. Resonance's
  external owner can misuse Strategy addition, Strategy death, Bribe reward registration, or the bounded global
  acquired-asset Bribe rate and can transfer or renounce ownership. Mine, Fund, and LiquidityPosition remain outside
  that authority because they are ownerless.
- SignalGBX retains historical block-number checkpoints, but the external governance system and its voting rules are
  unselected. If it uses those snapshots, a holder may acquire and signal GBX before a snapshot, withdraw afterward,
  and retain historical weight. Delegation, quorum, capture, and liveness must be reviewed against its exact release.
- The core guarantees no proposal filter, voting delay, post-vote Timelock, guardian, cancellation path, open executor,
  or immutable governance parameters. Assuming any of those properties before the external integration is selected and
  verified would be unsafe; deployment remains blocked.
- The Resonance owner may change the global automatic acquired-asset Bribe share between 0% and 20%. Transaction order
  is economically meaningful: a Strategy payment snapshots the rate when routed, so a payment before the setter uses
  the old rate and one after it uses the new rate. Buyer price protection does not itself guarantee a particular
  Bribe/Fund allocation. Interfaces must surface pending governance actions once the external executor and delay are
  selected. There is no per-Strategy override, and no rate change can reclassify an existing liability, stream, claim,
  or numerator carry.
- Weighted basis-point carry persists across rate changes. A 0% period adds no new Bribe entitlement and creates only
  Fund liability, but it does not discard fractional Bribe entitlement from an earlier period. That fraction can be
  realized only after later nonzero-rate payments add enough numerator. Individual tiny-payment splits may therefore
  differ visibly from the nominal rate while the complete weighted history remains exact and the Bribe share never
  exceeds 20% cumulatively.
- A halving can temporarily leave aggregate GBX issuance above the new global rate because incumbents keep their fixed
  tenure TPS while new tenures receive the lower rate. This is an accepted fairness tradeoff.
- Miners face rollover risk: without a replacement, an incumbent continues earning GBX but never receives the 80%
  handoff claim. A replacement can also occur at zero USDG after the hourly price reaches zero.
- Accrued Mine rewards are unminted until the individual slot is replaced. Fund includes cached pending emission in its
  effective-supply denominator without checkpointing, but ordinary
  wallet and indexer supply displays must distinguish minted supply from effective supply.
- Mine handoffs settle only the selected slot and redemptions perform no Mine mutation or slot loop.
- Unrestricted signaling permits rapid allocation movement and wallet-splitting; it deliberately provides no
  epoch-level stability or anti-churn guarantee. Elapsed revenue is checkpointed before each weight change, so a
  same-block flash signal earns no newly notified USDG, but a signal held over real time earns that interval's flow.
- Idle sGBX is unreachable, so every current voting unit also carries a Strategy allocation. This does not prevent
  short-duration voting power around a block snapshot because `withdrawSignal` remains immediate.
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
- A broken or blocklisting token can prevent its own deferred Fund, Bribe, or user payout. The fixed liability remains
  observable and retryable. BribeRouter's two settlement legs are independent, and `withdrawSignal` remains available
  because it transfers only the escrowed GBX return rather than an acquired-asset liability.
- Setting the automatic share to 0% is not an emergency pause and does not disable a Strategy or paired Bribe. Existing
  Router liabilities and Bribe rewards remain settleable, claimable, or retryable, independently funded rewards remain
  possible, and signal entry, movement, killed-Strategy exit, and withdrawal retain their ordinary paths. A zero new
  Bribe liability must not be forwarded as an invalid zero reward notification.
- A malformed caller-selected token can revert that redemption, but cannot block redemptions that omit
  it.
- Omitted redemption assets are forfeited to the remaining GBX supply.
- Unsolicited tokens sent to Fund become available backing without review or registration.
- Strategy buyers face price movement and competing fills; expected epoch, deadline, and maximum payment protect the
  submitted transaction.
- Bribe work remains linear in the append-only reward-token list, permanently capped at eight. All mandatory entry,
  removal, settlement, and claim paths are therefore bounded, but a broken selected token can still revert that
  token's payout.
- Bribe indexing is also bounded per token and per Bribe by a monotonic lifetime accepted-notification cap of
  `floor(type(uint256).max / 1e36)` raw units. The check occurs before checkpointing or transfer and has no reset,
  setter, or escape hatch, so a token cannot accumulate enough indexed precision to wrap and lock exits. For a normal
  18-decimal token this is about `1.158e23` whole tokens and is not expected to be reached; unusually high-decimal,
  mintable, or upgraded tokens can exhaust it earlier in economic terms. Reaching it permanently rejects later
  notifications for that token in that Bribe but leaves existing claims, signal moves, and withdrawals available.
- If an automatic Strategy-payment reward reaches an exhausted cap, its fixed Bribe liability stays retryable in
  BribeRouter but can no longer enter that old Bribe; the independent Fund leg remains payable. The operational
  replacement is a new Strategy with a new Bribe, followed by killing the old Strategy (adding first when the old one
  is the final live Strategy). This does not reopen or drain the old Bribe.
- Killing a Strategy checkpoints and preserves its pre-kill Resonance claim, then excludes its complete recorded weight
  from active reward supply. Existing allocations stay reserved and removable, but no later removal subtracts that
  weight again. After bootstrap, killing the final live Strategy is prohibited; the Resonance owner must add a
  replacement first. A zero-active-signal interval can still occur if every user exits all live Strategies.
- Killing a Strategy turns its Bribe into a closed reward pool. Existing signalers may remain indefinitely, earn and
  claim automatic acquired-asset or additionally funded Bribe rewards, or exit incrementally, but neither they nor new
  accounts can add signal.
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
operations coordinated only by SignalGBX; there is no idle receipt, public batch, or forced whole-account reset. These
omissions are deliberate simplifications and must be reconsidered through testing and audit before any deployment. The
external governance owner, permissions, voting rules, upgrade paths, delay, batching, and cancellation semantics are
also unresolved release gates. Current internal hardening does not replace independent security review.
