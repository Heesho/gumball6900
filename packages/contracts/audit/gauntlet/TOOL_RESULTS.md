# Tool and test results

## Environment

- Frozen install: `pnpm install --frozen-lockfile` under Node 22.23.1 and pnpm 10.14.0 passed; the lockfile was already
  current.
- Foundry: 1.7.1; Solidity: 0.8.26; EVM: Cancun; optimizer: 10,000 runs; no IR.
- Local interactive shell defaulted to Node 20.19.6 and is not used for recorded JavaScript gates.

## Initial baseline

- `forge fmt --check`: passed.
- `forge build --sizes`: passed; `GBXLauncher` runtime is 23,471 bytes, 1,105 bytes below EIP-170.
- `FOUNDRY_PROFILE=ci forge test`: passed in 997.44 seconds. Forge reported 30 suites, 393 passed, 0 failed, and
  0 skipped. The stateful suite ran 1,000 runs with 500 calls per run for every invariant (15,000,000 handler calls
  across 30 invariant properties), with zero handler reverts or discards; the invariant suite itself reported 32
  passed, 0 failed, and 0 skipped.
- The final post-decision candidate rerun passed in 923.79 seconds: 40 suites, 427 passed, 0 failed, and 0 skipped.
  Its stateful suite ran 32 properties with 1,000 runs and 500 calls per run (16,000,000 handler calls), with zero
  handler reverts or discards. That executable candidate was byte-for-byte equal to the frozen target; four later
  source-footer provenance comments were separately proved to leave creation and deployed bytecode unchanged.
- `FOUNDRY_PROFILE=integration forge test -vv`: passed; 10 passed, 0 failed, 0 skipped, including 256 randomized
  twelve-action campaign sequences and explicit action/property reachability checks.
- `pnpm --filter @gumball-6900/contracts test:hardhat` under Node 22.23.1: passed; Forge compilation succeeded and
  Hardhat reported 4 passed, including byte-for-byte Foundry/Hardhat compiler parity for every deployable protocol
  source and mining-authority integrity checks. The emitted Forge lint warnings were inspected; production warnings
  were the intentional timestamp-based auction/stream comparisons, while unchecked-transfer warnings were confined
  to tests.
- The repository's Darwin engineering fallback installed the exact static-tool lock into
  `/tmp/gumball6900-audit-tools`: Slither 0.11.5, Aderyn 0.6.8, Semgrep 1.162.0, and Gitleaks 8.30.1.
- `node audit/verify-toolchain.mjs static` then passed and recorded seven exact tools and 28 compiler artifacts.
- The full shared-working-tree `pnpm format:check` remains red only on five pre-existing, unmodified tracked files
  (`SpecimenDriver.tsx`, three landing model/library files, and `pnpm-lock.yaml`) plus three excluded untracked raw/media
  artifacts. Every staged Prettier-supported file passed a scoped check, `forge fmt --check` passed, and no reported
  full-tree formatting path is included in this candidate.

Executable production Solidity remains equal to the frozen target. `Bribe.sol`, `Resonance.sol`, `Strategy.sol`, and
`Mine.sol` gained only provenance comments after their closing contract braces. Independent pre/post builds found
byte-for-byte-equal creation bytecode, deployed bytecode, ABIs, and storage layouts. The deployed-bytecode text hashes
were identical before and after: Bribe `7f590b8c586bed059d2dbf1b6bf7a016b60ee119de56f9bf40afe0ef11be74e4`,
Resonance `277958d6e14349f6e40624b86500325959de46f6efbc138a4a0e589ee91e96de`, Strategy
`743897e6e5dc828905fab245dc2754b9842a85b26275e11a5857dd19beb1f0d6`, and Mine
`a0c25e4949cc6b3351e2fc1d70dae179e0e8a9b8b56d9ffbc637b28166f33816`. These are SHA-256 hashes of the
`0x`-prefixed deployed-bytecode text plus its trailing newline, not onchain `extcodehash` values. All other production
changes made by this gauntlet are audit harnesses, tests, policies, and evidence.

## Static analysis

