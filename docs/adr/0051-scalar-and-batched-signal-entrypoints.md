# ADR 0051: Scalar and batched signal entrypoints

- Status: accepted for development; not covered by the V12 review of `3ae171b`, not independently audited, deployed,
  or approved for user funds
- Date: 2026-08-26
- Supersedes:
  - ADR 0031's exact `signal`, `signalWithPermit`, `moveSignal`, and `withdrawSignal` public surface; and
  - ADR 0048's preservation of the public `SignalGBX.moveSignal` operation.
- Preserves: mandatory one-for-one GBX custody, non-transferable ERC20Votes sGBX, no idle receipt state,
  `SignalGBX` as the sole public signal coordinator, the retained Resonance `addSignalFor` and `removeSignalFor` hooks,
  checkpoint-before-weight-change ordering, killed-Strategy exits, and scalar exit liveness.

## Context

The existing SignalGBX surface permits only one Strategy mutation per call. Smart accounts can atomically batch those
calls, but each addition still transfers GBX and mints sGBX separately, and each removal separately burns sGBX and
returns GBX. Plain externally owned accounts also cannot request several Strategy changes in one transaction without
a core batch entrypoint.

An external write-through Router cannot solve this safely under the current ownership model. SignalGBX deliberately
uses `msg.sender` as the GBX owner, sGBX owner, signal owner, and withdrawal recipient. A Router calling SignalGBX
would therefore own the position itself, and non-transferable sGBX could not be forwarded to the user. Adding
operators, signed intents, a trusted forwarder, `tx.origin`, or a generic executor would materially enlarge the
authorization and replay surface.

The protocol is not deployed, so the user-facing selectors can change without aliases or a migration.

## Decision

### SignalGBX public surface

SignalGBX exposes exactly four position-changing entrypoints:

```solidity
struct Allocation {
    address strategy;
    uint256 amount;
}

function addSignal(address strategy, uint256 amount) external;
function addSignalMany(Allocation[] calldata allocations) external;
function removeSignal(address strategy, uint256 amount) external;
function removeSignalMany(Allocation[] calldata allocations) external;
```

`addSignal` atomically requests `amount` GBX from the caller, mints the same amount of sGBX to the caller, and adds the
same signal to one live Strategy and its paired Bribe. `removeSignal` is the exact inverse for one live or killed
Strategy: it removes the position, burns the same sGBX, and returns the same GBX to the caller.

`addSignalMany` validates and checked-sums the caller-supplied allocations, requests the aggregate GBX once, mints the
aggregate sGBX once, and then applies each allocation through the existing scalar Resonance hook. `removeSignalMany`
applies every removal through the existing hook, then burns and returns the checked aggregate once. Every batch is
atomic; any failed entry rolls back every earlier entry and the aggregate custody transition.

An empty batch, a zero scalar amount, or a zero amount in any allocation reverts `ZeroAmount`. Duplicate Strategy
entries are allowed and execute sequentially. Existing `Signaled`, `SignalWithdrawn`, `SignalAdded`, and
`SignalRemoved` events are emitted once per allocation so indexers retain one canonical incremental event shape.

Batch length is caller-controlled. The contract adds no arbitrary item cap: required work is visible in calldata, the
caller bears its gas, and scalar operations always remain available. Interfaces should simulate and split a batch that
does not fit the current block gas limit.

### Removed convenience paths

SignalGBX no longer exposes `signal`, `signalWithPermit`, `moveSignal`, or `withdrawSignal`. It also does not add a
batch-permit variant. GBX retains ERC-2612 permit generally, but SignalGBX does not consume a permit signature.

Smart accounts may atomically batch `GBX.approve(SignalGBX, total)` with one or more direct SignalGBX calls. A plain
externally owned account without account-level batching must establish allowance in a prior transaction. Reallocating
between Strategies is expressed as removal plus addition; this may burn, return, re-deposit, and remint the same GBX.
That additional work is accepted in exchange for the smaller, symmetric Curve-style add/remove surface.

### Periphery and read model

There is no shared write-through signal Router. SDK write helpers encode direct calls to SignalGBX and may return an
ordered call list for a Safe, ERC-4337 account, EIP-7702 account, or other wallet-native atomic batch. Such wallet
composition is optional convenience and is never a correctness or exit dependency.

Read convenience remains replaceable periphery. `SignalPortfolioLens.portfolio` accepts explicit SignalGBX, Resonance,
account, and Strategy-list inputs, validates SignalGBX's permanent Resonance binding, and returns aggregate receipt,
delegation, voting, Strategy configuration/live state, auction/revenue state, account/total signal, and paired-Bribe
reward views. The Lens is stateless and has no registry, role, custody, or write operation.

The subgraph indexes current nonzero account-by-Strategy positions from canonical Resonance `SignalAdded` and
`SignalRemoved` events, including positions left in killed Strategies. It is only a discovery index. Before constructing
a removal or other state-sensitive write, clients must refresh the paired Bribe balance and Strategy status at one
pinned onchain block through the Lens or direct RPC. Neither Lens nor subgraph is authoritative protocol storage or a
write coordinator.

## Security and liveness consequences

- The scalar functions preserve a bounded exit when a batch contains a broken, stale, or unaffordable entry.
- Batches perform linear work across allocations and, through each paired Bribe, its registered reward tokens. New
  worst-case gas tests must cover several Strategies with the sixteen-token Bribe maximum.
- Duplicate entries preserve straightforward sequential semantics but may waste gas. SDKs may coalesce them before
  simulation without making onchain uniqueness a correctness rule.
- Every add/remove hook checkpoints elapsed Resonance and Bribe rewards before changing that Strategy's weight. Later
  entries in the same transaction observe the same timestamp, so no elapsed interval is reassigned between entries.
- A shared Router cannot withdraw for an account and is not granted operator or custody authority. Smart-wallet
  batching keeps the wallet itself as `msg.sender` on every direct call.
- Removing the permit path narrows signature handling but makes a prior allowance transaction necessary for plain
  externally owned accounts.

## Delivery and review boundary

This is a breaking ABI, SDK, subgraph, documentation, test, and audit-scope change. Generated ABI consumers must be
synchronized from current compiler artifacts rather than hand edited. The V12 export reviewed commit
`3ae171b997254b56602298d873b3918d1575b3c7`; it did not review these selectors, batch loops, aggregate custody
transitions, read periphery, SDK composition, or position index. Independent review and the complete repository gates
remain required before deployment.
