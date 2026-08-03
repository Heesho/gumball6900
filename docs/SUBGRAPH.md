# Subgraph Operations

`packages/subgraph` indexes protocol events for discovery, history, and snapshots. It is never authoritative for
balances, claims, virtual budgets, or transaction safety; critical writes are simulated against RPC state.

## Coverage

The schema contains the 30 financial and state entities required by the master specification plus the
`ManagerRewardTerminalDust` accounting extension. Static data sources cover the core deployment, while AssetRegistry
handlers create bounded templates for acquisition strategies, ManagerRewards, and stock tokens. Event IDs include
chain ID, transaction hash, and log index. Daily protocol and account snapshots use UTC boundaries and raw `BigInt`
fields.

Mappings cover 50 currently emitted protocol handlers, including supply, genesis, mining, claims, stake/signals,
allocation budgets, acquisitions, rewards, redemption, buyback, revenue, liquidity, registration, and onchain stock
token multiplier updates. A zero-weight manager-share redirect is recorded as both a reward notification and an exact
vault-balance delta, so the indexed acquisition total includes the complete 100% received target amount in that path.
Liquidity migration start, removal, replacement, completion, residual routing, and pause state are indexed from the
canonical LiquidityManager events.

The web liquidity query pins the pool aggregate and complete active-position set to one `_meta` block hash, orders the
manager-scoped PositionManager token IDs strictly ascending, and requests 17 rows against the contract-enforced
16-position active-set bound. Count drift, omission, duplication, excess, or non-deterministic order fails closed. This bounded complete-set
query intentionally does not use offset pagination; heterogeneous activity feeds use immutable block/log cursors.

Redemption scaling emits and indexes each exact post-scale strategy budget and its `INDEX_PRECISION`-scaled fractional
remainder. Checkpoints synchronize that remainder from the AllocationVoter view at the indexed block, and strategy
disable resets it with the whole budget. User signal rows retain the generation in which their recorded weight was
active; the effective weight is zero unless that generation matches an enabled strategy. Pending-signal rows are
immutable action history because the aggregate pending event does not identify its strategies. Current pending state
and authoritative active totals must be read from AllocationVoter views.

Genesis position events expose exact GBX principal, so `LiquidityPosition.gbxPrincipalKnown` is true for those NFTs.
Migration events expose precommitted slippage bounds rather than actual token deltas; replacement principal is therefore
nullable with `gbxPrincipalKnown = false`, while the exact bounds remain on immutable `LiquidityEvent` records.

## Deterministic accounting rules

- Raw token amounts remain `BigInt`; mappings do not coerce financial data through floating point.
- Corporate-action multipliers change display exposure only, never raw vault custody.
- HOLD_USDG is identified as a no-op strategy rather than an acquisition auction.
- Genesis liquidity records the exact GBX position principal and the integer-rounding residual separately; their sum
  must equal the 20 million GBX genesis allocation.
- Reorg handling uses standard Graph semantics; immutable financial entities use event coordinates.
- REST metadata is not fetched inside mappings.

## Build and test

```bash
pnpm subgraph:codegen
pnpm subgraph:build
pnpm subgraph:test
pnpm --filter @gumball-6900/subgraph test:coverage
pnpm --filter @gumball-6900/subgraph abi:check
```

Matchstick tests exercise every handler. ABI synchronization compares protocol ABIs with the current Foundry
artifacts; external stock-token ABI provenance is documented separately in the package README.
`pnpm --filter @gumball-6900/subgraph spec:check` independently binds the exact required entity set, manifest handlers,
mapping exports, and at least one Matchstick invocation per handler; it runs before build, lint, typecheck, and tests.

## Deployment

`networks.json` intentionally contains zero-address/start-block placeholders until a signed release manifest exists.
`network:validate` and `build:production` must reject those placeholders. At deployment, use the earliest safe block
for each directly deployed source, publish the subgraph version and source hash, test pagination/reorg behavior, and
reconcile indexed state against direct contract reads.

## Corporate-action metadata service

The web server, not the subgraph, may query Robinhood's official read-only asset API. The service must cache briefly,
validate the returned chain/address/UID against the signed asset manifest, retain no wallet-linked personal data,
never sign a transaction, and fall back to onchain token metadata. API prices, status, and corporate-action history
are display data only.
