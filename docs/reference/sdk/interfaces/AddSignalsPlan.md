[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / AddSignalsPlan

# Interface: AddSignalsPlan

Direct-to-SignalGBX addition plan with a native batch and scalar recovery path.

## Extends

- [`NormalizedSignalAllocations`](NormalizedSignalAllocations.md)

## Properties

| Property                                                                      | Modifier   | Type                                                       | Description                                                                                                   | Inherited from                                                                                                                       |
| ----------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-accountcalls"></a> `accountCalls`                             | `readonly` | readonly [`ContractTransaction`](ContractTransaction.md)[] | Calls a smart account may execute atomically: optional GBX approval followed by the preferred SignalGBX call. | -                                                                                                                                    |
| <a id="property-allocations"></a> `allocations`                               | `readonly` | readonly [`SignalAllocation`](SignalAllocation.md)[]       | -                                                                                                             | [`NormalizedSignalAllocations`](NormalizedSignalAllocations.md).[`allocations`](NormalizedSignalAllocations.md#property-allocations) |
| <a id="property-allowanceshortfall"></a> `allowanceShortfall`                 | `readonly` | `bigint`                                                   | -                                                                                                             | -                                                                                                                                    |
| <a id="property-approvalrequired"></a> `approvalRequired`                     | `readonly` | `boolean`                                                  | -                                                                                                             | -                                                                                                                                    |
| <a id="property-approvaltransaction"></a> `approvalTransaction`               | `readonly` | [`ContractTransaction`](ContractTransaction.md) \| `null`  | Exact-total GBX approval, or null when the supplied allowance already covers the aggregate addition.          | -                                                                                                                                    |
| <a id="property-batchtransaction"></a> `batchTransaction`                     | `readonly` | [`ContractTransaction`](ContractTransaction.md)            | Native `addSignalMany` call, irrespective of allocation count.                                                | -                                                                                                                                    |
| <a id="property-preferredsignaltransaction"></a> `preferredSignalTransaction` | `readonly` | [`ContractTransaction`](ContractTransaction.md)            | Scalar for one allocation, otherwise the native batch.                                                        | -                                                                                                                                    |
| <a id="property-requiredallowance"></a> `requiredAllowance`                   | `readonly` | `bigint`                                                   | -                                                                                                             | -                                                                                                                                    |
| <a id="property-scalartransactions"></a> `scalarTransactions`                 | `readonly` | readonly [`ContractTransaction`](ContractTransaction.md)[] | One `addSignal` call per normalized allocation, usable when a batch is too large or unsupported.              | -                                                                                                                                    |
| <a id="property-totalamount"></a> `totalAmount`                               | `readonly` | `bigint`                                                   | -                                                                                                             | [`NormalizedSignalAllocations`](NormalizedSignalAllocations.md).[`totalAmount`](NormalizedSignalAllocations.md#property-totalamount) |
