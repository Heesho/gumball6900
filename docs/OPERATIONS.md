# Operations and constrained incident response

> This is a pre-deployment runbook for a development candidate. It is not a signed manifest, authorization to deploy,
> or evidence that any live system has these properties.

GumBall6900's core has no pause, guardian, rescue, balance migration, arbitrary-call executor, or upgrade path.
Operations therefore means verifying public state, warning users, preserving evidence, and using only the continuing
Mine and Resonance administration methods. Mine's sole custom owner action may switch the destination of future
protocol revenue after validating a replacement graph; it cannot move old balances or positions. Operational urgency
never expands that authority. The external governance system that may authorize those calls remains unselected, so no
production operation is currently authorized.

## Candidate and ownership-handoff rehearsal

Before any external funding or public availability, verify the exact candidate independently from deployment output.
For the ADR-0054 atomic path, first prove that the launcher is single-use, its immutable authority and six-decimal USDG
are exact, and all four stateless component deployers match reviewed bytecode. Pin Robinhood Chain ID `4663`, the
Factory at `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f`, and the informational Router at
`0x89e5DB8B5aA49aA85AC63f691524311AEB649eba`; address/code presence is not a substitute for runtime hash and provenance
review. The exact `finalOwner` must already contain the independently reviewed governance code and be able to accept
OpenZeppelin two-step ownership for both Mine and Resonance.

The launch authority must hold and approve exactly `1e6` raw USDG. Rehearse expected CREATE addresses, current Pair
state, full calldata, gas sufficiency, rollback, and every postcondition against a pinned target state without
broadcasting. If a launch attempt reverts, its graph and token movement roll back and the launcher remains unused, but
the earlier USDG approval remains; revoke it if that candidate is abandoned.

After a simulated or separately authorized launch, independently verify:

- GBX constructed with zero supply, then Mine issued exactly `1,000 ether` to the Pair after `minterLocked()` became
  true. At launch completion, supply and lifetime minted are `1,000 ether`, lifetime burned and `Mine.totalMined()` are
  zero, `genesisLiquidityMinted()` is true, `genesisAuthority()` is zero, and
  `totalSupply() == lifetimeMinted() - lifetimeBurned()`.
- Mine points to the exact GBX, USDG, Fund, and ResonanceRouter; `SLOT_COUNT()` is exactly 16; `startTime()` equals the
  deployment-block timestamp; `HALVING_PERIOD()` is the reviewed constant; the tail TPS is positive; and every fixed
  emission value matches the signed candidate. Record and minimize the delay from `startTime` to public exposure.
- SignalGBX and both factories are permanently bound to the exact Resonance. Resonance is bound to the exact
  ResonanceRouter, USDG, Fund, SignalGBX, and factories.
- The Factory mapping, Pair-reported Factory, and Pair token identities are exact. Pair balances and reserves are
  `1e6` raw USDG and `1,000 ether` GBX in token order. Total LP supply is `31,622,776,601,683`, all held by
  `address(0)`; neither the launcher nor any controllable account holds genesis LP.
- Exactly two reviewed initial Strategies were created before ownership handoff, first GBX and then the actual Pair.
  Verify each payment token, paired Bribe/Router, Fund, registry/liveness state, 24-hour duration, and `1.2e18`
  multiplier. GBX initial/minimum price is `100,000 ether`; LP initial/minimum is
  `1,581,138,830,084,150` raw LP. Record that both first epochs start during launch and can reach zero before inventory
  arrives; `minimumPrice` starts the following epoch and does not floor the first fill.
- Resonance reports the reviewed initial `bribeBps`, which defaults to 1,000 and is within the inclusive 0-to-2,000
  bound. Every Strategy snapshots that same Resonance rate before payment-token interaction; no Strategy or Router
  exposes an independent override. Reconcile each pre-handoff purchase as an independent floored split, confirm the
  Fund complement arrived atomically, and confirm only the Bribe share entered its paired Router.
- Every paired Bribe reports `REWARD_PRECISION() == 1e36` and
  `MAX_LIFETIME_REWARD_AMOUNT() == floor(type(uint256).max / 1e36)`, and every registered
  token starts with the expected monotonic `lifetimeRewardNotified` value. No deployment or governance component may
  claim a reset, setter, or escape hatch for that capacity.
