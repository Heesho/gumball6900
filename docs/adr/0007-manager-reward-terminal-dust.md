# ADR-0007: Manager Reward Terminal Dust

- Status: Accepted; amended 2026-08-02 to separate terminal accounting from token delivery
- Date: 2026-08-02
- Decision owners: protocol engineering, economic review, and release security
- Supersedes: indefinite carry of fractional manager rewards after all live manager weight exits

## Context

ManagerRewards uses a `1e27` reward index plus global and per-user scaled remainders. While a strategy retains live
manager weight, carrying those fractions is desirable: repeated small acquisitions can eventually form an exact raw
token unit. A terminal state was previously undefined. For example, one raw reward unit split across 60/40 weights
creates no whole-token claim, but the unit remained in `accountedRewards` after both managers permanently removed
their signals. A later zero-weight notification correctly went to GumBallVault but did not resolve the old unit.

Blindly moving `accountedRewards` when strategy weight reads zero is unsafe. An administrative strategy disable sets
aggregate live weight to zero without iterating through users; dormant users can still hold whole-token entitlement
through the generation's fixed terminal index. Those latent claims must not be classified as dust or confiscated.

The first terminal-reconciliation implementation transferred residual dust to GumBallVault synchronously from the
voter's final-weight-removal callback. That made an external reward token part of the critical signal-reset and
unstake path. A token pause, false return, receiver fee, sender surcharge, or other transfer failure could therefore
revert the final checkpoint and prevent a manager from removing weight or receiving unstaked GBX.

## Decision

ManagerRewards separately records aggregate unpaid whole-token entitlement and cumulative generation accounting:

```text
generation notified = generation whole entitlements + generation finalized terminal dust
generation finalized terminal dust = generation redirected dust + generation pending terminal dust
total unpaid whole entitlements + total pending terminal dust <= accounted rewards
```

For a natural exit, AllocationVoter first checkpoints each changing user. When the final individually checkpointed
weight is removed, the voter calls `settleTerminalDust`. ManagerRewards retains `totalAccruedRewards`, clears the
global notification remainder, advances a fractional-remainder cycle, and finalizes the generation residual into
`pendingTerminalDust[generation][remainderCycle]`. This synchronous finalization makes no token call. A zero residual
still finalizes the cycle but creates no pending entry and requires no sweep.

Anyone may later call `sweepTerminalDust` for a nonzero pending generation and remainder cycle. Its destination is
immutably fixed to GumBallVault; the caller cannot choose a receiver or amount. The sweep removes the pending amount
from `accountedRewards` only while performing an exact sender-debit and vault-credit transfer. A failed transfer
reverts that sweep atomically and leaves the pending amount available for retry. It cannot roll back the already
completed signal reset, generation close, voting change, or unstake.

Pending terminal dust remains inside `accountedRewards`, so the same physical tokens cannot be treated as a new
unaccounted reward notification. A successful sweep moves the amount from generation-pending to
generation-redirected accounting without changing finalized dust.

Per-user remainders are tagged with the cycle in which they accrued. After a terminal boundary, an old fraction is
ignored if that manager later signals again. This prevents a fraction already included in vault dust from becoming a
future claim.

For an administrative disable, ManagerRewards fixes the generation end index, its remainder cycle, and the aggregate
stored weight still requiring a final checkpoint before AllocationVoter zeros that weight. Each stale user settles
only through that fixed index. Terminal dust is finalized and queued only when the recorded unresolved weight reaches
zero; token delivery remains a separate permissionless sweep. A strategy may reactivate before that happens; the new
generation uses a distinct remainder cycle, so neither old weight nor old fractional carry crosses the boundary.

## Invariant impact

- Whole raw-token entitlements remain claimable across signal removal, unstaking, disable, and reactivation.
- Managers are never paid more than their materialized whole-token entitlement.
- A naturally weightless reward cycle has no unclassified fractional residue: any nonzero residual is pending or has
  been redirected, while a zero residual requires no sweep.
- A closed administrative generation cannot settle dust until every stored dormant weight is reconciled.
- Every terminal transfer benefits all GBX holders through GumBallVault and never an operator or privileged account.
- A terminal token-transfer failure preserves the queued amount and cannot block staking, voting, signal reset, or
  unstaking.
- Pending terminal dust remains reserved in `accountedRewards` and cannot be notified a second time.

## Consequences

- ManagerRewards exposes generation notification, whole-entitlement, finalized-, pending-, and redirected-dust,
  unresolved-weight, and remainder-cycle state for invariant testing and monitoring.
- AllocationVoter performs one bounded external ManagerRewards call on the transition from nonzero strategy weight to
  zero. That call performs accounting only and adds no iteration, custody, governance, token call, or new authority.
- The subgraph records queued terminal dust separately and records a vault balance delta only after a successful
  sweep.
- Existing active-cycle fractional carry remains unchanged; the new policy applies only at a provable terminal
  boundary.

## Rejected alternatives

### Leave terminal fractions for hypothetical future managers

Rejected because permanent manager exit can strand a physical and accounted token balance indefinitely.

### Send every accounted reward to the vault when aggregate weight becomes zero

Rejected because an administrative disable can hide dormant whole-token claims behind zero aggregate live weight.

### Assign terminal dust to the last exiting manager

Rejected because exit ordering would determine economic ownership and could overpay that manager relative to exact
pro-rata whole-token accounting.

### Iterate over every manager during exit or disable

Rejected because the signaling system intentionally has no unbounded global manager loop.

## Verification

- Unit tests reproduce a one-unit 60/40 distribution followed by permanent exit and assert that one unit is queued,
  remains accounted, and can be swept to the vault.
- Unit tests prove a 101-unit distribution retains 100 whole claim units and queues only one unit of vault dust.
- Disable/reactivation tests prove dormant whole claims remain intact and terminal dust waits for every stale
  checkpoint.
- Reactivation tests prove a swept fractional remainder cannot be reused to create an overpayment.
- Transfer-failure tests prove false returns, receiver fees, and sender surcharges preserve the queue without blocking
  the terminal exit, and that a later exact sweep succeeds.
- Fuzz tests reconcile notification, user payments, pending dust, and redirected vault dust for 10,000 randomized raw
  amounts.
- The protocol state machine checks whole-liability solvency and zero-weight terminal conservation over randomized
  signal, fill, claim, unstake, and reset sequences.
