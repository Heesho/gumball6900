[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readMineSlotView

# Function: readMineSlotView()

> **readMineSlotView**(`client`, `mine`, `index`, `account`, `options?`): `Promise`\<\{ `auctionStartedAt`: `bigint`; `blockNumber`: `bigint`; `capacity`: `bigint`; `claimablePayment`: `bigint`; `currentPrice`: `bigint`; `effectiveTotalSupply`: `bigint`; `epochId`: `bigint`; `index`: `bigint`; `initialPrice`: `bigint`; `lastAccruedAt`: `bigint`; `mine`: `` `0x${string}` ``; `nextGlobalUps`: `bigint`; `pendingEmission`: `bigint`; `slotMiner`: `` `0x${string}` ``; `totalClaimable`: `bigint`; `totalMined`: `bigint`; `ups`: `bigint`; \}\>

Reads one slot's tenure-locked rate, auction state, pending GBX, and account USDG claim at one block.

## Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `client`  | \{ \}                                         |
| `mine`    | `` `0x${string}` ``                           |
| `index`   | `bigint`                                      |
| `account` | `` `0x${string}` ``                           |
| `options` | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `auctionStartedAt`: `bigint`; `blockNumber`: `bigint`; `capacity`: `bigint`; `claimablePayment`: `bigint`; `currentPrice`: `bigint`; `effectiveTotalSupply`: `bigint`; `epochId`: `bigint`; `index`: `bigint`; `initialPrice`: `bigint`; `lastAccruedAt`: `bigint`; `mine`: `` `0x${string}` ``; `nextGlobalUps`: `bigint`; `pendingEmission`: `bigint`; `slotMiner`: `` `0x${string}` ``; `totalClaimable`: `bigint`; `totalMined`: `bigint`; `ups`: `bigint`; \}\>
