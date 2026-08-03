[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / pinBlockSnapshot

# Function: pinBlockSnapshot()

> **pinBlockSnapshot**(`client`, `atBlock?`, `expectedBlockHash?`): `Promise`\<[`BlockSnapshot`](../interfaces/BlockSnapshot.md)\>

Pins a block number and hash, optionally requiring a caller-supplied hash for cross-read coherence.

## Parameters

| Parameter            | Type                |
| -------------------- | ------------------- |
| `client`             | \{ \}               |
| `atBlock?`           | `bigint`            |
| `expectedBlockHash?` | `` `0x${string}` `` |

## Returns

`Promise`\<[`BlockSnapshot`](../interfaces/BlockSnapshot.md)\>
