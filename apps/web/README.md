# Gumball6900 protocol site

A Next.js App Router site that explains the holder-built onchain index fund through mining, signaling, Strategy
acquisitions, Fund-backed redemption, and the bounded governance surface. The home page opens on a silent
90-second film and then runs a modular product dashboard; `/mine`, `/signal`, `/auction`, and `/govern` each
explain one mechanism in depth.

It intentionally has no wallet connection, RPC or subgraph configuration, contract writes, or claim of deployment
readiness. `/healthz` reports process liveness only; it does not report protocol or chain readiness.

## Ground rules

**Every figure on the site is a source constant or a labelled illustration.** There is no TVL, price, yield,
participant count, partner, audit, or live activity anywhere, because none of those exist. `lib/protocol.ts` is
the single source for protocol numbers; pages import from it rather than retyping values. `tests/minimal/honesty.test.ts`
fails the build if a page starts claiming otherwise, and pins the constants against the contracts.

The development-status language — not deployed, not audited, no production addresses, external governance
executor unselected, Mine's emission constants provisional — appears in the fixed chrome, the footer, and the
closing section. It is part of the design, not a disclaimer bolted on.

## How the styling is organised

- `app/globals.css` owns tokens, reset, base typography, and layout primitives (`.container`, `.section`,
  `.frame`, `.card`, `.btn`, `.chip`, `.eyebrow`, the type scale). Component styling never goes here.
- Every component has a co-located `*.module.css`, so pieces can be built and changed independently.
- Accent colours have three roles. `--pink` / `--blue` are the brand hues, used for large solid fills;
  `--*-strong` clears 3:1 for thin graphical marks; `--*-deep` clears 4.5:1 for text. **Accent text on a
  light surface must use `--*-deep`** — the brand values reach only 3.63:1 and 2.32:1 on paper. Large
  fills deliberately keep the exact brand hue: the palette is fixed, the shapes are big and solid, and
  every figure states its meaning in an adjacent text legend rather than relying on colour alone.
- A board's figures inherit `--accent` from its `accent-pink` / `accent-blue` class, so a mechanism reads
  in the same colour on the homepage as it does on its own page.
- Dark sections carry `data-surface="dark"`, which flips the surface tokens so the primitives keep working.

## Why every route is dynamic

`proxy.ts` mints a fresh CSP nonce per request, and the policy uses `'strict-dynamic'`, which makes `'self'`
inert for scripts. A prerendered document cannot carry a per-request nonce, so static rendering would leave every
script blocked and the page unhydrated. `app/layout.tsx` therefore sets `export const dynamic = 'force-dynamic'`.
The pages fetch nothing, so the cost is React SSR of static markup. Removing that line silently breaks
production while leaving `next build` green — the Playwright suite's console-error test is what catches it.

## Local checks

```bash
pnpm --filter @gumball-6900/web lint
pnpm --filter @gumball-6900/web test
pnpm --filter @gumball-6900/web build
pnpm --filter @gumball-6900/web test:e2e
```

The end-to-end suite builds and serves a production bundle rather than running against `next dev`, because the
dev overlay injects its own CSP violations and the suite asserts a clean console. It covers hero playback and
its muted/looping/inline attributes, reduced motion, keyboard focus visibility, horizontal overflow from 320px
up, axe across all five routes, and `/healthz`.
