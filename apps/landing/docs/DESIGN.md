# GumBall6900 landing — design system spec

The direction is **"Serious money, candy soul"** (`docs/ART-DIRECTION.md`, with the reference mock
vendored at `docs/concept-c-reference.html`). Everything in this file is already implemented in
`app/globals.css`. Use these classes and tokens before writing any CSS of your own. **Every
primitive is rendered together at `/specimen`** — open that page before you design a section.

A financial-editorial spread, not a page of cards: saturation and bubble letters carry the candy;
the grid, the hairlines, the tabular mono and the instrument-grade panels carry the money.

## The five rules

1. **Colour is a plane, not a garnish.** Brand hue arrives as a full-bleed field carrying **black**
   type (`--on-field`), never as a wash behind grey cards.
2. **Nothing is centred.** Every spread is a wide column against a narrow one, and something always
   bleeds off an edge — the plane, or a section rule running past the container.
3. **Rules divide; boxes don't.** A border is drawn only where the content is a live instrument.
4. **One wordmark, misregistered.** Modak 400, `font-synthesis: none`, a cyan copy up-left and a
   magenta copy down-right at ±.026em/.016em.
5. **Numbers are the imagery.** Modak numerals at display scale carry the facts. There is no
   illustration anywhere on the page.

## Faces

| Token            | Face              | Use                                                                                                                                                                        |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--font-display` | Modak             | The wordmark (`.wordmark` / `.wm`), display numerals (`.dnum` / `.display-num`), outlined ordinals. Nothing else. All pin `font-weight: 400; font-synthesis: none` — Modak ships one weight and a synthetic bold smears the counters shut. |
| `--font-sans`    | Schibsted Grotesk | Prose and headlines. Weights loaded: 400, 500, 600, 700, 800.                                                                                                               |
| `--font-mono`    | JetBrains Mono    | **Every eyebrow, chip, button, clock, tally, cell caption and figure.** Weights loaded: 400, 500, 600. Prose figures stay in the sans; anything a reader might compare is `.num`. |

Families come from `next/font` in `app/layout.tsx` as `--nf-*` variables. Canvas code must resolve
`--font-mono` at runtime (`fontFamily()` in `lib/harness.ts`) — never hardcode a family name.

## Colour tokens and what they mean

Accents are semantic. If a colour doesn't mean the thing below, don't use the colour.

| Token           | Value     | Meaning / use                                                                              |
| --------------- | --------- | ------------------------------------------------------------------------------------------ |
| `--bg`          | `#0C0C0C` | Page ground. Sections never repaint it.                                                     |
| `--panel`       | `#101017` | Instrument ground: sim panels, board cells, tallies. First surface step.                    |
| `--raised`      | `#17171F` | Chips and inset blocks. Second step, and never a third.                                     |
| `--rule`        | `#26262F` | The hairline. Dividers, meter tracks, board gaps.                                           |
| `--rule-strong` | `#3B3B48` | Control borders, table heads, the rule that opens a `.card`. Non-text only.                 |
| `--hi`          | `#FFFFFF` | Headlines, values, instrument titles.                                                       |
| `--text`        | `#EFEFF4` | Default body ink.                                                                           |
| `--muted`       | `#ADADC0` | Ledes, card bodies, secondary UI.                                                           |
| `--faint`       | `#8A8AA0` | Eyebrows, notes, cell captions.                                                             |
| `--on-field`    | `#0C0C0C` | **Type on a colour plane is always this black.** Never white — see the ratios.               |
| `--pink`        | `#F92B92` | **Signal and what it buys**: signal weights, acquisitions, holder-directed anything, the primary action, the plane colour. |
| `--blue`        | `#29B6F0` | **USDG capital arriving**: miner payments, buying power, streams. Also the focus ring.       |
| `--pink-soft` / `--blue-soft` | 13% alpha | Tinted fills behind accent content.                                             |
| `--pink-line` / `--blue-line` | 45% alpha | Accent **borders**. A `-line` tint is a 1px rule and never glyph ink — see below. |
| `--pink-wash` / `--blue-wash` | 5.5% / 5% | The faintest state tint (`.cell--open`).                                        |
| `--pink-label`  | `#FB63AC` | Pink text **on a pink tint** — brand pink on that composite is 4.12:1 and fails AA.          |
| `--blue-label`  | `#9BDDFA` | Blue text on a blue tint (`.btn--blue`).                                                     |
| `--outline`     | `#6E6E85` | Stroke colour for neutral outlined Modak ordinals. 3.94:1 on `--bg`.                         |

