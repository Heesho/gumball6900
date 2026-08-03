# GUM BALL 6900 Operations

Status: production-operations baseline. Ownership, alert destinations, RPC providers, multisig signers, and service
levels are unresolved until recorded in a signed release manifest and rehearsed with the actual operators.

## Operating posture

The protocol is designed for permissionless routine progress and minimal intervention:

- anyone may settle ended mining epochs, checkpoint mature signals, claim for a beneficiary, restart expired auctions,
  sweep queued manager terminal dust or a completed liquidity range through its constrained recipient path, and
  trigger supported maintenance calls;
- protocol automation improves availability but is not trusted with asset custody or generic execution;
- the guardian stops only new risk and cannot stop redemption, unstaking, burns, refunds, settled claims, or accrued
  reward claims;
- timelocked maintenance uses exact target/selector/argument bounds; and
- operators never infer NAV or use an offchain price to mutate protocol accounting.

## Operational roles

| Role                               | Routine responsibility                                                           | Authority limit                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Keeper operators                   | Epochs, checkpoints, auction restarts, dust/range sweeps, fee routing.           | Permissionless methods only; no privileged key.                   |
| Observability on-call              | Validate alerts against direct chain reads, coordinate response, publish status. | Read-only credentials; cannot move funds.                         |
| EmergencyGuardian multisig         | Pause new exposure and disable broken acquisition.                               | Cannot move assets or pause protected exits/claims.               |
| ProtocolTimelock proposer multisig | Propose validated bounded maintenance with evidence.                             | Cannot bypass target-side checks or shorten immutable delay.      |
| ProtocolTimelock executor          | Execute matured, byte-for-byte reviewed operations.                              | Executes only the queued action; no discretionary calldata edits. |
| Compliance operator                | Maintain approved production eligibility registry, if selected.                  | No mint, vault, rewards, claims, or LP authority.                 |
| Release operators                  | Generate/verify manifests, reproduce builds, deploy, verify, close roles.        | Separate ceremony; no automatic GitHub mainnet deploy.            |
| Security response lead             | Own incident severity, containment coordination, and evidence.                   | Uses only existing bounded controls.                              |

Signers should be organizationally and technically separated. A person who prepares a timelock payload should not be
its only reviewer or executor.

Emergency asset and standalone-strategy disables are atomic across the guardian's permanently bound registry and
voter. Operators submit only the token or standalone strategy address; they cannot substitute a registry or voter.
Confirm both the registry status event and `AllocationVoter__StrategyDisabled` in the same receipt.

## Required telemetry

Index finalized events and reconcile them with direct reads. The subgraph is useful but never authoritative.

| Domain         | Monitor                                                                                                            | Critical condition                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Supply         | `cumulativeMinted`, `cumulativeBurned`, `totalSupply`, remaining capacity.                                         | Supply identity or cap mismatch.                                                            |
| Genesis        | State, accepted community USDG, sponsor escrow/requirement, deadline, refundability.                               | Settlement eligible without exact backing or refunds unavailable after failure.             |
| Mining         | Epoch time/extensions, contribution, schedule, actual emission, clearing/reference updates, settlement lag.        | Unexpected mint, double settlement, schedule not advancing, or prolonged ended epoch.       |
| Claims         | Claims-held GBX, entitlements, claims, expiry burns.                                                               | Outflow to non-beneficiary, replay, expired transfer instead of burn.                       |
| Vault          | Raw registered balances, asset set, transfer failures, redemption events.                                          | Unknown privileged outflow, asset mismatch, or repeated redemption revert.                  |
| Allocation     | Revenue notifications, index, remainder, live weights, budgets, idle USDG.                                         | Budgets exceed physical USDG or dead weight remains.                                        |
| Signals        | Stake, active/pending weights, activation, reset, unstake.                                                         | User weight exceeds stake or same-block increase becomes active.                            |
| Strategies     | Auction ID/rate/expiry, budget, fill amounts, target delta, 98/2 delivery, USDG release.                           | USDG release before target, split mismatch, zero rate, stale fill, or disabled-asset fill.  |
| Rewards        | Notifications, remainder, accrued/claimed balances, live weight, finalized/pending/redirected terminal dust.       | Reconciliation mismatch, unauthorized notification, payout excess, or stuck sweep.          |
| Buyback        | USDG spent, GBX received/burned, net supply change.                                                                | GBX not burned before USDG release or manager reward paid.                                  |
| Liquidity      | PoolKey, tick, active count (maximum 16), positions/NFT owner, principal, fees, completed ranges, migration queue. | NFT owner changes unexpectedly, count drift/overflow, arbitrary recipient, hook/code drift. |
| Assets         | Registry address/status, code hash, symbol, decimals, UID, multiplier, pending action, transfer pause.             | Address/code/status drift, inactive asset, trading halt, or failed transfer probe.          |
| Access         | Timelock queue/execution, guardian actions, compliance changes, role holders, deployer roles.                      | Unknown selector, delay bypass, new generic authority, signer/threshold drift.              |
| Infrastructure | RPC height/latency/error, indexer lag/reorgs, UI stale state, keeper balances.                                     | Divergent finalized state, all RPCs unavailable, or UI writes against stale chain.          |

