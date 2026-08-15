[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readSignalView

# Function: readSignalView()

> **readSignalView**(`client`, `signalGBX`, `account`, `options?`): `Promise`\<\{ `allocatedSignalBalance`: `bigint`; `blockNumber`: `bigint`; `currentVotes`: `bigint`; `delegate`: `` `0x${string}` ``; `signalBalance`: `bigint`; `unallocatedSignalBalance`: `bigint`; \}\>

Reads an account's SignalGBX receipt, allocation, delegation, votes, and immediately withdrawable remainder.

## Parameters

| Parameter   | Type                                          |
| ----------- | --------------------------------------------- |
| `client`    | \{ \}                                         |
| `signalGBX` | `` `0x${string}` ``                           |
| `account`   | `` `0x${string}` ``                           |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `allocatedSignalBalance`: `bigint`; `blockNumber`: `bigint`; `currentVotes`: `bigint`; `delegate`: `` `0x${string}` ``; `signalBalance`: `bigint`; `unallocatedSignalBalance`: `bigint`; \}\>
