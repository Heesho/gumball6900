# Production-hardening test campaign

Date: 2026-08-09

Baseline: `395a0dfbf56e3d478233736ef7a110e584a676e7`
Candidate branch: `codex/gumball-production-hardening`

This is reproducible internal engineering evidence. It is not an independent audit, formal verification, legal
approval, deployment authorization, or a claim that the protocol is safe for unlimited value.

## Toolchain

| Tool             | Version/configuration                                    |
| ---------------- | -------------------------------------------------------- |
| Node             | 22.23.1                                                  |
| pnpm             | 10.14.0                                                  |
| Foundry          | 1.7.1, commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8` |
| Solidity         | 0.8.26, Cancun, optimizer 10,000, legacy pipeline        |
| Hardhat          | 2.29.0                                                   |
| Slither          | 0.11.5                                                   |
| Aderyn           | 0.6.8                                                    |
| Semgrep          | 1.162.0                                                  |
| Solhint          | 6.0.1                                                    |
| Gitleaks         | 8.30.1                                                   |
| Medusa           | 1.5.1                                                    |
| Echidna fallback | native 2.3.3; pinned campaign is 2.3.2 container         |

Package commands used the repository Node binary and Foundry commands used the task-local exact 1.7.1 installation.

## Completed contract campaigns

```bash
forge test --summary
FOUNDRY_PROFILE=ci forge test --summary
FOUNDRY_TEST=test/integration forge test --summary
pnpm --filter @gumball-6900/contracts test:hardhat
forge build --sizes
forge test --match-contract SignalGasTest -vv
```

| Campaign              | Actual result                                             |
| --------------------- | --------------------------------------------------------- |
| Default/root Foundry  | 334 passed, 0 failed, 0 skipped                           |
| CI profile            | same 10,000-fuzz/1,000×500 invariant configuration; green |
| Integration profile   | 21 passed, 0 failed, 0 skipped                            |
| Hardhat parity/supply | 2 passed, 0 failed                                        |
| Signal gas suite      | 4 passed, 0 failed                                        |
| Production sizes      | all runtime/initcode below EIP-170/EIP-3860 ceilings      |

`forge build --sizes` reported the following production-contract bytecode sizes in bytes:

| Contract          | Runtime | Initcode |
| ----------------- | ------: | -------: |
| Bribe             |  11,539 |   11,976 |
| BribeFactory      |  13,229 |   13,474 |
| BribeRouter       |   4,075 |    4,647 |
| Fund              |   4,491 |    4,775 |
| Fundraiser        |   5,157 |    5,646 |
| GBX               |  10,098 |   13,117 |
| LiquidityPosition |   9,988 |   12,225 |
| Resonance         |  13,463 |   14,265 |
| ResonanceRouter   |   1,852 |    2,220 |
| SignalGBX         |  12,439 |   13,889 |
| Strategy          |   5,661 |    6,681 |
| StrategyFactory   |  13,011 |   13,256 |

There are 27 ordinary `testFuzz_` properties. Each completed the configured 10,000 Foundry runs in the full default
campaign (270,000 configured cases). Foundry did not emit its automatically selected seed on a passing run; no seed is
invented here. The complete schedule and independent model suites exercise additional deterministic vectors.

All 28 stateful invariants completed 1,000 runs at depth 500. Forge reported 500,000 calls and zero handler reverts per
property under `fail_on_revert = true`: 14,000,000 aggregate handler calls. The handler exposes 22 actions, and
`test_EveryHandlerActionIsReachable` prevents a permanently short-circuited action from creating false confidence.

The nightly profile is configured for 100,000 fuzz runs and 10,000 invariant runs at depth 1,000. The exact command
started successfully against this candidate and early suites demonstrated the configured 100,000-run fuzz setting.
It was stopped before the full multi-hour campaign completed. No partial result is counted as a pass, and the command
remains an incomplete release gate.

## Independent state-machine fuzzing

Final Medusa command:

```bash
medusa fuzz \
  --config audit/medusa.json \
  --compilation-target /absolute/path/packages/contracts/audit/harness/ProtocolStateMachineCampaign.sol
