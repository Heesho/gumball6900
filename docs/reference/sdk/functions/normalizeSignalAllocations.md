[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / normalizeSignalAllocations

# Function: normalizeSignalAllocations()

> **normalizeSignalAllocations**(`allocations`): [`NormalizedSignalAllocations`](../interfaces/NormalizedSignalAllocations.md)

Validates and coalesces a nonempty Strategy allocation list.
Duplicate Strategy entries are summed in first-seen order so UI rows cannot accidentally cause redundant checkpoints.

## Parameters

| Parameter     | Type                                                               |
| ------------- | ------------------------------------------------------------------ |
| `allocations` | readonly [`SignalAllocation`](../interfaces/SignalAllocation.md)[] |

## Returns

[`NormalizedSignalAllocations`](../interfaces/NormalizedSignalAllocations.md)
