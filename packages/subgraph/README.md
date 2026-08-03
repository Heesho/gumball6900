# GUM BALL 6900 subgraph

Production-oriented event index for Robinhood Chain (`robinhood`, chain ID `4663`). All token amounts remain raw
integer units. The subgraph is a read model and must never be treated as authoritative protocol accounting.
Replacement-position GBX principal is explicitly nullable because migration events reveal slippage bounds, not actual
currency deltas; consumers must check `gbxPrincipalKnown` instead of interpreting an unknown value as zero.

## Deployment configuration

`networks.json` intentionally contains zero-address placeholders until a reviewed deployment manifest exists. This
keeps code generation and local builds reproducible while making production readiness fail closed:

```bash
pnpm --filter @gumball-6900/subgraph network:validate
```

Replace every address and start block from the signed deployment manifest. Use the deployment block (or the earliest
constructor/dependency event block), never a later convenience block. `network:validate` rejects unresolved, duplicate,
or malformed values. A production indexer must use an archive-capable provider rather than the public rate-limited RPC.

## ABI provenance

Protocol ABIs are mechanically extracted from the current Foundry artifacts after compiling the contract sources:

```bash
pnpm --filter @gumball-6900/subgraph abi:sync
```

CI or reviewers can run `pnpm --filter @gumball-6900/subgraph abi:check`; it recompiles the contracts and fails if any
checked-in protocol ABI differs from the fresh Foundry artifact.

The external `StockToken` ABI is deliberately minimal. Its `UIMultiplierUpdated(uint256,uint256,uint256)` event was
read from the verified Robinhood Stock implementation at `0xb35490d6f9163DE4F80d88dc75c3516eb64C5aE2` through the
Robinhood Chain Blockscout API on 2026-08-01. Reverify the beacon implementation and event signature during deployment
review; a beacon upgrade is an operational alert and ABI-review trigger.

## Build and test

```bash
pnpm --filter @gumball-6900/subgraph codegen
pnpm --filter @gumball-6900/subgraph spec:check
pnpm --filter @gumball-6900/subgraph build
pnpm --filter @gumball-6900/subgraph test
pnpm --filter @gumball-6900/subgraph test:coverage
```

`spec:check` requires all 30 master-specification entities, the terminal-dust accounting extension, the exact manifest
handler set, matching mapping exports, and at least one Matchstick invocation for every handler. This makes entity or
event-family removal fail even when the remaining GraphQL schema would still compile.

Dynamic data sources are created only from `AssetRegistry__AssetRegistered`: each non-USDG acquisition strategy, its
manager rewards contract, and, for stock tokens, a multiplier-event source. Canonical USDG is modeled as
`HOLD_USDG`; its no-op signal target is not treated as an auction. The model does not discover arbitrary factories.

Immutable financial records use IDs containing chain ID, transaction hash, and log index. Mutable state and daily
snapshot IDs include chain ID plus their natural key. Daily boundaries use UTC Unix-day buckets. Heterogeneous asset
amounts are never summed together; vault and reward amounts always retain their asset relation.
`ManagerRewardTerminalDust` uses
`<chainId>-<managerRewardsAddress>-<generation>-<remainderCycle>` so its queued and settled events update one
chain-scoped row.

Signal allocations are generation-bound. `SignalAllocation.recordedWeightRaw` is effective only when the allocation's
`generation` equals its related strategy's `generation` and that strategy is enabled; otherwise its effective weight is
zero. This mirrors the contract's O(1) strategy-disable invalidation without pretending that the indexer can rewrite an
unbounded number of user entities. Account-level effective totals should be derived from those filtered allocations or
read from `AllocationVoter.activeWeightTotal` when authoritative current state is required.

`StrategyBudget` preserves both whole raw USDG and `scaledRemainder`. Checkpoint events synchronize the public
`strategyScaledRemainder` view at the indexed block, redemption-scaling events record the emitted post-scale value, and
strategy disable resets both fields. The remainder is in AllocationVoter's `INDEX_PRECISION` scale and must not be
displayed as whole raw USDG.

`PendingSignal` rows are immutable action history, not authoritative pending state. The aggregate pending event does
not enumerate its strategies, so a later O(1) strategy disable cannot identify every affected account in a deterministic
mapping. Consumers must read `pendingActivationTime`, `pendingWeightTotal`, and generation-filtered pending weights from
`AllocationVoter` when current pending state matters.

Liquidity migration events preserve the plan hash, destination pool-key hash, removed and replacement position IDs,
reviewed min/max amounts, residual burn/routing totals, and migration pause state. Position activity and pool counts
are updated from the per-position before/after events rather than inferred from the completion summary.

The live liquidity client anchors `_meta` first, then requests the complete bounded active-position set and its pool
aggregate at that exact block hash. Rows are manager-scoped, ordered strictly by numeric PositionManager token ID, and
limited to one more than the contract-enforced 16-position active-set bound so omissions, count drift, duplicates, excess rows, and
non-deterministic ordering fail closed. This is a bounded complete-set query, not offset pagination.

`Protocol.liquidityGBXFeesBurnedRaw` and `Protocol.liquidityUSDGFeesToVaultRaw` advance only from explicit
`LiquidityManager__FeesCollected` events. They are exact collected-fee routing totals and deliberately exclude GBX
sweep dust, USDG completed-range principal, and migration residuals tracked by the broader liquidity pool aggregates.

Robinhood REST corporate-action metadata cannot be fetched from deterministic mappings. The onchain multiplier event is
indexed as `CorporateAction`; a future-dated update preserves the event's old multiplier as current and records the new
value in `pendingUIMultiplierRaw` until its effective time. Because a subgraph cannot mutate an entity merely when wall
clock time passes, consumers must treat a pending value whose effective time has elapsed as effective or refresh it
from the token's `uiMultiplier()` view. The separate web metadata service performs that reconciliation against the
official REST API and onchain view.

`AssetRegistry__AssetRegistered` emits the initial `redemptionEnabled` value, so registration establishes both the
status and `redemptionEnabledKnown = true` atomically. Later `AssetRegistry__RedemptionStatusSet` events update that
same exact field. The current stock-token UI multiplier remains unset until its onchain update event and should be
filled for display by the separate metadata service.
