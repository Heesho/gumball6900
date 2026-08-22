# Internal security finding register

Date: 2026-08-16. Governance, Bribe-cap, payment-share, Bribe-precision, Mine-halving, Mine-routing, and Mine dependency
verification dispositions reconciled 2026-08-22 through ADR 0045.

Status: ADRs 0031 and 0033-0045 form an uncommitted development candidate. On 2026-08-22, the immediately preceding
ADR 0044 working tree passed the full deterministic repository matrix: 356/356 default-profile Forge tests across 25 suites, 19/19
integration tests across 2 suites, Hardhat 4/4, SDK 50/50, TypeScript simulations 39/39, Python environment-policy
checks 5/5 and simulations 25/25, subgraph specification checks 4/4 plus Matchstick 10/10 and build, web unit tests
3/3, Playwright 6/6, and the ABI, documentation, formatting, lint, typecheck, and workspace-build gates. The Forge
matrix includes 27 stateful invariant entries at 1,000 runs of depth 500 plus two deterministic reachability regressions
(29/29 for the suite) with zero handler reverts. The pinned mutation, native external-fuzzer, and static-analyzer
campaigns still predate ADR 0044 and are not current Mine evidence. The candidate has no pinned review commit and has
not received an independent audit, compatible symbolic analysis, external-governance integration review, or release
review required for deployment. Current campaign-specific findings are in `SIGNAL-RESONANCE-FINDINGS.md`.

## Current dispositions

| ID   | Severity | Status                                                        | Summary                                                                                                                                       |
| ---- | -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A-02 | High     | Accepted by ADR 0029                                          | Resonance can retain explicit rounding, zero-signal, and direct-donation USDG surplus.                                                        |
| A-03 | High     | Previously resolved; regression coverage retained             | Bribe retains exact rate/index carry, zero-supply time, queues, and selective claims.                                                         |
| A-04 | High     | Previously resolved; regression coverage retained             | Fixed Fund liabilities isolate signal exit from failing transfers.                                                                            |
| A-06 | Medium   | Resolved by ADR 0022                                          | Liquidity fee harvesting preserves fixed principal and fixed destinations.                                                                    |
| A-08 | Medium   | Liveness resolved; bounded cost retained                      | Bribe work remains capped at eight reward tokens.                                                                                             |
| A-09 | Medium   | Resonance accepted by ADR 0029; Bribe resolved by ADR 0027    | Resonance accepts flooring surplus; Bribe fixes old-denominator carry to Fund before signal-supply changes.                                   |
| A-10 | High     | Superseded design; current mechanism mitigates the same class | Fund includes constant-time pending Mine accrual in every redemption denominator snapshot.                                                    |
| A-11 | High     | Resolved in development by ADR 0029                           | Checkpoint-first signals prevent same-transaction capture; qualifying top-ups reset behind a Router threshold.                                |
| A-12 | Medium   | Resolved in development by ADR 0044                           | Mine ends after exact Router deposit; downstream routing failure cannot revert a completed paid handoff.                                      |
| BR-1 | Medium   | Accepted by ADR 0028                                          | A killed Strategy's Bribe remains a closed reward pool for incumbent signalers; final exit can permanently abandon rewards.                   |
| BR-2 | High     | Fixed locally by ADR 0035                                     | A per-token lifetime notification cap prevents a reset current balance from reopening cumulative-index overflow capacity.                     |
| BR-3 | High     | Fixed locally by ADR 0037                                     | A `1e36` Bribe index prevents economically material low-decimal reward carry from becoming Fund-bound on signal churn.                        |
| M-01 | Economic | Accepted by ADR 0033 and retained by ADR 0041                 | Fixed-tenure fairness allows aggregate issuance above the current global rate for as long as legacy tenures remain.                           |
| M-02 | Economic | Accepted by ADR 0024                                          | A miner receives the 80% handoff amount only if a successor pays a nonzero replacement price.                                                 |
| E-01 | High     | Resolved in development                                       | Fund rejects selected-token transfers that reduce another selected address's snapshotted backing.                                             |
| E-02 | High     | Mitigated; M-03 release gate remains                          | One-time bindings require reciprocal protocol identities; codehash, parameter, and manifest review remains external.                          |
| E-03 | Medium   | Resolved in development                                       | Resonance rejects non-transferable SignalGBX as a Strategy payment or Bribe reward token.                                                     |
| E-04 | Medium   | Resolved in development                                       | Exact-consumed allowances skip incompatible redundant zero-approval calls.                                                                    |
| E-05 | Low      | Resolved in development                                       | The subgraph records Bribe carry classified to Fund even when no whole-token liability accrues.                                               |
| M-03 | High     | Mitigated; open release gate                                  | Binding checks plus post-deployment Mine/Router verification mitigate crossed graphs; wrong dependencies remain unrecoverable after exposure. |
| M-04 | High     | Open independent-review gate                                  | The provisional halving period, fixed rates, multiplier, and minimum price have not been independently reviewed.                              |
| G-01 | High     | Token property retained; external-integration review required | Snapshot checkpoints survive sGBX withdrawal; consequences depend on the unselected external governance system.                               |
| G-02 | Medium   | Superseded by ADR 0034                                        | The removed ProtocolGovernor/Timelock had no public cancellation path after queueing.                                                         |
| G-03 | High     | Superseded locally; external-integration gate remains         | Local quorum liveness parameters were removed; exact external voting and delegation semantics remain unselected.                              |
| G-04 | Economic | Accepted candidate by ADR 0036; integration review required   | Resonance ownership can change the prospective automatic Bribe share globally between 0% and 20%.                                             |

