# ADR 0031/0037/0047/0048 architecture reconciliation record

- Status: implemented in the development tree; independent review and release gates remain open
- Baseline recorded: 2026-08-16
- Baseline commit: `281e601ecb3f3989da826a8a7dfba37b63b55ca0`
- Authoritative decisions: [ADR 0031](adr/0031-mandatory-signal-backed-signalgbx.md),
  [ADR 0037](adr/0037-high-precision-bribe-index.md), and
  [ADR 0047](adr/0047-synthetix-shaped-rewards-and-strategy-settlement.md), and
  [ADR 0048](adr/0048-expand-bribe-rewards-and-compose-signal-moves.md). ADRs 0032 and 0036 remain historical records
  of the superseded deferred-liability and weighted-carry design.

This document records the implementation gap found at the baseline commit and its disposition. It is engineering
traceability, not an audit result, deployment approval, or authorization for user funds.

## Baseline mismatches and disposition

| Area                   | Baseline at `281e601e`                                                                                                   | Current development-tree disposition                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| SignalGBX entry        | Idle-producing stake, allocation, removal, and combined workflows                                                        | Only `signal`, `signalWithPermit`, `moveSignal`, and `withdrawSignal`; movement atomically composes the retained remove/add hooks   |
| Account aggregate      | `allocatedBalance` could be lower than `balanceOf`                                                                       | `balanceOf` is the aggregate signal; the duplicate ledger and interface are removed                                                 |
| Supply identity        | SignalGBX supply could exceed aggregate paired-Bribe supply                                                              | Deterministic and stateful tests enforce equality across live and killed Strategies                                                 |
| Bootstrap and death    | No live count; final live Strategy could be killed                                                                       | `liveStrategyCount` is explicit and final-live kill reverts; replacement-then-kill governance batches remain possible               |
| Payment classification | Complete payment became only a deferred Fund liability                                                                   | Strategy snapshots the global 0%-20% rate, floors each purchase independently, pays Fund directly, and buffers only the Bribe share |
| Settlement boundary    | Only deferred Fund settlement existed                                                                                    | Fund receipt is atomic with purchase; BribeRouter permissionlessly retries only qualifying buffered Bribe notifications             |
| Automatic Bribe asset  | Auction payment never entered Bribe accounting                                                                           | The acquired payment asset funds its selected paired-Bribe share when nonzero; USDG does not                                        |
| Reward engine          | `1e18` precision could strand low-decimal rewards; later designs added exact carry, queues, pauses, and Fund liabilities | `1e36` indices and lifetime caps remain, while standard Synthetix leftover rollover accepts rate/index/account floors as surplus    |
| Bribe loop bound       | The first bounded design admitted eight reward tokens                                                                    | `MAX_REWARD_TOKENS = 16`; the registry remains append-only and every mandatory loop remains fixed                                   |
| Signal move surface    | Resonance exposed a dedicated `moveSignalFor` hook                                                                       | SignalGBX composes `removeSignalFor` then `addSignalFor` atomically; the duplicate Resonance selector is removed                    |
| Consumers              | ABI, SDK, subgraph, app, and references exposed superseded shapes                                                        | Core source, tests, and current prose target ADRs through 0050; generated and downstream consumers remain coordinated release gates |

## Preserved historical references

Earlier ADRs and baseline audit reports intentionally retain superseded designs in their explicitly historical
bodies. Their status headers identify the active superseding ADRs. Current operational prose must not describe
weighted split carry, deferred payment liabilities, reward queues or pauses, Fund reward carry, or exact remainder
scheduling as callable behavior. Negative selector-absence regression tests remain intentional.

The one-pager and its fact-check register are regenerated only after their build-time contract guards agree with the
new architecture. Raw compiler output remains generated rather than hand edited.

## Remaining release boundary

Implementation conformance does not clear independent audit, legal/provenance review, final parameter selection,
monitored testnet rehearsal, or signed deployment evidence. Any later prose/implementation mismatch reopens this
blocker until the contracts, tests, consumers, generated artifacts, and an ADR are reconciled together.
