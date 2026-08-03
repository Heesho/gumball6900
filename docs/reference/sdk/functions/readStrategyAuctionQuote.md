[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readStrategyAuctionQuote

# Function: readStrategyAuctionQuote()

> **readStrategyAuctionQuote**(`client`, `parameters`, `options?`): `Promise`\<\{ `auctionDuration`: `bigint`; `auctionExpiresAt`: `bigint`; `auctionId`: `bigint`; `auctionStartTime`: `bigint`; `availableBudgetRaw`: `bigint`; `blockNumber`: `bigint`; `blockTimestamp`: `bigint`; `currentRateWad`: `bigint`; `fillsPaused`: `boolean`; `floorRateWad`: `bigint`; `isExpired`: `boolean`; `isLiveStrategy`: `boolean`; `kind`: `"acquisition"` \| `"buyback"`; `maximumLotUSDGRaw`: `bigint`; `minimumLotUSDGRaw`: `bigint`; `referenceRateWad`: `bigint`; `requiredTargetRaw`: `bigint`; `startRateWad`: `bigint`; `strategy`: `` `0x${string}` ``; `targetDecimals`: `number`; `usdGAmountRaw`: `bigint`; `usdGDecimals`: `number`; \}\>

## Parameters

| Parameter    | Type                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `client`     | \{ \}                                                                                                         |
| `parameters` | `Readonly`\<\{ `kind`: `"acquisition"` \| `"buyback"`; `strategy`: `Address`; `usdGAmountRaw`: `bigint`; \}\> |
| `options`    | [`ReadOptions`](../interfaces/ReadOptions.md)                                                                 |

## Returns

`Promise`\<\{ `auctionDuration`: `bigint`; `auctionExpiresAt`: `bigint`; `auctionId`: `bigint`; `auctionStartTime`: `bigint`; `availableBudgetRaw`: `bigint`; `blockNumber`: `bigint`; `blockTimestamp`: `bigint`; `currentRateWad`: `bigint`; `fillsPaused`: `boolean`; `floorRateWad`: `bigint`; `isExpired`: `boolean`; `isLiveStrategy`: `boolean`; `kind`: `"acquisition"` \| `"buyback"`; `maximumLotUSDGRaw`: `bigint`; `minimumLotUSDGRaw`: `bigint`; `referenceRateWad`: `bigint`; `requiredTargetRaw`: `bigint`; `startRateWad`: `bigint`; `strategy`: `` `0x${string}` ``; `targetDecimals`: `number`; `usdGAmountRaw`: `bigint`; `usdGDecimals`: `number`; \}\>
