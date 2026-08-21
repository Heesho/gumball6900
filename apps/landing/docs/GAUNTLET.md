# Gauntlet loop: make GumBall6900 look and move like a real product

Paste everything below the rule into a lead agent. It is written to be self-contained, but it
assumes the agent can read this repository.

---

## Your role

You are the **lead agent**. You will not build this yourself. You decompose the goal, spawn a
**builder** and a separate **critic** for each piece, and keep looping until every piece beats the
bar. There is no round limit. You stop when the critics stop finding gaps, not when you run out of
patience.

## The goal

There is a working, accurate, accessible marketing site at `apps/landing` (Next.js, React,
TypeScript). Its content is finished and verified. Its **look and its motion are not good enough** —
the owner's verdict on the current build was "pretty amateur." Your job is to raise three things
until a stranger would assume a serious design team made this:

1. **Brand.** It must be unmistakably GumBall6900 — not a generic dark developer-tool template.
2. **Diagrams and animation.** Every mechanism drawing and every simulation must be beautiful and
   must teach. Right now they are functional and plain.
3. **Visual craft.** Type, colour, surface, depth, rhythm, composition — at the level of the
   reference sites below.

You are improving an existing app in place. You are not rewriting the copy, the protocol facts, or
the contract-accurate models.

## The bar

The bar is not a mood board. It is things you can open, inspect, and compare against. When a critic
says "the bar still wins," it must point at one of these and say why.

1. **`ciechanow.ski`** — the bar for **explaining a mechanism with animation**. Open Gears, GPS, or
   Mechanical Watch. Every animation is the argument, not decoration; each isolates exactly one
   idea; the drawing is precise and beautiful; nothing loops decoratively in the background.
2. **`stripe.com`** — the bar for **typographic craft and restraint in a financial context**.
3. **`linear.app`** — the bar for **dark-theme polish, material, and motion feel**: light sources,
   layered translucency, fast purposeful easing, a restrained palette used with confidence.
4. **The brand itself** — `apps/landing/docs/ART-DIRECTION.md` carries the diagnosis of what is
   wrong today, the palette, and the rules. Read it first; it is binding.
5. **`docs/deck/gumball6900-deck.html`** (in git history if removed) — the internal ancestor. The
   current sims descend from its models. Do not regress their accuracy.

The bar is a **standard of craft, not content to copy**. Do not reproduce anyone's copy, layout,
illustrations, or branding.

## Hard rules

### The diagrams run themselves — no manual interaction

The reader never clicks anything to make a diagram do its job. **This is already implemented — your
job is to preserve and extend it, not to redo it.** Every control was removed and the behaviour it
demonstrated is now a scripted beat inside that simulation's own cycle: mining runs a fixed
programme alternating the 100%-to-fund and 80/20 routes with one take as "you"; resonance runs
hold → move → settle so a signal move is never buried by ambient drift; the fund alternates a
10%-of-supply burn with ambient ones. Schedules advance on each sim's **accumulated time**, so a
section reached by scrolling has not already spent its cycle, and the harness `reset()` re-arms the
sequence when a reader returns after 30s away.

When you re-choreograph a diagram, keep that contract: a reader who only scrolls and watches must
see every teaching state, in a legible order, on a cycle short enough to catch in a normal viewing,
and the important beats must be guaranteed rather than left to chance. Do not reintroduce a button.
Do not let a beat depend on wall-clock time. Never fake a state the mechanism cannot actually reach
— e.g. the 100%-to-fund route only exists while never-taken slots remain, and re-opening a taken
slot to keep it repeating would be a lie about the protocol.

Links remain links. The page must still be fully keyboard-navigable and screen-reader sane. Any
`aria-live` region that was written on user action must now either be removed or rate-limited so an
autonomous loop does not spam assistive technology.

### What must not change

- All copy, all numbers, all honesty content: the hero and close honesty blocks, the "Illustrative
  parameters" chips, and the sim notes. If a redesign would bury them, the redesign is wrong.
- **Contract accuracy.** The models are verified against the Solidity in
  `packages/contracts/src/core`. Restyle and re-choreograph freely; never change what a mechanism
  does or the figures it obeys. Ground truth is `apps/landing/docs/BRIEF.md`; the model
  documentation is `apps/landing/docs/MODELS.md`.
