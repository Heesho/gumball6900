/**
 * lib/legend.ts — the published legend, and the palette it publishes.
 *
 * The ball-colour law is binding across all five figures: a reader learns
 * three types once and can then read any diagram on the page. This module owns
 * the values, and `drawLegend()` renders the law and the six ISA glyphs into a
 * canvas so the five figures can carry the same key rather than each inventing
 * one. It is a draw function, not specimen markup, for exactly that reason.
 *
 * THE PINK COLLISION. `--pink #F92B92` means "signal" page-wide and is also
 * QQQ's asset hue, so a QQQ ribbon can sit beside a signal line in the same
 * frame. It is resolved by FORM, not by hue, and the legend renders the
 * resolution rather than asserting it:
 *
 *   signal  is a 1px dashed line leaving a control NODE. It has no width,
 *           because it carries no quantity, and it is never filled.
 *   an asset is a filled band of measured width landing in a labelled bay,
 *           and it always carries its ticker.
 *
 * A reader never has to tell the two apart by hue, because they are never the
 * same kind of mark.
 *
 * Nothing here animates. Paint the legend from buildLayout() / on resize, not
 * from the rAF paint — it then costs zero draw-ops per frame.
 */

import {
  GLYPHS,
  PROCESS,
  PROCESS_REST,
  SIGNAL,
  node,
  setStroke,
  sink,
  splitter,
  tag,
  valve,
  vessel,
  type GlyphName,
} from './isa';

/* ------------------------------------------------------- the colour law -- */

/** USDG — capital arriving. Always, everywhere, no variation. */
export const USDG = '#29B6F0';

/** GBX — supply, and what gets burned. Neutral, always. */
export const GBX = '#FFFFFF';

export interface AssetHue {
  readonly sym: string;
  readonly hue: string;
}

/**
 * One distinct hue per asset, differing from each other and each consistent
 * with itself. These are the values `components/sections/Fund.tsx` already
 * ships; the overview must encode holdings the same way.
 */
export const ASSETS: readonly AssetHue[] = [
  { sym: 'NVDA', hue: '#9E5CF2' },
  { sym: 'QQQ', hue: '#F92B92' },
  { sym: 'WBTC', hue: '#FF6274' },
  { sym: 'AAPL', hue: '#F57ACD' },
];

export function assetHue(sym: string): string {
  return ASSETS.find((a) => a.sym === sym)?.hue ?? GBX;
}

/* ----------------------------------------------------------- the tokens -- */

export interface Ink {
  readonly bg: string;
  readonly panel: string;
  readonly raised: string;
  readonly rule: string;
  readonly ruleStrong: string;
  readonly hi: string;
  readonly text: string;
  readonly muted: string;
  readonly faint: string;
  readonly blue: string;
  readonly pink: string;
  readonly pinkLabel: string;
  readonly blueLabel: string;
}

let inkCache: Ink | null = null;

/**
 * The design tokens, resolved once from the live stylesheet. `getComputedStyle`
 * forces a style recalculation, so this is memoised and must be called from
 * mount / buildLayout, never from a frame.
 */
export function readInk(): Ink {
  if (inkCache !== null) return inkCache;
  const fallback: Ink = {
    bg: '#0C0C0C',
    panel: '#101017',
    raised: '#17171F',
    rule: '#26262F',
    ruleStrong: '#3B3B48',
    hi: '#FFFFFF',
    text: '#EFEFF4',
    muted: '#ADADC0',
    faint: '#8A8AA0',
    blue: '#29B6F0',
    pink: '#F92B92',
    pinkLabel: '#FB63AC',
    blueLabel: '#9BDDFA',
  };
  if (typeof document === 'undefined') return fallback;
  const css = getComputedStyle(document.documentElement);
  const get = (token: string, dflt: string): string => css.getPropertyValue(token).trim() || dflt;
  inkCache = {
    bg: get('--bg', fallback.bg),
    panel: get('--panel', fallback.panel),
    raised: get('--raised', fallback.raised),
    rule: get('--rule', fallback.rule),
    ruleStrong: get('--rule-strong', fallback.ruleStrong),
    hi: get('--hi', fallback.hi),
    text: get('--text', fallback.text),
    muted: get('--muted', fallback.muted),
    faint: get('--faint', fallback.faint),
    blue: get('--blue', fallback.blue),
    pink: get('--pink', fallback.pink),
    pinkLabel: get('--pink-label', fallback.pinkLabel),
    blueLabel: get('--blue-label', fallback.blueLabel),
  };
  return inkCache;
}

