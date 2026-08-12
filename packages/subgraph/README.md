# GUM BALL 6900 subgraph

Minimal read model for the provisional core. It indexes `GBX`, `Mine`, `LiquidityPosition`, `SignalGBX`,
`ResonanceRouter`, `Resonance`, `Fund`, and OpenZeppelin `TimelockController` data sources.

The subgraph tracks minted and burned supply, mining slots and claims, staking, revenue, Strategies, signals,
redemptions, and timelock state. `ProtocolEvent` records handled events positionally. This is a convenience index, not
authoritative protocol accounting; pending Mine accrual continues between events and must be computed from slot rate
and timestamp when a live effective-supply view is needed.

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
