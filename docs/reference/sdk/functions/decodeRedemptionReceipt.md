[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / decodeRedemptionReceipt

# Function: decodeRedemptionReceipt()

> **decodeRedemptionReceipt**(`logs`, `vault?`): [`DecodedRedemptionReceipt`](../interfaces/DecodedRedemptionReceipt.md)

Decodes the complete receipt-level redemption from canonical vault events, rejecting ambiguous or incomplete logs.

## Parameters

| Parameter | Type                |
| --------- | ------------------- |
| `logs`    | readonly `Log`[]    |
| `vault?`  | `` `0x${string}` `` |

## Returns

[`DecodedRedemptionReceipt`](../interfaces/DecodedRedemptionReceipt.md)
