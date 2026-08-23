# GumBall6900 one-pager

One A4 landscape sheet that explains GumBall6900 - an index fund whose holders decide what goes
in it - to a reader who is intelligent, financially literate, and new to crypto.

```bash
pnpm docs:one-pager
```

Outputs:

- `output/pdf/GumBall6900-one-pager.pdf`
- `output/png/GumBall6900-one-pager.png` (300 dpi)

Requirements: the repository's pinned Node (22.23.1, see `.nvmrc`) and a local Chrome or Chromium
(`CHROME_PATH` overrides discovery). No network access; every asset is local.

## What it is for

This is not a short whitepaper. The whitepaper (`pnpm docs:whitepaper`, 8 pages) explains the
protocol to someone who already wants to understand it. This sheet has a different job: to teach
the product to someone who has never met it, in one page, mostly through pictures.

The test it is built to pass: after about thirty seconds, a reader should be able to say what the
project does in a sentence or two, without using crypto jargon. That constraint drives the whole
structure.

1. **Hero** - the words "What is this?" and a direct answer, in the largest type on the sheet.
   Underneath, the four things a definition alone does not convey: who it is for, what goes in,
   what comes back out, and what ends up in the fund. No blockchain, no smart contracts, no
   comparison with anything.
2. **The worked example** - one invented person, her original problem, and five stages from her
   first dollar to the assets in her hand. Every protocol label in this section is small enough
   to delete without the story stopping making sense; that is the test it is built to pass.

   Stage one is a market purchase, not a protocol action. Under the Fundraiser it was the one
   place a reader handed the protocol money and got GBX back on a schedule; ADR 0024 removed
   that door, and mining - a competitive reverse-Dutch slot auction - is not the same thing.
   Presenting it as this reader's way in would front-load the most crypto-native mechanic on
   the sheet onto someone who has thirty seconds. So mining is explained once, as plumbing, in
   the band below.

3. **How signaling works** - the section that closes the loop, and the reason anyone signals at
   all: deposit GBX into voting sGBX signals for assets you want the fund to own, and what it buys backs your GBX.
   Every sGBX unit remains assigned until moved or withdrawn. Two rows share one label gutter so the chain reads down the left edge -
   this round's pooled signal, then what a run of rounds accumulates into. Signalling and the
   basket chart used to be separate sections; splitting them hid that they are one mechanism,
   and left the sheet stating that signalling happens without ever saying what a signaler gets
   for it.
