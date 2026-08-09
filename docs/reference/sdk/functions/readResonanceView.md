[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readResonanceView

# Function: readResonanceView()

> **readResonanceView**(`client`, `resonance`, `options?`): `Promise`\<\{ `accountedRevenueBalance`: `bigint`; `blockNumber`: `bigint`; `fundRevenueLiability`: `bigint`; `indexedRevenueScaled`: `bigint`; `pendingRevenueScaled`: `bigint`; `revenueIndex`: `bigint`; `strategies`: `` `0x${string}` ``[]; `totalClaimableRevenue`: `bigint`; `totalSignalWeight`: `bigint`; `unaccountedRevenue`: `bigint`; \}\>

Reads Resonance's global allocation and revenue state.

## Parameters

| Parameter   | Type                                          |
| ----------- | --------------------------------------------- |
| `client`    | \{ \}                                         |
| `resonance` | `` `0x${string}` ``                           |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `accountedRevenueBalance`: `bigint`; `blockNumber`: `bigint`; `fundRevenueLiability`: `bigint`; `indexedRevenueScaled`: `bigint`; `pendingRevenueScaled`: `bigint`; `revenueIndex`: `bigint`; `strategies`: `` `0x${string}` ``[]; `totalClaimableRevenue`: `bigint`; `totalSignalWeight`: `bigint`; `unaccountedRevenue`: `bigint`; \}\>
