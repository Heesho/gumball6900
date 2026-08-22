/**
 * lib/isa.ts — the drawn ISA-5.1 grammar. Zero bytes of dependency.
 *
 * No usable process-engineering symbol library exists at a permissive licence,
 * so ISA-5.1 is adopted as a *drawn* grammar: six glyphs, hand-authored into
 * the canvas 2D context, that between them cover every mechanism the five
 * figures need. Six is the design target — a reader learns them once and can
 * then read the overview, mining, resonance and both halves of the fund.
 *
 *   VALVE     flow is gated here. Solid = open, hollow = shut.
 *   SPLITTER  flow divides here, in a ratio something else sets.
 *   TAG       an instrument bubble: a live reading, wired by a signal leader
 *             to the mechanism that produces it, so a number is never loose.
 *   VESSEL    a holding vessel with its own outlet. Money STOPS here until
 *             something opens the outlet — never a pass-through elbow.
 *   SINK      a terminator: what enters leaves the system and does not return.
 *   NODE      a control node — the source of a signal. Signal lines are thin
 *             and dashed and never carry quantity.
 *
 * The other half of the grammar is the pair of line weights below. Capital
 * flow and control signal must never be the same stroke, so they are one
 * exported constant pair rather than a magic number at each call site.
 *
 * Everything here is pure geometry: colours arrive as arguments, the palette
 * lives in lib/legend.ts, and nothing in this file touches the DOM. Coordinates
 * are CSS px — the caller's context is already dpr-transformed.
 */

export interface StrokeSpec {
  /** CSS px */
  readonly width: number;
  readonly dash: readonly number[];
  readonly cap: CanvasLineCap;
}

/** Capital, material, quantity. A heavy solid line, or a filled ribbon. */
export const PROCESS: StrokeSpec = { width: 2, dash: [], cap: 'butt' };

/** Control, measurement, aim. A light dashed line. Carries no quantity. */
export const SIGNAL: StrokeSpec = { width: 1, dash: [3, 3], cap: 'butt' };

/** The pair, for a legend or a lookup. */
export const STROKE = { PROCESS, SIGNAL } as const;

/** Hairline used for glyph outlines and instrument chrome. */
export const GLYPH_STROKE = 1.25;

export function setStroke(ctx: CanvasRenderingContext2D, spec: StrokeSpec, ink: string): void {
  ctx.lineWidth = spec.width;
  ctx.lineCap = spec.cap;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  ctx.setLineDash(spec.dash as number[]);
}

/** Put an axis-aligned 1px rule on the device pixel grid. */
export function hairline(v: number, dpr: number): number {
  return Math.round(v * dpr) / dpr + 0.5 / dpr;
}

export interface GlyphStyle {
  /** outline colour */
  readonly ink: string;
  /** fill for the solid state; omit for hollow */
  readonly fill?: string;
  /** nominal glyph height, CSS px (default 22) */
  readonly size?: number;
  /** line width for the outline (default GLYPH_STROKE) */
  readonly weight?: number;
}

function begin(ctx: CanvasRenderingContext2D, s: GlyphStyle): number {
  ctx.setLineDash([]);
  ctx.lineWidth = s.weight ?? GLYPH_STROKE;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.strokeStyle = s.ink;
  return s.size ?? 22;
}

/* ------------------------------------------------------------- 1 · VALVE -- */
/**
 * The ISA bowtie. Two triangles meeting at the stem, drawn across the line it
 * gates. `open` fills it; shut leaves it hollow, which is the whole reading:
 * a shut valve is why nothing is moving.
 */
