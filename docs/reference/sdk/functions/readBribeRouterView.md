[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readBribeRouterView

# Function: readBribeRouterView()

> **readBribeRouterView**(`client`, `bribeRouter`, `options?`): `Promise`\<\{ `accountedPaymentBalance`: `bigint`; `blockNumber`: `bigint`; `fundPaymentLiability`: `bigint`; `paymentSurplus`: `bigint`; \}\>

Reads a Strategy router's fixed Fund payment liability and direct-donation surplus.

## Parameters

| Parameter     | Type                                          |
| ------------- | --------------------------------------------- |
| `client`      | \{ \}                                         |
| `bribeRouter` | `` `0x${string}` ``                           |
| `options`     | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `accountedPaymentBalance`: `bigint`; `blockNumber`: `bigint`; `fundPaymentLiability`: `bigint`; `paymentSurplus`: `bigint`; \}\>
