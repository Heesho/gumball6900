# Audit records and tooling

The current external-audit intake targets commit `3ae171b997254b56602298d873b3918d1575b3c7`. ADR 0051 and its signal
batching/read-periphery changes are later development work and are explicitly outside that V12 scope.

- `FINDINGS.md` is the tracked independent disposition register for the 22 findings received from V12 on 2026-08-25.
- `reports/v12-2026-08-25-3ae171b-export.md` is the byte-for-byte received export. Raw reports remain ignored by Git;
  its SHA-256 is recorded in `FINDINGS.md`.
- `INDEPENDENT-SPECIFICATION.md`, `SIGNAL-RESONANCE-SPEC.md`, the residual-risk files, and the gate records describe
  current protocol constraints or unresolved readiness work. They are not independent-audit conclusions.
- Analyzer runners, checker tests, policy files, toolchain locks, and `harness/ProtocolStateMachineCampaign.sol` remain
  active repository infrastructure. Their output is not current evidence unless a dated tracked record says so.

The prior raw analyzer output and the records explicitly labeled historical were removed when this audit was filed.
Git history remains the recovery source for those tracked records. `static-dispositions.json` is retained because the
static-analysis runner consumes it, but it is expired historical policy and must fail closed until a fresh campaign is
run and manually reviewed.

Nothing in this directory authorizes deployment, user funds, package publication, a public release, or a claim that the
protocol is safe. Production remains blocked by the open source, economic, external-governance, dependency, deployment,
manifest, and operational gates recorded in `FINDINGS.md` and `RELEASE-CHECKLIST.md`.
