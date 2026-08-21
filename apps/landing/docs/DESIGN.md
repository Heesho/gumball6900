# GumBall6900 landing — design system spec

Everything here is already defined in `00-head.html`. Use these classes and tokens before
writing any CSS of your own. A section that follows this file to the letter will sit next to
seven other sections and look like one person designed the page. See `docs/landing/specimen.html`
for every primitive rendered.

## Faces

| Token | Face | Use |
|---|---|---|
| `--font-display` | Modak | The wordmark (`.wordmark`) and big brand numerals (`.display-num`) ONLY. Both classes pin `font-weight: 400; font-synthesis: none` — Modak ships one weight and synthetic bold smears it. Never set Modak any other way. |
| `--font-sans` | Schibsted Grotesk | All prose, headings, UI. Weights loaded: 400, 500, 600, 700, 800. |
| `--font-mono` | JetBrains Mono | Every number that changes, every ticker symbol, sim chrome. Weights loaded: 400, 500, 600. Use the `.num` class (adds `tabular-nums`). |

Never introduce another face or weight. Numbers in simulations are always `.num` (mono,
tabular) so digits don't jitter as they tick.

## Colour tokens and what they mean

Accents are semantic. If a colour doesn't mean the thing below, don't use the colour.

| Token | Value | Meaning / use |
|---|---|---|
| `--bg` | `#0C0C0C` | Page ground. Sections never repaint it. |
| `--bg-panel` | `#14141A` | Cards, sim panels. First surface step. |
| `--bg-raised` | `#1C1C24` | Sim-panel headers, chips-on-panels, second step. |
| `--bg-hover` | `#23232E` | Hover fill for raised interactive rows. Non-text only. |
| `--rule` | `#2A2A36` | Default hairline border, table rules, meter tracks. |
| `--rule-strong` | `#3C3C4C` | Border for chips/buttons that must read as interactive. Non-text only. |
| `--text-hi` | `#FFFFFF` | Headings, strong, stat values. |
| `--text` | `#F4F4F8` | Default body ink. |
| `--text-muted` | `#ADADC0` | Ledes, card bodies, secondary UI. |
| `--text-faint` | `#8A8AA0` | Eyebrows, notes, sim footnotes. Smallest text still passes AA — see ratios. |
| `--pink` | `#F92B92` | **Signal and what it buys**: signal weights, acquisitions, holder-directed anything. |
| `--blue` | `#29B6F0` | **USDG capital arriving**: miner payments, buying power, revenue streams. Also the focus ring. |
| `--pink-soft` / `--blue-soft` | 13% alpha | Tinted fills behind accent content (soft buttons, highlighted rows). |
| `--pink-line` / `--blue-line` | 45% alpha | Accent borders (`.card--pink`, `.chip--blue`, …). |

Neutral (white/grey) is the third semantic: **GBX supply and burns**. A burn animation is
white/neutral, never pink or blue. Honesty flags ("Not deployed", "Not audited") use
`.chip--warn` — neutral, carried by weight, so the accents keep their one meaning each.

Contrast ratios (computed with `contrastRatio` from `docs/whitepaper/src/theme.mjs`; AA needs
4.5:1 body / 3:1 large):

```
--text      on bg 17.83   on panel 16.72   on raised 15.43
--text-muted on bg  8.86   on panel  8.31   on raised  7.67
--text-faint on bg  5.80   on panel  5.44   on raised  5.02
--pink       on bg  5.39   on panel  5.06   on raised  4.66
--blue       on bg  8.42   on panel  7.90   on raised  7.29
--bg on --pink 5.39    --bg on --blue 8.42   (solid accent fills)
```

Every pair passes AA at body size. Do not put `--text-faint` or accents on `--bg-hover` at
small sizes without checking; stay on the three audited surfaces.

## Type scale (classes, not sizes)

