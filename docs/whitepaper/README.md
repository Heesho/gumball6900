# Whitepaper build

Generates [`output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf`](../../output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf)
from the sources in this directory.

```bash
pnpm docs:whitepaper
```

Useful flags:

| Flag      | Effect                                                                      |
| --------- | --------------------------------------------------------------------------- |
| `--html`  | Write `build/whitepaper.html` and stop. Fastest loop when iterating layout. |
| `--force` | Print even when the layout audit reports clipped pages. Use while drafting. |
| `--open`  | Open the finished PDF.                                                      |

## How it works

The document is rendered to a self-contained HTML file and printed by headless Chrome,
which subsets and embeds every font it resolves. Pagination is explicit: each page is a
fixed 210×297mm block that owns its own running header and footer, so folios and the
contents page are computed rather than transcribed, and a section can never trail half a
page of whitespace.

```
build.mjs          entry point: render, audit, print, verify
src/theme.mjs      palette, type scale, page geometry, WCAG guard
src/model.mjs      economics — mirrors packages/simulations
src/svg.mjs        SVG primitives; user units are points
src/figures.mjs    every figure in the paper
src/styles.mjs     print stylesheet
src/document.mjs   page order and prose
```

## Guards

The build fails rather than shipping a quietly broken document:

- **Contrast.** `assertContrast()` checks every foreground/background pair the stylesheet
  uses against WCAG AA. The previous edition set small amber labels on cream, which failed
  badly; this blocks that regression.
- **Layout.** Pages clip their overflow to keep pagination predictable, which would
  otherwise swallow content that grew too tall. A script in the document measures every
  page after layout and reports any overflow through the document title, which Chrome
  copies into the PDF's metadata — so one print pass carries both the document and its own
  layout report. The build reads it back and refuses to publish a clipped document.
- **Fonts.** The printed file is read back and the build fails if it embeds no font
  programs, which would mean the PDF falls back to base-14 faces on other machines.

Printing goes to `build/whitepaper.pdf` first and is only copied over the published file
after those checks pass, so a failed build never replaces a good PDF. Chrome on macOS often
writes the PDF and then declines to exit, so the build waits for the artifact to stop
growing rather than for the process — without that, a build that has already succeeded
appears to hang indefinitely.

## Fonts

Font stacks prefer editorial faces and fall back to faces that ship with macOS:

| Role            | Stack                                               |
| --------------- | --------------------------------------------------- |
| Body            | Source Serif 4 → **Charter** → Charis SIL → Georgia |
| Headings and UI | Inter → **Helvetica Neue** → Helvetica → Arial      |
| Formulas        | JetBrains Mono → **Menlo** → SF Mono → Consolas     |

Bold entries are what a stock macOS machine resolves today. Chrome embeds whatever it
resolves, so the exported PDF renders identically everywhere — but a build on a machine
with different fonts installed produces a differently-typeset document. Vendoring the OFL
faces into this directory would remove that caveat. (Output is never byte-identical between
runs regardless: Chrome stamps a creation date into the PDF.)

## Figures

Charts are computed at build time from `src/model.mjs`, which mirrors the emission,
auction and redemption rules in `packages/simulations`. No figure contains a
hand-transcribed number, so a chart cannot drift away from the model the repository tests.

Colour is not decorative. Every figure uses one four-colour grammar, stated on page 2:
cyan is USDG capital, pink is sGBX signal, amber is an acquired asset, graphite is GBX
supply and burns.

## Prose

`docs/WHITEPAPER.md` remains the canonical text. This directory is the typeset
presentation of it and carries additional worked examples and figures. When the two
disagree, reconcile them; when either disagrees with reviewed contracts, the contracts
win.
