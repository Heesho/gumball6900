/**
 * Print stylesheet for the single A4 landscape sheet.
 *
 * The palette, type voice, and radii are the whitepaper's - imported, not re-declared, so
 * the two documents cannot drift into two brand systems. What is local to this file is the
 * geometry: one 297x210mm page laid out as a fixed vertical stack of bands.
 *
 * Bands are absolutely positioned at exact millimetre offsets rather than stacked in flow.
 * On a sheet that must be exactly one page, a band that grows should be a loud build
 * failure at a known y-offset, not a silent reflow that pushes the footer onto page two.
 */

import { brand, fonts, palette, radii } from '../../../whitepaper/src/theme.mjs';

/** Page geometry in millimetres. A4 landscape. */
export const geometry = {
  pageWidth: 297,
  pageHeight: 210,
  marginX: 12,
  get contentWidth() {
    return this.pageWidth - this.marginX * 2;
  },
};

/**
 * The vertical score of the page, in millimetres.
 *
 * This is also where the sheet's editorial priorities are enforced. Explaining the product -
 * what it is, one person using it end to end, how the basket forms, and who else is
 * involved - gets 194mm, about 92% of the sheet. The remaining 8mm is one line saying the
 * software is not deployed, which is the only status fact that changes what a reader should
 * do next. There is no section arguing for crypto rails and no risk register: the sheet's
 * job is to explain the product, and both belong in the whitepaper.
 *
 * The build prints each band's content height against its declared height on every run, so
 * this score can be re-derived rather than guessed whenever copy changes.
 */
export const bands = {
  hero: { top: 0, height: 44 },
  story: { top: 46, height: 47 },
  signal: { top: 95, height: 58 },
  rules: { top: 155, height: 45 },
  note: { top: 202, height: 8 },
};

/** Type scale in points. The floor is 9.5pt for anything a reader must actually read. */
export const type = {
  definition: 26,
  definitionLeading: 28.5,
  wordmark: 17,
  sectionHead: 14,
  statement: 11,
  metric: 17,
  body: 9.5,
  bodyLeading: 12.2,
  label: 9.5,
  eyebrow: 8,
  tech: 7.6,
  footer: 7.8,
  footerLeading: 10.6,
};

