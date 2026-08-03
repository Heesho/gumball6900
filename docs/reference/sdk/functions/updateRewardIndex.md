[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / updateRewardIndex

# Function: updateRewardIndex()

> **updateRewardIndex**(`rewardAmount`, `totalWeight`, `precision?`): [`RewardIndexUpdate`](../interfaces/RewardIndexUpdate.md)

Mirrors StrategyRewards.notifyReward. Each notification floors independently; residue is not carried.

## Parameters

| Parameter      | Type     | Default value           |
| -------------- | -------- | ----------------------- |
| `rewardAmount` | `bigint` | `undefined`             |
| `totalWeight`  | `bigint` | `undefined`             |
| `precision`    | `bigint` | `ACCUMULATOR_PRECISION` |

## Returns

[`RewardIndexUpdate`](../interfaces/RewardIndexUpdate.md)