/* --------------------------------------------------------- text plumbing -- */

/** Greedy word wrap against the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line === '' ? word : line + ' ' + word;
    if (ctx.measureText(next).width <= maxW || line === '') line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

export interface LegendFonts {
  /** 11px mono, 600, tracked caps — the row titles and glyph names */
  readonly name: string;
  /** 10.5px mono — the meanings */
  readonly meta: string;
  /** 9px mono — inside an instrument bubble */
  readonly micro: string;
}

export function legendFonts(mono: string): LegendFonts {
  return {
    name: `600 11px ${mono}`,
    meta: `400 10.5px ${mono}`,
    micro: `500 9px ${mono}`,
  };
}

/* ------------------------------------------------------------ the legend -- */

export interface LegendOpts {
  readonly ink: Ink;
  readonly fonts: LegendFonts;
  /** one line naming the figure's gauge, e.g. '1 px = 0.05 USDG/s' */
  readonly scaleNote?: string;
  /** device pixel ratio, for crisp rules */
  readonly dpr?: number;
}

interface Row {
  readonly title: string;
  /** printed after the title only when it fits — never cut, never wrapped */
  readonly note: string;
  readonly h: number;
  readonly draw: (y: number) => void;
}

const CAPS = 0.19; // em of extra tracking on a mono cap run

function capsText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number): number {
  const extra = size * CAPS;
  let cx = x;
  for (const ch of s) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + extra;
  }
  return cx - x - extra;
}

function capsWidth(ctx: CanvasRenderingContext2D, s: string, size: number): number {
  return ctx.measureText(s).width + size * CAPS * Math.max(0, s.length - 1);
}

function drawGlyph(ctx: CanvasRenderingContext2D, name: GlyphName, x: number, y: number, o: LegendOpts): void {
  const ink = o.ink;
  switch (name) {
    case 'VESSEL':
      vessel(ctx, x - 9, y - 11, {
        ink: ink.muted,
        w: 18,
        h: 22,
        level: 0.55,
        levelFill: USDG,
        ground: ink.raised,
      });
      break;
    case 'VALVE':
      /* BOTH states, drawn. A glyph whose two readings are defined in words and
         illustrated in one of them teaches only that one: a reader who meets a
         hollow bowtie on a figure has never seen it here. */
      valve(ctx, x - 10, y, { ink: ink.muted, size: 15, open: true, fill: USDG });
      valve(ctx, x + 10, y, { ink: ink.muted, size: 15, open: false });
      break;
    case 'SPLITTER':
      splitter(ctx, x, y - 3, { ink: ink.muted, size: 16, fill: ink.raised });
      break;
    case 'TAG':
      tag(ctx, x, y, {
        ink: ink.muted,
        r: 12,
        tag: 'FI',
        value: '8.0',
        tagFont: o.fonts.micro,
        valueFont: o.fonts.micro,
        tagInk: ink.muted,
        valueInk: ink.hi,
      });
      break;
    case 'NODE':
      node(ctx, x, y, { ink: ink.pink, size: 16, fill: ink.raised });
      break;
    case 'SINK':
      sink(ctx, x, y, { ink: ink.muted, size: 20, fill: ink.hi });
      break;
  }
}

/**
 * Lay the legend out inside a box and paint it. Returns the height it used, so
 * a caller can check it fits — nothing in this system is ever allowed to be
 * cut by its own container.
 *
 * The layout is solved from measured text at the box's real width: column
 * counts fall as the box narrows and every caption wraps rather than
 * overflowing, so the same call is correct at 1440 and at 390.
 */
