# Static-analysis record

Date: 2026-08-09. Raw output is under the ignored `audit/reports` directory.

## Tools actually run

| Tool              |                Version | Scope                                            | Result                                                                          |
| ----------------- | ---------------------: | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Solidity compiler | 0.8.26+commit.8a97fa7a | current Foundry graph                            | clean compile; no compiler warning                                              |
| Slither           |                 0.11.5 | Foundry graph under pinned Foundry 1.7.1         | 91 source finding records, reviewed below                                       |
| Aderyn            |                  0.6.8 | 16 production source units                       | 1 grouped high / 24 instances and 11 grouped low / 71 instances; reviewed below |
| Semgrep           |                1.162.0 | `src` and `script/minimal`, six repository rules | zero finding                                                                    |
| Solhint           |                  6.0.1 | `src` and `script/minimal`                       | zero error, 118 non-blocking warnings                                           |
| Gitleaks          |                 8.30.1 | 18-commit Git history                            | six redacted generic-key matches; gate blocked pending human disposition        |
| pnpm audit        |           pnpm 10.14.0 | complete workspace graph                         | no High or Critical after the `nanoid` 3.3.17 override                          |

The pinned tools were installed with `bash audit/install-tools.sh static`; Foundry 1.7.1 was installed in a
task-specific directory and `audit/verify-toolchain.mjs static` verified all seven pinned tools. The exact disposition
register contains 186 source instances across 24 tool/detector classes, review date 2026-08-09, and expiry
2026-08-23. New, stale, relocated, or description-changed findings fail the register check.

## Slither disposition

The three High instances are false positives: all three `weak-prng` reports are deterministic modulo operations used
for accounting carry, not randomness.

The 14 Medium instances are reviewed intentional constructs:

- three divide-before-multiply instances calculate the indexed amount after flooring and retain the remainder, or
  calculate an exact base-rate-plus-remainder stream preview;
- eight strict equalities are exact zero/index boundary checks;
- two reentrancy reports are guarded entry points using immutable or Resonance-created dependencies, with rollback
  and callback regression coverage;
- one ignored return value relies on revert semantics and independent exact balance postconditions.

The 43 Low and 31 Informational instances are bounded calls/storage operations in caller-selected or fixed-eight
loops, timestamp-based schedule/auction boundaries, post-call events, the two required EIP-1153 assembly sites, and
duplicate call-stack expansions. No credible unresolved Slither vulnerability was identified.

## Aderyn disposition

The grouped High `reentrancy-state-change` issue combines constructor initialization and nonReentrant transfer paths
in Bribe, Fundraiser, Resonance, and Strategy. Constructor external calls only validate immutable code/fixed
dependencies; runtime paths are guarded and revert atomically on any callback failure. The 11 Low groups cover the
documented timelock/factory ownership surface, fixed/caller-bounded loops, literals, local field-name shadowing,
ignored non-authoritative returns, canonical Permit2 approvals, and maintainability observations. The two redundant
statements deliberately preserve named ERC-721 receiver parameters for ABI/NatSpec clarity; manager, depositor, token,
pool, ticks, liquidity, and custody—not `operator` or `data`—authorize position admission.

## Solhint and secret scanning

Solhint's 110 warnings are style/gas suggestions: immutable naming, optional event indexing, state-count heuristics,
bounded loop writes, exact-boundary comparisons, EIP-1153 assembly, ordering, and a remapped Permit2 import. They do
not represent compiler warnings; repository lint treats them as non-blocking warnings.

Gitleaks identified six redacted historical matches in tests and public chain/deployment data. They were not
allowlisted during this campaign because broad historical exclusions could hide a real credential. A human must
classify the exact redacted fingerprints before release. No secret value is reproduced here.

`pnpm audit` initially found `GHSA-2v37-7h3g-55p8` through `postcss -> nanoid@3.3.16`. A narrow root override now pins
that edge to the patched 3.3.17 release; the resulting report contains no High or Critical advisory. Low/Moderate
advisories remain visible in the raw report and are outside the checked blocking policy.

## Unavailable checks

Mythril requires the pinned Docker image and did not run because Docker is unavailable. CodeQL was not requested by
the checked-in campaign. The complete `run-static.sh` is not a passing release gate: the source analyzers, exact
disposition register, Semgrep, compiler, sizes, storage layouts, dependency vulnerability policy, and regenerated
Darwin/Linux inventory baselines pass, but six historical Gitleaks candidates still require human classification.
The inventory policies remain `inventory-baselined`, not counsel-approved.
