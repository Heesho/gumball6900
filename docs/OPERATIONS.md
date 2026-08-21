# Operations and immutable incident response

> This is a pre-deployment runbook for a development candidate. It is not a signed manifest, authorization to deploy,
> or evidence that any live system has these properties.

GUM BALL 6900's core has no pause, guardian, rescue, migration, arbitrary-call executor, or upgrade path. Operations
therefore means verifying public state, warning users, preserving evidence, and using only the continuing Resonance
administration methods, including the bounded global Bribe-rate setter. Operational urgency never expands that
authority. The external governance system that may authorize those calls remains unselected, so no production
operation is currently authorized.

## Candidate and ownership-handoff rehearsal

Before any external funding or public availability, verify the exact candidate independently from deployment output:

- GBX created exactly 20 million genesis tokens; `minterLocked()` is true; `minter()` is the reviewed Mine; and
  `totalSupply() == lifetimeMinted() - lifetimeBurned()`.
- Mine points to the exact GBX, USDG, and ResonanceRouter; `SLOT_COUNT()` is exactly 16; the tail TPS
  is positive; every immutable emission parameter matches the signed candidate.
- SignalGBX and both factories are permanently bound to the exact Resonance. Resonance is bound to the exact
  ResonanceRouter, USDG, Fund, SignalGBX, and factories.
- Every reviewed initial Strategy was created before ownership handoff. For each Strategy, verify the payment token,
  auction parameters, paired Bribe, paired BribeRouter, Fund, and Resonance registry/liveness state. At least two live
  Strategies are advisable at handoff so the eventual Resonance owner can kill one without attempting to kill the
  protected final one.
- Resonance reports the reviewed initial `bribeBps`, which defaults to 1,000 and is within the inclusive 0-to-2,000
  bound. Every Router reads the same Resonance rate; no Strategy or Router exposes an independent override. Reconcile
  each pre-handoff payment against the rate applied at its classification block and preserve its weighted carry.
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
- The reviewed hookless GBX/USDG position has the exact PoolKey, ticks, liquidity, principal, NFT ID, and permanent
  LiquidityPosition custody. The NFT is not recoverable.

If any setup check fails before external funding, abandon the candidate and deploy a new reviewed candidate. Do not
repair an immutable graph by improvising a successor, privileged transfer, or undocumented authority. After external
funding, there is no protocol migration path.

## Read-only monitoring

Monitor these identities and conservation checks from finalized chain data. Alert on disagreement; do not silently
substitute indexed data for contract state.

| Surface            | Check                                                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GBX                | Supply equals lifetime minted minus lifetime burned; minter remains the locked Mine.                                                                                                                                    |
| Mine               | Slot count remains 16; cached pending/TPS equal the per-slot sums; each slot's accrued and claimed accounting is solvent.                                                                                               |
| Signaling          | SignalGBX supply equals GBX backing; each account aggregate equals its Strategy allocations; each Strategy's Bribe supply equals that Strategy weight; Resonance active weight equals the sum of live Strategy weights. |
| Resonance          | USDG balance covers accrued Strategy claims plus the exact scheduled remainder; dead Strategy weight is excluded; at least one Strategy remains live.                                                                   |
| Revenue router     | A retained nonzero balance is expected only while it is below the exact active-period amount left; a qualifying balance should route completely.                                                                        |
| Bribe              | Actual token balance covers accounted rewards; liabilities, schedules, queues, and carry reconcile; token count is at most eight; each monotonic lifetime notification total is at or below its fixed raw-unit cap.     |
| Strategy payments  | Each BribeRouter's balance and accounted amount cover its exact Fund and Bribe liabilities; weighted classification reconciles against every payment's applied global rate and the stored remainder.                    |
| Bribe rate         | Resonance's global rate remains within 0-2,000 basis points; every change matches governance execution, and no change mutates an existing Router liability, stream, claim, or carry.                                    |
| Fund               | Flag GBX waiting for permissionless burn before redemption calculations; never treat unsolicited or omitted assets as recoverable.                                                                                      |
| Liquidity position | NFT custody, PoolKey, ticks, and fixed principal remain unchanged; harvested USDG and GBX follow their exact revenue and burn destinations.                                                                             |

Also alert before a killed Strategy's final signal exit if its Bribe has scheduled or queued rewards. Once a dead
Strategy reaches zero Bribe supply, nonzero scheduled or queued rewards are permanently unreachable under ADR 0028.
Do not fund that pool and do not report those tokens as recoverable.

Alert before a registered token approaches its Bribe's lifetime notification cap. At the cap, later notifications
revert before checkpointing or transfer, but claims, signal moves, and withdrawals remain available. If the exhausted
token is the Strategy payment token, its automatic reward liability remains in BribeRouter and cannot enter that old
Bribe; permissionless Fund settlement remains independent. The available administration response is to add a new
Strategy and paired Bribe, move activity to it, and kill the old Strategy. Add the replacement first if the old one is
the final live Strategy. Do not describe this as resetting, rescuing, or reopening the old pool.

For every Bribe-rate change, record the authorization, old and new basis points, execution block, and the first
Strategy payments classified on both sides of the transition. Reconcile each Router using
`floor(sum(payment * appliedBribeBps) / 10_000)` and the corresponding modulo remainder. At 0%, verify that new
payments create only Fund liability and that signal, move, partial and full withdrawal, killed-Strategy exit, prior
Bribe-liability settlement, existing reward claims, and independent reward funding remain available. A change back to
a nonzero rate must preserve and continue the prior weighted remainder rather than reset it.

## Incident response

| Severity      | Examples                                                                                                                                                                   | Authorized response                                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical      | Supply identity failure, mint authority mismatch, ownership/role mismatch, LP custody or principal change, apparent asset loss                                             | Freeze project-controlled frontend writes and automation, preserve block-pinned evidence and logs, notify reviewers/users, and determine whether the observation is an indexing error. Do not claim a pause or recovery capability that does not exist. |
| High          | Accounting deficit, unexpected live-weight reconciliation failure, qualifying Router balance not forwarded, repeated exact-transfer failure                                | Disable the affected project-controlled convenience flow, preserve a minimal reproduction, identify the affected token/path, and disclose the immutable limitation. Other permissionless paths remain available only if their own invariants hold.      |
| Medium        | Dead zero-supply Bribe with scheduled/queued rewards, exhausted Bribe notification cap, stalled nonconventional token liability, unexpected governance or Bribe-rate state | Warn affected users and integrators, stop directing new activity to the path, and record the accepted or token-specific liveness consequence. Do not add or imply a rescue route.                                                                       |
| Informational | Expected sub-threshold Router retention, pending Fund GBX burn, accepted floor surplus                                                                                     | Surface accurate state and guidance; no emergency action is warranted.                                                                                                                                                                                  |

The continuing protocol administration surface is limited to `Resonance.addStrategy`, `Resonance.killStrategy`,
`Resonance.addBribeReward`, and bounded global `Resonance.setBribeBps`, plus inherited ownership transfer and
renunciation. The external authorization and execution rules for those calls are not selected. Never use
`killStrategy` or a 0% Bribe rate as a generic emergency pause, and never attempt to kill the final live Strategy. Do
not assume a proposal delay, cancellation path, guardian, open executor, or atomic batch until the exact external
integration proves it.

For every incident, record the chain, block number/hash, candidate manifest identifier if one exists, exact calldata,
contract state reads, transaction traces, tool versions, and whether observations came from RPC, an indexer, or a local
fork. Avoid labels such as “fixed,” “recovered,” or “safe” until exact public evidence supports them.
