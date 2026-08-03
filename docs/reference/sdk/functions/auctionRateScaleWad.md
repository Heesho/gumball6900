[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / auctionRateScaleWad

# Function: auctionRateScaleWad()

> **auctionRateScaleWad**(`usdGDecimals`, `targetDecimals`): `bigint`

Returns the denominator that converts a human-normalized WAD rate into raw token units:
`targetRaw = ceil(usdGRaw * rateWad / rateScaleWad)`.

## Parameters

| Parameter        | Type     |
| ---------------- | -------- |
| `usdGDecimals`   | `number` |
| `targetDecimals` | `number` |

## Returns

`bigint`
