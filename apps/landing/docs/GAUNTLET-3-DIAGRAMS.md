# Gauntlet 3: raise the five 2D diagrams to drafted-instrument quality

Paste everything below the rule into a lead agent. Written to be self-contained; it assumes the
agent can read this repository.

---

## Your role

You are the **lead agent**. You will not build this yourself. You decompose the goal, spawn a
**builder** and a separate **critic** for each piece, and keep looping until every piece beats the
bar. There is no round limit. You stop when fresh critics stop finding gaps, not when you run out
of patience.

## The decisions that are already made

**1. The diagrams stay 2D canvas. This is settled — do not re-open it.**
A Three.js rebuild was attempted and cancelled by the owner after three build/critique rounds:
_"set on going back to 2d diagrams, it just looks so buggy."_ That work is archived unmerged on
branch `claude/gauntlet-2-factory-decompose-49fb5f` (commit `9e6239b`). Do not propose 3D, WebGL, a
gumball-machine render, or a glass dome. The `docs/ART-DIRECTION.md` amendment about 3D machinery
material is **moot** — ignore it.

**2. The problem is grammar, not rendering power.**
The five figures are hand-drawn canvas over a verified model, and the instruments say they are
technically excellent. What makes them read as "a bit messy" is that each figure invents its own
encoding: the overview paints its whole fund field flat pink while the fund section gives every
asset its own hue; flows are implied by drifting specks rather than drawn as quantities; labels sit
near mechanisms instead of on them. **Your job is one coherent visual grammar across all five,
executed with drafting-grade craft.**

**3. The library question has been researched. The answer is: three small packages, at most.**
See "The libraries" below. It is a short list on purpose, with measured sizes and explicit
rule-outs. **Do not re-survey the field, and do not add a dependency that is not on the adopt
list without reporting to the lead first.**

**4. Eight audited fixes have already landed** (commit `16f22d3` on `claude/landing-2d-fixes`) — see
"Already done" below. Do not redo them; do not regress them.

## THE ONE RULE THAT OUTRANKS EVERYTHING

**The model layer is frozen. You are replacing the paint layer only.**

`lib/harness.ts` splits every simulation into `step(dt)` — advance the model on accumulated sim
time — and `paint()` — draw it — plus `static()` for the reduced-motion still. **The models inside
`step()` are verified against the Solidity in `packages/contracts/src/core` and documented in
`docs/MODELS.md`.** They also carry roughly twenty rounds of honesty fixes that cost real effort and
are invisible in a screenshot:

- mining's `×2` annotation **derived from the two drawn prices**, naming the `$1` floor where the
  floor set the price — correct on all 25 clamped leaps of 102 takes;
- mining's revenue leg reading as a **Router deposit, not a forward or a stream** — `MODELS.md` is
  explicit that a `RevenueDeposited` event proves money reached `ResonanceRouter` and nothing more;
  a seven-day stream begins only on a separate permissionless `route()` call. A diagram that draws
  the deposit flowing straight on into resonance is **wrong**, however much better it composes;
- mining's outgoing-tenure-miner leg reading as a **pull claim the miner must collect**, not a payment
  pushed to them;
- resonance's scripted move **always originating from the largest Strategy** — 24/24, including six
  near-ties decided by 100–200 GBX;
- the fund's receipts **expiring** instead of asserting a settlement that has ended;
- redemption reading as **pro-rata** and impossible to misread as picking assets;
- mining's never-taken slots **honestly exhausting**, with no slot silently re-opened;
- mining's reader-take dwell **varied** so the exit figure is never the same twice.

**Reuse `step()` verbatim. If a builder finds itself editing model code, it must stop and ask you.**
Every figure a diagram prints must still come from the model, and `docs/MODELS.md` stays ground
truth. A rewrite is exactly how this gets silently lost.

## The libraries

Measured with real installs + esbuild bundling + gzip, not quoted from a size service.

### Adopt

