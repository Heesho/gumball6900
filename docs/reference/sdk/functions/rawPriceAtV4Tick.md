[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / rawPriceAtV4Tick

# Function: rawPriceAtV4Tick()

> **rawPriceAtV4Tick**(`base`, `quote`, `tick`): `object`

Returns the SDK price's exact raw numerator and denominator for a tick; formatting remains a UI concern.

## Parameters

| Parameter | Type                                                      |
| --------- | --------------------------------------------------------- |
| `base`    | [`PoolTokenMetadata`](../interfaces/PoolTokenMetadata.md) |
| `quote`   | [`PoolTokenMetadata`](../interfaces/PoolTokenMetadata.md) |
| `tick`    | `number`                                                  |

## Returns

`object`

### denominator

> `readonly` **denominator**: `bigint`

### numerator

> `readonly` **numerator**: `bigint`
