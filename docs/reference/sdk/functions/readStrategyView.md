[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readStrategyView

# Function: readStrategyView()

> **readStrategyView**(`client`, `strategyAddress`, `options?`): `Promise`\<\{ `availableRevenue`: `bigint`; `blockNumber`: `bigint`; `currentPrice`: `bigint`; `epochDuration`: `bigint`; `epochId`: `bigint`; `epochStartedAt`: `bigint`; `fund`: `` `0x${string}` ``; `initialPrice`: `bigint`; `minimumPrice`: `bigint`; `paymentToken`: `` `0x${string}` ``; `priceMultiplier`: `bigint`; `revenueToken`: `` `0x${string}` ``; `strategy`: `` `0x${string}` ``; \}\>

Reads the active state and immutable configuration of one Strategy.

## Parameters

| Parameter         | Type                                          |
| ----------------- | --------------------------------------------- |
| `client`          | \{ \}                                         |
| `strategyAddress` | `` `0x${string}` ``                           |
| `options`         | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `availableRevenue`: `bigint`; `blockNumber`: `bigint`; `currentPrice`: `bigint`; `epochDuration`: `bigint`; `epochId`: `bigint`; `epochStartedAt`: `bigint`; `fund`: `` `0x${string}` ``; `initialPrice`: `bigint`; `minimumPrice`: `bigint`; `paymentToken`: `` `0x${string}` ``; `priceMultiplier`: `bigint`; `revenueToken`: `` `0x${string}` ``; `strategy`: `` `0x${string}` ``; \}\>
