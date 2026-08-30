# Threat model

> Development threat model under ADRs through 0055. The external governance integration remains
> unselected and must receive a separate threat model before deployment.

## Primary risks

- The core includes no Governor, Timelock, generic executor, or provider-specific governance adapter. Resonance's
  external owner can misuse Strategy addition, Strategy death, Bribe reward registration, or the bounded global
  acquired-asset Bribe rate. Mine's external owner can redirect future protocol-share revenue to a replacement graph.
  Mine and Resonance owners can begin, replace, or cancel pending two-step ownership transfers or immediately renounce.
  Fund remains ownerless.
- Mine validates reciprocal replacement Router, Resonance, SignalGBX, GBX, USDG, and Fund identities, but getter
  consistency cannot authenticate bytecode. A malicious graph can mimic every getter and steal future revenue. Exact
  runtime provenance, governance authorization, pinned-state simulation, and monitoring remain mandatory for every
  switch.
- Mine does not validate replacement Resonance ownership, factory bindings, live Strategies, Bribe parameters, lifetime
  counters, or pristine schedule state. A consistent but incomplete graph can pass the setter and strand or misdirect
  later revenue even without counterfeit identity getters.
- The core imposes no delay, veto, guardian, or rollback on `Mine.setResonanceRouter`. `Ownable2Step` reduces accidental
  ownership transfer risk but does not delay that setter, protect against a compromised owner, or make immediate
  renunciation recoverable. External governance must supply and prove any desired delay or cancellation policy.
- SignalGBX retains historical block-number checkpoints, but the external governance system and its voting rules are
  unselected. If it uses those snapshots, a holder may acquire and signal GBX before a snapshot, withdraw afterward,
  and retain historical weight. Delegation, quorum, capture, and liveness must be reviewed against its exact release.
- The core guarantees no proposal filter, voting delay, post-vote Timelock, guardian, cancellation path, open executor,
  or immutable governance parameters. Assuming any of those properties before the external integration is selected and
  verified would be unsafe; deployment remains blocked.
- The Resonance owner may change the global automatic acquired-asset Bribe share between 0% and 20%. Transaction order
  is economically meaningful: Strategy snapshots the rate before payment-token interaction, so a payment before the setter uses
  the old rate and one after it uses the new rate. Buyer price protection does not itself guarantee a particular
  Bribe/Fund allocation. Interfaces must surface pending governance actions once the external executor and delay are
  selected. There is no per-Strategy override, and no rate change can reclassify an earlier purchase, stream, or claim.
- Strategy floors each payment's Bribe share independently and sends the complement directly to Fund. Payment
  partitioning may therefore change cumulative raw-unit classification. There is no weighted carry state: this
  accepted per-purchase floor must be reflected in quotes and models.
- A halving can leave aggregate GBX issuance above the new global rate for as long as older tenures keep their fixed
  tenure TPS while new tenures receive the lower rate. Turnover is not guaranteed; this is an accepted fairness
  tradeoff.
- A Mine replacement submitted before a halving boundary can execute after it and lock the lower rate for the complete
  tenure. `epochId` and `maximumPayment` do not bind TPS. Callers and interfaces that require the quoted rate must set
  `deadline` strictly before the next boundary; ordering and timestamp influence remain relevant near that boundary.
- Miners face rollover risk: without a later positive-price replacement, the current tenure continues earning GBX but
  produces no nonzero 80% replacement claim. A replacement can also occur at zero USDG after the hourly price reaches
  zero, including by the current miner.
- Accrued Mine rewards are unminted until the individual slot is replaced. Fund includes cached pending emission in its
  effective-supply denominator without checkpointing, but ordinary
  wallet and indexer supply displays must distinguish current `totalSupply()` after burns from effective supply.
