[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readBribeRouterView

# Function: readBribeRouterView()

> **readBribeRouterView**(`client`, `bribeRouter`, `options?`): `Promise`\<\{ `accountedPaymentBalance`: `bigint`; `basisPoints`: `bigint`; `blockNumber`: `bigint`; `bribe`: `` `0x${string}` ``; `bribeBasisPoints`: `bigint`; `bribePaymentLiability`: `bigint`; `fund`: `` `0x${string}` ``; `fundBasisPoints`: `bigint`; `fundPaymentLiability`: `bigint`; `paymentSurplus`: `bigint`; `paymentToken`: `` `0x${string}` ``; `splitRemainder`: `bigint`; `strategy`: `` `0x${string}` ``; \}\>

Reads a Strategy router's immutable 90/10 terms, liabilities, split carry, and direct-donation surplus.

## Parameters

| Parameter     | Type                                          |
| ------------- | --------------------------------------------- |
| `client`      | \{ \}                                         |
| `bribeRouter` | `` `0x${string}` ``                           |
| `options`     | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `accountedPaymentBalance`: `bigint`; `basisPoints`: `bigint`; `blockNumber`: `bigint`; `bribe`: `` `0x${string}` ``; `bribeBasisPoints`: `bigint`; `bribePaymentLiability`: `bigint`; `fund`: `` `0x${string}` ``; `fundBasisPoints`: `bigint`; `fundPaymentLiability`: `bigint`; `paymentSurplus`: `bigint`; `paymentToken`: `` `0x${string}` ``; `splitRemainder`: `bigint`; `strategy`: `` `0x${string}` ``; \}\>
