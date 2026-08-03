[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readAuctionView

# Function: readAuctionView()

> **readAuctionView**(`client`, `strategyAddress`, `kind`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `epochId`: `bigint`; `epochPeriod`: `bigint`; `fillsPaused`: `boolean`; `initPrice`: `bigint`; `kind`: `"acquisition"` \| `"buyback"`; `minInitPrice`: `bigint`; `price`: `null`; `priceMultiplier`: `bigint`; `rewards`: `` `0x${string}` `` \| `null`; `startTime`: `0n`; `status`: `"inactive"`; `strategy`: `` `0x${string}` ``; `targetToken`: `` `0x${string}` ``; `usdGLot`: `bigint`; \} \| \{ `blockNumber`: `bigint`; `epochId`: `bigint`; `epochPeriod`: `bigint`; `fillsPaused`: `boolean`; `initPrice`: `bigint`; `kind`: `"acquisition"` \| `"buyback"`; `minInitPrice`: `bigint`; `price`: `bigint`; `priceMultiplier`: `bigint`; `rewards`: `` `0x${string}` `` \| `null`; `startTime`: `bigint`; `status`: `"active"`; `strategy`: `` `0x${string}` ``; `targetToken`: `` `0x${string}` ``; `usdGLot`: `bigint`; \}\>

## Parameters

| Parameter         | Type                                          |
| ----------------- | --------------------------------------------- |
| `client`          | \{ \}                                         |
| `strategyAddress` | `` `0x${string}` ``                           |
| `kind`            | `"acquisition"` \| `"buyback"`                |
| `options`         | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `epochId`: `bigint`; `epochPeriod`: `bigint`; `fillsPaused`: `boolean`; `initPrice`: `bigint`; `kind`: `"acquisition"` \| `"buyback"`; `minInitPrice`: `bigint`; `price`: `null`; `priceMultiplier`: `bigint`; `rewards`: `` `0x${string}` `` \| `null`; `startTime`: `0n`; `status`: `"inactive"`; `strategy`: `` `0x${string}` ``; `targetToken`: `` `0x${string}` ``; `usdGLot`: `bigint`; \} \| \{ `blockNumber`: `bigint`; `epochId`: `bigint`; `epochPeriod`: `bigint`; `fillsPaused`: `boolean`; `initPrice`: `bigint`; `kind`: `"acquisition"` \| `"buyback"`; `minInitPrice`: `bigint`; `price`: `bigint`; `priceMultiplier`: `bigint`; `rewards`: `` `0x${string}` `` \| `null`; `startTime`: `bigint`; `status`: `"active"`; `strategy`: `` `0x${string}` ``; `targetToken`: `` `0x${string}` ``; `usdGLot`: `bigint`; \}\>
