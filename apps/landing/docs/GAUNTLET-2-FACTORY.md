# Gauntlet 2: rebuild every diagram as a Three.js gumball factory

Paste everything below the rule into a lead agent. Written to be self-contained; it assumes the
agent can read this repository.

---

## Your role

You are the **lead agent**. You will not build this yourself. You decompose the goal, spawn a
**builder** and a separate **critic** for each piece, and keep looping until every piece beats the
bar. There is no round limit. You stop when fresh critics stop finding gaps, not when you run out
of patience.

## The decision that is already made

The five simulations on this page are currently drawn in **canvas 2D**. The owner reviewed them,
called them **"a bit messy"**, asked for _"gumballs in an intricate system of pipes"_ and _"a
factory flow that really models out what's going on at each level"_, saw a Three.js prototype, and
chose it.

**Convert all of them to Three.js. The renderer question is settled — do not re-open it.**

A working prototype of the overview exists at
`$SP/proto3d/overview3d.html` (and a self-contained `overview3d.bundled.html`), where `$SP` is the
scratchpad directory named in `$SP/TOOLING.md`. **Open it and look at it before you plan anything.**
It vendors `three` 0.185.1 locally — there must be no CDN or network request at runtime.

What already works in it, and should survive: sixteen slot dispensers that read instantly as sixteen
slots; a collector belt that turns scattered specks into contained directed flow; **auction chambers
where a pink ask bar physically descends a cage onto a rising blue lot**, which is a far better
picture of a falling-price auction than bars were; and per-asset hues in the fund bays.

What is wrong with it, and is your first work: the perspective camera makes the left dispensers much
larger than the right, so **sixteen equal slots do not read as peers** — try an orthographic or
near-orthographic camera; the fund bays are cropped and band 05 is not visible; the right third is
dead space; the band labels are too dim; and `TO THE MINER · 80% + GBX` both floats disconnected
and mistakes the 80% pull claim for a pushed payment.

## THE ONE RULE THAT OUTRANKS EVERYTHING

**The reconciled model layer is frozen. You are replacing the paint layer only.**

`lib/harness.ts` already splits every simulation into `step(dt)` — advance the model on accumulated
sim time — and `paint()` — draw it — plus `static()` for the reduced-motion still. **The models
inside `step()` are verified against the Solidity in `packages/contracts/src/core` and documented in
`docs/MODELS.md`.** They also carry roughly twenty rounds of honesty fixes that cost real effort and
are invisible in a screenshot:

- mining's `×2` annotation **derived from the two drawn prices**, naming the `$1` floor where the
  floor set the price — correct on all 25 clamped leaps of 102 takes;
- resonance's scripted move **always originating from the largest Strategy** — 24/24, including six
  near-ties decided by 100–200 GBX;
- the fund's receipts **expiring** instead of asserting a settlement that has ended;
- redemption reading as **pro-rata** and impossible to misread as picking assets;
- mining's never-taken slots **honestly exhausting**, with no slot silently re-opened;
- mining's reader-take dwell **varied** so the exit figure is never the same twice.
- mining's protocol share ending at **ResonanceRouter**, with no synchronous `route()` or implied
  seven-day-stream start;
- new-tenure TPS selected only from Mine deployment age: **64 GBX/s**, halving every **69 days**,
  with a **1 GBX/s** tail and incumbents staying locked.

**Reuse `step()` verbatim. If a builder finds itself editing model code, it must stop and ask you.**
Every figure a diagram prints must still come from the model, and `docs/MODELS.md` stays ground
truth. A rewrite is exactly how this gets silently lost.

## The bar

1. **`ciechanow.ski`** — the primary bar. Every animation is the argument; each isolates one idea; a
   frozen frame teaches as well as a moving one; **nothing is ever cut by its own container**; every
   mark is labelled or self-evidently part of the mechanism; a callout never occludes what it names.
