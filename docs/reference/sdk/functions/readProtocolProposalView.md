[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readProtocolProposalView

# Function: readProtocolProposalView()

> **readProtocolProposalView**(`client`, `protocolGovernor`, `proposalId`, `options?`): `Promise`\<\{ `abstainVotes`: `bigint`; `againstVotes`: `bigint`; `blockNumber`: `bigint`; `clock`: `bigint`; `deadline`: `bigint`; `eta`: `bigint`; `forVotes`: `bigint`; `hasVoted`: `boolean` \| `null`; `needsQueuing`: `boolean`; `proposalId`: `bigint`; `proposer`: `` `0x${string}` ``; `quorum`: `bigint` \| `null`; `snapshot`: `bigint`; `state`: `number`; \}\>

Reads proposal lifecycle, vote totals, snapshot quorum, and optional account participation at one block.

## Parameters

| Parameter          | Type                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `client`           | \{ \}                                                                         |
| `protocolGovernor` | `` `0x${string}` ``                                                           |
| `proposalId`       | `bigint`                                                                      |
| `options`          | [`ProtocolProposalReadOptions`](../interfaces/ProtocolProposalReadOptions.md) |

## Returns

`Promise`\<\{ `abstainVotes`: `bigint`; `againstVotes`: `bigint`; `blockNumber`: `bigint`; `clock`: `bigint`; `deadline`: `bigint`; `eta`: `bigint`; `forVotes`: `bigint`; `hasVoted`: `boolean` \| `null`; `needsQueuing`: `boolean`; `proposalId`: `bigint`; `proposer`: `` `0x${string}` ``; `quorum`: `bigint` \| `null`; `snapshot`: `bigint`; `state`: `number`; \}\>
