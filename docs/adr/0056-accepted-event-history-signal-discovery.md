# ADR 0056: Accept event-history signal-position discovery

- Status: accepted for development; CEX-03 accepted risk; not deployed or approved for user funds
- Date: 2026-08-31
- Preserves: direct non-upgradeable contracts; paired Bribes as the sole canonical per-account signal ledger; bounded
  scalar exits for live and killed Strategies; and the absence of a core position registry or bulk-exit loop

## Context

`SignalGBX.balanceOf(account)` exposes an account's aggregate signal, while each Strategy's paired Bribe stores the
canonical amount allocated to that Strategy. A caller must supply the Strategy address to `removeSignal`. The current
core and stateless Lens do not enumerate an account's unknown Strategy keys from bounded current state.

Known-key scalar exits are exact and bounded. `Resonance.SignalAdded` and `SignalRemoved` index both the account and
Strategy, and `Mine.ResonanceRouterUpdated` records each future-revenue graph cutover. Historical chain data can
therefore reconstruct candidate Strategy keys across every reviewed graph, after which clients can refresh canonical
Bribe balances before constructing a write.

Adding graph-local `EnumerableSet` membership would improve current-state discovery, but it would also introduce a
second mutable representation of position membership. It would not eliminate the separate need to retain or recover
historical Resonance graph addresses after Mine cutovers.

## Decision

The maintainer explicitly accepts CEX-03 as a Medium discoverability dependency and selects no core change:

- do not add per-account Strategy membership, amount caches, pagination getters, bulk exits, or another registry to
  `Resonance`, `SignalGBX`, Mine, or periphery contracts;
- retain paired Bribes as the only canonical per-Strategy amount ledger;
- retain scalar `removeSignal` as the bounded principal-exit fallback for live and killed Strategies; and
- keep the reviewed CEX-03 Solidity proposal as rejected historical analysis rather than implementation authority.

This decision does not close or downgrade CEX-03. It explicitly accepts that a user who has lost a Strategy key depends
on authenticated historical chain data to reconstruct the transaction needed for exit.

## Operational discovery model

The existing subgraph is the selected discovery layer for the initial Resonance graph. It indexes incremental
`SignalAdded` and `SignalRemoved` events, retains positions on killed Strategies, and already requires a client to
refresh the paired Bribe's canonical `signalWeightOf(account)` before constructing a write. Known-key scalar exits do
not depend on the subgraph at all.

Mine's Router setter may never be used. If governance later performs a cutover, each old graph and its positions remain
valid. The intentionally simple operational model is one independently deployed instance of the existing subgraph per
Resonance generation: keep every old endpoint available, deploy the same indexer for the new graph from its origin
block, and let the interface query the finite configured endpoint list. The cutover runbook must configure the new
instance without retiring an old one.

A single append-only multi-graph manifest and direct JSON-RPC reconstruction are optional resilience improvements, not
current release requirements or protocol-liveness dependencies. They may be proposed again if operating several graph
generations makes the simpler deployment model inadequate. No subgraph result is authoritative for a state-sensitive
write; clients continue to refresh canonical Bribe state onchain.

## Consequences

- Production Solidity, ABI, bytecode, CREATE2 addresses, gas, and custody accounting remain unchanged.
- A subgraph, website, or SDK outage does not destroy the chain events, but a user who has forgotten a Strategy key may
  need the configured subgraph to be restored or rebuilt before rediscovering that position.
- Mine's Router setter remains a future-revenue cutover, not a position migration. Old graphs must remain discoverable
  and usable for claims and signal exits indefinitely if a cutover occurs.
- Public claims must distinguish bounded known-key exitability from replaceable offchain discovery of an unknown key.
- Deploying another subgraph instance or optional recovery tooling does not count as a Solidity fix or fully close
  CEX-03.

Nothing in this ADR authorizes deployment, publication, ownership transfer, a Router switch, or user funds.
