# Mutation-testing record

The current focused ADR-0048 campaign killed 47/47 targeted mutants. The checked-in disposable-copy runner is
`packages/contracts/audit/run-signal-resonance-mutations.mjs`; it covers the scalar Synthetix reward shape, direct
Strategy settlement, the Bribe-only Router, the sixteen-token bound, and composed SignalGBX moves, including omitted
composition, same-Strategy validation, restoration of the removed Resonance hook, and restoration of the old cap.

This is a focused development score, not a protocol-wide mutation score, formal proof, independent audit, deployment
approval, or release evidence. Historical 94.1% raw / 100% equivalent-adjusted figures apply only to their pinned
earlier tree. ADRs 0049 and 0050 later change the canonical transfer paths and issuance graph, so the complete
post-ADR-0050 deterministic and workspace matrices still require a rerun, and the
independent-audit, pinned external-fuzzer, symbolic-execution, and formal-verification gates remain open.

Before release, preserve the focused mutant manifest and output under `audit/reports`, independently review the
operator set and every equivalence decision, and extend the campaign wherever the final external review identifies a
material state transition that is not already mutated. Expected values must never be altered merely to kill a mutant.
