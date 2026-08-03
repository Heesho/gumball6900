[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / parseProtocolDeployment

# Function: parseProtocolDeployment()

> **parseProtocolDeployment**(`value`): `object`

## Parameters

| Parameter | Type      |
| --------- | --------- |
| `value`   | `unknown` |

## Returns

`object`

### addresses

> **addresses**: `object` = `protocolAddressesSchema`

#### addresses.allocationVoter

> **allocationVoter**: `` `0x${string}` `` = `addressSchema`

#### addresses.assetRegistry

> **assetRegistry**: `` `0x${string}` `` = `addressSchema`

#### addresses.buybackStrategy

> **buybackStrategy**: `` `0x${string}` `` = `addressSchema`

#### addresses.emergencyGuardian

> **emergencyGuardian**: `` `0x${string}` `` = `addressSchema`

#### addresses.emissionController

> **emissionController**: `` `0x${string}` `` = `addressSchema`

#### addresses.gbx

> **gbx**: `` `0x${string}` `` = `addressSchema`

#### addresses.gumBallVault

> **gumBallVault**: `` `0x${string}` `` = `addressSchema`

#### addresses.liquidityCustodian

> **liquidityCustodian**: `` `0x${string}` `` = `addressSchema`

#### addresses.miningClaims

> **miningClaims**: `` `0x${string}` `` = `addressSchema`

#### addresses.miningPool

> **miningPool**: `` `0x${string}` `` = `addressSchema`

#### addresses.protocolTimelock

> **protocolTimelock**: `` `0x${string}` `` = `addressSchema`

#### addresses.stakedGBX

> **stakedGBX**: `` `0x${string}` `` = `addressSchema`

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
