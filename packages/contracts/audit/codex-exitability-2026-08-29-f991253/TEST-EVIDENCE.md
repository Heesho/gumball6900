# Test and tool evidence

This record separates evidence for the immutable starting commit from evidence for the uncommitted remediation tree.
It is internal engineering evidence, not an independent audit, production fork receipt, or deployment authorization.
`commands.log` contains command transcripts and explicitly labeled observed receipts through E-18. E-16 records the
supplied post-ADR-0053 receipts and its completed historical root `pnpm test` rerun. E-17 records the later
post-prefunding ADR-0054 contract, fork, final root, and SDK validation for the preceding Pair-adoption/skim launcher.
E-18 records the create-only launcher delta without rewriting those earlier receipts as current. E-19 records the
subsequent ADR-0055 working-session receipts; unlike E-01 through E-18, its complete terminal transcript is not appended
to `commands.log`, so its counts remain a reviewable summary backed by the named tests and retained mutation JSON.

> Evidence through E-15 predates ADR 0053's Bribe claim authorization and Resonance claim-batch delta. E-16 records the
> post-ADR-0053 internal verification and predates ADR 0054. E-17 covers the preceding post-prefunding ADR-0054
> Pair-adoption/skim launcher. E-18 covers the pre-ADR-0055 create-only launcher. E-19 is the current ADR-0055 internal
> record. Earlier “final/current tree” labels remain historical rather than being rewritten as current receipts.

## Evidence identity and toolchain

### E-01 — Initial repository snapshot

- Starting commit and remote parity: `f9912533e999454f1a3fd49276558bd85e1390da` (`main`, equal to `origin/main`)
- Prior V12 target: `3ae171b997254b56602298d873b3918d1575b3c7`
- Initial unrelated user work preserved: two untracked web-media files and untracked `tmp/`
- Production source changes before `INITIAL-FINDINGS.md`: none
- Commands: `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, and
  `git log --oneline --decorate -20`

### E-02 — Exact local tool versions

| Tool                     | Version / state                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Node                     | 22.23.1 from the repository-pinned NVM path                                                     |
| pnpm                     | 10.14.0                                                                                         |
| Foundry forge/cast/anvil | 1.7.1, commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`                                        |
| Solidity                 | 0.8.26, long version `0.8.26+commit.8a97fa7a`                                                   |
| EVM target               | Cancun in both Foundry and Hardhat; optimizer enabled, 10,000 runs, legacy pipeline             |
| OpenZeppelin Contracts   | 5.6.1                                                                                           |
| Python                   | release pin 3.11.9; task-local development fallback 3.11.14 with all five exact dependency pins |
| Echidna                  | local 2.3.3; repository-pinned container is 2.3.2                                               |
| Docker / CodeQL / Halmos | unavailable on this host                                                                        |

The shell initially exposed Node 20, so every repository command in this campaign explicitly prepended
`/Users/hishamel-husseini/.nvm/versions/node/v22.23.1/bin`.

Ambient `python3` was 3.14.6 and lacked the locked simulation packages. Repository policy permits a 3.11.x development
fallback while release evidence remains pinned to 3.11.9, so the monorepo test used a disposable Python 3.11.14 virtual
environment selected through `GUMBALL_PYTHON`; `pip check` passed and the environment checker verified all five exact
dependency pins. This is local development evidence, not the exact release-Python patch.

## Source review and historical reproduction

### E-03 — Complete surface, graph, and V12-diff review

Manual line review covered every first-party contract/interface/periphery file, every constructor and one-time binding,
every public state-changing function, the deployment/config/release gates, SDK builders/readers/deployment schema,
subgraph position tracking, Foundry/Hardhat settings, audit infrastructure, dependency use, security documentation, and
`git diff 3ae171b997254b56602298d873b3918d1575b3c7..f9912533e999454f1a3fd49276558bd85e1390da`.
The durable results are `ARCHITECTURE.md`, `FUNCTION-MATRIX.md`, `EXIT-MATRIX.md`, `FINDINGS.md`, and the independent
V12 disposition table. The later supplied ChatGPT direct review was preserved byte-for-byte and independently mapped in
`CHATGPT-DIRECT-AUDIT-INTAKE.md`; its labels and unexecuted test statements were not treated as clearance.

### E-04 — Initial pre-remediation test baseline

Before changing `packages/contracts/src`, the full Foundry campaign passed 299/299 tests. The pre-remediation
`ProtocolInvariantsTest` ran the then-existing 27 invariants at 1,000 runs × 500 depth, or 500,000 handler calls per
invariant, with zero handler reverts. Observed wall time was approximately 979 seconds. This green result did not clear
CEX-01: the handler's ordinary-scale amounts and minimum `1e15` signal weight could not reach the one-raw-unit lifetime
index boundary.

### E-05 — CEX-01 public-path before/after regression

The exact same compiled regression was run against both revisions:

| Revision                       | Result                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Detached worktree at `f991253` | **FAIL**, arithmetic panic `0x11` at scalar signal exit after two public schedules |
| Current remediation tree       | **PASS**, gas 592,018; rejected second schedule leaves principal removable         |

Command in both trees:

```text
forge test --match-path 'test/minimal/audit-exitability/CEX01CrossVersionRegression.t.sol' -vvv
```

The original vulnerability-style assertion is retained, disabled from the remediated compiler target, at
`packages/contracts/test/minimal/audit-exitability/reproductions/CEX-01-original-f991253.t.sol.disabled`. Neither proof
uses `vm.store` or a counterfeit protocol graph.

## Deterministic, fuzz, differential, and stateful evidence

### E-06 — Focused exitability suite

Command:

```text
FOUNDRY_FUZZ_SEED=0x6900 forge test --match-path 'test/minimal/audit-exitability/*.t.sol' -vvv
```