Every financial event record includes chain ID, block, timestamp, transaction hash, and log coordinates. Alert
systems should compare at least two independent RPCs before declaring a chain-state invariant breach.

## Keeper routines

### Mining settlement

1. Confirm the epoch ended including anti-sniping extensions.
2. Simulate settlement against a finalized block and compare scheduled/affordable/actual emission with independent
   reference fixtures.
3. Submit only the permissionless settlement method.
4. Confirm complete USDG vault receipt, allocation notification, claims mint, reference/schedule update, and event.
5. Alert if an ended epoch remains unsettled beyond the published service objective; another keeper may take over.

### Signal checkpoints

Checkpoint mature pending changes when economically reasonable, especially before revenue notification and strategy
fills. Never activate a weight before its timestamp. Checkpointing cannot be used to redirect historical revenue.

### Manager reward terminal dust

1. Index `ManagerRewards__TerminalDustQueued` by chain ID, rewards contract, generation, and remainder cycle. Keeper
   clients must derive the complete rewards-contract set from the registry/Lens at the indexed block, not from a fixed
   launch-asset list. Traverse chain-scoped ID pages at one block hash until complete; a 128-row page is a request bound,
   not a global queue limit.
2. A zero-amount event proves the cycle finalized and requires no sweep. For a nonzero event, reconcile generation
   notification against whole entitlements plus finalized dust, and finalized dust against pending plus redirected.
3. Submit `sweepTerminalDust(generation, remainderCycle)` through any permissionless keeper. Confirm the exact
   ManagerRewards debit, GumBallVault credit, pending reduction, and redirected increase.
4. If the exact token transfer reverts, confirm the same pending amount remains in `accountedRewards` and retry only
   after investigating the token condition. Do not treat that failure as a failed signal reset or unstake: terminal
   finalization made no token call and those operations have already completed independently.
5. Alert on prolonged nonzero pending dust or repeated sweep failure. Disable new acquisition through the documented
   bounded path if the asset behavior warrants it; a keeper gains no authority to choose another recipient.

### Auction upkeep

- Track current auction ID, live budget, start/floor rate, expiry, and asset registry/trading status.
- Restart only expired auctions through the permissionless path.
- Do not use operator market-price judgment to mutate a reference. A reset requires the exact timelocked bounded path.
- Market-maker absence is not a custody emergency; budgeted USDG remains in GumBallVault and redeemable.

### Liquidity upkeep

Collect fees and sweep a fully completed range through constrained methods. Confirm USDG routes to GumBallVault and
allocation, GBX fees burn, NFT custody remains LiquidityManager, and residual principal follows the approved path.
Never use an EOA recipient. Migration is exceptional, precommitted, seven-day delayed, simulated, and publicly
reviewed.

## Daily controls

- Reconcile supply, vault balances, strategy budgets, total signal weight, reward liabilities including pending
  terminal dust, and LP ownership.
- Confirm no protected operation is paused and every pause state matches an authorized guardian event.
- Review ended epochs, mature signals, queued terminal-dust sweeps, expired auctions, completed LP ranges, and fee
  balances.
