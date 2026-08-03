[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / decodeMultiAssetRedemptionResult

# Function: decodeMultiAssetRedemptionResult()

> **decodeMultiAssetRedemptionResult**(`returnData`, `assets`): readonly [`RedemptionAmount`](../interfaces/RedemptionAmount.md)[]

Decodes eth_call/simulateContract return data for GumBallVault.redeem and binds each raw amount to token metadata.

## Parameters

| Parameter    | Type                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| `returnData` | `` `0x${string}` ``                                                              |
| `assets`     | readonly [`RedemptionAssetMetadata`](../interfaces/RedemptionAssetMetadata.md)[] |

## Returns

readonly [`RedemptionAmount`](../interfaces/RedemptionAmount.md)[]
