# Internal security finding register

Date: 2026-08-13

Status: the ADR 0024 Mine redesign and ADR 0026 Resonance stream are an uncommitted development candidate. Their
current unit, invariant, integration, Hardhat, SDK, subgraph, simulation, and frontend campaigns pass, but they have
not received the independent audit, full static re-disposition, mutation campaign, symbolic analysis, or release
review required for deployment.

## Current dispositions

| ID   | Severity | Status                                                        | Summary                                                                                                                           |
| ---- | -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A-02 | High     | Previously resolved; regression coverage retained             | Resonance uses exact carried USDG accounting.                                                                                     |
| A-03 | High     | Previously resolved; regression coverage retained             | Bribe retains exact rate/index carry, zero-supply time, queues, and selective claims.                                             |
| A-04 | High     | Previously resolved; regression coverage retained             | Fixed Fund liabilities isolate signal exit from failing transfers.                                                                |
| A-06 | Medium   | Resolved by ADR 0022                                          | Liquidity fee harvesting preserves fixed principal and fixed destinations.                                                        |
| A-08 | Medium   | Liveness resolved; bounded cost retained                      | Bribe work remains capped at eight reward tokens.                                                                                 |
| A-09 | Medium   | Resolved in development by ADRs 0026 and 0027                 | Resonance and Bribe fix old-denominator carry to Fund before signal supply changes.                                               |
| A-10 | High     | Superseded design; current mechanism mitigates the same class | Fund checkpoints all Mine accrual before every redemption denominator snapshot.                                                   |
| A-11 | High     | Resolved in development by ADR 0025                           | A same-transaction signal shift cannot buy newly routed USDG at a stale Strategy price.                                           |
| M-01 | Economic | Accepted by ADR 0024                                          | Fixed-tenure fairness temporarily allows aggregate issuance above the current global rate after expansion or threshold crossings. |
| M-02 | Economic | Accepted by ADR 0024                                          | A miner receives the 80% handoff amount only if a successor pays a nonzero replacement price.                                     |
| E-01 | High     | Resolved in development                                       | Fund rejects selected-token transfers that reduce another selected address's snapshotted backing.                                 |
| E-02 | High     | Mitigated; M-03 release gate remains                          | One-time bindings require reciprocal protocol identities; codehash, parameter, and manifest review remains external.              |
| E-03 | Medium   | Resolved in development                                       | Resonance rejects non-transferable SignalGBX as a Strategy payment or Bribe reward token.                                         |
| E-04 | Medium   | Resolved in development                                       | Exact-consumed allowances skip incompatible redundant zero-approval calls.                                                        |
| E-05 | Low      | Resolved in development                                       | The subgraph records Bribe carry classified to Fund even when no whole-token liability accrues.                                   |
| M-03 | High     | Mitigated; open release gate                                  | Reciprocal identity checks prevent crossed graphs, but incorrect parameters or malicious lookalikes remain unrecoverable.         |
| M-04 | High     | Open release gate                                             | Exact initial rate, thresholds, tail, multiplier, and minimum price have not been selected or independently reviewed.             |

No production-safety conclusion applies to the Mine redesign.

## A-09 — reward carry across signal-supply boundaries

The prior Bribe implementation conserved sub-index reward carry but allowed it to survive a virtual-supply boundary.
A later signal could therefore receive part of a reward emitted before entry, and remaining signalers could receive
carry accumulated before another account exited.

ADR 0026 resolves the Resonance portion by moving pending scaled revenue to a fixed Fund remainder before every signal-
weight change. A late Strategy signal cannot receive that carry, and the exact accounting identity includes the Fund
remainder. ADR 0027 applies that bounded policy to Bribe: pending carry moves to Fund before every supply change, and a
fully exiting account's sub-token remainder moves to Fund instead of returning to global carry. Entry, withdrawal,
and full-exit regressions live in `CarryReallocation.t.sol`, with matching independent Python and TypeScript models.

Disposition: resolved in development. Reopen if pending or exiting-account carry can cross a supply boundary, or if
the fixed Fund classification policy changes.

## E-01 through E-05 — EthSkills-guided review remediations

The 2026-08-13 internal EthSkills checklist review found four additional current-tree issues:

- Fund's address-only duplicate check did not detect two token facades sharing one backing ledger. Redemption now
  checks each selected address before its transfer and verifies after the basket that it retained at least its own
  snapshot less its payout. The dual-facade regression proves the GBX burn and all transfers roll back atomically.
- One-time setup accepted any code-bearing target. GBX, SignalGBX, both factories, and Resonance now require reciprocal
  Mine, Resonance, factory, router, and USDG identities before binding. SignalGBX staking waits for that validation.
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

ADR 0026 places received USDG in one global active-plus-successor seven-day stream. Signal mutations checkpoint elapsed revenue before
changing weights, and `Strategy.buy` checkpoints released revenue before reading inventory. No stream time elapses
between same-transaction operations, so the fill can acquire only inventory that predated the routed payment. The
deterministic regression test is `test_SameTransactionSignalAndPurchaseCannotCaptureNewlyNotifiedRevenue`.

The router forwards every nonzero complete balance. A live top-up aggregates into one successor and cannot change the
active rate or finish, so repeated tiny notifications cannot reset or indefinitely extend active release. The relevant
regressions include `test_OneRawRevenueUnitRoutesWithoutTerminalDust`,
`test_RepeatedOneRawTopUpsOnlyAggregateTheSuccessor`, and
`test_LiveTopUpQueuesWithoutChangingTheActiveRateOrFinish`.

Disposition: resolved in the development candidate. Existing Strategy inventory can still be bought at its current
price, and a signal held over real elapsed time earns future flow. Reopen if notification becomes immediately
distributable, signal mutations stop checkpointing, or Strategy stops synchronizing before its inventory snapshot.

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

- The current default Foundry campaign passes 322 tests. Its stateful suite passes 1,000 runs of 500 calls (500,000
  transitions) with zero handler reverts. The integration profile passes 17 tests, including 256 randomized action
  sequences and real Uniswap v4 fee harvesting.
- Hardhat parity, SDK, subgraph, independent TypeScript/Python simulations, frontend, formatting, lint, typecheck,
  documentation, and workspace builds pass in this working tree.
- Slither 0.11.6 successfully analyzed the current 157-contract compile graph and emitted 171 raw detector results
  across 12 detector classes. The exact-fingerprint register correctly reports drift from the superseded graph; all
  current output still requires manual re-disposition alongside the unavailable pinned Aderyn and Semgrep runs, so
  this is not a static-analysis pass.
- Earlier Medusa, Echidna, coverage, static, mutation, and gas reports belong to the superseded graph until rerun and
  recorded.
- Mythril 0.24.8 remains incompatible with constructor-resolved immutable/Cancun runtimes and is not a proof.
- Independent audit, mutation testing, pinned Echidna, legal clearance, and a signed deployment manifest remain open.
