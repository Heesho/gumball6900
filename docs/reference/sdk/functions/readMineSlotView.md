[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readMineSlotView

# Function: readMineSlotView()

> **readMineSlotView**(`client`, `mine`, `index`, `account`, `options?`): `Promise`\<\{ `aggregateTps`: `bigint`; `auctionStartedAt`: `bigint`; `blockNumber`: `bigint`; `blockTimestamp`: `bigint`; `claimableMinerPayment`: `bigint`; `currentHalvingEra`: `bigint`; `currentPrice`: `bigint`; `effectiveTotalSupply`: `bigint`; `epochId`: `bigint`; `halvingPeriod`: `bigint`; `index`: `bigint`; `initialPrice`: `bigint`; `lastAccruedAt`: `bigint`; `mine`: `` `0x${string}` ``; `nextGlobalTps`: `bigint`; `nextHalvingBoundary`: `bigint` \| `null`; `pendingSlotEmission`: `bigint`; `prospectiveSlotTps`: `bigint`; `slotCount`: `bigint`; `slotMiner`: `` `0x${string}` ``; `startTime`: `bigint`; `tailTps`: `bigint`; `totalClaimableMinerPayments`: `bigint`; `totalMined`: `bigint`; `totalPendingEmission`: `bigint`; `tps`: `bigint`; \}\>

Reads one slot, Mine accounting, and the time-based prospective-rate boundary at one canonical block.

## Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `client`  | \{ \}                                         |
| `mine`    | `` `0x${string}` ``                           |
| `index`   | `bigint`                                      |
| `account` | `` `0x${string}` ``                           |
| `options` | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `aggregateTps`: `bigint`; `auctionStartedAt`: `bigint`; `blockNumber`: `bigint`; `blockTimestamp`: `bigint`; `claimableMinerPayment`: `bigint`; `currentHalvingEra`: `bigint`; `currentPrice`: `bigint`; `effectiveTotalSupply`: `bigint`; `epochId`: `bigint`; `halvingPeriod`: `bigint`; `index`: `bigint`; `initialPrice`: `bigint`; `lastAccruedAt`: `bigint`; `mine`: `` `0x${string}` ``; `nextGlobalTps`: `bigint`; `nextHalvingBoundary`: `bigint` \| `null`; `pendingSlotEmission`: `bigint`; `prospectiveSlotTps`: `bigint`; `slotCount`: `bigint`; `slotMiner`: `` `0x${string}` ``; `startTime`: `bigint`; `tailTps`: `bigint`; `totalClaimableMinerPayments`: `bigint`; `totalMined`: `bigint`; `totalPendingEmission`: `bigint`; `tps`: `bigint`; \}\>
