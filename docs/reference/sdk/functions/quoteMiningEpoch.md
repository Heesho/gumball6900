[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / quoteMiningEpoch

# Function: quoteMiningEpoch()

> **quoteMiningEpoch**(`input`): [`MiningEpochQuote`](../interfaces/MiningEpochQuote.md)

Mirrors EmissionController.settleMiningEpoch: every non-empty epoch receives
the complete cap-bounded schedule, while an empty epoch receives zero and
permanently forfeits that day's schedule. Contribution size is intentionally irrelevant.

## Parameters

| Parameter | Type                                                              |
| --------- | ----------------------------------------------------------------- |
| `input`   | [`MiningEpochQuoteInput`](../interfaces/MiningEpochQuoteInput.md) |

## Returns

[`MiningEpochQuote`](../interfaces/MiningEpochQuote.md)
