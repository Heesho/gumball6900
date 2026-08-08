[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readResonanceView

# Function: readResonanceView()

> **readResonanceView**(`client`, `resonance`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `bribeBps`: `bigint`; `revenueIndex`: `bigint`; `strategies`: `` `0x${string}` ``[]; `totalSignalWeight`: `bigint`; \}\>

Reads Resonance's global allocation and revenue state.

## Parameters

| Parameter   | Type                                          |
| ----------- | --------------------------------------------- |
| `client`    | \{ \}                                         |
| `resonance` | `` `0x${string}` ``                           |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `bribeBps`: `bigint`; `revenueIndex`: `bigint`; `strategies`: `` `0x${string}` ``[]; `totalSignalWeight`: `bigint`; \}\>
