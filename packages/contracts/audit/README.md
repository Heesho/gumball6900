# Audit tooling and internal evidence

This directory contains the current pinned analyzer runners, exact finding dispositions, state-machine harnesses, and
internal production-hardening evidence for the direct 12-contract core. Raw tool output belongs under the ignored
`audit/reports` directory; reviewed conclusions belong in the tracked Markdown records and policy JSON.

The material is internal engineering evidence, not an independent audit, legal clearance, deployment authorization,
or a claim that the protocol is safe for unlimited value. ADR 0021 is authoritative for uniform Strategy settlement:
every auction payment is Fund-bound, Bribes are independently funded, and Fund-held GBX is burned permissionlessly
before redemption rather than during a Strategy fill.