- **Colour semantics**: blue = USDG capital arriving, pink = signal and what it buys, neutral =
  GBX supply and burns. Decorative colour must never read as data.
- Accessibility: AA contrast, visible focus on every focusable element, `prefers-reduced-motion`
  honoured with meaningful stills, no layout shift, no horizontal scroll at 390 / 1280 / 1440.
- Architecture: one shared rAF loop (`apps/landing/lib/harness.ts`), IntersectionObserver pausing,
  sims registered per component, StrictMode-safe effects, self-hosted fonts only (no external
  requests), static prerender.

## The three fronts

### 1. Brand

Read `apps/landing/docs/ART-DIRECTION.md`. In short: pink `#F92B92` and blue `#29B6F0` currently
appear almost nowhere; the Modak wordmark is flat white when the brand's own mark outlines those
letters in pink and blue; the logo is rendered postage-stamp small and mushy; the gumball machine —
a vessel full of coloured spheres, which is _literally_ what this protocol is — is never used.
Colour should be structural, surfaces should have a light source, and the identity should be
legible in a two-second glance.

**The direction is already chosen — do not run a concept round.** Three directions were built and
compared; the owner chose "Serious money, candy soul," recorded in full at the end of
`ART-DIRECTION.md` with the winning mock vendored beside it as `docs/concept-c-reference.html`
(open it in a browser). Build to it: colour as a full-bleed plane carrying black type, nothing
centred, hairlines instead of boxes, a misregistered Modak wordmark, Modak numerals as the imagery.
That file also lists what the losing directions must not smuggle back in — no glass dome, no
chrome, no neon glow. Your first piece is porting that direction into `app/globals.css` and proving
it on a specimen; everything downstream consumes it.

### 2. Diagrams and animation

This is where the most value is. Current state, honestly assessed:

- **Overview loop** — four cards, SVG links, a travelling dot. Reads as a flowchart, not a picture
  of a machine. The pulse is a plain circle.
- **Mining** — a grid of sixteen boxes with numbers and bars. Correct, but it is a table that
  animates, not a drawing of a market.
- **Resonance** — canvas lanes with dots. The best of the five; still plain.
- **Fund acquisition** — a two-line chart. Legible, unremarkable.
- **Redemption** — DOM cells with meters, chips flying to a card.

Raise each to the ciechanow.ski standard: draw the _mechanism_, not a dashboard of it. Consider
real geometry, material, and light; consider what the thing physically is (a falling price is a
descent; a stream splitting is a flow; a vault of assets is a vessel of spheres). Every animation
must isolate one idea, be beautiful frozen as well as moving, and be strictly legible at 390px.

Keep the discipline that is already paid for: events need ~1s of visible consequence and must clean
up; show the transfer, not just the result; simulated actors must not synchronise.

### 3. Visual craft

Type scale and hierarchy, spacing rhythm, surface material, section composition. The current page
gives every section the same shape: eyebrow → headline → lede → grid of equal cards. Vary the
composition; let one or two moments be genuinely big. Panels need a light source; flat rectangles
with hairline borders are what read as amateur.

## Decomposition

Suggested pieces. Judge `art-direction` first — everything downstream consumes it.

- `art-direction` — the palette, surfaces, material, type, motion curves, wordmark treatment, and
  the gumball motif system. Delivered as the app's global layer plus a rendered specimen page.
- `hero` — the first viewport; the identity's whole job.
- `overview-diagram`, `mining-sim`, `resonance-sim`, `fund-sims` (acquisition + redemption) — one
  builder/critic pair each; these are the heart of the work.
- `sections` — extras, why, close: composition and material to match the new direction.
- `motion` — cross-cutting: is anything decorative, is anything animating off-screen, is easing
  consistent, does every autonomous cycle actually complete in view, is reduced-motion honoured.
- `autonomy` — cross-cutting: no manual controls remain; every beat the old buttons triggered now
  happens on its own, in a legible order, within a short cycle; assistive-tech announcements are
  sane.
- `performance-and-a11y` — one rAF loop, off-screen pausing, focus states, contrast, keyboard
  reachability, zero layout shift, no console errors, static prerender intact.

## The loop, per piece

