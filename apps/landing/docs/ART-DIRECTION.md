# Art direction brief — make it look like GumBall6900, not a dev tool

The site is built, accurate, and accessible. It is also **visually anonymous**: the owner's verdict
was "pretty amateur." This brief exists to fix the look, not the content.

## The honest diagnosis (from the rendered hero at 1440×900)

1. **The brand is absent.** Pink `#F92B92` and blue `#29B6F0` appear only inside a ~90px logo. The
   rest is white/grey on near-black. It reads as a generic dark developer-tool template.
2. **The logo is postage-stamp sized and mushy** — intricate line art rendered at 76–104px — and it
   sits directly above a wordmark spelling the same name, so the identity is stated twice and
   delivered weakly both times.
3. **Everything is dead-centered** in a single narrow column: logo, wordmark, lede, buttons, chips.
   Symmetrical stacking with empty margins is the template look. Stripe and Linear use structure,
   asymmetry, and anchoring instead.
4. **The Modak wordmark is flat white.** The brand's own mark outlines those bubble letters in pink
   and blue. The page throws away the one treatment that is unmistakably this brand.
5. **No depth, no texture, no motif.** Flat `#14141A` cards with hairline borders, repeated for
   nine sections. No gradient, no glow, no light source, no material.
6. **The gumball machine — the brand's best visual asset — is never used.** A machine full of
   coloured spheres is _literally_ what this protocol is: a vault holding many assets, dispensing
   your share when you burn. That metaphor should be visible.
7. **Every section has identical rhythm**: eyebrow → headline → lede → grid of same-size cards.
   Nothing varies, so nothing feels art-directed.

## Owner directive — the diagrams run themselves

**No manual interaction.** The reader never clicks anything to make a diagram do its job. Every
control that used to require a click — mining's "take the cheapest slot", resonance's "Signal
here", the fund's burn buttons — is removed, and the behaviour it demonstrated becomes a **scripted
autonomous beat** in the simulation's own cycle. A reader who only scrolls and watches must see
every state the buttons used to reveal, in a legible order, on a loop that repeats often enough to
be caught. Links stay links; the page keeps working with a keyboard; but the argument must never
depend on the reader operating it.

## What must NOT change

- All copy, all numbers, all honesty content (hero + close blocks, illustrative labels).
- The five simulations' **contract accuracy** — the models are verified against the Solidity. You
  may restyle their chrome, re-choreograph their beats, and convert their controls to autonomous
  events; you may not change what the mechanism does or the figures it obeys.
- Colour semantics: **blue = USDG capital, pink = signal and what it buys, neutral = GBX supply and
  burns**. Decorative colour must not contradict this — if a gumball/sphere is decorative, keep it
  clearly decorative (multi-hue, in the brand palette), never a semantic-looking single accent in a
  place where it would read as data.
- Accessibility: AA contrast, visible focus rings, `prefers-reduced-motion` honoured, no layout
  shift, no horizontal scroll at 390/1280/1440.
- Wordmark rules: Modak `font-weight: 400`, `font-synthesis: none`.

## The brand

```
pink   #F92B92    blue   #29B6F0    black  #0C0C0C    white  #FFFFFF
```

Modak for the wordmark. The mark (`public/gumball-logo.png`, 208px; a 512px master exists at
`docs/landing/src/assets/logo512.png` in git history — regenerate from the deck if needed) is a
roundel: bubble letters "GumBall6900" outlined in pink and blue.

Tone: this is a **financial product with candy-machine heritage**. It must be credible enough to
hold a whitepaper link and playful enough to be called GumBall6900. Not childish, not corporate.
Think: premium arcade cabinet, neon on wet asphalt, a chrome-and-glass gumball machine — rendered
with Linear's restraint and Stripe's typographic discipline.

## Where to be bold

- **Colour as structure**, not garnish: brand-hued glows, gradient rules, tinted surfaces, coloured
  section markers. The page should be recognisably pink-and-blue at a glance while staying dark.
- **The wordmark**: give it the mark's own pink/blue outline treatment (layered offsets or stroke),
  so the name looks like the brand rather than like Modak.
- **The gumball motif**: spheres are the brand's native shape. Holdings, assets, supply, burns —
  all are naturally spheres. Use them where they mean something.
- **Material**: give panels a light source. Subtle top-edge highlights, layered translucency, soft
  vignettes, a hint of grain. Flat rectangles are what read as amateur.
- **Scale and rhythm**: vary section composition. Let one or two moments be genuinely big.

## Hard constraints

- Self-hosted fonts only (`next/font`) — no new external requests, no third-party asset hosts.
- Any new imagery must be **CSS or inline SVG you author**, or a processed version of the existing
  logo. No stock art, no AI-image placeholders, no fake screenshots.
