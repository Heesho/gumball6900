[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / buildCompoundLiquidity

# Function: buildCompoundLiquidity()

> **buildCompoundLiquidity**(`liquidityPosition`, `amount0Max`, `amount1Max`, `deadline`): [`ContractTransaction`](../interfaces/ContractTransaction.md)

Grows the canonical v4 position by its fixed requirement and pays the caller everything it had accrued.

`amount0Max` and `amount1Max` are both the funding pulled from the caller and the slippage ceiling: unspent
funding is returned in the same call, so set them to what the increase may cost at an acceptable price.

## Parameters

| Parameter           | Type                |
| ------------------- | ------------------- |
| `liquidityPosition` | `` `0x${string}` `` |
| `amount0Max`        | `bigint`            |
| `amount1Max`        | `bigint`            |
| `deadline`          | `bigint`            |

## Returns

[`ContractTransaction`](../interfaces/ContractTransaction.md)
