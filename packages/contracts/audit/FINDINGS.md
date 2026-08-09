# Internal security finding register

Date: 2026-08-09

Baseline: `395a0dfbf56e3d478233736ef7a110e584a676e7`

Candidate: `codex/gumball-production-hardening`

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
| A-06 | Medium   | Open residual                                    | Permissionless LP compound timing can influence the caller-funded token composition.  |
| A-08 | Medium   | Unbounded-liveness issue resolved; cost retained | Reward loops remain capped at eight with scalar/selective exits.                      |

No unresolved Critical or High finding is known from this internal campaign. A-06 and the incomplete external,
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

## A-06 — LP compound timing remains open

`LiquidityPosition.compound()` adds the fixed 0.20% liquidity increment and returns everything accrued to the caller.
The caller funds only the Uniswap v4 shortfall. A caller can choose when to execute and may influence the spot-state
token composition needed for that increase. The contract deliberately contains no oracle, swap, keeper, governance
parameter, or fee split; adding one would violate the approved minimal design.

Disposition: open residual requiring explicit owner acceptance after independent review. Deployment range width is
the only approved design lever. No protocol-controlled NFT transfer, principal removal, or migration path exists.

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

## ADR 0021 settlement override

ADR 0021 intentionally supersedes the earlier acquisition/buyback distinction and settlement-funded reward split:

- there is one Strategy type and no `Strategy.Kind`;
- every nonzero payment is pulled by the paired BribeRouter and recorded entirely as a Fund liability;
- GBX payments are delivered to Fund without an automatic burn;
- anyone may burn all or part of Fund-held GBX through `Fund.burnGBX()` before redemption; and
- Bribes remain independently fundable, with no `bribeBps` or `setBribeBps` administration.

This is an explicit protocol decision, not an accidental deviation from the earlier architecture brief.

## Evidence disposition

- Foundry default/root: 334/334 tests pass; 28 invariants each complete 1,000 runs × 500 calls with zero handler
  reverts, for 14,000,000 aggregate calls.
- Integration profile: 21/21 pass, including the current state-machine smoke harness and real Uniswap v4 compounding.
- Hardhat: 2/2 compiler-parity/supply tests pass.
- Medusa 1.5.1: 100,069 calls, 3,632 branches, corpus 93, 62/62 surfaces pass.
- Native Echidna 2.3.3: invalid result; four workers crash before transaction one with
  `Set.elemAt: index out of range`, 0/25 tests complete, despite exit code zero.
- Pinned Echidna 2.3.2 and Mythril 0.24.8: blocked because Docker is unavailable.
- Static register: 186 exact source findings across 24 detector classes, all manually dispositioned with expiry;
  Semgrep is clean, while six redacted Gitleaks history matches await independent classification.
- Coverage: the clean non-IR instrumentation profile passes 334/334 and reports 91.79% lines, 91.22% statements,
  79.06% branches, and 87.88% functions for the compiled scope.
- Mutation: no defensible current-tree raw or equivalent-adjusted score exists; this remains a release blocker.

See `TEST-CAMPAIGN.md`, `STATIC-ANALYSIS.md`, `MUTATION-TESTING.md`, `FORMAL-CHECKS.md`, and
`RELEASE-CHECKLIST.md` for commands, limitations, and blocked capabilities.

## Remaining product decisions

- Whether independently funded multi-token Bribes remain a desired product capability. Removing them would simplify
  the graph but is an architectural change and was not made.
- Whether the inherited term `Bribe` should be renamed. A rename affects contracts, ABI, SDK, subgraph, docs, and
  protocol vocabulary and should follow, not precede, the mechanism decision.
- Whether A-06 is accepted after independent review, and what genesis range width is selected.

## Release blockers

- independent external audit and resolution of its Critical/High/Medium findings;
- current-tree pinned mutation campaign with reviewed survivors;
- pinned Echidna and Mythril execution;
- six Gitleaks history-match classifications;
- legal/provenance approval and repository-license decision;
- verified target-chain/dependency/runtime evidence at the release block; and
- complete signed deployment manifest, immutable constructor checks, timelock roles, one-time bindings, and LP custody.
