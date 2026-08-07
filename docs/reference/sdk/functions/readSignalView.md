[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readSignalView

# Function: readSignalView()

> **readSignalView**(`client`, `contracts`, `account`, `options?`): `Promise`\<\{ `accountStrategies`: `` `0x${string}` ``[]; `blockNumber`: `bigint`; `signalBalance`: `bigint`; `usedWeight`: `bigint`; \}\>

Reads an account's current SignalGBX balance and unrestricted allocation.

## Parameters

| Parameter   | Type                                                            |
| ----------- | --------------------------------------------------------------- |
| `client`    | \{ \}                                                           |
| `contracts` | `Readonly`\<\{ `signalGBX`: `Address`; `voter`: `Address`; \}\> |
| `account`   | `` `0x${string}` ``                                             |
| `options`   | [`ReadOptions`](../interfaces/ReadOptions.md)                   |

## Returns

`Promise`\<\{ `accountStrategies`: `` `0x${string}` ``[]; `blockNumber`: `bigint`; `signalBalance`: `bigint`; `usedWeight`: `bigint`; \}\>