| Package           | Version | Licence | Measured gz | Role                                                                                                                                                                                                                                        |
| ----------------- | ------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **d3-shape**      | 3.2.0   | ISC     | **2.4 kB**  | The one load-bearing dependency. Tapered conserved-width ribbons and smooth links drawn **directly into the existing canvas context** via `.context(ctx)` — no DOM, no SVG serialization. Serves overview and fund; optional for resonance. |
| **bezier-easing** | 3.0.1   | MIT     | **0.4 kB**  | Canvas motion eases on the page's own `--ease` token `cubic-bezier(.2,.6,.2,1)` instead of hand-rolled cubics that do not match it.                                                                                                         |

Add `@types/d3-shape` as a devDependency. Both packages are pure math: no rAF, no DOM, no canvas
ownership, no network, ESM, side-effect-free, SSR-safe.

**The integration shape — every ribbon in the page goes through one helper:**

```ts
import { area, curveMonotoneX } from 'd3-shape';

type Station = { x: number; top: number; bot: number }; // from the frozen model's quantities
const ribbon = area<Station>()
  .x((s) => s.x)
  .y0((s) => s.top)
  .y1((s) => s.bot)
  .curve(curveMonotoneX)
  .context(ctx); // emits ctx path calls — nothing else

// inside paint():
ctx.beginPath();
ribbon(stations); // stations computed in buildLayout(), never here
ctx.fillStyle = TOKEN_BLUE;
ctx.fill();
```

Build one shared `lib/ribbon.ts` and let overview and fund both consume it, so curvature and taper
are identical page-wide.

### Declined, with reasons — do not re-litigate

| Considered                                     | Why not                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **d3-sankey** (2.8 kB, BSD-3)                  | Its value is iterative node ordering to minimise crossings on _unknown_ graphs. This graph is fixed and hand-ordered, and the overview's "loop" is a **DAG ending in a sink** — nothing materially flows back to miners; the burn is terminal. Its solver would fight the designed label rows on resize. Hand conservation math is ~50 lines. **Judgement call, not a ban:** if a builder finds the 16-into-1 collector stacking genuinely fiddly, it may propose adopting it — to the lead, with evidence. |
| `d3-sankey-circular`                           | Unmaintained ~7 yrs, deprecated deps, 7.9 kB, known overlap artifacts — and solves a circularity this figure does not have.                                                                                                                                                                                                                                                                                                                                                                                 |
| `d3-sankey-diagram`                            | 22.5 kB layout-only (drags graphlib) for one return edge.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `dagre`, `elkjs`                               | Auto-layout is the wrong tool when composition is hand-art-directed with reserved label rows. **`elkjs` also fails licence: EPL-2.0 OR GPL-3.0.**                                                                                                                                                                                                                                                                                                                                                           |
| `rough.js`                                     | Hand-sketched aesthetic contradicts instrument-grade hairlines.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `flubber`                                      | 18.5 kB, six deps, morphs arbitrary polygons; resonance's morphs are weight lerps through existing parametric cross-sections.                                                                                                                                                                                                                                                                                                                                                                               |
| `perfect-arrows`, `curved-arrows`              | Whiteboard-app arc-arrow idiom, not plumbed-channel grammar.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `d3-scale`                                     | 7.7 kB for tick logic the art direction rejects; the linear maps here are two lines each.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `d3-format`, `d3-interpolate`                  | The page's mono money formatter is 6 deliberate lines; every interpolation is a scalar lerp on model quantities.                                                                                                                                                                                                                                                                                                                                                                                            |
| `d3-labeler`, `label-locator`, `avoid-overlap` | Runtime label solving is nondeterministic frame-to-frame. The codebase's **designed reserved rows** already measure zero type collisions — annealing would _reduce_ craft.                                                                                                                                                                                                                                                                                                                                  |
| `d3-hierarchy`, `d3-chord`                     | Fund bays are four rectangles with widths ∝ weights. Chord's circular grammar clashes with the rectilinear editorial system.                                                                                                                                                                                                                                                                                                                                                                                |
| Any P&ID / SCADA symbol library                | **None viable exists** at a permissive licence — the space is full HMI platforms or commercial DOM-owning suites (GoJS, JointJS). See the ISA ruling below.                                                                                                                                                                                                                                                                                                                                                 |

### The ISA-5.1 ruling