Final focused result: **PASS, 52/52 across six suites**. The six independent differential tests each ran 10,000 fuzz
cases. The suite covers the cross-version CEX-01 regression, exact cap/headroom boundaries, active rollover and donation
exclusion, CEX-02/CEX-03/CEX-04/CEX-08 PoCs, the imported BribeRouter one-unit-over-headroom donation sequence,
unbound/wrong-bound Mine settlement failure, Fund transient-state
retry/alias/rebase/callback isolation, live/killed 1/16-reward principal exits at zero-active-stream and saturated
lifetime-cap states, broken/paused/behavior-changing rewards, zero-price Mine settlement with disabled USDG, Mine
replacement and claim callbacks, isolated miner claims, the defensive Mine/Fund host-model boundary plus target `uint64`
proof, ERC-5805 last-valid/first-invalid blocks, duplicate-batch rollback and scalar fallback, independent
Mine/Resonance/Bribe/Strategy/Fund models, and gas liveness. A canonical Strategy always registers its payment token, so
a zero-token canonical Bribe is unreachable; the one-token/no-notification case is the canonical zero-active-stream
boundary, while an isolated empty Bribe covers the raw zero-registry accounting path.

## Liveness-invariant disposition

`PASS` always means only the documented standard-token model, correct fresh graph, and stated arithmetic/clock horizon.
It never means mathematical perpetuity or support for arbitrary ERC-20 behavior.

| Invariant                                        | Verdict                                                          | Evidence / falsification boundary                                                                                                                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-01 signal principal recoverable                | **PASS for a known Strategy after patch; original source FAIL**  | E-05/E-06; live/killed 1/16-reward and broken-reward exits pass. CEX-07 is the explicit remote clock horizon.                                                                                                                   |
| L-02 scalar removal fallback                     | **FAIL as written**                                              | Scalar removal after duplicate/batch rollback passes E-06, but incomplete offchain discovery has no bounded current-state fallback: CEX-03.                                                                                     |
| L-03 signal reconciliation                       | **PASS within assumptions**                                      | Unit/fuzz reconciliation plus E-07's explicit arbitrary-prefix full removals; final full-strength result is recorded below.                                                                                                     |
| L-04 ancillary accounting cannot block principal | **PASS after CEX-01 patch within horizon**                       | E-05/E-06 exact index cap, Bribe cap, active/expired streams, zero/one signal, 1/16 rewards, broken reward, and kill exits.                                                                                                     |
| L-05 Resonance accumulator                       | **Original FAIL; patched PASS**                                  | Exact public sequence, bound, cross-version failure, cap proof, headroom rejection, and exit are E-05/E-06.                                                                                                                     |
| L-06 selective Fund redemption                   | **PASS for healthy selected assets; complete-basket claim FAIL** | E-06/E-08 cover omit/retry/transient/alias/rebase/callback/atomicity; CEX-09 records the release-claim mismatch; E-10 proves live opcode support but not the exact artifact.                                                    |
| L-07 Fund denominator                            | **PASS within target execution assumptions**                     | Constant-time/sum equivalence invariants plus E-06 target-`uint64` proof; CEX-06 is rejected as host-only.                                                                                                                      |
| L-08 Mine finite settlement                      | **PASS on a correctly bound graph; setup FAIL**                  | Zero-price settlement with disabled USDG, 16-slot gas and arbitrary-prefix settlement pass; CEX-04 falsifies exposed pre-binding safety.                                                                                        |
| L-09 miner-claim isolation                       | **PASS under canonical USDG**                                    | E-06/E-08 isolate blocked beneficiaries, prove callback-time CEI/reentrancy rejection and the maximum single-tenure claim, and exercise stateful claims. A permanent USDG issuer failure is intrinsic and unrecoverable.        |
| L-10 Bribe claim isolation                       | **STARTING SOURCE FAIL; REMEDIATED INTERNAL PASS**               | CEX-02 proves outsider-controlled flooring in `f991253`; E-16 verifies beneficiary/immutable-Resonance authorization, caller-owned batching, atomic rollback, contract-wallet use, scalar isolation, and gas fallbacks.         |
| L-11 Strategy kill exits                         | **PASS**                                                         | Live/killed scalar exits, no double subtraction, preserved revenue/rewards, final-live rule, owner loss, and 16-token gas in E-06/E-07.                                                                                         |
| L-12 Routers not principal dependencies          | **PASS**                                                         | Signal/Fund exits and zero-price Mine settlement execute with idle/failing Routers; only delayed/stranded yield remains.                                                                                                        |
| L-13 no unbounded required iteration             | **FAIL under discovery definition**                              | Known-key scalar paths are bounded, but CEX-03's current-state factory reconstruction grows with total global Strategy creations.                                                                                               |
| L-14 immutable setup                             | **FAIL / deployment-blocking**                                   | CEX-04 plus absent signed current manifest, exact bytecode/immutables, governance executor, ownership receipt, and exact fork evidence.                                                                                         |
| L-15 governance failure                          | **PASS for existing known positions on a valid graph**           | Handler transfer/renunciation, bribeBps bounds, killed/live exits, and direct scalar paths pass; governance cannot repair CEX-03 or a wrong graph.                                                                              |
| L-16 target execution                            | **PARTIAL / deployment-blocking**                                | E-10 proves PUSH0/TSTORE/TLOAD/MCOPY and gas limits at pinned live blocks; no exact Fund artifact deployment/fork or future-state guarantee exists.                                                                             |
| L-17 cross-contract reentrancy                   | **PASS under supported tokens**                                  | E-08 directly exercises Router, Mine, claim, Fund, Strategy, Resonance, Bribe, and signal callback cycles; guards or accounting-free buffers preserve state, while unsupported callbacks remain outside promised token support. |
| L-18 time/arithmetic                             | **PASS within target assumptions except CEX-07 clock horizon**   | E-05/E-06 close revenue and target-`uint64` Mine/Fund arithmetic; CEX-06 is rejected, while CEX-07 records the ERC-5805 horizon.                                                                                                |

### E-07 — Full post-remediation arbitrary-prefix exits

Command:

```text
PATH=/Users/hishamel-husseini/.nvm/versions/node/v22.23.1/bin:/Users/hishamel-husseini/.foundry/bin:$PATH \
GUMBALL_PYTHON=/private/tmp/gumball6900-python311.dL0PjJ/bin/python \
FOUNDRY_FUZZ_SEED=0x6900 pnpm test
```

Recorded pre-ADR-0053 final-tree result: **PASS, 358/358 Foundry tests across 29 suites**. `ProtocolInvariantsTest` passed 30
`invariant_` properties plus two deterministic reachability harness tests. Every property ran 1,000 runs × 500 depth,
or 500,000 randomized handler calls, for 30,000 aggregate property runs and 15,000,000 handler calls with **zero
handler reverts and zero discards**. All 31 targeted handler selectors were reached 15,877–16,429 times with zero
selector reverts or discards. Foundry observed 839.58 seconds wall and 3,520.12 seconds CPU; the invariant suite
reported 839.57 seconds wall and 5,528.89 seconds CPU. Root Turbo 2.10.8 completed 9/9 tasks, 8 from cache, in
14m1.028s. The final harness explicitly attempted, after every arbitrary prefix:

- every recorded Strategy allocation's complete scalar signal removal, with a broken reward enabled;
- one known healthy Fund-asset redemption for every liquid GBX holder;
- every tracked outgoing-miner USDG claim;
- each occupied slot's zero-price replacement after complete decay; and
- every healthy scalar Bribe claim while a different reward is broken.

The handler also randomizes Strategy addition/kill, reward registration, Fund donations, `bribeBps`, ownership
transfer/renunciation, scalar/batch signal paths, purchases, routing, time, Mine actions, claims, and redemptions.
Foundry reported no rejected/discarded invariant inputs; ordinary handler stage guards and `bound` normalization are
valid-sequence construction, not hidden reverts.

### E-08 — Adversarial token and callback blast radius

The audit suite plus existing mocks exercised standard 6/18-decimal tokens, no-return, false-return, reverting transfer,
reverting `balanceOf`, fee-on-transfer, rebasing, mutable blocklist, pausable, callback/reentrant, ERC-777-like callback,
shared/alias ledger, post-registration behavior changes, and contract receivers attempting cross-contract reentrancy.
Direct callback tests now cover ResonanceRouter and BribeRouter routing, Mine replacement, outgoing-miner claim CEI,
Strategy payment, Resonance revenue, signal changes, Fund redemption, and Bribe reward behavior. Supported-token failures
are classified separately from unsupported-token isolation. The relevant executable evidence is in
`ExitabilityBlastRadius.t.sol`, `AuditTokens.sol`, `Adversarial.t.sol`, `Fund.t.sol`, and `BribeFlow.t.sol`.

### E-09 — Gas liveness at maximum bounded loops

Values below are `gasleft()` deltas inside the test call. They exclude intrinsic/calldata gas and use warm accesses,
so they are comparative execution measurements rather than signed production estimates.

| Operation                                                           |              Observed gas |
| ------------------------------------------------------------------- | ------------------------: |
| Bribe scalar claim with 16-token registry                           |                   101,355 |
| Bribe all-token claim with 16-token registry                        |                 1,531,473 |
| Live Strategy scalar signal removal with 16 rewards                 |                 1,126,365 |
| Killed Strategy scalar signal removal with 16 rewards               |                 1,124,782 |
| `killStrategy` at 16-token paired Bribe                             |                     8,410 |
| SignalGBX 16-allocation batch add                                   |                 1,672,277 |
| SignalGBX 16-allocation batch remove                                |                 2,239,499 |
| SignalGBX 26-distinct-Strategy batch remove, 16 rewards each        |                26,901,423 |
| SignalGBX 32-distinct-Strategy batch attempt with 32m forwarded gas | **OOG / atomic rollback** |
| Fund one-token redemption                                           |                   100,264 |
| Fund sixteen-token redemption                                       |                   619,012 |
| Mine paid replacement with all 16 slots occupied                    |                   203,033 |
| Baseline first Router-to-Resonance notification                     |                   128,282 |
| Patched first Router-to-Resonance notification                      |                   150,609 |

The cap adds 22,327 internal gas to first notification, about 17.4% on this measurement. Every required scalar path is
far below the probed 32,000,000 target transaction/block gas limit; caller-sized convenience arrays remain bounded only
by transaction gas and must not be used as the sole exit. The fresh 26-position measurement leaves approximately 5.1m
execution-gas headroom before intrinsic/calldata costs; a fresh 32-position call with exactly 32,000,000 forwarded gas
exhausted gas after a 32,005,814 caller-side delta including call overhead, returned no revert data, rolled back every
removal, and then allowed all 32 positions to exit scalarly. This brackets a practical adversarial batch rather than
claiming a protocol-wide maximum for a caller-controlled array.

## Target-chain and dependency evidence

### E-10 — Robinhood Chain live opcode/configuration probes

Read-only RPC evidence was captured on 2026-08-30 at two distinct sets of block/hash pins. Configuration and opcode
probes used:

| Network                 | Chain ID |                     Block | Block hash                                                           |
| ----------------------- | -------: | ------------------------: | -------------------------------------------------------------------- |
| Robinhood Chain mainnet |     4663 |  49,509,696 (`0x2f37540`) | `0xd2b504dc188c52a9f0cab0d0ddbc25ebaaf1bc8735356688ea0f9ac8bf5e0c8c` |
| Robinhood Chain testnet |   46,630 | 109,587,699 (`0x6882cf3`) | `0x04e7186323af837a5a25bf3d093463b66fdfadf7392f8134288a3d622063328e` |

