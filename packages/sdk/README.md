# @gumball-6900/sdk

Bigint-only helpers for the deliberately minimal GUM BALL 6900 contracts.

The package exports mechanically generated ABIs for AcquisitionStrategy, AllocationVoter, AssetRegistry,
BuybackStrategy, EmergencyGuardian, EmissionController, GBXToken, GumBallVault, LiquidityCustodian, MiningClaims,
MiningPool, ProtocolTimelock, StakedGBX, and StrategyRewards. It does not retain APIs for the removed bootstrap,
router, lens, factories, permissioned pools, generic liquidity manager, permit flow, or generation-based rewards.

## Safety model

- Financial inputs and outputs use raw `bigint` units.
- Composed reads pin every RPC request to one block and revalidate its hash before returning.
- Redemption previews use each registered raw vault balance and the pre-burn GBX supply; they do not calculate NAV.
- Signal builders encode immediate absolute per-strategy weights, bounded to 16 unique strategies.
- Auction reads expose an explicit `active` or `inactive` status. An inactive auction has `price: null`; the reader does
  not call the contract's reverting `getPrice()` until registry activation sets a nonzero start time.
- Auction builders preserve the source-faithful `(expectedEpochId, deadline, maxPaymentAmount)` call shape, including a
  valid zero maximum when the quoted auction price is zero.
- The GBX/USDG Uniswap v4 key is hookless. PoolKey, PoolId, pricing, position, and quote helpers require an explicit
  reviewed fee and tick spacing; the SDK supplies neither value as a default.
- No generic router or arbitrary-call builder is exposed.
- Deployment schemas preserve provisional status and fail on zero, duplicate, missing, or extra fixed addresses.

## ABI pipeline

ABIs come from the shared Foundry output and must not be edited manually:

```sh
pnpm --filter @gumball-6900/sdk abi:generate
pnpm --filter @gumball-6900/sdk abi:check
```

## Example

```ts
import {
  buildAcquisitionFill,
  buildMiningContribution,
  buildSignal,
  readRedemptionPreview,
  readSupplyView,
} from '@gumball-6900/sdk';

const supply = await readSupplyView(publicClient, gbx);
const preview = await readRedemptionPreview(publicClient, { assetRegistry, gbx, vault }, shares, {
  atBlock: supply.blockNumber,
});

const contribution = buildMiningContribution(miningPool, beneficiary, requestedUSDGRaw);
const signal = buildSignal(allocationVoter, [acquisitionStrategy, buybackStrategy], [stakedGBX / 2n, stakedGBX / 2n]);
const fill = buildAcquisitionFill({
  strategy: acquisitionStrategy,
  expectedEpochId,
  deadline,
  maxPaymentAmount: maximumTargetTokenRaw,
});
```

The package remains private. Building, testing, or packing it is engineering evidence only and does not publish or
authorize a release.
