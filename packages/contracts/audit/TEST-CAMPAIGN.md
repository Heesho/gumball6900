# Adversarial-audit test campaign

Date: 2026-08-09

Reviewed candidate: `54e3f2c3ce1de25aea4da2f21fab27804a3bfa84`

Audit branch: `codex/gumball-adversarial-audit`

This is reproducible internal engineering evidence. It is not an independent audit, formal verification, legal
approval, deployment authorization, or a claim that the protocol is safe for unlimited value.

## Toolchain

| Tool     | Version/configuration                                               |
| -------- | ------------------------------------------------------------------- |
| Node     | 22.23.1                                                             |
| pnpm     | 10.14.0                                                             |
| Foundry  | 1.7.1, commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`            |
| Solidity | 0.8.26, Cancun, optimizer 10,000, legacy pipeline, no metadata hash |
| Hardhat  | 2.29.0                                                              |
| Slither  | 0.11.5                                                              |
| Aderyn   | 0.6.8                                                               |
| Semgrep  | 1.162.0                                                             |
| Solhint  | 6.0.1                                                               |
| Gitleaks | 8.30.1                                                              |
| Medusa   | 1.5.1                                                               |
| Echidna  | pinned 2.3.2 container; native fallback 2.3.3                       |
| Mythril  | pinned 0.24.8                                                       |
| Mutation | no current pinned framework/configuration                           |

Package commands used the repository Node binary. Foundry commands used the audit-local exact 1.7.1 binaries whose
release archive and binary SHA-256 values were checked against the upstream sigstore attestation.

## Foundry and Hardhat

Commands executed include:

```bash
forge fmt --check
forge build --sizes
forge test --summary
FOUNDRY_PROFILE=ci pnpm --filter @gumball-6900/contracts test:gas
FOUNDRY_PROFILE=integration forge test --summary
pnpm test:hardhat
forge test --match-contract SignalGasTest -vv
```

| Campaign              | Actual result                                        |
| --------------------- | ---------------------------------------------------- |
| Default/root Foundry  | 340 passed, 0 failed, 0 skipped                      |
| CI profile + gas      | 339 passed before ADR 0022; measured paths unchanged |
| Integration profile   | 17 passed, 0 failed, 0 skipped                       |
| Hardhat parity/supply | 2 passed, 0 failed                                   |
| Signal gas suite      | 4 passed, 0 failed                                   |
| Production sizes      | all runtime/initcode below EIP-170/EIP-3860 ceilings |

The default suite contains 27 ordinary `testFuzz_` properties. Each completed 10,000 runs: 270,000 configured fuzz
cases. Foundry did not print its automatically selected seed for a passing campaign, so no seed is invented.

The invariant suite contains 27 `invariant_` properties plus one deterministic handler-reachability test. Every
property completed 1,000 runs at depth 500 with `fail_on_revert = true`: 500,000 calls per property and 13,500,000
aggregate state-machine calls. The handler exposes 22 actions; the reachability regression prevents a permanently
short-circuited action from creating false confidence. The checked nightly profile remains 100,000 fuzz runs and
10,000 invariant runs at depth 1,000; it was not completed and is not counted as passing.

The final CI/gas run reported the same deterministic 500,000-call action sequence for each invariant property:

| Handler action         |       Calls |
| ---------------------- | ----------: |
| `addSignal`            |      22,733 |
| `addSignalMany`        |      22,669 |
| `advanceTime`          |      22,527 |
| `burnFundGBX`          |      22,845 |
| `buy`                  |      22,757 |
| `claimEmission`        |      22,604 |
| `claimRewards`         |      22,629 |
| `claimSelectiveReward` |      22,770 |
| `contribute`           |      22,812 |
| `distributeAll`        |      22,755 |
| `donateDirectRevenue`  |      22,901 |
| `donateRevenue`        |      23,003 |
| `killStrategy`         |      22,526 |
| `notifyTinyReward`     |      22,663 |
| `payFixedLiabilities`  |      22,782 |
| `recordRevenueIndex`   |      22,587 |
| `redeem`               |      22,753 |
| `removeSignal`         |      22,783 |
| `removeSignalMany`     |      22,704 |
| `settleEpochs`         |      22,503 |
| `stake`                |      22,836 |
| `unstake`              |      22,858 |
| **Total per property** | **500,000** |

The audit added two expected-behavior PoCs in `CarryReallocation.t.sol`. Both pass by demonstrating the open A-09
allocation defect. It also added three Strategy receiver-boundary tests proving atomic failure for a Strategy self
receiver, exact direct Fund settlement, and synchronizable Resonance donation behavior.

## Independent state-machine fuzzing

Medusa command:

```bash
medusa fuzz \
  --config audit/medusa.json \
  --compilation-target /absolute/path/packages/contracts/audit/harness/ProtocolStateMachineCampaign.sol
