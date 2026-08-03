[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / closestV4TickForRawPrice

# Function: closestV4TickForRawPrice()

> **closestV4TickForRawPrice**(`base`, `quote`, `baseAmountRaw`, `quoteAmountRaw`): `number`

Converts an exact raw quote/base ratio to the closest v4 tick through Uniswap's Price and v4 conversion helper.
Token decimals are explicit and no JavaScript floating-point financial value is accepted.

## Parameters

| Parameter        | Type                                                      |
| ---------------- | --------------------------------------------------------- |
| `base`           | [`PoolTokenMetadata`](../interfaces/PoolTokenMetadata.md) |
| `quote`          | [`PoolTokenMetadata`](../interfaces/PoolTokenMetadata.md) |
| `baseAmountRaw`  | `bigint`                                                  |
| `quoteAmountRaw` | `bigint`                                                  |

## Returns

`number`
