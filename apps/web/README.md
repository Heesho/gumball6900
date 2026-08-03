# Minimal rebuild status UI

This Next.js app is a fail-closed local evidence page for the deliberately minimal GBX rebuild. It presents the
14-contract architecture, immutable supply and emission constants, disclosed trust surfaces, and unresolved deployment
inputs.

It intentionally has no wallet connection, RPC/subgraph configuration, contract writes, or claim of deployment
readiness. `/healthz` reports process liveness only; it does not report protocol or chain readiness.

Local checks:

```bash
pnpm --filter @gumball-6900/web typecheck
pnpm --filter @gumball-6900/web test
pnpm --filter @gumball-6900/web build
pnpm --filter @gumball-6900/web test:e2e
```
