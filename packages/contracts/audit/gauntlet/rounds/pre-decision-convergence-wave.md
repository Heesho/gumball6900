# Pre-decision convergence wave

- Target: `70091b642006f0b2788bd89a6a0e734a632619cf`
- Date: 2026-08-31
- Production source changed: no
- Convergence credit: no; two Medium design decisions remain open

## Independent review disposition

Fresh full-system, exit/privilege, token/reentrancy, economic/accounting, integration, harness-adversary, and focused
design reviewers independently converged on two Medium findings:

1. Historical `CEX-03` remains open. A known live or killed Strategy key has a bounded scalar exit, but neither the
   core nor stateless Lens can enumerate an account's unknown Strategy keys from bounded current state. The current
   subgraph is also static to the original Resonance/SignalGBX graph and does not index replacement-graph positions.
2. New `SECURITY-01` is a repeatable zero-cost Strategy acquisition-liveness grief. A helper can take a mature
   zero-price fill, allow the epoch to reset to `minimumPrice`, and return the freely transferable USDG after `buy`
   unlocks. Receiver-identity checks do not remediate it.

No other new Medium-or-higher candidate survived executable reproduction and manual triage. The deterministic
launcher Pair-precreation/prefund censorship behavior was independently revalidated as the already documented,
explicit create-only deployment-availability risk rather than a new count.

## Evidence completed before the decisions

- Clean full-system Foundry: 393/393 across 30 suites; 30 invariants each ran 1,000 runs by 500 calls with zero handler
  reverts; total duration 936.19 seconds.
- Hardhat: 4/4 with Foundry bytecode parity.
- Fresh Medusa 1.5.1: 100,485 calls, 27/27 properties, 74 tests, zero failures, all 24 actions reached, 1,899 exact-
  principal signal exits, and a passing strict LCOV/receipt checker.
- Fresh native Echidna 2.3.2 text campaign: 100,100 calls at seed 6900, 27/27 properties, 36,407 unique instructions,
  14 code hashes, 40 retained sequences, all 24 action families covered, 73 signal-exit executions, 66 exact-principal
  comparisons, 27 positive-price payment classifications, and a passing strict receipt/LCOV checker.
- Mutation: 115/115 test-killed across all 17 executable production Solidity files, with eight ABI-only interfaces
  excluded by fail-closed policy.
- Halmos: eight exact properties, 117 explored paths, no counterexample or timeout in the accepted composite receipt.
- Upstream-algorithm differential: 15/15, including 10,000 randomized Curve cases of 16-36 operations and 10,000
  randomized Euler cases of 3-12 operations. The independent models are derived from pinned upstream algorithms; the
  tests do not execute upstream contract bytecode.
- Static analysis: all 85 Slither and 63 Aderyn instances dispositioned; Semgrep assembly/SARIF policy, Gitleaks,
  dependency, and license gates passed.
- Robinhood pinned non-broadcast fork: block 50,445,120, 1/1 pass, `GBXLauncher.launch` gas 23,437,200.
- Integration: SDK 55/55, config 115/115, subgraph specification 5/5 and Matchstick 11/11; production subgraph and
  current manifest validation fail closed because canonical addresses/governance are unresolved.

The earlier Echidna JSON run remains excluded because Echidna 2.3.2 emitted placeholder property entries despite exit
zero. The fresh text-mode campaign above replaces it as current-target evidence; another fresh run remains required
after the production/accepted-risk decisions. Mythril cannot resolve this immutable/Cancun graph and is recorded as an
unsupported-tool blocker, not a pass.

## Required sequence

Review the two Mediums one at a time. Decide `CEX-03` first because it controls the strength of the principal-recovery
claim. Then decide `SECURITY-01`. Apply no production change without a user-approved ADR. After either fixes or explicit
accepted-risk records, rerun every affected deterministic, invariant, differential, mutation, external-fuzzer,
integration, documentation, and fork gate, followed by two fresh post-decision red-team waves.
