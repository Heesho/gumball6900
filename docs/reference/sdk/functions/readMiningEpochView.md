[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readMiningEpochView

# Function: readMiningEpochView()

> **readMiningEpochView**(`client`, `contracts`, `epochId`, `beneficiary`, `options?`): `Promise`\<\{ `beneficiaryContribution`: `bigint`; `beneficiaryHasClaimed`: `boolean`; `beneficiaryPreviewClaim`: `bigint`; `blockNumber`: `bigint`; `contributionsPaused`: `boolean`; `currentEpochId`: `bigint`; `emission`: `bigint`; `endTime`: `bigint`; `epochId`: `bigint`; `settled`: `boolean`; `settledAt`: `bigint`; `started`: `boolean`; `startTime`: `bigint`; `teamFee`: `bigint`; `totalContributed`: `bigint`; `vaultRevenue`: `bigint`; \}\>

## Parameters

| Parameter     | Type                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| `client`      | \{ \}                                                                   |
| `contracts`   | `Readonly`\<\{ `miningClaims`: `Address`; `miningPool`: `Address`; \}\> |
| `epochId`     | `bigint`                                                                |
| `beneficiary` | `` `0x${string}` ``                                                     |
| `options`     | [`ReadOptions`](../interfaces/ReadOptions.md)                           |

## Returns

`Promise`\<\{ `beneficiaryContribution`: `bigint`; `beneficiaryHasClaimed`: `boolean`; `beneficiaryPreviewClaim`: `bigint`; `blockNumber`: `bigint`; `contributionsPaused`: `boolean`; `currentEpochId`: `bigint`; `emission`: `bigint`; `endTime`: `bigint`; `epochId`: `bigint`; `settled`: `boolean`; `settledAt`: `bigint`; `started`: `boolean`; `startTime`: `bigint`; `teamFee`: `bigint`; `totalContributed`: `bigint`; `vaultRevenue`: `bigint`; \}\>
