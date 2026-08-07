[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / quoteFundraiserEpoch

# Function: quoteFundraiserEpoch()

> **quoteFundraiserEpoch**(`input`): [`FundraiserEpochQuote`](../interfaces/FundraiserEpochQuote.md)

Mirrors Fundraiser settlement: every non-empty epoch receives
the complete cap-bounded schedule, while an empty epoch receives zero and
permanently forfeits that day's schedule. Contribution size is intentionally irrelevant.

## Parameters

| Parameter | Type                                                                      |
| --------- | ------------------------------------------------------------------------- |
| `input`   | [`FundraiserEpochQuoteInput`](../interfaces/FundraiserEpochQuoteInput.md) |

## Returns

[`FundraiserEpochQuote`](../interfaces/FundraiserEpochQuote.md)
