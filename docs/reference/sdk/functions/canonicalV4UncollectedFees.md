[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / canonicalV4UncollectedFees

# Function: canonicalV4UncollectedFees()

> **canonicalV4UncollectedFees**(`parameters`): [`CanonicalV4PositionPrincipal`](../interfaces/CanonicalV4PositionPrincipal.md)

Applies Uniswap v4 Position fee accounting exactly: uint256-wrapped growth deltas followed by Q128 floor math,
then maps currency0/currency1 into GBX/USDG identity.

## Parameters

| Parameter    | Type                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parameters` | `Readonly`\<\{ `currentFeeGrowth0X128`: `bigint`; `currentFeeGrowth1X128`: `bigint`; `gbxIsCurrency0`: `boolean`; `lastFeeGrowth0X128`: `bigint`; `lastFeeGrowth1X128`: `bigint`; `liquidity`: `bigint`; \}\> |

## Returns

[`CanonicalV4PositionPrincipal`](../interfaces/CanonicalV4PositionPrincipal.md)
