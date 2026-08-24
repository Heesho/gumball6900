# Operations and immutable incident response

> This is a pre-deployment runbook for a development candidate. It is not a signed manifest, authorization to deploy,
> or evidence that any live system has these properties.

GumBall6900's core has no pause, guardian, rescue, migration, arbitrary-call executor, or upgrade path. Operations
therefore means verifying public state, warning users, preserving evidence, and using only the continuing Resonance
administration methods, including the bounded global Bribe-rate setter. Operational urgency never expands that
authority. The external governance system that may authorize those calls remains unselected, so no production
operation is currently authorized.

## Candidate and ownership-handoff rehearsal

Before any external funding or public availability, verify the exact candidate independently from deployment output:

- GBX started with zero supply and zero lifetime minted; `minterLocked()` is true; `minter()` is the reviewed Mine;
  Mine is the only lifetime issuer; and `totalSupply() == lifetimeMinted() - lifetimeBurned()`.
- Mine points to the exact GBX, USDG, and ResonanceRouter; `SLOT_COUNT()` is exactly 16; `startTime()` equals the
  deployment-block timestamp; `HALVING_PERIOD()` is the reviewed constant; the tail TPS is positive; and every fixed
  emission value matches the signed candidate. Record and minimize the delay from `startTime` to public exposure.
- SignalGBX and both factories are permanently bound to the exact Resonance. Resonance is bound to the exact
  ResonanceRouter, USDG, Fund, SignalGBX, and factories.
- Every reviewed initial Strategy was created before ownership handoff. For each Strategy, verify the payment token,
  auction parameters, paired Bribe, paired BribeRouter, Fund, and Resonance registry/liveness state. At least two live
  Strategies are advisable at handoff so the eventual Resonance owner can kill one without attempting to kill the
  protected final one.
- Verify one reviewed, externally created fungible Uniswap v2-style USDG/GBX LP ERC-20 is present as an ordinary
  bootstrap Strategy payment token.
  Its address is a deployment input and it exposes no liquidity-specific core configuration.
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
  admin graph, upgrade paths, batching, delay, cancellation behavior, and the transaction proving it owns Resonance.
  Also verify that SignalGBX, StrategyFactory, and BribeFactory are permanently bound and that their consumed
  setup-only ownership shells have been renounced. The temporary setup owner must retain no authority.

If any setup check fails before external funding, abandon the candidate and deploy a new reviewed candidate. Do not
repair an immutable graph by improvising a successor, privileged transfer, or undocumented authority. After external
funding, there is no protocol migration path.

## Read-only monitoring

Monitor these identities and conservation checks from finalized chain data. Alert on disagreement; do not silently
substitute indexed data for contract state.

| Surface           | Check                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GBX               | Supply equals lifetime minted minus lifetime burned; minter remains the locked Mine.                                                                                                                                                        |
| Mine              | Slot count remains 16; cached pending/TPS equal per-slot sums; claims are solvent; record `startTime`, elapsed era, formula-derived prospective TPS, next 69-day boundary, and deployment-to-exposure delay.                                |
| Signaling         | SignalGBX supply equals GBX backing; each account aggregate equals its Strategy allocations; each Strategy's paired-Bribe `totalSignalWeight` equals that Strategy weight; Resonance active weight equals the sum of live Strategy weights. |
| Resonance         | USDG balance covers accrued Strategy claims and `remainingRevenue`; accepted rate/index floors and zero-signal time remain surplus; dead Strategy weight is excluded; at least one Strategy remains live.                                   |
| Revenue router    | Reconcile Mine `RevenueDeposited`, Router balance, `remainingRevenue`, `REWARD_DURATION`, route attempts, `RevenueHeld`, and `RevenueRouted`; a balance below either threshold waits for another deposit or elapsed stream time.            |
| Bribe             | For each token, reconcile `rewardRate`, `periodFinish`, `remainingReward`, claims, and actual balance while treating rate/index/account floors as surplus; token count is at most sixteen and lifetime notifications remain bounded.        |
| Strategy payments | For every purchase, reconcile `floor(payment * appliedBribeBps / 10,000)` in the paired Router and the direct complement in Fund; Router donations join the next complete qualifying route.                                                 |
| Bribe rate        | Resonance's global rate remains within 0-2,000 basis points; every change matches governance execution, and no change mutates an earlier Fund transfer, buffered Bribe amount, active stream, or claim.                                     |
| Fund              | Flag GBX waiting for permissionless burn before redemption calculations; never treat unsolicited or omitted assets as recoverable.                                                                                                          |
| External LP asset | The reviewed, externally created fungible Uniswap v2-style USDG/GBX LP token remains an ordinary Strategy payment token; do not infer reserve value, price, or guaranteed market liquidity from core state.                                 |

