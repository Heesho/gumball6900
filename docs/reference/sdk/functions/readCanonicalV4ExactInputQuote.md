[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readCanonicalV4ExactInputQuote

# Function: readCanonicalV4ExactInputQuote()

> **readCanonicalV4ExactInputQuote**(`client`, `parameters`): `Promise`\<[`CanonicalV4ExactInputQuote`](../interfaces/CanonicalV4ExactInputQuote.md)\>

Reads the official v4 Quoter's single-pool exact-input result for the canonical pool.
This deliberately returns no Universal Router calldata and accepts no arbitrary path or hook data.

## Parameters

| Parameter    | Type                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `client`     | \{ \}                                                                                           |
| `parameters` | [`CanonicalV4ExactInputQuoteParameters`](../interfaces/CanonicalV4ExactInputQuoteParameters.md) |

## Returns

`Promise`\<[`CanonicalV4ExactInputQuote`](../interfaces/CanonicalV4ExactInputQuote.md)\>
