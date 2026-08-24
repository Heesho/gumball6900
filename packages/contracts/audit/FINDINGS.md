# Internal security finding register

Date: 2026-08-16. Governance, Bribe-cap, payment-share, Bribe-precision, Mine-halving, Mine-routing, Mine dependency,
reward/settlement, canonical-transfer, and zero-premint dispositions reconciled 2026-08-24 through ADR 0050.

Status: ADRs 0031 and 0033-0050 form the current development candidate. On 2026-08-24, the current uncommitted tree
passed 293/293 default-profile Foundry tests, all 27 stateful invariant entries at 1,000 runs of depth 500 with zero
handler reverts, 10/10 integration tests, and 4/4 Hardhat tests including Foundry/Hardhat bytecode parity. Contract
lint, ordering, formatting, build, size, generated-documentation, and SDK ABI checks also passed. These are local
engineering results, not a pinned review artifact or audit. The focused ADR-0048 migration and mutation results below
remain useful historical evidence but predate ADRs 0049 and 0050. Native external-fuzzer and static-analyzer records
also remain older historical evidence, and a complete current-tree workspace matrix has not been rerun. The candidate
has no pinned review commit and has not received an independent audit, compatible symbolic analysis,
external-governance integration review, or release review required for deployment. The older campaign-specific ledger
in `SIGNAL-RESONANCE-FINDINGS.md` is explicitly a pre-ADR-0047 historical record.

## Current dispositions

| ID   | Severity | Status                                                        | Summary                                                                                                                                                                                       |
| ---- | -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-02 | High     | Accepted by ADR 0029 and simplified by ADR 0047               | Resonance retains rate/index/account floors, zero-signal emission, and direct-donation USDG as unallocated surplus.                                                                           |
| A-03 | High     | Superseded by ADR 0047                                        | Exact carry, queue/pause, and selected batches were removed; Bribe uses Synthetix floors plus all-token and scalar claims.                                                                    |
| A-04 | High     | Superseded by ADR 0047                                        | The former deferred Fund-liability mechanism was removed; each Strategy purchase now transfers its Fund share directly and atomically.                                                        |
| A-06 | Medium   | Superseded by ADR 0050                                        | The dedicated LiquidityPosition and its fee-harvest path were removed.                                                                                                                        |
| A-08 | Medium   | Liveness resolved; bound raised by ADR 0048                   | Bribe work remains capped at sixteen reward tokens; the higher fixed maximum increases worst-case gas without making loops unbounded.                                                         |
| A-09 | Medium   | Former remedy superseded; flooring accepted by ADR 0047       | Resonance and Bribe use ordinary index/account floors; rounded value remains surplus and is not carried across later weights.                                                                 |
| A-10 | High     | Superseded design; current mechanism mitigates the same class | Fund includes constant-time pending Mine accrual in every redemption denominator snapshot.                                                                                                    |
| A-11 | High     | ADR 0029 retained; schedule simplified by ADR 0047            | Checkpoint-first signals prevent same-transaction capture; qualifying top-ups reset behind a Router threshold.                                                                                |
| A-12 | Medium   | Resolved in development by ADR 0044                           | Mine ends after a successful nominal SafeERC20 transfer request to the Router under the supported standard-USDG model; downstream routing failure cannot revert a completed paid replacement. |
| BR-1 | Medium   | Accepted by ADR 0028; terminal mechanics simplified by 0047   | A killed Strategy's Bribe is closed to new signal but remains fundable; streams continue through zero supply and can leave permanently unclaimable surplus.                                   |
| BR-2 | High     | Fixed by ADR 0035 and retained by ADR 0047                    | A per-token lifetime notification cap prevents a reset current balance from reopening cumulative-index overflow capacity.                                                                     |
| BR-3 | High     | Fixed locally by ADR 0037 and simplified by ADR 0047          | A `1e36` Bribe index keeps low-decimal rewards useful; ordinary floors remain surplus rather than Fund carry.                                                                                 |
| M-01 | Economic | Accepted by ADR 0033 and retained by ADR 0041                 | Fixed-tenure fairness allows aggregate issuance above the current global rate for as long as legacy tenures remain.                                                                           |
| M-02 | Economic | Accepted by ADR 0024                                          | An outgoing tenure miner receives an 80% claim only when the replacement has a nonzero price; the same miner may begin the next tenure.                                                       |
| E-01 | High     | Resolved in development                                       | Fund rejects selected-token transfers that reduce another selected address's snapshotted backing.                                                                                             |
| E-02 | High     | Mitigated; M-03 release gate remains                          | One-time bindings require reciprocal protocol identities; codehash, parameter, and manifest review remains external.                                                                          |
| E-03 | Medium   | Resolved in development                                       | Resonance rejects non-transferable SignalGBX as a Strategy payment or Bribe reward token.                                                                                                     |
| E-04 | Medium   | Superseded by ADR 0047                                        | The former exact-consumed allowance cleanup was replaced by direct Strategy transfers and complete-balance Router notifications.                                                              |
| E-05 | Low      | Superseded by ADR 0047                                        | The former Bribe-carry event/indexing requirement disappeared with carry classification and Fund reward liabilities.                                                                          |
| M-03 | High     | Mitigated; open release gate                                  | Binding checks plus post-deployment Mine/Router verification mitigate crossed graphs; wrong dependencies remain unrecoverable after exposure.                                                 |
| M-04 | High     | Open independent-review gate                                  | The provisional halving period, fixed rates, multiplier, and minimum price have not been independently reviewed.                                                                              |
| G-01 | High     | Token property retained; external-integration review required | Snapshot checkpoints survive sGBX withdrawal; consequences depend on the unselected external governance system.                                                                               |
| G-02 | Medium   | Superseded by ADR 0034                                        | The removed ProtocolGovernor/Timelock had no public cancellation path after queueing.                                                                                                         |
| G-03 | High     | Superseded locally; external-integration gate remains         | Local quorum liveness parameters were removed; exact external voting and delegation semantics remain unselected.                                                                              |
| G-04 | Economic | ADR 0036 retained; settlement simplified by ADR 0047          | Resonance ownership can change the prospective automatic Bribe share globally between 0% and 20%.                                                                                             |

