[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / LiquidityMigrationPlan

# Interface: LiquidityMigrationPlan

## Properties

| Property                                                      | Modifier   | Type                                                                           |
| ------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| <a id="property-deadline"></a> `deadline`                     | `readonly` | `bigint`                                                                       |
| <a id="property-destinationpoolkey"></a> `destinationPoolKey` | `readonly` | `object`                                                                       |
| `destinationPoolKey.currency0`                                | `readonly` | `` `0x${string}` ``                                                            |
| `destinationPoolKey.currency1`                                | `readonly` | `` `0x${string}` ``                                                            |
| `destinationPoolKey.fee`                                      | `readonly` | `number`                                                                       |
| `destinationPoolKey.hooks`                                    | `readonly` | `` `0x${string}` ``                                                            |
| `destinationPoolKey.tickSpacing`                              | `readonly` | `number`                                                                       |
| <a id="property-removals"></a> `removals`                     | `readonly` | readonly [`LiquidityMigrationRemoval`](LiquidityMigrationRemoval.md)[]         |
| <a id="property-replacements"></a> `replacements`             | `readonly` | readonly [`LiquidityMigrationReplacement`](LiquidityMigrationReplacement.md)[] |