No usable process-engineering symbol library exists, and that is fine: **adopt ISA-5.1 as a drawn
grammar, not a dependency.** A small hand-authored canvas glyph kit costs zero bytes and is the
single change most likely to make these read as engineering drawings rather than as illustrations:

- **valve / gate glyphs** wherever flow is throttled or split (the 80/20 split, resonance's blades,
  the fund's routing);
- **instrument-bubble tags** for live readouts, so a number is visibly attached to the mechanism
  that produces it;
- **distinct line weights for process vs signal** — capital flow and control signal must never be
  the same stroke;
- a **published legend**: learn six glyphs once, read all five figures. Same move as the
  ball-colour law.

## OWNER AMENDMENT — 22 Aug 2026: the overview's altitude

**Decided by the owner, looking at the rendered overview. This binds, and it supersedes anything
below that contradicts it.**

The owner's verdict on the current overview: _"it tries to get too granular instead focusing on
the whole flow of the system."_

That is the diagnosis for `overview-flow`. The figure is **competing with the sections below it**.
Bands 01 and 03 redraw mechanisms that `mining-board` and `fund-flows` already own properly —
sixteen individual slot ticks with their own price marks, four separate auction cylinders each with
a price-falls line and a fill level — and band 04 draws ninety individual spheres. Having spent its
width on mechanism detail, the figure has nothing left with which to draw the flow itself, which is
why the flow is currently carried by **drifting specks**. The specks are a symptom, not the disease.

### 1. Altitude — one conserved flow, five stations

Strip the mechanism detail out. The overview becomes **one Sankey of the whole system**, and a
reader can trace one unit of value from entry to exit:

```
01 DEPOSITED   ▓▓▓▓▓▓▓▓ miners ──▶ [ROUTER ▤ holds ]
                                        │ route()
02 AIMED       ────────────────────────▼▓▓▓▓▓▓▓▓ 7-day stream
                        signal ⌁ splits it ─┬─┬─┬─┬─
03 CONVERTED               ▓▓ ▓▓ ▓▓ ▓▓  (one valve, not four auctions)
04 THE FUND    [ NVDA ▉▉▉ │ QQQ ▉▉ │ WBTC ▉ │ AAPL ▉▉ ]
05 YOUR SHARE       burn ▷ ══════════════▶ YOU
```

- **Width is quantity everywhere, strictly conserved.**
- The sixteen slot ticks, the four auction cylinders and the price-fall lines **go**. The sections
  below teach them properly and in more depth; the overview must not restate them.
- The drifting specks **go**. Flow is drawn as a quantity, not implied by particles.
- The Router stays a **holding vessel with its own outlet** — the deposit-is-not-a-stream rule in
  "THE ONE RULE" is unaffected by this amendment and still binds.

### 2. Band 04 — four asset-hued sphere groups

The sphere ledger **survives, regrouped**. Keep the spheres (the art direction is explicit that
holdings are naturally spheres and that spheres are the brand's native shape), but group them into
**four blocks, one per asset, each in its own hue, block width ∝ holdings**:

```
04 · THE FUND
  NVDA        QQQ       WBTC   AAPL
 ●●●●●●●●●   ●●●●●●●   ●●●●   ●●●●●
 ●●●●●●●●●   ●●●●●●●   ●●●●   ●●●●●
 └ #9E5CF2 ┘ └#F92B92┘ └#FF6274┘└#F57ACD┘
```

This single move fixes the granularity **and** the flat-pink defect: the overview and the fund
section finally encode holdings identically, which is a named deliverable of this gauntlet.

**This amends "Keep the five-band vertical composition and the sphere ledger (the best thing in the
figure)" in the table below.** The five-band composition stays. The ledger stays _as four hued
groups_, not as ninety flat-pink spheres.

## OWNER AMENDMENT 2 — 22 Aug 2026: ONE PLATE. This supersedes the five-figure structure.

**Decided by the owner. This is the deliverable now. Everything below that assumes five separate
figures is superseded.**

The owner, on the five figures: _"im not really liking the diagrams… im starting to think we try
to make just one diagram with all the moving pieces in it, its gonna be big and detailed."_

### The decision

**One diagram. Flat orthographic. A tall plate the reader travels down.** All five figures collapse
into it; each section's **copy becomes annotation beside the plate's matching station**. No section
keeps a separate diagram.

**Projection is settled: flat orthographic 2D. Not 3D, not perspective.** The reason is not taste —
it is that **width is the encoding**. A flow's width _is_ its quantity, which is what makes
conservation checkable by eye. Perspective makes width vary with distance from camera, so a
narrowing ribbon becomes ambiguous between "less money" and "further away". Perspective and
measurable width are mutually exclusive, which is why P&IDs and Sankey balances are orthographic.
3D is also unkind to hairlines and small mono type, which is most of this figure. **Do not reopen
this.**

### The anchor — the grammar already exists in Resonance

The owner on the resonance figure: _"i think this diagram actually does do a good job just needs to
be improved."_ **That figure is the grammar.** Conserved bands whose width is the quantity,
splitting into per-asset lanes that always sum to the trunk. Extend that language to the whole
system. Nothing new needs inventing.

Note on particles: specks in the resonance figure are **legitimate** — they ride on a band whose
width already carries the quantity, and they show direction and motion. What was wrong in the old
overview was specks used **instead of** width. Motion on top of an honest width: fine. Motion
standing in for a quantity: not.

### The stations, top to bottom

```
THE MINE   4x4 · sixteen slots, each a falling-price (Dutch) auction
           mine() → restart price x2 (with the $1 floor named where it binds),
           colour flash on the take; GBX accrues out on a clock (neutral/white)
           the payment FORKS:
              80%  ──▶ outgoing tenure miner — a PULL CLAIM they must collect. DEAD END.
              rem. │   (100% only on an empty slot's first fill)
                   ▼
ROUTER     a POOL that HOLDS. It fills. It does NOT forward.
           outlet valve = route(), permissionless, no role/bounty/liveness —
           it may wait indefinitely.       ▼  7-day stream
SIGNAL ⌁   splits into four — lane widths are the shares  (the resonance streamgraph)
                                          ▼
AUCTIONS   four buckets fill · falling ask · flush to the asset
           └─ 10% tap → signalers: LABELLED, not followed (see below)
                                          ▼
THE FUND   NVDA #9E5CF2 │ QQQ #F92B92 │ WBTC #FF6274 │ AAPL #F57ACD, widths ∝ holdings
                                          ▼  burn GBX (neutral)
YOUR SHARE the same pro-rata slice out of EVERY bay ──▶ YOU
```

### THE DISCONTINUITY AT THE ROUTER IS MANDATORY — it is the plate's most important feature

**The plate is NOT one continuous conserved flow from mine to fund, and must never be drawn as
one.** `docs/MODELS.md` is explicit that the Resonance model _"begins after revenue has been
forwarded from ResonanceRouter… It is deliberately not a claim that a Mine replacement forwards or
schedules revenue synchronously."_ Mine emits `RevenueDeposited` and stops; only
`ResonanceRouter.RevenueRouted` proves a forward.

So: **conservation holds strictly WITHIN each segment, and the Router is an explicit buffer where
the chain is deliberately broken.** Draw the break. A plate that lets the mine's deposit flow
straight on into the stream is **wrong**, however much better it composes.

### Three honesty corrections to the owner's sketch — all three bind

1. **Most mining USDG does not reach the pool.** On an occupied slot `floor(paid * 8000/10000)` —
   **80%** — is credited to the _outgoing tenure miner_ as a **pull claim they must collect**; only the
   nominal remainder is requested into the Router. Under the supported standard USDG model that amount arrives. It
   is 100% only on an **empty slot's first fill**. The mine's payment must visibly fork, with the 80% leg dead-ending
   at the outgoing tenure miner.
2. **USDG does not buy GBX.** The payment buys the **slot** — the right to mint. GBX then accrues
   on time at `globalTps/16`, **tenure-locked** and independent of what was paid. The honest and
   equally punchy framing: **USDG buys the slot; the slot mints GBX on a clock.**
3. **Signalers may be simplified but not erased.** The owner: _"i think we leave out signallers
   getting paid for now to keep things simple."_ Agreed for the _payout_, but the **10% tap must
   still be drawn and labelled** at the auction, or the split reads as 100%-to-fund, which is
   false. One labelled stub that is not followed further.

### Re-decomposition

- `ribbon-kit` — **unchanged and still first.** Direction-independent, and now more load-bearing:
  the plate is made of conserved ribbons, the six glyphs, the two line weights and the legend.
- `plate-spine` — **the hard piece.** One canvas, one registered sim, the master top-to-bottom
  layout, the conserved flow through every station, the Router discontinuity, and the wiring to the
  frozen models. Conservation proved numerically per segment.
- `plate-mine` · `plate-router-split` · `plate-auctions-fund` — station detail passes on the spine.
  They refine; they do not re-layout.
- `page-recomposition` — the five sections lose their figures; **all copy survives**, re-seated as
  annotation beside its station. The hero and close honesty blocks, the "Illustrative parameters"
  chips and the sim notes are untouchable.
- `specimen-grammar`, then the read-only audits `motion` · `autonomy` · `performance-and-a11y`.

`overview-flow` as a separate piece is **superseded** by `plate-spine`.

### The model-composition rule

The five existing `step()` models stay **verbatim**. The plate composes them; it does not rewrite
them. Moving a model into a shared module is permitted **only as a pure move**, proved by diff —
no edit to any quantity, rate, cap, timing or rule. Anything more, stop and ask the lead. The
narrow provenance ruling for the fund's four hues (`MODEL-RULING-overview.md`) still applies and
still stands as the only authorised model change.

## The grammar, per figure

**⚠ Superseded by OWNER AMENDMENT 2 above — these five figures now collapse into one plate. The
per-figure grammar below is retained because it still describes what each STATION of the plate must
do.**

| Figure                                     | Grammar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Libraries                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Overview** — the whole loop              | **Stock-and-flow / Sankey: width = quantity, strictly conserved.** **⚠ READ THE OWNER AMENDMENT ABOVE FIRST — it sets the altitude and overrides parts of this cell.** Keep the five-band vertical composition; the sphere ledger survives **as four asset-hued groups, width ∝ holdings**, not as ninety flat-pink spheres. Strip the mechanism detail (16 slot ticks, 4 auction cylinders, price-fall lines) and the drifting specks — the sections below own those. Close the loop with an explicit labelled exit stub and return rule as _art direction_ — the burn is a sink, not a re-entrant flow. **Draw the Router as a holding vessel with its own outlet, never as a pass-through elbow** — see the deposit-is-not-a-stream rule above. | `d3-shape` ribbons; hand conservation math                                     |
| **Mining** — 16 slots                      | **Small-multiples instrument board.** Sixteen identical mechanisms, mono labels, one job each. Slot meters read as **clocks** — empty at restart, full at the hour (standing owner rule; overrides DESIGN.md's shrink rule for these meters only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | none — the decay is a straight line; `bezier-easing` for the take/restart snap |
| **Resonance** — signal aimed at strategies | **Conserved streamgraph — already implemented, and correctly.** The existing cross-section machinery with per-station lag so four channels always sum to the whole stream is _better than any library provides_. **Do not replace it.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `bezier-easing` only                                                           |
| **Fund** — acquisition + redemption        | **Proportional stacked bays (stock) + tapered claim ribbons (flow).** Redemption is where a library visibly raises craft: _n_ parallel ribbons, one per bay, each leaving at width ∝ (burn share × holdings), converging on the burner, asset-hued; the GBX burn drawn neutral.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `d3-shape` via the shared `lib/ribbon.ts`                                      |

**Where no library is the right answer, say so and hand-roll it.** Do not add a dependency for
something thirty lines of arithmetic already does better.

## The bar

1. **`ciechanow.ski`** — the primary bar. Every animation is the argument; each isolates one idea; a
   frozen frame teaches as well as a moving one; **nothing is ever cut by its own container**; every
   mark is labelled or self-evidently part of the mechanism; a callout never occludes what it names,
   and tracks what it names if that moves.
2. **The current build, measured.** Open it at `http://localhost:3001` and beat it. It is
   measurably good: spheres never interpenetrate (min centre-to-centre 1.00 diameter over 240
   samples), zero type collisions at two thresholds, CLS 0.000, one rAF loop (3,814 of 3,815 calls),
   every canvas at exactly 0 draw-ops when parked, worst frame callback 2.6 ms with zero long tasks
   in ~43,000 frames, and animations that do not lose to their own reduced-motion stills.
   **Matching it is failure.**
3. **Engineering drafting** — a P&ID, a Sankey energy balance, a systems-dynamics stock-and-flow
   diagram. The quality to capture: **conservation is visible**, quantity is geometric, and a
   reader can trace one unit of value from entry to exit.
4. **`stripe.com`** — typographic craft and restraint. **`linear.app`** — dark-theme material, one
   light source, purposeful easing.

## The ball-colour law — binding

A reader learns three types **once** and can then read any diagram on the page.

| quantity                               | colour                     | rule                                                |
| -------------------------------------- | -------------------------- | --------------------------------------------------- |
| **USDG** — capital arriving            | `#29B6F0` blue             | **always**, everywhere, no variation                |
| **GBX** — supply, and what gets burned | neutral / white            | **always**, everywhere, no variation                |
| **Assets** — what signal buys          | one distinct hue per asset | differ from each other; each consistent with itself |

Asset palette, already shipped by `Fund.tsx`: `NVDA #9E5CF2` · `QQQ #F92B92` · `WBTC #FF6274` ·
`AAPL #F57ACD`.

- **The trade is an exchange.** Blue USDG goes out to the trader and an asset hue comes back. Draw
  it as an exchange, not a recolour in place.
- **Fix on sight — this is a named deliverable:** the overview paints its whole fund field flat
  pink while the fund paints four asset hues. Same holdings, two encodings. **Unify them.**
- **Flagged risk:** `QQQ #F92B92` _is_ the brand pink, which page-wide also means "signal". A QQQ
  ribbon beside a signal ribbon can collide semantically. Resolve by **form, not hue** — signal as
  lines/planes, assets as labelled bays and ribbons — or bring the lead a better answer.
- Wide flat ribbons make token colours structural: **verify AA contrast at ribbon scale**, and that
  the four asset hues stay distinguishable from each other.

## What must not change

- **All copy, all numbers, all honesty content**: the hero and close honesty blocks, the
  "Illustrative parameters" chips, the sim notes. If a redesign would bury them, the redesign is
  wrong.
- **Contract accuracy**, per THE ONE RULE.
- **Colour semantics**: blue = USDG capital arriving, pink = signal and what it buys, neutral = GBX
  supply and burns. Decorative colour must never read as data.
- **The autonomy contract** (`docs/GAUNTLET.md`, "The diagrams run themselves"): no buttons, nothing
  focusable inside a sim, every beat scripted and guaranteed on **accumulated sim time** rather than
  wall-clock, `reset()` re-arming after 30 s away, no faked state the mechanism cannot reach.
- **A sim must not run before it has been seen.** The harness gates on genuine first sight and each
  sim registers its **panel**, not its section. Do not defeat either.
- **Accessibility**: AA contrast, visible focus on every focusable element, `prefers-reduced-motion`
  honoured with a **meaningful still that teaches**, zero layout shift, no horizontal scroll at
  390 / 1280 / 1440. **Zero app-authored `aria-live` regions** — currently true, must stay true.
  Each canvas carries `role="img"` with a descriptive label.
- **Architecture**: one shared rAF loop, IntersectionObserver pausing, StrictMode-safe registration,
  cleanup that clears every timer and listener, self-hosted fonts only, **no network requests at
  runtime**, **static prerender**.

## The harness rule for library code — non-negotiable

**All `d3-shape` layout computation happens in `buildLayout()` / `resize()` / on model events —
never inside the rAF `paint()`.** Then `static()` stills keep working unchanged and the
zero-draw-ops-when-parked property holds. A builder that calls `area()` per frame has broken the
page's performance contract even if it looks fine.

Related, already fixed and easy to re-break: **never read `clientWidth` or `getBoundingClientRect`
after writing DOM in the same rAF callback.** Fund and Mining now cache from a ResizeObserver and
register zero forced layouts per frame. Keep it that way.

## Already done — do not redo, do not regress

Landed as commit `16f22d3` on `claude/landing-2d-fixes`, each with measured acceptance evidence:

1. `.board` uses `overflow: clip; overflow-clip-margin: 2px`, so the event ring draws a **full
   perimeter** on every cell including the ends. (The `inset` alternative regresses — an inset ring
   is occluded by an existing `border-top`.)
2. Flash inks lifted: lit inset alpha `.16 → .10`, `fund-evt-white .09 → .06`. `.cell__id`/
   `.cell__sub`, the open cell, and both acquisition labels now measure **4.64–4.91:1** during the
   flash, and the flash reads _stronger_ than before.
3. Mining's historical `NO ONE DISPLACED` UI label — meaning first occupation of an empty slot, not
   that self-replacement is forbidden — teaches the 100 %-to-Router route and was painted at
   `inkA(0.55)`: **2.48 → 5.21:1** measured.
4. Resonance's ledger delta holds at full opacity then fades on a 320 ms transition:
   **98.1 % of its visible life ≥3:1** (was ~65 %), longest partial ramp 186 ms.
5. `/specimen` wordmark clamp floor lowered below 390 px — 320 px no longer crops it; 390/1280/1440
   sizes bit-identical.
6. `.hero__margin.reveal` pinned to its revealed state where `display: contents` makes it
   unobservable to IntersectionObserver, so content cannot vanish if the display type ever changes.
7. `Fund.tsx` and `Mining.tsx` register **zero forced synchronous layouts per frame** (RO-backed
   size caches).
8. **`overflow-x: clip` is load-bearing** — `--bleed` is computed from `100vw`, which includes the
   classic-scrollbar gutter, so a bleed plane overshoots ~8 px at ≥1312 px and the clip absorbs it.
   Documented at both sites. **Do not remove it.**

If a critic reports one of these as broken, that is a **regression** and outranks new work.

## Decomposition

Suggested pieces. Judge `ribbon-kit` first — everything downstream consumes it.

- `ribbon-kit` — the shared vocabulary and technical foundation: `lib/ribbon.ts` (the conserved
  tapered-flow primitive), the ISA glyph kit (valves, gates, instrument bubbles, process vs signal
  line weights), the easing binding to `--ease`, and the published legend. **Delivered as a
  rendered specimen section**, live through `registerSim` like every other sim. Prove conservation
  numerically: a ribbon's width must be the model's quantity at every station, not an eyeballed
  taper.
- `overview-flow` — the whole loop, and **the proving ground**. The messiest today and the figure
  that carries the page. Includes the flat-pink-fund-field unification.
- `mining-board`, `resonance-stream`, `fund-flows` (acquisition + redemption) — one builder/critic
  pair each. Resonance is largely a grammar-alignment and glyph pass; **do not rewrite its
  conserved streamgraph.**
- `specimen-grammar` — the specimen documents the design system; bring the legend and glyph kit onto
  it so the spec matches what ships.
- `motion` · `autonomy` · `performance-and-a11y` — cross-cutting, run last, as **read-only audits**
  that produce findings you dispatch to the piece owners.

### Owner checkpoint — mandatory

**After `overview-flow` passes its critic, stop and bring the owner a side-by-side** of the rebuilt
overview against the current one, in place on the page, at 1440 and 390. Do not convert the
remaining figures before that checkpoint. The owner has cancelled one direction already after
seeing work in progress; the checkpoint exists so that judgement happens on one figure, not five.

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
frames across a full cycle — a single still cannot judge motion. Give each new builder the critic's
ranked gaps **verbatim** plus an explicit "verified passing, do not churn" list.

## Method lessons already paid for — do not rediscover these

- **Use positive controls.** A zero from an uncalibrated instrument is worthless. Prove a detector
  finds an injected defect before trusting its zero. This caught two instrument bugs: programmatic
  `.focus()` does not set `:focus-visible`, and `blur()` leaves Chrome's sequential-focus start
  behind, silently skipping tab stops.
- **Contrast of antialiased text must be measured on the stroke body, not the brightest pixel** —
  and a bare stroke-body number is uninterpretable without a **calibration ramp** of known declared
  ratios drawn in the same font, size and subpixel origin. It misleads in both directions. For
  canvas text, screenshot with the canvas hidden to learn the true backdrop.
- **Any reduced-motion pixel diff must threshold at Δ ≥ 3.** Gradient dithering in the capture path
  produces ~500 k differing pixels of which 95 % differ by exactly 1/255. The real evidence is rAF
  tick counts, canvas draw-op counts and `document.getAnimations()`, not pixels.
- **`--clip` cannot be combined with `--frames`** in this Chrome build — a clipped capture needs
  `captureBeyondViewport`, which freezes rAF and hands you identical frames. Use `--selector`.
- The dev server emits its own console messages (React DevTools, HMR, Fast Refresh). **Attribute
  every message to its source before counting it**, and run the final console check against a
  production build.
- Completed subagents cannot be resumed. Each round needs a **fresh** builder.
- **Watch a stage long past its scripted beats.** The single most common honesty failure found so
  far is a loop that stops conserving once its script completes — counters that park while material
  keeps flowing, or stock that refills from nowhere. Every accumulating figure needs a stated idle
  policy: park on a composed still, or draw the recirculation as a mechanism. Nothing in between.

## Running and looking at the work

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"   # repo pins Node 22.23.1
pnpm install
cd apps/landing && pnpm run dev        # http://localhost:3001
pnpm exec eslint app components lib && pnpm exec tsc --noEmit
pnpm run build                          # must stay statically prerendered — all ○, no ƒ
```

A screenshot tool and its usage notes live in the session scratchpad's `TOOLING.md`; the lead should
locate or recreate it and hand every builder and critic the path. **You MUST look at every PNG you
capture — a screenshot you did not read proves nothing.** **Only the lead runs `pnpm run build`** —
concurrent Next builds clash over `.next/`.

Work on a branch off `claude/landing-2d-fixes`. **Do not merge to `main` without the owner's
explicit say-so** — the owner's standing preference is to review the branch first.

## File map

```
apps/landing/
  app/globals.css                  design system: tokens, type, primitives, reduced-motion switch
  app/specimen/                    the rendered design-system specimen (noindex)
  lib/harness.ts                   the single rAF + IntersectionObserver driver; registerSim()
  lib/ribbon.ts                    (you create) the shared conserved-flow primitive
  components/sections/*.tsx        one component per section, each with its own .css
  docs/GAUNTLET.md                 the first gauntlet's standard — still the baseline
  docs/GAUNTLET-2-FACTORY.md       the cancelled 3D attempt — read only for its method lessons
  docs/ART-DIRECTION.md            the visual brief — binding, except its 3D amendment (moot)
  docs/BRIEF.md                    protocol ground truth + honesty rules — binding
  docs/MODELS.md                   the verified models + contract citations — FROZEN, and recently
                                   changed by main's `feat(mine): finalize fixed-slot emissions and
                                   routing` — **read it before you start**, do not work from memory
                                   or from any older description of the mining routing
  docs/DESIGN.md                   the current design system's spec
```

## Definition of done

- A stranger can trace one unit of value from entry to exit through any figure, and the five
  figures teach one grammar rather than five.
- **Conservation is visible and true**: a flow's width is the model's quantity at every station,
  and nothing appears or vanishes without a drawn mechanism — including long after the scripted
  beats end.
- Every mechanism drawn does a job; nothing decorative carries a path.
- The ball-colour law holds everywhere, and the overview and fund encode holdings identically.
- Every figure still comes from the frozen model; `docs/MODELS.md` still describes what is drawn.
- The autonomy contract intact: no controls, every beat guaranteed, nothing running unseen.
- AA contrast at ribbon scale, zero layout shift, no horizontal scroll, `prefers-reduced-motion`
  teaching, no runtime network requests, **zero console errors in a production build**, static
  prerender intact, zero forced layouts per frame.
- Added dependencies total **under 3 kB gzipped**, and every one of them is on the adopt list.
- **Measurably better than the build it replaces, on the same instruments.**
- A fresh critic, shown only the bar and the rendered site, cannot say the bar wins.
