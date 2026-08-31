# Halmos symbolic campaign — current frozen target

## Target and tooling

- Production target: `70091b642006f0b2788bd89a6a0e734a632619cf`
- Production Solidity edits: none
- Audit-only harness:
  `test/minimal/audit-gauntlet/SymbolicCoreProperties.t.sol`
- Harness SHA-256: `1e6acf567fea4b5ca52a5a8b06c6325f86d29f99eb18db6b5cef0e8ba2434f69`
- Halmos: `0.3.3`
- Solver: Yices `2.6.4`
- Forge: `1.7.1` (`4072e48705af9d93e3c0f6e29e93b5e9a40caed8`)
- Solidity: `0.8.26`, legacy pipeline, Cancun, optimizer `10_000`

The harness deploys the actual production `GBX`, `Strategy`, `Fund`, and `Bribe` contracts. Small test-only facades
provide the minimum Mine/Resonance identity selectors those contracts require, so these are focused component proofs,
not a symbolic execution of the complete launcher-created graph.

## Deterministic execution

Command:

```bash
forge fmt --check test/minimal/audit-gauntlet/SymbolicCoreProperties.t.sol
forge test --match-path 'test/minimal/audit-gauntlet/SymbolicCoreProperties.t.sol' -vv
```

Result: format passed and `5/5` concrete companion tests passed across four suites. No production file changed.

## Composite symbolic execution

Command:

```bash
forge build --ast --out out/halmos-gauntlet --force
/tmp/gumball6900-audit-tools/bin/halmos \
  --root . \
  --forge-build-out out/halmos-gauntlet \
  --match-contract '^Symbolic(GBX|Strategy|Fund|BribeCap)Properties$' \
  --function check_ \
  --solver yices \
  --solver-timeout-branching 10ms \
  --solver-timeout-assertion 60s \
  --statistics \
  --no-status \
  --json-output audit/gauntlet/artifacts/halmos/current-composite.json
```

Result: `8/8` symbolic properties passed, `0` failed, `117` total explored paths, no counterexample models, no timed-out
property, and no loop-unrolling bound. The ignored raw composite receipt has SHA-256
`06b2088cbb6fe9df11b9d615560ea94e1e6094f274e2806cc6eea33194691516`.

| Property                                      | Symbolic domain                                                                 | Paths | Result |
| --------------------------------------------- | ------------------------------------------------------------------------------- | ----: | ------ |
| `check_gbxSupplyReconciles`                   | two `uint64` mints and one affordable `uint64` burn                             |     8 | pass   |
| `check_gbxUnauthorizedMintHasNoEffect`        | arbitrary receiver and `uint128` amount                                         |     3 | pass   |
| `check_gbxLockedMinterCannotBeReplaced`       | arbitrary candidate address                                                     |     2 | pass   |
| `check_strategyPriceMonotonic`                | two ordered `uint16` offsets within two fixed epoch durations                   |    28 | pass   |
| `check_strategyBuyResetsWithinBounds`         | `uint16` elapsed time within two epoch durations and nonzero `uint32` inventory |    38 | pass   |
| `check_fundPayoutBoundedAndConserved`         | four `uint8` supply, burn, pending-emission, and backing dimensions             |    11 | pass   |
| `check_fundPayoutMatchesRationalFloor`        | all 256 nonzero burn amounts against an independent fixed ratio                 |    25 | pass   |
| `check_bribeCapFailureIsAtomicAndExitRemains` | every duration-valid `REWARD_DURATION + uint64` request                         |     2 | pass   |

The Fund rational-floor property does not copy `Math.mulDiv`: it proves the actual transfer is the unique integer
`payout` satisfying `payout * denominator <= numerator < (payout + 1) * denominator`.

The Bribe cap property saturates the actual lifetime counter, submits an arbitrary duration-valid excess notification,
checks every stream/custody/counter field is unchanged after rejection, and then removes the account's complete signal
weight. This directly covers the exit-liveness requirement at cap exhaustion for the focused Bribe state.

## Failed-closed attempts and refinement

The first Fund query made supply, burn, pending emission, and backing all `uint32` while also asking Yices to prove both
nonlinear exact-floor inequalities. Halmos explored 31 paths, then returned `TIMEOUT` after `90.96s`. Narrowing all four
variables to `uint8` still returned `TIMEOUT` after 25 paths and `90.92s`. Those results are retained in the ignored raw
receipts `fund-payout.json` and `fund-payout-u8.json`; neither is counted as a pass.

The final campaign split the question without weakening the stated scopes:

1. four independently symbolic `uint8` dimensions prove payout boundedness, selected-asset conservation, and GBX burn
   reconciliation; and
2. a separate `uint8` proof enumerates every nonzero burn amount for exact rational-floor semantics while holding the
   independent minted supply, pending emission, and backing constants fixed.

Both refined properties terminated without a counterexample or solver timeout.

## Limits

- This is bounded symbolic evidence, not whole-protocol formal verification or a proof over every 256-bit combination.
- Strategy uses one valid fixed configuration, a zero automatic-Bribe share, standard mock ERC-20s, and one purchase.
  It does not cover reentrant or nonstandard payment/revenue tokens, arbitrary configurations, or multi-epoch MEV.
- Fund conservation spans four one-byte dimensions. Exact floor spans every one-byte burn amount for one fixed ratio;
  the four-variable nonlinear exact-floor query remains an explicit solver limitation.
- Bribe is examined at a fully saturated lifetime cap in the same timestamp, with one reward token and one signaler.
  Other reward stream sequences remain fuzz/invariant/differential territory.
- Halmos warned that stale integration-profile artifacts lacked AST fields and skipped those unrelated artifacts. The
  exact selected minimal-test contracts loaded and all eight selected properties executed; this result does not cover
  the skipped integration harness.
- A pass means Halmos/Yices found no reachable assertion violation in the declared bounded domain. It does not imply
  deployment, release, legal, economic, or complete-system clearance.