- The completed canonical graph has a fixed `1,000 ether` GBX genesis-liquidity issue even though the GBX constructor
  starts at zero. Mine is the sole issuer, but `lifetimeMinted` therefore equals settled `totalMined` plus that fixed
  amount after launch. Integrations that equate all lifetime issuance with mining will misstate supply provenance.
- Compromise or misconfiguration of the immutable launch authority before launch can select the transaction timing and
  `finalOwner`, spend its approved `1e6` raw USDG, and attempt the one-shot deployment. Atomicity prevents a partial
  graph, but it cannot make malicious calldata, a wrong reviewed dependency, or an unsafe governance contract correct.
  A successful transaction consumes the launcher's only call and makes `finalOwner` pending owner of Mine and
  Resonance. If that contract cannot accept both ownerships, administration remains inert under the single-use launcher;
  launch success is not ownership-handoff completion. Although an ordinary callable current owner could replace or
  cancel a pending transfer, the consumed launcher exposes no post-launch path to do so.
- Mine replacements settle only the selected slot and redemptions perform no Mine mutation or slot loop.
- Unrestricted signaling permits rapid allocation changes and wallet-splitting; it deliberately provides no
  epoch-level stability or anti-churn guarantee. Elapsed revenue is checkpointed before each weight change, so a
  same-block flash signal earns no newly notified USDG, but a signal held over real time earns that interval's flow.
- Batched signal changes perform linear work across allocations and each paired Bribe's registered rewards. A stale or
  invalid entry reverts the complete batch, and a sufficiently large caller-selected array may exceed the block gas
  limit. Scalar removal remains the bounded fallback. Current batch gas must be remeasured at the sixteen-token maximum
  because the prior 1,890,938-gas composed-move result predates ADR 0051 and does not cover the new loops.
- Idle sGBX is unreachable, so every current voting unit also carries a Strategy allocation. This does not prevent
  short-duration voting power around a block snapshot because `removeSignal` remains immediate.
- Resonance streaming is lazy. USDG entitlement accrues with time, but token balances move to Strategies only when a
  caller triggers a signal change, notification, distribution, purchase, or other checkpointing path. Interfaces must
  preview released revenue rather than treating the Strategy's raw balance as its complete executable inventory.
- A qualifying live-stream top-up checkpoints elapsed emission, combines the new revenue with the amount left, and
  restarts seven days from the current timestamp. It may raise or lower the rate and extend the prior finish. The new
  revenue must be at least the complete amount left, so forcing an early reset requires economically matching that
  remainder; timing influence is nevertheless intentional and accepted.
- Each old or current ResonanceRouter retains its complete balance until a permissionless caller invokes `route()`. A balance below
  `max(REWARD_DURATION, remainingRevenue())` remains held. Decay can remove the active-remainder constraint, but a
  balance below `REWARD_DURATION` never qualifies without another deposit, and qualification does not execute a transaction. Mine only
  deposits and is isolated from later Router/Resonance failure. Interfaces must distinguish delivery to the Router from delivery into the active stream, and
  operators must accept that Mine revenue may wait indefinitely without a manual, frontend, volunteer-keeper, or cron
  caller.
- A Mine Router change moves no old state. Buffered old-Router USDG, old Resonance schedules and claims, paired Bribe
  rewards, and old sGBX positions remain graph-local. Users must claim and unsignal through the old graph, then may
  signal returned GBX into the new graph. If the old graph's own exit path is broken, changing Mine cannot rescue that
  position. Interfaces that hide the old graph can create an avoidable discovery failure even when its contracts still
  work.
- Each replacement graph has a different one-time-bound SignalGBX. An external governance integration reading old sGBX
  checkpoints does not automatically count new sGBX, while users who unsignal old positions reduce their current old-
  token voting weight. A poorly ordered transition can strand governance participation or create a circular dependency
  on votes that users must burn before the transition finishes. Mine does not update the governance voting token.
