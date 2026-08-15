[**GUM BALL 6900 TypeScript SDK**](../README.md)

---

[GUM BALL 6900 TypeScript SDK](../README.md) / buildCancelPendingProtocolProposal

# Function: buildCancelPendingProtocolProposal()

> **buildCancelPendingProtocolProposal**(`protocolGovernor`, `calls`, `descriptionHash`): [`ContractTransaction`](../interfaces/ContractTransaction.md)

Cancels the proposer's own proposal while it is Pending; queued cancellation is intentionally unavailable.

## Parameters

| Parameter          | Type                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| `protocolGovernor` | `` `0x${string}` ``                                                        |
| `calls`            | readonly [`ProtocolProposalCall`](../interfaces/ProtocolProposalCall.md)[] |
| `descriptionHash`  | `` `0x${string}` ``                                                        |

## Returns

[`ContractTransaction`](../interfaces/ContractTransaction.md)
