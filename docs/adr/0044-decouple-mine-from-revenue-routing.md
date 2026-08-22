# ADR 0044: Decouple Mine handoffs from revenue routing

- Status: accepted for development; not audited, deployed, or approved for user funds
- Date: 2026-08-22
- Supersedes: ADR 0024's synchronous Mine-to-Resonance routing behavior and ADR 0029's implication that a Mine handoff
  attempts `ResonanceRouter.route()`
- Preserves: ADR 0022's atomic LiquidityPosition fee-routing behavior

## Context

A paid `Mine.mine()` handoff already has to collect the exact USDG price, retain the displaced miner's pull claim, and
deposit the exact protocol share into the immutable ResonanceRouter. Mine then synchronously called
`ResonanceRouter.route()`. That final call was not necessary to complete Mine's own accounting and coupled every paid
handoff to the Router and Resonance execution path.

The coupling made a downstream revert roll back a valid slot handoff even after Mine could have fully funded the prior
miner's claim and delivered the protocol share to its fixed staging contract. It also charged each paid handoff for a
routing attempt. The Router is already permissionless, so Mine does not need to be its mandatory caller.

This follows a broader contract-boundary rule: core contracts should contain the custody, accounting, and invariant
transitions required for their own correctness. Frontend convenience, multi-call composition, and cron or keeper
automation belong in optional periphery unless the protocol itself would be incorrect without them.

## Decision

For every paid handoff, Mine:

1. pulls the exact accepted USDG price from the payer;
2. records `floor(paid * 8_000 / 10_000)` as the displaced miner's pull claim when the slot was occupied;
3. transfers the exact remainder to ResonanceRouter, or the complete payment when the slot was empty; and
4. emits `Mine.RevenueDeposited(index, epochId, amount)` without calling `ResonanceRouter.route()`.

Mine's prior `RevenueRouted(index, epochId, amount)` event is renamed
`RevenueDeposited(index, epochId, amount)`. The new name states exactly what the handoff proves: the protocol share
reached ResonanceRouter. It does not prove that the Router forwarded the balance into Resonance, that Resonance
accepted a notification, or that a seven-day stream began in the same transaction. ResonanceRouter retains
`RevenueRouted(caller, amount)` for an actual successful Router-to-Resonance forward. This is an event ABI change, so
SDK, subgraph, reference, and indexer consumers must migrate.

`ResonanceRouter.route()` remains a separate permissionless action. A user, frontend, volunteer keeper, or scheduled
cron job may call it. There is no caller role, keeper registration, bounty, reimbursement, or protocol guarantee that
someone will do so. Callers should inspect `pendingRevenue()` before calling because an empty Router reverts
`NoRevenue`. A nonempty sub-threshold balance remains held; a qualifying call forwards the Router's complete balance
under ADR 0029.

A later optional frontend-facing helper may compose `Mine.mine()` and `ResonanceRouter.route()` for users who prefer
one submitted transaction. No helper is selected or required by this ADR. It must remain periphery, and failure of its
optional routing leg must not become a correctness or liveness dependency of Mine itself.

Mine still exact-delta checks the transfer into ResonanceRouter. A paused, blocked, fee-on-transfer, or otherwise
inexact USDG transfer on that leg can still revert a paid handoff. A failure after that deposit—inside a later Router
or Resonance call—cannot roll back or block the already completed Mine handoff because it occurs in a separate
transaction. Zero-price handoffs continue to perform no USDG movement.

LiquidityPosition is deliberately unchanged. `harvestFees()` still transfers collected USDG to ResonanceRouter and
calls `route()` atomically in the same transaction while also transferring harvested GBX to Fund and burning it. A
downstream routing failure may therefore still revert the complete fee harvest, including the GBX burn and principal
verification. Changing that boundary would require a separate decision and implementation review.

## Consequences

- Paid Mine handoffs are isolated from Router threshold logic and downstream Resonance availability after the exact
  protocol share reaches ResonanceRouter.
- Router revenue may wait indefinitely even after it qualifies if nobody calls `route()`. Permissionless execution is
  an opportunity, not a liveness guarantee.
- Frontends and monitoring must display at least three distinct states: deposited in ResonanceRouter, forwarded into
  Resonance's active schedule, and released to Strategies.
- Manual callers and automation can choose notification timing within ordinary transaction ordering. A qualifying
  call still restarts the seven-day schedule with the Router balance plus the amount left, so routing latency and
  timing can affect the later release curve.
- Project-operated frontend or cron automation is optional convenience infrastructure. It creates no privileged role
  and must not be described as part of the immutable protocol's availability guarantee.
- Distinct `Mine.RevenueDeposited` and `ResonanceRouter.RevenueRouted` events let consumers distinguish deposit from
  forwarding without inferring semantics from the emitter alone; the accepted cost is an ABI and indexer migration.
- LiquidityPosition retains the stronger atomicity and downstream-failure coupling selected by ADR 0022.

## Review status

This failure-isolation choice is part of the uncommitted development candidate and is covered by current-tree
contract, integration, invariant, SDK, subgraph, documentation, and operational evidence. That local evidence is not
an audit result, deployment approval, or authorization for user funds.