No production-safety conclusion applies to the Mine redesign.

## G-01 through G-03 — SignalGBX checkpoints and external governance

ADR 0034 removed ProtocolGovernor and the protocol Timelock. SignalGBX deliberately retains non-transferable
ERC20Votes checkpoints, but the core assigns them no proposal threshold, quorum, voting period, execution delay,
cancellation rule, or proposal authority. Resonance remains owner-gated for `addStrategy`, `killStrategy`,
`addBribeRewardToken`, and bounded global `setBribeBps`; its owner can also transfer or renounce ownership. Mine remains
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

ADR 0036 replaces ADR 0032's immutable 90/10 classification with one global Resonance setting. ADR 0047 keeps that
bounded authority but restores settlement to Strategy. Before payment-token interaction, each purchase snapshots the
rate from 0 through 2,000 basis points, computes `floor(payment * rate / 10_000)`, sends that Bribe share to its paired
BribeRouter, and sends the complement directly to Fund. There is no per-Strategy override, cumulative split carry, or
deferred settlement liability.

Changing the setting cannot reprice an earlier purchase, Fund balance, buffered Router balance, active stream, or
accrued claim. At 0%, a new Strategy payment goes completely to Fund, while independently funded rewards and signal,
move, withdrawal, and killed-Strategy exit remain available. Each purchase floors independently, so splitting one
economic amount across purchases can change cumulative classification by raw-token dust.

Disposition: accepted economic authority and rounding consequence in the development candidate. The hard ceiling
ensures Fund receives at least 80% of each individual nonzero payment, but a compromised or poorly designed owner can
change incentives around pending auctions and can hold the rate at zero indefinitely. Production remains blocked until
the selected external governance executor's delay, proposal, batching, cancellation, monitoring, and ownership controls
are reviewed against this lever. Reopen if the range, scope, pre-token-interaction snapshot point, global-only rule, or
per-purchase classification changes.

