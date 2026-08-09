# Static-analysis record

Date: 2026-08-09. Raw output is under the ignored `audit/reports` directory.

## Tools actually run

| Tool              |                Version | Scope                                     | Result                                                                          |
| ----------------- | ---------------------: | ----------------------------------------- | ------------------------------------------------------------------------------- |
| Solidity compiler | 0.8.26+commit.8a97fa7a | current Foundry graph                     | clean compile; no compiler warning                                              |
| Slither           |                 0.11.5 | Foundry graph under pinned Foundry 1.7.1  | 91 source finding records, reviewed below                                       |
| Aderyn            |                  0.6.8 | 16 production source units                | 1 grouped high / 26 instances and 10 grouped low / 69 instances; reviewed below |
| Semgrep           |                1.162.0 | current `src` graph, six repository rules | zero finding                                                                    |
| Solhint           |                  6.0.1 | current `src` graph                       | zero error, 106 non-blocking warnings                                           |
| Gitleaks          |                 8.30.1 | 19-commit Git history                     | six redacted generic-key matches; gate blocked pending human disposition        |
| pnpm audit        |           pnpm 10.14.0 | complete workspace graph                  | no High or Critical after the `nanoid` 3.3.17 override                          |

The pinned tools were installed with `bash audit/install-tools.sh static`; Foundry 1.7.1 was installed in a
task-specific directory and `audit/verify-toolchain.mjs static` verified all seven pinned tools. The exact disposition
register contains 186 source instances across 23 tool/detector classes, review date 2026-08-09, and expiry
2026-08-23. New, stale, relocated, or description-changed findings fail the register check.

The refreshed current-source Semgrep scan initially identified the `unchecked` increment block in
`Fundraiser.settleEpochs`. The audit replaced it with checked increments instead of weakening the zero-finding rule.
All 31 Fundraiser tests and the pre-ADR-0022 339-test post-fix CI/gas campaign pass; the current default campaign after
the fee-harvest redesign passes 340/340. The edit relocated one Aderyn and one Slither source-span fingerprint in that
same function; those two records were explicitly refreshed without changing their detector rationale, severity, or
review profile. Semgrep now reports zero findings.

## Slither disposition

The three High instances are false positives: all three `weak-prng` reports are deterministic modulo operations used
for accounting carry, not randomness.

The 15 Medium instances are reviewed intentional constructs:

- three divide-before-multiply instances calculate the indexed amount after flooring and retain the remainder, or
  calculate an exact base-rate-plus-remainder stream preview;
- eight strict equalities are exact zero/index boundary checks;
- two reentrancy reports are guarded entry points using immutable or Resonance-created dependencies, with rollback
  and callback regression coverage;
- two ignored return values rely on revert semantics and independent exact balance postconditions.

The 42 Low and 31 Informational instances are bounded calls/storage operations in caller-selected or fixed-eight
loops, timestamp-based schedule/auction boundaries, post-call events, the two required EIP-1153 assembly sites, and
duplicate call-stack expansions. No credible unresolved Slither vulnerability was identified.

## Aderyn disposition

The grouped High `reentrancy-state-change` issue combines constructor initialization and nonReentrant transfer paths
in Bribe, BribeRouter, Fundraiser, LiquidityPosition, Resonance, and Strategy. LiquidityPosition's constructor calls
only read the immutable router USDG and Fund GBX identities; other constructor calls validate immutable code/fixed
dependencies. Runtime paths are guarded and revert atomically on any callback failure. The 10 Low groups cover the
documented timelock/factory ownership surface, fixed/caller-bounded loops, literals, local field-name shadowing,
ignored non-authoritative returns, intentional value-type zero initialization, public monitoring APIs, and
maintainability observations. The two redundant statements deliberately preserve named ERC-721 receiver parameters
for ABI/NatSpec clarity; manager, depositor, token, pool, ticks, liquidity, and custody—not `operator` or `data`—
authorize position admission.

## Solhint and secret scanning

Solhint's 106 warnings are style/gas suggestions: immutable naming, optional event indexing, state-count heuristics,
bounded loop writes, exact-boundary comparisons, EIP-1153 assembly, ordering, and a remapped Permit2 import. They do
not represent compiler warnings; repository lint treats them as non-blocking warnings.

Gitleaks identified six redacted historical matches in tests and public chain/deployment data. They were not
allowlisted during this campaign because broad historical exclusions could hide a real credential. A human must
classify the exact redacted fingerprints before release. No secret value is reproduced here.

`pnpm audit` initially found `GHSA-2v37-7h3g-55p8` through `postcss -> nanoid@3.3.16`. A narrow root override now pins
that edge to the patched 3.3.17 release; the resulting report contains no High or Critical advisory. Low/Moderate
advisories remain visible in the raw report and are outside the checked blocking policy.

## Unavailable checks

The corrected Mythril policy enumerates the exact 12 current contracts, but the checked runner fails closed because
deployed constructor-resolved runtimes are required and Mythril 0.24.8 does not support the current Cancun opcodes.
CodeQL was not run locally; its checked PR workflow remains the external JavaScript/TypeScript analysis path. The
complete `run-static.sh` is not a passing release gate: the source analyzers, exact
disposition register, Semgrep, compiler, sizes, storage layouts, dependency vulnerability policy, and regenerated
Darwin/Linux inventory baselines pass, but six historical Gitleaks candidates still require human classification.
The inventory policies remain `inventory-baselined`, not counsel-approved.

The audit also repaired three stale assurance tests: the current Linux license-review count is 30, the expiry test now
places expiry after review and the synthetic clock after expiry, and workflow policy assertions no longer require
nonexistent analyzer/release jobs. Any workflow that later calls `audit/install-tools.sh` must resolve the analyzer
environment policy before setup-python and installation.
