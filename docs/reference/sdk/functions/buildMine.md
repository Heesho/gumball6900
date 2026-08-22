[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / buildMine

# Function: buildMine()

> **buildMine**(`parameters`): [`ContractTransaction`](../interfaces/ContractTransaction.md)

Replaces one Mine slot with caller-bounded epoch, deadline, USDG price, and event-only message protection.
Set `deadline` before the next halving boundary when the quoted prospective TPS must remain valid.

## Parameters

| Parameter    | Type                                                |
| ------------ | --------------------------------------------------- |
| `parameters` | [`MineParameters`](../interfaces/MineParameters.md) |

## Returns

[`ContractTransaction`](../interfaces/ContractTransaction.md)
