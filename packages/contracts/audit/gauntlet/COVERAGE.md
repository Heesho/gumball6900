# Property coverage

Status: current-target evidence mapped; CEX-03, SECURITY-01, and CEX-09 accepted risks recorded; CEX-10 and CEX-11 copy
remediations independently reviewed; the final Foundry, Medusa, mutation, two-wave red-team, static, integration,
pinned-fork, ABI/subgraph, web E2E, documentation, whitepaper, and provenance-comment equivalence checks passed.

Evidence is accepted only when tied to the frozen target or a recorded candidate diff. Historical parent-commit tests
are leads, not target coverage. Each critical invariant will be mapped to at least two independent mechanisms where
practical: deterministic boundary tests, stateful Foundry invariants, an independent reference model, mutation kill,
symbolic result, external fuzzer, or pinned non-broadcast fork.

The final source differs from the frozen executable target only by recorded provenance comments appended after four
closing contract braces. Independent production-profile builds confirmed identical creation/deployed bytecode, ABIs,
and storage layouts. Evidence generated before those footers therefore remains executable coverage, not a claim that
the final source-file bytes are identical.

The initial cold reviewers are not counted as executable coverage. Reachability, action-call counts, rejection rates,
seeds/corpora, and silent skips will be checked before any campaign is credited.

## Current executable evidence

| Property family                             | Evidence completed at frozen executable target or equivalent comment-only candidate                                                                                                                                                                                                                           | Independent evidence still required                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Signal principal exits                      | deterministic scalar/batch/killed-Strategy exit suites; final 16,000,000-call Foundry invariant run; Medusa exact-principal property (1,910 exits); Echidna exact-principal path (66 corpus hits); principal-return mutation killed; two final cold reviews; CEX-03 accepted with existing-subgraph discovery | deployment-time discovery operations remain separate          |
| GBX supply and Fund redemption              | deterministic boundary/adversarial suites; final Foundry supply, pending-emission, and redemption invariants; Halmos authority/supply/Fund properties; validated Medusa and Echidna campaigns; expanded mutations killed; CEX-09 accepted-risk ADR 0059; CEX-10 exact copy fix and independent review         | no further internal evidence gap recorded                     |
| Curve-derived reward accounting             | deterministic Bribe/Resonance suites; 10,000 randomized 16-36-operation cases against an independent model derived from pinned Curve logic; Halmos Bribe cap/exit proof; validated Medusa and Echidna campaigns                                                                                               | no further internal evidence gap recorded                     |
| Euler-derived auction accounting            | deterministic Mine/Strategy suites; 10,000 randomized 3-12-operation cases against an independent model derived from pinned Euler logic; explicit uint16-alias divergence; self and non-self zero-price round-trip reproductions; accepted-risk ADR 0058                                                      | retained economics explicitly accepted                        |
| Reward lifetime caps                        | deterministic cap tests; independent Bribe and Resonance cap-rejection/no-mutation differentials; Halmos Bribe cap/exit proof; validated Medusa and Echidna campaigns; cap mutations killed                                                                                                                   | no further internal evidence gap recorded                     |
| Atomic launch and ownership handoff         | deterministic local/hostile tests; exact pinned non-broadcast fork; two cold launch reviews; all launcher/deployer mutations killed                                                                                                                                                                           | production governance and deployment evidence remain separate |
| Future-Router migration and old-graph exits | deterministic migration and exitability suites; final Foundry invariants; two cold source/integration reviews; migration mutations killed; separate retained subgraph instances selected if a future cutover occurs                                                                                           | deployment runbook if governance later performs a cutover     |

The independent upstream-algorithm differential aggregate currently reports 15 passed, 0 failed, and 0 skipped: eight
fuzz properties at 10,000 runs each and seven deterministic properties. The newly added multi-operation reward and
auction campaigns contribute 20,000 randomized cases and found no mismatch beyond the two explicitly asserted desired
divergences (`1e36` reward precision and non-aliasing full-width epoch identifiers). They execute independent models
derived from the pinned algorithms, not the upstream contracts themselves.
