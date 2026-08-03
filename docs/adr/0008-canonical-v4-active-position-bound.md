# ADR-0008: Canonical v4 Active-Position Bound

- Status: Accepted
- Date: 2026-08-02
- Decision owners: protocol engineering and security review
- Supersedes: a client-only 16-position read bound paired with a per-migration, rather than global, contract bound

## Context

LiquidityManager already limited one migration to at most 16 removals and 16 replacements. That did not bound the
number of positions left active across a sequence of migrations. Starting from four genesis positions, one valid
migration could replace four with sixteen; later one-for-two migrations could then grow the active set beyond sixteen.

The live liquidity view deliberately obtains a complete manager-scoped active-position ID set from the subgraph at a
pinned block, then validates every record, NFT owner, PoolKey, tick range, liquidity value, principal amount, and fee
checkpoint against RPC state. Its fixed 16-position read bound was therefore only an availability boundary: a valid
larger set made the exact composition view unavailable. Treating a partial set as complete would be unsafe, while an
unbounded query would remove the protocol's deterministic read and monitoring bound.

## Decision

LiquidityManager enforces `MAX_ACTIVE_POSITIONS = 16` across the lifetime of the deployment. It exposes
`activePositionCount`, establishes the count as four only after genesis minting succeeds, decrements it after a
completed-range burn succeeds, and applies each successful migration's exact removal/replacement delta.

Migration preflight rejects a plan when:

```text
current active - removals + replacements > 16
```

The implementation uses an addition-only equivalent so an invalid removal count cannot cause arithmetic underflow
before the existing-record checks. All count and record changes are in the same transaction as PositionManager
execution. A revert from minting, burning, custody verification, residual routing, or a reentrant guarded entry rolls
the complete state transition back.

The SDK reads both `MAX_ACTIVE_POSITIONS` and `activePositionCount` at the same block as the subgraph index. The
compiled cap must equal the reviewed client constant, the onchain count must not exceed it, and the subgraph count and
ID-list length must equal the onchain count. The subgraph query requests 17 rows: sixteen covers every valid active set,
while a seventeenth row proves an inconsistent index and fails closed.

## Invariant impact

- Exactly four position records become active when and only when genesis seeding succeeds.
- At most sixteen canonical position records can be active simultaneously.
- Every successful completed-range sweep reduces the active count by exactly one.
- Every successful migration changes the count by `replacements - removals` and cannot exceed the global maximum.
- Failed or reentrant position operations cannot leave a record/count or manager/NFT-custody mismatch.
- A validated 0-to-16-entry index is a complete active set, never a client-selected prefix.

## Consequences

Reviewed migrations may still reshape, consolidate, or expand the range ladder within sixteen simultaneous positions.
An operator that needs a different arrangement must first sweep or remove positions in the same atomic migration; it
cannot accumulate an unbounded tail across multiple timelocked operations.

The bound adds one counter write to each successful genesis, sweep, or migration path and two public view getters. It
introduces no new role, recipient, oracle, executor, factory, approval, or arbitrary call surface.

## Rejected alternatives

### Keep only the per-migration limit

Rejected because repeated bounded migrations can still grow the lifetime active set without bound.

### Keep a client-only limit and make large valid sets unavailable

Rejected because exact liquidity composition is a required operational view and the protocol can cheaply enforce the
same safety bound onchain.

### Paginate an unbounded active set

Rejected because pagination adds truncation, snapshot, and denial-of-service risk to a view that must prove complete
composition at one block.

### Store and return a mutable onchain active-ID array

Rejected because the existing event index already provides deterministic discovery and every candidate is validated
against authoritative onchain records. A second iterable storage structure would add mutation and consistency risk.

## Verification

- LiquidityManager unit tests prove genesis starts at four, a maximum migration reaches sixteen, and a cumulative
  overflow reverts without changing records, custody, or the counter.
- A completed-range sweep at the maximum releases exactly one slot, and a later migration can refill but not exceed it.
- A downstream PositionManager debt revert proves migration records, hashes, counters, and NFT ownership roll back.
- SDK tests reject cap drift, onchain/subgraph count drift, excess and duplicate IDs, omissions, stale hashes, and
  migration-counter drift.
- Web index tests accept exactly sixteen ordered IDs, request a seventeenth sentinel row, and reject seventeen entries.