No production-safety conclusion applies to the Mine redesign.

## G-01 through G-03 — SignalGBX checkpoints and external governance

ADR 0034 removed ProtocolGovernor and the protocol Timelock. SignalGBX deliberately retains non-transferable
ERC20Votes checkpoints, but the core assigns them no proposal threshold, quorum, voting period, execution delay,
cancellation rule, or proposal authority. Resonance remains owner-gated for `addStrategy`, `killStrategy`,
`addBribeReward`, and bounded global `setBribeBps`; its owner can also transfer or renounce ownership. Mine remains
ownerless.

SignalGBX snapshots still survive a signal withdrawal. An account may hold or borrow GBX through a checkpoint, signal
it, withdraw later, and retain historical voting weight. Whether an external governance system exposes a predictable
snapshot or makes that historical weight actionable depends on its exact implementation. The former local risks from
undelegated supply, percentage quorum, block-clock periods, and uncancellable Timelock operations are no longer claims
about the core; they must be re-evaluated against the selected external system.

Disposition: G-02 and the local-parameter form of G-03 are superseded by removal, not proven safe. G-01 remains an
ERC20Votes integration property demonstrated directly by SignalGBX tests. Production remains blocked until a later ADR
pins the external governance provider and release, deployed bytecode and upgrade model, voting and delegation
compatibility, permission and admin graph, proposal/batch/execution scope, delay and cancellation behavior, and the
exact ownership handoff that transfers Resonance and renounces the consumed SignalGBX and factory ownership shells.
That review must include who may schedule `setBribeBps`, its execution delay, cancellation path, and public monitoring
expectations.

## G-04 — bounded prospective automatic-Bribe share

ADR 0036 replaces ADR 0032's immutable 90/10 classification with one global Resonance setting. The owner may set the
automatic paired-Bribe share from 0 through 2,000 basis points inclusive; every BribeRouter uses the value captured
before the first payment-token interaction, and Fund receives the complement. There is no per-Strategy override.

Changing the setting cannot reprice an existing Fund or Bribe liability, active stream, queued reward, accrued claim,
or prior classification. Weighted numerator carry survives rate changes, including a 0% interval. At 0%, new Strategy
payments create no automatic Bribe liability, while independently funded rewards and signal, move, withdrawal, and
killed-Strategy exit remain available.

Disposition: accepted economic authority in the development candidate. The hard ceiling ensures Fund receives at
least 80% across cumulative rate-weighted classifications, but a compromised or poorly designed owner can change
incentives around pending auctions and can hold the rate at zero indefinitely. Production remains blocked until the selected external
governance executor's delay, proposal, batching, cancellation, monitoring, and ownership controls are reviewed against
this lever. Reopen if the range, scope, snapshot point, global-only rule, or prospective-only accounting changes.

## A-09 — reward carry across signal-supply boundaries

The prior Bribe implementation conserved sub-index reward carry but allowed it to survive a virtual-supply boundary.
A later signal could therefore receive part of a reward emitted before entry, and remaining signalers could receive
carry accumulated before another account exited.

