# Audit tooling and internal evidence

This directory contains pinned analyzer runners, state-machine harnesses, and internal production-hardening evidence
for the current eleven-contract direct core. The committed analyzer and broad campaign records predate ADR 0047's reward and
Strategy-settlement simplification and ADR 0048's sixteen-token/composed-move change unless a file explicitly says
otherwise; ADR 0050 subsequently removed LiquidityPosition and changed GBX to zero-premint issuance, so they must be
regenerated and manually reviewed before the current gates can pass. Raw tool output belongs
under the ignored `audit/reports` directory; reviewed conclusions belong in the tracked Markdown records and policy
JSON. On 2026-08-24, the current uncommitted post-ADR-0050 tree passed 293/293 default-profile Foundry tests, all 27
stateful invariant entries at 1,000 runs of depth 500 with zero handler reverts, 10/10 integration tests, and 4/4
Hardhat tests including bytecode parity. Contract lint, ordering, formatting, build, size, generated-documentation,
and SDK ABI checks also passed. The focused ADR-0048 migration suites passed 104/104 and its revised focused mutation
campaign killed 47/47 mutants; both focused results predate ADRs 0049 and 0050. None of this substitutes for the
outstanding wider workspace, analyzer, external-fuzzer, current mutation, or independent-review gates.

The material is internal engineering evidence, not an independent audit, legal clearance, deployment authorization,
or a claim that the protocol is safe for unlimited value. ADR 0024's unsuperseded Mine decisions, together with ADR
0033 and ADRs 0038–0045, as modified by ADR 0049, are authoritative for Mine. Under ADRs 0044 and 0049, Mine ends
after its nominal protocol-revenue transfer request into ResonanceRouter succeeds; a later permissionless `route()`
has no caller role, bounty, or liveness guarantee. ADR 0050 removes the liquidity-specific core contract; an external
fungible Uniswap v2-style USDG/GBX LP ERC-20 may instead be registered through the ordinary Strategy path. ADR 0047
preserves ADR 0036's global 0%–20% Bribe share but makes each Strategy floor its purchase independently, pay the Fund
complement directly, and transfer only the Bribe share to a Bribe-only Router. Resonance and Bribe use
scalar/registered-token Synthetix leftover rollover respectively; rate, index, and account floors remain surplus,
with no queue, pause, carry, Fund reward liability, or selected-batch claim. Bribes remain independently fundable,
and Fund-held GBX is burned permissionlessly before redemption rather than during a Strategy fill. ADR 0048 raises
the fixed Bribe reward-token bound to sixteen and removes Resonance's dedicated move hook; SignalGBX composes the
retained remove/add hooks atomically.

## Record status and navigation

- Current implementation targets and risk registers: `INDEPENDENT-SPECIFICATION.md`,
  `SIGNAL-RESONANCE-SPEC.md`, `FINDINGS.md`, `RESIDUAL-RISKS.md`, and
  `SIGNAL-RESONANCE-RESIDUAL-RISKS.md`.
- Current gate and bounded-evidence status: `RELEASE-CHECKLIST.md`, `FORMAL-CHECKS.md`,
  `FORK-VALIDATION.md`, `MUTATION-TESTING.md`, and `KILLED-STRATEGY-BRIBE-DECISION.md`. These files identify
  which results predate ADRs 0049 or 0050 and therefore do not clear the current graph.
- Explicitly historical records: `AUDIT-BASELINE.md`, `EXTERNAL_FUZZING.md`, `INTERNAL-AUDIT.md`,
  `PRODUCTION-HARDENING-BASELINE.md`, `SIGNAL-RESONANCE-DEVIATIONS.md`,
  `SIGNAL-RESONANCE-FINDINGS.md`, `SIGNAL-RESONANCE-MUTATION.md`,
  `SIGNAL-RESONANCE-TEST-CAMPAIGN.md`, `SIGNAL-RESONANCE-THREAT-MODEL.md`, `STATIC-ANALYSIS.md`,
  `TEST-CAMPAIGN.md`, and `UNISWAP-V4-REVIEW.md`. Their old contracts, APIs, counts, and conclusions remain only as
  dated evidence.
