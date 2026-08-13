# GUM BALL 6900 subgraph

Minimal read model for the provisional core. It indexes `GBX`, `Mine`, `LiquidityPosition`, `SignalGBX`,
`ResonanceRouter`, `Resonance`, `Fund`, and OpenZeppelin `TimelockController` data sources.

The subgraph tracks minted and burned supply, mining slots and claims, staking, ResonanceRouter hold attempts, the
Resonance stream, Strategies, signals, redemptions, and timelock state. `ProtocolEvent` records handled events
positionally. This is a convenience index, not authoritative protocol accounting: pending Mine accrual, current router
balances, and releasable Resonance revenue must be read or computed live between events.

`networks.json` intentionally contains zero-address placeholders until a reviewed deployment resolves every address
and start block. Production network validation therefore fails closed.

```bash
pnpm --filter @gumball-6900/subgraph abi:sync
pnpm --filter @gumball-6900/subgraph codegen
pnpm --filter @gumball-6900/subgraph build
pnpm --filter @gumball-6900/subgraph test
```

ABIs come from current Foundry artifacts and must not be hand-edited. The specification check requires the exact
five-entity schema and all declared manifest/mapping handlers.
