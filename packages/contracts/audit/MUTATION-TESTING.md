# Mutation-testing record

No defensible mutation score exists for the current adversarial-audit tree.

The repository contains historical prose reporting a disposable-copy Slither mutation campaign against an earlier
tree, but it has no checked-in mutation configuration, current source-span baseline, equivalence-review ledger, or
script that reproduces that score. Reusing the historical 94.1% raw / 100% equivalent-adjusted figures would be
misleading because Resonance and Bribe were materially rewritten.

Slither 0.11.5 includes `slither-mutate`, but running an unconfigured ad hoc mutation over the working tree would not
satisfy the requested pinned-framework, disposable-copy, targeted-operator, equivalence-review, and current-graph
requirements. Therefore:

- raw score: unavailable;
- equivalent-adjusted score: unavailable;
- surviving current-tree mutants: unknown;
- release gate: blocked.

Before release, add a pinned mutation configuration and disposable-copy runner, target every item in the hardening
brief, preserve mutant manifests and test output under `audit/reports`, and review every survivor without altering
expected values merely to kill a mutant.
