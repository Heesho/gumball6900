[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readResonanceView

# Function: readResonanceView()

> **readResonanceView**(`client`, `resonance`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `duration`: `bigint`; `lastUpdateTime`: `bigint`; `left`: `bigint`; `periodFinish`: `bigint`; `remainderFinish`: `bigint`; `resonanceRouter`: `` `0x${string}` ``; `rewardPerTokenStored`: `bigint`; `rewardPrecision`: `bigint`; `rewardRate`: `bigint`; `totalSignalWeight`: `bigint`; `usdg`: `` `0x${string}` ``; `usdgBalance`: `bigint`; \}\>

Reads Resonance's global allocation and revenue state.

## Parameters

| Parameter   | Type                                          |
| ----------- | --------------------------------------------- |
| `client`    | \{ \}                                         |
| `resonance` | `` `0x${string}` ``                           |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `duration`: `bigint`; `lastUpdateTime`: `bigint`; `left`: `bigint`; `periodFinish`: `bigint`; `remainderFinish`: `bigint`; `resonanceRouter`: `` `0x${string}` ``; `rewardPerTokenStored`: `bigint`; `rewardPrecision`: `bigint`; `rewardRate`: `bigint`; `totalSignalWeight`: `bigint`; `usdg`: `` `0x${string}` ``; `usdgBalance`: `bigint`; \}\>
