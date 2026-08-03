[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readSignalView

# Function: readSignalView()

> **readSignalView**(`client`, `contracts`, `user`, `options?`): `Promise`\<\{ `activeStrategies`: `` `0x${string}` ``[]; `blockNumber`: `bigint`; `signalIncreasesPaused`: `boolean`; `stakedBalance`: `bigint`; `usedWeight`: `bigint`; \}\>

## Parameters

| Parameter   | Type                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| `client`    | \{ \}                                                                     |
| `contracts` | `Readonly`\<\{ `allocationVoter`: `Address`; `stakedGBX`: `Address`; \}\> |
| `user`      | `` `0x${string}` ``                                                       |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md)                             |

## Returns

`Promise`\<\{ `activeStrategies`: `` `0x${string}` ``[]; `blockNumber`: `bigint`; `signalIncreasesPaused`: `boolean`; `stakedBalance`: `bigint`; `usedWeight`: `bigint`; \}\>