- Compare asset registry status, candidate addresses, code hashes, multipliers, pending corporate actions, and trading
  halts with cached official data. Offchain data can alert but never mutate contract state.
- Check timelock proposals, remaining delay, decoded calldata, proposer/executor identity, and supporting evidence.
- Confirm RPC/indexer freshness and direct-read fallback.
- Publish a signed exception report for any mismatch; do not silently acknowledge an alert.

## Weekly controls

- Re-run deterministic build and role/peer scans against the public deployment manifest.
- Reconcile all revenue notifications with newly deposited vault USDG and all manager notifications with actual target
  receipt.
- Review keeper funding and failover without giving keepers privileged authority.
- Exercise read-only RPC and subgraph failover.
- Review multisig membership, signer availability, hardware-wallet health, and threshold without changing roles.
- Sample web redemption previews against direct vault snapshots and exact bigint calculations.
- Review unresolved risks, incident tickets, dependency advisories, and issuer/bridge notices.

Live manifest generation is not a routine CI task. Schedule it as a controlled drift review, with an explicit
observation timestamp, pinned block, two-provider comparison, and human approval before any baseline changes.

## Timelock procedure

1. Open an operation record with purpose, target, selector, full decoded arguments, affected invariant, simulation,
   rollback/containment, and reviewer identities.
2. Confirm the call is in the documented bounded allowlist and cannot transitively reach arbitrary vault execution.
3. Reproduce calldata independently and compare its hash.
4. Queue with the correct 48-hour or seven-day minimum.
5. Publish transaction and evidence; monitor for unexpected state before maturity.
6. Immediately before execution, re-simulate at current finalized state and re-check external asset status.
7. Execute the exact queued payload. Never replace a failed payload with an improvised call.
8. Reconcile events/state and close the record. Escalate any mismatch as an incident.

## Guardian procedure

Guardian action is justified only to stop new exposure. The signer package states the observed condition, affected
asset/function, exact pause/disable selector, protected operations verified available, and exit criteria.

After execution, verify redemption, unstaking, reductions/resets, burns, refunds, settled claims, accrued reward
claims, and vault-directed fee sweeps remain callable. Guardian rotation is timelocked; the guardian cannot rotate
itself.

## Asset lifecycle

### Admission

Admission requires official identity/status, live bytecode and hash, symbol/decimals/UID/multiplier, supported transfer
behavior, issuer/bridge/proxy/admin review, legal/compliance approval, acquisition strategy/rewards tests, seven-day
queue, and asset-cap availability. The ticker is never identity.

### Degradation

On inactive registry status, trading halt, transfer anomaly, code change, issuer notice, or bridge incident, stop new
acquisition through the guardian if warranted. Existing raw vault balance remains a GBX claim and cannot be swept or
removed while nonzero.

### Removal

V1 cannot remove a redemption asset while the vault holds a nonzero balance. A token pause may block atomic basket
redemption; follow the external-token playbook in [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md).

## Infrastructure and data

- Use at least two archive-capable Robinhood providers from separate operators for production reads and fork tests.
- Apply confirmation/reorg policies appropriate to Robinhood Chain and make indexers reorg-safe.
- Critical balances, roles, pause state, claims, and redemption previews fall back to direct calls.
- Display prices and corporate-action APIs are labeled estimates and cannot enter signed transactions as protocol
  accounting parameters.
- Logs and analytics must not contain private keys, provider credentials, raw signatures before publication, or
  wallet-linked personal data.
- Back up public manifests, source, ABIs, audits, simulations, event history, and incident evidence with content hashes.

## Key management

- Use hardware-backed multisig signers with tested recovery and geographically/organizationally separated custody.
- No raw production key enters GitHub Actions, shared password managers, shell history, chat, or application logs.
- Apply least privilege: deployer, guardian, timelock proposer/executor, compliance, and release signer are distinct.
- Rehearse signer loss and guardian/timelock rotation before mainnet.
- A signer compromise does not authorize destructive “recovery”; follow the incident runbook and existing delays.

## Operational change gate

Changes to monitoring cannot create contract authority. Changes to keepers cannot alter economics. Changes to asset
identity, code hashes, compliance, roles, auction bounds, liquidity destination, or signed manifests use code review,
rehearsal, and the applicable timelock/release gate.
