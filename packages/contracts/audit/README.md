# Audit tooling and internal evidence

This directory contains pinned analyzer runners, state-machine harnesses, and internal production-hardening evidence
for the direct core. The committed analyzer and broad campaign records predate ADR 0047's reward and
Strategy-settlement simplification and ADR 0048's sixteen-token/composed-move change unless a file explicitly says
otherwise; they must be regenerated and manually reviewed before the current gates can pass. Raw tool output belongs
under the ignored `audit/reports` directory; reviewed conclusions belong in the tracked Markdown records and policy
JSON. The focused ADR-0048 migration suites pass 104/104 and its revised focused mutation campaign kills 47/47
mutants; neither substitutes for the outstanding broad campaigns or independent review.

The material is internal engineering evidence, not an independent audit, legal clearance, deployment authorization,
or a claim that the protocol is safe for unlimited value. ADR 0024's unsuperseded Mine decisions, together with ADR
0033 and ADRs 0038–0045, are authoritative for Mine. Under ADR 0044, Mine ends after exact protocol-revenue deposit
into ResonanceRouter; a later permissionless `route()` has no caller role, bounty, or liveness guarantee, while
LiquidityPosition retains its atomic route attempt. ADR 0047 preserves ADR 0036's global 0%–20% Bribe share but makes
each Strategy floor its purchase independently, pay the Fund complement directly, and transfer only the Bribe share
to a Bribe-only Router. Resonance and Bribe use scalar/registered-token Synthetix leftover rollover respectively;
rate, index, and account floors remain surplus, with no queue, pause, carry, Fund reward liability, or selected-batch
claim. Bribes remain independently fundable, and Fund-held GBX is burned permissionlessly before redemption rather
than during a Strategy fill. ADR 0048 raises the fixed Bribe reward-token bound to sixteen and removes Resonance's
dedicated move hook; SignalGBX composes the retained remove/add hooks atomically.