| Class | Spec | Use |
|---|---|---|
| `.wordmark` | Modak 400, synthesis off, tracking +0.045em | The GumBall6900 name. Size it in your section CSS (it has no size of its own). |
| `.display-num` | Modak 400, synthesis off, lh 1 | Big brand numerals — step numbers, section counts. Size and colour in your section CSS; inherits neutral by default, take an accent only when the numeral IS that semantic. |
| `.display` | clamp(42–74px), 800, −0.028em, lh 1.02 | Hero headline only. |
| `.h1` | clamp(30–46px), 700, −0.024em, lh 1.08 | Section headline (the `<h2>` element of your section — class names are visual, elements stay semantic). |
| `.h2` | clamp(21–27px), 700, −0.015em | Sub-headline inside a section. |
| `.h3` | 17px, 700 | Card-level heading. |
| `.lede` | clamp(16–19px), muted, max 58ch | The sentence under a headline. |
| body | 16px/1.6 `--text` | Default prose. |
| `.small` | 13.5px | Secondary prose, card bodies. |
| `.note` | 12.5px, faint | Footnotes, honesty text, illustrative-parameter labels. |
| `.eyebrow` | 12px caps, +0.17em, faint | Kicker above a headline. Accent variant is ASSIGNED per section — see the table below; do not choose your own. |
| `.num` | mono, tabular-nums | Figures in tables, stats, chips, and sim chrome are **always** `.num` (static or live); numbers inside running prose stay in the sans. |

Utilities: `.muted .faint .hi .pink .blue .measure` (62ch) `.center`.

### Eyebrow accent per section (fixed — no judgment calls)

| Section | Eyebrow class |
|---|---|
| 10-hero | no eyebrow — the wordmark leads |
| 20-overview | `.eyebrow` (neutral) |
| 30-mining | `.eyebrow eyebrow--blue` (capital in) |
| 40-resonance | `.eyebrow eyebrow--pink` (signal splits the stream) |
| 50-fund | `.eyebrow` (neutral — supply, holdings, burns) |
| 60-extras | `.eyebrow` (neutral) |
| 70-why | `.eyebrow` (neutral) |
| 80-close | `.eyebrow` (neutral) |

### Inline links

`<a>` is already styled globally: body ink, underline in `--rule-strong`, 3px offset; on
hover the underline brightens to `--text-hi` (neutral — hover is affordance, not semantics).
Focus gets the global blue ring. Use prose links only for references inside sentences
(whitepaper, contracts); any action or call-to-action is a `.btn`, never a styled link.

## Section skeleton

Every section fragment opens the same way:

```html
<section id="sec-mining" class="section section--rule" aria-labelledby="sec-mining-h">
  <div class="container">
    <header class="sec-head">
      <p class="eyebrow eyebrow--blue">Mining</p>
      <h2 class="h1" id="sec-mining-h">Sixteen slots pay for everything</h2>
      <p class="lede">…one sentence of what, not how…</p>
    </header>
    …content…
  </div>
</section>
```

- `.section` supplies vertical padding (`--sec-pad`, clamp 84–148px). Do not add your own
  section-level padding.
- `.section--rule` draws the hairline between sections — every section except the hero uses it.
- `.container` is `min(100% − 2·gutter, 1120px)` centred; `.container--narrow` (820px) for
  prose-heavy passages. Never set your own horizontal margins.
- Grids: `.cols .cols--2/3/4`, gap `--s4`, collapsing 4→2→1 at 880px/560px. If your sim needs
  a bespoke grid, scope it under your `#sec-*` id and collapse it yourself at those same
  breakpoints (880px and 560px are THE breakpoints; 390px must be clean).

## Spacing rhythm

4px base: `--s1..--s9` = 4, 8, 12, 16, 24, 32, 48, 64, 96. Use tokens, not raw px. Rules of
thumb: gap inside a component `--s2/--s3`, between components `--s4/--s5`, between blocks of a
section `--s6/--s7`. `.sec-head` already puts clamp(32–56px) below itself.

## Primitives

- **Card** — `.card` (panel bg, rule border, r-12, padding 24) with `.card__head` +
  `.card__body`. Accent editions `.card--pink` / `.card--blue` tint the border and head — only
  when the card's content is that semantic. `.card--ghost` = transparent + dashed, for
  "not yet / absent" things.
- **Chip** — `.chip` pill, 11px caps. `.chip--pink`, `.chip--blue`, `.chip--warn` (neutral,
  raised bg — honesty flags). Group in `.chipline`.
- **Button** — `.btn` (ghost pill). `.btn--primary` = white fill, dark text — the page's CTAs.
  **Primary CTAs exist only in `10-hero` and `80-close`; every other section's actions are
  `.btn`/`.btn--sm` variants — no exceptions.** `.btn--pink` / `.btn--blue` = soft accent buttons for sim
  actions, coloured by what the action moves: paying USDG → `--blue`, directing signal →
  `--pink`. `.btn--sm` for sim controls (11px caps). Disabled = attribute, styled already.
