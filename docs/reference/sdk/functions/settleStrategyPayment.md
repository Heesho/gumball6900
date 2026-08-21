[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / settleStrategyPayment

# Function: settleStrategyPayment()

> **settleStrategyPayment**(`paymentAmount`, `priorSplitRemainder?`, `bribeBasisPoints?`): [`StrategyPaymentSettlement`](../interfaces/StrategyPaymentSettlement.md)

Models BribeRouter's cumulative acquired-asset classification at the supplied global rate.
The denominator never changes, so carrying `priorSplitRemainder` across rate changes exactly
classifies floor(sum(payment[i] \* bribeBps[i]) / BPS_DENOMINATOR).

## Parameters

| Parameter             | Type     | Default value                |
| --------------------- | -------- | ---------------------------- |
| `paymentAmount`       | `bigint` | `undefined`                  |
| `priorSplitRemainder` | `bigint` | `0n`                         |
| `bribeBasisPoints`    | `bigint` | `DEFAULT_STRATEGY_BRIBE_BPS` |

## Returns

[`StrategyPaymentSettlement`](../interfaces/StrategyPaymentSettlement.md)
