[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / AddSignalsPlanParameters

# Interface: AddSignalsPlanParameters

Inputs required to prepare direct SignalGBX addition calls and any GBX approval.

## Properties

| Property                                                  | Modifier   | Type                                                 | Description                                                                                               |
| --------------------------------------------------------- | ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| <a id="property-allocations"></a> `allocations`           | `readonly` | readonly [`SignalAllocation`](SignalAllocation.md)[] | -                                                                                                         |
| <a id="property-currentallowance"></a> `currentAllowance` | `readonly` | `bigint`                                             | Current GBX allowance from the signaling account to SignalGBX at the transaction's pinned planning block. |
| <a id="property-gbx"></a> `gbx`                           | `readonly` | `` `0x${string}` ``                                  | -                                                                                                         |
| <a id="property-signalgbx"></a> `signalGBX`               | `readonly` | `` `0x${string}` ``                                  | -                                                                                                         |
