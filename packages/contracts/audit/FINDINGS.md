# Internal security finding register

Date: 2026-08-09

Baseline: `395a0dfbf56e3d478233736ef7a110e584a676e7`

Reviewed candidate: `54e3f2c3ce1de25aea4da2f21fab27804a3bfa84`

Audit branch: `codex/gumball-adversarial-audit`

This register describes the current direct core after ADR 0021. It supersedes earlier findings prose tied to
Strategy kinds, settlement-funded Bribes, atomic Strategy buyback burns, or removed legacy contract graphs. Git
history retains those reports as historical evidence. This is an internal engineering review, not an independent
audit, legal approval, deployment authorization, or assurance for unlimited value.

## Current dispositions

| ID   | Severity | Status                                           | Summary                                                                               |
| ---- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| A-02 | High     | Resolved in the internal candidate               | Exact carried USDG revenue accounting replaces lossy index flooring.                  |
| A-03 | High     | Resolved in the internal candidate               | Bribe retains exact rate/index carry, zero-supply time, queues, and selective claims. |
| A-04 | High     | Resolved in the internal candidate               | Fixed Fund liabilities isolate signal exit from failing destination transfers.        |
| A-06 | Medium   | Resolved by ADR 0022                             | Fixed-principal harvesting removes caller-funded LP composition and payout.           |
| A-08 | Medium   | Unbounded-liveness issue resolved; cost retained | Reward loops remain capped at eight with scalar/selective exits.                      |
| A-09 | Medium   | Open; owner policy decision required             | Conserved scaled carry can cross a later signal-supply boundary.                      |

No unresolved Critical or High finding is known from this internal campaign. A-09 and the incomplete external,
mutation, symbolic, legal, deployment, and pinned-Echidna gates still prohibit a production-readiness claim.

## A-02 — exact Resonance revenue conservation

Previous per-notification floor loss could make sub-index-resolution USDG unreachable. Resonance now separates:

- whole accounted USDG;
- scaled pending global carry;
- scaled indexed but uncheckpointed value;
- per-Strategy scaled remainder;
- live Strategy whole claims; and
- the fixed Fund liability.

`syncRevenue()` classifies positive direct donations, `indexPendingRevenue()` makes permissionless progress, and a
balance deficit fails visibly. Stateful invariants reconcile every class against the supported-token balance after
random signal churn, Strategy death, distribution, payout, and donation actions.

Disposition: resolved in the internal candidate. Reopen if precision, carry destinations, checkpoint ordering,
Strategy death handling, or USDG transfer assumptions change.

## A-03 — exact multi-token Bribe accounting

Previous stream-rate and reward-index floors, plus elapsed zero-supply time, could strand notified value. Bribe now:

- assigns the exact stream-rate remainder over the stream's earliest seconds;
- pauses the schedule while virtual supply is zero;
- queues notifications behind active or zero-supply streams;
- retains global, indexed, and per-user scaled carry;
- accounts whole user and Fund liabilities explicitly; and
- exposes scalar and caller-selected unique-token claims so a broken token can be omitted.

`MAX_REWARD_TOKENS` remains the immutable value eight. Auction proceeds do not fund Bribes under ADR 0021; rewards
are independently funded through the Bribe's permissionless notification surface.

Disposition: resolved in the internal candidate. Reopen if stream duration, precision, reward-token cap, queueing,
claim clearing, virtual-supply hooks, or supported-token semantics change.

## A-04 — signal exit isolated from fixed destinations

A failed transfer to Fund previously could couple accounting progress to signal removal. Resonance and Bribe now
record irrevocable fixed Fund liabilities without transferring during the user's exit. BribeRouter similarly pulls
each complete Strategy payment once and records 100% as a Fund liability. Permissionless payout functions clear
effects before interaction and restore state atomically on failure.

Signal removal and unstaking transfer no USDG or reward token. Tests freeze/revert Fund-bound tokens and exercise
hostile callbacks to prove scalar and bounded-batch exits remain available while a failed payout preserves the exact
retryable amount.

Disposition: resolved in the internal candidate. Reopen if a fixed-destination transfer is added to an exit path,
liabilities become redirectable, or a payout loses exact debit/credit validation.

## A-06 — caller-funded LP composition removed

ADR 0022 removes `compound`, the fixed growth requirement, Permit2 approvals, caller funding, and caller payout.
`harvestFees()` instead collects with a zero-liquidity decrease, requires principal liquidity to remain exactly
unchanged, routes complete USDG through ResonanceRouter, and transfers complete GBX to Fund for an atomic burn.

