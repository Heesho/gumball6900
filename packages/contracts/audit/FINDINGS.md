# Internal security finding register

Date: 2026-08-16

Status: the ADR 0031 mandatory-signal and ADR 0032 fixed 90/10 implementation is an uncommitted development candidate.
Its current unit, invariant, integration, Hardhat, mutation, SDK, subgraph, simulation, and frontend campaigns pass,
and pinned native external-fuzzer and static campaigns now pass. It has not received an independent audit, compatible
symbolic analysis, or release review required for deployment. Current campaign-specific findings are in
`SIGNAL-RESONANCE-FINDINGS.md`.

## Current dispositions

| ID   | Severity | Status                                                        | Summary                                                                                                                           |
| ---- | -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A-02 | High     | Accepted by ADR 0029                                          | Resonance can retain explicit rounding, zero-signal, and direct-donation USDG surplus.                                            |
| A-03 | High     | Previously resolved; regression coverage retained             | Bribe retains exact rate/index carry, zero-supply time, queues, and selective claims.                                             |
| A-04 | High     | Previously resolved; regression coverage retained             | Fixed Fund liabilities isolate signal exit from failing transfers.                                                                |
| A-06 | Medium   | Resolved by ADR 0022                                          | Liquidity fee harvesting preserves fixed principal and fixed destinations.                                                        |
| A-08 | Medium   | Liveness resolved; bounded cost retained                      | Bribe work remains capped at eight reward tokens.                                                                                 |
| A-09 | Medium   | Resonance accepted by ADR 0029; Bribe resolved by ADR 0027    | Resonance accepts flooring surplus; Bribe fixes old-denominator carry to Fund before signal-supply changes.                       |
| A-10 | High     | Superseded design; current mechanism mitigates the same class | Fund checkpoints all Mine accrual before every redemption denominator snapshot.                                                   |
| A-11 | High     | Resolved in development by ADR 0029                           | Checkpoint-first signals prevent same-transaction capture; qualifying top-ups reset behind a Router threshold.                    |
| BR-1 | Medium   | Accepted by ADR 0028                                          | A killed Strategy's Bribe remains a closed reward pool for incumbent signalers; final exit can permanently abandon rewards.       |
| M-01 | Economic | Accepted by ADR 0024                                          | Fixed-tenure fairness temporarily allows aggregate issuance above the current global rate after expansion or threshold crossings. |
| M-02 | Economic | Accepted by ADR 0024                                          | A miner receives the 80% handoff amount only if a successor pays a nonzero replacement price.                                     |
| E-01 | High     | Resolved in development                                       | Fund rejects selected-token transfers that reduce another selected address's snapshotted backing.                                 |
| E-02 | High     | Mitigated; M-03 release gate remains                          | One-time bindings require reciprocal protocol identities; codehash, parameter, and manifest review remains external.              |
| E-03 | Medium   | Resolved in development                                       | Resonance rejects non-transferable SignalGBX as a Strategy payment or Bribe reward token.                                         |
| E-04 | Medium   | Resolved in development                                       | Exact-consumed allowances skip incompatible redundant zero-approval calls.                                                        |
| E-05 | Low      | Resolved in development                                       | The subgraph records Bribe carry classified to Fund even when no whole-token liability accrues.                                   |
| M-03 | High     | Mitigated; open release gate                                  | Reciprocal identity checks prevent crossed graphs, but incorrect parameters or malicious lookalikes remain unrecoverable.         |
| M-04 | High     | Open release gate                                             | Exact initial rate, thresholds, tail, multiplier, and minimum price have not been selected or independently reviewed.             |
| G-01 | High     | Accepted by ADR 0030; independent review required             | Snapshot voting does not lock sGBX, so short-lived or borrowed GBX can retain historical voting power after signal withdrawal.    |
| G-02 | Medium   | Accepted by ADR 0030                                          | A successful proposal has no public cancellation path after it is queued in the Timelock.                                         |
| G-03 | High     | Open deployment and parameter gate                            | Undelegated sGBX increases quorum without voting and can deadlock every remaining maintenance action.                             |

No production-safety conclusion applies to the Mine redesign.

## G-01 through G-03 — SignalGBX governance boundaries