- Semgrep's generic Solidity scan completed without parser warnings. Its two exact Fund transient-storage assembly
  locations match the reviewed allowlist; the SARIF checker rejects any new or moved assembly location.
- Gitleaks scanned 80 commits and approximately 26.6 MB without reporting a secret.
- The dependency high/critical audit passed and the Darwin license inventory matched its reviewed graph.
- Aderyn analyzed 25 source units / 1,873 SLOC and emitted 63 exact instances: 18 High-category and 45 Low-category.
  Every instance was manually dispositioned against current source; detector labels were not treated as security
  severities.
- Slither's first post-install attempt is invalid evidence: a new audit reproduction source appeared while Slither was
  compiling, and Slither reported an out-of-sync source/build snapshot.
- The frozen-target Slither 0.11.5 run in a detached exact-HEAD worktree completed successfully over 165 contracts with 101
  detectors. The JSON has `success: true` and 85 results: 32 Medium, 47 Low, and six Informational. Its SHA-256 is
  `55c1f0479f68e57e44452249a1b96bf0a1f934293d8d27c73924880855221807`. Every result was manually dispositioned. The
  nonzero Slither process status reflects detector results, not failed compilation or malformed output.
- The hardened static register contains 148 exact Slither/Aderyn instances. Its policy tests reject new, moved,
  disappeared, expired, malformed, or incompletely reviewed findings.
- The final `run-static.sh` gate exited zero on the provenance-comment candidate: all 148 Slither/Aderyn instances and
  both reviewed Semgrep results matched their exact registers, Gitleaks found no secret across 80 commits, dependency
  audit found no High/Critical advisory record, and the installed Darwin license graph matched its reviewed inventory.
  The runner was corrected to distinguish Semgrep's finding exit `1` from operational exits greater than `1`; a finding
  exit is accepted only when the fresh SARIF is structurally successful and exactly matches the reviewed result policy.
  The final candidate's successful 85-result Slither JSON has SHA-256
  `2d3c54e66d9b80a7c0c7b6cb8e084b4d5c40e3b769d17ed3d9916084d9906504`.

## Generated consumers and economic models

- The final repository `pnpm test` gate passed all nine package tasks. Its contract phase repeated 40 suites and
  427/427 Foundry tests, including 16,000,000 invariant handler calls with zero reverts or discards; SDK, config, web,
  UI, subgraph, and simulation tests also passed under the pinned Node/Python environments.
- `pnpm sdk:abi:check` under Node 22.23.1 passed.
- SDK typecheck and 55/55 tests passed; config typecheck and 115/115 tests passed.
- `pnpm subgraph:abi:check` passed after the exact Foundry binary was added to the task PATH: nine checked-in protocol
  ABIs matched current artifacts.
- `pnpm subgraph:build` passed; specification coverage reported five required entities, one reviewed extension, and
  30 manifest/mapping handlers.
- `pnpm subgraph:test` passed: five specification tests and eleven Matchstick tests.
- The ordinary placeholder subgraph build is development-only. `subgraph build:production` correctly failed at the
  zero GBX placeholder, and `config:manifest:validate` correctly failed because no reviewed current governance/manifest
  exists. These are expected fail-closed release gates, not deployment evidence.
- `pnpm simulations:test` passed under isolated Python 3.11.14 with all five locked dependencies matching the
  repository policy: 28 TypeScript tests, five Python-environment tests, and 22 Python model tests. Both independent
  model/fixture comparisons and deterministic SVG chart checks passed.
- `pnpm web:test:e2e` passed 36/36 Chromium and mobile-Chromium tests. Contract documentation generation/checking
  passed, and the canonical whitepaper build passed 64 contract/fixture fact checks and produced the retained 10-page
  PDF from `docs/WHITEPAPER.md`.
- Earlier simulation and subgraph ABI attempts under incomplete PATHs are environment non-runs: they selected macOS
  Python 3.9 or could not locate `forge`. They are not model or ABI failures.

## External and symbolic engines

