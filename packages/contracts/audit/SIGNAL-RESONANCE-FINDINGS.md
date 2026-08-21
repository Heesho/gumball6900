# Signal and Resonance findings

Entries SR-001 through SR-007 reflect the local tree on 2026-08-16. SR-008 and SR-009 were added on 2026-08-19;
SR-010 and the SR-002 settlement disposition were reconciled for ADRs 0036 and 0037 on 2026-08-21. “Fixed” means locally patched and
regression-tested, not independently verified or deployed.

## SR-001

ID: SR-001
Title: Idle sGBX and duplicate signal ledgers violated mandatory signaling
Severity: High
Status: Fixed locally; original fixed-share remedy superseded by ADR 0036
Category: Custody and accounting
Affected contracts: SignalGBX, Resonance
Violated invariant: Every minted sGBX unit must be assigned to exactly one Strategy; aggregate and paired-Bribe ledgers must reconcile.
Attacker prerequisites: GBX approval and any live Strategy.
Impact: The superseded API admitted voting receipts without revenue allocation and required independently mutable duplicate balances.
Minimal trace: Stake GBX without signaling, retain idle votes, then allocate or withdraw through separate transitions.
Root cause: Historical standalone stake/unstake and allocation APIs.
Regression test: `ArchitectureReconciliationRegressionTest.test_RemovedIdleReceiptSelectorsAreAbsentFromRuntime` and `test_SignalAtomicallyCustodiesMintsVotesAndMirrorsThePairedBribe`.
Patch: Replaced the surface with atomic signal, permit-signal, move, and withdrawal; removed the duplicate interface and aggregate allocation ledger.
Residual risk: Direct GBX donations remain non-withdrawable surplus by design.

## SR-002

ID: SR-002
Title: Strategy payments used the superseded 100%-Fund classification
Severity: High
Status: Fixed locally
Category: Economic routing
Affected contracts: BribeRouter, Strategy
Violated invariant: Every acquired-asset payment must receive the uniform snapshotted global classification, with
cumulative weighted numerator carry preserved across both partitions and rate changes.
Attacker prerequisites: Ability to fill a Strategy auction, including many one-unit fills.
Impact: Signalers received no automatic acquired-asset reward; naive per-payment flooring would also permit Bribe starvation.
Minimal trace: At the default 10% rate, route ten one-unit payments; the required cumulative state is Fund 9, Bribe 1,
remainder 0. Then set 0%, 5%, or 20% and compare against `floor(sum(payment * rate) / 10_000)`.
Root cause: ADR 0021's superseded single Fund liability and no cumulative split carry.
Regression tests: `BribeRouterTest.test_TenOneUnitPaymentsDoNotStarveTheBribe`,
`BribeBpsTransitionTest.test_WeightedSplitRemainderSurvivesTenZeroFiveAndTwentyPercentTransitions`, and
`testFuzz_ArbitraryRateTransitionsMatchTheWeightedNumeratorModel`.
Patch: Added separately settled Fund and Bribe liabilities, a cumulative weighted split remainder, and ADR 0036's
owner-set global prospective rate with a default of 1,000 and inclusive maximum of 2,000 basis points.
Residual risk: A hostile acquired asset can delay its own settlement leg, but cannot redirect it or block the other
leg. The Resonance owner can change future economic attribution within the bounded range; external-governance review
must cover that authority.

## SR-003

ID: SR-003
Title: Nightly Foundry fuzzer smoke silently ran zero tests
Severity: Low
Status: Fixed locally
Category: Test infrastructure
Affected contracts: None; `audit/run-nightly.sh`
Violated invariant: External-fuzzer wiring must execute the shared state machine before claiming smoke success.
Attacker prerequisites: None.
Impact: The nightly preflight could print “No tests found” and exit zero, weakening evidence quality.
Minimal trace: `FOUNDRY_TEST=audit/harness forge test --match-contract ProtocolStateMachineCampaignTest`.
Root cause: The named test contract no longer existed after the campaign moved to the integration wrapper.
Regression test: `audit/check-fuzzer-wiring.test.mjs` now requires the integration profile and rejects the stale target.
Patch: Run `FOUNDRY_PROFILE=integration forge test --match-contract CampaignHarnessTest`; verified 6/6.
Residual risk: Current native Echidna and Medusa campaigns pass, but a second external seed and digest-pinned Docker
execution were not run.

## SR-004

