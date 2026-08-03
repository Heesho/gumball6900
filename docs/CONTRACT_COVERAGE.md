# Contract coverage policy

Forge coverage is a regression signal, not evidence that the protocol is audited or safe for user funds. The enforced
policy is source-only and intentionally focuses on production code that can mint, burn, custody, redeem, allocate,
auction, pause, or migrate value, plus the inlined economic and launch math used by those paths.

Run the complete report and gate with:

```bash
pnpm contracts:coverage
```

To validate an existing Forge report without rerunning coverage:

```bash
pnpm contracts:coverage:check
```

After both Forge and Hardhat coverage complete, validate their LCOV shapes, copy the artifacts, and write deterministic
aggregate/per-file summaries under `packages/contracts/audit/reports/`:

```bash
pnpm --filter @gumball-6900/contracts audit:reports:coverage
```

The fixed outputs are `forge-coverage.lcov`, `forge-coverage-summary.json`, `hardhat-coverage.lcov`, and
`hardhat-coverage-summary.json`. The JSON summaries contain no timestamp or runner path; source paths are normalized and
files are sorted. The LCOV files remain the raw line/function/branch evidence with line endings normalized. CI archives
these ignored files for the exact commit alongside the other audit evidence.

The policy lives in `packages/contracts/scripts/forge-coverage-policy.mjs`. Every listed file has separate function,
branch, and line percentage floors and a minimum instrumented denominator. A missing file, malformed or truncated LCOV
record, duplicate source record, inconsistent LCOV summary, reduced denominator, or metric below its floor fails the
gate. Floors are deliberately below the last observed results so random fuzz seeds cannot create a one-hit failure;
raising them requires a fresh full Forge report. Lowering a floor or denominator is a reviewed policy change, not a
routine way to make CI green.

The refreshed 2026-08-02 baseline ran 49 Forge suites: 374 tests passed, no tests failed, and the two RPC-dependent fork
suites were explicitly skipped because their URLs were not configured. The ten invariant properties each completed
1,000 runs at depth 500, for 5,000,000 handler calls with zero reverts. Across the 32 gated files, the report records
328/331 functions (99.09%), 401/652 branches (61.50%), and 2,713/2,842 lines (95.46%). The same run completed Hardhat
coverage with 101 passing tests and one intentional compiler-parity skip because coverage instrumentation changes
bytecode. Its deterministic all-source summary records 247/356 functions, 641/2,314 branches, and 1,659/2,518 lines.
These aggregate observations are context only; Forge enforcement remains per file so strong coverage in one component
cannot conceal a regression in another. The baseline report is local engineering evidence, not an audit or a substitute
for the skipped Robinhood fork runs.

## Scope and exclusions

Forge still reports all compiled files. The gate normalizes relative and absolute paths, then considers only its exact
`src/` allowlist. This excludes:

- tests, mocks, deployment scripts, vendored dependencies, and generated output because they are not deployed protocol
  runtime code;
- `src/interfaces`, which contain no executable implementation;
- `NoopEligibilityModule`, which is restricted to local development or an explicitly approved test deployment;
- `GumBallLens`, which is a bounded read-only convenience surface and cannot move protocol or user value; and
- `HoldUSDGStrategy`, which has no custody, storage, approval, transfer, or external-call surface.

`GenesisLiquidityCalculator` remains in scope even though it is stateless because launch settlement delegates maximal
liquidity calculations to it. `RegistryEligibilityModule` remains in scope because its answers gate holding, transfers,
staking, and redemption.

## Forge instrumentation limits

Coverage describes instrumented EVM paths, not all semantic conditions. In particular:

- Solidity internal libraries are inlined. Forge currently records four `RateMath` branch entries as unhit even while
  every source line and function is exercised, so that file has a documented zero branch-percentage floor while its
  branch denominator, functions, and lines remain pinned.
- inherited logic is attributed to the defining source. Claim execution therefore accrues mainly to `ClaimsBase`,
  while `GenesisClaims` is a thin wrapper with no reported branch denominator.
- defensive reverts that are unreachable after immutable canonical wiring, and compiler-generated short-circuit paths,
  can keep branch percentages materially below line coverage. The gate uses per-file floors instead of claiming 100%
  branch completeness.
- a zero branch denominator is represented as 0%, never as an implicit pass. Only files whose policy explicitly allows
  a zero denominator can pass that state.

The report must be regenerated after relevant Solidity or test changes. A skipped RPC fork does not improve or satisfy
this offline policy, and passing the policy does not convert skipped fork evidence into a pass.