1. **Builder** builds or revises the piece.
2. **Critic** gets a fresh context containing only: the goal, the bar, the rendered artifact
   (screenshots at 1440×900 and 390×844 plus the running site), and this prompt. It must **not**
   see the builder's reasoning or its own previous notes.
3. Critic answers one question: **does the bar still win?** If yes, it names the specific gaps,
   ranked, each pointing at a named reference and a concrete fix.
4. Builder fixes. Repeat.
5. A piece is done when a fresh critic cannot name a gap a reader would notice.

Critics judge the **rendered output**, never the source. A critic that cannot see a screenshot is
not qualified to judge that round. For animation, a critic must take multiple frames across a full
cycle — a single still cannot judge motion.

## Running and looking at the work

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"   # repo pins Node 22.23.1
pnpm install
cd apps/landing && pnpm run dev        # http://localhost:3001
pnpm exec eslint app components lib && pnpm exec tsc --noEmit
pnpm run build                          # must stay statically prerendered
```

You need a screenshot tool; build one in a scratch directory with `puppeteer-core` (Chrome at
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`) supporting: a URL or file target,
`--w/--h`, `--selector` to scroll an element to the top, `--frames N --interval MS` for motion,
`--settle MS`, `--reduced-motion`, `--full` (pre-scroll the page with instant behaviour so
IntersectionObserver reveals fire, and drop to 1× device scale on tall pages or Chrome tiles the
capture), and it must report console errors and horizontal scroll. Every builder and every critic
must READ the images they capture.

## File map

```
apps/landing/
  app/globals.css                  design system: tokens, type, primitives, reduced-motion switch
  app/layout.tsx                   next/font wiring (Modak, Schibsted Grotesk, JetBrains Mono)
  lib/harness.ts                   the single rAF + IntersectionObserver driver; registerSim()
  components/SimsDriver.tsx        mounts the harness
  components/sections/*.tsx        one component per section, each with its own .css file
  public/gumball-logo.png          the mark
  docs/ART-DIRECTION.md            the visual brief and diagnosis — binding
  docs/BRIEF.md                    protocol ground truth + honesty rules — binding
  docs/DESIGN.md                   the current design system's spec
  docs/MODELS.md                   the verified simulation models + contract citations
```

## Traps already paid for — do not rediscover these

- **Modak ships one weight (400).** Set `font-weight: 400` and `font-synthesis: none` on every
  Modak element or the browser fakes a bold and the letters smear.
- **SVG text does not wrap.** Words go in HTML; SVG is for shapes.
- **Owner override — the mining slot meters are clocks, not price bars.** They start empty when a
  slot is taken and fill over the hour. Do not "fix" them back to shrinking bars.
- **Events need duration.** A state change flashed for one frame is invisible: give it ~1s of
  visible consequence and **remove the class afterwards**, or lit states accumulate.
- **Show the transfer, not just the result.** This protocol is value moving between parties.
- **Auto-driven agents synchronise** unless each gets its own reservation and a minimum dwell.
- **One rAF loop for the whole page**, with off-screen work paused.
- **Server-render anything that affects layout.** Sim scaffolding built in JS after hydration
  causes layout shift; render it as JSX with initial values and let the effect wire it up.
- **`next/font` hashes family names** — canvas `font` strings must resolve the CSS variable at
  runtime (`fontFamily('--font-mono', …)` in `lib/harness.ts`), never hardcode the family.
- **StrictMode double-invokes effects.** Registration must be idempotent and cleanup must clear
  every timer and listener.
- **Full-page screenshots lie** unless you pre-scroll to fire reveals, and Chrome tiles captures
  taller than ~16k device pixels.

## Definition of done

- A stranger's first two seconds say "GumBall6900," not "a dark website."
- Every diagram is beautiful frozen and teaches while moving; a reader who never clicks sees every
  mechanism demonstrate itself, including the beats that used to require a button.
- Every section reads at 1440×900, 1280×720 and 390×844, with no horizontal scroll.
- Contract accuracy intact; illustrative labelling intact; honesty blocks intact in hero and close.
- `prefers-reduced-motion` honoured everywhere with meaningful stills.
- AA contrast; visible focus on every focusable element; zero console errors; zero layout shift;
  lint, typecheck, and a static production build all clean.
- A fresh critic, shown only the bar and the rendered site, cannot say the bar wins.
