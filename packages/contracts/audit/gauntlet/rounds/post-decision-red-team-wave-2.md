# Post-decision red-team wave 2

- Target: `70091b642006f0b2788bd89a6a0e734a632619cf`
- Date: 2026-08-31
- Production source changed: no
- Verdict: no new valid Medium-or-higher issue

The reviewer independently re-read the full production Solidity graph and the then-current candidate diff before the
later provenance-only footer addition, with emphasis on signal and killed-Strategy exits, Bribe and Resonance caps and
claims, Mine pending emission and miner claims, Fund redemption callbacks, Strategy settlement, ownership handoff,
Router cutover, atomic launch, CREATE2 isolation, and MEV.

No new Medium-or-higher candidate survived source reasoning. The candidate harnesses retain persistent exit-failure and
principal-mismatch flags, require all 24 successful action families plus critical economic paths, and bind credited
fuzzer results to exact property and coverage manifests. The reviewer found no materially misleading green claim.

Residual hardening ideas are test-depth improvements, not current runtime findings: add exact branch mutations for
runtime USDG-decimal rejection, candidate-Router USDG identity, Mine-held miner claims across cutover, and every
caller/domain salt component. The explicit CREATE2 address-oracle and hostile launch tests already provide independent
coverage of the collision-safety and availability boundaries.

The later four-file provenance-comment delta received a separate independent source and bytecode-equivalence review in
`post-decision-provenance-review.md`.
