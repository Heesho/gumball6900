/**
 * Small SVG toolkit for the whitepaper figures.
 *
 * Figures use points as their user unit: a figure whose viewBox is 481.9 wide is drawn at
 * 170mm, so `font-size="7"` inside a figure is exactly 7pt on the page and matches the
 * surrounding type scale. That removes the usual mismatch between figure and body text.
 */

import { fonts, palette } from './theme.mjs';

/** Column widths in points. */
export const widths = {
  full: 481.9, // 170mm — the full content measure
  main: 317.5, // 112mm — the text column
  side: 130.4, // 46mm  — the note column
  bleed: 595.3, // 210mm — trimmed page width
};

export function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A linear scale from a numeric domain onto a pixel range. */
export function linearScale([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1;
  const scale = (value) => r0 + ((value - d0) / span) * (r1 - r0);
  scale.invert = (value) => d0 + ((value - r0) / (r1 - r0)) * span;
  scale.domain = [d0, d1];
  scale.range = [r0, r1];
  return scale;
}

export function polyline(points, x, y) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point).toFixed(2)},${y(point).toFixed(2)}`)
    .join(' ');
}

/** A smooth path through points using a monotone-ish cubic with fixed tension. */
export function smoothPath(points, x, y, tension = 0.34) {
  if (points.length < 2) return '';
  const coords = points.map((point) => [x(point), y(point)]);
  let path = `M${coords[0][0].toFixed(2)},${coords[0][1].toFixed(2)}`;

  for (let index = 0; index < coords.length - 1; index += 1) {
    const previous = coords[Math.max(0, index - 1)];
    const current = coords[index];
    const next = coords[index + 1];
    const after = coords[Math.min(coords.length - 1, index + 2)];
    const c1 = [
      current[0] + ((next[0] - previous[0]) * tension) / 2,
      current[1] + ((next[1] - previous[1]) * tension) / 2,
    ];
    const c2 = [next[0] - ((after[0] - current[0]) * tension) / 2, next[1] - ((after[1] - current[1]) * tension) / 2];
    path += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${next[0].toFixed(2)},${next[1].toFixed(2)}`;
  }

  return path;
}

export function areaPath(points, x, yTop, yBase) {
  const top = points.map(
    (point, index) => `${index === 0 ? 'M' : 'L'}${x(point).toFixed(2)},${yTop(point).toFixed(2)}`,
  );
  const bottom = [...points].reverse().map((point) => `L${x(point).toFixed(2)},${yBase(point).toFixed(2)}`);
  return `${top.join(' ')} ${bottom.join(' ')} Z`;
}

export function text(
  value,
  {
    x,
    y,
    size = 7,
    weight = 400,
    fill = palette.ink,
    anchor = 'start',
    family = 'sans',
    tracking = 0,
    opacity = 1,
    baseline,
  } = {},
) {
  const stack = family === 'mono' ? fonts.mono : family === 'serif' ? fonts.serif : fonts.sans;
  const attributes = [
    `x="${x.toFixed(2)}"`,
    `y="${y.toFixed(2)}"`,
    `font-family="${escapeText(stack)}"`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
    anchor === 'start' ? '' : `text-anchor="${anchor}"`,
    tracking ? `letter-spacing="${tracking}"` : '',
    opacity !== 1 ? `opacity="${opacity}"` : '',
    baseline ? `dominant-baseline="${baseline}"` : '',
  ].filter(Boolean);
  return `<text ${attributes.join(' ')}>${escapeText(value)}</text>`;
}

/** An uppercase tracked label, the paper's standard annotation style. */
export function label(value, options = {}) {
  return text(String(value).toUpperCase(), {
    size: 6.2,
    weight: 600,
    tracking: 0.7,
    fill: palette.inkMuted,
    ...options,
  });
}

export function rect({
  x,
  y,
  width,
  height,
  r = 0,
  fill = 'none',
  stroke = 'none',
  strokeWidth = 0.7,
  opacity = 1,
  dash,
}) {
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(0, width).toFixed(2)}" height="${Math.max(0, height).toFixed(2)}"${r ? ` rx="${r}"` : ''} fill="${fill}" stroke="${stroke}"${stroke !== 'none' ? ` stroke-width="${strokeWidth}"` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
}

export function line({ x1, y1, x2, y2, stroke = palette.rule, width = 0.7, dash, cap = 'butt', opacity = 1 }) {
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="${cap}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
}

export function circle({ cx, cy, r, fill = 'none', stroke = 'none', strokeWidth = 0.7, opacity = 1 }) {
  return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${fill}" stroke="${stroke}"${stroke !== 'none' ? ` stroke-width="${strokeWidth}"` : ''}${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
}