Neutral (white/grey) is the third semantic: **GBX supply and burns**. A burn is white/neutral,
never pink or blue. Honesty flags use `.chip--warn` — neutral, carried by weight, so the accents
keep their one meaning each.

Legacy aliases `--bg-panel`, `--bg-raised`, `--bg-hover`, `--text-hi`, `--text-muted`,
`--text-faint`, `--container`, `--gutter` still resolve (the section stylesheets and the canvas
code read them). Prefer the short names in new work.

### Contrast ratios (AA needs 4.5:1 body / 3:1 large)

```
                       on --bg   on --panel   on --raised
--hi     #FFFFFF        19.56       18.94        17.82
--text   #EFEFF4        17.07       16.53        15.54
--muted  #ADADC0         8.86        8.58         8.07
--faint  #8A8AA0         5.80        5.61         5.28
--pink   #F92B92         5.39        5.22         4.91
--blue   #29B6F0         8.42        8.16         7.67

--on-field #0C0C0C on --pink 5.39      on --blue 8.42
#FFFFFF            on --pink 3.63  ← FAILS body copy. White never goes on a field.

--outline #6E6E85    on --bg                    3.94   (large text only — see below)
--pink-line #771A48  on --bg                    1.89   BORDERS ONLY — never glyph ink
--blue-line #195973  on --bg                    2.53   BORDERS ONLY — never glyph ink
--on-field           on the token chip on pink  4.69
--on-field           on the token chip on blue  7.21

--pink-label #FB63AC on pink-soft over raised   5.61
--blue-label #9BDDFA on blue-soft over panel   10.44
--muted              on blue-soft over panel    7.03
--text               on pink-wash over bg      16.45
--faint              on blue-wash over panel    5.29
```

Every pair the system ships passes AA at body size. Stay on the three audited surfaces; if you
invent a composite, compute the ratio and record it here.

**Outlined ordinals answer to the contrast floor too.** `--outline` is the stroke on
`.sec-head__num`, `.rail__n--outline` and `.dnum--outline`. A hollow numeral is still text, so it
needs 3:1 at large sizes. The old `#4C4C5E` measured **2.33:1** and the ordinals read as ghosts on
every section head on the site; `#6E6E85` measures **3.94:1** and still sits under the headline it
indexes. Do not take it below that.

**A `-line` tint is a 1px rule and never glyph ink.** `--pink-line` / `--blue-line` are 45% alpha:
they composite to `#771A48` / `#195973` on the ground, which is **1.89:1** / **2.53:1** — a legitimate
border, and nowhere near what text needs. Glyphs, hollow or solid, take `--pink` **#F92B92 (5.39:1)**
or `--blue` **#29B6F0 (8.42:1)** at full strength. `.col__n` — the oversized ordinal on a `.cardrow`
— stroked with `--pink-line` and painted 1.89:1, half of the 3:1 floor the same page prints for
`.dnum--outline`; it now strokes `--pink` (and `--blue` under `.cardrow--blue`), matching what the
live section already rendered. The only permitted uses of a `-line` token are `border-color` and
`border-top`: chips, `.btn--blue` / `.btn--pink`, and the rules on the section stylesheets.

**Nothing white ever lands on a plane.** Beyond the per-class list, `.field` pins *every*
text-bearing descendant to `--on-field` — including bare `<b>`/`<strong>`, which the base rules
paint `--hi` white, and `.pink`/`.blue`, which would vanish into their own plane. `.chip` is
excluded because it brings its own `--raised` ground. An inline code token on a plane is set apart
by **face and ground, never by colour**: `.field code` / `kbd` / `samp` / `.tok` get the mono face,
an 8% black wash and a `--on-field-rule` hairline. The wash is 8% and not more because at 12% the
composite falls to `#DD2782` and black on it measures 4.37:1 — under the body floor.