ProtocolGovernor accepts only exact zero-value calls to the three Resonance maintenance selectors and Mine capacity
increase. The Governor is intended to be the Timelock's sole proposer, generic relay and Timelock replacement always
revert, and Resonance/Mine ownership provides no direct caller bypass after setup.

SignalGBX uses block snapshots without a signal-withdrawal lock. An account may hold or borrow GBX through the
snapshot, signal it, then withdraw and still vote with historical weight. This is especially material because Strategy
death is irreversible. A percentage quorum uses historical sGBX total supply, including undelegated receipts; enough
undelegated signal can make all four maintenance paths unreachable. Conversely, low signaled participation lowers the
absolute amount needed for capture. Exact voting delay, period, threshold, quorum, and chain block-time assumptions
remain unresolved production parameters.

OpenZeppelin Governor cancellation is proposer-only while Pending. After queueing, the Governor contract has no public
function that calls Timelock cancellation even though it holds `CANCELLER_ROLE`; there is intentionally no guardian.
A stale or conflicting operation can therefore remain queued forever and revert on execution, but it cannot block a
differently described replacement proposal.

Disposition: the no-lock and no-guardian choices are accepted for development by ADR 0030. Production remains blocked
until independent review accepts the capture/liveness model and deployment evidence proves the initial Strategy set,
immutable parameters, sole proposer/canceller, open executor, absence of external default admin, and absence of
pre-scheduled operations.

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
ADR 0024 instead gives each live Mine slot continuous accrual and makes `Fund.redeem` call `Mine.checkpointAll`
before capturing the common denominator. The checkpoint and redemption are atomic. Capacity is capped at sixteen, so
the work is bounded.

Disposition: mitigated in the current development candidate. Reopen if Fund stops checkpointing, a second issuer is
introduced, pending accrual can be omitted, or checkpoint work becomes unbounded.

## A-11 — atomic signal redirection into a stale cheap Strategy auction

The prior immediate allocator let an account add a dominant signal to a thin Strategy, route fresh Mine revenue under
that new weight, and fill the Strategy's already-decayed auction in one transaction. The new money could therefore be
bought at a price established while the Strategy held almost no inventory.

ADR 0029 places received USDG in one Bribe-shaped seven-day reward period. Signal mutations checkpoint elapsed revenue
before changing weights, and `Strategy.buy` checkpoints released revenue before reading inventory. No stream time elapses
between same-transaction operations, so the fill can acquire only inventory that predated the routed payment. The
deterministic regression test is `test_SameTransactionSignalAndPurchaseCannotCaptureNewlyNotifiedRevenue`.

The Router holds a nonzero balance below the active period's exact remaining reward. Once the complete balance
qualifies, Resonance checkpoints and restarts seven days with the new reward plus the old remainder. This deliberately
permits qualifying reset/top-up behavior while preventing sub-threshold Mine and liquidity revenue from reverting.
The regressions include `test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies`,
`test_TopUpBelowLeftRevertsAtomicallyAtResonance`, and
`test_QualifyingTopUpCheckpointsAndRestartsWithRewardPlusLeft`.

Disposition: resolved in the development candidate. Existing Strategy inventory can still be bought at its current
price, and a signal held over real elapsed time earns future flow. Reopen if notification becomes immediately
distributable, signal mutations stop checkpointing, or Strategy stops synchronizing before its inventory snapshot.

## BR-1 — closed Bribe reward pool after Strategy death

Killing a Strategy permanently rejects every new signal increase, including an increase by an existing signaler. It
does not remove existing signal weight or retire the paired Bribe. Incumbent signalers may remain for any duration,
continue earning independently notified Bribe rewards, claim, and reduce or fully remove their signal at any time.
The dead Strategy receives no future Resonance USDG; its whole-unit claim checkpointed at death remains payable to the
Strategy, while any floored fraction remains Resonance surplus.

The Bribe remains permissionlessly fundable after Strategy death. If its final signaler exits while an active stream
or queued rewards remain, the active stream pauses and the queue has no possible future entrant to restart it. Those
tokens remain accounted in Bribe but are permanently unclaimable and do not become a Fund liability. The abandoned
amount is not bounded to dust: it may include the complete unvested stream and any later notification made with zero
signal supply.