- Governance must deploy and fully bind the replacement graph before switching Mine last. A partial, wrong-Fund,
  wrong-USDG, wrong-GBX, or nonreciprocal candidate is rejected, but a semantically malicious consistent graph is not.
  Repeated switches are possible until Mine ownership is renounced; every transition expands historical graph discovery
  and monitoring requirements.
- Resonance does not carry global-index or per-Strategy division remainders. `1e36` precision makes ordinary individual
  floors small, but checkpoint frequency and protocol lifetime can accumulate unclassified USDG surplus. No exact
  conservation or lifetime dust bound is claimed.
- Stream time continues when active signal weight is zero, leaving that interval's emission permanently unclaimable.
  Direct USDG donations to Resonance are likewise unscheduled. Neither category becomes Fund backing, can be assigned to
  later signalers, or has a synchronization, rescue, or recovery path.
- Bribe uses ordinary Synthetix index floors. Rate dust, zero-weight elapsed rewards, index floors, and account floors
  remain unallocated in Bribe rather than being carried or assigned to Fund.
- Direct Bribe claims accept only the beneficiary or the Bribe's immutable Resonance. This prevents an outsider from
  choosing another account's sub-unit flooring cadence. Resonance's cross-Bribe batch always fixes the beneficiary to
  `msg.sender`; it does not create an operator or arbitrary receiver. Direct EOA keeper/relayer claims are intentionally
  unavailable, while self-calling smart accounts remain compatible.
- Mine and SignalGBX trust successful `SafeERC20` calls on canonical GBX/USDG without inspecting balance deltas. If
  either canonical token violates its reviewed standard behavior, Mine claims/revenue or sGBX backing can be
  underfunded without a clean revert. Fund retains exact payout and basket checks for arbitrary
  caller-selected assets.
- A broken or blocklisting token can prevent its Strategy purchase, Bribe notification, or user payout. Strategy pays
  Fund directly, so Fund failure reverts the purchase. A later Bribe failure leaves the automatic share buffered in
  BribeRouter. Scalar `removeSignal` remains available because it transfers only the escrowed GBX return.
- Setting the automatic share to 0% is not an emergency pause and does not disable a Strategy or paired Bribe. Existing
  Bribe rewards remain claimable, independently funded rewards remain possible, and signal addition plus live or
  killed-Strategy removal retain their ordinary paths. A zero Bribe share makes no Router transfer.
- A malformed caller-selected token can revert that redemption, but cannot block redemptions that omit
  it.
- Omitted redemption assets are forfeited to the remaining GBX supply.
- Unsolicited tokens sent to Fund become available backing without review or registration.
- Strategy buyers face price movement and competing fills; expected epoch, deadline, and maximum payment protect the
  submitted transaction.
- Bribe work remains linear in the append-only reward-token list, permanently capped at sixteen. All mandatory entry,
  removal, settlement, and all-token-claim paths are therefore bounded, but worst-case work is higher than under the
  former eight-token cap. A broken token reverts the atomic all-token claim, while the scalar-token claim isolates
  every unrelated reward.
- Resonance cross-Bribe claiming adds a caller-controlled outer Strategy loop around each Bribe's bounded all-token
  loop. A large batch may exceed gas, and one invalid Strategy or broken reward token reverts the complete batch.
  Callers can split Strategy arrays and use direct scalar Bribe claims for healthy-token isolation. Registered killed
  Strategies remain valid batch targets.
- Bribe indexing is also bounded per token and per Bribe by a monotonic lifetime accepted-notification cap of
  `floor(type(uint256).max / 1e36)` raw units. The check occurs before checkpointing or transfer and has no reset,
  setter, or escape hatch, so a token cannot accumulate enough indexed precision to wrap and lock exits. For a normal
  18-decimal token this is about `1.158e23` whole tokens and is not expected to be reached; unusually high-decimal,
  mintable, or upgraded tokens can exhaust it earlier in economic terms. Reaching it permanently rejects later
  notifications for that token in that Bribe but leaves existing claims and scalar or batched signal removals
  available.
