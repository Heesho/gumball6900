# GUM BALL 6900 subgraph

Minimal read model for the provisional core. It indexes `GBX`, `Mine`, `LiquidityPosition`, `SignalGBX`,
`ResonanceRouter`, `Resonance`, and `Fund` data sources.

The subgraph tracks minted and burned supply, mining slots and claims, staking, successful ResonanceRouter forwards,
Resonance revenue notifications and distributions, Strategies, signals, kills, and redemptions.
`ProtocolEvent` records handled events positionally. Each `RevenueNotified` resets the seven-day reward period, but its
event exposes only the newly notified amount. The subgraph therefore records cumulative notification volume, reset
count, and the latest notification amount and timestamp without inventing the carried `left` amount, rate, remainder,
or finish. This is a convenience index, not authoritative protocol accounting: pending Mine accrual, retained
ResonanceRouter balance, and current Resonance reward state must be read live between events.

Signal allocation deltas remain canonical from Resonance `SignalAdded` and `SignalRemoved` logs, including the paired
remove/add logs produced by an atomic move. SignalGBX delegation logs separately maintain each account's selected
delegate and latest event-observed voting power; they do not alter signal allocation totals.

`networks.json` intentionally contains zero-address placeholders until a reviewed deployment resolves every address
and start block. Production network validation therefore fails closed.

```bash
pnpm --filter @gumball-6900/subgraph abi:sync
pnpm --filter @gumball-6900/subgraph codegen
pnpm --filter @gumball-6900/subgraph build
pnpm --filter @gumball-6900/subgraph test
```

ABIs come from current Foundry artifacts and must not be hand-edited. The specification check requires the reviewed
core entity set plus every declared manifest/mapping handler. External governance indexing is intentionally deferred
until an exact governance system and release are selected.
