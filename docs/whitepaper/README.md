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
build.mjs               entry point: verify facts, render, audit, print, stamp, verify
src/theme.mjs           palette, type scale, page geometry, WCAG guard
src/protocol-facts.mjs  machine-readable facts + the build-time verification gate
src/model.mjs           economics — mirrors packages/simulations
src/worked.mjs          the continuous worked example, computed (never hand-typed)
src/svg.mjs             SVG primitives; user units are points
src/figures.mjs         core figures
src/figures2.mjs        figures added by the expanded edition
src/styles.mjs          print stylesheet
src/page-kit.mjs        shared page primitives (heads, notes, tables, callouts)
src/meta.mjs            document identity (title, author, version, commits)
src/document.mjs        page order, numbering, contents
src/pages/*.mjs         the prose, one module per part
```

## Guards

The build fails rather than shipping a quietly broken document:

- **Facts.** `verifyProtocolFacts()` replays the Fundraiser's sequential integer schedule
  and the Bribe stream arithmetic from the contract constants and cross-checks the results
  against `packages/simulations/fixtures/reference-results.json`, which the repository
  tests independently in TypeScript and Python. A stated number that drifts from the
  tested model blocks the build.
- **Stale claims.** The rendered document is scanned for a fixed list of forbidden
  phrases from superseded design iterations (whole-account resets, reward splits,
  compounding, management fees, "never reaches zero", hype words). A hit blocks the build.
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

The brand display face Modak is vendored in `fonts/` under the SIL Open Font License and
embedded via `@font-face` at print time. The remaining stacks prefer editorial faces and
fall back to faces that ship with macOS:

| Role            | Stack                                               |
| --------------- | --------------------------------------------------- |
| Brand display   | **Modak** (vendored, OFL)                           |
| Body            | Source Serif 4 → **Charter** → Charis SIL → Georgia |
| Headings and UI | Inter → **Helvetica Neue** → Helvetica → Arial      |
| Formulas        | JetBrains Mono → **Menlo** → SF Mono → Consolas     |

Bold entries are what a stock macOS machine resolves today. Chrome embeds whatever it
resolves, so the exported PDF renders identically everywhere — but a build on a machine
with different non-vendored fonts installed produces a differently-typeset document.
(Output is never byte-identical between runs regardless: Chrome stamps a creation date
into the PDF.)

## Figures

Charts are computed at build time from `src/model.mjs`, `src/protocol-facts.mjs`, and
`src/worked.mjs`, which mirror the emission, auction, stream, and redemption rules in
`packages/simulations` and the production contracts. No figure contains a
hand-transcribed number, so a chart cannot drift away from the model the repository tests.

Colour is not decorative. Every figure uses one three-role grammar, stated in the
front matter: blue is USDG capital arriving, pink is the holder-directed chain (signal,
the acquisition it causes, and optional independent rewards), graphite is GBX supply and
burns.

## Prose

`docs/WHITEPAPER.md` remains the canonical text. This directory is the typeset
presentation of it and carries additional worked examples and figures. When the two
disagree, reconcile them; when either disagrees with reviewed contracts, the contracts
win.
