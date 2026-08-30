# Mutation-testing record

The historical focused ADR-0048 campaign killed 47/47 targeted mutants. The checked-in disposable-copy runner is
`packages/contracts/audit/run-signal-resonance-mutations.mjs`. Its current manifest lists 77 mutants. The recorded
complete pre-ADR-0053 run covered the first 59; the corrected post-ADR-0053 run covered 70; ADR 0055 added seven more
Mine operators:

- 17 SignalGBX mutants cover restoration of forbidden idle stake/unstake selectors, scalar custody, receipt mint/burn,
  canonical add/remove hooks, removal-before-burn ordering, disabled transfers, batch aggregate custody and burn,
  per-allocation add/remove loops, batch failure propagation, and empty-batch rejection;
- 26 Resonance mutants cover hook authorization, paired-Bribe synchronization, checkpoint ordering, index precision,
  schedule rollover, distribution clearing and recipient identity, live-Strategy lifecycle rules, killed-Strategy
  removal, the lifetime revenue cap, global-Strategy iteration, restoration of the intentionally absent Resonance move
  hook, and ADR 0053's fixed-beneficiary batch validation, iteration, atomic failure, and reentrancy behavior;
- eight Mine, one ResonanceRouter, one Strategy, four policy, four settlement, 13 Bribe, and three Fund mutants cover
  the remaining focused routing, payment-classification, administration-bound, reward-index, lifetime-cap, principal-
  isolation, beneficiary/immutable-Resonance claim authorization, effective-supply, final-balance, and transient-
  storage transitions.

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
symbolic-execution, and formal-verification gates remain open.

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

Before release, preserve the focused mutant manifest and output under `audit/reports`, independently review the
operator set and every equivalence decision, and extend the campaign wherever the final external review identifies a
material state transition that is not already mutated. Expected values must never be altered merely to kill a mutant.