export function valve(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: GlyphStyle & { readonly open?: boolean; readonly vertical?: boolean },
): void {
  const s = begin(ctx, style);
  const h = s / 2;
  const w = s * 0.58;
  ctx.save();
  ctx.translate(x, y);
  if (style.vertical === true) ctx.rotate(Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-w, -h);
  ctx.lineTo(-w, h);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.moveTo(w, -h);
  ctx.lineTo(w, h);
  ctx.lineTo(0, 0);
  ctx.closePath();
  if (style.open === true && style.fill !== undefined) {
    ctx.fillStyle = style.fill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

/* ---------------------------------------------------------- 2 · SPLITTER -- */
/**
 * The three-way valve: the bowtie plus a branch triangle on the stem. Wherever
 * one flow becomes several — mining's 80/20, the fund's per-bay claims — this
 * is the mechanism doing it, and the ratio is set by whatever signal line
 * arrives at the stem.
 */
export function splitter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: GlyphStyle & { readonly branch?: 'up' | 'down'; readonly fill?: string },
): void {
  const s = begin(ctx, style);
  const h = s / 2;
  const w = s * 0.58;
  const dir = style.branch === 'down' ? 1 : -1;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-w, -h);
  ctx.lineTo(-w, h);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.moveTo(w, -h);
  ctx.lineTo(w, h);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.moveTo(-w * 0.86, dir * s);
  ctx.lineTo(w * 0.86, dir * s);
  ctx.lineTo(0, 0);
  ctx.closePath();
  if (style.fill !== undefined) {
    ctx.fillStyle = style.fill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

/* --------------------------------------------------------------- 3 · TAG -- */
export interface TagStyle extends GlyphStyle {
  /** the instrument's tag, e.g. 'FI' — flow indicator */
  readonly tag: string;
  /** the live reading */
  readonly value: string;
  /** the point on the mechanism this reading comes from */
  readonly from?: { readonly x: number; readonly y: number };
  /** radius in CSS px (default 17) */
  readonly r?: number;
  readonly tagFont: string;
  readonly valueFont: string;
  readonly tagInk: string;
  readonly valueInk: string;
  /** panel ground, painted behind the bubble so a leader never shows through */
  readonly ground?: string;
}

/**
 * The instrument bubble. A circle split by its tag line: the tag above, the
 * live value below, and a dashed SIGNAL leader back to the mechanism that
 * produces it. A number that floats free of its mechanism is the failure this
 * glyph exists to prevent.
 */
export function tag(ctx: CanvasRenderingContext2D, x: number, y: number, style: TagStyle): void {
  const r = style.r ?? 17;
  if (style.from !== undefined) {
    const dx = x - style.from.x;
    const dy = y - style.from.y;
    const len = Math.hypot(dx, dy) || 1;
    setStroke(ctx, SIGNAL, style.ink);
    ctx.beginPath();
    ctx.moveTo(style.from.x, style.from.y);
    ctx.lineTo(x - (dx / len) * r, y - (dy / len) * r);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.lineWidth = style.weight ?? GLYPH_STROKE;
  ctx.strokeStyle = style.ink;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (style.ground !== undefined) {
    ctx.fillStyle = style.ground;
    ctx.fill();
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.stroke();

  /* saved, because a glyph that leaves textAlign on 'center' silently breaks
     every label the caller draws after it */
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = style.tagFont;
  ctx.fillStyle = style.tagInk;
  ctx.fillText(style.tag, x, y - r * 0.28);
  ctx.font = style.valueFont;
  ctx.fillStyle = style.valueInk;
  ctx.fillText(style.value, x, y + r * 0.72);
  ctx.restore();
}

/* ------------------------------------------------------------ 4 · VESSEL -- */
export interface VesselStyle extends GlyphStyle {
  readonly w: number;
  readonly h: number;
  /** 0..1 — how full */
  readonly level: number;
  readonly levelFill: string;
  /** ground behind the empty part */
  readonly ground?: string;
}

/**
 * A holding vessel with its own outlet, drawn as a tank: square shoulders, a
 * dished bottom, a level line. The gauntlet's rule for the ResonanceRouter is
 * that a deposit STOPS here — the outlet is a separate mechanism, and drawing
 * the deposit flowing straight on through would be a false claim about the
 * contracts. So the shape has to be a vessel, never an elbow.
 *
 * (x, y) is the vessel's top-left. The outlet stub is the caller's line.
 */
export function vessel(ctx: CanvasRenderingContext2D, x: number, y: number, style: VesselStyle): void {
  begin(ctx, style);
  const { w, h } = style;
  const dish = Math.min(w / 2, h * 0.22);

  const shell = new Path2D();
  shell.moveTo(x, y);
  shell.lineTo(x + w, y);
  shell.lineTo(x + w, y + h - dish);
  shell.quadraticCurveTo(x + w, y + h, x + w / 2, y + h);
  shell.quadraticCurveTo(x, y + h, x, y + h - dish);
  shell.closePath();

  if (style.ground !== undefined) {
    ctx.fillStyle = style.ground;
    ctx.fill(shell);
  }

  const lv = Math.max(0, Math.min(1, style.level));
  if (lv > 0) {
    const top = y + h * (1 - lv);
    ctx.save();
    ctx.clip(shell);
    ctx.fillStyle = style.levelFill;
    ctx.fillRect(x, top, w, h);
    ctx.restore();
  }
  ctx.stroke(shell);
}

/* -------------------------------------------------------------- 5 · SINK -- */
/**
 * The terminator. A solid arrow into a bar, with hatching beyond it: what
 * arrives leaves the system and does not come back. The burn is a sink, not a
 * re-entrant flow, and this is the mark that says so.
 */
export function sink(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: GlyphStyle & { readonly barH?: number },
): void {
  const s = begin(ctx, style);
  const h = s / 2;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.62, y - h * 0.68);
  ctx.lineTo(x - s * 0.06, y);
  ctx.lineTo(x - s * 0.62, y + h * 0.68);
  ctx.closePath();
  ctx.fillStyle = style.fill ?? style.ink;
  ctx.fill();

  /* the bar spans the pipe it terminates, so a wide band visibly runs into a
     wall rather than tapering into a symbol */
  const bar = Math.max(s, style.barH ?? 0) / 2;
  ctx.beginPath();
  ctx.moveTo(x, y - bar);
  ctx.lineTo(x, y + bar);
  ctx.stroke();

  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    const yy = y + i * h * 0.62;
    ctx.moveTo(x + s * 0.14, yy - s * 0.16);
    ctx.lineTo(x + s * 0.44, yy + s * 0.16);
  }
  ctx.stroke();
}

/* -------------------------------------------------------------- 6 · NODE -- */
/**
 * The control node — ISA's shared-display/control mark, a circle inscribed in
 * a square. The source of a signal. Nothing quantitative ever leaves it: every
 * line out of a node is a SIGNAL line.
 */
export function node(ctx: CanvasRenderingContext2D, x: number, y: number, style: GlyphStyle): void {
  const s = begin(ctx, style);
  const h = s / 2;
  if (style.fill !== undefined) {
    ctx.fillStyle = style.fill;
    ctx.fillRect(x - h, y - h, s, s);
  }
  ctx.strokeRect(x - h, y - h, s, s);
  ctx.beginPath();
  ctx.arc(x, y, h * 0.72, 0, Math.PI * 2);
  ctx.stroke();
}

/* ------------------------------------------------------------- the index -- */

export type GlyphName = 'VALVE' | 'SPLITTER' | 'TAG' | 'VESSEL' | 'SINK' | 'NODE';

export interface GlyphEntry {
  readonly name: GlyphName;
  /** what a reader is meant to take from it, in one line */
  readonly means: string;
}

/** The six, in the order the legend publishes them. */
export const GLYPHS: readonly GlyphEntry[] = [
  { name: 'VESSEL', means: 'holds — money stops until an outlet opens' },
  { name: 'VALVE', means: 'gates — solid is open, hollow is shut' },
  { name: 'SPLITTER', means: 'divides one flow into several' },
  { name: 'TAG', means: 'a live reading, wired to its mechanism' },
  { name: 'NODE', means: 'a control node — where signal comes from' },
  { name: 'SINK', means: 'terminal — it leaves and does not return' },
];
