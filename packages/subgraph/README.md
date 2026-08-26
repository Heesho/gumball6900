# GUM BALL 6900 subgraph

Minimal read model for the provisional core. It indexes `GBX`, `Mine`, `SignalGBX`, `ResonanceRouter`, `Resonance`,
and `Fund` data sources.

The subgraph tracks minted and burned supply, mining slots and claims, signal escrow, successful ResonanceRouter
forwards, Resonance revenue notifications and distributions, its global prospective automatic-Bribe rate, Strategy
registrations and kills, signal weights, Bribe reward activity, BribeRouter routes, and redemptions.
`ProtocolEvent` records handled events positionally. Each `RevenueNotified` resets the seven-day revenue period, but its
event exposes only the newly notified amount. The subgraph therefore records cumulative notification volume, reset
count, and the latest notification amount and timestamp without inventing the carried `left` amount, rate, remainder,
or finish. This is a convenience index, not authoritative protocol accounting: pending Mine accrual, retained
ResonanceRouter balance, and current Resonance revenue state must be read live between events.

Signal allocation deltas remain canonical from Resonance `SignalAdded` and `SignalRemoved` logs. `SignalPosition` is a
current nonzero account-by-Strategy discovery index keyed by `chain-account-strategy`; partial removals update it and a
complete removal deletes it. Killing a Strategy does not delete incumbent positions, so accounts can still discover
what they may remove. Scalar and batch SignalGBX calls emit the same incremental Resonance events, and duplicate batch
entries are applied in event order. SignalGBX delegation logs separately maintain each account's selected delegate and
latest event-observed voting power; they do not alter signal allocation totals.

The position index is never authoritative transaction state. Before building `removeSignal` or `removeSignalMany`, a
client must refresh the paired Bribe's `signalWeightOf(account)` and relevant Strategy status at one pinned onchain
block. Likewise, a subgraph response cannot establish allowance, GBX balance, or that an addition will still succeed.
Use the subgraph to discover candidate positions and use current RPC reads/simulation to construct writes.

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
