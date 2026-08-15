[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / ReadOptions

# Interface: ReadOptions

## Extended by

- [`ProtocolProposalReadOptions`](ProtocolProposalReadOptions.md)

## Properties

| Property                                                     | Modifier   | Type                | Description                                                                                      |
| ------------------------------------------------------------ | ---------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| <a id="property-atblock"></a> `atBlock?`                     | `readonly` | `bigint`            | Pins every RPC call in the composed view to this block; defaults to a freshly read latest block. |
| <a id="property-expectedblockhash"></a> `expectedBlockHash?` | `readonly` | `` `0x${string}` `` | Optionally binds the read to a previously observed canonical block hash.                         |
