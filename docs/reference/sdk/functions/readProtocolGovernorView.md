[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / readProtocolGovernorView

# Function: readProtocolGovernorView()

> **readProtocolGovernorView**(`client`, `protocolGovernor`, `options?`): `Promise`\<\{ `blockNumber`: `bigint`; `mine`: `` `0x${string}` ``; `name`: `string`; `proposalThreshold`: `bigint`; `quorumDenominator`: `bigint`; `quorumNumerator`: `bigint`; `resonance`: `` `0x${string}` ``; `signalGBX`: `` `0x${string}` ``; `timelock`: `` `0x${string}` ``; `timelockMinDelay`: `bigint`; `votingDelay`: `bigint`; `votingPeriod`: `bigint`; \}\>

Reads ProtocolGovernor's immutable targets, voting parameters, vote token, and Timelock delay.

## Parameters

| Parameter          | Type                                          |
| ------------------ | --------------------------------------------- |
| `client`           | \{ \}                                         |
| `protocolGovernor` | `` `0x${string}` ``                           |
| `options`          | [`ReadOptions`](../interfaces/ReadOptions.md) |

## Returns

`Promise`\<\{ `blockNumber`: `bigint`; `mine`: `` `0x${string}` ``; `name`: `string`; `proposalThreshold`: `bigint`; `quorumDenominator`: `bigint`; `quorumNumerator`: `bigint`; `resonance`: `` `0x${string}` ``; `signalGBX`: `` `0x${string}` ``; `timelock`: `` `0x${string}` ``; `timelockMinDelay`: `bigint`; `votingDelay`: `bigint`; `votingPeriod`: `bigint`; \}\>
