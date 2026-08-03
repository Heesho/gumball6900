[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readMiningEpochView

# Function: readMiningEpochView()

> **readMiningEpochView**(`client`, `contracts`, `epochId`, `beneficiary`, `options?`): `Promise`\<\{ `beneficiaryContribution`: `bigint`; `beneficiaryPreviewClaim`: `bigint`; `blockNumber`: `bigint`; `contributionsPaused`: `boolean`; `currentEpochId`: `bigint`; `epoch`: \{ `actualEmission`: `bigint`; `clearingPrice`: `bigint`; `endTime`: `bigint`; `extensionUsed`: `bigint`; `invalidated`: `boolean`; `minimumMiningPrice`: `bigint`; `scheduledEmission`: `bigint`; `settled`: `boolean`; `settledAt`: `bigint`; `startTime`: `bigint`; `totalContributed`: `bigint`; \}; `epochId`: `bigint`; `referenceMiningPriceWad`: `bigint`; `usdGDecimals`: `number`; \}\>

## Parameters

| Parameter     | Type                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| `client`      | \{ \}                                                                   |
| `contracts`   | `Readonly`\<\{ `miningClaims`: `Address`; `miningPool`: `Address`; \}\> |
| `epochId`     | `bigint`                                                                |
| `beneficiary` | `` `0x${string}` ``                                                     |
| `options`     | [`ReadOptions`](../interfaces/ReadOptions.md)                           |

## Returns

`Promise`\<\{ `beneficiaryContribution`: `bigint`; `beneficiaryPreviewClaim`: `bigint`; `blockNumber`: `bigint`; `contributionsPaused`: `boolean`; `currentEpochId`: `bigint`; `epoch`: \{ `actualEmission`: `bigint`; `clearingPrice`: `bigint`; `endTime`: `bigint`; `extensionUsed`: `bigint`; `invalidated`: `boolean`; `minimumMiningPrice`: `bigint`; `scheduledEmission`: `bigint`; `settled`: `boolean`; `settledAt`: `bigint`; `startTime`: `bigint`; `totalContributed`: `bigint`; \}; `epochId`: `bigint`; `referenceMiningPriceWad`: `bigint`; `usdGDecimals`: `number`; \}\>
