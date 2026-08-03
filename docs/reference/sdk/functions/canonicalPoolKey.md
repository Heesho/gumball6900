[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / canonicalPoolKey

# Function: canonicalPoolKey()

> **canonicalPoolKey**(`gbx`, `usdG`, `metadata`, `configuration`): [`CanonicalPoolKey`](../interfaces/CanonicalPoolKey.md)

Builds the canonical hookless Solidity PoolKey through Uniswap's v4 SDK.
Token metadata, fee, and tick spacing are mandatory; this helper supplies no deployment defaults.

## Parameters

| Parameter       | Type                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| `gbx`           | `` `0x${string}` ``                                                                         |
| `usdG`          | `` `0x${string}` ``                                                                         |
| `metadata`      | `Readonly`\<\{ `chainId`: `number`; `gbxDecimals`: `number`; `usdGDecimals`: `number`; \}\> |
| `configuration` | [`HooklessV4PoolConfiguration`](../interfaces/HooklessV4PoolConfiguration.md)               |

## Returns

[`CanonicalPoolKey`](../interfaces/CanonicalPoolKey.md)
