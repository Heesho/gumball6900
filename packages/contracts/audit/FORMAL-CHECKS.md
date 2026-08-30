# Formal and symbolic checks

The protocol is not formally verified.

Current executable evidence covers the GBX supply identity; tenure-locked slot accrual; fixed sixteen-slot topology;
constant-time pending-emission equivalence to all-slot summation; future-tenure time boundaries; exact Mine 80/20
replacement allocation and terminal ResonanceRouter deposit without synchronous downstream routing; per-purchase
Strategy classification at bounded 0%–20% rates; direct Fund payment; BribeRouter buffering; scalar Synthetix
Resonance scheduling; ordinary Bribe leftover rollover and surplus floors; Mine claim solvency; effective-supply Fund
redemption; signal identities; reward solvency; Strategy settlement; redemption snapshots; and ordinary
external-LP-token Strategy settlement without liquidity-specific core custody.
Independent TypeScript and Python models reproduce the mining formulas. The focused ADR-0048 migration suites passed
104/104 and exercised the sixteen-token bound and now-removed composed moves, but they predate ADRs 0049-0051 and are
tests, not mathematical proofs.

The 2026-08-30 exitability campaign did rerun current scalar/batch and periphery behavior through Foundry unit, fuzz,
differential, and 1,000-run-by-500-depth stateful tests; a 100,669-call Medusa 1.5.1 campaign; the 256-sequence Foundry
integration harness; and 59 mutation operators. Those are adversarial executable tests, not formal verification. Medusa
1.5.1 exposes no CLI/config seed control in the installed tool, so that successful campaign is transaction/corpus-bound
rather than seed-reproducible. The exact results and limitations are recorded in
`codex-exitability-2026-08-29-f991253/TEST-EVIDENCE.md`.

Those results predate ADR 0053. A separate post-ADR-0053 internal campaign passed the preserved before/after regression,
367/367 Foundry tests across 29 suites, and 32/32 total `ProtocolInvariantsTest` tests: 30 invariant properties at
1,000 runs × 500 depth (500,000 handler calls per property) plus two deterministic reachability tests. The invariant
campaign reached 31/31 selectors with zero reverts or discards. Hardhat 4/4 with bytecode parity, the 10/10 integration
campaign at 256 fuzz runs, the claim gas/rollback cases, and a corrected 70/70 test-killed mutation campaign also passed. Applicable SDK, subgraph,
documentation, simulation, web, lint, typecheck, and build checks also passed. These are executable internal receipts,
not formal or symbolic proof of the authorization or nested batch. No post-ADR-0053 Medusa, Echidna, static, symbolic,
formal, or independent-review result is claimed. The final root `pnpm test` rerun passed 9/9 Turbo tasks in 27m2.477s,
including 367/367 Foundry tests across 29 suites.

E-17 records the later post-prefunding ADR-0054 executable contract campaign. It passed 354/354 non-invariant Foundry
tests across 29 suites and 32/32 configured `ProtocolInvariantsTest` tests: 30 invariant properties at 1,000 runs × 500
calls plus two deterministic reachability tests, totaling 15,000,000 handler calls with zero reverts in 1,357.63
seconds. The separately configured results formed a 386/386 composite total. Launcher 16/16, Mine 24/24, Hardhat 4/4
with bytecode parity, integration 10/10 at 256 fuzz runs, and the final 9/9-task root run also passed. Those internal
receipts cover the earlier launcher that could adopt and skim a precreated Pair; they became historical when the
production launcher changed to a create-only `Factory.createPair` success path.

E-18 records a focused 16/16 `GBXLauncherTest` pass and 354/354 non-invariant Foundry tests across 29 suites against the
create-only bytecode. The focused suite covers `PairAlreadyExists` for a Factory-precreated Pair,
`LaunchInvariantFailed(PAIR_USDG_DEPOSIT)` for counterfactual Pair-address USDG prefunding, a successful fresh-launcher
retry with a different caller-scoped GBX/Pair, and the preserved launcher/ResonanceRouter/Resonance USDG-prefunding
distinctions. Build size and the refreshed pinned fork passed. At the E-18 checkpoint, the configured
invariant/reachability campaign and final root run remained pending; no composite count, external-fuzzer, symbolic,
formal, or independent-review result is implied. E-18 predates ADR 0055 and provides no coverage for Mine's Router
setter and validation graph, Mine/Resonance `Ownable2Step`, the launcher's two pending-owner assignments, or old/new
graph operations.

E-19 records the later current ADR-0055 executable campaign: 393/393 configured Foundry tests across 30 suites,
including the 32/32 invariant/reachability suite at 1,000 runs x 500 calls; Mine 30/30; launcher 17/17; Hardhat 4/4 with
bytecode parity; 8/8 focused Mine mutants; and the applicable consumer, documentation, simulation, web,
lint/typecheck/build, size, and fresh pinned-fork checks. The separate integration profile also passed 10/10, including
256 fuzzed 12-action sequences. The recorded tests cover the Router validation graph, future-deposit
cutover, old-Router call independence, old-exit/new-signal workflow, dual pending ownership, and separate acceptance.
They remain executable internal evidence, not formal proof. No current external-fuzzer success, compatible symbolic or
formal result, independent review, or complete 77-mutant campaign is claimed.

Mythril 0.24.8 remains a fail-closed compatibility blocker. Sound analysis requires constructor-resolved deployed
runtimes, while current output includes immutable references and Cancun instructions the pinned Mythril does not safely
support. The local Echidna 2.3.3 alternative crashed all workers before its first call, and the pinned 2.3.2 container
could not run without Docker. No Certora, Halmos, Kontrol, hevm symbolic, or Solidity SMTChecker proof covers the Mine
graph or the ADR-0051 scalar/batch surface.

The existing Solidity 0.8.26 compiler-bug review remains applicable: the build uses the legacy pipeline rather than
`viaIR`, has no mutual recursion, and does not place storage arrays near the `2**256 - 1` slot boundary. This narrow
review is not a general compiler correctness proof.