ADR 0029 supersedes the Resonance remedy. Resonance now uses a Bribe-shaped `1e36` index without global or per-Strategy
carry: any allocation floored away remains USDG surplus in Resonance and cannot cross into a later denominator. ADR
0027 still applies the exact bounded policy to Bribe: pending carry moves to Fund before every supply change, and a
fully exiting account's sub-token remainder moves to Fund instead of returning to global carry.

Disposition: Resonance flooring is accepted by ADR 0029; Bribe carry remains resolved by ADR 0027. Reopen if rounded
Resonance value becomes capturable by a later signaler or Bribe carry can cross a supply boundary.

## E-01 through E-05 — EthSkills-guided review remediations

The 2026-08-13 internal EthSkills checklist review found four additional current-tree issues:

- Fund's address-only duplicate check did not detect two token facades sharing one backing ledger. Redemption now
  checks each selected address before its transfer and verifies after the basket that it retained at least its own
  snapshot less its payout. The dual-facade regression proves the GBX burn and all transfers roll back atomically.
- One-time setup accepted any code-bearing target. GBX, SignalGBX, both factories, and Resonance now require reciprocal
  Mine, Resonance, factory, router, and USDG identities before binding. SignalGBX signaling waits for that validation.
- Resonance could register non-transferable SignalGBX as Strategy payment, producing an unfillable append-only graph.
  The system token is now rejected as both Strategy payment and Bribe reward before it can consume an append-only slot.
- Strategy and ResonanceRouter unconditionally attempted `approve(spender, 0)` after the exact allowance had already
  been consumed. They now skip that redundant call when allowance is zero, with BNB-style token regressions.
- The Bribe carry-classification event initially had no subgraph handler, so sub-token Fund remainders were invisible
  to indexer consumers. The Bribe template now records the event as a `ProtocolEvent`, with Matchstick coverage.

Disposition: E-01, E-03, E-04, and E-05 are resolved in development. E-02 materially reduces accidental cross-wiring, but
cannot distinguish a malicious lookalike that returns the expected identities; M-03 therefore remains a High release
gate requiring exact runtime code hashes, constructor arguments, parameters, receipts, and a signed manifest.

## A-10 — accrued mining and redemption denominator

The discarded asynchronous distribution design could omit already-promised future issuance from current total supply.
ADR 0033 gives each occupied Mine slot continuous accrual and maintains total pending emission with a constant-time
aggregate accumulator. `Fund.redeem` reads `Mine.effectiveTotalSupply()` before capturing the common denominator, so
accrued unminted GBX is included without calling or mutating Mine.

Disposition: mitigated in the current development candidate. Reopen if Fund stops using effective supply, a second
issuer is introduced, cached pending accrual diverges from the per-slot sum, or redemption gains slot-dependent work.

## A-11 — atomic signal redirection into a stale cheap Strategy auction

The prior immediate allocator let an account add a dominant signal to a thin Strategy, route fresh Mine revenue under
that new weight, and fill the Strategy's already-decayed auction in one transaction. The new money could therefore be
bought at a price established while the Strategy held almost no inventory.

ADR 0029 places received USDG in one Bribe-shaped seven-day reward period. Signal mutations checkpoint elapsed revenue
before changing weights, and `Strategy.buy` checkpoints released revenue before reading inventory. No stream time elapses
between same-transaction operations, so the fill can acquire only inventory that predated the routed payment. The
deterministic regression test is `test_SameTransactionSignalAndPurchaseCannotCaptureNewlyNotifiedRevenue`.

The Router holds a nonzero balance below the active period's exact remaining reward. Once the complete balance
qualifies and a permissionless caller invokes `route()`, Resonance checkpoints and restarts seven days with the new
reward plus the old remainder. This deliberately permits qualifying reset/top-up behavior. ADR 0044 separately removes
Mine's synchronous route attempt, so downstream Router or Resonance failure cannot revert an already completed Mine
handoff; LiquidityPosition remains atomically coupled to its route attempt.
The regressions include `test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies`,
`test_TopUpBelowLeftRevertsAtomicallyAtResonance`, and
`test_QualifyingTopUpCheckpointsAndRestartsWithRewardPlusLeft`.

Disposition: resolved in the development candidate. Existing Strategy inventory can still be bought at its current
price, and a signal held over real elapsed time earns future flow. Reopen if notification becomes immediately
distributable, signal mutations stop checkpointing, or Strategy stops synchronizing before its inventory snapshot.

## A-12 — Mine handoff coupled to downstream revenue routing

