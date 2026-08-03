[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readLiquidityCustodyView

# Function: readLiquidityCustodyView()

> **readLiquidityCustodyView**(`client`, `custodian`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `expectedPositionTokenId`: `bigint`; `poolKey`: \{ `currency0`: `` `0x${string}` ``; `currency1`: `` `0x${string}` ``; `fee`: `number`; `hooks`: `` `0x${string}` ``; `tickSpacing`: `number`; \}; `poolKeyHash`: `string`; `positionInCustody`: `boolean`; `positionRecorded`: `boolean`; `positionTokenId`: `bigint`; \}\>

## Parameters

| Parameter   | Type                                          |
| ----------- | --------------------------------------------- |
| `client`    | \{ \}                                         |
| `custodian` | `` `0x${string}` ``                           |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `expectedPositionTokenId`: `bigint`; `poolKey`: \{ `currency0`: `` `0x${string}` ``; `currency1`: `` `0x${string}` ``; `fee`: `number`; `hooks`: `` `0x${string}` ``; `tickSpacing`: `number`; \}; `poolKeyHash`: `string`; `positionInCustody`: `boolean`; `positionRecorded`: `boolean`; `positionTokenId`: `bigint`; \}\>
