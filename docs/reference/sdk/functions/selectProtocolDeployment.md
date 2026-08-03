[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / selectProtocolDeployment

# Function: selectProtocolDeployment()

> **selectProtocolDeployment**(`deployments`, `chainId`, `options?`): `object`

## Parameters

| Parameter     | Type                                                      |
| ------------- | --------------------------------------------------------- |
| `deployments` | readonly `object`[]                                       |
| `chainId`     | `4663` \| `46630`                                         |
| `options`     | `Readonly`\<\{ `requireReleaseApproved?`: `boolean`; \}\> |

## Returns

`object`

### addresses

> **addresses**: `object` = `protocolAddressesSchema`

#### addresses.allocationVoter

> **allocationVoter**: `` `0x${string}` `` = `addressSchema`

#### addresses.assetRegistry

> **assetRegistry**: `` `0x${string}` `` = `addressSchema`

#### addresses.buybackBurnStrategy

> **buybackBurnStrategy**: `` `0x${string}` `` = `addressSchema`

#### addresses.eligibilityModule

> **eligibilityModule**: `` `0x${string}` `` = `addressSchema`

#### addresses.emergencyGuardian

> **emergencyGuardian**: `` `0x${string}` `` = `addressSchema`

#### addresses.emissionController

> **emissionController**: `` `0x${string}` `` = `addressSchema`

#### addresses.gbx

> **gbx**: `` `0x${string}` `` = `addressSchema`

#### addresses.genesisBootstrap

> **genesisBootstrap**: `` `0x${string}` `` = `addressSchema`

#### addresses.genesisClaims

> **genesisClaims**: `` `0x${string}` `` = `addressSchema`

#### addresses.genesisLiquidityCalculator

> **genesisLiquidityCalculator**: `` `0x${string}` `` = `addressSchema`

#### addresses.gumBallLens

> **gumBallLens**: `` `0x${string}` `` = `addressSchema`

#### addresses.gumBallRouter

> **gumBallRouter**: `` `0x${string}` `` = `addressSchema`

#### addresses.gumBallVault

> **gumBallVault**: `` `0x${string}` `` = `addressSchema`

#### addresses.holdUSDGStrategy

> **holdUSDGStrategy**: `` `0x${string}` `` = `addressSchema`

#### addresses.launchGuardHook

> **launchGuardHook**: `` `0x${string}` `` = `addressSchema`

#### addresses.liquidityManager

> **liquidityManager**: `` `0x${string}` `` = `addressSchema`

#### addresses.miningClaims

> **miningClaims**: `` `0x${string}` `` = `addressSchema`

#### addresses.miningPool

> **miningPool**: `` `0x${string}` `` = `addressSchema`

#### addresses.protocolTimelock

> **protocolTimelock**: `` `0x${string}` `` = `addressSchema`

#### addresses.revenueRouter

> **revenueRouter**: `` `0x${string}` `` = `addressSchema`

#### addresses.stakedGBX

> **stakedGBX**: `` `0x${string}` `` = `addressSchema`

#### addresses.strategyDeployer

> **strategyDeployer**: `` `0x${string}` `` = `addressSchema`

### chainId

> **chainId**: `4663` \| `46630`

### deploymentId

> **deploymentId**: `string`

### manifestPayloadHash

> **manifestPayloadHash**: `string` = `bytes32Schema`

### releaseVersion

> **releaseVersion**: `string`

### status

> **status**: `"draft"` \| `"testnet-candidate"` \| `"mainnet-candidate"` \| `"release-approved"`
