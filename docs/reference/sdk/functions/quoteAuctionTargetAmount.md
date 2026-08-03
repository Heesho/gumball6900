[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / quoteAuctionTargetAmount

# Function: quoteAuctionTargetAmount()

> **quoteAuctionTargetAmount**(`usdGAmountRaw`, `targetPerUSDGRateWad`, `usdGDecimals`, `targetDecimals`): `bigint`

Required raw target payment, rounded upward so a taker cannot underpay by atomic-unit dust.

## Parameters

| Parameter              | Type     |
| ---------------------- | -------- |
| `usdGAmountRaw`        | `bigint` |
| `targetPerUSDGRateWad` | `bigint` |
| `usdGDecimals`         | `number` |
| `targetDecimals`       | `number` |

## Returns

`bigint`
