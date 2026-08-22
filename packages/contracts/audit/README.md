# Audit tooling and internal evidence

This directory contains pinned analyzer runners, state-machine harnesses, and internal production-hardening evidence
for the direct core. The committed static disposition JSON predates ADR 0036's governed Bribe share and must be
regenerated and manually reviewed before the current static gate can pass. Raw tool output belongs under the
ignored `audit/reports` directory; reviewed conclusions belong in the tracked Markdown records and policy JSON.

The material is internal engineering evidence, not an independent audit, legal clearance, deployment authorization,
or a claim that the protocol is safe for unlimited value. ADR 0024's unsuperseded Mine decisions, together with ADR
0033 and ADRs 0038–0044, are authoritative for Mine. Under ADR 0044, Mine ends after exact protocol-revenue deposit
into ResonanceRouter; a later permissionless `route()` has no caller role, bounty, or liveness guarantee, while
LiquidityPosition retains its atomic route attempt. ADR 0036 is authoritative for uniform Strategy settlement: each
auction payment snapshots Resonance's global 0%–20% Bribe
share, preserves cumulative weighted carry, and classifies the complement to Fund. Bribes remain independently
fundable, and Fund-held GBX is burned permissionlessly before redemption rather than during a Strategy fill.
