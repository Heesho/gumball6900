[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readRedemptionPreview

# Function: readRedemptionPreview()

> **readRedemptionPreview**(`client`, `contracts`, `shares`, `options?`): `Promise`\<\{ `amounts`: `bigint`[]; `assets`: `` `0x${string}` ``[]; `blockNumber`: `bigint`; `shares`: `bigint`; `supplyBefore`: `bigint`; \}\>

Computes the exact raw-basket preview from the same pre-burn balance and supply inputs used by the vault.

## Parameters

| Parameter   | Type                                                                                  |
| ----------- | ------------------------------------------------------------------------------------- |
| `client`    | \{ \}                                                                                 |
| `contracts` | `Readonly`\<\{ `assetRegistry`: `Address`; `gbx`: `Address`; `vault`: `Address`; \}\> |
| `shares`    | `bigint`                                                                              |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md)                                         |

## Returns

`Promise`\<\{ `amounts`: `bigint`[]; `assets`: `` `0x${string}` ``[]; `blockNumber`: `bigint`; `shares`: `bigint`; `supplyBefore`: `bigint`; \}\>
