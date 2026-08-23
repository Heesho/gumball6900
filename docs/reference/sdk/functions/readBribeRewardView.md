[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readBribeRewardView

# Function: readBribeRewardView()

> **readBribeRewardView**(`client`, `bribe`, `account`, `options?`): `Promise`\<\{ `account`: `` `0x${string}` ``; `accountSignalWeight`: `bigint`; `blockNumber`: `bigint`; `earned`: `bigint`[]; `rewardsLeft`: `bigint`[]; `rewardTokens`: `` `0x${string}` ``[]; `totalSignalWeight`: `bigint`; \}\>

Reads all rewards currently accrued by one account in a Bribe.

## Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `client`  | \{ \}                                         |
| `bribe`   | `` `0x${string}` ``                           |
| `account` | `` `0x${string}` ``                           |
| `options` | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `account`: `` `0x${string}` ``; `accountSignalWeight`: `bigint`; `blockNumber`: `bigint`; `earned`: `bigint`[]; `rewardsLeft`: `bigint`[]; `rewardTokens`: `` `0x${string}` ``[]; `totalSignalWeight`: `bigint`; \}\>