Mine previously called `ResonanceRouter.route()` synchronously after exact-transferring the protocol share. A failure
inside the Router or Resonance could therefore revert an otherwise valid paid slot handoff, even though Mine's claim
accounting required only delivery into its immutable staging Router.

ADR 0044 makes that deposit Mine's terminal revenue action and renames the Mine event to `RevenueDeposited`.
`ResonanceRouter.route()` remains permissionless and separate. A transfer failure into the Router still reverts the
handoff; any later routing failure is isolated. LiquidityPosition deliberately retains its atomic route attempt.

Disposition: resolved in the development candidate and covered by current-tree regression and integration evidence.
The accepted residual risk is unbounded Router latency if no manual, frontend, volunteer-keeper, or cron caller acts.
No role or bounty guarantees routing, and a future optional frontend helper must not make Mine liveness depend on its
routing leg.

## BR-1 — closed Bribe reward pool after Strategy death

Killing a Strategy permanently rejects every new signal increase, including an increase by an existing signaler. It
does not remove existing signal weight or retire the paired Bribe. Incumbent signalers may remain for any duration,
continue earning independently notified Bribe rewards, claim, and reduce or fully remove their signal at any time.
The dead Strategy receives no future Resonance USDG; its whole-unit claim checkpointed at death remains payable to the
Strategy, while any floored fraction remains Resonance surplus.

The Bribe remains permissionlessly fundable after Strategy death. If its final signaler exits while an active stream
or queued rewards remain, the active stream pauses and the queue has no possible future entrant to restart it. Those
tokens remain accounted in Bribe but are permanently unclaimable and do not become a Fund liability. The abandoned
amount is not bounded to dust: it may include the complete unvested stream and every later notification made with zero
signal supply while that token still has lifetime headroom under ADR 0035.

Disposition: accepted protocol behavior in ADR 0028. Strategy death deliberately creates a closed reward pool for
incumbent signalers without adding a retirement state, refund, rescue, sweep, or Fund reclassification. Interfaces
must identify dead Strategies, warn the final signaler that an exit can abandon remaining rewards, and must not imply
that a direct reward notification to a dead zero-supply Bribe is recoverable. The deterministic regression
`test_KnownRisk_DeadStrategyBribeCanPauseAndQueueRewardsForever` remains evidence of the accepted terminal state.
Reopen if Strategy-death signaling rules, Bribe notification rules, or the protocol's no-recovery policy changes.

## BR-2 — lifetime cumulative-index overflow after rewards leave custody

Bribe's prior scale guard bounded only its current accounted reward balance. Claims and Fund payments reduced that
balance and reopened the guard, but they did not reduce the token's monotonic cumulative `rewardPerTokenStored` index.
A freely mintable or unusually high-decimal registered reward could therefore notify an enormous first stream at one
raw unit of signal supply, let the indexed reward leave Bribe custody, and notify again. A later checkpoint would add
another precision-scaled increment to an index already near `uint256` maximum and revert on overflow. Signal deposits,
moves, and withdrawals checkpoint every registered token, so the persistent bad schedule could lock signalers'
escrowed GBX. An ordinary Strategy kill would not have bypassed the paired Bribe checkpoint on withdrawal.

ADR 0035 adds a monotonic `lifetimeRewardNotified[token]` counter to every Bribe and rejects a notification before
checkpointing or token interaction when it would exceed:

```text
P = REWARD_PRECISION = 1e36
MAX_LIFETIME_REWARD_AMOUNT = floor((2^256 - 1) / P)
```

For lifetime notifications `N`, each admitted raw reward unit contributes at most `P` index units because one raw
signal unit is the smallest reachable nonzero denominator. Therefore `rewardPerTokenStored <= N * P <= 2^256 - 1`.
One raw signal unit attains the bound, so this is the largest history-independent cap safe across arbitrary claims,
Fund classifications and payments, stream restarts, zero-supply queues, and signal-supply changes. Claims, Strategy
death, and a return to zero supply do not reopen capacity; direct donations do not consume it because they are never
indexed.

Disposition: fixed locally by ADR 0035. Exact-limit, first-excess-unit, post-claim, two-cycle, zero-supply,
fee-on-transfer rollback, stateful-invariant, automatic BribeRouter, and canonical killed-Strategy exit regressions
cover the new bound. At exhaustion, existing claims, signal moves, and withdrawals remain available; only new
notifications for that token and Bribe are rejected. A failed automatic notification leaves its fixed BribeRouter
liability intact while the independent Fund leg remains settleable. The current-balance scale guard remains defense in
depth. No retirement withdrawal, rescue, or killed-Strategy escape hatch was added, so ADR 0028 remains unchanged.

