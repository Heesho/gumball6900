[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / RemoveSignalsPlan

# Interface: RemoveSignalsPlan

Direct-to-SignalGBX removal plan with a native batch and scalar recovery path.

## Extends

- [`NormalizedSignalAllocations`](NormalizedSignalAllocations.md)

## Properties

| Property                                                          | Modifier   | Type                                                       | Description                                                                                               | Inherited from                                                                                                                       |
| ----------------------------------------------------------------- | ---------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-allocations"></a> `allocations`                   | `readonly` | readonly [`SignalAllocation`](SignalAllocation.md)[]       | -                                                                                                         | [`NormalizedSignalAllocations`](NormalizedSignalAllocations.md).[`allocations`](NormalizedSignalAllocations.md#property-allocations) |
| <a id="property-batchtransaction"></a> `batchTransaction`         | `readonly` | [`ContractTransaction`](ContractTransaction.md)            | Native `removeSignalMany` call, irrespective of allocation count.                                         | -                                                                                                                                    |
| <a id="property-preferredtransaction"></a> `preferredTransaction` | `readonly` | [`ContractTransaction`](ContractTransaction.md)            | Scalar for one allocation, otherwise the native batch.                                                    | -                                                                                                                                    |
| <a id="property-scalartransactions"></a> `scalarTransactions`     | `readonly` | readonly [`ContractTransaction`](ContractTransaction.md)[] | One `removeSignal` call per normalized allocation, preserving a withdrawal path if a batch is unsuitable. | -                                                                                                                                    |
| <a id="property-totalamount"></a> `totalAmount`                   | `readonly` | `bigint`                                                   | -                                                                                                         | [`NormalizedSignalAllocations`](NormalizedSignalAllocations.md).[`totalAmount`](NormalizedSignalAllocations.md#property-totalamount) |