ID: SR-004
Title: Transitive nanoid version triggered a current high-severity advisory
Severity: High
Status: Fixed locally
Category: Dependency hygiene
Affected contracts: None; web build tool dependency graph
Violated invariant: The dependency gate permits no current high/critical advisory.
Attacker prerequisites: A caller-controlled zero size reaching the affected custom generator.
Impact: Potential process denial of service in the transitive package.
Minimal trace: `pnpm audit --json` reported GHSA-2v37-7h3g-55p8 for nanoid 3.3.17.
Root cause: The postcss-specific override pinned the version immediately before the fixed 3.x release.
Regression test: `pnpm audit --audit-level high`.
Patch: Pinned that dependency edge to 3.3.18 and regenerated the lockfile.
Residual risk: Three low and one moderate advisory remain in Hardhat/tooling transitive dependencies.

## SR-005

ID: SR-005
Title: Slither flags BribeRouter exact-delta reads around a callback-capable token
Severity: Informational
Status: Dispositioned; no production change
Category: Reentrancy
Affected contracts: BribeRouter
Violated invariant: A callback must not consume the same liability twice or corrupt exact transfer accounting.
Attacker prerequisites: Governance registered a callback-capable acquired asset and its transfer attempts reentry.
Impact: Slither labels two stale-balance paths High; successful exploitation could otherwise double notify or corrupt a liability.
Minimal trace: Notify the Bribe leg and reenter `notifyBribeReward` from the token transfer.
Root cause: Static analysis does not model the Router's active `nonReentrant` guard and transaction rollback.
Regression test: `BribeRouterTest.test_BribeNotificationRejectsReentrancyAndStillVerifiesExactDeltas`.
Patch: Added the adversarial callback regression; the nested call receives `ReentrancyGuardReentrantCall`, while the outer exact transfer settles once.
Residual risk: Nonconventional balance behavior can deny that token's own settlement and remains unsupported.

## SR-006

ID: SR-006
Title: Final exit from a killed Strategy can permanently strand paired-Bribe rewards
Severity: Medium
Status: Accepted by ADR 0028; open residual
Category: Lifecycle and reward liveness
Affected contracts: Bribe, Resonance
Violated invariant: No value should become unreachable after a permitted lifecycle transition.
Attacker prerequisites: A Strategy is killed with an active Bribe stream, every signaler exits, or rewards are notified after final exit while lifetime headroom remains.
Impact: Remaining active and queued reward tokens stay accounted in the Bribe with no eligible future signal supply.
Minimal trace: Start a seven-day reward, kill after one day, withdraw the final signal, notify again, and advance one year.
Root cause: Killed Strategies reject new signal while Bribe intentionally has no retirement, refund, sweep, or Fund reclassification.
Regression test: `BribeRetirementRiskTest.test_KnownRisk_DeadStrategyBribeCanPauseAndQueueRewardsForever`.
Patch: None; the test preserves the accepted consequence.
Residual risk: Six days of the example stream plus every successful post-exit notification within that token's
remaining ADR 0035 lifetime headroom remain unreachable indefinitely.

The exact option analysis and operational controls are recorded in `KILLED-STRATEGY-BRIBE-DECISION.md`. No Solidity
change is justified without a replacement ADR defining different reward ownership and accepting the trust-model
change.

## SR-007

ID: SR-007
Title: Echidna could exit zero after every worker crashed before making a call
Severity: Low
Status: Fixed locally
Category: Test infrastructure
Affected contracts: None; `foundry.toml`, `audit/run-nightly.sh`, and result validation
Violated invariant: A green external-fuzzer job must prove nonzero progress, full configured depth, and passing
properties.
Attacker prerequisites: None.
Impact: Process status alone could admit a zero-transition campaign as evidence.
Minimal trace: Compile the immutable-bearing constructor graph without metadata; Echidna reports `Set.elemAt: index
out of range`, zero calls, and exit status zero.
Root cause: Echidna needs compiler metadata to distinguish contracts created by the harness constructor, while the
production Foundry profile deliberately removes it.
Regression test: `audit/check-echidna-results.test.mjs` and `audit/check-fuzzer-wiring.test.mjs`.
Patch: Added a metadata-only Echidna profile, passed it through the container runner, and added a fail-closed result
validator. The production build configuration remains unchanged.
Residual risk: The digest-pinned Docker execution path remains unrun on this host; the current full campaign used the
SHA-256-verified official native binary.

## SR-008