At those blocks, creation-code probes using `PUSH0`, `TSTORE`/`TLOAD`, and `MCOPY` returned 42. `ArbSys` returned
raw version 116, which the official interface defines as `55 + Nitro ArbOS version`, matching Robinhood's current
ArbOS 61 documentation. `ArbGasInfo` returned 32,000,000 for maximum transaction gas and maximum block gas. Those are
mutable, block-pinned observations, not immutable constants. Official chain configuration reports 98,304-byte runtime
and 196,608-byte initcode limits. This proves live EIP-1153 execution at the recorded blocks; it does **not** bind the
exact current Fund artifact, constructor arguments, deployed runtime, or a future block. A pinned, non-broadcast
exact-artifact deployment/fork campaign remains a release gate.

The later `NUMBER`/`ArbSys` comparison used separate pins:

| Network                 |                     Block | Block hash                                                           |          `NUMBER` result | `ArbSys` result |
| ----------------------- | ------------------------: | -------------------------------------------------------------------- | -----------------------: | --------------: |
| Robinhood Chain mainnet |  49,544,677 (`0x2f3fde5`) | `0x05ef4668a2bf11d25fad69f96151c63f16f9ccd66efc1fcbee2da75bcbe06a9c` | 25,864,185 (`0x18aa7f9`) |      49,544,677 |
| Robinhood Chain testnet | 109,611,117 (`0x688886d`) | `0xa95bb03bff687dfb99d992f39e2336e678fc72aa8e574c08c04de2bd75f26de2` |  11,595,007 (`0xb0ecff`) |     109,611,117 |

This confirms that Solidity `block.number` on the target is Nitro's parent-chain counter, not the faster L2 header
counter. The pinned source represents that parent counter as `uint64`; therefore the ERC-5805 `uint48` boundary in
CEX-07 is target-representable, but at a twelve-second parent cadence is roughly 107 million years away.

A later attempt to replay every configuration/opcode call at the newer `NUMBER` pins failed because the public RPCs no
longer served the requested historical metadata/state consistently (`metadata is not found` or a missing trie node),
and mainnet subsequently returned an HTTP 403 challenge. This report therefore preserves and distinguishes the exact
successful pins instead of combining observations from different blocks. The inability to replay pruned public state
reinforces the separate exact-artifact fork requirement.

Primary sources:

