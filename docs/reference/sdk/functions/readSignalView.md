[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readSignalView

# Function: readSignalView()

> **readSignalView**(`client`, `signalGBX`, `account`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `currentVotes`: `bigint`; `delegate`: `` `0x${string}` ``; `signalBalance`: `bigint`; \}\>

Reads an account's fully allocated SignalGBX aggregate, delegation, and current votes.

## Parameters

| Parameter   | Type                                          |
| ----------- | --------------------------------------------- |
| `client`    | \{ \}                                         |
| `signalGBX` | `` `0x${string}` ``                           |
| `account`   | `` `0x${string}` ``                           |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `currentVotes`: `bigint`; `delegate`: `` `0x${string}` ``; `signalBalance`: `bigint`; \}\>
