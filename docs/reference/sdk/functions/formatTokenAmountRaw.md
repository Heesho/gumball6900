[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / formatTokenAmountRaw

# Function: formatTokenAmountRaw()

> **formatTokenAmountRaw**(`amountRaw`, `metadata`): `string`

Formats raw bigint units exactly, trimming only insignificant trailing fractional zeroes.

## Parameters

| Parameter           | Type                                             |
| ------------------- | ------------------------------------------------ |
| `amountRaw`         | `bigint`                                         |
| `metadata`          | \{ `decimals`: `number`; `symbol?`: `string`; \} |
| `metadata.decimals` | `number`                                         |
| `metadata.symbol?`  | `string`                                         |

## Returns

`string`
