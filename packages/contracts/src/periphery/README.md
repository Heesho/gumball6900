# Optional periphery

Contracts in this directory are replaceable conveniences, not correctness or liveness dependencies of the core
protocol.

`SignalPortfolioLens` is a stateless, read-only RPC aggregator. It has no owner, registry, storage, token custody, or
state-changing function. Callers provide the trusted `SignalGBX`, `Resonance`, account, and Strategy list; the Lens
checks the permanent SignalGBX-to-Resonance binding but cannot discover Strategies or decide which deployment is
canonical. Interfaces should obtain Strategy addresses from indexed `StrategyAdded` events or the subgraph, then use a
block-pinned Lens read for current transaction-critical state. Large lists may need client-side chunking to stay within
RPC gas and response-size limits.

There is intentionally no write-through signaling router. `SignalGBX` uses `msg.sender` as the GBX owner, sGBX holder,
voter, Strategy signal owner, and withdrawal recipient. A normal router would become that owner and cannot forward the
non-transferable receipt. Wallet-native account batching and the typed `SignalGBX` scalar/batch functions preserve the
real account identity without an operator role, signature relay, arbitrary-call executor, or intermediary custody.
