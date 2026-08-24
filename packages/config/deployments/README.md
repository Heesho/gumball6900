# Archived deployment evidence

> Schema version 3 predates the current core and ADRs 0024 and 0050. It is retained only to validate historical
> candidate files; it is not a deployment format for the current protocol and cannot authorize a release.

The archived `deployment-manifest.ts` schema records these 14 legacy deployments:

1. `ProtocolTimelock`
2. `EmergencyGuardian`
3. `GBXToken`
4. `MiningClaims`
5. `AssetRegistry`
6. `AllocationVoter`
7. `GumBallVault`
8. `StakedGBX`
9. `StrategyRewards`
10. `AcquisitionStrategy`
11. `BuybackStrategy`
12. `LiquidityCustodian`
13. `MiningPool`
14. `EmissionController`

Non-draft candidates must list that exact graph and the exact external identities for USDG, Uniswap v4
PositionManager, Permit2, and the PoolManager behind the PositionManager. Records may remain explicitly `unresolved`
with null or zero evidence while a candidate is incomplete. `release-approved` evidence instead requires nonzero
verified addresses, runtime hashes, constructor arguments, deployment receipts, initialization receipts/events, the
complete post-deployment wiring snapshot, passed evidence gates, and the configured signature quorum. The committed
signer policy is intentionally unresolved, so no current file can validate as release-approved.

The historical snapshot includes both auction lots and price bounds, epoch period and multiplier, the explicit
hookless PoolKey, initial sqrt price, ticks, and the absolute `GBX_V4_LIQUIDITY_DEADLINE`. Its initial-state snapshot
keeps both strategies unregistered with `startTime == 0`, binds the acquisition/rewards pair and buyback dependencies,
records the GBX controller and cached mining pool, proves the genesis NFT is in `LiquidityCustodian`, records principal
and the residual burn, and confirms mining started only after initialization.

Validate a local draft or candidate with:

```bash
pnpm --filter @gumball-6900/config manifest:archive:validate --file path/to/manifest.json
```

The unqualified `manifest:validate` and `authorization:validate` commands intentionally fail closed. The package's
active root export exposes only the current blocked release status; historical manifest, deployment-config, and Safe
validators are available from the explicit `@gumball-6900/config/archival-release` entrypoint. This prevents an
archived validation success from being mistaken for current deployment eligibility.

The Acquisition/Buyback distinction, legacy mining graph, genesis liquidity allocation, and atomic Buyback burn in
this schema are incompatible with ADR 0024's immutable multislot Mine and ADR 0050's zero-premint, eleven-contract
core. The current core has no liquidity-position deployment: a reviewed, externally created fungible Uniswap v2-style
USDG/GBX LP ERC-20 may instead be an ordinary Strategy input. Current deployment tooling must be rebuilt after the
external Resonance owner and governance integration required by ADR 0034 are selected. The examples and policy files
here remain provisional or archival inputs; they do not supply canonical addresses, governance parameters,
approvals, or deployment authorization.
