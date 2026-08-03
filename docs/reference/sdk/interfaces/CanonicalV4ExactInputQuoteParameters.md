[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / CanonicalV4ExactInputQuoteParameters

# Interface: CanonicalV4ExactInputQuoteParameters

## Properties

| Property                                                     | Modifier   | Type                                      | Description                                                                                              |
| ------------------------------------------------------------ | ---------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| <a id="property-atblock"></a> `atBlock?`                     | `readonly` | `bigint`                                  | -                                                                                                        |
| <a id="property-exactamountraw"></a> `exactAmountRaw`        | `readonly` | `bigint`                                  | -                                                                                                        |
| <a id="property-expectedblockhash"></a> `expectedBlockHash?` | `readonly` | `` `0x${string}` ``                       | Optional hash binding for comparing multiple quotes at one exact canonical block.                        |
| <a id="property-inputcurrency"></a> `inputCurrency`          | `readonly` | `` `0x${string}` ``                       | -                                                                                                        |
| <a id="property-inputdecimals"></a> `inputDecimals`          | `readonly` | `number`                                  | -                                                                                                        |
| <a id="property-outputdecimals"></a> `outputDecimals`        | `readonly` | `number`                                  | -                                                                                                        |
| <a id="property-poolkey"></a> `poolKey`                      | `readonly` | [`CanonicalPoolKey`](CanonicalPoolKey.md) | -                                                                                                        |
| <a id="property-quoter"></a> `quoter`                        | `readonly` | `` `0x${string}` ``                       | Must come from a verified deployment manifest; unresolved/provisional Quoter addresses must not be used. |