export function stylesheet({ brandFontUrl } = {}) {
  const g = geometry;

  const band = (name) => `
.band--${name} {
  top: ${bands[name].top}mm;
  height: ${bands[name].height}mm;
}`;

  return `
@page { size: ${g.pageWidth}mm ${g.pageHeight}mm; margin: 0; }

${brandFontUrl ? `@font-face { font-family: "${fonts.brand}"; src: url("${brandFontUrl}") format("truetype"); font-display: block; }` : ''}

* { box-sizing: border-box; }

/* Every vertical gap on this sheet is declared. A default 1em paragraph margin is 3.35mm
   at body size, and there are enough paragraphs here for the browser's defaults alone to
   cost about twelve millimetres - which is a whole band. */
p, h1, h2, h3, ul, ol { margin: 0; padding: 0; }
ul, ol { list-style: none; }

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
  font-family: ${fonts.sans};
  font-size: ${type.body}pt;
  line-height: ${type.bodyLeading}pt;
}

/* ---------------------------------------------------------------- page ---- */

.page {
  position: relative;
  width: ${g.pageWidth}mm;
  height: ${g.pageHeight}mm;
  overflow: hidden;
  background: ${palette.paper};
}

/* The measured frame. The build's layout audit compares this element's scroll extent with
   its client extent, so anything that outgrows the sheet is caught before printing. */
.frame {
  position: absolute;
  inset: 0;
  width: ${g.pageWidth}mm;
  height: ${g.pageHeight}mm;
  overflow: hidden;
}

/* Bands are full-bleed; their inner rail carries the side margin. Full-bleed dark bands at
   the top and bottom anchor the sheet and buy back the margin they would otherwise cost. */
.band { position: absolute; left: 0; width: ${g.pageWidth}mm; }
${Object.keys(bands).map(band).join('\n')}

.band__rail {
  position: absolute;
  inset: 0 ${g.marginX}mm;
  display: flex;
  flex-direction: column;
}

.band--deep { background: ${palette.deep}; color: ${palette.onDeep}; }

/* ------------------------------------------------------------ typography ---- */

.eyebrow {
  margin: 0;
  font-size: ${type.eyebrow}pt;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: ${palette.pink};
}
.band--deep .eyebrow { color: ${palette.pinkBright}; }

.section-head {
  margin: 0;
  font-size: ${type.sectionHead}pt;
  line-height: ${type.sectionHead + 2}pt;
  font-weight: 600;
  letter-spacing: -0.016em;
  color: ${palette.ink};
}

.tech {
  font-family: ${fonts.mono};
  font-size: ${type.tech}pt;
  letter-spacing: 0.02em;
  color: ${palette.inkFaint};
}

/* ---------------------------------------------------------------- hero ---- */

.hero { flex: none; display: flex; align-items: center; gap: 7mm; padding-top: 2mm; }

.hero__identity { flex: none; width: 84mm; display: flex; align-items: center; gap: 4.6mm; }
.hero__mark { flex: none; width: 19mm; }
/* The wordmark is set in the vendored brand face, which this sheet already embedded and
   never applied. Sizing is reduced because Modak's rounded forms set optically larger than
   the sans at the same point size. */
.hero__wordmark {
  font-family: ${fonts.brand}, ${fonts.sans};
  font-size: ${type.wordmark - 2}pt;
  line-height: ${type.wordmark + 1}pt;
  font-weight: 400;
  letter-spacing: 0.004em;
  color: ${palette.onDeep};
}
.hero__tagline {
  margin-top: 1.2mm;
  font-size: ${type.body}pt;
  line-height: ${type.bodyLeading}pt;
  font-weight: 600;
  color: ${palette.pinkBright};
}

.hero__rule { flex: none; width: 0.8pt; align-self: stretch; margin: 1mm 0; background: ${palette.deepRule}; }

/* The definition is the largest thing on the sheet, because "what is this?" is the one
   question a reader must not have to hunt for. */
.hero__say { flex: 1; }
.hero__definition {
  margin-top: 0.8mm;
  font-size: ${type.definition}pt;
  line-height: ${type.definitionLeading}pt;
  font-weight: 600;
  letter-spacing: -0.026em;
  color: ${palette.onDeep};
  hyphens: none;
  /* Two sentences over two lines: balancing breaks them at the full stop instead of
     stranding "Its" at the end of the first line. */
  text-wrap: balance;
}

/* Who it is for, what goes in, what comes back. A definition alone does not survive the
   retell test without these three. */
.hero__chips { flex: 1; display: flex; align-items: flex-start; gap: 6mm; padding-top: 2.4mm; }
.chip { flex: 1; padding-left: 3.4mm; border-left: 1.6pt solid ${palette.blueBright}; }
.chip:nth-child(2) { border-left-color: ${palette.pinkBright}; }
.chip:nth-child(3) { border-left-color: ${palette.onDeepMuted}; }
.chip__label {
  display: block;
  margin-bottom: 1.2mm;
  font-size: 7.6pt;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${palette.blueBright};
}
.chip:nth-child(2) .chip__label { color: ${palette.pinkBright}; }
.chip:nth-child(3) .chip__label { color: ${palette.onDeepMuted}; }
.chip__body { font-size: ${type.body}pt; line-height: ${type.bodyLeading}pt; color: ${palette.onDeep}; }

/* --------------------------------------------------------------- story ---- */

.story { flex: 1; display: flex; flex-direction: column; padding-top: 3mm; }

.story__top { display: flex; align-items: flex-start; gap: 8mm; padding-bottom: 2.4mm; }
.story__top > div:first-child { flex: 1; }
.story__setup {
  margin-top: 1.4mm;
  font-size: ${type.body}pt;
  line-height: ${type.bodyLeading}pt;
  color: ${palette.inkMuted};
}
/* The story is invented, and says so where a reader meets it rather than in a footnote. */
.story__disclaimer {
  flex: none;
  width: 82mm;
  font-size: 8.2pt;
  line-height: 10.6pt;
  color: ${palette.inkFaint};
  text-align: right;
}

.story__stages { display: flex; align-items: stretch; gap: 0; }
.stage { flex: 1; display: flex; flex-direction: column; }
.stage__badge { display: flex; align-items: baseline; gap: 2.4mm; }
.stage__n {
  font-size: 8pt;
  font-weight: 600;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${palette.pink};
  letter-spacing: 0.08em;
}
.stage__verb { font-size: 10.4pt; line-height: 12pt; font-weight: 600; letter-spacing: -0.012em; color: ${palette.ink}; }
.stage__body { margin-top: 1.4mm; font-size: ${type.body}pt; line-height: ${type.bodyLeading}pt; color: ${palette.inkMuted}; }
.stage__tech { margin-top: auto; padding-top: 1.4mm; }

.stage__joint { flex: none; width: 9mm; display: flex; align-items: flex-start; padding: 1.5mm 2mm 0 0; }
.stage__joint svg { width: 7mm; }

/* --------------------------------------------------------------- rules ---- */

.rules { flex: 1; display: flex; flex-direction: column; padding-top: 2.4mm; }

/* The proportion, set larger than body copy because it is the economic contract
   and a reader who remembers nothing else should remember it. */
.rules__list { padding-top: 1.4mm; }
.rule { display: flex; align-items: baseline; gap: 5mm; padding: 0.6mm 0; }
.rule + .rule { border-top: 0.5pt solid ${palette.rule}; }
.rule__label {
  flex: none;
  width: 26mm;
  font-size: 7.6pt;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${palette.blue};
}
.rule + .rule .rule__label { color: ${palette.pink}; }
.rule__body { flex: 1; font-size: 11.5pt; line-height: 14.4pt; font-weight: 600; letter-spacing: -0.012em; color: ${palette.ink}; }

/* The mining row. Subordinate on purpose: the row above is arithmetic the contract
   performs, this one describes a market nobody is owed an outcome in, and setting them at
   the same weight would read as two promises rather than one rule and one explanation. */
.rule--note .rule__label { color: ${palette.inkFaint}; }
.rule--note .rule__body {
  font-size: ${type.body}pt;
  line-height: ${type.bodyLeading}pt;
  font-weight: 400;
  letter-spacing: 0;
  color: ${palette.inkMuted};
}

/* Reasons, not trivia. The label matters as much as the numbers: without it a strip of
   figures reads as protocol specification rather than as an answer to "what do I get". */
.reasons {
  margin-top: auto;
  padding-top: 2mm;
  border-top: 0.6pt solid ${palette.rule};
}
.reasons__label {
  display: block;
  margin-bottom: 1.6mm;
  font-size: 7.6pt;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${palette.pink};
}
.reasons__row { display: flex; align-items: flex-start; gap: 5mm; }
.reason { flex: 1; }
.reason__value {
  font-size: ${type.metric}pt;
  line-height: ${type.metric + 0.5}pt;
  font-weight: 600;
  letter-spacing: -0.03em;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${palette.ink};
}
/* The three zeros are the argument; the two magnitudes are context. */
.reason:nth-child(-n + 3) .reason__value { color: ${palette.pink}; }
.reason__label { margin-top: 1.2mm; font-size: 8.2pt; line-height: 10.4pt; color: ${palette.inkMuted}; }

/* -------------------------------------------------------------- signal ---- */

/* The section that closes the loop. Two rows sharing one label gutter, so a reader reads
   down the left edge - this round's signal, then what it adds up to - and sees the causal
   chain rather than two unrelated charts. */
.signal { flex: 1; display: flex; flex-direction: column; padding-top: 2.4mm; }

.signal__top { display: flex; align-items: baseline; gap: 7mm; padding-bottom: 2.4mm; }
.signal__lead {
  flex: 1;
  font-size: ${type.body}pt;
  line-height: ${type.bodyLeading}pt;
  color: ${palette.ink};
}

.signal__row { display: flex; align-items: center; gap: 5mm; }
.signal__row--basket { flex: 1; padding-top: 2.6mm; margin-top: 2.6mm; border-top: 0.6pt solid ${palette.rule}; }
.signal__rowlabel {
  flex: none;
  width: 34mm;
  align-self: flex-start;
  font-size: 7.6pt;
  line-height: 10pt;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${palette.pink};
}
.signal__rowbody { flex: 1; }

.signal__bar { display: flex; align-items: stretch; gap: 1mm; height: 8mm; }
.signal__seg {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2mm;
  padding: 0 2.6mm;
  border-radius: ${radii.chip}mm;
  font-size: ${type.body}pt;
  line-height: ${type.bodyLeading}pt;
  font-weight: 600;
  color: ${brand.white};
  white-space: nowrap;
}
/* The widths carry the proportion; colour only keeps the segments apart, and carries
   through to the accumulation chart below. */
.signal__seg--0 { background: ${palette.pink}; }
.signal__seg--1 { background: ${palette.blue}; }
.signal__seg--2 { background: ${palette.graphite}; }
.signal__share { font-variant-numeric: lining-nums tabular-nums; opacity: 0.86; }
.signal__note { margin-top: 1.6mm; font-size: 8.6pt; line-height: 11pt; color: ${palette.inkMuted}; }

.signal__chart { flex: 1; }
.signal__aside { flex: none; width: 62mm; align-self: flex-start; padding-top: 1mm; }
.signal__caption { font-size: 8.6pt; line-height: 11pt; color: ${palette.inkMuted}; }
.signal__legend { display: flex; flex-wrap: wrap; gap: 1.4mm 4mm; margin-top: 2.2mm; }
.signal__key {
  display: flex;
  align-items: center;
  gap: 1.6mm;
  font-size: 8.2pt;
  line-height: 10.4pt;
  color: ${palette.inkMuted};
}
.signal__swatch { width: 2.6mm; height: 2.6mm; border-radius: 0.5mm; }
.signal__swatch--0 { background: ${palette.pink}; }
.signal__swatch--1 { background: ${palette.blue}; }
.signal__swatch--2 { background: ${palette.graphite}; }

/* ---------------------------------------------------------------- note ---- */

/* A rule and a line, rather than a band. The status is one fact a reader must not miss;
   everything that used to sit down here is whitepaper material. */
.note {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8mm;
  padding-top: 2.4mm;
  border-top: 0.6pt solid ${palette.rule};
  font-size: 8.4pt;
  line-height: 11pt;
}
.note__status { color: ${palette.inkMuted}; }
.note__more { font-family: ${fonts.mono}; font-size: 7.8pt; color: ${palette.inkFaint}; }

/* ------------------------------------------------------------- brandmark ---- */

/* The artwork is a circular mark on an opaque near-white square. Clipping to a circle is
   what lets it sit on the deep hero band without a light square halo; 48% is the largest
   radius that still removes every corner pixel. */
.brandmark {
  display: block;
  flex: none;
  clip-path: circle(48% at 50% 50%);
  -webkit-clip-path: circle(48% at 50% 50%);
}
`;
}