## Editorial metrics

| Token      | Value                             | Meaning                                              |
| ---------- | --------------------------------- | ---------------------------------------------------- |
| `--maxw`   | `1312px`                          | The spread — **margins included**.                    |
| `--marg`   | `clamp(20px, 4.4vw, 64px)`        | Page margin, inside the max width.                    |
| `--bleed`  | `max(0px, (100vw - 1312px) / 2)`  | Max-width edge → viewport edge.                       |
| `--edge`   | `bleed + marg`                    | **Content edge → viewport edge.** Bleed by this much. |
| `--sec-pad`| `var(--s-sec)`                    | Section vertical padding. Alias — see the table below.|

`.container` = `max-width: var(--maxw)` + `padding-inline: var(--marg)`, centred.
`.container--narrow` (820px of content) stands alone or combines with `.container`.

Bleed helpers, valid only on a direct child of `.container`: `.bleed-r`, `.bleed-l`, `.bleed-x`
run a surface's ground off the edge while its content stays on the grid; `.rule-bleed-r` does the
same for a bare rule. `html`/`body` are `overflow-x: clip`, so a bleed can never produce a
horizontal scrollbar.

Radii: `--r-s` 2px (controls, boards), `--r-m`/`--r-l` 3px (panels), `--r-full` for dots and
spheres. **Nothing else is round.**

## Type scale (classes, not sizes)

The full resolved ramp — size / line-height / tracking / weight for **every** class below, printed
beside a live sample of it — is §03 of `/specimen`. That page is the source of truth; this table is
the index.

| Class            | Spec                                              | Use                                                                 |
| ---------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| `.wm`            | Modak 400, clamp(50–164px), lh .88, misregistered | The display wordmark. `.wm__line` breaks it into lines.               |
| `.wordmark`      | Modak 400, misregistered, inherits size           | The name at any smaller size. Size it in your section CSS.            |