## A-09 — reward floors across signal-supply boundaries

Historical finding: an earlier Bribe implementation conserved sub-index reward carry across virtual-supply changes.
A later signaler could therefore receive value emitted before entry, or a remaining signaler could inherit carry
created before another account exited. ADR 0027 introduced explicit Fund classification for those remainders.

ADR 0047 supersedes both the vulnerable carry path and ADR 0027's remedy. Resonance and Bribe now checkpoint the prior
weights and use ordinary Synthetix-style integer floors without global, account, Strategy, or Fund carry buckets.
Value floored out at a rate, index, Strategy, or account boundary stays as unallocated balance in that reward contract;
it is not accumulated into a later denominator. Full account exit does not create a Fund reward liability.

Disposition: the old carry issue and its Fund-classification machinery are superseded. Ordinary floor surplus is an
accepted ADR-0047 consequence, with entry, exit, and full-exit tests proving that later weights do not inherit the
rounded pre-change value. Reopen if an explicit carry bucket is restored or a later signaler can claim pre-entry
emission.

## E-01 through E-05 — EthSkills-guided review history

The 2026-08-13 internal EthSkills checklist review found five issues in the then-current tree. The first three remain
relevant to unchanged boundaries; the last two describe mechanics later removed or simplified by ADR 0047:

- Fund's address-only duplicate check did not detect two token facades sharing one backing ledger. Redemption now
  checks each selected address before its transfer and verifies after the basket that it retained at least its own
  snapshot less its payout. The dual-facade regression proves the GBX burn and all transfers roll back atomically.
- One-time setup accepted any code-bearing target. GBX, SignalGBX, both factories, and Resonance now require reciprocal
  Mine, Resonance, factory, router, and USDG identities before binding. SignalGBX signaling waits for that validation.
- Resonance could register non-transferable SignalGBX as Strategy payment, producing an unfillable append-only graph.
  The system token is now rejected as both Strategy payment and Bribe reward before it can consume an append-only slot.
- Historical E-04: the former settlement graph cleaned up exact-consumed allowances. ADR 0047 removed Strategy's
  approval-based settlement; current Routers use `forceApprove` only to authorize the complete qualifying balance
  immediately consumed by the paired reward contract under the standard-token assumption.
- Historical E-05: the former Bribe carry-classification event initially lacked a subgraph handler. ADR 0047 removed
  carry classification, Fund reward liabilities, and that event, so no current indexing requirement survives.

Disposition: E-01 and E-03 remain resolved in development. E-02 materially reduces accidental cross-wiring, but cannot
distinguish a malicious lookalike that returns the expected identities; M-03 therefore remains a High release gate
requiring exact runtime code hashes, constructor arguments, parameters, receipts, and a signed manifest. E-04's old
allowance cleanup and E-05's carry-event indexing remedy are explicitly superseded history, not current controls.

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

ADR 0029 places received USDG in one seven-day revenue period. Signal mutations checkpoint elapsed revenue before
changing weights, and `Strategy.buy` checkpoints released revenue before reading inventory. No stream time elapses
between same-transaction operations, so the fill can acquire only inventory that predates that transaction's routed
payment. Deterministic mid-stream entry and exit regressions independently pin checkpoint ordering.

ADR 0047 simplifies the raw stream to the ordinary Synthetix rule. Resonance's `remainingRevenue()` is
`remainingSeconds * revenueRate`; a qualifying notification combines that amount with the incoming revenue, divides by
seven days with ordinary flooring, and restarts. ResonanceRouter holds a balance below
`max(REWARD_DURATION, remainingRevenue())` and routes
its complete qualifying balance only when called. ADR 0044 separately removes Mine's synchronous route attempt, so
downstream Router or Resonance failure cannot revert an already completed Mine replacement. Current regressions include
`test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies`,
`test_RouterBuffersUntilItsBalanceReachesTheActiveAmountLeft`, and
`test_QualifyingTopUpCheckpointsAndRestartsWithRewardPlusLeft`.

