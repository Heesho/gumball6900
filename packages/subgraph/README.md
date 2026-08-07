# GUM BALL 6900 subgraph

Minimal read model for the provisional Robinhood Chain core. It indexes fixed `GBX`, `Fundraiser`,
`LiquidityPosition`, `SignalGBX`, `VoterRouter`, `Voter`, `Fund`, and OpenZeppelin `TimelockController` data sources.

The subgraph tracks raw integer supply, contribution, staking, revenue, Strategy, voting, redemption, migration, and
timelock state. `ProtocolEvent` also records every handled core event positionally. It is a convenience index, not
authoritative protocol accounting.

`networks.json` intentionally contains zero-address placeholders until a reviewed deployment resolves every address
and start block. Production network validation therefore fails closed.

```bash
pnpm --filter @gumball-6900/subgraph abi:sync
pnpm --filter @gumball-6900/subgraph codegen
pnpm --filter @gumball-6900/subgraph build
pnpm --filter @gumball-6900/subgraph test
```

ABIs are generated from current Foundry artifacts and must not be hand-edited. The specification check requires the
exact five-entity schema and all 32 manifest/mapping handlers.
