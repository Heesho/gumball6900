# Convergence ledger

Status: internally converged for the current candidate's Medium-or-higher security search; not cleared for deployment,
distribution, or user funds.

- [x] Original target commit, scope, lock hash, compiler, EVM, and dirty-tree exclusions frozen.
- [x] Candidate source/test/documentation diff frozen after all confirmed fixes and accepted-risk decisions.
- [x] No open Critical or High finding.
- [x] Every Medium fixed and independently verified or explicitly accepted by the user.
- [x] Every Low and informational scanner item dispositioned.
- [x] Every critical invariant has two independent forms of evidence where practical.
- [x] Every selected security-critical mutation is killed: 115/115 across all executable production sources.
- [x] Harness-adversary review finds no unresolved vacuity or unreachable critical state in the credited Medusa and
      Echidna runs.
- [x] Two consecutive fresh red-team waves find no new valid Medium-or-higher issue.
- [x] Applicable deterministic, integration, Hardhat, simulation, ABI, static, Halmos, fuzz, mutation, launch, migration,
      ownership, and pinned-fork gates pass with no silent skip; the nightly components were rerun individually.
- [x] Documentation, implementation, tests, provenance, and supported-token assumptions agree for the current candidate.
- [ ] External governance selection, signed production manifest, license/chain-of-title disposition, deployment procedure,
      and post-deployment ownership receipts are complete.

Unavailable tooling or external evidence keeps its corresponding condition open. This internal review cannot authorize
deployment or user funds.

Internal convergence record:

1. The final 427-test Foundry rerun, validated Medusa/Echidna campaigns, 115/115 focused mutations, static register,
   integration, Hardhat parity, models, ABI/subgraph, hostile-launch, and pinned non-broadcast fork evidence passed.
2. Two consecutive post-decision red-team waves found no new valid Medium-or-higher issue. A later four-file
   provenance-comment-only diff received its own independent source and bytecode-equivalence review.
3. `CEX-03`, `SECURITY-01`, and `CEX-09` remain explicitly accepted Medium risks. `CEX-10` and `CEX-11` are copy-
   remediated and independently reviewed.

Release blockers outside this internal convergence claim:

1. Mythril 0.24.8 cannot analyze the current immutable/Cancun targets; that compatibility failure is recorded and is
   not counted as a pass. Halmos evidence covers selected symbolic properties but is not represented as Mythril parity.
2. The exact Curve/Euler lineage is documented, but chain-of-title and license compatibility remain unresolved. Source
   comments provide attribution only and do not cure that blocker.
3. External governance selection/review, a signed production manifest, deployment receipts, ownership acceptances, and
   operational discovery configuration do not yet exist. The fail-closed production gates therefore remain expected.
4. This repository-internal review is not an independent third-party audit and does not authorize deployment or user
   funds.