The genuine-v4 integration suite accrues both fee assets through real swaps and proves exact routing/burning,
unchanged principal across repeated calls, direct-donation routing, caller independence, and atomic rollback when the
revenue destination rejects the route. With no liquidity increase, there is no caller-funded token-composition choice
to time or manipulate.

Disposition: resolved by the accepted ADR 0022 redesign. Reopen if caller funding or payout, a principal change, a
swap/oracle, a configurable split, or a redirectable destination is introduced. Permissionless execution has no
bounty, so delayed voluntary harvesting remains an operational residual rather than the former A-06 economic path.

## A-08 — bounded linear reward work

The append-only Bribe reward-token list remains capped at eight. Scalar signal removal, scalar reward claim,
caller-selected unique-token claim, and bounded batch operations avoid a forced unbounded whole-account loop. Final
measured gas at eight registered reward tokens is:

| Path                        |       Gas |
| --------------------------- | --------: |
| `addSignal`                 |   336,621 |
| `removeSignal`              | 1,341,818 |
| one selected-token claim    |   168,113 |
| selective eight-token claim | 1,348,052 |
| all-token convenience claim | 1,339,891 |
| `Strategy.buy`              |   196,941 |

Disposition: the liveness issue is resolved; bounded linear cost is retained and documented. Reopen if the cap rises,
a scalar/selective path is removed, a loop body gains another interaction, or the target-chain transaction limit
falls materially.

## A-09 — scaled carry crosses signal-supply boundaries

| Field                         | Record                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ID / title                    | A-09 — conserved scaled carry crosses a later signal-supply boundary                                                                                         |
| Severity / confidence         | Medium / high                                                                                                                                                |
| Reviewed commit               | `54e3f2c3ce1de25aea4da2f21fab27804a3bfa84`                                                                                                                   |
| Affected files                | `src/core/Resonance.sol`, `src/core/Bribe.sol`                                                                                                               |
| Affected functions            | `Resonance._classifyRevenue`, `Resonance._indexPendingRevenue`, `Bribe._accrueUntil`, `Bribe._indexPendingReward`, and signal-supply mutation checkpoints    |
| Violated invariant            | Value received or emitted before an account/Strategy enters should not be allocated to that later entrant.                                                   |
| Preconditions                 | Nonzero signal, carry below one index unit, a signal-denominator change, and later value that crosses the threshold.                                         |
| Attacker capabilities         | Permissionless stake/signal changes and transaction ordering; no lock or cooldown is required.                                                               |
| Exact sequence                | Accumulate 99 base units below resolution, add equal late weight, then add/emit 101 units so the combined carry indexes under the doubled denominator.       |
| Supply / custody / solvency   | No GBX supply or custody loss; all accounting identities remain solvent and exactly conserved.                                                               |
| Reward impact                 | A late signaler can receive reward emitted before entry.                                                                                                     |
| Signal-exit / Fund / liveness | No exit or Fund transfer is blocked; the defect is allocation fairness, not reachability.                                                                    |
| Economic impact               | Pending value is temporally reallocated; the bound approaches one billion base units at maximum signal supply.                                               |
| Minimal PoC / regression      | `test_KnownRisk_NewStrategySignalCanReceivePreEntryRevenueCarry` and `test_KnownRisk_NewSignalerCanReceivePreEntryRewardCarry` in `CarryReallocation.t.sol`. |
| Recommended remediation       | Choose exact historical buckets, a fixed dust destination on denominator change, or explicit acceptance with supported-decimal limits.                       |
| Implemented remediation       | None; each exact option changes bounded storage/exit behavior or economic policy.                                                                            |
| Final status                  | Open owner and independent-auditor decision.                                                                                                                 |

Resonance and Bribe conserve sub-index carry, but both divide that carry by the total signal supply that exists when
the carry finally crosses index resolution. If supply changed after the underlying revenue or reward was received or
emitted, a later Strategy signal or account can receive part of the earlier carry. The conservation identities remain
exact, so solvency invariants alone do not expose the temporal reallocation.

Minimal current-source proofs are preserved in `CarryReallocation.t.sol`:

- 99 USDG base units arrive while two incumbents direct 100 ether of signal to one Strategy; after a second Strategy
  receives 100 ether of new signal, 101 more units advance the index and allocate 100 units to the late Strategy;
