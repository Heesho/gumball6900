# Operations and immutable incident response

> This is a pre-deployment runbook for a development candidate. It is not a signed manifest, authorization to deploy,
> or evidence that any live system has these properties.

GUM BALL 6900 has no pause, guardian, rescue, migration, arbitrary-call executor, or upgrade path. Operations therefore
means verifying public state, warning users, preserving evidence, and using only the three governance actions the
protocol deliberately exposes. Operational urgency never expands that authority.

## Candidate and role-closure rehearsal

Before any external funding or public availability, verify the exact candidate independently from deployment output:

- GBX created exactly 20 million genesis tokens; `minterLocked()` is true; `minter()` is the reviewed Mine; and
  `totalSupply() == lifetimeMinted() - lifetimeBurned()`.
- Mine points to the exact GBX, USDG, and ResonanceRouter; `SLOT_COUNT()` is exactly 16; the tail TPS
  is positive; every immutable emission parameter matches the signed candidate.
- SignalGBX and both factories are permanently bound to the exact Resonance. Resonance is bound to the exact
  ResonanceRouter, USDG, Fund, SignalGBX, and factories.
- Every reviewed initial Strategy was created before ownership handoff. For each Strategy, verify the payment token,
  auction parameters, paired Bribe, paired BribeRouter, Fund, and Resonance registry/liveness state. At least two live
  Strategies are advisable at handoff so governance can kill one without attempting to kill the protected final one.
- Resonance is owned by the reviewed Timelock. ProtocolGovernor is the Timelock's only proposer and only
  canceller-role holder. The zero address has executor role. No external account has default admin, proposer, or
  canceller. No operation was pre-scheduled.
- Governor immutables, block-clock delay/period, threshold, quorum, Timelock delay, and exact three-selector zero-value
  proposal restriction match the signed candidate.
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
| Bribe              | Actual token balance covers accounted rewards; accrued user and Fund liabilities, scheduled rewards, queued rewards, and precision carry reconcile. Reward-token count never exceeds eight.                             |
| Strategy payments  | Each BribeRouter's balance and accounted amount cover its exact Fund and Bribe liabilities; cumulative classification remains 90/10 including the stored remainder.                                                     |
| Fund               | Flag GBX waiting for permissionless burn before redemption calculations; never treat unsolicited or omitted assets as recoverable.                                                                                      |
| Liquidity position | NFT custody, PoolKey, ticks, and fixed principal remain unchanged; harvested USDG and GBX follow their exact revenue and burn destinations.                                                                             |

Also alert before a killed Strategy's final signal exit if its Bribe has scheduled or queued rewards. Once a dead
Strategy reaches zero Bribe supply, nonzero scheduled or queued rewards are permanently unreachable under ADR 0028.
Do not fund that pool and do not report those tokens as recoverable.

## Incident response

| Severity      | Examples                                                                                                                                    | Authorized response                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical      | Supply identity failure, mint authority mismatch, ownership/role mismatch, LP custody or principal change, apparent asset loss              | Freeze project-controlled frontend writes and automation, preserve block-pinned evidence and logs, notify reviewers/users, and determine whether the observation is an indexing error. Do not claim a pause or recovery capability that does not exist. |
| High          | Accounting deficit, unexpected live-weight reconciliation failure, qualifying Router balance not forwarded, repeated exact-transfer failure | Disable the affected project-controlled convenience flow, preserve a minimal reproduction, identify the affected token/path, and disclose the immutable limitation. Other permissionless paths remain available only if their own invariants hold.      |
| Medium        | Dead zero-supply Bribe with scheduled/queued rewards, stalled nonconventional token liability, stale queued governance operation            | Warn affected users and integrators, stop directing new activity to the path, and record the accepted or token-specific liveness consequence. Do not add or imply a rescue route.                                                                       |
| Informational | Expected sub-threshold Router retention, pending Fund GBX burn, accepted floor surplus                                                      | Surface accurate state and guidance; no emergency action is warranted.                                                                                                                                                                                  |

The continuing governance surface is limited to `Resonance.addStrategy`, `Resonance.killStrategy`, and
`Resonance.addBribeReward`. Use of any one still requires an ordinary successful proposal
and Timelock delay. Never use `killStrategy` as a generic emergency pause, and never attempt to kill the final live
Strategy. A queued proposal has no guardian veto; conflicting or stale operations may remain queued and revert.

For every incident, record the chain, block number/hash, candidate manifest identifier if one exists, exact calldata,
contract state reads, transaction traces, tool versions, and whether observations came from RPC, an indexer, or a local
fork. Avoid labels such as “fixed,” “recovered,” or “safe” until exact public evidence supports them.
