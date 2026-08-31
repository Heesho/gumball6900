# Mutation-testing record

The historical focused ADR-0048 campaign killed 47/47 targeted mutants. The checked-in disposable-copy runner is
`packages/contracts/audit/run-signal-resonance-mutations.mjs`. Its current manifest lists 115 mutants. The recorded
complete pre-ADR-0053 run covered the first 59; the corrected post-ADR-0053 run covered 70; ADR 0055 and the current
whole-source gauntlet added the remaining operators:

- 18 SignalGBX mutants cover restoration of forbidden idle stake/unstake selectors, scalar custody, receipt mint/burn,
  canonical add/remove hooks, removal-before-burn ordering, disabled transfers, batch aggregate custody and burn,
  per-allocation add/remove loops, batch failure propagation, empty-batch rejection, and exact principal return;
- five GBX mutants cover the reciprocal Mine handoff, permanent lock, pre-handoff mint rejection, and lifetime mint/burn
  accounting;
- 30 Resonance mutants cover hook authorization, paired-Bribe synchronization, checkpoint ordering, index precision,
  schedule rollover, distribution clearing and recipient identity, live-Strategy lifecycle rules, killed-Strategy
  removal, the lifetime revenue cap, global-Strategy iteration, restoration of the intentionally absent Resonance move
  hook, and ADR 0053's fixed-beneficiary batch validation, iteration, atomic failure, and reentrancy behavior;
- eight Mine, three ResonanceRouter, five Strategy, 13 Bribe, and three Fund mutants cover routing,
  payment-classification, administration, reward indices and caps, principal isolation, effective supply, final-balance,
  and transient-storage transitions;
- three BribeFactory, three BribeRouter, and four StrategyFactory mutants cover one-time reciprocal binding,
  deployment authorization, graph wiring, complete-buffer routing, and threshold behavior;
- nine GBXLauncher and two mutants for each of its four component deployers cover authority and chain binding,
  single-use consumption, caller/domain-scoped CREATE2 addresses, exact locked LP custody, pair lookup symmetry,
  prefunding, setup-owner removal, governance handoff, and final graph assertions; and
- three SignalPortfolioLens mutants cover graph binding, complete row iteration, and correct revenue-source reads.

On 2026-08-26, `node audit/run-signal-resonance-mutations.mjs --match=SGBX-` killed the then-complete SignalGBX
subset, 16/16, in the runner's disposable copy. All were test-killed rather than compile-killed. The raw result is
retained as `audit/reports/signal-resonance-mutation-sgbx.json`. This focused smoke validates the renamed scalar
operators, new batch operators, and selector-absence operators; it is not a result for the other 35 listed mutants or
the then-complete 51-mutant manifest. A separate `--match=RES-05` smoke also test-killed the mutant that restores the
intentionally absent Resonance move hook, with its raw result retained as
`audit/reports/signal-resonance-mutation-res-05.json`.

This is a focused development score, not a formal proof, independent audit, deployment approval, or release evidence.
Historical 94.1% raw / 100% equivalent-adjusted figures apply only to their pinned earlier tree. ADRs 0049-0052 change
the canonical transfer paths, issuance graph, SignalGBX entrypoints, and Resonance admission bound, so only a recorded
complete current manifest run may state a protocol-wide score. The independent-audit, pinned external-fuzzer,
symbolic-execution, and formal-verification gates were open at that historical point. The current gauntlet later added
validated Echidna and Medusa campaigns plus bounded Halmos proofs. Independent external audit, full formal
verification, and Mythril compatibility remain open.

On 2026-08-30, the post-ADR-0053 focused runs test-killed 10/10 `RES-2*` mutants and 6/6 `BRIBE-1*` mutants. Those
subsets include all eleven new operators for unauthorized checkpoint rejection, the immutable-Resonance exception,
fixed-beneficiary batching, empty/unregistered Strategy rejection, killed-Strategy support, full-entry iteration,
atomic batch failure propagation, and outer-batch reentrancy. The manifest does not include a dedicated internal-dedup
operator for repeated Strategy addresses. Raw results are retained as
`audit/reports/signal-resonance-mutation-res-2.json` and
`audit/reports/signal-resonance-mutation-bribe-1.json`. These overlapping focused subsets are current evidence for the
ADR 0053 delta. They predate ADR 0055's ownership and Router-migration surface.