The misregistration is **two opaque plates**, never a plate and a shadow. On the ground: solid
`--pink` down-right (+.026em/+.016em), solid `--blue` up-left, zero blur. Inside a `.field` it
inverts to solid `--on-field` down-right and solid `--white` up-left at the same offsets. An alpha
value on either copy renders it as a drop shadow, which is the exact thing rule 4 is defined
against. §04 of `/specimen` shows both, plus untreated Modak for comparison.
| `.dnum` / `.display-num` | Modak 400, lh 1                           | Display numerals. Inherits neutral; `.dnum--pink` / `--blue` only when the numeral IS that semantic. |
| `.dnum--outline` | transparent + 2px stroke                          | An ordinal — a number that marks a place, not a quantity.             |
| `.display`       | clamp(38–72px), 800, −.032em                      | The largest statement on a page. One per page at most.                |
| `.h1`            | clamp(31–56px), 800, −.03em, lh 1.03              | Section headline (the section's `<h2>` element).                      |
| `.h2`            | clamp(20–26px), 700, −.018em                      | Sub-headline inside a section.                                        |
| `.h3`            | 19px, 700, −.012em                                | Card-level heading.                                                   |
| `.lede`          | clamp(16.5–20px), muted, max 62ch                 | The sentence under a headline.                                        |
| body             | 16px/1.6 `--text`                                 | Default prose.                                                        |
| `.small`         | 14px/1.62                                         | Secondary prose, card bodies.                                         |
| `.note`          | 12.5px, faint                                     | Footnotes, honesty text, illustrative-parameter labels.               |
| `.mnote`         | mono 11.5px, faint                                | Mono micro-copy inside a panel.                                       |
| `.eyebrow`       | **mono** 11.5px caps, +.19em, faint               | Kicker above a headline. `--pink` / `--blue` variants are assigned per section — see below. |
| `.num`           | mono, tabular-nums                                | Every figure in a table, stat, chip or instrument.                    |
| `.mono`          | mono, tabular-nums                                | Any run of mono micro-copy.                                           |

Utilities: `.muted .faint .hi .pink .blue .measure` (62ch).

There is **one** eyebrow. Micro-caps inside a section (a block caption, a route label) use the
same recipe — mono, 10.5px, weight 500, .19em, uppercase, `--faint` — not the sans.

### Section flag and eyebrow (fixed — no judgment calls)

The section head flies a 3px brand rule (`--flag`) that runs past the container to the viewport
edge. A section that declares its meaning on the eyebrow gets the matching flag automatically
(`.sec-head:has(.eyebrow--pink)`); otherwise set `--flag` in the section's own CSS.

| Section      | Eyebrow                    | `--flag`         | Why                              |
| ------------ | -------------------------- | ---------------- | -------------------------------- |
| hero         | none — the wordmark leads  | —                |                                  |
| overview     | `.eyebrow`                 | blue (default)   | the loop starts with money in    |
| mining       | `.eyebrow eyebrow--blue`   | blue (auto)      | capital arriving                 |
| resonance    | `.eyebrow eyebrow--pink`   | pink (auto)      | signal                           |
| fund         | `.eyebrow`                 | blue (default)   | what the capital bought          |
| extras       | `.eyebrow`                 | pink             | signal and what it buys          |
| why          | `.eyebrow`                 | pink             | who steers                       |
| close        | `.eyebrow`                 | `--rule-strong`  | status is neither               |

## Section skeleton

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

`.sec-head` draws the bleeding brand rule itself. The **indexed** variant puts an outlined Modak
ordinal in the left margin with the eyebrow beneath it:

```html
<header class="sec-head sec-head--indexed">
  <div class="sec-head__index">
    <span class="sec-head__num" aria-hidden="true">01</span>
    <span class="eyebrow eyebrow--blue">Mining</span>
  </div>
  <div class="sec-head__body">
    <h2 class="h1" id="…">…</h2>
    <p class="lede">…</p>
  </div>
</header>
```

- `.section` supplies vertical padding (`--s-sec`, via the `--sec-pad` alias). Do not add your own.
- `.section--rule` draws the hairline between sections — every section except the hero.
- Grids: `.cols .cols--2/3/4`, gap `--s-gutter`, collapsing 4→2→1 at 880px/560px. Bespoke grids go
  under your `#sec-*` id and collapse at those same breakpoints (880px and 560px are THE
  breakpoints; 390px must be clean).
- A bespoke spread is `minmax(0, 1fr) minmax(0, var(--s-split))` with `gap: var(--s-spread)`, and a
  stack inside a column is `gap: var(--s-stack)`. **Reach for a composition token before you type a
  px value** — see the table under Spacing rhythm, all of it rendered in §02 of `/specimen`.

## Spacing rhythm

4px base: `--s1..--s9` = 4, 8, 12, 16, 24, 32, 48, 64, 96. Use tokens, not raw px. Gap inside a
component `--s2/--s3`, between components `--s4/--s5`, between blocks `--s6/--s7`.

### Composition tokens — the gaps a section is actually built from

The scale above is the alphabet; these are the words. **Compose a new section out of these, not out
of numbers measured off an existing one.** Every row is printed with a rendered sample of the real
gap in §02 of `/specimen`, the same way §03 prints the type ramp — a spacing system nobody can read
off the page is not specified, it is only obeyed by whoever wrote it.

| Token          | Value                        | At 1440 | Meaning                                                |
| -------------- | ---------------------------- | ------- | ------------------------------------------------------ |
| `--s-sec`      | `clamp(60px, 7.4vw, 112px)`  | 106.6px | Section padding, block. `.section` and `.sp-sec`.      |
| `--s-headfoot` | `clamp(30px, 3.6vw, 52px)`   | 51.8px  | Section head → first content. `.sec-head` margin.      |
| `--s-headgap`  | `clamp(20px, 3vw, 48px)`     | 43.2px  | Ordinal column → headline column.                      |
| `--s-headrow`  | `var(--s3)`                  | 12px    | Rule → eyebrow → headline → lede.                      |
| `--s-index`    | `180px`                      | 180px   | The ordinal column of an indexed head.                 |
| `--s-spread`   | `clamp(24px, 3.2vw, 52px)`   | 46.1px  | Wide column → narrow column, in any spread.            |
| `--s-split`    | `0.62fr`                     | 703/436 | The narrow column of a body spread, against `1fr`.     |
| `--s-aside`    | `420px`                      | 892/420 | The **fixed** narrow column of an opening spread.      |
| `--s-stack`    | `clamp(20px, 2.4vw, 32px)`   | 32px    | Between blocks stacked inside one column.              |
| `--s-gutter`   | `var(--s5)`                  | 24px    | Between cards in a row. `.cols` gap.                   |

`--sec-pad` is kept as an alias of `--s-sec` — the section stylesheets already call it that. There
is now **one** section rhythm: the specimen used to run its own `clamp(52px, 6.4vw, 92px)` and
publish neither number.

`--s-split` is a fraction and `--s-aside` is a fixed px on purpose. A body spread should re-proportion
with the viewport; an opening spread should not, so its plane crops the same way at every width.

## Primitives

- **Colour plane** — `.field` (pink) / `.field.field--blue`. Carries `--on-field` black type;
  `.field__cap` is its mono caption rule; focus rings inside it flip to black. Pair with
  `.bleed-r` / `.bleed-x` so it runs off an edge. Never a wash behind cards.
- **Card** — `.card` is a **column under a rule**: no ground, no frame, no radius, 1px
  `--rule-strong` on top. `.card__head` + `.card__body`. `.card--pink` / `.card--blue` colour that
  rule (only when the content is that semantic); `.card--ghost` dashes it; `.card--framed` is the
  escape hatch for content that really is an instrument.
- **Card row** — `.cardrow` (`--2` / `--4`, `--blue`): columns divided by hairlines under one 2px
  brand rule, each opened by `.col__n` — an oversized outlined ordinal. `.col`, `.col__t`,
  `.col__b`. This is the shape "a grid of cards" should take.
- **Board** — `.board` (`--2`): cells divided by hairlines, the grid gap **is** the rule.
  `.cell`, `.cell--open`, `.cell__top`, `.cell__id`, `.cell__owner` (`--open`), `.cell__price`,
  `.cell__sub`. Where a board shows a subset, say so with `.cell--ghost` — never truncate silently.
- **Tally ribbon** — `.tallies` (`--4`) of `.tally` `<dt>`/`<dd>` pairs, mono, hairline-divided.
- **Data rail** — `.rail` / `.rail__in` / `.rail__cell` / `.rail__n` (`--pink`, `--blue`,
  `--outline`) / `.rail__l`. Oversized Modak numerals; this is the page's illustration.
- **Stats** — `.stats` of `.stat` + `.stat__value` (mono tabular) + `.stat__label`, divided by
  hairlines, 4→2 at 880px.
- **Chip** — `.chip`, mono 10.5px caps, 2px corners, square marker. `.chip--pink`, `.chip--blue`,
  `.chip--warn` (neutral, hollow marker — honesty flags). Group in `.chipline`.
- **Button** — `.btn`, mono 12px caps, 2px corners. `.btn--primary` = **pink plane, black type**
  (5.39:1) — the page's CTAs. **Primary CTAs exist only in the hero and the close; every other
  section's actions are `.btn` / `.btn--sm`.** `.btn--pink` / `.btn--blue` are soft accent buttons
  coloured by what the action moves. On a `.field`, buttons invert to the ground colour.
- **Meter** — `.meter > i`, 3px track; paint the `<i>` width from JS. The bare fill is **neutral**.
  `.meter--blue` for USDG capital, `.meter--pink` for signal, bare for GBX or anything ambiguous.
  `.meter--thick` (7px). **A falling price must shrink** — drive width from 100% toward 0.
- **Table** — plain `<table>` inside `.tablewrap`; mono heads, hairline rules; below 640px the
  wrap scrolls and fades its right edge. A fade says "edge", not "more this way", so a table that
  is cut also carries a `.tablemore` ghost line under it naming the column that is off-screen and
  pointing at it — the same never-truncate-silently rule the slot boards follow.
- **Gumball motif** — `.gum` (`--pink`/`--blue`/`--white`/`--dark`, sized by `--gum-size`),
  `.gumrow`, `.gumfield` (decorative absolute scatter, hues cycle, `aria-hidden`), `.gumdisc` (the
  dark disc the mark sits inside). **The law:** a gumball never carries a value, never sits alone
  beside a figure, and a field of them is always multi-hue and cropped by its container. No
  rendered machine, no glass dome, no chrome, no neon glow — a flat candy dot with one soft
  highlight.

## Sim frame

The **only** surface in the system that gets a full frame, because it is the only content that is
a live instrument: a `--panel` ground with a lit top edge, a faint scanline, and a 3px brand flag
down the left edge.

**There is no drop shadow, and do not add one.** A shadow works by darkening its ground; this
ground is `#0C0C0C`, so the darkest shadow that can fall on it measures 1.07:1 and paints nothing.
The panel carried `0 24px 60px -40px rgba(0,0,0,.9)` for exactly that reason — zero rendered
pixels — while §02 of `/specimen` described "a long soft shadow beneath" to the reader. Making a
shadow visible here means *lightening* the ground, which is a glow, and glow is the one material
`docs/ART-DIRECTION.md` rules out. Panels separate from the ground by an edge, like everything
else: a 1px white top edge at 7% says which way is up, the 1px rule draws the boundary, the blue
haze falls from the head.

The three surface steps are close together by design (`--bg` → `--panel` is 1.03:1, `--panel` →
`--raised` 1.06:1), so a figure that shows them **must put them in contact** — nested and inset,
never as separate tiles side by side, where nothing distinguishes them and a caption ends up
asserting a value the tile is not painted in. §02 of `/specimen` is the reference figure.

```html
<div class="sim-panel">
  <div class="sim-panel__head">
    <span class="sim-panel__title sim-panel__title--blue">Mine — live model</span>
    <span class="chip chip--warn">Illustrative parameters</span>
  </div>
  <div class="sim-panel__body">
    <p class="sim-cap">…what this instrument shows…</p>
    …the mechanism…
  </div>
  <div class="sim-panel__foot">
    <span class="sim-clock">day 3, 14:08</span>
    <p class="note sim-note">Production parameters are unselected; figures shown are illustrative.</p>
  </div>
</div>
```

The flag follows the title dot, so a panel can never fly a colour its label contradicts: pink by
default (signal), `--blue` on the title for capital, `--gbx` for supply/burns (white). Explicit
`.sim-panel--blue` / `--pink` / `--neutral` modifiers exist for new work.

**The foot narrates; it never asks.** There are no controls anywhere — every simulation runs its
own programme (see the owner directive in `docs/ART-DIRECTION.md`). Any sim whose figures depend
on unselected production parameters carries the `Illustrative parameters` chip in its head AND the
`.sim-note` in its foot. §05 of `/specimen` runs this chrome against a live model — bound by the
same Mine.sol law as the mining section, registered through `registerSim()` — so the panel that
says LIVE MODEL is one. Anything you label live must actually be live; if it is a mock, label it
one.

## Motion

Durations: `--t-fast` 140ms (hover), `--t-base` 200ms (state), `--t-slow` 320ms (entrance),
`--t-event` 1000ms (sim event emphasis). Easings: `--ease` `cubic-bezier(.2,.6,.2,1)` (standard),
`--ease-out` `cubic-bezier(.16,1,.3,1)` (entrances), `--ease-spring` (small pops only). **No other
duration or curve.** Nothing loops decoratively.

What animates: meter widths (painted per-frame by the harness), one-shot event flashes,
hover/focus feedback, and once-on-entry reveals. What never animates: layout position of prose,
anything on an infinite loop, background decoration, the gumball motif.

**Entrance — `.reveal` is the ONLY entrance; never write your own.** It starts at
`opacity: 0; translate: 0 10px` and the shared one-time IntersectionObserver in `lib/harness.ts`
adds `.is-in` when it enters the viewport, over `--t-slow` with `--ease-out`. Stagger siblings by
setting `--d` per element in 60–150ms steps, at most ~4 steps. Reveal whole blocks, never
individual lines. Default recipe: `.sec-head` first (`--d: 0`), then each top-level block below it
in 90ms steps; a sim panel always reveals as ONE block.

Event emphasis: `.evt-pink` (signal) / `.evt-blue` (capital) flash a tinted overlay + border for
1s and fade to nothing. **Remove the class on `animationend` or a 1.1s timeout** — otherwise
re-adding it won't replay and lit states pile up. The lit state **holds for the first 40%** of the
second and only then fades: `--ease-out` is ~93% spent by 200ms, so easing straight from lit to
clear turned "a second of visible consequence" into a blink nobody could catch. Same class, same
token, same total duration — the second is just spent where it can be seen. Both classes fire on a
3s loop in §09 of `/specimen`; sample frames there before tuning anything.

**A comparison goes in one figure, on one axis.** §09 runs a dot down the same distance on each of
the two curves — the transition reads `var(--ease)` / `var(--ease-out)` directly, so the demo *is*
the token — and draws each bezier beside its rail. The two rails are **24px apart with nothing
between them**: both labels sit under both rails, in rail order, at every width. A caption between
the two things being compared is the one arrangement this figure may not take.

**A figure gets the width its argument needs.** The rail spans the whole content column. The rail
is a `container-type: inline-size` query container, so the travel is solved from the rail's own
width (`100cqw - var(--dot)`) rather than from a viewport sum: it can neither overshoot the column
into a horizontal scrollbar nor stop short of it, at any width. That is **1125px of travel at
1440**, against 389px when the rail shared its row with a 704px label column. It matters because
the comb is sampled in time, not in space — at 389px the last four `--ease` ticks fell 5.7 / 2.9 /
0.9px apart and the decelerating half of the comb, the half the figure exists to show, was a
smudge. At 1125px they fall **16.5 / 8.6 / 2.6px** and all ten read. `--ease-out`'s last two
samples are 0.14px apart and no width will separate them — that curve is at 99.996% of the travel
by 900ms — and the pile-up at the wall *is* that curve's finding.

The load-bearing part is the **comb**: a 1px tick at the dot's position every 100ms of the travel,
solved by bisection from the element's own `--curve` (whose computed value is the substituted
token), so it cannot drift from `--ease`/`--ease-out` the way a hardcoded table of positions
would. Ticks are placed in **percent of travel**, so re-scaling the rail costs the comb nothing.
Ticks light as the dot passes them. This exists because **both curves finish in the same
place** — a still of two parked dots carries no information, and 1000ms travel + 600ms park means
the parked state is still 38% of the cycle. The combs differ from the first tick on: `--ease`'s
first tick lands at 32.2% of the travel and `--ease-out`'s at 49.4%, at every width. Under
reduced motion the static pass places and lights every tick, so the still teaches more than the
motion does.

