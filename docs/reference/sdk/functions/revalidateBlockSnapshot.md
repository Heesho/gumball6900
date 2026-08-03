[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / revalidateBlockSnapshot

# Function: revalidateBlockSnapshot()

> **revalidateBlockSnapshot**(`client`, `snapshot`): `Promise`\<`void`\>

Re-reads a pinned block header and fails if a reorg replaced the observed block hash.

## Parameters

| Parameter  | Type                                              |
| ---------- | ------------------------------------------------- |
| `client`   | \{ \}                                             |
| `snapshot` | [`BlockSnapshot`](../interfaces/BlockSnapshot.md) |

## Returns

`Promise`\<`void`\>
