/**
 * Canonical whitepaper print stylesheet.
 *
 * NOTE: the whole sheet is one template literal, so a backtick anywhere inside it — including
 * inside a comment — terminates the string and fails the module at parse time. Refer to CSS
 * properties in prose here, never in code quotes.
 *
 * Content flows from docs/WHITEPAPER.md and Chrome paginates it with stable A4 margins.
 * The shared theme keeps the PDF consistent with the websites without introducing another
 * prose source.
 */

import { fonts, geometry, palette, radii, type } from './src/theme.mjs';

const g = geometry;

export function stylesheet({ brandFontUrl } = {}) {
  return `
/*
 * Keep print margins deliberately plain. Chrome's margin-box implementation can let a
 * fragmented paragraph or list overlap the running header on later pages, so the canonical
 * edition favors reliable readable pagination over decorative running furniture.
 */
@page {
  size: ${g.pageWidth}mm ${g.pageHeight}mm;
  margin: ${g.marginTop}mm ${g.marginX}mm ${g.marginBottom}mm ${g.marginX}mm;
}
/* The cover carries no running furniture and bleeds to the sheet edge. */
@page cover { margin: 0; }


${brandFontUrl ? `@font-face { font-family: "${fonts.brand}"; src: url("${brandFontUrl}") format("truetype"); font-display: block; }` : ''}

* { box-sizing: border-box; }

html {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  text-rendering: geometricPrecision;
}

body {
  margin: 0;
  background: ${palette.paper};
  color: ${palette.ink};
  font-family: ${fonts.serif};
  font-size: ${type.body.size}pt;
  line-height: ${type.body.leading}pt;
  font-variant-numeric: oldstyle-nums proportional-nums;
  hyphens: auto;
}

/* ---------------------------------------------------------------- cover ---- */

/*
 * Full-bleed cover.
 *
 * The cover gets its own named page so the page margins — and with them the running head
 * and folio, which have no business on a cover — collapse to zero. Height is set in viewport
 * units rather than mm: at print time the viewport is the page box, and a fixed 297mm left a
 * thin white band at the foot because Chrome scales content into the printable area.
 * Padding restores the text inset that the zeroed page margin would otherwise remove.
 */
.cover {
  page: cover;
  position: relative;
  height: 100vh;
  padding: ${g.marginTop}mm ${g.marginX}mm ${g.marginBottom}mm;
  background: ${palette.deep};
  color: ${palette.onDeep};
  overflow: hidden;
  break-after: page;
  page-break-after: always;
}

.cover__inner { position: relative; height: 100%; }

.cover__chip {
  display: inline-block;
  padding: 1.6mm 3.4mm;
  border: 0.8pt solid ${palette.pinkBright};
  border-radius: 20mm;
  color: ${palette.pinkBright};
  font-family: ${fonts.sans};
  font-size: 6.6pt;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cover__lockup { position: absolute; top: 52mm; left: 0; right: 0; }

/*
 * The wordmark is set in the brand face. Modak is vendored under the OFL and was already
 * being embedded by all three pipelines while no stylesheet applied it — the cover is
 * where it belongs, because its rounded bubble forms are the same shape language as the
 * mark directly above it. Everything else stays in the text faces; Modak has no small
 * sizes and no second weight.
 */
.cover__title {
  margin: 7mm 0 0;
  font-family: ${fonts.brand}, ${fonts.sans};
  font-size: 58pt;
  line-height: 58pt;
  font-weight: 400;
  letter-spacing: 0.004em;
  color: ${palette.onDeep};
  max-width: 165mm;
}

.cover__subtitle {
  margin: 5mm 0 0;
  font-family: ${fonts.sans};
  font-size: 13pt;
  line-height: 18pt;
  font-weight: 500;
  color: ${palette.blueBright};
  max-width: 140mm;
}

.cover__thesis {
  margin: 8mm 0 0;
  max-width: 128mm;
  color: ${palette.onDeepMuted};
  font-size: ${type.small.size}pt;
  line-height: ${type.small.leading}pt;
  text-align: left;
}

.cover__meta { position: absolute; bottom: 0; left: 0; right: 0; }
.cover__rule { height: 0.8pt; background: ${palette.deepRule}; margin-bottom: 5mm; }

.cover__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4mm 8mm;
  font-family: ${fonts.sans};
}

.cover__k {
  font-size: 6.4pt;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${palette.onDeepMuted};
  margin: 0 0 0.8mm;
}
.cover__v { font-size: 8.2pt; line-height: 11.4pt; color: ${palette.onDeep}; margin: 0; }

/* -------------------------------------------------------------- headings ---- */

h1, h2, h3, h4 {
  font-family: ${fonts.sans};
  color: ${palette.ink};
  break-after: avoid;
  page-break-after: avoid;
  hyphens: none;
}

/* Top-level sections open a page: in a reference document the reader navigates by
   section, and a heading stranded four lines from a page foot is hard to find again. */
h1 {
  font-size: ${type.h1.size}pt;
  line-height: ${type.h1.leading}pt;
  font-weight: 600;
  letter-spacing: -0.021em;
  margin: 0 0 6mm;
  padding-bottom: 4mm;
  border-bottom: 0.8pt solid ${palette.ruleStrong};
  break-before: page;
  page-break-before: always;
}

/*
 * The brand tick sits on h2, not h1.
 *
 * Both documents number their sections at the second level — "## 12. Mining and issuance"
 * — so h1 occurs only on the cover and the contents page. A tick on h1 therefore appeared
 * once, on the cover, above the wordmark, which is the one place it should never be.
 */
h2::before {
  content: '';
  display: block;
  width: 9mm;
  height: 1.3pt;
  background: ${palette.pink};
  margin-bottom: 2.6mm;
}
h1:first-of-type { break-before: avoid; page-break-before: avoid; }

h2 {
  font-size: ${type.h2.size}pt;
  line-height: ${type.h2.leading}pt;
  font-weight: 600;
  letter-spacing: -0.012em;
  margin: 7mm 0 2.6mm;
}

h3 {
  font-size: ${type.h3.size}pt;
  line-height: ${type.h3.leading}pt;
  font-weight: 600;
  margin: 5mm 0 1.8mm;
  color: ${palette.inkMuted};
}

h4 {
  font-size: 9pt;
  line-height: 13pt;
  font-weight: 600;
  margin: 4mm 0 1.4mm;
  color: ${palette.inkMuted};
}

/* ----------------------------------------------------------------- text ---- */

p {
  margin: 0 0 3.4mm;
  text-align: justify;
  orphans: 2;
  widows: 2;
  break-inside: avoid;
  page-break-inside: avoid;
}

strong { font-weight: 600; }
em { font-style: italic; }

a { color: ${palette.blue}; text-decoration: none; }

ul, ol { margin: 0 0 3.6mm; padding-left: 5.5mm; }
li {
  display: list-item;
  margin: 0 0 1.4mm;
  text-align: justify;
  break-inside: avoid;
  page-break-inside: avoid;
}
li::marker { color: ${palette.pink}; }

.pdf-page-break {
  height: 1mm;
  break-before: page;
  page-break-before: always;
}
.pdf-page-break--padded { height: 15mm; }

blockquote {
  margin: 4mm 0;
  padding: 3.4mm 4.4mm;
  background: ${palette.paperTint};
  border-left: 1.6pt solid ${palette.pink};
  border-radius: 0 ${radii.panel}mm ${radii.panel}mm 0;
  color: ${palette.inkMuted};
  font-size: ${type.small.size}pt;
  line-height: ${type.small.leading}pt;
  break-inside: avoid;
}
blockquote p:last-child { margin-bottom: 0; }

code, kbd {
  font-family: ${fonts.mono};
  font-size: ${type.mono.size}pt;
  font-variant-numeric: lining-nums tabular-nums;
  background: ${palette.paperTint};
  padding: 0.3mm 1mm;
  border-radius: 1mm;
}

pre {
  margin: 3.6mm 0;
  padding: 3.4mm 4mm;
  background: ${palette.paperTint};
  border: 0.5pt solid ${palette.rule};
  border-radius: ${radii.panel}mm;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
}

pre code {
  background: none;
  padding: 0;
  font-size: 7.6pt;
  line-height: 11.4pt;
  white-space: pre-wrap;
  word-break: break-word;
}

hr { border: 0; height: 0.5pt; background: ${palette.rule}; margin: 6mm 0; }

/* ---------------------------------------------------------------- tables ---- */

table {
  width: 100%;
  border-collapse: collapse;
  margin: 4mm 0;
  font-size: 7.9pt;
  line-height: 11.6pt;
  font-family: ${fonts.sans};
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Only short tables are kept whole. A 30-row table that cannot fit a page would otherwise
   be pushed to a fresh page and still overflow it, leaving a hole on the page before. */
table.table--long { break-inside: auto; page-break-inside: auto; }
table.table--long tr { break-inside: avoid; page-break-inside: avoid; }
thead { display: table-header-group; }

th {
  text-align: left;
  font-weight: 600;
  font-size: 6.6pt;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: ${palette.inkFaint};
  border-bottom: 0.8pt solid ${palette.ruleStrong};
  padding: 0 2.4mm 1.6mm 0;
}

td {
  vertical-align: top;
  padding: 1.6mm 2.4mm 1.6mm 0;
  border-bottom: 0.5pt solid ${palette.rule};
  hyphens: none;
}

td:last-child, th:last-child { padding-right: 0; }
td code { font-size: 7.2pt; }

/* --------------------------------------------------------------- figures ---- */

.figure {
  margin: 5mm 0;
  padding: 4mm;
  background: ${palette.paperTint};
  border-radius: ${radii.panel}mm;
  break-inside: avoid;
  page-break-inside: avoid;
  text-align: center;
}
.figure svg { max-width: 100%; height: auto; }
.figure__caption {
  margin: 3mm 0 0;
  font-family: ${fonts.sans};
  font-size: ${type.figureLabel.size}pt;
  letter-spacing: ${type.figureLabel.tracking}em;
  text-transform: uppercase;
  color: ${palette.inkFaint};
  text-align: left;
}

/* The opening paragraph takes a brand drop cap, as the typeset edition does. */
main > p:first-of-type::first-letter {
  float: left;
  font-size: 34pt;
  line-height: 25pt;
  padding: 0 1.6mm 0 0;
  font-family: ${fonts.sans};
  font-weight: 600;
  color: ${palette.pink};
}

/* Table heads carry the brand rule rather than a neutral one. */
thead th { border-bottom-color: ${palette.pink}; }

/* ------------------------------------------------------------- brandmark ---- */

/* Circular clip: the artwork is a mark on an opaque near-white square, and 48% is the
   largest radius that removes every corner pixel. See docs/whitepaper/src/brand-asset.mjs. */
.brandmark {
  display: block;
  clip-path: circle(48% at 50% 50%);
  -webkit-clip-path: circle(48% at 50% 50%);
}

/* --------------------------------------------------------------- toc ---- */

.toc { break-after: page; page-break-after: always; }
.toc h1 { break-before: avoid; page-break-before: avoid; }
.toc__row {
  display: flex;
  align-items: baseline;
  gap: 2.4mm;
  padding: 1.5mm 0;
  border-bottom: 0.5pt solid ${palette.rule};
  font-family: ${fonts.sans};
  font-size: 8pt;
}
.toc__num { color: ${palette.pink}; font-weight: 600; min-width: 8mm; font-variant-numeric: tabular-nums; }
.toc__title { color: ${palette.ink}; }
`.trim();
}
