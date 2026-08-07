[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readSupplyView

# Function: readSupplyView()

> **readSupplyView**(`client`, `gbx`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `lifetimeBurned`: `bigint`; `lifetimeMinted`: `bigint`; `minter`: `` `0x${string}` ``; `minterLocked`: `boolean`; `remainingMintableSupply`: `bigint`; `totalSupply`: `bigint`; \}\>

Reads the complete GBX lifetime-supply state from one canonical block.

## Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `client`  | \{ \}                                         |
| `gbx`     | `` `0x${string}` ``                           |
| `options` | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `lifetimeBurned`: `bigint`; `lifetimeMinted`: `bigint`; `minter`: `` `0x${string}` ``; `minterLocked`: `boolean`; `remainingMintableSupply`: `bigint`; `totalSupply`: `bigint`; \}\>
