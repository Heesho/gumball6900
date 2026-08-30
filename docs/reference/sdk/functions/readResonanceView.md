[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readResonanceView

# Function: readResonanceView()

> **readResonanceView**(`client`, `resonance`, `options?`): `Promise`\<\{ `basisPoints`: `bigint`; `blockNumber`: `bigint`; `bribeBasisPoints`: `bigint`; `defaultBribeBasisPoints`: `bigint`; `fundBasisPoints`: `bigint`; `lastUpdateTime`: `bigint`; `maximumBribeBasisPoints`: `bigint`; `owner`: `` `0x${string}` ``; `pendingOwner`: `` `0x${string}` ``; `periodFinish`: `bigint`; `remainingRevenue`: `bigint`; `resonanceRouter`: `` `0x${string}` ``; `revenuePerSignalStored`: `bigint`; `revenueRate`: `bigint`; `rewardDuration`: `bigint`; `rewardPrecision`: `bigint`; `totalSignalWeight`: `bigint`; `usdg`: `` `0x${string}` ``; `usdgBalance`: `bigint`; \}\>

Reads Resonance's global allocation and revenue state.

## Parameters

| Parameter   | Type                                          |
| ----------- | --------------------------------------------- |
| `client`    | \{ \}                                         |
| `resonance` | `` `0x${string}` ``                           |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `basisPoints`: `bigint`; `blockNumber`: `bigint`; `bribeBasisPoints`: `bigint`; `defaultBribeBasisPoints`: `bigint`; `fundBasisPoints`: `bigint`; `lastUpdateTime`: `bigint`; `maximumBribeBasisPoints`: `bigint`; `owner`: `` `0x${string}` ``; `pendingOwner`: `` `0x${string}` ``; `periodFinish`: `bigint`; `remainingRevenue`: `bigint`; `resonanceRouter`: `` `0x${string}` ``; `revenuePerSignalStored`: `bigint`; `revenueRate`: `bigint`; `rewardDuration`: `bigint`; `rewardPrecision`: `bigint`; `totalSignalWeight`: `bigint`; `usdg`: `` `0x${string}` ``; `usdgBalance`: `bigint`; \}\>
