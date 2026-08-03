[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / canonicalV4PositionPrincipal

# Function: canonicalV4PositionPrincipal()

> **canonicalV4PositionPrincipal**(`parameters`): [`CanonicalV4PositionPrincipal`](../interfaces/CanonicalV4PositionPrincipal.md)

Computes the raw principal composition of one canonical v4 position using the official Uniswap v4 `Pool` and
`Position` implementations. The result excludes fees owed to the NFT because neither liquidity nor slot0 encodes
those fee-growth checkpoints.

## Parameters

| Parameter    | Type                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `parameters` | [`CanonicalV4PositionPrincipalParameters`](../interfaces/CanonicalV4PositionPrincipalParameters.md) |

## Returns

[`CanonicalV4PositionPrincipal`](../interfaces/CanonicalV4PositionPrincipal.md)