- The core deploys no Governor or Timelock. SignalGBX retains IVotes checkpoints, but no core voting configuration or
  execution lifecycle is implied by them.
- No production ownership handoff may occur until a later ADR selects the external governance integration. Once
  selected, verify its exact release and bytecode, plugins, SignalGBX binding, voting configuration, permission and
  admin graph, upgrade paths, batching, delay, cancellation behavior, and the transactions proving it accepted both
  Mine and Resonance ownership. Immediately after launch, verify the launcher is owner and the exact governance contract
  is pending owner of both; after acceptance, verify governance is owner and both pending owners are zero.
  Also verify that SignalGBX, StrategyFactory, and BribeFactory are permanently bound and that their consumed
  setup-only plain-`Ownable` shells have been renounced. The launcher has no post-launch entrypoint that can exercise its
  temporary formal ownership, and the final governance contract must complete both acceptances before public exposure.

The launcher always calls Factory `createPair` and never adopts or skims an existing Pair. If a Pair already exists for
the launcher's deterministic GBX, the launcher reverts with `PairAlreadyExists`. USDG sent to the not-yet-created Pair
address instead leaves the lookup zero and fails `PAIR_USDG_DEPOSIT` after creation. Abandon that unused launcher and
deploy a fresh reviewed launcher; its caller-scoped CREATE2 outputs produce a different GBX and Pair. Permanent genesis
LP locking makes a wrong successful venue or ratio unrecoverable.

If any setup check fails before external funding, abandon the candidate and deploy a new reviewed candidate. Do not
repair a launch graph by improvising a privileged transfer or undocumented authority. After external funding, the only
recorded replacement path is ADR 0055's governed prospective Mine revenue cutover; it does not migrate old balances,
positions, claims, or rewards.

## Read-only monitoring

Monitor these identities and conservation checks from finalized chain data. Alert on disagreement; do not silently
substitute indexed data for contract state.

| Surface           | Check                                                                                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GBX               | Supply equals lifetime minted minus lifetime burned; minter remains the locked Mine; lifetime minted equals `Mine.totalMined()` plus the consumed fixed genesis amount.                                                                                                                                       |
| Mine              | Genesis issuance remains consumed with zero authority; current Router and owner/pending-owner state match governance receipts; slot count remains 16; cached pending/TPS equal per-slot sums; claims are solvent; record `startTime`, elapsed era, prospective TPS, next 69-day boundary, and exposure delay. |
| Signaling         | SignalGBX supply equals GBX backing; each account aggregate equals its Strategy allocations; each Strategy's paired-Bribe `totalSignalWeight` equals that Strategy weight; Resonance active weight equals the sum of live Strategy weights.                                                                   |
| Resonance         | USDG balance covers accrued Strategy claims and `remainingRevenue`; accepted rate/index floors and zero-signal time remain surplus; dead Strategy weight is excluded; at least one Strategy remains live.                                                                                                     |
| Revenue routers   | Reconcile every historical and current Router balance, `remainingRevenue`, `REWARD_DURATION`, route attempt, `RevenueHeld`, and `RevenueRouted`; map each Mine `RevenueDeposited` to the Router current at that block. A balance below either threshold waits for another deposit or elapsed stream time.     |
| Bribe             | For each token, reconcile `rewardRate`, `periodFinish`, `remainingReward`, claims, and actual balance while treating rate/index/account floors as surplus; token count is at most sixteen and lifetime notifications remain bounded.                                                                          |
| Strategy payments | For every purchase, reconcile `floor(payment * appliedBribeBps / 10,000)` in the paired Router and the direct complement in Fund; Router donations join the next complete qualifying route.                                                                                                                   |
| Bribe rate        | Resonance's global rate remains within 0-2,000 basis points; every change matches governance execution, and no change mutates an earlier Fund transfer, buffered Bribe amount, active stream, or claim.                                                                                                       |
| Fund              | Flag GBX waiting for permissionless burn before redemption calculations; never treat unsolicited or omitted assets as recoverable.                                                                                                                                                                            |
| Genesis Pair      | Factory/token identities, exact locked genesis LP supply, and seed reserves remain observable; do not infer reserve value, stable price, or guaranteed liquidity. Later Fund-held LP remains ordinary caller-selected redemption backing.                                                                     |

