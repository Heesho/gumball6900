[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / normalizeSignalWeights

# Function: normalizeSignalWeights()

> **normalizeSignalWeights**(`stakedBalance`, `signals`): readonly [`NormalizedSignal`](../interfaces/NormalizedSignal.md)[]

Mirrors AllocationVoter.signal: floors each allocation and gives the final strategy all residual atomic units.

## Parameters

| Parameter       | Type                                                           |
| --------------- | -------------------------------------------------------------- |
| `stakedBalance` | `bigint`                                                       |
| `signals`       | readonly [`RelativeSignal`](../interfaces/RelativeSignal.md)[] |

## Returns

readonly [`NormalizedSignal`](../interfaces/NormalizedSignal.md)[]
