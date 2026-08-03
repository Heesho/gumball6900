[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / CanonicalV4SnapshotParameters

# Interface: CanonicalV4SnapshotParameters

## Properties

| Property                                                 | Modifier   | Type                                                                                                                                                                                                                                                                                                | Description                                                           |
| -------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| <a id="property-activepositions"></a> `activePositions?` | `readonly` | [`CanonicalV4ActivePositionIndex`](CanonicalV4ActivePositionIndex.md)                                                                                                                                                                                                                               | Complete bounded active-ID index. Required after the first migration. |
| <a id="property-expected"></a> `expected`                | `readonly` | `Readonly`\<\{ `chainId`: `number`; `gbx`: `Address`; `gbxDecimals`: `number`; `launchGuardHook`: `Address`; `liquidityManager`: `Address`; `permit2`: `Address`; `poolManager`: `Address`; `positionManager`: `Address`; `stateView`: `Address`; `usdG`: `Address`; `usdGDecimals`: `number`; \}\> | Values below must come from one validated signed runtime manifest.    |
