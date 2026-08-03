# GUM BALL 6900 subgraph

Minimal event index for the provisional Robinhood Chain deployment (`robinhood`, chain ID `4663`). It is a read model,
not authoritative protocol accounting. All token amounts remain raw integer units and heterogeneous target-token amounts
are retained per strategy or per event rather than summed across assets.

## Deployment configuration

`networks.json` intentionally contains zero-address placeholders until a reviewed deployment manifest resolves every
core deployment address and start block. That makes production validation fail closed:

```bash
pnpm --filter @gumball-6900/subgraph network:validate
```

The static data sources are GBXToken, EmissionController, MiningPool, MiningClaims, StakedGBX, AllocationVoter,
GumBallVault, AssetRegistry, LiquidityCustodian, EmergencyGuardian, and ProtocolTimelock. AcquisitionStrategy,
StrategyRewards, and the standalone BuybackStrategy are instantiated only from their typed AssetRegistry registration
events. The subgraph does not discover public factories or arbitrary contracts.

## ABI provenance

Protocol ABIs are mechanically extracted from current Foundry artifacts:

```bash
pnpm --filter @gumball-6900/subgraph abi:sync
pnpm --filter @gumball-6900/subgraph abi:check
```

Do not hand-edit files under `abis/`. ABI sync compiles the shared Solidity source tree and then checks or writes the
listed minimal contract ABIs.

## Read-model shape

`ProtocolState`, `Account`, `MiningEpoch`, `VaultAsset`, `Strategy`, and `LiquidityPosition` are bounded convenience
aggregates. `ProtocolEvent` is the immutable positional record for each protocol-specific event indexed after its
fixed or dynamic data source exists. Its address, integer, and bytes arrays follow ABI order and are labeled by
`eventType`. Pre-registration deployment events are deployment-manifest evidence, not retroactively indexed history.

The AllocationVoter emits a user's aggregate signal weight but does not enumerate the user's per-strategy weights in
`SignalsSet`. Accordingly, the subgraph records the aggregate account weight and global per-strategy weight events. A
consumer needing authoritative current per-user strategy allocation must read the contract.

The EmissionController event records scheduled and next-scheduled emission in `ProtocolEvent`; MiningPool's settlement
event is the source for the pool-keyed `MiningEpoch` aggregate because the controller event does not include the pool
address. Vault revenue is aggregated from `AllocationVoter__RevenueNotified`, which covers both mining and liquidity
sources without double counting their downstream summary events.

## Build and test

```bash
pnpm --filter @gumball-6900/subgraph codegen
pnpm --filter @gumball-6900/subgraph spec:check
pnpm --filter @gumball-6900/subgraph build
pnpm --filter @gumball-6900/subgraph test
```

`spec:check` requires the exact seven-entity schema and all 50 manifest/mapping handlers. Matchstick smoke tests cover
cumulative GBX accounting, beneficiary mining settlement/claim state, and the canonical liquidity position fee and
transfer lifecycle.