The raw-unit limit can constrain unusually high-decimal assets. For a conventional 18-decimal asset it is
approximately `1.158e23` whole tokens and is not a credible honest-use ceiling. The cap does not make freeze,
blocklist, rebase, or other nonconventional token behavior supported.

## BR-3 — low-decimal multi-signaler reward resolution

Bribe previously used `REWARD_PRECISION = 1e18` while SignalGBX weights also use 18 decimals. With total Bribe signal supply `S`
and emitted raw reward amount `E`, the global reward index advances only when `E * REWARD_PRECISION >= S`. If `W`
whole sGBX is assigned to the Strategy, the minimum indexable carry is therefore `W` raw reward units. For a token with
`d` decimals, that boundary represents `W / 10^d` whole reward tokens.

At five million sGBX of multi-account signal, the index requires five million raw units: 5 whole tokens at 6 decimals,
0.05 token at 8 decimals, or `5e-12` token at 18 decimals. A sole signaler has a special exact-carry path and does not
experience this threshold. With two or more signalers, a completed below-threshold stream remains exactly accounted in
`pendingRewardScaled`, but no account can claim it and claims alone cannot advance the index. Later notifications can
eventually accumulate to the threshold. Before that happens, any signal deposit or withdrawal calls
`_fundAllPendingRewards` and irrevocably classifies the complete old-denominator carry to Fund.

The initial `SixDecimalBribeTest` campaign demonstrated the five-token boundary, accumulation across repeated streams,
sole-signaler and zero-supply behavior, mid-stream exit classification, and the exact quotient/remainder model over
10,000 fuzz cases. `SixDecimalAutomaticBribeIntegrationTest` reproduced the issue through the real Strategy,
BribeRouter, Bribe, Resonance, and SignalGBX graph: a 10 USDG acquisition at the default 10% share created a 1 USDG
reward that neither of two signalers could claim against five million sGBX, then became Fund-bound when a third
signaler entered. Three `SixDecimalBribeInvariantTest` properties each passed 1,000 runs of 500 random notifications,
time jumps, signal mutations, claims, and Fund payments with no revert or custody/accounting deficit.

Disposition: fixed locally by ADR 0037. Bribe now uses `REWARD_PRECISION = 1e36`, and its coupled lifetime cap is
`floor(type(uint256).max / 1e36)`. Against five million sGBX, the same 1 USDG full-graph reward pays exactly 0.6 USDG
and 0.4 USDG to the two signalers; a later signal entry creates no Fund liability. A single indivisible raw reward unit
is globally indexed into account-specific 0.6/0.4 raw-unit precision rather than remaining global carry. Those
fractions can combine with later rewards and become Fund precision only if the account fully exits. The deterministic,
full-graph, fuzz, invariant, overflow, model, and mutation campaigns retain this as a release-critical regression.

## M-01 — fixed-tenure fairness raises transitional aggregate issuance

An incumbent keeps the `tps` recorded when it entered. All sixteen slots are permanent, and only a new or replaced
tenure receives the current global rate divided by sixteen. Under ADR 0041 that prospective rate changes at fixed
elapsed-time boundaries measured from the Mine deployment timestamp; cumulative mined and pending emission do not
select it.

This prevents governance or another user from changing the economic deal after a miner paid. It also means aggregate
issuance can exceed the current undivided global rate indefinitely if old tenures do not turn over.

Disposition: accepted economic behavior in ADR 0033 and retained by ADR 0041. Tests and both independent models
assert that incumbents retain their exact rate. A handoff immediately before a boundary can therefore lock the older
rate for that complete tenure. Reopen if rate assignment or turnover assumptions change.

## M-02 — rollover risk and zero-price replacement

The 80% payment is not guaranteed. It exists only when a later participant replaces a nonempty slot at a nonzero
price. After an hour the quoted price is zero, and another account can replace the miner without funding a handoff
claim. The incumbent still keeps all GBX accrued through the replacement checkpoint.

Disposition: accepted mining-market behavior. User interfaces must not present the successor payment as principal,
yield, or a guaranteed refund.

## M-03 — irreversible mining authority and immutable dependencies