export function drawLegend(
  ctx: CanvasRenderingContext2D,
  box: { readonly x: number; readonly y: number; readonly w: number; readonly h?: number },
  o: LegendOpts,
): number {
  const { ink, fonts } = o;
  const dpr = o.dpr ?? 1;
  const x0 = box.x;
  const W = box.w;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  /* ---- row 1: the six glyphs --------------------------------------------- */
  ctx.font = fonts.meta;
  let cellW = 0;
  for (const g of GLYPHS) cellW = Math.max(cellW, ctx.measureText(g.means).width);
  ctx.font = fonts.name;
  for (const g of GLYPHS) cellW = Math.max(cellW, capsWidth(ctx, g.name, 11));
  cellW += 52; // the glyph column — wide enough for the VALVE's two states
  const gCols = Math.max(1, Math.min(GLYPHS.length, Math.floor((W + 18) / (cellW + 18))));
  const gRows = Math.ceil(GLYPHS.length / gCols);
  const gStep = gCols === 1 ? W : (W + 18) / gCols;

  const glyphRow: Row = {
    title: 'THE SIX GLYPHS',
    note: 'learn once, read every station',
    h: gRows * 44,
    draw: (y) => {
      ctx.textAlign = 'left';
      GLYPHS.forEach((g, i) => {
        const cx = x0 + (i % gCols) * gStep + 19;
        const cy = y + Math.floor(i / gCols) * 44 + 18;
        drawGlyph(ctx, g.name, cx, cy, o);
        ctx.font = fonts.name;
        ctx.fillStyle = ink.hi;
        capsText(ctx, g.name, cx + 32, cy - 3, 11);
        ctx.font = fonts.meta;
        ctx.fillStyle = ink.muted;
        ctx.fillText(g.means, cx + 32, cy + 12);
      });
    },
  };

  /* ---- row 2: the three line weights -------------------------------------
     Two of these were published before and the third was in constant use and
     unpublished: on any figure most routes are at rest at any instant, so the
     hairline is the mark a reader meets most and the one they were never told
     the meaning of. */
  const weights: { spec: typeof PROCESS; ink: string; name: string; means: string; solid: boolean }[] = [
    { spec: PROCESS, ink: USDG, name: 'PROCESS', means: 'width is the quantity', solid: true },
    {
      spec: PROCESS_REST,
      ink: ink.ruleStrong,
      name: 'PROCESS AT REST',
      means: 'a route with nothing in it',
      solid: false,
    },
    { spec: SIGNAL, ink: ink.pink, name: 'SIGNAL', means: 'aim only; it carries no quantity', solid: false },
  ];
  const SAMPLE = 56;
  ctx.font = fonts.meta;
  let wMeans = 0;
  for (const r of weights) wMeans = Math.max(wMeans, ctx.measureText(r.means).width);
  ctx.font = fonts.name;
  let wName = 0;
  for (const r of weights) wName = Math.max(wName, capsWidth(ctx, r.name, 11));
  const wLine = SAMPLE + 14 + wName + 12 + wMeans;
  /* the column count is solved from measured text, and the narrowest fit still
     puts the whole sentence on the canvas — a legend that truncates its own key
     is worthless */
  const wCols = Math.max(1, Math.min(weights.length, Math.floor((W + 24) / (wLine + 24))));
  const wWrapped = wCols === 1 && W < wLine;
  const wRows = Math.ceil(weights.length / wCols);
  const wStep = wWrapped ? 46 : 30;
  const wColStep = wCols === 1 ? 0 : (W + 24) / wCols;
  const weightRow: Row = {
    title: 'THREE WEIGHTS',
    note: 'a flow is never a signal, and a route is never a flow',
    h: (wRows - 1) * wStep + (wWrapped ? 42 : 26) + 8,
    draw: (y) => {
      ctx.textAlign = 'left';
      weights.forEach((r, i) => {
        const cx = x0 + (i % wCols) * wColStep;
        const cy = y + 12 + Math.floor(i / wCols) * wStep;
        if (r.solid) {
          ctx.fillStyle = r.ink;
          ctx.fillRect(cx, cy - 5, SAMPLE, 10);
        } else {
          setStroke(ctx, r.spec, r.ink);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + SAMPLE, cy);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.font = fonts.name;
        ctx.fillStyle = ink.hi;
        const nameW = capsText(ctx, r.name, cx + SAMPLE + 14, cy + 4, 11);
        ctx.font = fonts.meta;
        ctx.fillStyle = ink.muted;
        if (wWrapped) ctx.fillText(r.means, cx, cy + 22);
        else ctx.fillText(r.means, cx + SAMPLE + 26 + nameW, cy + 4);
      });
    },
  };

  /* ---- row 3: the three forms a live reading takes ------------------------
     A figure that prints a bubble for one kind of number and a bare numeral
     for another has two conventions and publishes one. All three are drawn
     here in the form the figures actually use them. */
  const readings: { name: string; means: string; draw: (x: number, y: number) => void }[] = [
    {
      name: 'TAG',
      means: 'a rate, led back to the band it measures',
      draw: (x, y) => {
        setStroke(ctx, SIGNAL, ink.muted);
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 15);
        ctx.lineTo(x + 20, y + 11);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = USDG;
        ctx.fillRect(x - 4, y + 12, 22, 7);
        tag(ctx, x + 24, y - 2, {
          ink: ink.muted,
          r: 11,
          tag: 'FI',
          value: '8.0',
          tagFont: o.fonts.micro,
          valueFont: o.fonts.micro,
          tagInk: ink.muted,
          valueInk: ink.hi,
          ground: ink.panel,
        });
      },
    },
    {
      name: 'STOCK',
      means: 'a level, ticked to the bay or vessel holding it',
      draw: (x, y) => {
        ctx.fillStyle = ink.bg;
        ctx.fillRect(x, y - 16, 20, 24);
        ctx.fillStyle = assetHue('NVDA');
        ctx.fillRect(x + 1, y - 3, 18, 10);
        ctx.strokeStyle = assetHue('NVDA');
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(x + 0.5 / dpr, y - 16 + 0.5 / dpr, 20, 24);
        ctx.strokeStyle = ink.ruleStrong;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 8);
        ctx.lineTo(x + 10, y + 12);
        ctx.stroke();
        /* left-aligned on the box's own edge, exactly as a figure draws it —
           a key whose sample is set differently from the thing it publishes is
           a key that has already drifted */
        ctx.save();
        ctx.textAlign = 'left';
        ctx.font = o.fonts.micro;
        ctx.fillStyle = ink.hi;
        ctx.fillText('NVDA 21.1', x, y + 21);
        ctx.restore();
      },
    },
    {
      name: 'SHARE',
      means: 'a ratio, printed on the branch that sets it',
      draw: (x, y) => {
        node(ctx, x + 8, y - 10, { ink: ink.pink, size: 13, fill: ink.raised });
        setStroke(ctx, SIGNAL, ink.pink);
        ctx.beginPath();
        ctx.moveTo(x + 8, y - 3);
        ctx.lineTo(x + 8, y + 8);
        ctx.lineTo(x + 34, y + 8);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = o.fonts.micro;
        ctx.fillStyle = ink.pinkLabel;
        ctx.fillText('27%', x + 37, y + 11);
      },
    },
  ];
  ctx.font = fonts.meta;
  let rCell = 0;
  for (const r of readings) rCell = Math.max(rCell, ctx.measureText(r.means).width);
  ctx.font = fonts.name;
  for (const r of readings) rCell = Math.max(rCell, capsWidth(ctx, r.name, 11));
  rCell += 76; // the sample column
  const rCols = Math.max(1, Math.min(readings.length, Math.floor((W + 18) / (rCell + 18))));
  const rRows = Math.ceil(readings.length / rCols);
  const rStep = rCols === 1 ? W : (W + 18) / rCols;
  const readingRow: Row = {
    title: 'THREE READINGS',
    note: 'every number sits on the mechanism that produced it',
    h: rRows * 48,
    draw: (y) => {
      ctx.textAlign = 'left';
      readings.forEach((r, i) => {
        const cx = x0 + (i % rCols) * rStep;
        const cy = y + Math.floor(i / rCols) * 48 + 18;
        r.draw(cx, cy);
        ctx.textAlign = 'left';
        ctx.font = fonts.name;
        ctx.fillStyle = ink.hi;
        capsText(ctx, r.name, cx + 76, cy - 3, 11);
        ctx.font = fonts.meta;
        ctx.fillStyle = ink.muted;
        ctx.fillText(r.means, cx + 76, cy + 12);
      });
    },
  };

  /* ---- row 3: the ball-colour law ---------------------------------------- */
  const law: { form: 'band' | 'bay'; hue: string; name: string; means: string }[] = [
    { form: 'band', hue: USDG, name: 'USDG', means: 'capital arriving' },
    { form: 'band', hue: GBX, name: 'GBX', means: 'supply, and burns' },
    ...ASSETS.map((a) => ({ form: 'bay' as const, hue: a.hue, name: a.sym, means: 'asset held' })),
  ];
  ctx.font = fonts.meta;
  let lawW = 0;
  for (const c of law) lawW = Math.max(lawW, ctx.measureText(c.means).width);
  lawW += 46;
  const lCols = Math.max(1, Math.min(law.length, Math.floor((W + 16) / (lawW + 16))));
  const lRows = Math.ceil(law.length / lCols);
  const lStep = lCols === 1 ? W : (W + 16) / lCols;

  const lawRow: Row = {
    title: 'THE BALL-COLOUR LAW',
    note: 'three types, learned once',
    h: lRows * 40,
    draw: (y) => {
      ctx.textAlign = 'left';
      law.forEach((c, i) => {
        const cx = x0 + (i % lCols) * lStep;
        const cy = y + Math.floor(i / lCols) * 40 + 14;
        ctx.fillStyle = c.hue;
        if (c.form === 'band') ctx.fillRect(cx, cy - 6, 34, 12);
        else {
          ctx.fillStyle = ink.raised;
          ctx.fillRect(cx, cy - 11, 34, 22);
          ctx.fillStyle = c.hue;
          ctx.fillRect(cx, cy - 2, 34, 13);
          ctx.strokeStyle = ink.ruleStrong;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.strokeRect(cx + 0.5 / dpr, cy - 11 + 0.5 / dpr, 34, 22);
        }
        ctx.font = fonts.name;
        ctx.fillStyle = ink.hi;
        capsText(ctx, c.name, cx + 44, cy - 2, 11);
        ctx.font = fonts.meta;
        ctx.fillStyle = ink.muted;
        ctx.fillText(c.means, cx + 44, cy + 13);
      });
    },
  };

  /* ---- row 4: the collision, resolved by form ---------------------------- */
  ctx.font = fonts.meta;
  const collisionCopy =
    '#F92B92 is both the signal hue and QQQ. Form separates them: a signal is a thin dashed line out of a control node and has no width; an asset is a filled band of measured width landing in a bay that carries its ticker.';
  const twoUp = W >= 520;
  const copyW = twoUp ? W - 300 : W;
  const copyLines = wrap(ctx, collisionCopy, copyW);
  const collisionRow: Row = {
    title: 'SAME HUE, DIFFERENT FORM',
    note: 'the one collision in the palette',
    h: Math.max(twoUp ? 46 : 92, copyLines.length * 14 + (twoUp ? 4 : 54)),
    draw: (y) => {
      ctx.textAlign = 'left';
      const cy = y + 14;
      node(ctx, x0 + 9, cy, { ink: ink.pink, size: 14, fill: ink.raised });
      setStroke(ctx, SIGNAL, ink.pink);
      ctx.beginPath();
      ctx.moveTo(x0 + 18, cy);
      ctx.lineTo(x0 + 104, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = fonts.meta;
      ctx.fillStyle = ink.muted;
      ctx.fillText('signal', x0 + 110, cy + 4);

      const bx = x0 + 168;
      ctx.fillStyle = assetHue('QQQ');
      ctx.fillRect(bx, cy - 5, 44, 10);
      ctx.fillStyle = ink.raised;
      ctx.fillRect(bx + 44, cy - 12, 30, 24);
      ctx.fillStyle = assetHue('QQQ');
      ctx.fillRect(bx + 44, cy - 1, 30, 13);
      ctx.strokeStyle = ink.ruleStrong;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 44 + 0.5 / dpr, cy - 12 + 0.5 / dpr, 30, 24);
      ctx.font = fonts.name;
      ctx.fillStyle = ink.hi;
      capsText(ctx, 'QQQ', bx + 80, cy + 4, 11);

      ctx.font = fonts.meta;
      ctx.fillStyle = ink.muted;
      const tx = twoUp ? x0 + 300 : x0;
      const ty = twoUp ? y + 10 : y + 46;
      copyLines.forEach((line, i) => ctx.fillText(line, tx, ty + i * 14));
    },
  };

  /* ---- run the rows ------------------------------------------------------
     The plate solves its own column counts from measured text, so its natural
     height moves with the box. Where the box is a pixel short, the gaps give
     first: a legend that is cut by its own container has failed at the one
     thing it is for. */
  /* ---- row 6: the three words the figures use and never define ------------
     "Station" and "seam" name the two things every conservation check on the
     page is measured on, and lane order is the channel that carries identity
     when hue cannot. All three were load-bearing and unpublished. */
  ctx.font = fonts.meta;
  const noteCopy = [
    'STATION — one cross-section of a band, where its width is read. SEAM — the join between two stacked bands: a gap or an overlap there is a drawing error even when the quantities are right.',
    'STACK ORDER IS BAY ORDER at every station, so a band can be followed from bay to sink without using its hue at all.',
    'A splitter gives its residual to the last lane, as the contracts do, so legs sum to the trunk in units by construction: the checks printed are the drawn ones, in px.',
  ];
  const noteLines: string[][] = noteCopy.map((c) => wrap(ctx, c, W));
  const noteRow: Row = {
    title: 'THREE DEFINITIONS',
    note: 'the words the checks are written in',
    h: noteLines.reduce((sum, lines) => sum + lines.length * 14, 0) + (noteLines.length - 1) * 6 + 4,
    draw: (y) => {
      ctx.textAlign = 'left';
      ctx.font = fonts.meta;
      ctx.fillStyle = ink.muted;
      let ny = y + 11;
      noteLines.forEach((lines, i) => {
        if (i > 0) ny += 6;
        lines.forEach((line) => {
          ctx.fillText(line, x0, ny);
          ny += 14;
        });
      });
    },
  };

  const rows: Row[] = [glyphRow, weightRow, readingRow, lawRow, collisionRow, noteRow];
  const TITLE_BAND = 24;
  let content = 0;
  for (const r of rows) content += TITLE_BAND + r.h;
  if (o.scaleNote !== undefined) content += 20;
  const room = box.h === undefined ? Infinity : box.h - (box.y - 0) - 2;
  const GAP = Math.max(5, Math.min(14, (room - content) / rows.length));

  let y = box.y;
  rows.forEach((row, i) => {
    if (i > 0) y += GAP;
    ctx.strokeStyle = ink.rule;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    const ry = Math.round(y * dpr) / dpr + 0.5 / dpr;
    ctx.moveTo(x0, ry);
    ctx.lineTo(x0 + W, ry);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = fonts.name;
    ctx.fillStyle = ink.hi;
    const titleW = capsText(ctx, row.title, x0, y + 15, 11);
    ctx.font = fonts.meta;
    /* the note is an aside: printed only where the whole of it fits on the
       line, never wrapped and never clipped */
    if (ctx.measureText(row.note).width + titleW + 14 <= W) {
      ctx.fillStyle = ink.muted;
      ctx.fillText(row.note, x0 + titleW + 14, y + 15);
    }
    y += 24;
    row.draw(y);
    y += row.h;
  });

  if (o.scaleNote !== undefined) {
    y += GAP;
    ctx.font = fonts.meta;
    ctx.fillStyle = ink.muted;
    ctx.fillText(o.scaleNote, x0, y);
    y += 6;
  }

  return y - box.y;
}

