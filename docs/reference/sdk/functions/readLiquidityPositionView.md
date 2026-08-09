[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readLiquidityPositionView

# Function: readLiquidityPositionView()

> **readLiquidityPositionView**(`client`, `liquidityPosition`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `expectedPositionTokenId`: `bigint`; `expectedTickLower`: `number`; `expectedTickUpper`: `number`; `fund`: `` `0x${string}` ``; `poolKeyHash`: `string`; `positionInCustody`: `boolean`; `positionRecorded`: `boolean`; `positionTokenId`: `bigint`; `resonanceRouter`: `` `0x${string}` ``; \}\>

Reads custody and range state for the canonical Uniswap v4 position.

## Parameters

| Parameter           | Type                                          |
| ------------------- | --------------------------------------------- |
| `client`            | \{ \}                                         |
| `liquidityPosition` | `` `0x${string}` ``                           |
| `options`           | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `expectedPositionTokenId`: `bigint`; `expectedTickLower`: `number`; `expectedTickUpper`: `number`; `fund`: `` `0x${string}` ``; `poolKeyHash`: `string`; `positionInCustody`: `boolean`; `positionRecorded`: `boolean`; `positionTokenId`: `bigint`; `resonanceRouter`: `` `0x${string}` ``; \}\>