GBX permits its temporary minter to call `setMinter` exactly once. Reciprocal identity checks reject a Mine for a
different GBX, a Resonance for a different SignalGBX or factory pair, and a Router bound to a different Resonance or
USDG. Under ADR 0045, Mine itself no longer reads `Router.usdg()` during construction; pinned post-deployment evidence
must prove `Mine.usdg() == USDG`, the exact Router address, and `Router.usdg() == USDG` before GBX binding or market
exposure. A malicious lookalike, wrong owner, parameter set, runtime, or target-chain dependency still cannot be
repaired because the protocol intentionally has no upgrade, successor, or migration authority.

Disposition: open High release gate. A signed manifest must prove constructor arguments, runtime code, pinned
post-deployment Mine/Router token equality, permanent minter identity, all dependencies, the exact external governance
executor, and removal of the temporary Resonance owner before any user funds are accepted. A mismatched Mine candidate
must be abandoned before the irreversible GBX handoff or any public exposure.

## M-04 — fixed Mine economics require independent review

ADR 0038 selects and hard-codes a 2× USDG price reset and 1 USDG floor. ADR 0041 replaces its cumulative-mining
threshold with a period anchored to immutable Mine `startTime`, ADR 0042 selects a 64 GBX-per-second initial global
rate and `69 days` between prospective halvings, and ADR 0043 selects a 1 GBX-per-second global tail. Independent
TypeScript and Python models pin the current time-based formula, but selection and deterministic modelling do not
establish that the schedule is economically safe or usable. The 771,161,600 GBX day-414 gross-supply figure and
approximately 4.089% initial annual tail ratio are synchronized, fully occupied, fully refreshed, fully
settled, no-burn references only; the ratio declines as supply grows, and legacy tenures can keep aggregate issuance
above that path.

Disposition: open High independent-review gate. Review scenarios for demand collapse, persistent high-rate incumbents,
the fact that empty time and deployment-to-launch delay consume the schedule, boundary-timed handoffs, tail dilution,
MEV, and thin GBX liquidity before approving any deployment.

## Evidence status

The following older results are retained as historical engineering evidence and must not be represented as
current-tree governance or release evidence:

- The recorded default Foundry campaign passed 335 tests. Its stateful suite passed 27 properties at 1,000 runs of 500
  calls (13.5 million aggregate calls), with all 31 selectors reached about 16,000 times and zero handler reverts or
  discards. The integration profile passed 17 tests, including 256 randomized action sequences and real Uniswap v4
  fee harvesting.
- Hardhat parity, SDK, subgraph, independent TypeScript/Python simulations, frontend, formatting, lint, typecheck,
  documentation, and workspace builds passed at that recorded baseline.
- Pinned Slither 0.11.5, Aderyn 0.6.8, Semgrep 1.162.0, Gitleaks 8.30.1, compiler/size, dependency, and license gates
  passed. The exact register accepted 177 then-current-source findings across 28 reviewed detector classes; Semgrep
  and Gitleaks raw reports contained zero findings.
- Native Medusa 1.5.1 completed 101,602 calls with zero failures across 65 surfaces. Pinned Echidna 2.3.2 completed
  100,213 calls with all 25 properties passing. The recorded 43-mutant focused campaign killed every mutant.
- Mythril 0.24.8 was incompatible with constructor-resolved immutable/Cancun runtimes and was not a proof.
- The immediately preceding ADR 0042 tree passed 356/356 Forge tests, 19/19 integration tests, and its wider workspace
  gates. Those results remain historical even though the current tree independently produced the same Forge totals.
- On 2026-08-22, the current uncommitted ADR 0044 tree passed 356/356 default-profile Forge tests across 25 suites,
  19/19 integration tests across 2 suites, Hardhat 4/4, SDK 50/50, TypeScript simulations 39/39, Python
  environment-policy checks 5/5 and simulations 25/25, subgraph specification checks 4/4 plus Matchstick 10/10 and
  build, web unit tests 3/3, Playwright 6/6, and the ABI, documentation, formatting, lint, typecheck, and workspace-build
  gates. This is unpinned local deterministic engineering evidence, not release evidence.
- The recorded 49/49 mutation result also predates ADR 0044's Mine changes and is historical rather than current Mine
  evidence.
- Current-tree native external-fuzzer and static-analyzer reruns, independent audit, a second external-fuzzer seed,
  legal clearance, reviewed production parameters, exact external-governance integration review, monitored testnet
  rehearsal, and a signed deployment manifest remain open.