/**
 * The words the plate renders, for the canvas's `aria-label`. A canvas legend
 * that a screen reader cannot read is not a published legend.
 */
export function legendAltText(): string {
  const glyphs = GLYPHS.map((g) => `${g.name}, ${g.means}`).join('; ');
  const assets = ASSETS.map((a) => a.sym).join(', ');
  return (
    `The drawing key for every figure on this page. Six glyphs: ${glyphs}. The valve is drawn in both of its states. ` +
    'Three line weights: a process line is heavy and solid and its width is the quantity; ' +
    'a process line at rest is a grey hairline, a route with nothing in it; ' +
    'a signal line is thin and dashed and carries no quantity. ' +
    'Three forms a live reading takes: a TAG is a rate in a bubble led back to the band it measures; ' +
    'a STOCK reading is a level, named and ticked to the bay or vessel that holds it; ' +
    'a SHARE is a ratio printed on the branch where the control signal sets it. ' +
    `The colour law: USDG capital is always blue, GBX supply and burns are always neutral white, and each asset has one hue of its own — ${assets}. ` +
    'Brand pink is both the signal colour and QQQ, so the two are told apart by form and never by hue: ' +
    'signal is a thin dashed line out of a control node, an asset is a filled band landing in a bay that carries its ticker. ' +
    'Three definitions: a station is one cross-section of a band, the place its width is read; ' +
    'a seam is the join between two stacked bands, where a gap or an overlap is a drawing error even when the quantities are right; ' +
    'and stack order is always bay order, so a band can be followed from bay to sink without using its hue at all.'
  );
}
