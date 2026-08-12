/**
 * Vector parts of the one-pager.
 *
 * Text-bearing blocks are HTML, so the browser wraps them and the build's clipping audit
 * can measure them. SVG is reserved for the things HTML draws badly: the arrows that carry
 * the argument, the four outcome glyphs, and the liquidity split.
 *
 * Every glyph here has a job. A shape that only decorates would be taking space from a
 * label, on a page whose whole constraint is space.
 */

import { palette } from '../../../whitepaper/src/theme.mjs';
import { line, path, rect } from '../../../whitepaper/src/svg.mjs';

/**
 * `display:block` matters more than it looks. An inline SVG sits on a text baseline and
 * carries the line box's descender with it, which added a millimetre to all six comparison
 * rows and pushed the sheet past one page.
 */
const svg = (viewBox, children, { width = '100%', label } = {}) =>
  [
    `<svg viewBox="${viewBox}" width="${width}" style="display:block" role="img"${label ? ` aria-label="${label}"` : ' aria-hidden="true"'} xmlns="http://www.w3.org/2000/svg">`,
    children,
    '</svg>',
  ].join('');

/** The step connector in the five-step flow. */
export function stepArrow() {
  return svg(
    '0 0 20 12',
    [
      line({ x1: 0, y1: 6, x2: 12, y2: 6, stroke: palette.rule, width: 1, cap: 'round' }),
      path('M12,2.6 L19,6 L12,9.4 Z', { fill: palette.pink }),
    ].join(''),
  );
}

/**
 * The basket forming over four rounds.
 *
 * Bars are cumulative, so every one is taller than the last and no segment ever shrinks:
 * that is the whole point. The mix shifts between rounds because signals shift, while what
 * was already bought stays put.
 *
 * The viewBox is 511 units wide and renders at about 180mm, so one user unit is roughly one
 * point and `font-size="9.5"` prints at the same 9.5pt floor the HTML uses.
 */
export function basketFormation({ rounds }) {
  const w = 511;
  const h = 86;
  const baseline = 68;
  const barW = 70;
  const gap = (w - rounds.length * barW) / (rounds.length - 1);

  const totals = rounds.map((round) => round.a + round.b + round.c);
  const scale = 62 / Math.max(...totals);
  const fills = [palette.pink, palette.blue, palette.graphite];

  const bar = (round, index) => {
    const x = index * (barW + gap);
    let y = baseline;
    const parts = [round.c, round.b, round.a].map((value, layer) => {
      const height = value * scale;
      y -= height;
      return rect({ x, y, width: barW, height, fill: fills[2 - layer] });
    });

    return [
      ...parts,
      `<text x="${x + barW / 2}" y="${baseline + 13}" font-size="9.5" font-weight="600" fill="${palette.inkMuted}" text-anchor="middle">${index + 1}</text>`,
    ].join('');
  };

  return svg(
    `0 0 ${w} ${h}`,
    [
      rounds.map(bar).join(''),
      line({ x1: 0, y1: baseline + 1, x2: w, y2: baseline + 1, stroke: palette.ruleStrong, width: 0.8 }),
    ].join(''),
    { label: 'The basket accumulating across four rounds of buying' },
  );
}
