[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readBribeRouterView

# Function: readBribeRouterView()

> **readBribeRouterView**(`client`, `bribeRouter`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `bribe`: `` `0x${string}` ``; `bufferedReward`: `bigint`; `currentRewardLeft`: `bigint`; `minimumRewardAmount`: `bigint`; `paymentToken`: `` `0x${string}` ``; \}\>

Reads one Strategy's minimal Bribe buffer and current notification thresholds.

## Parameters

| Parameter     | Type                                          |
| ------------- | --------------------------------------------- |
| `client`      | \{ \}                                         |
| `bribeRouter` | `` `0x${string}` ``                           |
| `options`     | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `bribe`: `` `0x${string}` ``; `bufferedReward`: `bigint`; `currentRewardLeft`: `bigint`; `minimumRewardAmount`: `bigint`; `paymentToken`: `` `0x${string}` ``; \}\>
