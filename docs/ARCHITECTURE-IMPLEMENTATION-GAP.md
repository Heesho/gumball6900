# ADR 0031/0032/0036/0037 architecture reconciliation record

- Status: implemented in the development tree; independent review and release gates remain open
- Baseline recorded: 2026-08-16
- Baseline commit: `281e601ecb3f3989da826a8a7dfba37b63b55ca0`
- Authoritative decisions: [ADR 0031](adr/0031-mandatory-signal-backed-signalgbx.md), historical
  [ADR 0032](adr/0032-fixed-90-10-acquired-asset-settlement.md), and its rate-policy successor
  [ADR 0036](adr/0036-governed-global-bribe-share.md), plus the Bribe precision successor
  [ADR 0037](adr/0037-high-precision-bribe-index.md)

This document records the implementation gap found at the baseline commit and its disposition. It is engineering
traceability, not an audit result, deployment approval, or authorization for user funds.

## Baseline mismatches and disposition

| Area                       | Baseline at `281e601e`                                                             | Current development-tree disposition                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| SignalGBX entry            | Idle-producing stake, allocation, removal, and combined workflows                  | Only `signal`, `signalWithPermit`, `moveSignal`, and `withdrawSignal`; mint/allocation and removal/burn/GBX return are atomic |
| Account aggregate          | `allocatedBalance` could be lower than `balanceOf`                                 | `balanceOf` is the aggregate signal; the duplicate ledger and interface are removed                                           |
| Supply identity            | SignalGBX supply could exceed aggregate paired-Bribe supply                        | Deterministic and stateful tests enforce equality across live and killed Strategies                                           |
| Bootstrap and death        | No live count; final live Strategy could be killed                                 | `liveStrategyCount` is explicit and final-live kill reverts; replacement-then-kill governance batches remain possible         |
| BribeRouter classification | Complete payment became only a Fund liability                                      | Global 0%-20% paired-Bribe rate with prospective weighted carry; Fund receives the complement                                 |
| Settlement liveness        | Only Fund settlement existed                                                       | Fund payment and Bribe notification are isolated, permissionless, retryable liabilities                                       |
| Automatic Bribe asset      | Auction payment never entered Bribe accounting                                     | The acquired payment asset funds its selected paired-Bribe share when nonzero; USDG does not                                  |
| Bribe reward resolution    | `1e18` index precision could strand six-decimal rewards at realistic signal supply | `1e36` precision indexes raw units while its coupled lifetime cap preserves overflow safety                                   |
| Consumers                  | ABI, SDK, subgraph, app, and references exposed the superseded shape               | ABIs and references regenerated; SDK, subgraph, app, tests, and primary prose reconciled                                      |

## Preserved historical references

Earlier ADRs and baseline audit reports intentionally retain the superseded design in their historical bodies. Their
status headers identify the active superseding ADRs. Negative references such as “there is no `allocatedBalance`” and
selector-absence regression tests are also intentional and must not be confused with a callable legacy surface.

The one-pager and its fact-check register are regenerated only after their build-time contract guards agree with the
new architecture. Raw compiler output remains generated rather than hand edited.

## Remaining release boundary

Implementation conformance does not clear independent audit, legal/provenance review, final parameter selection,
monitored testnet rehearsal, or signed deployment evidence. Any later prose/implementation mismatch reopens this
blocker until the contracts, tests, consumers, generated artifacts, and an ADR are reconciled together.
