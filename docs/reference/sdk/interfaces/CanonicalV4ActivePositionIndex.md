[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / CanonicalV4ActivePositionIndex

# Interface: CanonicalV4ActivePositionIndex

## Properties

| Property                                                        | Modifier   | Type                | Description                                                                       |
| --------------------------------------------------------------- | ---------- | ------------------- | --------------------------------------------------------------------------------- |
| <a id="property-activepositioncount"></a> `activePositionCount` | `readonly` | `number`            | Pinned LiquidityPool count, which must equal the complete bounded ID list.        |
| <a id="property-indexedblock"></a> `indexedBlock`               | `readonly` | `bigint`            | Subgraph `_meta.block.number` used to pin every corresponding RPC read.           |
| <a id="property-indexedblockhash"></a> `indexedBlockHash`       | `readonly` | `` `0x${string}` `` | Subgraph `_meta.block.hash`; the RPC block must match before and after all reads. |
| <a id="property-migrationcount"></a> `migrationCount`           | `readonly` | `bigint`            | Pinned LiquidityPool counter, cross-checked against the onchain manager counter.  |
| <a id="property-positionids"></a> `positionIds`                 | `readonly` | readonly `bigint`[] | -                                                                                 |
