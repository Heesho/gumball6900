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

#### addresses.bribeFactory

> **bribeFactory**: `` `0x${string}` `` = `addressSchema`

#### addresses.fund

> **fund**: `` `0x${string}` `` = `addressSchema`

#### addresses.gbx

> **gbx**: `` `0x${string}` `` = `addressSchema`

#### addresses.mine

> **mine**: `` `0x${string}` `` = `addressSchema`

#### addresses.resonance

> **resonance**: `` `0x${string}` `` = `addressSchema`

#### addresses.resonanceRouter

> **resonanceRouter**: `` `0x${string}` `` = `addressSchema`

#### addresses.signalGBX

> **signalGBX**: `` `0x${string}` `` = `addressSchema`

#### addresses.strategyFactory

> **strategyFactory**: `` `0x${string}` `` = `addressSchema`

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