- Exact native tools are available in the isolated audit environment: Echidna 2.3.2, Medusa 1.5.1, Mythril 0.24.8,
  and Halmos 0.3.3. The Echidna macOS arm64 release archive matched upstream SHA-256
  `5a78064885d90e76d75a3eb0e576c39dd1651cc5080414ed88f60160cd5617e2`.
- Halmos 0.3.3 proved eight exact properties over 117 explored paths with no counterexample or timeout in the accepted
  composite receipt: permanent GBX minter authority, supply reconciliation, unauthorized-mint rollback, two Fund
  payout/floor properties, Strategy price monotonicity/reset bounds, and Bribe cap-failure/exit atomicity. Five Forge
  symbolic companion tests also passed. Two earlier broader nonlinear queries timed out and are not counted.
- The repository's fail-closed Mythril runner did not start symbolic exploration. It correctly rejected unresolved
  constructor immutables for nine targets and unsupported Cancun runtime opcodes (`MCOPY` in GBX/SignalGBX and
  `TLOAD`/`TSTORE` in Fund). This is a compatibility blocker, not a pass or finding.
- Medusa 1.5.1 completed a final-tree metadata-bound campaign: 101,306 stateful calls, all 27 properties, 74 total
  tests, zero failures, and all 24 action-completion markers covered. Signal exits and exact-principal comparisons each
  ran 1,910 times; positive-price Strategy classification ran 49 times; successful dynamic Strategy addition ran 676
  times. The fail-closed receipt/LCOV checker passed. The output SHA-256 is
  `93dc6793c18f1900703dd10a5cdc99520b560eb177e53a5ff229f2d8bc2fc571`; the LCOV SHA-256 is
  `31dc194aa75cbed48265949174a847f95b2e3528af96d81728106d937943aa45`.
- The earlier Echidna 2.3.2 JSON campaign is invalid evidence: it emitted 27 placeholder entries with `tests: 0/27`
  despite reaching the call limit and exiting zero. It remains excluded. A fresh native text-mode campaign completed
  100,100 calls at seed 6900 with all 27 exact properties passing, 36,407 unique instructions, 14 code hashes, and a
  40-sequence corpus. The hardened receipt/LCOV checker accepted all 24 successful action families and independently
  required positive-price Strategy payment classification, signal-exit execution, and exact-principal comparison;
  their corpus LCOV counts were 27, 73, and 66. Receipt SHA-256 is
  `0b9223bc36513a195cf729f6c0547ecdc42076fd91e606ab2e52a9ebf248a69d`; LCOV SHA-256 is
  `de1fb8b2fba0547afb225e2bd4b1bd7ca09317a85a722e80e3081eaff6579137`.

## Differential and mutation campaigns

- The upstream-algorithm differential aggregate passed 15/15: eight fuzz properties at 10,000 runs and seven
  deterministic properties. The Curve campaign executes 10,000 randomized cases of 16-36 operations, and the Euler
  campaign executes 10,000 randomized cases of 3-12 operations. These tests use independent models derived from the
  pinned upstream algorithms; they do not deploy or execute the upstream contracts. The only differences are the
  explicitly intended `1e36` precision and full-width epoch non-aliasing.
- The expanded mutation campaign covers all 17 executable production Solidity files with 115 operators; eight ABI-only
  interfaces are explicitly excluded. The fresh baseline passed, every mutant compiled, every kill names an executed
  failing test, and 115/115 were test-killed with zero survivors. Both aggregate JSON receipts have SHA-256
  `0b0947fe89bb08c1e6beedbc38519048615b3c037b764e882f76d193bb59d918`.

## Final independent red-team waves

- Post-decision wave 1 independently re-read all 25 production Solidity files and the then-current pre-footer candidate
  audit/test/documentation diff. It found no new valid Medium-or-higher issue, confirmed production Solidity was
  unchanged at that point, and identified the stale Medusa/mutation receipts and differential-count wording corrected
  by the final reruns and this record.
