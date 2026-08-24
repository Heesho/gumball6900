[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readRedemptionPreview

# Function: readRedemptionPreview()

> **readRedemptionPreview**(`client`, `contracts`, `gbxAmount`, `tokens`, `options?`): `Promise`\<\{ `amounts`: `bigint`[]; `blockNumber`: `bigint`; `effectiveSupplyBefore`: `bigint`; `gbxAmount`: `bigint`; `tokens`: `` `0x${string}` ``[]; \}\>

Computes a registry-free Fund redemption preview for exactly the tokens selected by the caller.

## Parameters

| Parameter   | Type                                                      |
| ----------- | --------------------------------------------------------- |
| `client`    | \{ \}                                                     |
| `contracts` | `Readonly`\<\{ `fund`: `Address`; `mine`: `Address`; \}\> |
| `gbxAmount` | `bigint`                                                  |
| `tokens`    | readonly `` `0x${string}` ``[]                            |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md)             |

## Returns

`Promise`\<\{ `amounts`: `bigint`[]; `blockNumber`: `bigint`; `effectiveSupplyBefore`: `bigint`; `gbxAmount`: `bigint`; `tokens`: `` `0x${string}` ``[]; \}\>
