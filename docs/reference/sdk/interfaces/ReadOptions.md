[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / ReadOptions

# Interface: ReadOptions

## Properties

| Property                                                     | Modifier   | Type                | Description                                                                                   |
| ------------------------------------------------------------ | ---------- | ------------------- | --------------------------------------------------------------------------------------------- |
| <a id="property-atblock"></a> `atBlock?`                     | `readonly` | `bigint`            | Pins every RPC call in a composed view to one block. Defaults to a freshly read latest block. |
| <a id="property-expectedblockhash"></a> `expectedBlockHash?` | `readonly` | `` `0x${string}` `` | Optional expected hash for binding multiple SDK reads to the same canonical block.            |
