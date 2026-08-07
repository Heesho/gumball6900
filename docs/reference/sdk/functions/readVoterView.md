[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readVoterView

# Function: readVoterView()

> **readVoterView**(`client`, `voter`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `bribeBps`: `bigint`; `revenueIndex`: `bigint`; `strategies`: `` `0x${string}` ``[]; `totalWeight`: `bigint`; \}\>

Reads Voter's global allocation and revenue state.

## Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `client`  | \{ \}                                         |
| `voter`   | `` `0x${string}` ``                           |
| `options` | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `bribeBps`: `bigint`; `revenueIndex`: `bigint`; `strategies`: `` `0x${string}` ``[]; `totalWeight`: `bigint`; \}\>
