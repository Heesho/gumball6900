[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readPendingActivationView

# Function: readPendingActivationView()

> **readPendingActivationView**(`client`, `gumBallLens`, `user`, `atTimestamp`, `options?`): `Promise`\<\{ `activationsPaused`: `boolean`; `activationTime`: `bigint`; `blockNumber`: `bigint`; `isMature`: `boolean`; `signals`: `object`[]; `stakedBalance`: `bigint`; `user`: `` `0x${string}` ``; \}\>

## Parameters

| Parameter     | Type                                          |
| ------------- | --------------------------------------------- |
| `client`      | \{ \}                                         |
| `gumBallLens` | `` `0x${string}` ``                           |
| `user`        | `` `0x${string}` ``                           |
| `atTimestamp` | `bigint`                                      |
| `options`     | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `activationsPaused`: `boolean`; `activationTime`: `bigint`; `blockNumber`: `bigint`; `isMature`: `boolean`; `signals`: `object`[]; `stakedBalance`: `bigint`; `user`: `` `0x${string}` ``; \}\>