ID: SR-008
Title: Stateful campaigns omitted Strategies added after bootstrap
Severity: Medium
Status: Fixed locally
Category: Test assurance
Affected contracts: None; Foundry invariant handlers and the Echidna/Medusa state-machine harness
Violated invariant: Every dynamically registered Strategy must participate in later actions and in every aggregate,
solvency, reward, lifecycle, and full-exit property.
Attacker prerequisites: None; the gap appeared whenever the Foundry handler reached `addStrategy`.
Impact: The prior handler discarded the returned Strategy address while both handlers and all properties retained
fixed bootstrap arrays. A defect limited to the fourth or later Strategy could therefore remain invisible to a green
campaign.
Minimal trace: Call `ProtocolWorkflowHandler.addStrategy`; observe `liveStrategyCount` increase while subsequent
signal, reward, kill, withdrawal, and invariant enumeration remain limited to the original three addresses.
Root cause: Independently copied fixed Strategy arrays and no post-bootstrap addition action in the external campaign.
Regression test: `ProtocolInvariantsTest.test_DynamicallyAddedStrategyEntersEveryHarnessPath` and
`CampaignHarnessTest.test_DynamicallyAddedStrategyEntersTheExternalCampaign`.
Patch: Added one shared append-only registry for both Foundry handlers and every Strategy-enumerating property. The
addition handler now records the returned address. The external campaign also permits one bounded dynamic addition,
after which all existing actions and properties enumerate the expanded array.
Validation: The configured Foundry profile passed 29/29 tests at 1,000 runs and 500 calls per invariant with zero
reverts; `addStrategy` was selected 17,339 times. The integration campaign wrapper passed 7/7 tests, including 256
randomized sequences and the dynamic-Strategy lifecycle regression.
Residual risk: Dynamic growth is deliberately capped at one extra Strategy to keep invariant and external-fuzzer loops
bounded. Fresh full-length Echidna and Medusa runs remain required before treating the current tree as campaign
evidence.

## SR-009

ID: SR-009
Title: Current-balance scale guard could reopen capacity against a monotonic Bribe index
Severity: High
Status: Fixed locally by ADR 0035
Category: Arithmetic and signal-exit liveness
Affected contracts: Bribe, SignalGBX, BribeRouter
Violated invariant: No admitted reward history may make a mandatory Bribe checkpoint overflow and block signal
movement or withdrawal.
Attacker prerequisites: A freely mintable, upgradeable, or unusually high-decimal token is registered as a Bribe
reward, the attacker can fund it near the raw-unit scale boundary, and the Bribe has at least one raw signal unit.
Impact: After the cumulative index approached `uint256` maximum, a later reward could leave a persistent schedule whose
next checkpoint overflows. Because signal deposits, moves, and withdrawals checkpoint every registered reward, users
could be unable to recover escrowed GBX; an ordinary Strategy kill would not bypass the poisoned paired-Bribe
checkpoint on withdrawal.
Minimal trace: With one raw signal unit, notify the former current-balance maximum, complete and claim the stream so
the accounted balance returns to zero, notify one more raw reward unit, advance time, then checkpoint or withdraw.
Root cause: The prior guard constrained `accountedRewardBalance * 1e18` at the time of each notification. Claims and
Fund payments reduced that balance, while the cumulative `rewardPerTokenStored` index never decreased.
Regression tests: `BribeRewardFlowTest.test_LifetimeRewardCapAcceptsTheExactLimitAndRejectsTheFirstExcessUnit`,
`test_LifetimeRewardCapStillBlocksAfterTheMaximumWasClaimed`,
`test_TwoCompletedRewardCyclesMayExactlyConsumeTheLifetimeCap`,
`BribeTest.test_ZeroSupplyNotificationConsumesLifetimeCapacityImmediately`,
`BribeTest.test_NotifyRejectsAFeeOnTransferRewardToken`,
`BribeRouterTest.test_LifetimeRewardCapFailurePreservesRouterStateAndFundSettlement`,
`SignalGBXTest.test_KilledStrategyExitRemainsLiveAfterRewardLifetimeCapIsConsumed`, and the Bribe lifetime/index
properties in both state-machine harnesses.
Validation: The focused BribeTest and BribeRewardFlowTest suites passed 32/32 and 10/10 respectively, the complete
BribeRouterTest suite passed 15/15, and the canonical killed-Strategy cap-exhaustion exit regression passed. Fresh
Forge validation then passed 329/329 default-profile tests, including all 29 invariants at 1,000 runs and 500 calls
with zero handler reverts, plus 18/18 integration tests and Hardhat bytecode parity. Fresh native Echidna and Medusa
runs remain open.
Patch: Every Bribe now tracks monotonic `lifetimeRewardNotified[token]` and rejects before checkpointing or token
interaction when a notification would exceed `floor((2^256 - 1) / REWARD_PRECISION)`. Direct donations do not consume the cap
because they never enter reward accounting. The existing current-balance guard remains defense in depth.
Safety proof: For lifetime notified raw units `N` and precision `P`, the smallest nonzero signal supply is one
raw unit, so every admitted raw reward unit contributes at most `P` cumulative-index units. The cap gives
`rewardPerTokenStored <= N * P <= 2^256 - 1`; supply one attains the limit, making it the largest
history-independent safe bound. Claims, Fund classifications and payments, completed periods, queues, and Strategy
death do not reset `N`.
ADR 0037 later raises `P` from `1e18` to `1e36` and automatically reduces the cap to preserve the same proof.
Residual risk: The raw-unit cap can constrain high-decimal tokens, although it is approximately `1.158e23` whole
tokens at 18 decimals. At exhaustion, only new notifications fail: claims, moves, and withdrawals remain available.
An automatic Strategy-payment reward stays recorded as an unpaid BribeRouter liability, while the independent Fund
liability remains settleable. ADR 0028 remains unchanged: no retirement, rescue, or killed-Strategy escape hatch was
added, and closed-pool rewards can still become unreachable after final exit.