export function path(
  d,
  { fill = 'none', stroke = 'none', strokeWidth = 1, dash, opacity = 1, cap = 'round', join = 'round', marker } = {},
) {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}"${stroke !== 'none' ? ` stroke-width="${strokeWidth}"` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="${cap}" stroke-linejoin="${join}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}${marker ? ` marker-end="url(#${marker})"` : ''}/>`;
}

/** Arrowhead markers, one per accent, so a connector's colour states what is moving. */
export function arrowDefs(colors) {
  return Object.entries(colors)
    .map(
      ([key, color]) =>
        `<marker id="arrow-${key}" viewBox="0 0 10 10" refX="8.4" refY="5" markerWidth="5.2" markerHeight="5.2" orient="auto-start-reverse"><path d="M0,1.4 L9,5 L0,8.6 z" fill="${color}"/></marker>`,
    )
    .join('');
}

/** An orthogonal connector: out, across, in. Reads more cleanly than a diagonal. */
export function elbow({ x1, y1, x2, y2, bend = 0.5, axis = 'x' }) {
  if (axis === 'x') {
    const mid = x1 + (x2 - x1) * bend;
    return `M${x1.toFixed(2)},${y1.toFixed(2)} L${mid.toFixed(2)},${y1.toFixed(2)} L${mid.toFixed(2)},${y2.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}`;
  }
  const mid = y1 + (y2 - y1) * bend;
  return `M${x1.toFixed(2)},${y1.toFixed(2)} L${x1.toFixed(2)},${mid.toFixed(2)} L${x2.toFixed(2)},${mid.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}`;
}

/** A ribbon whose thickness encodes a share of flow, for the routing figures. */
export function ribbon({ x1, y1, x2, y2, w1, w2 }) {
  const cx = x1 + (x2 - x1) / 2;
  return [
    `M${x1.toFixed(2)},${(y1 - w1 / 2).toFixed(2)}`,
    `C${cx.toFixed(2)},${(y1 - w1 / 2).toFixed(2)} ${cx.toFixed(2)},${(y2 - w2 / 2).toFixed(2)} ${x2.toFixed(2)},${(y2 - w2 / 2).toFixed(2)}`,
    `L${x2.toFixed(2)},${(y2 + w2 / 2).toFixed(2)}`,
    `C${cx.toFixed(2)},${(y2 + w2 / 2).toFixed(2)} ${cx.toFixed(2)},${(y1 + w1 / 2).toFixed(2)} ${x1.toFixed(2)},${(y1 + w1 / 2).toFixed(2)}`,
    'Z',
  ].join(' ');
}

/** A labelled node box, the shared vocabulary of the schematic figures. */
export function node({
  x,
  y,
  width,
  height,
  title,
  subtitle,
  accent = palette.ink,
  surface = palette.paper,
  onDark = false,
  r = 3.5,
  titleSize = 8,
}) {
  const titleFill = onDark ? palette.onDeep : palette.ink;
  const subtitleFill = onDark ? palette.onDeepMuted : palette.inkMuted;
  const parts = [
    rect({ x, y, width, height, r, fill: surface, stroke: accent, strokeWidth: 0.8 }),
    rect({ x, y, width: 2.2, height, r: 1.1, fill: accent }),
  ];

  if (subtitle) {
    parts.push(text(title, { x: x + 8, y: y + height / 2 - 1.2, size: titleSize, weight: 600, fill: titleFill }));
    parts.push(text(subtitle, { x: x + 8, y: y + height / 2 + 8, size: 6.6, fill: subtitleFill }));
  } else {
    parts.push(text(title, { x: x + 8, y: y + height / 2 + 2.8, size: titleSize, weight: 600, fill: titleFill }));
  }

  return parts.join('');
}

/** Wrap a figure body in a sized <svg> root. */
export function figure({ width, height, children, background = 'none', defs = '', title }) {
  return [
    `<svg class="figure-svg" viewBox="0 0 ${width} ${height}" width="100%" role="img"${title ? ` aria-label="${escapeText(title)}"` : ''} xmlns="http://www.w3.org/2000/svg">`,
    defs ? `<defs>${defs}</defs>` : '',
    background === 'none' ? '' : rect({ x: 0, y: 0, width, height, fill: background }),
    children,
    '</svg>',
  ].join('');
}

/** A conventional value axis with ticks, gridlines and a title. */
export function axisY({ scale, x, x2, ticks, format = String, stroke = palette.rule, fill = palette.inkFaint, title }) {
  const parts = ticks.map((value) => {
    const y = scale(value);
    return [
      line({ x1: x, y1: y, x2, y2: y, stroke, width: 0.5, opacity: 0.85 }),
      text(format(value), { x: x - 4, y: y + 2.2, size: 6, fill, anchor: 'end' }),
    ].join('');
  });

  if (title) {
    parts.push(label(title, { x: x - 4, y: scale.range[1] - 9, anchor: 'end', fill }));
  }

  return parts.join('');
}

export function axisX({
  scale,
  y,
  ticks,
  format = String,
  fill = palette.inkFaint,
  stroke = palette.ruleStrong,
  title,
  tickLength = 3,
}) {
  const parts = [line({ x1: scale.range[0], y1: y, x2: scale.range[1], y2: y, stroke, width: 0.7 })];

  ticks.forEach((value) => {
    const x = scale(value);
    parts.push(line({ x1: x, y1: y, x2: x, y2: y + tickLength, stroke, width: 0.7 }));
    parts.push(text(format(value), { x, y: y + tickLength + 7.2, size: 6, fill, anchor: 'middle' }));
  });

  if (title) {
    parts.push(label(title, { x: scale.range[1], y: y + tickLength + 17, anchor: 'end', fill }));
  }

  return parts.join('');
}
