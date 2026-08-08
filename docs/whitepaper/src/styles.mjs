/**
 * Print stylesheet.
 *
 * Pagination is explicit: every page is a fixed 210x297mm block that owns its own header
 * and footer. Nothing reflows across a page boundary, so a section never trails a third of
 * a page of whitespace and the contents page can state exact folios.
 */

import { fonts, geometry, palette, type } from './theme.mjs';

const g = geometry;

/**
 * `brandFontUrl` is supplied by the build as an absolute file:// URL, so the vendored
 * Modak is embedded by Chrome at print time rather than depending on it being installed.
 */
export function stylesheet({ brandFontUrl } = {}) {
  return `
@page { size: ${g.pageWidth}mm ${g.pageHeight}mm; margin: 0; }

${brandFontUrl ? `@font-face { font-family: "${fonts.brand}"; src: url("${brandFontUrl}") format("truetype"); font-display: block; }` : ''}

* { box-sizing: border-box; }

html {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  text-rendering: geometricPrecision;
}

body {
  margin: 0;
  padding: 0;
  background: ${palette.paper};
  color: ${palette.ink};
  font-family: ${fonts.serif};
  font-size: ${type.body.size}pt;
  line-height: ${type.body.leading}pt;
  font-variant-numeric: oldstyle-nums proportional-nums;
}

/* ---------------------------------------------------------------- page ---- */

.page {
  position: relative;
  width: ${g.pageWidth}mm;
  height: ${g.pageHeight}mm;
  overflow: hidden;
  background: ${palette.paper};
  break-after: page;
  page-break-after: always;
}

.page:last-child { break-after: auto; page-break-after: auto; }

.page--deep { background: ${palette.deep}; color: ${palette.onDeep}; }

.page--deep .eyebrow { color: ${palette.blueBright}; }
.page--deep .rule { background: ${palette.deepRule}; }
.page--deep .note { color: ${palette.onDeepMuted}; }
.page--deep .section-title { color: ${palette.onDeep}; }

.frame {
  position: absolute;
  inset: ${g.marginTop}mm ${g.marginX}mm ${g.marginBottom}mm ${g.marginX}mm;
}

/* Running header and footer live inside each page, so every folio is exact. */

.runner {
  position: absolute;
  left: ${g.marginX}mm;
  right: ${g.marginX}mm;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: ${fonts.sans};
  font-size: 6.6pt;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: ${palette.inkFaint};
}

.runner--head { top: 11mm; }
.runner--foot { bottom: 9mm; }

.runner__mark { display: flex; align-items: center; gap: 2.6mm; }
.runner__tick { width: 9mm; height: 1.1pt; background: ${palette.pink}; border-radius: 1pt; }
.runner__section { color: ${palette.inkMuted}; font-weight: 600; }
.runner__folio {
  font-variant-numeric: tabular-nums lining-nums;
  letter-spacing: 0.04em;
  color: ${palette.inkMuted};
  font-weight: 600;
}

.page--deep .runner { color: ${palette.onDeepMuted}; }
.page--deep .runner__section, .page--deep .runner__folio { color: ${palette.onDeep}; }
.page--deep .runner__tick { background: ${palette.pinkBright}; }

/* ---------------------------------------------------------------- grid ---- */

.spread {
  display: grid;
  grid-template-columns: ${g.mainColumn}mm ${g.gutter}mm ${g.sideColumn}mm;
  column-gap: 0;
}

.col-main { grid-column: 1; }
.col-side { grid-column: 3; }
.full { grid-column: 1 / -1; }

/* ------------------------------------------------------------ typography ---- */

.eyebrow {
  margin: 0 0 3mm;
  font-family: ${fonts.sans};
  font-size: ${type.eyebrow.size}pt;
  font-weight: 600;
  letter-spacing: ${type.eyebrow.tracking}em;
  text-transform: uppercase;
  color: ${palette.pink};
}

.section-title {
  margin: 0;
  font-family: ${fonts.sans};
  font-size: ${type.h1.size}pt;
  line-height: ${type.h1.leading}pt;
  font-weight: 600;
  letter-spacing: -0.021em;
  color: ${palette.ink};
}

.section-title .numeral {
  color: ${palette.inkFaint};
  font-variant-numeric: lining-nums tabular-nums;
  font-weight: 400;
  margin-right: 2mm;
}

.deck {
  margin: 4mm 0 0;
  max-width: ${g.mainColumn + g.gutter}mm;
  font-size: ${type.lead.size}pt;
  line-height: ${type.lead.leading}pt;
  color: ${palette.inkMuted};
  hyphens: none;
}

.rule { height: 0.7pt; background: ${palette.ruleStrong}; margin: 6mm 0; }
.rule--hair { background: ${palette.rule}; }

h2 {
  margin: 0 0 2.4mm;
  font-family: ${fonts.sans};
  font-size: ${type.h2.size}pt;
  line-height: ${type.h2.leading}pt;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: ${palette.ink};
}

h3 {
  margin: 0 0 1.6mm;
  font-family: ${fonts.sans};
  font-size: ${type.h3.size}pt;
  line-height: ${type.h3.leading}pt;
  font-weight: 600;
  color: ${palette.ink};
}

p { margin: 0 0 3.6mm; text-align: justify; hyphens: auto; }
p:last-child { margin-bottom: 0; }
.col-main > p { max-width: ${g.mainColumn}mm; }

strong { font-weight: 600; }
em { font-style: italic; }

.lede::first-letter {
  float: left;
  font-size: 27pt;
  line-height: 21pt;
  padding: 1.4mm 1.6mm 0 0;
  font-weight: 600;
  color: ${palette.pink};
}

/* Terms and identifiers keep the sans/mono voice so prose stays readable. */
.term { font-family: ${fonts.sans}; font-size: 8.8pt; font-weight: 600; letter-spacing: -0.004em; }
code, .mono {
  font-family: ${fonts.mono};
  font-size: ${type.mono.size}pt;
  font-variant-numeric: lining-nums tabular-nums;
}
.num { font-variant-numeric: lining-nums tabular-nums; }

/* ----------------------------------------------------------- side notes ---- */

.note {
  font-family: ${fonts.sans};
  font-size: ${type.note.size}pt;
  line-height: ${type.note.leading}pt;
  color: ${palette.inkMuted};
  text-align: left;
  hyphens: none;
}

.note + .note { margin-top: 5mm; }
.note__label {
  display: block;
  margin-bottom: 1.4mm;
  font-size: ${type.figureLabel.size}pt;
  font-weight: 600;
  letter-spacing: ${type.figureLabel.tracking}em;
  text-transform: uppercase;
  color: ${palette.pink};
}
.note--capital .note__label { color: ${palette.blue}; }
.note--asset .note__label { color: ${palette.pink}; }
.note--supply .note__label { color: ${palette.graphite}; }
.note__rule { width: 12mm; height: 1pt; background: currentColor; opacity: 0.35; margin-bottom: 2mm; }

/* -------------------------------------------------------------- figures ---- */

.figure { margin: 0; }
.figure-svg { display: block; }

.figcaption {
  display: flex;
  gap: 3mm;
  margin-top: 3mm;
  font-family: ${fonts.sans};
  font-size: 7pt;
  line-height: 10.6pt;
  color: ${palette.inkMuted};
  text-align: left;
}

.figcaption__index {
  flex: none;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${palette.pink};
}

/* The worked-example trace: a numbered claim on the left, its consequence on the right. */

.trace__row {
  display: grid;
  grid-template-columns: 7mm 1fr 68mm;
  align-items: start;
  gap: 0 4mm;
  padding: 3mm 0;
  border-top: 0.5pt solid ${palette.rule};
}
.trace__row:first-child { border-top: none; padding-top: 0; }

.trace__index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 5.6mm;
  height: 5.6mm;
  border: 0.9pt solid;
  border-radius: 50%;
  font-family: ${fonts.sans};
  font-size: 6.6pt;
  font-weight: 600;
  font-variant-numeric: lining-nums;
}

.trace__title {
  display: block;
  font-family: ${fonts.sans};
  font-size: 8.8pt;
  font-weight: 600;
  letter-spacing: -0.008em;
  color: ${palette.ink};
}
.trace__detail {
  display: block;
  margin-top: 1mm;
  font-size: 8.2pt;
  line-height: 12.4pt;
  color: ${palette.inkMuted};
}
.trace__result {
  align-self: center;
  padding: 2.4mm 3mm;
  border-radius: 1.8mm;
  background: ${palette.paperTint};
  font-family: ${fonts.sans};
  font-size: 7.6pt;
  line-height: 11.4pt;
  font-weight: 600;
}

/* -------------------------------------------------------------- devices ---- */

.statement {
  padding: 6mm 7mm;
  background: ${palette.deep};
  color: ${palette.onDeep};
  border-radius: 2.4mm;
  font-family: ${fonts.sans};
  font-size: 12.6pt;
  line-height: 17pt;
  font-weight: 600;
  letter-spacing: -0.014em;
  text-align: left;
  hyphens: none;
}
.statement em { color: ${palette.blueBright}; font-style: normal; }

.pull {
  padding-left: 6mm;
  border-left: 1.6pt solid ${palette.pink};
  font-family: ${fonts.sans};
  font-size: 11pt;
  line-height: 15.4pt;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${palette.ink};
  hyphens: none;
}

.formula {
  margin: 0;
  padding: 4.6mm 5mm;
  background: ${palette.paperTint};
  border-radius: 2mm;
  border-left: 1.6pt solid ${palette.blue};
  font-family: ${fonts.mono};
  font-size: 9pt;
  line-height: 14pt;
  color: ${palette.ink};
  text-align: left;
}
.formula__label {
  display: block;
  margin-bottom: 2mm;
  font-family: ${fonts.sans};
  font-size: ${type.figureLabel.size}pt;
  font-weight: 600;
  letter-spacing: ${type.figureLabel.tracking}em;
  text-transform: uppercase;
  color: ${palette.blue};
}
.formula__where {
  display: block;
  margin-top: 2.6mm;
  font-family: ${fonts.sans};
  font-size: 7pt;
  line-height: 11pt;
  color: ${palette.inkMuted};
}

/* Definition and comparison tables replace the previous edition's card grids. */

.table { width: 100%; border-collapse: collapse; }
.table th, .table td {
  padding: 2.2mm 3mm 2.2mm 0;
  border-bottom: 0.5pt solid ${palette.rule};
  vertical-align: top;
  text-align: left;
}
.table th {
  font-family: ${fonts.sans};
  font-size: ${type.figureLabel.size}pt;
  font-weight: 600;
  letter-spacing: ${type.figureLabel.tracking}em;
  text-transform: uppercase;
  color: ${palette.inkFaint};
  border-bottom-color: ${palette.ruleStrong};
}
.table td { font-size: 8.6pt; line-height: 13pt; }
.table tr:last-child td { border-bottom: none; }
.table__key { font-family: ${fonts.sans}; font-size: 8.4pt; font-weight: 600; color: ${palette.ink}; white-space: nowrap; }
.table--tight td, .table--tight th { padding-top: 2mm; padding-bottom: 2mm; }

.ledger { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8mm; }
.ledger__side { }
.ledger__head {
  font-family: ${fonts.sans};
  font-size: ${type.figureLabel.size}pt;
  font-weight: 600;
  letter-spacing: ${type.figureLabel.tracking}em;
  text-transform: uppercase;
  padding-bottom: 2mm;
  margin-bottom: 3mm;
  border-bottom: 0.7pt solid currentColor;
}
.ledger__head--yes { color: ${palette.blue}; }
.ledger__head--no { color: ${palette.pink}; }

.checklist { margin: 0; padding: 0; list-style: none; }
.checklist li {
  position: relative;
  padding-left: 6mm;
  margin-bottom: 2.1mm;
  font-size: 8.6pt;
  line-height: 13pt;
  text-align: left;
}
.checklist li::before {
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 2.6mm;
  height: 2.6mm;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.55;
  content: '';
}

.numbered { margin: 0; padding: 0; list-style: none; counter-reset: item; }
.numbered li {
  position: relative;
  padding-left: 8mm;
  margin-bottom: 2.8mm;
  font-size: 8.8pt;
  line-height: 13.4pt;
  text-align: left;
  counter-increment: item;
}
.numbered li::before {
  position: absolute;
  left: 0;
  top: 0;
  content: counter(item, decimal-leading-zero);
  font-family: ${fonts.sans};
  font-size: 7pt;
  font-weight: 600;
  font-variant-numeric: tabular-nums lining-nums;
  color: ${palette.pink};
  letter-spacing: 0.04em;
}

.kpi-row { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6mm; }
.kpi__value {
  font-family: ${fonts.sans};
  font-size: 17pt;
  font-weight: 600;
  letter-spacing: -0.024em;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${palette.ink};
}
.kpi__label {
  margin-top: 1.4mm;
  font-family: ${fonts.sans};
  font-size: 6.8pt;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${palette.inkFaint};
}
.page--deep .kpi__value { color: ${palette.onDeep}; }
.page--deep .kpi__label { color: ${palette.onDeepMuted}; }

.chip {
  display: inline-block;
  padding: 1.6mm 3.4mm;
  border-radius: 99mm;
  border: 0.7pt solid ${palette.pinkBright};
  color: ${palette.pinkBright};
  font-family: ${fonts.sans};
  font-size: 6.8pt;
  font-weight: 600;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

/* ---------------------------------------------------------------- cover ---- */

.cover__title {
  margin: 0;
  font-family: ${fonts.sans};
  font-size: ${type.displayXL.size}pt;
  line-height: ${type.displayXL.leading}pt;
  font-weight: 600;
  letter-spacing: -0.038em;
  color: ${palette.onDeep};
}
.cover__subtitle {
  margin: 4mm 0 0;
  font-family: ${fonts.sans};
  font-size: 16pt;
  line-height: 21pt;
  font-weight: 400;
  letter-spacing: -0.018em;
  color: ${palette.blueBright};
}
.cover__thesis {
  margin: 8mm 0 0;
  max-width: 108mm;
  font-size: 10.4pt;
  line-height: 16.4pt;
  color: ${palette.onDeepMuted};
  text-align: left;
}
.cover__mark { position: absolute; top: 24mm; right: 0; width: 74mm; }

/* -------------------------------------------------------------- contents ---- */

/* Rows are flex lines, so a long title can never push the leader or folio onto a new line. */
.toc__row {
  display: flex;
  align-items: baseline;
  gap: 0;
  padding: 1.05mm 0;
  line-height: 1.15;
  white-space: nowrap;
}
.toc__num {
  flex: none;
  width: 9mm;
  font-family: ${fonts.sans};
  font-size: 7pt;
  font-weight: 600;
  font-variant-numeric: tabular-nums lining-nums;
  color: ${palette.pink};
}
.toc__title {
  flex: none;
  max-width: 88mm;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 9.4pt;
}
.toc__title em {
  font-family: ${fonts.sans};
  font-style: normal;
  font-size: 7.2pt;
  color: ${palette.inkFaint};
  margin-left: 2.6mm;
}
.toc__leader {
  flex: 1 1 auto;
  min-width: 4mm;
  margin: 0 2mm;
  border-bottom: 0.5pt dotted ${palette.ruleStrong};
  transform: translateY(-0.8mm);
}
.toc__folio {
  flex: none;
  text-align: right;
  font-family: ${fonts.sans};
  font-size: 8pt;
  font-weight: 600;
  font-variant-numeric: tabular-nums lining-nums;
  color: ${palette.inkMuted};
}
.toc__group {
  margin-top: 4mm;
  padding-bottom: 1.2mm;
  border-bottom: 0.5pt solid ${palette.rule};
  font-family: ${fonts.sans};
  font-size: ${type.figureLabel.size}pt;
  font-weight: 600;
  letter-spacing: ${type.figureLabel.tracking}em;
  text-transform: uppercase;
  color: ${palette.inkFaint};
}
.toc__group:first-child { margin-top: 0; }

/* ------------------------------------------------------------- utilities ---- */

.stack-1 { margin-top: 4mm; }
.stack-2 { margin-top: 7mm; }
.stack-3 { margin-top: 10mm; }
.stack-4 { margin-top: 14mm; }
.tint { background: ${palette.paperTint}; border-radius: 2.4mm; padding: 5mm 5.5mm; }
.tint--warm { background: ${palette.paperTintWarm}; }
.muted { color: ${palette.inkMuted}; }
.faint { color: ${palette.inkFaint}; }
.capital { color: ${palette.blue}; }
.signal { color: ${palette.pink}; }
.asset { color: ${palette.pink}; }
.center { text-align: center; }
.small { font-size: 8.2pt; line-height: 12.6pt; }
.sans { font-family: ${fonts.sans}; }
`.trim();
}
