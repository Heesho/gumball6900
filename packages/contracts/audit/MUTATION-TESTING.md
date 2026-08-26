# Mutation-testing record

The historical focused ADR-0048 campaign killed 47/47 targeted mutants. The checked-in disposable-copy runner is
`packages/contracts/audit/run-signal-resonance-mutations.mjs`. Its post-ADR-0051 manifest now lists 51 mutants:

- 16 SignalGBX mutants cover restoration of forbidden idle stake/unstake selectors, scalar custody, receipt mint/burn,
  canonical add/remove hooks, removal-before-burn ordering, disabled transfers, batch aggregate custody and burn,
  per-allocation add/remove loops, batch failure propagation, and empty-batch rejection;
- 17 Resonance mutants cover hook authorization, paired-Bribe synchronization, checkpoint ordering, index precision,
  schedule rollover, distribution clearing and recipient identity, live-Strategy lifecycle rules, killed-Strategy
  removal, and restoration of the intentionally absent Resonance move hook;
- one ResonanceRouter, one Strategy, four policy, four settlement, and eight Bribe mutants cover the remaining focused
  routing, payment-classification, administration-bound, reward-index, lifetime-cap, and claim transitions.

On 2026-08-26, `node audit/run-signal-resonance-mutations.mjs --match=SGBX-` killed the complete current SignalGBX
subset, 16/16, in the runner's disposable copy. All were test-killed rather than compile-killed. The raw result is
retained as `audit/reports/signal-resonance-mutation-sgbx.json`. This focused smoke validates the renamed scalar
operators, new batch operators, and selector-absence operators; it is not a result for the other 35 listed mutants or
the complete 51-mutant manifest. A separate `--match=RES-05` smoke also test-killed the mutant that restores the
intentionally absent Resonance move hook, with its raw result retained as
`audit/reports/signal-resonance-mutation-res-05.json`.

This is a focused development score, not a protocol-wide mutation score, formal proof, independent audit, deployment
approval, or release evidence. Historical 94.1% raw / 100% equivalent-adjusted figures apply only to their pinned
earlier tree. ADRs 0049-0051 later change the canonical transfer paths, issuance graph, and SignalGBX entrypoints, so
the complete post-ADR-0051 deterministic and workspace matrices, the remaining 34 mutants, and one complete
51-mutant run still require recorded results before a complete current score may be stated. The independent-audit,
pinned external-fuzzer, symbolic-execution, and formal-verification gates remain open.

Before release, preserve the focused mutant manifest and output under `audit/reports`, independently review the
operator set and every equivalence decision, and extend the campaign wherever the final external review identifies a
material state transition that is not already mutated. Expected values must never be altered merely to kill a mutant.