2. **The existing 2D build.** Open it at `http://localhost:3001` and beat it. It is measurably good:
   spheres never interpenetrate (min centre-to-centre 1.00 diameter over 240 samples), zero type
   collisions at two thresholds, CLS 0.000, one rAF loop (3,814 of 3,815 calls), every canvas at
   exactly 0 draw-ops when parked, worst frame callback 2.6ms with zero long tasks in ~43,000 frames,
   and animations that do not lose to their own reduced-motion stills. **Matching it is failure.**
3. **The owner's reference** — an intricate gumball machine containing a working factory: bucket
   elevator, cleated incline conveyor, spiral tracks, paddle wheel, tipping trays, funnels, chutes,
   a collector hopper. The quality to capture is that **you can trace one ball's whole journey**,
   because every stage is a real mechanism doing a visible job.
4. **`stripe.com`** — typographic craft and restraint. **`linear.app`** — dark-theme material, one
   light source, purposeful easing.

**Do not add machinery that does nothing.** A decorative spiral carrying no meaning is the original
"messy" problem in a better costume.

## The ball-colour law — binding

A reader learns three ball types **once** and can then read any diagram on the page.

| ball                                   | colour                     | rule                                                |
| -------------------------------------- | -------------------------- | --------------------------------------------------- |
| **USDG** — capital arriving            | `#29B6F0` blue             | **always**, everywhere, no variation                |
| **GBX** — supply, and what gets burned | neutral / white            | **always**, everywhere, no variation                |
| **Assets** — what signal buys          | one distinct hue per asset | differ from each other; each consistent with itself |

Asset palette, already shipped by `Fund.tsx`: `NVDA #9E5CF2` · `QQQ #F92B92` · `WBTC #FF6274` ·
`AAPL #F57ACD`.

- **Vary value and specular, never hue.** A lit USDG ball drifting toward cyan, or a shadowed one
  drifting toward violet, breaks the law silently. **This is the main new risk in a 3D renderer.**
  Sample ball pixels at the darkest and brightest points of your lighting and prove the hue holds.
- Decorative multicoloured candy is allowed **only** where balls cannot be read as protocol
  quantities. Inside any pipe, chamber, hopper or chute that explains something, the law applies.
- **The trade is a colour change.** A blue USDG ball goes out to the trader and an asset-hued ball
  comes back. Draw it as an exchange, not a recolour in place.
- **Fix on sight:** the fund paints four asset hues while the overview paints its whole fund field
  one flat pink. Same holdings, two encodings. Unify them.

## Material — the ruling

The page's chosen art direction, binding for the hero, sections, close and specimen, is **"Serious
money, candy soul"** (`docs/ART-DIRECTION.md`): flat confident colour planes, hairlines, editorial
restraint, dark ground `#0C0C0C`. Its "what did not win" clause rejects **chrome** and a **glass
dome** as a decorative style.

The owner's reference is chrome-and-glass. The ruling: **take the factory flow wholesale, render it
in the page's own material.** Precision instrument, not shiny toy — dark machined parts, matte, one
consistent light source from above, brand colour doing the semantic work. **No mirror-chrome, no
rainbow glass, no dome enclosing the scene.** Two art directions on one page would fight.

If a builder finds the restrained material genuinely weakens the idea, it should build it that way
anyway and **say so** — the owner has offered to swing further toward the reference if the evidence
supports it.

## What must not change

- **All copy, all numbers, all honesty content**: the hero and close honesty blocks, the
  "Illustrative parameters" chips, the sim notes. If a redesign would bury them, the redesign is
  wrong.
- **Contract accuracy**, per the one rule above.
- **Colour semantics**: blue = USDG capital arriving, pink = signal and what it buys, neutral = GBX
  supply and burns. Decorative colour must never read as data.
- **The autonomy contract** (`docs/GAUNTLET.md`, "The diagrams run themselves"): no buttons, nothing
  focusable inside a sim, every beat scripted and guaranteed on **accumulated sim time** rather than
  wall-clock, `reset()` re-arming after 30s away, no faked state the mechanism cannot reach.
- **A sim must not run before it has been seen.** The harness gates on genuine first sight and each
  sim registers its **panel**, not its section. Do not defeat either.