- Post-decision wave 2 independently re-read the complete production graph and then-current pre-footer candidate diff with exitability,
  accounting, privilege, deployment, CREATE2, and MEV emphasis. It found no new valid Medium-or-higher issue and no
  materially misleading green claim. The accepted Mediums remain `CEX-03`, `SECURITY-01`, and `CEX-09`; `CEX-10` and
  `CEX-11` remain copy-only remediations.
- A final independent review of the four provenance footers fetched both pinned upstream sources, confirmed the narrow
  Curve/Euler attribution boundaries and no-inherited-assurance language, and independently compared pre/post creation
  bytecode, deployed bytecode, ABIs, and storage layouts. No issue or executable change was found. The existing
  chain-of-title and license disposition remains a release blocker; attribution comments do not resolve it.

## Pinned launcher fork

- Command: `FOUNDRY_PROFILE=launcher_fork forge test --fork-url https://rpc.mainnet.chain.robinhood.com
--fork-block-number 50445120 --match-contract GBXLauncherForkTest -vv`.
- Pinned block: `50,445,120`, hash
  `0xa960081c52917e07263d9a208e80bfdfcb9837b0087174f1f263d73817cb7a6c`.
- Result: 1 passed, 0 failed, 0 skipped. Recorded `GBXLauncher.launch` gas: `23,437,200`.
- This is a non-broadcast fork result. It is not a deployment, code-provenance approval, or release authorization.

## Current blockers and findings

- `CEX-03` remains a confirmed Medium under the bounded-current-state exit requirement and was explicitly accepted by
  the maintainer on 2026-08-31 with no core change. A known Strategy key always has a bounded scalar exit, but unknown
  keys depend on authenticated event history. The existing subgraph is the selected replaceable discovery layer for the
  initial graph. If governance later performs a Mine Router cutover, keep the old endpoint and deploy another subgraph
  instance for the new graph. A single multi-graph index and raw-RPC recovery remain optional resilience work and do not
  close the finding.
- `SECURITY-01` is a confirmed Medium acquisition-liveness grief explicitly accepted by the maintainer on 2026-08-31
  as intended Euler Fee Flow-shaped behavior, with no code change under ADR 0058. At a zero Strategy price, a helper can
  receive the complete USDG inventory, let `buy` reset the next epoch to `minimumPrice`, and return the freely
  transferable USDG in the same outer transaction without GBX or allowance. The 2/2 executable reproduction passed.
  It does not block signal exits or Fund redemption, and a buyer paying the reset floor can clear immediately. Upstream
  lineage informs the economic decision but does not transfer audit assurance to GumBall's composition.
- `CEX-09` is a confirmed Medium product-claim mismatch explicitly accepted by the maintainer on 2026-08-31 with no
  Fund or copy change under ADR 0059. Interfaces may select every discovered asset, but the registry-free Fund cannot
  attest completeness, omitted shares are permanently forfeited, and arbitrage profitability or gap closure remains
  non-guaranteed. The retained wording is not audit-validated as a contract guarantee.
- `CEX-10` was a confirmed Medium launch-supply copy mismatch. The maintainer selected keeping **No premint** with the
  precise ADR 0060 meaning: no insider or discretionary allocation, constructor-zero supply, a fixed 1,000 GBX issue
  solely into permanently locked genesis liquidity, and mining for every subsequent GBX. The approved six-file patch
  was applied byte-for-byte before the later approved document consolidation retired the deck. The active websites and
  canonical whitepaper retain the corrected disclosure. It passed 32 web tests, typecheck, production build,
  formatting, three focused onchain supply tests, stale-consumer search, and a fresh independent read-only review. It
  is not published.
- `CEX-11` was a confirmed Medium authority-copy mismatch. The maintainer approved a copy-only correction, and the
  three components now disclose Mine plus Resonance, five continuing custom actions, two `Ownable2Step` roles, and the
  unselected external executor. Landing/web tests, typechecks, builds, formatting, stale-claim search, and a fresh
  independent read-only review passed. No executable production Solidity changed.
- The deterministic CREATE2 Pair-precreation/prefund censorship behavior was independently revalidated as the already
  documented launcher availability risk. It remains governed by the explicit create-only/no-adoption design and is not
  counted as a new current finding.