## Governed future-revenue cutover

Treat `Mine.setResonanceRouter` as a high-risk governance change, not an emergency button. Before execution:

1. Deploy and fully bind the replacement Router, Resonance, SignalGBX, factories, initial Strategies, Bribes, and
   BribeRouters without touching Mine.
2. Verify exact runtime code and constructor provenance, not only getters. The candidate must report Mine's immutable
   USDG; its deployed Resonance must reciprocally report that Router, the same USDG, and Mine's immutable Fund; and its
   SignalGBX must reciprocally report that Resonance and Mine's immutable GBX. Separately verify the new Resonance owner,
   factory bindings, live Strategy set, Bribe rate, lifetime counters, and intended pristine or explicitly reconciled
   schedule state; Mine does not check them.
3. Simulate the exact governance call and record the old Router, new Router, new Resonance, proposal or permission
   evidence, delay, cancellation status, and execution block. The new Router must differ from the current Router.
4. Preserve old-graph discovery and write paths. Publish clear user steps to claim old Bribe rewards, remove old signal
   to recover GBX, and optionally signal that GBX into a live Strategy in the new graph. Never imply that Mine moved the
   user's position or guaranteed the old exit path.
5. Review the external governance token transition. A new graph has a new SignalGBX address; governance configured for
   old SignalGBX checkpoints will not recognize new sGBX automatically. Prove that users can exit old signal without
   destroying voting power required to authorize or finish the cutover.
6. Switch Mine last. Verify the update event and Mine pointer, then reconcile the first future empty-slot or nonempty-
   replacement deposit into the new Router. Keep routing and monitoring old Router balances independently.

USDG already buffered in the old Router, scheduled or surplus USDG in old Resonance, Strategy claims, Bribe rewards,
and sGBX positions remain there. There is no forced migration, sweep, cross-graph claim, or state copy. If the old
graph's own unsignal path is broken, changing Mine cannot repair that existing position.

Also alert before a killed Strategy's final signal exit if its Bribe still has an active reward stream. Reward time
does not pause at zero `totalSignalWeight`, so rewards elapsed after the last exit are not later allocated. Do not fund that pool
and do not report unallocated token surplus as recoverable.

Alert before a registered token approaches its Bribe's lifetime notification cap. At the cap, later notifications
revert before checkpointing or transfer, but claims and scalar or batched signal removals remain available. If the
exhausted token is the Strategy payment token, later automatic Bribe shares remain buffered in BribeRouter and cannot
enter that old Bribe; each purchase's Fund share has already transferred directly. The available administration
response is to add a new Strategy and paired Bribe, remove signal from the old Strategy, add it to the replacement, and
kill the old Strategy. Add the replacement first if the old one is the final live Strategy. Do not describe this as
resetting, rescuing, or reopening the old pool.

For every Bribe-rate change, record the authorization, old and new basis points, execution block, and the first
Strategy payments on both sides of the transition. Reconcile each purchase independently using
`floor(payment * appliedBribeBps / 10_000)`, the direct Fund complement, and the paired Router balance. At 0%, verify
that new payments reach Fund completely and that scalar or batched additions, partial and full removals,
killed-Strategy exit, previously buffered Bribe routing, existing reward claims, and independent reward funding remain
available.

## Permissionless revenue routing

A paid Mine replacement is operationally complete when Mine's `SafeERC20` request transfers the nominal protocol share to
ResonanceRouter and Mine emits `RevenueDeposited`. Monitoring may treat the requested amount as delivered only under
the reviewed standard-USDG assumption; Mine does not observe sender or receiver balance deltas. Do not report that
event as a Resonance notification or active stream restart. The later
`ResonanceRouter.route()` call is permissionless and has no keeper role, bounty, reimbursement, or guaranteed caller.
Revenue can remain in the Router indefinitely even after its balance qualifies.

