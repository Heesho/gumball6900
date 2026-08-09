[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readSignalView

# Function: readSignalView()

> **readSignalView**(`client`, `contracts`, `account`, `options?`): `Promise`\<\{ `accountSignalWeight`: `bigint`; `accountStrategies`: `` `0x${string}` ``[]; `blockNumber`: `bigint`; `signalBalance`: `bigint`; `unallocatedSignalBalance`: `bigint`; \}\>

Reads an account's SignalGBX balance, absolute allocation, and immediately withdrawable remainder.

## Parameters

| Parameter   | Type                                                                |
| ----------- | ------------------------------------------------------------------- |
| `client`    | \{ \}                                                               |
| `contracts` | `Readonly`\<\{ `resonance`: `Address`; `signalGBX`: `Address`; \}\> |
| `account`   | `` `0x${string}` ``                                                 |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md)                       |

## Returns

`Promise`\<\{ `accountSignalWeight`: `bigint`; `accountStrategies`: `` `0x${string}` ``[]; `blockNumber`: `bigint`; `signalBalance`: `bigint`; `unallocatedSignalBalance`: `bigint`; \}\>