Track chrome is deliberately neutral: blue is capital and pink is signal, and a travelling dot is
neither. Same for the spacing samples in §02 — a measuring mark carries no semantics.

Reduced motion: the global kill switch makes all CSS animation/transition effectively instant, and
the harness calls your `static()` instead of the loop. You still must paint a meaningful
mid-simulation still there — never a blank.

## Focus

`:focus-visible` globally = 2px `--blue`, 3px offset. Inside a `.field` it flips to `--black`,
which is the only value holding AA against both brand hues. Do not restyle it, do not
`outline: none` anywhere. Anything clickable must be a `<button>` or `<a>` so it inherits the ring
and keyboard reach. `.sr-only` is available for screen-reader-only text.

## Writing section CSS

- Scope every rule under your section id: `#sec-mining .slot { … }`.
- Reach for tokens for every colour, gap, radius, duration and easing. If you type a hex or a
  millisecond value that isn't a token, stop.
- New component variants extend a primitive rather than rebuilding it.
- Micro-caps are mono, not sans. Numbers a reader compares are `.num`.
- Words in HTML, shapes in SVG — SVG text does not wrap.
- No horizontal scroll at 390px: wide things get their own `overflow-x: auto` wrapper
  (`.tablewrap` pattern) or collapse. A deliberate bleed is fine — `html`/`body` clip it.
