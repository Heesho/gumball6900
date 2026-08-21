# Porting contract — HTML fragments → Next.js components (historical record)

The landing page first shipped as one gauntlet-verified HTML file assembled from fragments in
`docs/landing/src/sections/` (removed after the port; see git history at the commit that added
this app). This document is the contract the port followed; the components in
`components/sections/` are now the source of truth. Reference docs live in `docs/` here
(BRIEF.md — protocol ground truth; DESIGN.md — the design system; MODELS.md — the verified
simulation models).

## File mapping

| Fragment            | Component                      | CSS                            |
| ------------------- | ------------------------------ | ------------------------------ |
| `10-hero.html`      | `components/sections/Hero.tsx` | `components/sections/hero.css` |
| `20-overview.html`  | `Overview.tsx`                 | `overview.css`                 |
| `30-mining.html`    | `Mining.tsx`                   | `mining.css`                   |
| `40-resonance.html` | `Resonance.tsx`                | `resonance.css`                |
| `50-fund.html`      | `Fund.tsx`                     | `fund.css`                     |
| `60-extras.html`    | `Extras.tsx`                   | `extras.css`                   |
| `70-why.html`       | `Why.tsx`                      | `why.css`                      |
| `80-close.html`     | `Close.tsx`                    | `close.css`                    |

Each component `import './name.css';` at the top (App Router allows CSS imports in components;
they load globally — the selectors are already scoped under `#sec-*`).

## CSS

Copy the fragment's `<style>` content **verbatim** into the `.css` file. No renames, no
"cleanup". The design tokens live in `app/globals.css` (already ported).

## Markup

Translate the `<section>` markup to JSX **structurally verbatim**:

- `class` → `className`; keep every class name and every `id` exactly (ids are unique page-wide).
- `style="--d: 90ms"` → `style={{ '--d': '90ms' } as React.CSSProperties}`.
- Kebab-case SVG attrs → camelCase (`stroke-dasharray` → `strokeDasharray`, `marker-end` →
  `markerEnd`); `viewBox`/`markerWidth` etc. stay as-is.
- Convert HTML entities to literal characters (`&mdash;` → `—`, `&middot;` → `·`, `&rsquo;` → `’`,
  `&ge;` → `≥`, `&rarr;` → `→`). Watch for apostrophes/quotes in JSX text — wrap in `{'…'}` or use
  the literal character; eslint's `react/no-unescaped-entities` may require `&rsquo;`-style JSX
  escapes — satisfy the linter without changing the rendered character.
- Self-close void/empty elements (`<i className="…" />`, `<canvas … />`).
- The hero's inlined data-URI logo becomes `next/image`:
  `import Image from 'next/image';` … `<Image src="/gumball-logo.png" alt="" width={208} height={208} priority className=…/>`
  (the file is in `public/`; CSS still controls display size; keep alt="" — the h1 carries the name).
- External links stay plain `<a>`.

## Server vs client

- Sections with **no script block** (hero, why, close, extras if script-free) are server
  components: plain JSX + CSS import, no directive.
- Sections with a script block start with `'use client';`.

## Zero layout shift under SSR (hard requirement)

The HTML version builds some DOM in JS at parse time (mining board cells, resonance weight rows,
fund vault cells/placeholders) **with initial values**, so the first paint has final heights. In
Next, the server-rendered HTML paints before hydration — so any layout-affecting DOM the
fragment's IIFE builds MUST be rendered as JSX instead, with the **same initial values** the
fragment's build code paints (read them from the model's initial state in the fragment). The
effect then looks up those existing elements (scoped `querySelector` on the section root or
`getElementById`) and wires the model's references to them — it must NOT rebuild them. Dynamic
text slots keep their pre-filled placeholder/initial text from JSX.

Canvases: keep the CSS-fixed heights; blank-until-hydration is acceptable.

## The sim/effect

- Keep the model code as close to **verbatim** as possible inside one `useLayoutEffect` in the
  component (layout effect so first wiring/paint lands before the browser paints post-hydration).
- Register via the shared harness:
  ```tsx
  import { registerSim, fontFamily } from '../../lib/harness';
  // inside the effect:
  const unregister = registerSim({ name: 'mining', el: root, step, paint, static: staticPaint, timeScale: 60 });
  return () => {
    unregister(); /* + clearTimeout every pending timeout */
  };
  ```
  Never start your own rAF/interval. The harness handles IntersectionObserver, reduced motion
  (calls `static`), and the single loop — same contract as the HTML version.
- **StrictMode-safe**: React dev runs effect → cleanup → effect. Your effect must be re-runnable:
  wire references idempotently, clear pending timeouts in cleanup, and re-derive any mutated DOM
  state on setup (or reset it in cleanup) so the second run starts clean.
- The `.reveal` entrance system is global (harness) — keep `reveal`/`--d` classes in JSX, add no code.
- Canvas font strings: `next/font` hashes family names, so hardcoded `'"JetBrains Mono", monospace'`
  silently falls back. Use `fontFamily('--font-mono', '"JetBrains Mono", monospace')` (and
  `--font-sans` equivalent) from `lib/harness` — resolve once inside the effect.
- Event handlers (sim buttons): attach via JSX `onClick` OR keep addEventListener inside the
  effect (with removal in cleanup) — your choice; JSX preferred where it doesn't contort the model.

## TypeScript

Strict tsconfig. Type lightly but honestly: let inference work, add small interfaces for model
state where it helps, no `any` (use precise DOM element types; `HTMLElement | null` checks with
early return). The goal is a clean `tsc --noEmit`, not a type showcase.

## Verify (every builder, before returning)

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
cd apps/landing
pnpm exec eslint components/sections/<YourFile>.tsx
pnpm exec tsc --noEmit
```

Both must pass. Do NOT run `next dev`/`next build` (shared ports/build dir — the lead runs
integration). Do not edit any file outside your two files; if you believe a shared file needs a
change, report it instead.