Disposition: resolved in the development candidate. Existing Strategy inventory can still be bought at its current
price, and a signal held over real elapsed time earns future flow. Reopen if notification becomes immediately
distributable, signal mutations stop checkpointing, or Strategy stops synchronizing before its inventory snapshot.

## A-12 — Mine replacement coupled to downstream revenue routing

Mine previously called `ResonanceRouter.route()` synchronously after requesting the nominal protocol-share transfer. A failure
inside the Router or Resonance could therefore revert an otherwise valid paid slot replacement, even though Mine's claim
accounting required only delivery into its immutable staging Router.

ADR 0044 makes that deposit Mine's terminal revenue action and renames the Mine event to `RevenueDeposited`.
`ResonanceRouter.route()` remains permissionless and separate. A transfer failure into the Router still reverts the
replacement; any later routing failure is isolated. ADR 0050 removes the former LiquidityPosition path entirely.

Disposition: resolved in the development candidate and covered by current-tree regression and integration evidence.
The accepted residual risk is unbounded Router latency if no manual, frontend, volunteer-keeper, or cron caller acts.
No role or bounty guarantees routing, and a future optional frontend helper must not make Mine liveness depend on its
routing leg.

## BR-1 — Bribe pool closed to new signal after Strategy death

Killing a Strategy permanently rejects every new signal increase, including an increase by an existing signaler. It
does not remove existing signal weight or retire the paired Bribe. Incumbent signalers may remain for any duration,
continue earning independently notified Bribe rewards, claim, and reduce or fully remove their signal at any time.
The killed Strategy receives no future Resonance USDG; its whole-unit claim checkpointed at death remains payable to the
Strategy, while any floored fraction remains Resonance surplus.

The Bribe remains permissionlessly fundable after Strategy death. Under ADR 0047 there is no pause or queue: if its
final signaler exits during an active stream, time continues at zero supply and later elapsed rewards remain
unallocated Bribe surplus. A later notification can restart the ordinary Synthetix schedule but cannot make the
zero-supply interval claimable. Notifications made while the Bribe is closed to new signal and has zero supply consume
lifetime headroom and can likewise become completely unclaimable.

Disposition: accepted protocol behavior in ADR 0028, with the former queue-created terminal state explicitly
superseded by ADR 0047's continuously advancing stream. Strategy death still creates a pool closed to new signal
without a retirement state, refund, rescue, sweep, or Fund reclassification. Interfaces must identify killed
Strategies, warn the final signaler that an exit can abandon scheduled rewards, and must not imply that a direct
reward notification to a killed zero-supply Bribe is recoverable.
`test_KilledStrategySignalCanExitAndCannotEarnAfterExit` covers the current terminal mechanics. Reopen if
Strategy-death signaling rules, Bribe notification rules, or the no-recovery policy changes.

## BR-2 — lifetime cumulative-index overflow after rewards leave custody

Bribe's prior scale guard bounded only its current accounted reward balance. Claims and Fund payments reduced that
balance and reopened the guard, but they did not reduce the token's monotonic cumulative `rewardPerSignalStored` index.
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
signal unit is the smallest reachable nonzero denominator. Therefore `rewardPerSignalStored <= N * P <= 2^256 - 1`.
One raw signal unit attains the bound, so this is the largest history-independent cap safe across arbitrary claims,
ordinary stream restarts, zero-supply time, and signal-supply changes. Claims, Strategy death, and a return to zero
supply do not reopen capacity; direct donations do not consume it because they are never scheduled or indexed.

Disposition: fixed locally by ADR 0035 and retained by ADR 0047. The current implementation checks lifetime headroom
before reward checkpointing or token transfer, then applies the duration and active-left notification gates. Exact-limit,
first-excess-unit, two-cycle, stateful schedule/cap, automatic BribeRouter, and canonical killed-Strategy exit
regressions cover the bound. At exhaustion, existing claims, signal moves, and withdrawals remain available; only new
notifications for that token and Bribe are rejected. A failed automatic notification leaves the tokens buffered in the
Bribe-only Router; Fund already received its per-purchase complement directly from Strategy. There is no current-balance
scale guard, Fund reward liability, queue, or token-delta compatibility layer. No retirement withdrawal, rescue, or
killed-Strategy escape hatch was added, so ADR 0028's closed-pool ownership consequence remains.