4. **What your share is worth** - one exact proportion and one market, set at deliberately
   different sizes. The proportion is `Fund.redeem`: burn 1% of all GBX, get 1% of each asset
   you pick. Below it, smaller and in muted ink, is where new GBX comes from - a slot whose
   price decays to zero over an hour, 80% of each payment repaying the miner replaced and 20%
   funding the buying - ending on "nobody is promised a replacement".

   The size difference is the argument, not a space saving. ADR 0024 deleted `Fundraiser.claim`
   and with it the matching proportion that used to sit here ("put in 5% of a day's dollars,
   get 5% of that day's new GBX"). Nothing in the Mine replaces it: a payer gets a decaying
   price, a tenure-locked rate, and an uncertain 80% of whatever the next buyer pays. Writing
   that as a proportion is the single easiest way for this sheet to lie, so it is prose.

   Underneath, "Why you'd want in": five figures, three of them zeros, that answer what a
   reader gets rather than how the protocol is built. The fifth used to be a lifetime supply
   ceiling; there is no cap any more, so it is now the genesis tranche.

5. **Status** - one line, not a section: the software is not deployed. That is the only status
   fact that changes what a reader should do next, and `AGENTS.md` requires the label to be
   preserved. The risk register, the open Medium finding, and the reviewed commits are
   whitepaper material; the commits stay in the PDF's metadata rather than on the page.

The vertical budget enforces that priority: about 92% of the sheet explains the product and the
remaining 8mm is the status line. There is no section arguing for crypto rails and no risk
register - the sheet's job is to explain what the project is and how it works, and both belong
in the whitepaper. The band heights in `src/styles.mjs` make that split real rather than
aspirational.

## Layout

Five full-width bands at fixed millimetre offsets, declared in one place (`bands` in
`src/styles.mjs`) so the whole vertical score is readable at once and its sum is checkable.
Bands are absolutely positioned rather than stacked in flow: on a sheet that must be exactly
one page, a band that grows should be a loud failure at a known offset, not a silent reflow
that pushes the last line onto page two.

Every run prints each band's content height against its declared height:

```
bands  content/declared mm · hero:44.0/44.0  story:47.1/47.0  signal:58.0/58.0
       rules:45.0/45.0  note:8.0/8.0
```

That line is how the score gets re-derived after a copy change, rather than guessed.

## Naming real assets

The signal section prints NVDA, QQQ and TSLA rather than placeholders, because
the product is an index of tokenized assets on Robinhood Chain and placeholders hid that. All
three are sourced: `packages/config/assets/robinhood.ts` requires the deployment manifest to
resolve and verify AAPL, NVDA, QQQ, SPCX and TSLA through an `official-stock-token-registry`,
alongside USDG, WETH and wrapped BTC.

They are examples of what the fund is built to acquire, never claims about what it holds. No
Strategy has been registered, the fund's balance is zero, and the story header says so where a
reader meets the tickers. `FACT-CHECK.md` records the full reasoning, including the distinction
between holding a tokenized stock and owning the underlying equity.

## Design system

Imported from the whitepaper, never redeclared, so the two documents cannot drift into two brand
systems:

| Asset                      | Source                                                        |
| -------------------------- | ------------------------------------------------------------- |
| Palette, type scale, radii | `docs/whitepaper/src/theme.mjs`                               |
| SVG primitives             | `docs/whitepaper/src/svg.mjs`                                 |
| Display face (Modak, OFL)  | `docs/whitepaper/fonts/Modak-Regular.ttf`                     |
| Protocol numbers           | `docs/whitepaper/src/protocol-facts.mjs`, via `src/facts.mjs` |

The hero is the wordmark set in type, with no mark. It used to open with the whitepaper's vector
`brandMark()`; the ADR 0024 rewrite deleted `docs/whitepaper/src/figures.mjs` along with the rest
of the superseded figure library, and it was not reconstructed here. The whitepaper's current cover
is likewise set in type, so the two documents still agree.

That is not purely a consequence of the deletion. The name and the ball device derive from an
existing brand whose usage rights are unresolved, which is also why the logo PNG at
`apps/web/public/brand/gum-ball-6900-logo.png` stays out: its provenance policy is `unconfigured`.
That file is byte-preserved evidence, not an approved asset to distribute, and a sheet that is
explicitly not cleared for distribution should not be the thing that propagates it.

## Files

| File              | Contents                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| `build.mjs`       | Render, gate, print, stamp metadata, verify, publish, rasterise            |
| `src/copy.mjs`    | Every word on the sheet, in one place, so the word budget can be edited    |
| `src/facts.mjs`   | Every number, derived from the whitepaper's verified protocol facts        |
| `src/figures.mjs` | The step arrow and the accumulation chart                                  |
| `src/styles.mjs`  | Band score and print stylesheet                                            |
| `src/page.mjs`    | Band assembly and document metadata                                        |
| `FACT-CHECK.md`   | Per-claim register: source, test, commit, whether onchain-enforced, limits |

Text-bearing blocks are HTML so the browser wraps them and the clipping audit can measure them. SVG
is reserved for geometry. A figure's own `<text>` counts toward the word budget, because `pdftotext`
extracts it like any other word.

## Build gates

The build refuses to overwrite the published PDF unless all of these pass. It prints to a staging
path first, so a failed gate never replaces a good file.

| Gate                    | What it blocks                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Protocol facts          | A printed number drifting from the contracts or the tested simulation fixture                                                                                      |
| Protocol fee            | The "0% management fee" figure outliving its truth: a fee identifier or drift from Mine's split, Resonance's bounded rate, or Strategy's exhaustive classification |
| Contrast                | Any foreground/background pair below WCAG AA (30 pairs, including this sheet's own surfaces)                                                                       |
| Stylesheet hygiene      | `undefined`, `NaN`, or `null` reaching a CSS declaration                                                                                                           |
| Stale claims            | Phrases from superseded designs, plus status language the evidence does not support                                                                                |
| Placeholders            | `{{...}}`, unresolved template values, `undefined`, `NaN`                                                                                                          |
| Punctuation             | Em and en dashes; the house rule is ASCII hyphens                                                                                                                  |
| Word budget             | More than 480 words, counted from the rendered text including figure labels                                                                                        |
| Band budget             | Any band whose content is taller than its declared height                                                                                                          |
| Clipping                | Any text block taller than the box drawn around it                                                                                                                 |
| Overlap                 | Any two sibling panels intersecting                                                                                                                                |
| Type size               | Any rendered text under 7.5pt, in HTML or scaled inside a figure                                                                                                   |
| Page count and geometry | Anything other than exactly one page at A4 landscape                                                                                                               |
| Fonts                   | A file that embeds no font programs                                                                                                                                |

Flags: `--html` writes the HTML and stops (fastest layout loop); `--force` prints despite failures,
for drafting only; `--open` opens the finished PDF.

### The stale-claim gate and negation

Some terms are wrong to assert and right to deny. "No upgrade or pause switch" is the accurate
description of this protocol; "an upgrade path" is a stale claim about an older one. A flat
substring list blocks the true sentence along with the false one, so those terms live in
`NEGATABLE_TERMS` and only fail when no negation governs them.

A stale-claim list also has to be re-pointed when the protocol changes, not just extended. ADR 0024
moved the risk in both directions at once. Nine cap-implying phrases were **added** - `maximum
supply`, `fixed supply`, `lifetime ceiling`, `that can ever exist` and the rest - because the
lifetime mint cap was deleted, and a sheet simplifying for a lay reader is exactly the kind of
document that would promise one. Three were **removed**: `infinite emissions`, `perpetual emissions`
and `never reaches zero` now describe the protocol accurately, since the global rate halves toward a
strictly positive tail, and a gate against the truth is worse than no gate. What went in their place
blocks the inference rather than the fact: `always profitable`, `passive income`, `earn while you
sleep`. Continued issuance is not a continued payout.

## Post-build validation used for this edition

```bash
pdfinfo   output/pdf/GumBall6900-one-pager.pdf
pdffonts  output/pdf/GumBall6900-one-pager.pdf
pdftotext -layout output/pdf/GumBall6900-one-pager.pdf -
pdfimages -list output/pdf/GumBall6900-one-pager.pdf
pdftocairo -pdf output/pdf/GumBall6900-one-pager.pdf /tmp/roundtrip.pdf
pdftoppm  -png -r 300 -singlefile output/pdf/GumBall6900-one-pager.pdf page
```

Expected: 1 page, 841.92 x 594.96 pts, embedded subset fonts only, clean text extraction in reading
order, no raster images (the sheet is entirely vector), and no stderr from any parser.

`qpdf --check` is not installed on the machine that built this edition. The structural assertions it
would cover are made two other ways: `build.mjs` reads the printed bytes back and checks the header,
the `%%EOF` terminator, the page count, the `/MediaBox` geometry, and the embedded font programs;
and every poppler tool above fully parses the file, with `pdftocairo -pdf` reconstructing it end to
end. Install `qpdf` and run `qpdf --check` if you want the third opinion.

### A note on counting words

`build.mjs` reports 412 words. `pdftotext | wc` reports rather more. The difference is not extra copy:
three labels are set in tracked uppercase, and poppler emits a space between their letters, so
`STATUS` extracts as four tokens. The build's count is of authored words and is the one the 480
budget is enforced against.
