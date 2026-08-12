# Audit tooling and internal evidence

This directory contains pinned analyzer runners, state-machine harnesses, and internal production-hardening evidence
for the direct 12-contract core. The committed static disposition JSON belongs to the superseded Fundraiser graph and
must be regenerated and manually reviewed before the current static gate can pass. Raw tool output belongs under the
ignored `audit/reports` directory; reviewed conclusions belong in the tracked Markdown records and policy JSON.

The material is internal engineering evidence, not an independent audit, legal clearance, deployment authorization,
or a claim that the protocol is safe for unlimited value. ADR 0024 is authoritative for Mine issuance, and ADR 0021
remains authoritative for uniform Strategy settlement: every auction payment is Fund-bound, Bribes are independently
funded, and Fund-held GBX is burned permissionlessly before redemption rather than during a Strategy fill.
