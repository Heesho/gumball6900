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
roundel: bubble letters "GUM BALL 6900" outlined in pink and blue.

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
