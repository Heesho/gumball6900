[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / updateRewardAccumulator

# Function: updateRewardAccumulator()

> **updateRewardAccumulator**(`rewardAmount`, `totalActiveWeight`, `priorRemainder?`, `precision?`): [`RewardAccumulatorUpdate`](../interfaces/RewardAccumulatorUpdate.md)

Applies a reward notification to a live strategy weight. Zero-weight notifications must be
redirected to the vault before reaching this accounting helper.

## Parameters

| Parameter           | Type     | Default value           |
| ------------------- | -------- | ----------------------- |
| `rewardAmount`      | `bigint` | `undefined`             |
| `totalActiveWeight` | `bigint` | `undefined`             |
| `priorRemainder`    | `bigint` | `0n`                    |
| `precision`         | `bigint` | `ACCUMULATOR_PRECISION` |

## Returns

[`RewardAccumulatorUpdate`](../interfaces/RewardAccumulatorUpdate.md)