```

Medusa 1.5.1 used four workers, sequences up to 150 calls, a 12,500,000 transaction-gas limit, and a 100,000
transaction target. Actual result: 100,069 calls, 3,632 branches, corpus 93, zero failures, 23 property tests plus 39
assertion surfaces (62/62 pass). No explicit seed is configured by the checked-in Medusa file, so none is claimed.

Pinned Echidna command:

```bash
bash audit/install-tools.sh nightly
bash audit/run-nightly.sh
```

The pinned Echidna 2.3.2 image and its digest are in `audit/toolchain.lock`. Docker is unavailable, so the pinned
campaign did not run. The native fallback used Echidna 2.3.3 with checked-in seed 6900, 100,000 test limit, and sequence
length 150. All four workers crashed before transaction one with `Set.elemAt: index out of range`; status remained
0/25 tests and 0/100,000 fuzz transactions even though Echidna returned exit code zero. This is an invalid run, not a
pass.

## Coverage

Clean coverage command:

```bash
FOUNDRY_FUZZ_RUNS=256 \
FOUNDRY_INVARIANT_RUNS=32 \
FOUNDRY_INVARIANT_DEPTH=64 \
forge coverage --report summary
```

The instrumentation run passed 334/334 tests. Compiled-scope totals were:

| Metric     |               Result |
| ---------- | -------------------: |
| Lines      | 91.79% (1,297/1,413) |
| Statements | 91.22% (1,704/1,868) |
| Branches   |     79.06% (219/277) |
| Functions  |     87.88% (174/198) |

An earlier `--ir-minimum` coverage attempt produced inaccurate-source-mapping warnings and two instrumentation-only
failures (a gas threshold and an ERC-5805 same-block lookup). It is not the reported coverage result. Removing that
mode made the same reduced instrumentation profile pass completely.

## Eight-token gas measurements

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

The largest required user exit is below 1.35 million gas. Target-chain evidence, not an assumed Ethereum gas limit, is
recorded in `UNISWAP-V4-REVIEW.md` and the baseline.

## Static, dependency, and generated-artifact gates

Completed or executed commands include:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm docs:check
pnpm sdk:abi:check
pnpm subgraph:build
pnpm web:test:e2e
bash audit/run-static.sh
```

Root `pnpm test` passed 9/9 tasks. SDK/subgraph ABIs, generated docs, economic fixtures/charts, whitepaper, and browser
E2E checks pass. The static policy accepts 186 exact current-source findings across 24 detector classes; Semgrep is
clean and dependency audit has no High/Critical advisory after the narrow nanoid 3.3.17 override. The aggregate static
script remains red because Gitleaks reports six redacted historical candidates awaiting independent classification.
Darwin and Linux dependency inventories reproduce from the frozen graph but remain `inventory-baselined`, not legally
approved.

## Mutation and symbolic status

No reproducible pinned current-tree mutation configuration, source-span baseline, survivor ledger, or equivalence
review exists. Raw score, equivalent-adjusted score, and surviving meaningful mutants are unavailable. Historical
scores from other graphs are not reused. This is a release blocker.

Mythril 0.24.8 is pinned but container-only in the checked runner; Docker is unavailable. No complete Certora, Halmos,
Kontrol, hevm, or SMTChecker specification exists. Foundry invariants and independent TypeScript/Python models are
testing evidence, not formal verification.

## Failures fixed during the campaign

- exact carried revenue and reward conservation replaced lossy floor accounting;
- zero-supply streams now pause and queued notifications remain reachable;
- exit paths no longer depend on fixed-destination token transfers;
- supported-token boundaries validate observed debit and credit;
- Strategy payments now obey ADR 0021's uniform 100% Fund liability at both Strategy and router boundaries;
- SDK, subgraph, models, generated ABIs/docs, and public copy were regenerated for the reduced interface;
- the vulnerable `postcss -> nanoid@3.3.16` edge is overridden to 3.3.17; and
- stale analyzer source spans fail closed through the exact disposition register.

## Blocked capabilities and release gates

```bash
FOUNDRY_PROFILE=nightly forge test --summary
bash audit/install-tools.sh nightly
bash audit/run-nightly.sh
```

The exhaustive Foundry nightly profile was not completed in this handoff; the exact command remains required before a
release claim. Docker absence blocks pinned Echidna and Mythril. Mutation, independent audit, legal/provenance review,
signed deployment evidence, and the six Gitleaks classifications also remain incomplete.