The corrected complete post-ADR-0053 run then test-killed **70/70** mutants, with zero survivors, zero errors, and an
observed runtime of 315.62 seconds. This is the complete pre-ADR-0055 manifest result, but it remains an internally selected
operator set: independent operator review and any extensions requested by fresh external review remain pending. No
formal proof, external-fuzzer result, deployment approval, or release authorization follows from the score.

On 2026-08-31, `node audit/run-signal-resonance-mutations.mjs --match=MINE-` test-killed **8/8** Mine mutants. The
subset covers paid-replacement independence from immediate routing, owner authorization, activation of the validated
Router, absence of old-Router reads during cutover, and the replacement graph's Fund, GBX, Resonance-USDG, and
SignalGBX-to-Resonance identities. Raw results are retained as
`audit/reports/signal-resonance-mutation-mine.json`. This focused result overlaps the pre-ADR-0055 `MINE-01` operator
and adds seven ADR-0055 operators; it is not a fresh complete 77/77 campaign. The current manifest still has no dedicated
operators for same-Router rejection, every malformed getter/codeless-node branch, two-step acceptance or cancellation,
or the launcher's dual pending-owner postconditions. Those behaviors have deterministic tests, but a fresh independent
operator review may require further mutation coverage.

## Current whole-source scope audit

The 2026-08-31 gauntlet expanded the manifest from 78 to 115 operators and added a fail-closed source-scope validator.
The validator recursively discovers every Solidity file under `src`, rejects duplicate mutant IDs and unknown mutation
targets, and fails if any executable production source has no mutant. The current inventory is 25 Solidity files:

| Production source                             | Mutants |
| --------------------------------------------- | ------: |
| `src/core/Bribe.sol`                          |      13 |
| `src/core/BribeFactory.sol`                   |       3 |
| `src/core/BribeRouter.sol`                    |       3 |
| `src/core/Fund.sol`                           |       3 |
| `src/core/GBX.sol`                            |       5 |
| `src/core/Mine.sol`                           |       8 |
| `src/core/Resonance.sol`                      |      30 |
| `src/core/ResonanceRouter.sol`                |       3 |
| `src/core/SignalGBX.sol`                      |      18 |
| `src/core/Strategy.sol`                       |       5 |
| `src/core/StrategyFactory.sol`                |       4 |
| `src/launch/GBXLauncher.sol`                  |       9 |
| `src/launch/GBXRouterMineDeployer.sol`        |       2 |
| `src/launch/GBXSignalBribeDeployer.sol`       |       2 |
| `src/launch/GBXStrategyResonanceDeployer.sol` |       2 |
| `src/launch/GBXTokenFundDeployer.sol`         |       2 |
| `src/periphery/SignalPortfolioLens.sol`       |       3 |

No executable production source remains unmutated. The eight excluded Solidity files are the six `src/core/interfaces`
files and the two `src/launch/interfaces` files. They are ABI-only declarations with no deployable implementation,
storage, or state transition. External Factory and Pair behavior is mutated at the launcher's call sites and exercised
with hostile implementations rather than by changing those declarations.

The hardened pre-expansion campaign test-killed 78/78 operators at the frozen executable target with no compile-killed mutant. A
separate current-tree run of the 37 new whole-source operators initially exposed three surviving deployer-salt operators;
the new explicit CREATE2-address oracle then test-killed all three. The subsequent fresh combined campaign
test-killed **115/115** operators, with zero survivors, zero compile-kills, and every result classified as
`test-killed`. Its complete current-manifest receipts are
`audit/reports/signal-resonance-mutation-latest.json` and
`audit/reports/signal-resonance-mutation-all.json`; both have SHA-256
`0b0947fe89bb08c1e6beedbc38519048615b3c037b764e882f76d193bb59d918`.

Those receipts predate the later provenance-only footers appended after the closing braces of `Bribe`, `Resonance`,
`Strategy`, and `Mine`. The executable statements and production creation/deployed bytecode are identical, so the
mutants exercise the final executable candidate; the receipts are not described as hashes of the final source bytes.

The report embeds the source-scope assessment: 25 production Solidity files, 17 executable sources, eight justified
ABI-only exclusions, 115 manifest operators, and no duplicate ID, unknown target, stale exclusion, mutated exclusion,
or unmutated executable source. `--scope` emits the same machine-readable inventory,
`--match-regex` selects an exact operator family, and `--no-report` permits diagnostic runs without replacing retained
evidence.

Before release, preserve the focused mutant manifest and output under `audit/reports`, independently review the
operator set and every equivalence decision, and extend the campaign wherever the final external review identifies a
material state transition that is not already mutated. Expected values must never be altered merely to kill a mutant.