- 99 reward base units emit for two incumbent signalers; a new 100-ether signal then enters, and after 101 more units
  emit the new signaler can claim 100 units—more than its maximum pro-rata share of the post-entry emission.

The value at risk before each index advance is bounded by less than `totalSignalWeight / 1e18` token base units. At
the one-billion-GBX lifetime ceiling this can approach one billion base units per carry bucket: immaterial for an
18-decimal token, but up to 1,000 whole tokens for a six-decimal token. Signal has no lock or cooldown, so timing can
be permissionless and potentially flash-funded.

Disposition: open Medium economic-allocation issue. Exact historical attribution with changing denominators requires
enumerating all beneficiaries, retaining denominator-specific buckets, or adopting an explicit dust destination at
weight changes. Each option changes the bounded-exit, storage, or economic policy. The architecture is preserved and
no unilateral production fix is made pending owner and independent-review direction.

## ADR 0021 settlement override

ADR 0021 intentionally supersedes the earlier acquisition/buyback distinction and settlement-funded reward split:

- there is one Strategy type and no `Strategy.Kind`;
- every nonzero payment is pulled by the paired BribeRouter and recorded entirely as a Fund liability;
- GBX payments are delivered to Fund without an automatic burn;
- anyone may burn all or part of Fund-held GBX through `Fund.burnGBX()` before redemption; and
- Bribes remain independently fundable, with no `bribeBps` or `setBribeBps` administration.

This is an explicit protocol decision, not an accidental deviation from the earlier architecture brief.

## Evidence disposition

- Foundry default/root: 340/340 tests pass. The 27 stateful invariant properties each complete 1,000 runs × 500
  calls with zero handler reverts, for 13,500,000 aggregate calls; the 28th invariant-suite test proves all 22
  handler actions are reachable.
- Integration profile: 17/17 pass (11 genuine-v4 fee-harvest tests plus six campaign-harness tests). The focused
  fee-harvest fuzz test also passed 10,000 cases.
- Hardhat: 2/2 compiler-parity/supply tests pass.
- Medusa 1.5.1: 101,840 calls, 3,632 branches, corpus 101, 62/62 surfaces pass.
- Native Echidna 2.3.3: invalid result; four workers crash before transaction one with
  `Set.elemAt: index out of range`, 0/25 tests complete, despite exit code zero.
- Pinned Echidna 2.3.2 is blocked because Docker is unavailable. Native Echidna 2.3.3 is an invalid run: all four
  workers crash before transaction one.
- The Mythril runner now targets the exact 12-contract graph and fails closed: constructor-resolved runtimes are
  required, while GBX, SignalGBX, Fund, and LiquidityPosition contain Cancun opcodes unsupported by Mythril 0.24.8.
- Static register: 186 exact source findings across 23 detector classes, all manually dispositioned with expiry;
  Semgrep is clean, while six redacted Gitleaks history matches await independent classification.
- Coverage: the clean non-IR instrumentation profile passes 340/340 and reports 92.98% lines, 92.86% statements,
  80.22% branches, and 89.34% functions for the compiled scope. A fail-closed per-file policy now exactly enumerates
  all 12 direct core contracts and accepts this report.
- Mutation: no defensible current-tree raw or equivalent-adjusted score exists; this remains a release blocker.

See `TEST-CAMPAIGN.md`, `STATIC-ANALYSIS.md`, `MUTATION-TESTING.md`, `FORMAL-CHECKS.md`, and
`RELEASE-CHECKLIST.md` for commands, limitations, and blocked capabilities.

## Remaining product decisions

- Whether independently funded multi-token Bribes remain a desired product capability. Removing them would simplify
  the graph but is an architectural change and was not made.
- Whether the inherited term `Bribe` should be renamed. A rename affects contracts, ABI, SDK, subgraph, docs, and
  protocol vocabulary and should follow, not precede, the mechanism decision.
- Whether A-09 should preserve exact historical attribution, classify carry to a fixed destination on weight change,
  or explicitly accept the current carry-forward allocation for every supported token decimal scale.

## Release blockers

- independent external audit and resolution of its Critical/High/Medium findings;
- current-tree pinned mutation campaign with reviewed survivors;
- pinned Echidna and Mythril execution;
- six Gitleaks history-match classifications;
- legal/provenance approval and repository-license decision;
- verified target-chain/dependency/runtime evidence at the release block; and
- complete signed deployment manifest, immutable constructor checks, timelock roles, one-time bindings, and LP custody.