- Performance: no heavy always-on animation; decorative motion must be subtle, GPU-cheap, and
  disabled under `prefers-reduced-motion`. The one shared rAF harness stays as-is.

---

# CHOSEN DIRECTION — "Serious money, candy soul"

**Decided by the owner on 21 Aug 2026.** Three directions were built and compared: "The Machine"
(a rendered gumball machine), "Neon on wet asphalt" (brand colour as light), and this one. This is
the direction. Build everything to it; do not re-litigate it.

The reference mock is vendored at `concept-c-reference.html` in this directory — open it in a
browser. It is a **mock, not a component library**: it shows the hero, a section head, the sim
panel chrome, the card material, and a token legend. Where the mock and the live app disagree about
content, the app wins; where they disagree about _look_, the mock wins.

**One correction to the mock:** it still draws a "TAKE THE CHEAPEST SLOT · PAY USDG" button,
because it was built alongside the autonomy change. There are no buttons any more — see the owner
directive above. Style the panel foot as narration, not controls.

## The thesis

A financial-editorial spread, not a page of cards. The saturation and the bubble letters carry the
candy; the grid, the hairlines, the tabular mono, and the instrument-grade panels carry the money.
It should sit comfortably next to a Bloomberg feature and still be identifiable from across a room
— because the page is _pink_, not because a logo is.

## The five rules

1. **Colour is a plane, not a garnish.** Brand hue arrives as a full-bleed field carrying black
   type (`--on-field: #0C0C0C` on pink is 5.39:1), never as a wash behind grey cards.
2. **Nothing is centred.** Every spread is a wide column against a narrow one, and something always
   bleeds off an edge — the pink plane, the section rules running past the container.
3. **Rules divide; boxes don't.** Cards become columns split by hairlines with oversized outlined
   ordinals. A border is drawn only where the content is a live instrument.
4. **One wordmark, misregistered.** Modak 400, `font-synthesis: none`, with a cyan copy offset
   up-left and a magenta copy down-right (±.026em) — the roundel's own outline, printed.
5. **Numbers are the imagery.** Modak numerals at display scale carry the facts; the data ribbon
   under the hero is the hero's illustration.

## Tokens (from the mock — port these into `app/globals.css`)

```
brand      --pink #F92B92   --blue #29B6F0   --black #0C0C0C   --white #FFFFFF
surfaces   --bg #0C0C0C  --panel #101017  --raised #17171F  --rule #26262F  --rule-strong #3B3B48
ink        --hi #FFFFFF  --text #EFEFF4  --muted #ADADC0  --faint #8A8AA0
on-field   --on-field #0C0C0C          (black type on a pink or blue plane)
tints      --pink-soft/--blue-soft rgba(…,.13)   --pink-line/--blue-line rgba(…,.45)
editorial  --marg clamp(20px,4.4vw,64px)   --maxw 1312px   --bleed max(0px,(100vw - 1312px)/2)
motion     --t-fast 140ms  --t-base 200ms  --ease cubic-bezier(.2,.6,.2,1)
```

Faces stay Schibsted Grotesk + JetBrains Mono + Modak — the voice comes from scale and colour, not
a novelty face. Eyebrows are **mono**, 11.5px, .19em tracking, uppercase.

## Section and panel treatment

- **Section head**: an outlined Modak ordinal (`01`, `02`, …) in the left margin with the mono
  eyebrow beneath it; the headline in the wide column; a 1px brand rule above the headline running
  **past** the container to the viewport edge (blue for capital sections, pink for signal).
- **Sim panel**: square corners, `--panel` ground with a lit top edge and a faint scanline, a 3px
  brand flag on the left edge (blue = capital, pink = signal), a mono `■ ILLUSTRATIVE PARAMETERS`
  chip on the head rail. It should read as an instrument, not a card.
- **Slot board**: cells divided by hairlines rather than boxed, oversized tabular prices, 3px clock
  bars. Where a sim shows a subset, say so in a ghost row (`+ TWELVE MORE SLOTS … EACH ON ITS OWN
CLOCK`) rather than silently truncating.
- **Tallies**: a bordered ribbon of mono label/value pairs.
- **"Why" cards**: hairline-divided columns with oversized outlined ordinals — not bordered boxes.

## What did not win, and is not to be smuggled back in

No rendered gumball machine, no glass dome, no chrome. Decorative gumball spheres are allowed only
where they cannot be mistaken for data, and never as the page's main image. Neon glow is not the
material of this direction: light is used sparingly, and colour is delivered as flat, confident
planes.
