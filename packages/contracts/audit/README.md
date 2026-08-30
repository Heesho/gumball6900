# Audit records and tooling

The V12 external-audit intake targets commit `3ae171b997254b56602298d873b3918d1575b3c7`. ADR 0051's signal batching,
ADR 0052's Resonance lifetime cap, ADR 0053's Bribe authorization/claim batch, ADR 0054's Mine genesis issuance and
atomic launcher, and ADR 0055's Mine Router migration and two-step ownership are later development work and are
explicitly outside that V12 scope. A separately
supplied ChatGPT direct review targets `f9912533e999454f1a3fd49276558bd85e1390da`; it is candidate-finding input, not an
independent audit or clearance.

ADR 0053/CEX-02 is remediated and internally verified in the working tree. The deterministic, stateful, gas, mutation,
ABI-consumer, and workspace-component receipts recorded as E-16 in the exitability bundle predate ADR 0054 and remain
historical. E-17 records the post-prefunding ADR-0054 contract matrix and refreshed launcher fork without rewriting the
older receipts, but it covers the earlier Pair-adoption/skim launcher bytecode. E-18 records the then-current create-only
launcher delta, focused and non-invariant results, build size, refreshed pinned fork, and SDK checks. E-18 predates ADR 0055. E-19 records the current configured Foundry/invariant, Hardhat parity, focused mutation, consumer, documentation,
simulation, web, build-size, and fresh pinned-fork campaign for the Mine/Resonance `Ownable2Step`, Router replacement,
and two-pending-owner launch delta. Independent closure, external-governance selection, complete aggregate workspace
receipts, deployment authorization, and user-fund authorization remain pending.

CEX-05's SDK naming ambiguity is also remediated in the working tree: deployment metadata now uses `claimedStatus`,
selection uses `requireClaimedReleaseApproved`, generated docs explicitly deny authentication, and the strict schema
rejects the legacy `status` key. SDK 55/55, typecheck, build, package dry-run, and docs checks pass. This does not replace
the signed-manifest and live-graph verification required before production.

- `FINDINGS.md` is the tracked independent disposition register for the 22 findings received from V12 on 2026-08-25.
- `reports/v12-2026-08-25-3ae171b-export.md` is the byte-for-byte received export. Raw reports remain ignored by Git;
  its SHA-256 is recorded in `FINDINGS.md`.
- `codex-exitability-2026-08-29-f991253/` contains the current internal liveness/exitability evidence and the itemized
  ChatGPT-source intake. Its CEX register currently counts eight confirmed findings and one rejected candidate.
- `reports/chatgpt-direct-security-audit-2026-08-29-f991253.md` is the byte-for-byte supplied ChatGPT source; its SHA-256
  and every disposition are recorded in the bundle and `FINDINGS.md`.
- `INDEPENDENT-SPECIFICATION.md`, `SIGNAL-RESONANCE-SPEC.md`, the residual-risk files, and the gate records describe
  current protocol constraints or unresolved readiness work. They are not independent-audit conclusions.
- Analyzer runners, checker tests, policy files, toolchain locks, and `harness/ProtocolStateMachineCampaign.sol` remain
  active repository infrastructure. Their output is not current evidence unless a dated tracked record says so.

E-17 historically records a post-prefunding ADR-0054 contract campaign: 354/354 non-invariant Foundry tests across 29
suites, 32/32 configured `ProtocolInvariantsTest` tests, a 386/386 composite total, 16/16 launcher tests, 24/24 Mine
tests, 4/4 Hardhat tests, and 10/10 integration tests. That earlier launcher was 23,676 runtime bytes, and its
non-broadcast fork passed 1/1 at explicit Robinhood block `50,125,267` with a measured `22,862,200`-gas `launch` call.
The associated root `pnpm test` passed 9/9 Turbo tasks, with Forge 386/386 across 30 suites. Those receipts are preserved
but are not current coverage because the production launcher now always calls `Factory.createPair` and no longer
adopts or skims an existing Pair.

E-18 records 16/16 focused launcher tests and 354/354 non-invariant Foundry tests across 29 suites for the pre-ADR-0055
create-only source. That launcher is 22,762 runtime bytes. A refreshed non-broadcast fork passed 1/1 at Robinhood block
`50,125,267`, measuring
`22,853,567` gas for `launch`. It covers the create-only Pair path, `PairAlreadyExists` for a Factory-precreated Pair,
`LaunchInvariantFailed(PAIR_USDG_DEPOSIT)` for counterfactual Pair-address USDG prefunding, successful recovery through
a fresh launcher with a different caller-scoped GBX/Pair, and the distinct launcher/ResonanceRouter/Resonance
USDG-prefunding semantics. Final SDK ABI regeneration/check, SDK typecheck, and 53/53 tests passed. At the E-18
checkpoint, the configured invariant campaign and final root `pnpm test` remained pending; no composite total is formed
by combining those historical receipts. All E-18 results are now historical relative to the ADR-0055 production source.

E-19 records 393/393 configured Foundry tests across 30 suites, including the 32/32 invariant/reachability campaign;
30/30 focused Mine tests; 17/17 launcher tests; Hardhat 4/4 with bytecode parity; integration 10/10; 8/8 focused Mine
mutants; SDK 55/55; subgraph 11/11; and the applicable simulation, web, documentation, lint, typecheck, and build checks. A fresh
non-broadcast fork passed 1/1 at Robinhood block `50,340,734`, measuring `23,437,200` gas for the current `launch` call,
and the launcher runtime is 23,471 bytes. The aggregate root test receipt remains open because the initial shell selected
an incompatible Python 3.14 environment, although every affected package gate passed when rerun with the compatible
Python 3.11 environment. Repository-wide Prettier and the known one-page PDF layout gate also remain open for unrelated
pre-existing files/layout. No complete 77/77 mutation run, independent review, selected governance integration,
deployment, or release is claimed.

The prior raw analyzer output and the records explicitly labeled historical were removed when this audit was filed.
Git history remains the recovery source for those tracked records. `static-dispositions.json` is retained because the
static-analysis runner consumes it, but it is expired historical policy and must fail closed until a fresh campaign is
run and manually reviewed.

Nothing in this directory authorizes deployment, user funds, package publication, a public release, or a claim that the
protocol is safe. Production remains blocked by the open source, economic, external-governance, dependency, deployment,
manifest, and operational gates recorded in `FINDINGS.md` and `RELEASE-CHECKLIST.md`.