## SR-010

ID: SR-010
Title: Bribe index precision stranded economically material six-decimal rewards at realistic signal supply
Severity: High
Status: Fixed locally by ADR 0037
Category: Reward accounting and signal-exit economics
Affected contracts: Bribe
Violated invariant: A notified raw reward unit must become attributable without requiring an economically unrealistic
reward amount relative to ordinary eighteen-decimal signal weight.
Attacker prerequisites: None. The condition occurs naturally when a registered six-decimal reward token such as USDG
is distributed against millions of whole sGBX.
Impact: Under the former `1e18` index, a complete one-token six-decimal reward against five million sGBX left all one
million raw units below global index resolution. Signal entry or exit then classified that carry to Fund, so signallers
received zero despite the Bribe holding and scheduling the reward.
Minimal trace: Signal three million and two million sGBX, notify `1_000_000` raw six-decimal units, complete the
seven-day stream, and claim. Under the former precision both claims were zero; a later supply change made the complete
reward Fund-bound.
Root cause: Reward index precision matched the `1e18` signal denomination instead of providing headroom above it.
Regression tests: `SixDecimalBribeTest`, `SixDecimalAutomaticBribeIntegrationTest`, and
`SixDecimalBribeInvariantTest` cover one-unit rewards, exact 60/40 payment, repeated streams, zero supply, signal entry,
mid-stream exit, the complete Strategy/Router/Bribe graph, 10,000-run fuzzing, and 1,000-by-500-call stateful campaigns.
Patch: Raise `Bribe.REWARD_PRECISION` to `1e36` and retain the lifetime cap as
`floor(type(uint256).max / REWARD_PRECISION)`. No token `decimals()` call or per-token scale is trusted.
Validation: The focused six-decimal suite passed 13/13, including 500,000 state-machine calls with zero handler
reverts. Independent Python and TypeScript conservation-model regressions pay exactly 600,000 and 400,000 raw units
from the one-token/five-million-signal case. The complete default profile passed 353/353 twice, the integration
profile passed 19/19, Hardhat compiler parity passed, and all 49 mutation targets—including a `1e36`-to-`1e18`
precision regression—were killed.
Residual risk: Solidity still cannot allocate fractions below one raw token unit. An account's sub-unit entitlement
remains account-specific and is classified to Fund on full exit. Tokens with unusually high decimals encounter the
lower, precision-coupled lifetime cap sooner in displayed-token terms.

## Summary

Fixed locally: four High protocol mismatches, one High dependency advisory, one Medium test-assurance defect, and two
Low campaign-infrastructure defects. Dispositioned: one Informational analyzer report. Open and accepted: one Medium
lifecycle risk. No undisclosed Critical or High production-contract finding remained in the campaign's reviewed
scope; this is not a current independent-audit or production-safety conclusion for ADRs 0036 and 0037.
