# Signal and Resonance test campaign

Run date: 2026-08-16. Baseline commit: `281e601ecb3f3989da826a8a7dfba37b63b55ca0`, branch `main`.
All results are local engineering evidence. No command deployed, broadcast, committed, pushed, published, or transferred
roles.

## Environment and baseline

The build uses Solidity 0.8.26, Cancun EVM, legacy pipeline (`viaIR=false`), optimizer enabled with 10,000 runs, Foundry
1.7.1, Hardhat 2.29.0, Node 22.23.1, pnpm 10.14.0, and Python 3.14.6. The initial Foundry baseline was 339 passing,
zero failing, zero skipped; Hardhat was 3/3 and the integration profile 17/17. Root formatting, lint, typecheck, and build
were green. The aggregate test gate stopped in Python because `iniconfig` is missing.

## Deterministic, fuzz, and invariant results

| Campaign                              | Exact result                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Current minimal Foundry suite         | 335 passed, 0 failed, 0 skipped across 22 suites in 537.87 seconds                                                 |
| Current non-invariant optimized suite | 308 passed, 0 failed, 0 skipped                                                                                    |
| High-run unit fuzz                    | Configured 10,000 runs; SignalGBX, GBX, Mine, Fund, Bribe, Resonance, Router, Strategy, and whole-flow fuzz passed |
| Stateful invariants                   | 27/27 passed at 1,000 runs × 500 calls each; 13,500,000 calls total                                                |
| Handler quality                       | All 31 selectors reached 15,849–16,406 times in the full run; zero reverts and zero discards                       |
| Integration profile                   | 17/17 passed; campaign wrapper 6/6 and Liquidity fee harvest 11/11                                                 |
| Hardhat parity                        | 3/3 passed; Foundry/Hardhat init and runtime bytecode identical for every deployable source                        |
| Mutation                              | 43/43 killed; 100%; zero survivors                                                                                 |

The complete root `pnpm test` gate passed all nine Turbo tasks in 8 minutes 58.238 seconds. The invariant suite itself
finished in 537.86 seconds.

The invariant handlers cover time, mining/handoffs, capacity, claims, direct and routed revenue, direct and
permit-backed signaling into multiple Strategies, moves, partial and complete withdrawal, delegation, Strategy
creation and death, Strategy purchase, combined and independently ordered liability settlements, Bribe claims, Fund
GBX burn, and redemption. Their properties reconcile receipt collateral, account/Strategy/Bribe signal identities,
active live weight, GBX supply, Mine claims, USDG, Bribe rewards and carry, Router 90/10 liabilities, Strategy price
bounds, final live Strategy policy, and bounded exit.

## Independent and differential models

Python and TypeScript independently implement Resonance streaming/index conservation and whole-system payment
classification. Reference scenario schema 7 and economic fixture schema 7 include cumulative 90/10 payment partitions,
remainder, donation isolation, and independent Fund/Bribe settlement. TypeScript model tests passed 30/30; the pinned
Python environment checks passed 5/5 and its model tests passed 16/16. Fixture generation proved Python/TypeScript
equality. The missing baseline environment was repaired in a disposable `/tmp` Python 3.11 virtual environment from
the exact five-package lockfile; no global Python or repository dependency state was changed.

The economic schema now includes the adverse ordering where governance increases capacity one step at a time and one
new slot is occupied after each increase while every earlier tenure retains its rate. At capacity 16 the aggregate
one-hour issuance is 33,807 basis points of the undivided global rate (3.3807x after integer flooring). This is an
accepted consequence to parameterize and disclose, not a runtime invariant failure or a production-parameter choice.

Metamorphic coverage includes one payment versus partitions, signal moves at one timestamp, account/Strategy
permutations, repeated checkpoints, zero-weight intervals, tiny raw units, active-period resets, and both settlement
orders.

`HistoricalBribeDifferentialTest` is an executable test-only historical Synthetix/Liquid-Signal Bribe reference. Its
three tests compare virtual balances, total supply, divisible reward rates, active-period leftover restarts,
normalized `1e18`/`1e36` indices, earned rewards, checkpoint ordering, and claims. It separately proves and names the
intentional divergence where Resonance front-loads raw quotient remainder that the historical quotient-only schedule
would strand.

## External fuzzing

`ProtocolStateMachineCampaign.sol`, `echidna.yaml`, and `medusa.json` now encode mandatory signaling, paired-Bribe
synchronization, six-decimal USDG, exact stream remainder, live-only denominator, killed exits, final-live policy,
cumulative 90/10, no double settlement, claim-before-snapshot, voting supply, and donation isolation. Configuration
wiring tests passed 3/3. The repaired Foundry smoke runs the actual integration wrapper and passed 6/6.

Medusa 1.5.1 completed 101,602 calls, 3,988 branches, corpus 84, and zero failures across 65 property/assertion
surfaces. Pinned Echidna 2.3.2 completed 100,213 calls with seed 6900, 42,054 unique instructions, corpus 36, and all 25
properties passing. Both exercised the current campaign graph at sequence length 150.