Project-operated automation is optional periphery. A frontend may expose a route button, and an unprivileged cron or
volunteer keeper may call `route()` after checking the USDG balance against both `REWARD_DURATION` and
`remainingRevenue()`. Record those three values, the submitted transaction, and either `RevenueHeld` or the Router's
`RevenueRouted`. An empty Router
reverts `NoRevenue`; a balance below either threshold is held without advancing the schedule. The duration gate is
required because a smaller raw-unit notification would produce a zero whole-unit revenue rate. Failure inside Router or
Resonance affects only that route attempt and cannot roll back an earlier Mine replacement. A future frontend helper may
offer mine-then-route composition, but it is not required now and must never make Mine correctness or liveness depend
on routing success.

## Permissionless Bribe-buffer routing

A successful Strategy purchase has already delivered its Fund share and, when nonzero, placed only its Bribe share in
the paired BribeRouter. Any account may call `BribeRouter.route()`. The call returns zero without changing state
when the Router is empty, and it leaves a nonzero balance buffered until that complete balance is at least both the
Bribe's `REWARD_DURATION` and its current `remainingReward(paymentToken)`. The duration gate prevents a zero
whole-unit rate; the remaining-reward gate satisfies the standard Synthetix top-up rule. Compatible direct donations
are included in the complete
balance.

Record the Router balance, both thresholds, transaction, `RewardRouted` event, resulting Bribe rate/finish, and
cleared allowance. If notification fails, the transaction reverts and the balance remains in BribeRouter for a later
retry. That failure cannot reverse an earlier Strategy purchase or its direct Fund transfer.

Before every Mine halving boundary, surface the exact boundary timestamp and prospective post-boundary TPS. A replacement
deadline equal to the boundary still permits execution at that boundary; interfaces that promise the quoted TPS must
set the deadline strictly earlier and derive it from a pinned block timestamp, never a local wall clock. Record
replacements on both sides of each boundary because either assigned tenure rate can persist indefinitely.

## Incident response

| Severity      | Examples                                                                                                                                                                                      | Authorized response                                                                                                                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Critical      | Supply/genesis identity failure, mint authority mismatch, launch ownership mismatch, unauthorized Router change, wrong Pair lock, or apparent asset loss                                      | Freeze project-controlled frontend writes and automation, preserve block-pinned evidence and logs, notify reviewers/users, and determine whether the observation is an indexing error. Do not claim a pause or balance-recovery capability that does not exist.                                                          |
| High          | Accounting deficit, unexpected live-weight reconciliation failure, a qualifying route failing, a reviewed Router graph becoming unusable, or a standard-token transfer unexpectedly reverting | Disable the affected project-controlled convenience flow, preserve a minimal reproduction, identify the affected token/path, and disclose the limitation. A replacement proposal may redirect only future Mine revenue after full review; other permissionless paths remain available only if their own invariants hold. |
| Medium        | Dead zero-weight Bribe with an active stream, exhausted Bribe notification cap, stalled unsupported token buffer, or unexpected governance or Bribe-rate state                                | Warn affected users and integrators, stop directing new activity to the path, and record the accepted or token-specific liveness consequence. Do not add or imply a rescue route.                                                                                                                                        |
| Informational | Expected Router retention without a route attempt, sub-threshold retention, pending Fund GBX burn, accepted floor surplus                                                                     | Surface accurate state and guidance; no emergency action is warranted.                                                                                                                                                                                                                                                   |

The continuing custom protocol administration surface is limited to `Mine.setResonanceRouter`,
`Resonance.addStrategy`, `Resonance.killStrategy`, `Resonance.addBribeRewardToken`, and bounded global
`Resonance.setBribeBps`, plus inherited two-step ownership transfer and immediate renunciation on Mine and Resonance.
The external authorization and execution rules for those calls are not selected. Never use
`killStrategy` or a 0% Bribe rate as a generic emergency pause, and never attempt to kill the final live Strategy. Do
not assume a proposal delay, cancellation path, guardian, open executor, or atomic batch until the exact external
integration proves it.

For every incident, record the chain, block number/hash, candidate manifest identifier if one exists, exact calldata,
contract state reads, transaction traces, tool versions, and whether observations came from RPC, an indexer, or a local
fork. Avoid labels such as “fixed,” “recovered,” or “safe” until exact public evidence supports them.
