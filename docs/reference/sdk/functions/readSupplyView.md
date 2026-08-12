[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readSupplyView

# Function: readSupplyView()

> **readSupplyView**(`client`, `gbx`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `genesisLiquidityAllocation`: `bigint`; `lifetimeBurned`: `bigint`; `lifetimeMinted`: `bigint`; `minter`: `` `0x${string}` ``; `minterLocked`: `boolean`; `totalSupply`: `bigint`; \}\>

Reads cumulative GBX issuance, burns, supply, and permanent mining authority from one canonical block.

## Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `client`  | \{ \}                                         |
| `gbx`     | `` `0x${string}` ``                           |
| `options` | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `genesisLiquidityAllocation`: `bigint`; `lifetimeBurned`: `bigint`; `lifetimeMinted`: `bigint`; `minter`: `` `0x${string}` ``; `minterLocked`: `boolean`; `totalSupply`: `bigint`; \}\>
