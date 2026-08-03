[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / canonicalPoolKey

# Function: canonicalPoolKey()

> **canonicalPoolKey**(`gbx`, `usdG`, `launchGuardHook`, `metadata`): [`CanonicalPoolKey`](../interfaces/CanonicalPoolKey.md)

Builds the canonical Solidity PoolKey through Uniswap's v4 SDK.
Token metadata is mandatory because the canonical USDG token uses six decimals.

## Parameters

| Parameter         | Type                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `gbx`             | `` `0x${string}` ``                                                                         |
| `usdG`            | `` `0x${string}` ``                                                                         |
| `launchGuardHook` | `` `0x${string}` ``                                                                         |
| `metadata`        | `Readonly`\<\{ `chainId`: `number`; `gbxDecimals`: `number`; `usdGDecimals`: `number`; \}\> |

## Returns

[`CanonicalPoolKey`](../interfaces/CanonicalPoolKey.md)
