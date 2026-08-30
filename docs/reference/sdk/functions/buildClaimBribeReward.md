[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / buildClaimBribeReward

# Function: buildClaimBribeReward()

> **buildClaimBribeReward**(`bribe`, `account`, `rewardToken`): [`ContractTransaction`](../interfaces/ContractTransaction.md)

Claims one registered Bribe token without touching any other reward token.
For a direct Bribe call, `account` must be the submitting wallet; only canonical Resonance may relay a claim.

## Parameters

| Parameter     | Type                |
| ------------- | ------------------- |
| `bribe`       | `` `0x${string}` `` |
| `account`     | `` `0x${string}` `` |
| `rewardToken` | `` `0x${string}` `` |

## Returns

[`ContractTransaction`](../interfaces/ContractTransaction.md)
