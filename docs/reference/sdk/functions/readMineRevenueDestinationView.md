[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readMineRevenueDestinationView

# Function: readMineRevenueDestinationView()

> **readMineRevenueDestinationView**(`client`, `mine`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `fund`: `` `0x${string}` ``; `gbx`: `` `0x${string}` ``; `mine`: `` `0x${string}` ``; `owner`: `` `0x${string}` ``; `pendingOwner`: `` `0x${string}` ``; `resonance`: `` `0x${string}` ``; `resonanceRouter`: `` `0x${string}` ``; `usdg`: `` `0x${string}` ``; \}\>

Reads Mine's immutable identities, active future-revenue Router, and two-step ownership state at one block.

## Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `client`  | \{ \}                                         |
| `mine`    | `` `0x${string}` ``                           |
| `options` | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `fund`: `` `0x${string}` ``; `gbx`: `` `0x${string}` ``; `mine`: `` `0x${string}` ``; `owner`: `` `0x${string}` ``; `pendingOwner`: `` `0x${string}` ``; `resonance`: `` `0x${string}` ``; `resonanceRouter`: `` `0x${string}` ``; `usdg`: `` `0x${string}` ``; \}\>
