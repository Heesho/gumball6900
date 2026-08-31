# GumBall6900 security gauntlet

This directory is the durable workbench for the internal multi-agent review frozen at
`70091b642006f0b2788bd89a6a0e734a632619cf` on 2026-08-30 UTC.

This is internal engineering evidence. It is not an independent audit, deployment approval, release authorization, or
evidence that the protocol is safe for user funds.

The source of truth for progress is:

- `TARGET.json` for the immutable review target and environment;
- `findings.json` for candidate and dispositioned findings;
- `TOOL_RESULTS.md` for exact executed gates and unavailable tooling;
- `COVERAGE.md` for property-to-evidence mapping;
- `CONVERGENCE.md` for the stopping-condition ledger.

Unreviewed machine output belongs under `evidence/`. Reviewer reports belong under `rounds/`. Only independently
reproduced or disproved candidates are promoted into the finding register.
