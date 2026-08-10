# Building the whitepaper

One command produces the published PDF:

```bash
pnpm docs:whitepaper
```

Requirements: the repository's pinned Node (22.23.1, see `.nvmrc`) and a local Chrome or
Chromium (set `CHROME_PATH` to override discovery). No network access is needed; every
asset is local.

## What the build does, in order

1. **Verify protocol facts.** `src/protocol-facts.mjs` replays the Fundraiser's exact
   sequential integer schedule from the mirrored contract constants, re-derives the
   initial emission from the half-life factor, checks the Bribe stream arithmetic, and
   cross-checks all of it against `packages/simulations/fixtures/reference-results.json`
   (tested independently in TypeScript and Python). Any mismatch throws.
2. **Verify contrast.** Every foreground/background pair the stylesheet uses must pass
   WCAG AA.
3. **Render.** `src/document.mjs` assembles the pages from `src/pages/*.mjs`, assigns
   section and figure numbers, and computes the contents page. Every number quoted in
   prose or figures is imported from `protocol-facts.mjs`, `model.mjs`, or `worked.mjs` -
   never typed by hand.
4. **Scan for stale claims.** The rendered HTML is checked against a fixed list of
   forbidden phrases from superseded designs (whole-account resets, reward splits,
   compounding, management fees, hype vocabulary). Any hit blocks the build.
5. **Audit layout.** Pages are fixed A4 frames that clip overflow; an in-document script
   measures every page after layout and reports any overflow through the printed PDF's
   title metadata. Overflow blocks publication (do not use `--force` for a release).
6. **Print.** Headless Chrome prints to `build/whitepaper.pdf` (a staging path).
7. **Stamp metadata.** A standards-conforming incremental update adds Author, Subject,
   Keywords, and the described/reviewed commit hashes to the PDF Info dictionary.
8. **Verify the artifact.** The staged PDF is read back: font programs must be embedded
   and the layout report must be clean. Only then is it copied over
   `output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf`, so a failed build
   never replaces a good published file.

## Flags

| Flag      | Effect                                                        |
| --------- | ------------------------------------------------------------- |
| `--html`  | Write `build/whitepaper.html` and stop (fastest layout loop). |
| `--force` | Print despite layout overflow. Drafting only - never release. |
| `--open`  | Open the finished PDF.                                        |

## Post-build validation used for this edition

```bash
pdfinfo   output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf
pdffonts  output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf
pdftotext output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf -
pdftoppm  -png -r 180 output/pdf/GumBall6900-the-index-fund-that-chooses-itself.pdf pages/p
```

Expected: 77 pages, title "GumBall6900: The Index Fund That Chooses Itself", author
Heesho, embedded subset fonts only, clean text extraction, and every rendered page free of
clipping and collisions on visual inspection.