The raw-unit limit can constrain unusually high-decimal assets. For a conventional 18-decimal asset it is
approximately `1.158e23` whole tokens and is not a credible honest-use ceiling. The cap does not make freeze,
blocklist, rebase, or other nonconventional token behavior supported.

## BR-3 — low-decimal multi-signaler reward resolution

Historical finding: Bribe once used `REWARD_PRECISION = 1e18` while SignalGBX weights also used 18 decimals. With total
signal `S` and emitted raw reward `E`, the index advanced only when `E * REWARD_PRECISION >= S`; at five million sGBX,
this created a five-token threshold for a six-decimal reward. Later exact-carry machinery preserved the value and
classified old-denominator remainders to Fund, but materially enlarged the state machine.

ADR 0037 raised the index to `1e36`. ADR 0047 then superseded the exact-carry and Fund-classification implementation
while retaining that precision and its coupled lifetime cap. Current Bribe scheduling first floors
`notified / REWARD_DURATION`; index and account divisions then floor independently. Against five million sGBX, a one-token
six-decimal notification schedules 604,800 raw units and distributes the scheduled units proportionally; the 395,200
raw rate remainder stays in Bribe as unallocated surplus. There is no sole-signaler special path, pending scaled carry,
or Fund precision bucket.

Disposition: fixed locally by the retained `1e36` index, with ADR 0047 accepting ordinary surplus floors. Current
six-decimal deterministic and fuzz tests cover useful low-decimal distribution, proportional divisible streams,
checkpointing across signal entry, and the rule that payouts never exceed scheduled emission. The focused ADR-0048
campaign killed 47/47 targeted mutants, including the sixteen-token cap regression; that mutation result predates
ADRs 0049 and 0050. The current post-ADR-0050 matrix passed all 27 stateful invariant entries. Reopen if
index precision decreases, the lifetime cap decouples from that precision, or rounded value becomes reallocatable to
later weights.

## M-01 — fixed-tenure fairness raises transitional aggregate issuance

An occupied tenure keeps the `tps` recorded when it began. All sixteen slots are permanent, and only a new or replaced
tenure receives the current global rate divided by sixteen. Under ADR 0041 that prospective rate changes at fixed
elapsed-time boundaries measured from the Mine deployment timestamp; cumulative mined and pending emission do not
select it.

This prevents governance or another user from changing the economic deal after a miner paid. It also means aggregate
issuance can exceed the current undivided global rate indefinitely if old tenures do not turn over.

Disposition: accepted economic behavior in ADR 0033 and retained by ADR 0041. Tests and both independent models
assert that occupied tenures retain their exact rate. A replacement immediately before a boundary can therefore lock the older
rate for that complete tenure. Reopen if rate assignment or turnover assumptions change.

## M-02 — rollover risk and zero-price replacement

The 80% claim is not guaranteed. It exists only when a later replacement settles a nonempty tenure at a nonzero price.
After an hour the quoted price is zero, so a new tenure, including a self-replacement, can begin without funding an
outgoing-tenure claim. The outgoing tenure miner still keeps all GBX accrued through the settlement checkpoint.

Disposition: accepted mining-market behavior. User interfaces must not present the outgoing tenure's replacement
share as principal, yield, or a guaranteed refund.

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
establish that the schedule is economically safe or usable. The 751,161,600 GBX day-414 gross-supply figure and
approximately 4.198% initial annual tail ratio are synchronized, fully occupied, fully refreshed, fully
settled, no-burn references only; the ratio declines as supply grows, and legacy tenures can keep aggregate issuance
above that path.