- **Accessibility**: AA contrast, visible focus on every focusable element, `prefers-reduced-motion`
  honoured with a **meaningful still that teaches**, zero layout shift, no horizontal scroll at
  390 / 1280 / 1440. **Zero app-authored `aria-live` regions** — currently true, must stay true.
  Each canvas carries `role="img"` with a descriptive label.
- **Architecture**: one shared rAF loop, IntersectionObserver pausing, StrictMode-safe registration,
  cleanup that clears every timer and listener, self-hosted fonts only, **no network requests at
  runtime**, **static prerender**.

## Carry these over — verified fixes the 2D build earned that a rewrite would drop

These were found by cross-cutting audits and are **not yet applied**. Apply them in the new build.

1. **`.board { overflow: hidden }` clips the event ring.** Every board cell loses its top ring; end
   cells lose an outer side. Verified fix: `overflow: clip; overflow-clip-margin: 2px`. The obvious
   alternative — moving the ring inside with `inset` — **regresses**, because an inset ring is
   occluded by an existing `border-top`.
2. **The one-shot flash pushes faint ink below AA.** `.cell__id`/`.cell__sub` 4.33, `.cell--open`
   4.07, `#acqTrader .acq__label` 4.16, `#acqFund .acq__label` 4.46. Verified fix: lower the lit
   inset alpha `.16 → .10` and `fund-evt-white .09 → .06`, which lifts all four to 4.64–4.91.
   Combined with (1) the ring goes from 50% to 100% perimeter and **the flash reads stronger than
   what shipped**.
3. **Mining's canvas prints `NO ONE DISPLACED` at 2.48:1** — the label that teaches the
   100%-to-Router deposit. `inkA(0.55)` gives 5.57:1.
4. **Resonance's ledger delta lingers sub-AA** — a linear opacity ramp leaves ~1.2s of a ~3.3s life
   below 3:1. The fund's `.acq__delta` pattern (hold at 1, fade with a 320ms transition) passes 99%
   of its life. Adopt it.
5. **`/specimen` overflows 24px at 320px wide** — `.sp-wm`'s 52px floor makes "GumBall6900" 324px in
   a 344px-minimum box; `overflow-x: clip` hides it, so the wordmark is silently cropped.
6. **Latent and fragile:** `.hero__margin.reveal` never receives `.is-in` below 880px, because
   `display: contents` generates no box for IntersectionObserver. Harmless only because `opacity: 0`
   is inert on `display:contents` — the hero's status and honesty copy is one `display:block` away
   from vanishing.
7. **One forced synchronous layout per sim per frame** — `Fund.tsx fit()` and `Mining.tsx resize()`
   read `clientWidth` after writing DOM text in the same rAF callback. `Overview.tsx` registers
   0.00 and is the existing proof the read can be hoisted.
8. **`--bleed` is computed from `100vw`**, which includes the classic-scrollbar gutter that
   `clientWidth` excludes, so a bleed plane overshoots 8px at ≥1312px. `overflow-x: clip` absorbs it
   entirely — **the clip is load-bearing. Do not remove it.**

## Decomposition

Suggested pieces. Judge `machinery-kit` first — everything downstream consumes it.

- `machinery-kit` — the shared vocabulary and the technical foundation: hopper, dispenser, conveyor,
  elevator, gate, funnel, chamber, chute, ball. Materials, lighting, camera convention, the colour
  law, motion curves. **Also the hard technical decisions:** how one Three.js context (or several)
  coexists with the shared rAF harness; how `prefers-reduced-motion` renders a single still frame;
  how off-screen pausing releases GPU work; how text stays in HTML rather than baked into the scene;
  how the bundle is kept off the critical path. Delivered as a rendered specimen section.
- `overview-factory` — the whole loop. The messiest today and the proving ground; the prototype is
  its starting point.
- `mining-factory`, `resonance-factory`, `fund-factory` (acquisition + redemption) — one
  builder/critic pair each.
- `specimen-machinery` — the specimen page documents the design system and currently contains its
  own live 2D panel; bring it onto the kit so the spec matches what ships.
- `motion` · `autonomy` · `performance-and-a11y` — cross-cutting, run last, as **read-only audits**
  that produce findings you dispatch to the piece owners.