Disposition: accepted protocol behavior in ADR 0028. Strategy death deliberately creates a closed reward pool for
incumbent signalers without adding a retirement state, refund, rescue, sweep, or Fund reclassification. Interfaces
must identify dead Strategies, warn the final signaler that an exit can abandon remaining rewards, and must not imply
that a direct reward notification to a dead zero-supply Bribe is recoverable. The deterministic regression
`test_KnownRisk_DeadStrategyBribeCanPauseAndQueueRewardsForever` remains evidence of the accepted terminal state.
Reopen if Strategy-death signaling rules, Bribe notification rules, or the protocol's no-recovery policy changes.

## M-01 — fixed-tenure fairness raises transitional aggregate issuance

An incumbent keeps the `ups` recorded when it entered. If capacity grows from one to three, the incumbent is not
reduced from its old one-slot rate; only new slots receive the current global rate divided by three. The same rule
applies when cumulative issuance crosses a future-handoff halving threshold.

This prevents governance or another user from changing the economic deal after a miner paid. It also means aggregate
issuance can exceed the current undivided global rate until old tenures turn over.

Disposition: accepted economic behavior in ADR 0024. Tests and both independent models assert that incumbents retain
their exact rate. Reopen if capacity governance, rate assignment, or turnover assumptions change.

## M-02 — rollover risk and zero-price replacement

The 80% payment is not guaranteed. It exists only when a later participant replaces a nonempty slot at a nonzero
price. After an hour the quoted price is zero, and another account can replace the miner without funding a handoff
claim. The incumbent still keeps all GBX accrued through the replacement checkpoint.

Disposition: accepted mining-market behavior. User interfaces must not present the successor payment as principal,
yield, or a guaranteed refund.

## M-03 — irreversible mining authority and immutable dependencies

GBX permits its temporary minter to call `setMinter` exactly once. Reciprocal identity checks now reject a Mine for a
different GBX, a Resonance for a different SignalGBX or factory pair, and a router for a different Resonance or USDG.
A malicious lookalike, wrong owner, parameter set, runtime, or target-chain dependency still cannot be repaired because
the protocol intentionally has no upgrade, successor, or migration authority.

Disposition: open High release gate. A signed manifest must prove constructor arguments, runtime code, permanent
minter identity, ownership, timelock roles, and all dependencies before any user funds are accepted.

## M-04 — production economics are unresolved

Tests use illustrative values. The initial GBX/second rate, cumulative halving amount, tail rate, USDG price
multiplier, and minimum initial price control dilution, mining economics, and protocol revenue. Selecting them without
independent modeling could produce unsafe or unusable economics even if the Solidity behaves exactly as written.

Disposition: open High release gate. Review scenarios for demand collapse, persistent high-rate incumbents, rapid
capacity expansion, threshold timing, tail dilution, MEV, and thin GBX liquidity before signing parameters.

## Evidence status

- The current default Foundry campaign passes 335 tests. Its stateful suite passes 27 properties at 1,000 runs of 500
  calls (13.5 million aggregate calls), with all 31 selectors reached about 16,000 times and zero handler reverts or
  discards. The integration profile passes 17 tests, including 256 randomized action sequences and real Uniswap v4
  fee harvesting.
- Hardhat parity, SDK, subgraph, independent TypeScript/Python simulations, frontend, formatting, lint, typecheck,
  documentation, and workspace builds pass in this working tree.
- Pinned Slither 0.11.5, Aderyn 0.6.8, Semgrep 1.162.0, Gitleaks 8.30.1, compiler/size, dependency, and license gates
  pass. The exact register accepts 177 current-source findings across 28 reviewed detector classes; Semgrep and
  Gitleaks raw reports contain zero findings.
- Current native Medusa 1.5.1 completed 101,602 calls with zero failures across 65 surfaces. Pinned Echidna 2.3.2
  completed 100,213 calls with all 25 properties passing. The current 43-mutant focused campaign killed every mutant.
- Mythril 0.24.8 remains incompatible with constructor-resolved immutable/Cancun runtimes and is not a proof.
- Independent audit, a second external-fuzzer seed, legal clearance, reviewed production parameters, monitored
  testnet rehearsal, and a signed deployment manifest remain open.
