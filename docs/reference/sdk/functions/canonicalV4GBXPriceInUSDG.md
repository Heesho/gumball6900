[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / canonicalV4GBXPriceInUSDG

# Function: canonicalV4GBXPriceInUSDG()

> **canonicalV4GBXPriceInUSDG**(`parameters`): [`CanonicalV4GBXPrice`](../interfaces/CanonicalV4GBXPrice.md)

Returns the exact human-unit USDG price of one GBX from the official v4 Pool price at the supplied slot0 state.
Currency ordering and both token decimal scales are applied before the reduced rational is returned.

## Parameters

| Parameter    | Type                                                                                |
| ------------ | ----------------------------------------------------------------------------------- |
| `parameters` | [`CanonicalV4PoolStateParameters`](../interfaces/CanonicalV4PoolStateParameters.md) |

## Returns

[`CanonicalV4GBXPrice`](../interfaces/CanonicalV4GBXPrice.md)
