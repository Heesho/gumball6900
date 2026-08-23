# Static-analysis record

> **Pre-ADR-0047 historical analyzer snapshot.** ADR 0047 removed the exact-carry, queue/pause, deferred-liability,
> selected-batch, and exact-delta reward/Strategy mechanics described or dispositioned below. The pinned results do
> not analyze scalar Synthetix scheduling, per-purchase Strategy splitting, direct Fund payment, or the simplified
> Bribe-only Router and therefore are not current evidence.

Date: 2026-08-16. Raw output is under the ignored `audit/reports` directory. This is internal engineering evidence,
not an independent audit or release approval.

> Historical current-at-run evidence: ADRs 0034–0036 changed the ownership graph, Bribe lifetime accounting, and
> Resonance administration after this record. In particular, `setBribeBps` and the Router's policy snapshot have not
> been analyzed by the pinned run below. ADR 0044 later removed Mine's synchronous Router call and renamed its deposit
> helper and event; the stored dispositions still contain the prior symbols. The exact disposition register must be
> regenerated and manually reviewed.

## Recorded pinned run

| Tool              |                Version | Scope                                     | Result                                                                                |
| ----------------- | ---------------------: | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Solidity compiler | 0.8.26+commit.8a97fa7a | shared Foundry source graph               | clean build; all production contracts within EIP-170                                  |
| Slither           |                 0.11.5 | Foundry graph under pinned Foundry 1.7.1  | 71 source findings across 13 detectors; exactly dispositioned                         |
| Aderyn            |                  0.6.8 | current `src` graph                       | 32 High-bucket and 74 Low-bucket instances across 15 detectors; exactly dispositioned |
| Semgrep           |                1.162.0 | current `src` graph, six repository rules | zero findings                                                                         |
| Solhint           |                  6.0.1 | current `src` graph                       | zero errors; 405 nonblocking warnings                                                 |
| Gitleaks          |                 8.30.1 | 27-commit Git history                     | zero leaks after narrow reviewed conjunctions                                         |
| pnpm audit        |           pnpm 10.14.0 | complete workspace graph                  | zero High/Critical; three Low and one Moderate                                        |

`bash audit/run-static.sh` passed in full. It verified all seven pinned tools before analysis and reverified compiled
artifact provenance afterward. The exact disposition register contains 177 source instances across 28 tool/detector
classes, reviewed 2026-08-16 and expiring 2026-08-23. New, stale, relocated, content-changed, or expired findings fail
closed.

Slither sometimes presents set-derived description sections in a different order on identical source. The checker
now sorts every nonempty description line before hashing while retaining detector, severity, confidence, exact source
span, symbol, and all description content. A regression proves presentation reordering is accepted while new and
changed findings remain blocking.

## Slither disposition

The six High-labeled results are four `weak-prng` reports and two `reentrancy-balance` reports. Modulo is used only for
deterministic remainder accounting, never entropy. The BribeRouter balance reads surround a callback-capable token
operation beneath `nonReentrant`; adversarial regression proves the nested call is rejected and the exact fixed
liability either settles once or rolls back completely.

The 14 Medium instances cover deliberate quotient/remainder arithmetic, exact equality sentinels, guarded token
interactions, and ignored non-authoritative convenience returns. The 42 Low and nine Informational instances cover
bounded calls/loops, timestamp-driven auctions and streams, event ordering, the required EIP-1153 assembly sites,
canonical public ledger names, and named-but-unused ERC-721 receiver parameters. Their exact rationales, assumptions,
revisit triggers, and compensating controls are in `static-dispositions.json`.

## Aderyn disposition

Aderyn's three High groups are `reentrancy-state-change` (30 instances), `centralization-risk` (13 instances), and
`contract-locks-ether` (one instance). Runtime value paths are guarded with checks-effects-interactions, exact token
deltas, and atomic rollback tests; one-time bindings and the remaining constructor calls validate their documented
reciprocal identities before activation. ADR 0045 deliberately makes Mine's Router/token pairing a post-deployment
evidence gate. The reported administration is the documented Resonance/Mine surface transferred to a no-external-admin Timelock. The
Governor rejects ordinary ETH, while unavoidable forced ETH is inert and cannot justify a forbidden rescue path.

The 12 Low groups cover fixed-eight or caller-selected loops, fixed literals, lexical shadowing, one named revenue
modifier, intentional interface shape, read-only slot snapshots, non-authoritative returns, and monitoring views. No
reported item provides an undisclosed authority or unbounded protocol-owned loop.

## Secret, dependency, and license policy

Gitleaks' earlier generic-key matches were public chain identifiers and historical fixtures. The current allowlist
uses path-and-regex conjunctions for those exact classes; it does not exclude a directory, extension, or generic secret
rule. The repository-wide history scan now produces an empty raw report.

The fixed `nanoid` edge is 3.3.18. Three Low and one Moderate advisory remain in Hardhat/tooling transitives and stay
visible in the report. Both Darwin and Linux dependency inventories were regenerated. The active platform inventory
matches exactly, and all 28 review-required license entries have explicit `needs-counsel` dispositions under an
`inventory-baselined` policy. Nothing here claims legal approval.

## Remaining analysis gaps

Mythril 0.24.8 is installed, but the checked runner fails closed before analysis because sound evaluation requires
constructor-resolved runtimes and the current graph contains immutables plus Cancun `MCOPY`, `TLOAD`, and `TSTORE`
instructions the pinned engine does not safely interpret. Solidity SMTChecker, Certora, Halmos, Kontrol, and hevm
symbolic proofs were not run. CodeQL remains an external workflow rather than current local evidence. The bounded
global Bribe-share setter, its owner surface, policy-source binding, pre-token-interaction snapshot, and weighted carry
also require a fresh pinned static run and human disposition. No symbolic or formal-verification result is claimed.