- If an automatic Strategy-payment reward reaches an exhausted cap, its buffered amount stays in BribeRouter but can
  no longer enter that old Bribe; Fund was already paid atomically with the purchase. The operational
  replacement is a new Strategy with a new Bribe, followed by killing the old Strategy (adding first when the old one
  is the final live Strategy). This does not reopen or drain the old Bribe.
- Killing a Strategy checkpoints and preserves its pre-kill Resonance claim, then excludes its complete recorded weight
  from active revenue allocation. Existing allocations stay reserved and removable, but no later removal subtracts that
  weight again. After bootstrap, killing the final live Strategy is prohibited; the Resonance owner must add a
  replacement first. A zero-active-signal interval can still occur if every user exits all live Strategies.
- Killing a Strategy turns its Bribe into a closed reward pool. Existing signalers may remain indefinitely, earn and
  claim automatic acquired-asset or additionally funded Bribe rewards, or exit incrementally, but neither they nor new
  accounts can add signal.
  If the final signaler exits before active rewards finish, the remainder is permanently abandoned in the
  Bribe. A notification made after `totalSignalWeight` reaches zero is likewise unrecoverable. This amount is unbounded and
  is accepted by ADR 0028 without a retirement, refund, rescue, or Fund-redirection mechanism.
- Fund assets are permanently committed: with no successor or recovery path, an asset that redeemers omit stays in
  Fund for the remaining GBX supply indefinitely.
- The development launcher pins Robinhood Chain mainnet and one Uniswap V2 Factory address, but an address and code
  presence are not provenance checks. A substituted or changed Factory/Pair implementation could violate assumed
  `createPair`, reserve, square-root mint, or LP-lock semantics. Exact runtime hashes and a pinned-state launch
  simulation remain release gates; the recorded Router is not called during genesis.
- Pair creation is not exclusive. The launcher always calls Factory `createPair` and never adopts or skims an existing
  Pair. A precreated Pair reverts with `PairAlreadyExists`. USDG sent to the not-yet-created deterministic Pair leaves
  the lookup zero and instead fails `PAIR_USDG_DEPOSIT` after creation. Either failed launch rolls back and leaves the launcher unused; the operator must deploy a fresh reviewed launcher, whose
  caller-scoped CREATE2 outputs produce a different GBX and Pair. A watcher can attempt the race again, so pinned-state
  simulation and transaction monitoring remain operational requirements.
- The exact one-USDG/1,000-GBX seed produces only about two dollars of nominal reserve value at launch assumptions.
  All `31,622,776,601,683` raw genesis LP units are minted to `address(0)` and cannot be recovered, so a wrong ratio,
  venue, or token cannot be repaired by governance. The lock prevents genesis withdrawal but does not guarantee useful
  depth, USDG value, trading availability, or price stability.
- The launch registers GBX and the actual LP as its two initial Strategy payment tokens at fixed development
  parameters. Both first epochs begin during launch and decay to zero after 24 hours. Because `minimumPrice` resets the
  next epoch rather than flooring a fill, delayed first inventory can be acquired for zero.
- LP minted after genesis remains ordinary fungible property. Fund-held later LP is caller-selectable redemption
  backing and is not burned or locked merely because the genesis LP supply was permanently locked.

## Explicitly absent protections

The starting point has no pause guardian, proxy upgrade path, balance or position migration authority, emission setter, price
oracle, NAV calculation, curated Fund asset list, or per-user signal cooldown. Signal changes are caller-bounded scalar
operations coordinated only by SignalGBX; there is no idle receipt, public batch, or forced whole-account reset. These
omissions are deliberate simplifications and must be reconsidered through testing and audit before any deployment. The
external governance owner, permissions, voting rules, upgrade paths, delay, batching, and cancellation semantics are
also unresolved release gates. Mine's narrow validated future-revenue Router setter is not an old-state rescue or
migration facility. Current internal hardening does not replace independent security review.
