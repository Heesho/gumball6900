# Generated audit evidence

Security tools write commit-specific evidence here. CI uploads the directory as an immutable workflow artifact. Raw
JSON and SARIF are intentionally not committed; the human review lives at `../FINDINGS.md`, and the exact expiring
machine disposition register lives at `../static-dispositions.json`.

Coverage and CodeQL collection use deterministic filenames: `forge-coverage.lcov`,
`forge-coverage-summary.json`, `hardhat-coverage.lcov`, `hardhat-coverage-summary.json`, and
`codeql-javascript-typescript.sarif`. CodeQL input is archived byte for byte, including when a valid finding makes the
zero-result policy fail. These files are generated, ignored evidence—not reviewed source files.

The scheduled mainnet reconnaissance job writes `nightly-mainnet/pin.json`, `assets.json`, `wrapped-btc.json`, and
`bytecode.json`. All four records are explicitly provisional and deployment-ineligible. They bind one 64-block-lagged
Robinhood mainnet observation, reconstruct the stock-token control history and WBTC bridge authority graph, reject
canonical USDG/WETH/v4 runtime drift, and feed only an ephemeral exact-block Foundry fork. A nightly artifact is not a
signed release manifest and cannot substitute for protected release authorization.

Mythril collection writes `mythril-<Contract>.json` and `mythril-<Contract>.stderr.txt` for each selected target,
`mythril-run-manifest.json` with exact exit codes and deployed-bytecode hashes, and `mythril-summary.json` with the
fail-closed policy outcome. Analysis requires constructor-resolved deployed runtime bytecode and disables onchain data,
so no compiler template, generic fixture substitution, host RPC, or Mythril configuration can change its code or state
inputs. Raw analyzer output remains present when a finding, malformed result, or analyzer error blocks the nightly job.
If an artifact retains immutable/library references or contains an opcode that pinned Mythril cannot model with Cancun
semantics, Mythril is not launched and the summary instead records template hashes, unresolved IDs/spans, opcodes, and
program counters as a compatibility blocker. Concrete runtime bytes must be bound to a reviewed deployed candidate or
its onchain code.

`tool-versions.json` records the exact verified analyzer versions, effective Foundry settings, immutable Echidna and
Mythril references, lockfile hash, and production artifact compiler versions. The verifier deletes this file before every run,
so a failed or partial verification cannot leave stale success evidence behind.
