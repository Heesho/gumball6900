# Internal security finding register

Date: 2026-08-12

Status: the ADR 0024 Mine redesign is an uncommitted development candidate. Its current unit, invariant, integration,
Hardhat, SDK, subgraph, simulation, and frontend campaigns pass, but it has not received the independent audit, full
static re-disposition, mutation campaign, symbolic analysis, or release review required for deployment.

## Current dispositions

| ID   | Severity | Status                                                        | Summary                                                                                                                           |
| ---- | -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A-02 | High     | Previously resolved; regression coverage retained             | Resonance uses exact carried USDG accounting.                                                                                     |
| A-03 | High     | Previously resolved; regression coverage retained             | Bribe retains exact rate/index carry, zero-supply time, queues, and selective claims.                                             |
| A-04 | High     | Previously resolved; regression coverage retained             | Fixed Fund liabilities isolate signal exit from failing transfers.                                                                |
| A-06 | Medium   | Resolved by ADR 0022                                          | Liquidity fee harvesting preserves fixed principal and fixed destinations.                                                        |
| A-08 | Medium   | Liveness resolved; bounded cost retained                      | Bribe work remains capped at eight reward tokens.                                                                                 |
| A-09 | Medium   | Open                                                          | Conserved scaled carry can cross a later signal-supply boundary.                                                                  |
| A-10 | High     | Superseded design; current mechanism mitigates the same class | Fund checkpoints all Mine accrual before every redemption denominator snapshot.                                                   |
| M-01 | Economic | Accepted by ADR 0024                                          | Fixed-tenure fairness temporarily allows aggregate issuance above the current global rate after expansion or threshold crossings. |
| M-02 | Economic | Accepted by ADR 0024                                          | A miner receives the 80% handoff amount only if a successor pays a nonzero replacement price.                                     |
| M-03 | High     | Open release gate                                             | Incorrect permanent GBX minter handoff or immutable Mine configuration is unrecoverable.                                          |
| M-04 | High     | Open release gate                                             | Exact initial rate, thresholds, tail, multiplier, and minimum price have not been selected or independently reviewed.             |

No production-safety conclusion applies to the Mine redesign.

## A-09 — carry crosses signal-supply boundaries

Resonance and Bribe conserve sub-index carry but divide it by the signal supply present when it becomes indexable. A
later signal can therefore receive part of value that arrived or emitted before entry. Conservation and solvency still
hold; the issue is historical allocation fairness. Deterministic PoCs remain in `CarryReallocation.t.sol`.

Disposition: open Medium. Revisit exact historical buckets, a fixed dust destination on denominator change, or an
explicit supported-token decimal policy before deployment.

## A-10 — accrued mining and redemption denominator

The discarded asynchronous distribution design could omit already-promised future issuance from current total supply.
ADR 0024 instead gives each live Mine slot continuous accrual and makes `Fund.redeem` call `Mine.checkpointAll`
before capturing the common denominator. The checkpoint and redemption are atomic. Capacity is capped at sixteen, so
the work is bounded.

Disposition: mitigated in the current development candidate. Reopen if Fund stops checkpointing, a second issuer is
introduced, pending accrual can be omitted, or checkpoint work becomes unbounded.

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

GBX permits its temporary minter to call `setMinter` exactly once. A wrong target, token identity, router, owner,
parameter set, or target-chain dependency cannot be repaired because the protocol intentionally has no upgrade,
successor, or migration authority.

Disposition: open High release gate. A signed manifest must prove constructor arguments, runtime code, permanent
minter identity, ownership, timelock roles, and all dependencies before any user funds are accepted.

## M-04 — production economics are unresolved

Tests use illustrative values. The initial GBX/second rate, cumulative halving amount, tail rate, USDG price
multiplier, and minimum initial price control dilution, mining economics, and protocol revenue. Selecting them without
independent modeling could produce unsafe or unusable economics even if the Solidity behaves exactly as written.

Disposition: open High release gate. Review scenarios for demand collapse, persistent high-rate incumbents, rapid
capacity expansion, threshold timing, tail dilution, MEV, and thin GBX liquidity before signing parameters.

## Evidence status

- The current default Foundry campaign passes 303 tests. Its stateful suite passes 1,000 runs of 500 calls (500,000
  transitions) with zero handler reverts. The integration profile passes 17 tests, including 256 randomized action
  sequences and real Uniswap v4 fee harvesting.
- Hardhat parity, SDK, subgraph, independent TypeScript/Python simulations, frontend, formatting, lint, typecheck,
  documentation, and workspace builds pass in this working tree.
- Slither 0.11.6 successfully analyzed the current 150-contract compile graph and emitted 103 raw detector results.
  One readability result was fixed by explicitly initializing Mine's halving counter; all remaining output still
  requires exact manual re-disposition alongside the unavailable pinned Aderyn and Semgrep runs, so this is not a
  static-analysis pass.
- Earlier Medusa, Echidna, coverage, static, mutation, and gas reports belong to the superseded graph until rerun and
  recorded.
- Mythril 0.24.8 remains incompatible with constructor-resolved immutable/Cancun runtimes and is not a proof.
- Independent audit, mutation testing, pinned Echidna, legal clearance, and a signed deployment manifest remain open.