Also alert before a killed Strategy's final signal exit if its Bribe still has an active reward stream. Reward time
does not pause at zero `totalSignalWeight`, so rewards elapsed after the last exit are not later allocated. Do not fund that pool
and do not report unallocated token surplus as recoverable.

Alert before a registered token approaches its Bribe's lifetime notification cap. At the cap, later notifications
revert before checkpointing or transfer, but claims, signal moves, and withdrawals remain available. If the exhausted
token is the Strategy payment token, later automatic Bribe shares remain buffered in BribeRouter and cannot enter that
old Bribe; each purchase's Fund share has already transferred directly. The available administration response is to
add a new Strategy and paired Bribe, move activity to it, and kill the old Strategy. Add the replacement first if the
old one is the final live Strategy. Do not describe this as resetting, rescuing, or reopening the old pool.

For every Bribe-rate change, record the authorization, old and new basis points, execution block, and the first
Strategy payments on both sides of the transition. Reconcile each purchase independently using
`floor(payment * appliedBribeBps / 10_000)`, the direct Fund complement, and the paired Router balance. At 0%, verify
that new payments reach Fund completely and that signal, move, partial and full withdrawal, killed-Strategy exit,
previously buffered Bribe routing, existing reward claims, and independent reward funding remain available.

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

| Severity      | Examples                                                                                                                                                       | Authorized response                                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical      | Supply identity failure, mint authority mismatch, ownership/role mismatch, or apparent asset loss                                                              | Freeze project-controlled frontend writes and automation, preserve block-pinned evidence and logs, notify reviewers/users, and determine whether the observation is an indexing error. Do not claim a pause or recovery capability that does not exist. |
| High          | Accounting deficit, unexpected live-weight reconciliation failure, a qualifying route failing, or a standard-token transfer unexpectedly reverting             | Disable the affected project-controlled convenience flow, preserve a minimal reproduction, identify the affected token/path, and disclose the immutable limitation. Other permissionless paths remain available only if their own invariants hold.      |
| Medium        | Dead zero-weight Bribe with an active stream, exhausted Bribe notification cap, stalled unsupported token buffer, or unexpected governance or Bribe-rate state | Warn affected users and integrators, stop directing new activity to the path, and record the accepted or token-specific liveness consequence. Do not add or imply a rescue route.                                                                       |
| Informational | Expected Router retention without a route attempt, sub-threshold retention, pending Fund GBX burn, accepted floor surplus                                      | Surface accurate state and guidance; no emergency action is warranted.                                                                                                                                                                                  |

The continuing protocol administration surface is limited to `Resonance.addStrategy`, `Resonance.killStrategy`,
`Resonance.addBribeRewardToken`, and bounded global `Resonance.setBribeBps`, plus inherited ownership transfer and
renunciation. The external authorization and execution rules for those calls are not selected. Never use
`killStrategy` or a 0% Bribe rate as a generic emergency pause, and never attempt to kill the final live Strategy. Do
not assume a proposal delay, cancellation path, guardian, open executor, or atomic batch until the exact external
integration proves it.

For every incident, record the chain, block number/hash, candidate manifest identifier if one exists, exact calldata,
contract state reads, transaction traces, tool versions, and whether observations came from RPC, an indexer, or a local
fork. Avoid labels such as “fixed,” “recovered,” or “safe” until exact public evidence supports them.
