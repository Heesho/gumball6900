[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readCanonicalV4Snapshot

# Function: readCanonicalV4Snapshot()

> **readCanonicalV4Snapshot**(`client`, `parameters`): `Promise`\<[`CanonicalV4Snapshot`](../interfaces/CanonicalV4Snapshot.md)\>

Reads and validates canonical v4 pool, custody, exact manager-residual state, principal, and uncollected fees at one
revalidated block. The onchain lifetime cap and active counter must agree with the complete bounded subgraph ID
index. That index is mandatory after migration; genesis alone may fall back to the manager's four immutable
position-ID getters.

## Parameters

| Parameter    | Type                                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| `client`     | \{ \}                                                                             |
| `parameters` | [`CanonicalV4SnapshotParameters`](../interfaces/CanonicalV4SnapshotParameters.md) |

## Returns

`Promise`\<[`CanonicalV4Snapshot`](../interfaces/CanonicalV4Snapshot.md)\>