Echidna initially returned exit code zero after a zero-call `Set.elemAt` worker crash. The cause was the production
Foundry profile's intentionally omitted compiler metadata combined with immutable-bearing contracts deployed by the
harness constructor. A dedicated metadata-retaining `echidna` profile fixed contract discovery without changing the
production build. The nightly runner now validates nonzero progress, the configured call limit, final success, and
every property result rather than trusting process status alone. Docker remains unavailable, so the recorded Echidna
result used the SHA-256-verified official native aarch64 build of the pinned version rather than the digest-pinned
nightly container.

## Coverage

Command:

```bash
FOUNDRY_FUZZ_RUNS=256 FOUNDRY_INVARIANT_RUNS=32 FOUNDRY_INVARIANT_DEPTH=64 \
forge coverage --report summary --report lcov \
  --report-file audit/reports/signal-resonance-coverage.lcov --summary
node scripts/check-forge-coverage.mjs audit/reports/signal-resonance-coverage.lcov
```

Compiled-scope totals were 94.37% lines (1,777/1,883), 94.49% statements (2,315/2,450), 82.69% branches (301/364),
and 92.41% functions (268/290). The 13-file source-only policy passed. SignalGBX reached 100% lines, statements,
branches, and functions; Resonance reached 97.50% lines, 90.38% branches, and 100% functions; BribeRouter reached
96.97% lines, 70% branches, and 100% functions. Forge emitted nonfatal source-map anchor warnings.

## Static, dependency, and secret checks

- Pinned Slither 0.11.5 and Aderyn 0.6.8 produced 177 exact current-source instances across 28 reviewed detector
  classes. The two High-labeled `reentrancy-balance` paths on BribeRouter were manually reproduced with a callback
  token; the Router guard rejected the nested call and the outer exact transfer settled once. Weak-PRNG labels are
  deterministic modulo carry, not entropy. Remaining timestamp, loop, equality, return-value, naming, assembly, and
  OpenZeppelin override reports match documented bounded or intentional behavior.
- Semgrep 1.162.0 produced zero findings. Mythril 0.24.8 installed successfully but the fail-closed runner rejected
  current constructor-resolved immutables and Cancun `MCOPY`/`TLOAD`/`TSTORE` bytecode, so no symbolic result is
  claimed. SMTChecker remains unavailable.
- The dependency audit initially found one High nanoid advisory. Pinning 3.3.18 removed it; the high-severity gate now
  passes with three Low and one Moderate Hardhat/tooling advisory remaining.
- Gitleaks 8.30.1 scanned the Git history with narrow path-and-regex conjunctions for reviewed public identifiers and
  historical fixtures, found no remaining leak, and passed the raw report gate. The allowlist does not exclude a
  directory or generic key class.

## Gas and deployability

Direct `gasleft` measurements under the optimized 10,000-run compiler configuration:

| Path                                       |       Gas |
| ------------------------------------------ | --------: |
| First signal, one reward token             |   305,250 |
| Complete withdrawal, one reward token      |   214,176 |
| Signal at eight-token cap                  |   451,467 |
| Complete killed-Strategy withdrawal at cap | 1,389,212 |
| Scalar claim with eight tokens registered  |   168,113 |
| Selective eight-token claim                | 1,348,052 |
| Complete eight-token claim                 | 1,337,679 |
| Strategy purchase at cap                   |   229,451 |
| Add eighth reward token                    |    50,899 |
| Reject ninth reward token                  |     5,438 |
| Fund liability settlement                  |    33,141 |
| Kill Strategy                              |     9,244 |

Selector-level `--gas-report` additionally covered signalWithPermit, partial and complete moves/withdrawals, Resonance
distribution, payment classification, Bribe notification/claim, Governor voting, Timelock execution, and Fund
redemption. The maximum mandatory exit measured 1.39M gas, below 5% of the conservative 30M reference block; scalar
claims remain available when a batch token is broken.

All production contracts fit EIP-170. The largest is ProtocolGovernor at 18,186 bytes (6,390-byte margin), followed by
StrategyFactory at 16,295, Resonance at 13,939, SignalGBX at 12,945, and Bribe at 11,596.

## Consumer and documentation checks

SDK action/read schemas, generated ABIs, subgraph ABIs/schema/handlers, web status copy, Python/TypeScript fixtures,
architecture/specification/ADR text, one-pager facts, and generated contract/SDK references were reconciled. Focused
results: SDK 48/48, subgraph Matchstick 12/12 plus specification checks 4/4, web status 3/3, and browser E2E 6/6.

The final repository gates and exact remaining environmental failures are recorded in
`SIGNAL-RESONANCE-RESIDUAL-RISKS.md`. This tree is intended for independent-auditor handoff, not production release.