- **Stat** — `.stats` row of `.stat__value` (mono, tabular, clamp 26–38px) + `.stat__label`.
- **Meter** — `.meter > i` 4px track; paint the `<i>` width from JS. The bare fill is
  **neutral** (`--text-faint`). Colour is opt-in and must match the semantics of the quantity:
  `.meter--blue` for USDG capital (slot prices, buying power, streams), `.meter--pink` for
  signal weight and what it buys, bare/neutral for GBX amounts or anything ambiguous.
  `.meter--thick` (8px) sizes either. **A falling price must shrink** — drive width from
  100% toward 0, never fill.
- **Table** — plain `<table>` inside `.tablewrap`, styled globally (560px min-width; below
  640px viewport the wrap scrolls and fades its right edge automatically — don't add your own).

## Sim frame

Every live simulation sits in the same chrome:

```html
<div class="sim-panel">
  <div class="sim-panel__head">
    <span class="sim-panel__title sim-panel__title--blue">Mine — live model</span>
    <span class="chip chip--warn">Illustrative parameters</span>
  </div>
  <div class="sim-panel__body"> …the mechanism… </div>
  <div class="sim-panel__foot">
    <div class="sim-panel__controls"> …<button class="btn btn--sm btn--blue">…</button>… </div>
    <p class="sim-note">Production parameters are unselected; figures shown are illustrative.</p>
  </div>
</div>
```

`.sim-panel__title`'s dot is pink by default (signal); add `--blue` when the sim is about
capital. Any sim whose figures depend on unselected production parameters carries the
`Illustrative parameters` chip in its head AND the `.sim-note` in its foot. The
`.sim-clock` class styles a mono timestamp readout.

## Motion

Durations: `--t-fast` 140ms (hover), `--t-base` 200ms (state changes), `--t-slow` 320ms
(entrances), `--t-event` 1000ms (sim event emphasis). Easings: `--ease` (standard),
`--ease-out` (decelerate — entrances), `--ease-spring` (small pops only). **No other duration
or curve.** Nothing loops decoratively; nothing animates unless it carries meaning or
acknowledges input.

What animates: meter widths (painted per-frame by the harness), one-shot event flashes,
hover/focus feedback, and once-on-entry reveals via the shared `.reveal` primitive.
What never animates: layout position of prose, anything on an infinite loop, background
decoration.

**Entrance — `.reveal` is the ONLY entrance; never write your own.** Add class `reveal` to an
element: it starts at `opacity: 0; translate: 0 12px` and a shared one-time
IntersectionObserver (defined in `00-head.html`, before the SIMS stub) adds `.is-in` when it
enters the viewport, transitioning it to rest over `--t-slow` (320ms) with `--ease-out`.
Stagger siblings by setting the `--d` custom property per element
(`style="--d: 120ms"`), in 60–150ms steps, at most ~4 steps. Reveal whole blocks (a card, a
column), never individual lines of prose. **Default recipe — use exactly this unless your
section physically can't:** the `.sec-head` reveals as one block (`--d: 0`), then each
top-level block below it (card row, sim panel, table) in 90ms steps; a sim panel always
reveals as ONE block, never its internals. Under `prefers-reduced-motion` reveal elements are
simply visible — no observer, no motion.

Event emphasis: add `.evt-pink` (acquisition/signal events) or `.evt-blue` (capital arriving)
to the element; it flashes a tinted overlay + border for 1s and fades to nothing. **Remove the
class on `animationend` or a 1.1s timeout** — otherwise re-adding it won't replay and lit
states pile up.

Reduced motion: the global kill switch in `00-head.html` makes all CSS animation/transition
effectively instant, and the harness calls your `static()` instead of the loop. You still must
paint a meaningful mid-simulation still there — never a blank.

## Focus

`:focus-visible` globally = 2px `--blue` outline, 3px offset. Do not restyle it, do not
`outline: none` anywhere. Anything clickable must be a `<button>` or `<a>` so it inherits the
ring and keyboard reach.

## Writing section CSS

- Scope every rule under your section id: `#sec-mining .slot { … }`.
- Reach for tokens for every colour, gap, radius, duration, easing. If you type a hex or a
  millisecond value that isn't a token, stop.
- New component variants extend a primitive (`#sec-fund .card--asset { … }`) rather than
  rebuilding it.
- Words in HTML, shapes in SVG — SVG text does not wrap.
- No horizontal scroll at 390px: wide things get their own `overflow-x: auto` wrapper
  (`.tablewrap` pattern) or collapse.