- Robinhood's [network connection table](https://docs.robinhood.com/chain/connecting/) and
  [full-node/ArbOS page](https://docs.robinhood.com/chain/run-a-full-node/);
- official mainnet and testnet chain-info JSON linked by Robinhood's full-node page:
  [mainnet](https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-chain-info.json)
  and
  [testnet](https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-chain-testnet-info.json);
- Offchain Labs' pinned `ArbSys`
  [`arbOSVersion`](https://github.com/OffchainLabs/nitro-precompile-interfaces/blob/e7e6566ae5b0efa0ad4d779138f64ead11928c66/ArbSys.sol#L30-L38),
  `ArbGasInfo`
  [`getMaxTxGasLimit`](https://github.com/OffchainLabs/nitro-precompile-interfaces/blob/e7e6566ae5b0efa0ad4d779138f64ead11928c66/ArbGasInfo.sol#L50-L61)
  and
  [`getMaxBlockGasLimit`](https://github.com/OffchainLabs/nitro-precompile-interfaces/blob/e7e6566ae5b0efa0ad4d779138f64ead11928c66/ArbGasInfo.sol#L130-L136),
  plus the
  [owner-setter surface](https://github.com/OffchainLabs/nitro-precompile-interfaces/blob/e7e6566ae5b0efa0ad4d779138f64ead11928c66/ArbOwner.sol#L154-L163)
  showing those limits can change; and
- Offchain Labs' exact geth submodule's
  [Cancun activation](https://github.com/OffchainLabs/go-ethereum/blob/f3a977ddf30b138da2fe673ac5cbff2bc6dd4c88/params/config.go#L845-L850)
  and
  [opcode table](https://github.com/OffchainLabs/go-ethereum/blob/f3a977ddf30b138da2fe673ac5cbff2bc6dd4c88/core/vm/jump_table.go#L110-L118),
  which make ArbOS 20+ Cancun-active and enable EIP-1153 and EIP-5656, together with the canonical
  [EIP-1153](https://eips.ethereum.org/EIPS/eip-1153) semantics; and exact Nitro/geth parent-number flow through
  [`L1IncomingMessageHeader.BlockNumber uint64`](https://github.com/OffchainLabs/nitro/blob/3599acae1ad2fab4059fc46453c9cd3294126641/arbos/arbostypes/incomingmessage.go#L51-L68),
  [`StorageBackedUint64`](https://github.com/OffchainLabs/nitro/blob/3599acae1ad2fab4059fc46453c9cd3294126641/arbos/blockhash/blockhash.go#L16-L30),
  the [transaction-processor hook](https://github.com/OffchainLabs/nitro/blob/3599acae1ad2fab4059fc46453c9cd3294126641/arbos/tx_processor.go#L915-L929),
  and geth's [`NUMBER` opcode](https://github.com/OffchainLabs/go-ethereum/blob/f3a977ddf30b138da2fe673ac5cbff2bc6dd4c88/core/vm/instructions.go#L478-L485).

### E-11 — Compiler and dependency disposition

Foundry/Hardhat settings agree on Solidity 0.8.26, Cancun, optimizer 10,000, and no `viaIR`. The official 0.8.26 bug
entries `UnsoundSpillInMutualRecursion` and `LostStorageArrayWriteOnSlotOverflow` require triggers absent from the
reviewed source. OpenZeppelin 5.6.1 usage was traced for SafeERC20, Votes/ERC5805, EIP-712/permit, ReentrancyGuard, and
Math.mulDiv. No applicable official advisory or imported vulnerable `Bytes` path was found. This is a narrow usage
disposition, not a compiler/library correctness proof.

## Analyzer, mutation, external fuzz, and repository gates

### E-12 — Static analysis and policy checks

The repository's 66 analyzer/policy/checker unit tests pass. The static tools installed and version-verified as Slither
0.11.5, Aderyn 0.6.8, Semgrep 1.162.0, and Gitleaks 8.30.1. On this Darwin arm64 host the resolver deliberately labels
Python analyzers a top-level-version engineering fallback rather than the Linux/Python 3.10 hash-locked release
environment; this run cannot become release-eligible.

The integrated current-tree run completed all analyzers but exited **1** at its policy gate. Slither emitted 60 raw
candidates; Aderyn emitted 14 high-bucket and 31 low-bucket instances; Semgrep emitted zero findings across six rules
and 17 Solidity files; Gitleaks found zero leaks across 79 commits; Forge verified all 18 production artifacts and a
largest runtime of 9,816 bytes; storage layouts were extracted for all 11 requested contracts; the dependency policy
reported zero high/critical advisories (three low and one moderate); and the license review passed. Manual tracing found
no additional plausible principal-loss or exit-bricking issue. The integrated gate remains red because the reviewed
static disposition register expired on 2026-08-23 and lacks a current rationale for the new
`aderyn:missing-inheritance` instance. Its 56 old entries do not cover the current 105 normalized instances. The first
run also caught three comment-only `max-line-length` errors introduced by the remediation; those were fixed and the
standalone contract lint then passed. Raw scanner output is triage only, and the stale disposition register remains an
evidence/release blocker rather than being silently renewed.

### E-13 — Mutation campaign

The final pre-ADR-0053 campaign killed **59/59** checked-in mutants: all 59 were test-killed, none survived,
and no equivalent classification was recorded. The contemporaneous identical reports had SHA-256
`d86248b6724ce17249c99cf7710a5861f1377f47ff7a556bcef5e58deda1a95a`, as preserved in `commands.log`. The mutable
`signal-resonance-mutation-all.json` path was later refreshed by E-16's 70-mutant campaign, while
`signal-resonance-mutation-latest.json` was refreshed again by E-19's focused eight-Mine-mutant campaign. Neither path
still contains those historical 59-mutant bytes. In addition to the original SignalGBX, Resonance,
Strategy, Bribe, and policy operators, the 59-mutant set killed operators that disable scalar exit, disable the new
Resonance lifetime cap, enumerate global Strategies during scalar removal, couple Mine replacement to Router routing,
couple a broken Bribe transfer to signal removal, exclude pending Mine emission from Fund's denominator, remove Fund's
final selected-balance pass, and retain EIP-1153 duplicate marks.

This is focused coverage, not a protocol-wide mutation score or a proof that no semantically equivalent operator is
missing. The complete manifest and targeted test for every mutant remain checked-in review evidence.

### E-14 — External fuzzers and symbolic/formal tooling

The exact Medusa 1.5.1 campaign reached its transaction limit after 100,669 calls and 3 minutes 30 seconds. All 26
properties and 44 assertion tests passed (70/70), with 3,430 branches and a 90-entry corpus. The Foundry integration
harness separately passed 10/10 tests, including 256 random action sequences. Installed Medusa 1.5.1 exposes no seed
flag in `medusa fuzz --help` and the checked configuration has no seed field, so this campaign has no recordable seed
and is not bit-for-bit seed-reproducible. Its exact config, command, transaction limit, resulting corpus statistics, and
temporary 93-file corpus manifest SHA-256
`e0759816d6eaadaca84deb1f6ff55906c25f7745b975221bf34722c1231f3199` are recorded as bounded evidence; the temporary
corpus itself is not a committed release artifact.

The local Echidna 2.3.3 alternative is **not a pass**: both four-worker and one-worker runs discovered all 26 properties
but crashed with `Set.elemAt: index out of range` at zero calls (`0/26` tests, `0/100000` fuzz progress). Echidna's
misleading exit zero/JSON success was rejected by the repository checker. The exact pinned Echidna 2.3.2 container and
pinned Mythril 0.24.8 container cannot run because Docker is unavailable. The Mythril checker also fails closed before
launch on unresolved constructor immutables and runtime `MCOPY`, `TLOAD`, and `TSTORE` opcodes. CodeQL and Halmos are
absent. These gaps reduce external-tool diversity but do not replace the public-path PoCs, manual traces, differential
models, full-strength Foundry escapes, or the successful Medusa campaign.

### E-15 — ABI, documentation, packages, and workspace gates

The pre-ADR-0053 internal engineering matrix completed. Expected fail-closed release/configuration gates are reported
as blockers rather than rewritten to green; E-16 records the post-ADR-0053 refresh without altering these historical
receipts.

| Gate                                             | Recorded pre-ADR-0053 result                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen lockfile install                          | **PASS**, 1.73 seconds observed                                                                                                          |
| `forge fmt --check`; `forge build --sizes`       | **PASS**; largest runtime was Resonance at 9,816 bytes                                                                                   |
| Contracts compile; Hardhat                       | **PASS**; Hardhat 4/4 including bytecode parity                                                                                          |
| Contracts gas, integration, lint/order/typecheck | **PASS**; integration 10/10, including 256 random action sequences                                                                       |
| SDK ABI and tests                                | **PASS**; ABI current and 52/52 tests                                                                                                    |
| Subgraph ABI/codegen/build/spec/Matchstick       | **PASS**; nine ABIs, 5/5 specs and 9/9 Matchstick tests                                                                                  |
| Audit infrastructure tests                       | **PASS**, 66/66 Node tests                                                                                                               |
| Documentation generation/check                   | **PASS** on the final report tree                                                                                                        |
| Root lint/typecheck/build                        | **PASS**                                                                                                                                 |
| Root `pnpm test`                                 | **PASS**, 9/9 Turbo tasks; E-07 records the 358/358 Foundry result                                                                       |
| Web end-to-end                                   | **PASS**, 36/36                                                                                                                          |
| Root format                                      | **EXPECTED FAIL**, eight pre-existing/out-of-scope paths listed below; audit files and Solidity formatting pass                          |
| Current release manifest                         | **EXPECTED FAIL CLOSED** because retained tooling describes the removed graph and external governance remains unselected                 |
| Exact target fork evidence                       | **BLOCKED**: no configured `ROBINHOOD_TESTNET_RPC_URL`, and public RPC evidence did not provide the exact artifact-capable pinned replay |

The root format command named six unchanged `apps/landing` files, unchanged `pnpm-lock.yaml`, and the unrelated
untracked `tmp/videos/gumball6900-cinematic-80s/SHOT-LIST.md`. They were preserved rather than reformatted. The exact
paths and every command result are in `commands.log`.

### E-16 — Post-ADR-0053 internal verification

Status: **Remediated and internally verified in the working tree; independent closure, deployment authorization, and
user-fund authorization remain pending.**

The current CEX-02 proof surface passed at these exact locations:

- `HistoricalFindings.t.sol:110-138::test_Regression_ThirdPartyClaimsCannotForceFractionalAccountCheckpoints`
- `Bribe.t.sol:246-262::test_OnlyTheBeneficiaryOrResonanceCanInitiateAClaim`
- `Resonance.t.sol:308-324::test_DirectBribeClaimsAreBeneficiaryAuthorized`
- `Resonance.t.sol:326-352::test_BatchClaimsCanonicalLiveKilledAndDuplicateStrategyBribesForTheCaller`
- `Resonance.t.sol:354-373::test_ContractWalletCanSelfClaimDirectlyAndThroughTheBatchEntrypoint`
- `Resonance.t.sol:375-400::test_BatchAlwaysClaimsForTheCallerAndValidatesEveryStrategyAtomically`
- `Resonance.t.sol:402-438::test_BrokenTokenRevertsTheBatchWhileDirectScalarClaimsRemainAvailable`
- `Adversarial.t.sol:439-466::test_AHostileRewardTokenCannotReenterResonanceBatchClaims`
- `AuditGas.t.sol:187-195::test_Gas_BribeScalarAndAllTokenClaimsAtMaximumRegistry`
- `AuditGas.t.sol:197-214::test_Gas_ResonanceTwoStrategyBatchAtMaximumRewardRegistries`
- `AuditGas.t.sol:216-253::test_Gas_ThirtyTwoStrategyClaimBatchRollsBackThenSucceedsWhenSplit`

The preserved starting-source PoC remains
`reproductions/CEX-02-original-f991253.t.sol.disabled::test_ThirdPartyClaimsForceFractionalAccountCheckpoints` and is not
misrepresented as a current passing test.

| Gate                                 | Recorded post-ADR-0053 result                                                                                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full Foundry                         | **PASS, 367/367 across 29 suites in 1,806.00 seconds**                                                                                                                                                                            |
| `ProtocolInvariantsTest`             | **PASS, 32/32 total:** 30 invariant properties at 1,000 runs × 500 depth (500,000 handler calls per property) plus two deterministic reachability tests; 31/31 selectors reached, zero reverts/discards in the invariant campaign |
| Hardhat and compiler parity          | **PASS, 4/4**, including Foundry/Hardhat bytecode parity                                                                                                                                                                          |
| Integration campaign                 | **PASS, 10/10** `CampaignHarnessTest` tests at 256 fuzz runs                                                                                                                                                                      |
| Claim gas                            | Scalar Bribe claim 101,450; direct sixteen-token all-claim 1,531,568; two-Strategy × sixteen-token Resonance batch 2,595,616                                                                                                      |
| Oversized batch fallback             | The 32-Strategy 32M-capped attempt used 32,001,055 gas and reverted atomically; subsequent split batches succeeded                                                                                                                |
| Corrected complete mutation campaign | **PASS, 70/70 test-killed**, zero survivors, zero errors, 315.62 seconds                                                                                                                                                          |
| SDK                                  | **PASS, 52/52**, plus typecheck, pack, and ABI checks                                                                                                                                                                             |
| Subgraph                             | **PASS**, ABI/build checks and 9/9 Matchstick tests                                                                                                                                                                               |
| Documentation                        | **PASS**, generate and check                                                                                                                                                                                                      |
| Simulations                          | **PASS**, TypeScript 28/28, Python 22/22, environment 5/5, fixtures and charts                                                                                                                                                    |
| Web E2E                              | **PASS, 36/36**                                                                                                                                                                                                                   |
| Root static package gates            | **PASS**, lint, typecheck, and build                                                                                                                                                                                              |
| Forge formatting and sizes           | **PASS**; Bribe runtime 5,864 bytes and Resonance runtime 10,417 bytes                                                                                                                                                            |
| Final root `pnpm test`               | **PASS**, 9/9 Turbo tasks, 2 cached, in 27m2.477s; Foundry 367/367 across 29 suites in 1,621.73s wall / 3,352.36s CPU                                                                                                             |
| Repository-wide format               | **OPEN** only for eight unrelated pre-existing paths; scoped files and Forge formatting are clean                                                                                                                                 |

E-16's preserved `signal-resonance-mutation-all.json` report has SHA-256
`b3fde58750ab76d66a67f0e8f2bf8db473fd3ca5b351d34f24da29e892a0ec0a`. E-19 later replaced the mutable
`signal-resonance-mutation-latest.json` path with the focused Mine report; that file and the retained
`signal-resonance-mutation-mine.json` both have SHA-256
`3bb170d28dd37c0348a72de7c18717b3116227271b32900b9cacc4fd7770fd2c`.

The duplicate-containing batch regression proves that duplicate entries are accepted and that a later distinct entry
still executes. Sequential repeated invocation is also the direct source-loop behavior, but the test cannot observe a
second zero-entitlement Bribe call independently and E-16's pre-ADR-0055 70-mutant manifest had no dedicated
internal-dedup operator.

This receipt does not claim a post-ADR-0053 Medusa, Echidna, static-analysis, symbolic-execution, formal-verification,
or independent-review result. The older campaigns remain accurately labeled as pre-ADR-0053 evidence.

### E-17 — Post-prefunding ADR-0054 contract and launcher-fork validation

Status: **Historical internal contract, pinned-fork, final root, and follow-up SDK validation passed for the preceding
Pair-adoption/skim launcher; production bytecode changed afterward.**

The launcher regression covers one raw USDG unit sent before launch to the launcher and to the predicted
ResonanceRouter and Resonance addresses. It proves the launcher amount becomes Fund backing, the Router and Resonance
amounts retain their ordinary direct-donation semantics, Resonance schedule accounting remains pristine, and the Pair
retains its exact fixed balances, reserves, supply, and zero-address LP lock. The source review found no new owner,
arbitrary destination, public sweep, or continuing launcher authority.

| Gate                                       | Historical post-prefunding ADR-0054 result                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-invariant Foundry                      | **PASS, 354/354 across 29 suites**, zero failures or skips                                                                                                                   |
| `ProtocolInvariantsTest`                   | **PASS, 32/32 total:** 30 invariant properties at 1,000 runs × 500 calls plus two deterministic reachability tests; 15,000,000 handler calls, zero reverts, 1,357.63 seconds |
| Composite Foundry count                    | **PASS, 386/386**, the sum of the separately configured non-invariant and invariant results rather than one default-profile invocation                                       |
| Focused launcher                           | **PASS, 16/16**, including predictable launcher/Router/Resonance USDG prefunding                                                                                             |
| Focused Mine                               | **PASS, 24/24**, including both 10,000-run fuzz tests                                                                                                                        |
| Hardhat and compiler parity                | **PASS, 4/4**, including Foundry/Hardhat bytecode parity                                                                                                                     |
| Integration campaign                       | **PASS, 10/10** at 256 fuzz runs                                                                                                                                             |
| Forge formatting, build, and contract lint | **PASS**; four long-salt-string lint warnings remained non-failing                                                                                                           |
| Launcher runtime                           | **23,676 bytes**, leaving **900 bytes** below EIP-170                                                                                                                        |
| Pinned Robinhood fork                      | **PASS, 1/1** at block `50,125,267`, hash `0x98c12175a4f9e303ef8c1e0ed2af91371df5210f1ce1c34217cfce2ad183020b`, timestamp `2026-08-30T15:44:01Z`                             |
| Isolated launch gas                        | **22,862,200**, leaving **9,137,800** below the observed mutable 32,000,000 transaction ceiling                                                                              |
| Complete fork-test gas                     | **41,603,390**, including test-only module, launcher, and governance setup; not a production-transaction requirement                                                         |
| Final root `pnpm test`                     | **PASS, 9/9 Turbo tasks in 21m21.089s**; Forge **386/386 across 30 suites in 1,280.39 seconds**                                                                              |
| Post-root SDK follow-up                    | **PASS, 53/53 plus typecheck** after adding zero-launcher validation                                                                                                         |
| Final read-only review                     | Two Low caller/documentation issues corrected; **no new protocol or runtime finding**                                                                                        |

The configured invariant result was observed from
`FOUNDRY_PROFILE=invariant forge test --match-contract ProtocolInvariantsTest`; the reproducible command form and
result are recorded, but this bundle does not claim to preserve an exact shell transcript for that long-running call.
The refreshed `22,862,200` isolated-launch measurement supersedes the earlier pre-prefunding `22,860,635` figure, which
remains historical in `commands.log`.

The final root run covered the same metadata-free production Solidity bytecode recorded in E-17. Afterward, review
identified two Low caller/documentation issues: the SDK builder needed zero-launcher validation and matching wording,
and the `Launched` event NatSpec summary needed clarification. Both were corrected. The NatSpec-only Solidity change
and SDK validation change did not alter production bytecode; the SDK follow-up passed 53/53 tests plus typecheck. Final
read-only review found no new protocol or runtime issue at that checkpoint. The later create-only Pair simplification
did change production bytecode, so the E-17 counts, size, root result, fork result, and gas measurements are historical.

No additional post-ADR-0054 ABI check, mutation, static-analysis, external-fuzzer, symbolic, formal, or independent-review
result is claimed by E-17. Remaining subgraph, documentation, simulation, web, workspace, and release gates retain their
separate checklist status unless explicitly recorded elsewhere. No transaction was broadcast and no deployment,
funding, approval, ownership transfer, commit, push, or publication occurred.

### E-18 — Historical pre-ADR-0055 create-only Pair launcher validation

Status: **Focused, non-invariant, build-size, pinned-fork, and final SDK checks passed at that checkpoint; invariant,
final-root, and remaining workspace/release reruns were pending before ADR 0055 changed production source.**

Every successful launch now calls the pinned Factory's `createPair` for caller-scoped GBX and USDG. The launcher never
adopts or skims an existing Pair. Focused regressions prove that a Factory-precreated Pair reverts atomically with
`PairAlreadyExists`, while USDG sent to the not-yet-created deterministic Pair address reverts on
`LaunchInvariantFailed(PAIR_USDG_DEPOSIT)`. Both preserve the launcher's unused state; a fresh launcher derives a
different caller-scoped GBX/Pair and launches successfully. The distinct predictable-address USDG behavior remains:
launcher-held USDG is forwarded to Fund, while prefunded
ResonanceRouter and Resonance balances retain their ordinary buffer/direct-donation semantics without entering
Resonance's schedule during launch.

| Gate                                 | Recorded E-18 create-only result                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused launcher                     | **PASS, 16/16**, including distinct precreated- and counterfactual-prefund failure paths, fresh-launcher recovery, and component USDG prefunding |
| Non-invariant Foundry                | **PASS, 354/354 across 29 suites**                                                                                                               |
| Launcher runtime                     | **22,762 bytes**, leaving **1,814 bytes** below EIP-170                                                                                          |
| Pinned Robinhood fork                | **PASS, 1/1** at block `50,125,267`, hash `0x98c12175a4f9e303ef8c1e0ed2af91371df5210f1ce1c34217cfce2ad183020b`                                   |
| Isolated launch gas                  | **22,853,567**, leaving **9,146,433** below the observed mutable 32,000,000 transaction ceiling                                                  |
| Complete fork-test gas               | **41,411,361**, including test-only module, launcher, and governance setup; not a production-transaction requirement                             |
| SDK ABI generation/check and clients | **PASS:** final ABI generation/check, SDK typecheck, and **53/53** tests                                                                         |
| Configured invariant/reachability    | **Was pending.** E-17's 32/32 result was not combined into a new E-18 total                                                                      |
| Final root `pnpm test`               | **Was pending.** E-17's 9/9 Turbo and 386/386 Forge receipt was already historical after the production-bytecode change                          |

The exact E-17 transcripts and observed receipts remain preserved below in `commands.log`. E-18 does not claim a new
composite Foundry total, Hardhat or integration rerun, final root result, external-fuzzer,
static-analysis, symbolic, formal, independent-review, deployment, or release result. No transaction was broadcast and
no deployment, funding, approval, ownership transfer, commit, push, or publication occurred.

### E-19 — Current ADR-0055 migration and two-step-ownership validation

Status: **Current contract, consumer, documentation, and one fresh pinned-fork campaign passed; aggregate workspace
format/test receipts, static/formal/external review, governance selection, and release evidence remain open.**

This campaign exercises Mine's sole governed Router setter, reciprocal replacement-graph validation, immutable Fund
identity, future-deposit cutover, old-graph call independence, and old-exit/new-signal workflow. It also exercises
Mine and Resonance two-step ownership, the launcher's two pending-owner assignments, separate acceptance of both, and
renunciation of the three plain-`Ownable` setup shells.

| Gate                               | Current ADR-0055 result                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full configured Foundry            | **PASS, 393/393 across 30 suites**, including **32/32** invariant/reachability tests; 30 invariants ran at 1,000 runs x 500 calls with zero handler reverts                       |
| Focused Mine                       | **PASS, 30/30**, including 10,000 fuzz runs per configured fuzz test                                                                                                              |
| Focused launcher                   | **PASS, 17/17**                                                                                                                                                                   |
| Hardhat and artifact parity        | **PASS, 4/4**, including Foundry/Hardhat bytecode parity                                                                                                                          |
| Focused Mine mutation              | **PASS, 8/8 Mine mutants test-killed**: one pre-existing routing operator plus seven ADR-0055 operators; this is not a fresh complete 77/77 run                                   |
| Separate integration profile       | **PASS, 10/10**, including 256 fuzzed 12-action sequences                                                                                                                         |
| Build and size                     | **PASS**; launcher runtime **23,471 bytes**, leaving **1,105 bytes** below EIP-170; Mine **9,555 bytes** and Resonance **10,671 bytes**                                           |
| Fresh Robinhood dependency fork    | **PASS, 1/1** at block `50,340,734`, hash `0x36700202ad39596aae93f0858f717b840754c25007960373a684da857d23b52e`; isolated `launch` gas **23,437,200**                              |
| SDK                                | **PASS:** ABI generation/check, typecheck/build/package dry-run, generated docs, and **55/55** tests, including `claimedStatus`, legacy-key rejection, and claimed-only selection |
| Subgraph                           | **PASS:** ABI sync, codegen/spec/build, and **11/11** tests                                                                                                                       |
| Simulations                        | **PASS:** TypeScript **28/28**, Python environment **5/5**, Python **22/22**, fixture and chart checks; rerun used the repository-compatible Python 3.11 environment              |
| Web and repository build gates     | **PASS:** web unit **32/32**, web E2E **36/36**, and root lint/typecheck/build                                                                                                    |
| Documentation generation/checks    | **PASS** for contract docs and compact/long-form whitepaper/article fact, stale-language, contrast, layout, and PDF gates; one-page layout is separate below                      |
| Aggregate root `pnpm test` receipt | **Open:** the shell initially selected Python 3.14 without the required packages; every affected package gate was rerun successfully with the compatible Python 3.11 environment  |
| Repository-wide Prettier           | **Open:** eight unrelated pre-existing files still fail; every ADR-0055-touched file, Forge formatting, and `git diff --check` pass                                               |
| One-page PDF layout                | **Open, pre-existing:** frame overflow by 9 px, rules by 4.3 mm, and note by 2.4 mm; no layout redesign was made                                                                  |

The fork uses a code-bearing governance fixture, not a selected or reviewed production executor. It validates launch,
the pending-owner state, and both acceptance calls against real USDG and Factory dependencies at one pin; it does not
perform a later Router cutover on the dependency fork. Local tests cover cutover, candidate-identity rejection,
unchanged old-graph state, old signal exit, and new-graph signaling. Getter consistency does not authenticate bytecode,
proxy administration, governance, Strategy/Bribe configuration, or economics.

No fresh complete 77-mutant campaign, current Medusa/Echidna success, compatible symbolic or formal proof, independent
review, signed manifest, production-governance integration, ownership receipt, transaction broadcast, deployment,
funding, commit, push, or release is claimed by E-19.

## Evidence limitations

- The reviewed base is commit-bound; the remediation is an uncommitted tree until the user chooses to commit it. The
  sealed E-01 through E-18 evidence records its then-current `git status`, UTC snapshot, tracked binary-patch SHA-256,
  deterministic ADR/audit-test manifest SHA-256, and non-self-referential report-manifest SHA-256. `findings.json` and
  `commands.log` carry those historical identities and are deliberately excluded from their own recorded report hash
  to avoid self-reference. E-19 is not resealed into those hashes or the complete command transcript.
- No transaction was broadcast, no live contract was deployed, and no role or ownership was transferred.
- No current signed manifest, governance executor, ownership receipt, or exact deployed-runtime record exists.
- No test proves CEX-03 current-state position discovery because production has no such state surface.
- The 0-reward signal-removal test uses an isolated noncanonical Bribe; every canonical Strategy begins with its
  payment token registered, so canonical live/killed tests cover 1 and 16 rewards.
- Green tests and tools cannot prove absence of undiscovered defects.
