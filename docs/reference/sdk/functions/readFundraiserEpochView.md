[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readFundraiserEpochView

# Function: readFundraiserEpochView()

> **readFundraiserEpochView**(`client`, `fundraiser`, `epoch`, `account`, `options?`): `Promise`\<\{ `accountContribution`: `bigint`; `accountHasClaimed`: `boolean`; `blockNumber`: `bigint`; `currentEpoch`: `bigint`; `emission`: `bigint`; `epoch`: `bigint`; `epochSettled`: `boolean`; `nextEpochToSettle`: `bigint`; `nextScheduledEmission`: `bigint`; `pendingReward`: `bigint`; `totalContributions`: `bigint`; \}\>

Reads one account's contribution and claim state for a Fundraiser epoch.

## Parameters

| Parameter    | Type                                          |
| ------------ | --------------------------------------------- |
| `client`     | \{ \}                                         |
| `fundraiser` | `` `0x${string}` ``                           |
| `epoch`      | `bigint`                                      |
| `account`    | `` `0x${string}` ``                           |
| `options`    | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `accountContribution`: `bigint`; `accountHasClaimed`: `boolean`; `blockNumber`: `bigint`; `currentEpoch`: `bigint`; `emission`: `bigint`; `epoch`: `bigint`; `epochSettled`: `boolean`; `nextEpochToSettle`: `bigint`; `nextScheduledEmission`: `bigint`; `pendingReward`: `bigint`; `totalContributions`: `bigint`; \}\>
