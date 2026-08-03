# Contract security tooling

`toolchain.lock` pins every external analyzer used by CI. `install-tools.sh` installs isolated Linux x86_64 or Darwin
arm64 binaries, verifies the Aderyn and Gitleaks release checksums, and pulls Echidna and Mythril by immutable image
digest. It
never installs or deploys contracts. Pass `static` for PR tooling or `nightly` for the complete campaign toolchain.
Both runners call `verify-toolchain.mjs` before analysis and after compilation. The verifier checks exact tool versions,
effective Foundry compiler/EVM/optimizer settings, production artifact compiler metadata, and—for nightly runs—the
digest and runtime version of both analyzer containers. It writes deterministic `reports/tool-versions.json` evidence and
removes stale evidence whenever verification fails.

Slither and Semgrep use checked-in, hash-complete Linux x64/Python 3.10.20 wheel locks. Mythril 0.24.8 cannot satisfy a
wheel-only Python policy because its official distribution graph contains source-only releases, so nightly CI uses the
official image pinned to its linux/amd64 manifest digest. `generate-analyzer-locks.sh` downloads a checksum-pinned uv
release, resolves against a fixed package-publication cutoff, and either refreshes the two requirements files or checks
their exact bytes with `--check`. Readiness reads the two fixed regular-file paths from the exact tracked checkout,
recomputes each raw-file SHA-256, and validates the immutable Mythril image binding. The installer verifies the exact
Linux x64 Python runtime before creating isolated environments with pip `--require-hashes`, `--only-binary`, and no
unbound PEP 517 build environment.

The checked-in policy state is `dependencies-prepared`: the dependency inputs are hermetic, but release eligibility
remains false until an independent reviewer supplies valid review metadata and promotes the state to `configured`.
Repository-generated lock files do not self-approve that review boundary. The pipx path is restricted to the legacy
explicit non-hermetic engineering state or the labeled Darwin arm64 engineering fallback and can never satisfy release
readiness. Linux x64 CI is the only release analyzer platform; Darwin nightly runs still use the digest-pinned Mythril
container.

Run the fast evidence suite after installing the pinned tools:

```bash
pnpm --filter @gumball-6900/contracts audit:static
```

The nightly suite adds independent 100,000-call Echidna and Medusa runs against the cheatcode-free
`ProtocolStateMachineCampaign`, plus bounded Mythril analysis:

```bash
pnpm --filter @gumball-6900/contracts audit:nightly
```

`mythril-policy.json` fixes the five selected bytecode targets, deployed-runtime input mode, bounded analysis parameters,
and a zero-findings policy. The nightly runner records each target's original process exit code and preserves stdout and
stderr separately before applying the policy. `check-mythril-findings.mjs` recomputes every deployed-bytecode hash from
the fresh Foundry artifact and invokes Mythril's explicit runtime-bytecode mode with onchain data disabled, so the run is
offline and cannot inherit mutable Ethereum RPC state from a host Mythril configuration. Compiler runtime templates
with unresolved library links or constructor immutables are rejected: exact evidence requires constructor-resolved
runtime bytes bound to a reviewed deployed candidate or its onchain code, never generic fixture substitutions. Before
launch the checker also decodes the exact runtime instruction stream while skipping PUSH data and rejects Cancun opcodes
that pinned Mythril 0.24.8 would misinterpret or treat as invalid. A compatibility failure records template hashes,
unresolved IDs/spans, opcodes, and program counters in the failure summary instead of creating a false clean report. For
compatible bytecode, the checker rejects malformed or error-bearing JSONV2 even when Mythril exits zero and checks that
clean reports exit zero while finding reports exit one. The run manifest and success or failure summary are archived
with the raw reports.

Raw JSON, SARIF, logs, storage layouts, size reports, dependency findings, licenses, corpora, and symbolic-execution
results are written to `audit/reports/`. Generated reports are ignored by Git because CI archives them for the exact
commit. Slither scans all severities across production contracts and Foundry deployment scripts; Aderyn independently
scans the production source tree. `FINDINGS.md` records the human review, while `static-dispositions.json` binds every
current Slither and Aderyn finding to its exact detector, severity, source span, description hash, reviewed rationale
class, internal reviewer, impact/exploitability profile, affected assumptions, controls, re-review trigger, review date,
and expiry. The static suite fails on new, removed, moved, malformed, stale-review, or expired findings. Refreshing that
machine register is a review action, not a suppression mechanism:

```bash
node audit/check-static-findings.mjs --update \
  audit/static-dispositions.json audit/reports/slither.json audit/reports/aderyn.json
git diff -- audit/static-dispositions.json audit/FINDINGS.md
```

Dependency-license drift has a separate fail-closed register. `dependency-license-inventory.json` records the full
generated Linux x64 release graph; suffixed Darwin arm64 inventory/policy files provide local engineering evidence.
`run-static.sh` regenerates the current platform inventory from the installed frozen graph. Each review policy binds the
exact inventory, platform, workspace configuration, and lockfile hashes. The checker recomputes all entry/group/review
digests and requires one exact disposition for every unknown, copyleft, or conservatively restricted entry; changed or
falsified hashes, missing/new/stale/duplicate entries, classification drift, future review dates, and
placeholder/nonapproval rationale fail. The current
`inventory-baselined` state records every entry as `needs-counsel`/`undetermined`, so engineering/static checks remain
useful without fabricating a distribution approval. Release readiness separately requires an `approved` policy and no
unresolved or blocking release-relevant disposition. See `docs/DEPENDENCY_SECURITY.md`; do not convert the baseline into
approval merely to make a release check pass.

CI normalizes coverage and CodeQL evidence into fixed names in the same directory:

- `forge-coverage.lcov` and `forge-coverage-summary.json`;
- `hardhat-coverage.lcov` and `hardhat-coverage-summary.json`; and
- `codeql-javascript-typescript.sarif`.

After Forge and Hardhat coverage have run, archive and validate both reports without rerunning either suite:

```bash
pnpm --filter @gumball-6900/contracts audit:reports:coverage
```

The CodeQL workflow saves the action's post-processed SARIF while `upload: always` independently preserves the normal
GitHub code-scanning upload. The archive script requires the single JavaScript/TypeScript SARIF expected from the action,
rejects malformed or non-CodeQL runs and results, and preserves valid input byte for byte under the fixed filename. A
valid report is archived before the zero-result policy is applied so a finding remains available as raw evidence, but
any result fails both PR and release workflows because no CodeQL findings are currently accepted. The archive never
substitutes for, post-processes, or re-uploads the CodeQL result. Local fixture tests exercise the checker, failure paths,
and byte-preserving archive without requiring the CodeQL runtime:

```bash
pnpm --filter @gumball-6900/contracts audit:reports:test
```

Secret scanning always uses the repository-root `.gitleaks.toml`. Its allowlist is limited to installed dependencies
and reproducible generated output; authored source, configuration, scripts, and documentation remain in scope. When a
Git `HEAD` exists, `run-static.sh` scans committed history with `gitleaks git`, so release evidence must come from a
clean candidate checkout. Before the first commit it falls back to `gitleaks dir` and scans only the current working
tree; that fallback is useful local evidence but does not satisfy the release provenance or history-scan gate.

The campaign's exact actions, properties, production-contract coverage, ghost counters, and deliberate model limits
are recorded in [`EXTERNAL_FUZZING.md`](./EXTERNAL_FUZZING.md). `run-nightly.sh` first runs a deterministic campaign
smoke sequence and a target-wiring test so neither fuzzer can silently regress to the legacy supply-only harness.
