# Gumball6900 protocol landing page

This Next.js app is the cinematic Gumball6900 protocol landing page. It explains the holder-built onchain index fund
through mining, signaling, Strategy acquisitions, Fund backing, Bribes, and caller-selected redemption. Its restrained
product-dashboard layout is paired with project-local brand assets and a silent 90-second hero film.

The home page introduces the full mechanism. `/mine`, `/signal`, `/auction`, and `/govern` each explain one part of
the protocol using source-backed development constants rather than invented live metrics.

It intentionally has no wallet connection, RPC/subgraph configuration, contract writes, or claim of deployment
readiness. `/healthz` reports process liveness only; it does not report protocol or chain readiness.

Local checks:

```bash
pnpm --filter @gumball-6900/web typecheck
pnpm --filter @gumball-6900/web test
pnpm --filter @gumball-6900/web build
pnpm --filter @gumball-6900/web test:e2e
```