## The loop, per piece

1. **Builder** builds or revises the piece.
2. **Critic** gets a fresh context containing only: the goal, the bar, the rendered artifact
   (screenshots at 1440×900 and 390×844 plus the running site), and this prompt. It must **not** see
   the builder's reasoning or its own previous notes.
3. Critic answers one question: **does the bar still win?** If yes, it names the gaps, ranked, each
   pointing at a named reference and a concrete fix.
4. Builder fixes. Repeat.
5. A piece is done when a fresh critic cannot name a gap a reader would notice.

Critics judge the **rendered output**, never the source. For animation, a critic must take multiple
frames across a full cycle — a single still cannot judge motion.

## Method lessons already paid for — do not rediscover these

- **Use positive controls.** A zero from an uncalibrated instrument is worthless. Prove a detector
  finds an injected defect before trusting its zero. This caught two instrument bugs last time:
  programmatic `.focus()` does not set `:focus-visible`, and `blur()` leaves Chrome's
  sequential-focus start behind, silently skipping tab stops.
- **Contrast of antialiased text must be measured on the stroke body, not the brightest pixel** —
  and a bare stroke-body number is uninterpretable without a **calibration ramp** of known declared
  ratios drawn in the same font, size and subpixel origin. It misleads in both directions.
- **Any reduced-motion pixel diff must threshold at Δ ≥ 3.** Gradient dithering in the capture path
  produces ~500k differing pixels of which 95% differ by exactly 1/255. The real evidence is rAF
  tick counts, canvas draw-op counts and `document.getAnimations()`, not pixels.
- **`--clip` cannot be combined with `--frames`** in this Chrome build — a clipped capture needs
  `captureBeyondViewport`, which freezes rAF and hands you identical frames. Use `--selector`.
- The dev server emits its own console messages (React DevTools, HMR, Fast Refresh). **Attribute
  every message to its source before counting it**, and run the final console check against a
  production build.
- Completed subagents cannot be resumed. Each round needs a **fresh** builder, given the critic's
  ranked gaps verbatim plus an explicit "verified passing, do not churn" list.

## Running and looking at the work

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"   # repo pins Node 22.23.1
pnpm install
cd apps/landing && pnpm run dev        # http://localhost:3001
pnpm exec eslint app components lib && pnpm exec tsc --noEmit
pnpm run build                          # must stay statically prerendered — all ○, no ƒ
```

`$SP/shot/shot.mjs` already exists and is documented in `$SP/TOOLING.md`. **Only the lead runs
`pnpm run build`** — concurrent Next builds clash over `.next/`.

## File map

```
apps/landing/
  app/globals.css                  design system: tokens, type, primitives, reduced-motion switch
  app/specimen/                    the rendered design-system specimen (noindex)
  lib/harness.ts                   the single rAF + IntersectionObserver driver; registerSim()
  components/sections/*.tsx        one component per section, each with its own .css
  docs/GAUNTLET.md                 the first gauntlet's standard — still the baseline
  docs/ART-DIRECTION.md            the visual brief — binding
  docs/BRIEF.md                    protocol ground truth + honesty rules — binding
  docs/MODELS.md                   the verified models + contract citations — FROZEN
  docs/DESIGN.md                   the current design system's spec
```

## Definition of done

- A stranger can trace one ball's journey through the machine and come away understanding the loop.
- Every mechanism drawn does a job; nothing decorative carries a path.
- The ball-colour law holds under every lighting condition, proven by sampled hues.
- Every figure still comes from the frozen model; `docs/MODELS.md` still describes what is drawn.
- The autonomy contract intact: no controls, every beat guaranteed, nothing running unseen.
- AA contrast, zero layout shift, no horizontal scroll, `prefers-reduced-motion` teaching, no
  runtime network requests, **zero console errors in a production build**, static prerender intact.
- Frame budget held with several sims in view; GPU work released when off-screen.
- **Measurably better than the 2D build it replaces, on the same instruments.**
- A fresh critic, shown only the bar and the rendered site, cannot say the bar wins.
