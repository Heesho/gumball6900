[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readGenesisView

# Function: readGenesisView()

> **readGenesisView**(`client`, `contracts`, `beneficiary`, `options?`): `Promise`\<\{ `beneficiaryContribution`: `bigint`; `beneficiaryPreviewClaim`: `bigint`; `blockNumber`: `bigint`; `bootstrapContributionCap`: `bigint`; `communityUSDG`: `bigint`; `contributionEnd`: `bigint`; `contributionStart`: `bigint`; `genesisPriceWad`: `bigint`; `minimumBootstrapUSDG`: `bigint`; `requiredSponsorUSDG`: `bigint`; `settledAt`: `bigint`; `settlementDeadline`: `bigint`; `sponsorEscrow`: `bigint`; `state`: `number`; `usdGDecimals`: `number`; \}\>

## Parameters

| Parameter     | Type                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| `client`      | \{ \}                                                                          |
| `contracts`   | `Readonly`\<\{ `genesisBootstrap`: `Address`; `genesisClaims`: `Address`; \}\> |
| `beneficiary` | `` `0x${string}` ``                                                            |
| `options`     | [`ReadOptions`](../interfaces/ReadOptions.md)                                  |

## Returns

`Promise`\<\{ `beneficiaryContribution`: `bigint`; `beneficiaryPreviewClaim`: `bigint`; `blockNumber`: `bigint`; `bootstrapContributionCap`: `bigint`; `communityUSDG`: `bigint`; `contributionEnd`: `bigint`; `contributionStart`: `bigint`; `genesisPriceWad`: `bigint`; `minimumBootstrapUSDG`: `bigint`; `requiredSponsorUSDG`: `bigint`; `settledAt`: `bigint`; `settlementDeadline`: `bigint`; `sponsorEscrow`: `bigint`; `state`: `number`; `usdGDecimals`: `number`; \}\>