Disposition: open High independent-review gate. Review scenarios for demand collapse, persistent high-rate incumbents,
the fact that empty time and deployment-to-launch delay consume the schedule, boundary-timed replacements, tail dilution,
MEV, and thin GBX liquidity before approving any deployment.

## Evidence status

Current post-ADR-0050 contract evidence, verified locally on 2026-08-24, is:

- 293/293 default-profile Foundry tests;
- all 27 stateful invariant entries at 1,000 runs of depth 500, or 500,000 calls per entry, with zero handler reverts;
- 10/10 integration-profile tests;
- 4/4 Hardhat tests, including runtime-bytecode parity with Foundry; and
- contract lint, source-order, `forge fmt --check`, `forge build --sizes`, contract-reference generation/check, and SDK
  ABI checks.

The complete wider workspace matrix, current-tree native external fuzzers, static analyzers, and mutation campaign have
not been rerun. The results above are uncommitted local engineering evidence and do not establish audit, deployment,
or release readiness.

Historical focused ADR-0048 development evidence is:

- 104/104 focused tests passing across the affected Bribe, SignalGBX, Resonance, gas, and architecture surfaces;
- 47/47 mutants killed in the revised focused campaign, including cap regression and restored/omitted move-hook
  mutations;
- a permanently capped sixteen-token registry and absent `Resonance.moveSignalFor` runtime selector;
- atomic source-removal/destination-addition composition, destination-failure rollback, and checkpoint ordering; and
- measured maximum-bound gas of 491,494 for signal addition, 1,129,059 for withdrawal, 93,018 for one scalar claim,
  1,488,760 for sixteen sequential scalar claims, 1,471,439 for the all-token claim, 139,502 for Strategy purchase,
  1,890,938 for a composed move with sixteen active streams on both Bribes, 50,810 to add token sixteen, and 5,349 to
  reject token seventeen.

The following complete development matrix passed against the immediately preceding ADR-0047 tree but predates ADR
0048 and is historical for the changed cap and move surfaces:

- Foundry 312/312 across 23 suites, plus all 29 stateful invariant entries at 1,000 runs of depth 500 with zero handler
  reverts;
- the integration profile 21/21;
- Hardhat 4/4 and SDK 47/47;
- TypeScript simulations 36/36, Python environment checks 5/5, and Python simulations 22/22;
- Matchstick 9/9, web unit tests 3/3, and Playwright end-to-end tests 6/6;
- 46/46 mutants killed in the updated Signal/Resonance/Strategy/Bribe focused campaign; and
- workspace build, typecheck, lint, documentation, ABI, subgraph-build, and generated-artifact checks passing.

`forge fmt --check` and Prettier over the ADR-0047 changed files passed. The repository-wide format gate remained open
because 11 unchanged baseline landing/lockfile files failed Prettier. These local results are not a pinned review
artifact and do not establish audit, deployment, or release readiness. The following still older results are retained
as historical engineering evidence and must not be represented as current-tree governance or release evidence:

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
  gates. Those results remain historical.
- On 2026-08-22, the current uncommitted ADR 0044 tree passed 356/356 default-profile Forge tests across 25 suites,
  19/19 integration tests across 2 suites, Hardhat 4/4, SDK 50/50, TypeScript simulations 39/39, Python
  environment-policy checks 5/5 and simulations 25/25, subgraph specification checks 4/4 plus Matchstick 10/10 and
  build, web unit tests 3/3, Playwright 6/6, and the ABI, documentation, formatting, lint, typecheck, and workspace-build
  gates. This is unpinned local deterministic engineering evidence, not release evidence.
- The recorded 49/49 mutation result predates ADR 0044's Mine changes and ADR 0047's reward/settlement rewrite. The
  later 46/46 campaign covered ADR 0047 but now predates ADR 0048. The current focused result is the separate 47/47
  campaign above.
- Current-tree native external-fuzzer and static-analyzer reruns, independent audit, a second external-fuzzer seed,
  legal clearance, reviewed production parameters, exact external-governance integration review, monitored testnet
  rehearsal, and a signed deployment manifest remain open.
