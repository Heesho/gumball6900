[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / CanonicalV4PositionSnapshot

# Interface: CanonicalV4PositionSnapshot

## Properties

| Property                                                                  | Modifier   | Type                                                                        | Description                                                                                        |
| ------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| <a id="property-allocationbps"></a> `allocationBps`                       | `readonly` | `number` \| `null`                                                          | Genesis ladder allocation; null for replacement NFTs.                                              |
| <a id="property-custodyowner"></a> `custodyOwner`                         | `readonly` | `` `0x${string}` `` \| `null`                                               | -                                                                                                  |
| <a id="property-exists"></a> `exists`                                     | `readonly` | `boolean`                                                                   | -                                                                                                  |
| <a id="property-gbxprincipalraw"></a> `gbxPrincipalRaw`                   | `readonly` | `bigint`                                                                    | -                                                                                                  |
| <a id="property-hassubscriber"></a> `hasSubscriber`                       | `readonly` | `boolean` \| `null`                                                         | -                                                                                                  |
| <a id="property-index"></a> `index`                                       | `readonly` | `number`                                                                    | -                                                                                                  |
| <a id="property-liquidity"></a> `liquidity`                               | `readonly` | `bigint`                                                                    | -                                                                                                  |
| <a id="property-positionmanagerliquidity"></a> `positionManagerLiquidity` | `readonly` | `bigint` \| `null`                                                          | -                                                                                                  |
| <a id="property-principalcomposition"></a> `principalComposition`         | `readonly` | [`CanonicalV4PositionPrincipal`](CanonicalV4PositionPrincipal.md) \| `null` | Exact current principal composition from official v4 position math; null when the NFT is inactive. |
| <a id="property-ticklower"></a> `tickLower`                               | `readonly` | `number`                                                                    | -                                                                                                  |
| <a id="property-tickupper"></a> `tickUpper`                               | `readonly` | `number`                                                                    | -                                                                                                  |
| <a id="property-tokenid"></a> `tokenId`                                   | `readonly` | `bigint`                                                                    | -                                                                                                  |
| <a id="property-uncollectedfees"></a> `uncollectedFees`                   | `readonly` | [`CanonicalV4PositionPrincipal`](CanonicalV4PositionPrincipal.md) \| `null` | Exact current fees not yet collected from this active core position.                               |