```

Medusa 1.5.1 used four workers, sequences up to 150 calls, a 12,500,000 transaction-gas limit, and a 100,000
transaction target. Actual result: 101,840 calls, 3,632 branches, corpus 101, zero failures, 23 property tests plus 39
assertion surfaces (62/62 pass). No explicit Medusa seed is configured, so none is claimed.

Pinned Echidna 2.3.2 could not run because Docker is unavailable. The native fallback used Echidna 2.3.3 with checked
seed 6900, 100,000-test limit, and sequence length 150. All four workers crashed before transaction one with
`Set.elemAt: index out of range`; status was 0/25 tests and 0/100,000 fuzz transactions even though Echidna returned
exit code zero. This is an invalid result and remains a release blocker.

## Coverage

Exact coverage command:

```bash
FOUNDRY_FUZZ_RUNS=256 \
FOUNDRY_INVARIANT_RUNS=32 \
FOUNDRY_INVARIANT_DEPTH=64 \
forge coverage --report summary --report lcov \
  --report-file audit/reports/adversarial-current-coverage.lcov --summary
node scripts/check-forge-coverage.mjs audit/reports/adversarial-current-coverage.lcov
```

All 340 tests passed under instrumentation. Compiled-scope totals were:

| Metric     |               Result |
| ---------- | -------------------: |
| Lines      | 92.98% (1,311/1,410) |
| Statements | 92.86% (1,716/1,848) |
| Branches   |     80.22% (219/273) |
| Functions  |     89.34% (176/197) |

The source-only policy exactly enumerates all 12 direct core contracts, pins denominator floors, and passes this
report. Per-file function coverage is 83.33% or higher except LiquidityPosition's default mock/deep result of 62.50%;
its genuine PositionManager behavior is covered separately by 11 fee-harvest integration tests. Current Solidity source maps produce
nonfatal coverage warnings; the non-IR instrumentation campaign itself is green.

## Gas measurements

Foundry 1.7.1, Solidity 0.8.26, optimizer 10,000:

| Path                                    |       Gas |
| --------------------------------------- | --------: |
| Add token eight                         |    50,840 |
| Reject token nine                       |     5,379 |
| Fund-bound reward payout                |    33,096 |
| Kill Strategy                           |    12,916 |
| `addSignal`, eight registered tokens    |   336,621 |
| `removeSignal`, eight registered tokens | 1,341,818 |
| One selected-token claim                |   168,113 |
| Selective eight-token claim             | 1,348,052 |
| All-token convenience claim             | 1,339,891 |
| `Strategy.buy`, eight registered tokens |   196,941 |
| `addSignal`, one token                  |   227,777 |
| `removeSignal`, one token               |   176,166 |
| Add-signal marginal token slope         |    15,549 |
| Remove-signal marginal token slope      |   160,520 |

The largest required user exit is below 1.35 million gas. This is engineering margin against the documented
60,000,000 target-chain limit, not a guarantee about a future block policy.

## Production bytecode sizes

| Contract          | Runtime bytes | Initcode bytes |
| ----------------- | ------------: | -------------: |
| Bribe             |        11,539 |         11,976 |
| BribeFactory      |        13,229 |         13,474 |
| BribeRouter       |         4,075 |          4,647 |
| Fund              |         4,491 |          4,775 |
| Fundraiser        |         5,225 |          5,714 |
| GBX               |        10,098 |         13,117 |
| LiquidityPosition |         8,214 |         10,608 |
| Resonance         |        13,463 |         14,265 |
| ResonanceRouter   |         1,852 |          2,220 |
| SignalGBX         |        12,439 |         13,889 |
| Strategy          |         5,661 |          6,681 |
| StrategyFactory   |        13,011 |         13,256 |

## Static, symbolic, mutation, and fork status

`bash audit/run-static.sh` verified the seven pinned static tools, accepted 186 exact current-source findings across
23 detector classes, found zero Semgrep findings, zero compiler errors, and no High/Critical dependency advisory. It
remains red solely because Gitleaks reports six redacted historical candidates awaiting independent classification.
Solhint reports 106 nonblocking warnings.

The corrected Mythril runner targets all 12 current production contracts and fails closed before analysis:
constructor-resolved deployed runtimes are required, and Mythril 0.24.8 cannot safely interpret current `MCOPY`,
`TLOAD`, or `TSTORE` runtime instructions. No current pinned mutation configuration, mutant manifest, or survivor
review exists; raw and equivalent-adjusted mutation scores are unavailable. These are release blockers.

No current-graph fork passed. Read-only target-chain evidence is pinned to Robinhood block 32,035,314, but the only
deployment schema is an explicitly archived incompatible graph and there is no signed current manifest. See
`FORK-VALIDATION.md`.

## Integration and repository gates

Applicable repository commands were executed with Node 22.23.1, Python 3.11.14 with all five exact dependency pins,
and the exact Foundry installation. The serialized root `pnpm test` run passed all nine Turbo tasks: configuration
124/124, SDK 39/39, simulations 25/25 TypeScript plus 19/19 Python and 5/5 environment-policy tests, subgraph 4/4
specification checks plus 5/5 Matchstick tests, and the complete Foundry suite. Subgraph codegen, 11-ABI sync, build,
web unit 3/3, browser E2E 6/6, SDK ABI/pack checks, generated docs, economic fixtures/charts, the 25-page whitepaper,
format, lint, typecheck, and build also passed. The audit-policy JavaScript suite passed 78/78. The genuine v4 profile
passed 11 LiquidityPosition fee-harvest tests and six campaign-harness tests. ADR 0022 intentionally replaced the
LiquidityPosition compounding ABI; generated SDK and subgraph consumers match the new `harvestFees` surface.

## Failures and audit remediations

- A-09 remains open because exact temporal attribution across changing signal denominators is a product/accounting
  choice. Two minimal PoCs preserve the behavior for owner and external-auditor review.
- The Forge coverage policy referenced 32 deleted contracts and stale LCOV evidence. It now exactly covers the 12
  direct core contracts and rejects missing/new graph members.
- The Mythril policy referenced five deleted legacy contracts. It now enumerates the exact current graph and records
  current constructor/opcode blockers.
- Three audit-assurance tests contained stale license, time, and nonexistent-workflow assumptions; all now exercise the
  current repository state.
- Static lint/analyzer commands referenced removed `script/minimal` paths; they now target the current source tree.
- The refreshed current-source Semgrep scan exposed an `unchecked` increment block in `Fundraiser.settleEpochs`.
  Checked increments are now used; the Fundraiser suite remains 31/31 and Semgrep is zero-finding. The subsequent ADR
  0022 source change brings the complete default suite to 340/340. The exact static register was refreshed for the
  resulting Fundraiser and LiquidityPosition source changes and accepts 186 reviewed findings across 23 classes.

## Blocked reproducible commands

```bash
FOUNDRY_PROFILE=nightly forge test --summary
bash audit/install-tools.sh nightly
bash audit/run-nightly.sh
node audit/check-mythril-findings.mjs --run audit/mythril-policy.json . audit/reports
```

The exhaustive Foundry nightly profile was not completed. Docker absence blocks pinned Echidna. Mythril has an
additional current-bytecode compatibility blocker. Mutation, independent audit, monitored testnet, legal/provenance
review, current deployment tooling, signed deployment evidence, and the six Gitleaks classifications remain
incomplete.
