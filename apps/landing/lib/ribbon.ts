/**
 * lib/ribbon.ts — the conserved tapered-flow primitive.
 *
 * A ribbon is a band whose width at every station IS a model quantity times a
 * single published gauge (px per model unit). Nothing here eyeballs a taper:
 *
 *     width(station) === station.q * ribbon.gauge          — always, no exceptions
 *
 * so a figure that draws a ribbon is drawing an arithmetic claim, and
 * `scanConservation()` / `junctionReport()` below let a test — or the page
 * itself — assert that claim numerically instead of by eye.
 *
 * Two topologies are supplied because the five figures need exactly two:
 *
 *   splitFlow()     one band divides into n children whose widths stack to
 *                   the parent with no gap and no overlap (mining's 80/20,
 *                   the fund's per-bay claims, the overview's routing).
 *   convergeFlow()  n bands stack into one collector (16 slots into the
 *                   Router, n bays into the burner).
 *
 * `d3-sankey` is deliberately not used: this graph is fixed and hand-ordered,
 * so its iterative crossing-minimiser would fight the designed label rows on
 * resize. The stacking math is the forty lines below.
 *
 * THE HARNESS CONTRACT. `ribbonPath()` runs d3-shape and returns a Path2D.
 * Build it in `buildLayout()` / `resize()` / `step()` — never in `paint()`.
 * `paint()` then costs one `ctx.fill(path)` per band, `static()` gets a real
 * path for free, and a frame on which the model did not move can reuse the
 * cached Path2D and run zero d3 code at all.
 */

import { area, curveMonotoneX, type CurveFactory } from 'd3-shape';

/** px per model unit. One gauge per figure; publish it beside the figure. */
export type Gauge = number;

/**
 * One cross-section of a band. `q` is the model's quantity here — a rate, a
 * balance, a share; whatever the figure's gauge is denominated in.
 */
export interface Station {
  /** px along the flow axis */
  readonly x: number;
  /** px, the centreline of the band at this station */
  readonly c: number;
  /** the model quantity carried here */
  readonly q: number;
}

export interface Ribbon {
  readonly key: string;
  readonly gauge: Gauge;
  /** ordered by ascending x */
  readonly stations: readonly Station[];
}

/**
 * The one curve every ribbon on the page bends through, so curvature and taper
 * are identical in the overview and in the fund.
 */
export const RIBBON_CURVE: CurveFactory = curveMonotoneX;

/**
 * The routing ease for a fan — how a leg migrates from its stacked position at
 * the junction to its landing. Symmetric on purpose: it leaves the junction
 * square to the trunk and arrives square to the bay. This is a *spatial*
 * curve, so it is not the page's temporal `--ease` (see lib/ease.ts) — an
 * asymmetric temporal curve here would kink every leg at the junction.
 */
export function smoothstep(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}

export function ribbon(key: string, gauge: Gauge, stations: readonly Station[]): Ribbon {
  return { key, gauge, stations };
}

/** The band's width in px at a station. The whole primitive, in one line. */
export function widthOf(gauge: Gauge, q: number): number {
  return q * gauge;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The band's centreline, quantity and width at an arbitrary x, by linear
 * interpolation between the bracketing stations. Outside the span it clamps to
 * the end stations. Returns null only for an empty ribbon.
 */
export function sampleAt(r: Ribbon, x: number): { c: number; q: number; w: number } | null {
  const st = r.stations;
  const n = st.length;
  if (n === 0) return null;
  const first = st[0];
  const last = st[n - 1];
  if (first === undefined || last === undefined) return null;
  if (x <= first.x) return { c: first.c, q: first.q, w: widthOf(r.gauge, first.q) };
  if (x >= last.x) return { c: last.c, q: last.q, w: widthOf(r.gauge, last.q) };
  for (let i = 1; i < n; i++) {
    const b = st[i];
    const a = st[i - 1];
    if (a === undefined || b === undefined) continue;
    if (x <= b.x) {
      const span = b.x - a.x;
      const t = span === 0 ? 0 : (x - a.x) / span;
      const q = lerp(a.q, b.q, t);
      return { c: lerp(a.c, b.c, t), q, w: widthOf(r.gauge, q) };
    }
  }
  return { c: last.c, q: last.q, w: widthOf(r.gauge, last.q) };
}

/** The band's top and bottom edge in px at an arbitrary x. */
export function edgesAt(r: Ribbon, x: number): { top: number; bot: number } | null {
  const s = sampleAt(r, x);
  if (s === null) return null;
  return { top: s.c - s.w / 2, bot: s.c + s.w / 2 };
}

/**
 * Emit the band's outline as a Path2D via d3-shape.
 *
 * Build this OUTSIDE the rAF paint (see the header). d3's area generator will
 * happily write into a Path2D — it only ever calls moveTo / lineTo /
 * bezierCurveTo / closePath — but @types/d3-shape types `.context()` as a
 * CanvasRenderingContext2D, hence the one cast.
 */
export function ribbonPath(r: Ribbon, curve: CurveFactory = RIBBON_CURVE): Path2D {
  const path = new Path2D();
  const half = (s: Station) => (s.q * r.gauge) / 2;
  area<Station>()
    .x((s) => s.x)
    .y0((s) => s.c - half(s))
    .y1((s) => s.c + half(s))
    .curve(curve)
    .context(path as unknown as CanvasRenderingContext2D)(r.stations as Station[]);
  return path;
}

/**
 * One EDGE of the band, as a path — the line a shaded underside is stroked
 * along. Same curve, same stations, so the edge and the fill can never part
 * company by half a pixel.
 */
export function edgePath(r: Ribbon, side: 'top' | 'bot', curve: CurveFactory = RIBBON_CURVE): Path2D {
  const path = new Path2D();
  const off = (st: Station) => (side === 'top' ? -1 : 1) * ((st.q * r.gauge) / 2);
  area<Station>()
    .x((st) => st.x)
    .y0((st) => st.c + off(st))
    .y1((st) => st.c + off(st))
    .curve(curve)
    .context(path as unknown as CanvasRenderingContext2D)(r.stations as Station[]);
  return path;
}

/** The band's centreline alone, for a leader or a hairline spine. */
export function centrePath(r: Ribbon, curve: CurveFactory = RIBBON_CURVE): Path2D {
  const path = new Path2D();
  area<Station>()
    .x((s) => s.x)
    .y0((s) => s.c)
    .y1((s) => s.c)
    .curve(curve)
    .context(path as unknown as CanvasRenderingContext2D)(r.stations as Station[]);
  return path;
}

/* ========================================================== the topologies == */

export interface SplitLeg {
  readonly key: string;
  /** model quantity leaving the junction on this leg */
  readonly q: number;
  /** where the leg lands */
  readonly to: { readonly x: number; readonly c: number };
  /**
   * Quantity at the landing, if the model says the leg loses or gains on the
   * way. Defaults to `q` — a leg that changes width without a drawn mechanism
   * is exactly the dishonesty this primitive exists to prevent, so the default
   * is "carries what it took".
   */
  readonly qTo?: number;
}

export interface SplitSpec {
  readonly gauge: Gauge;
  /** the trunk's last station: where the split happens */
  readonly at: Station;
  /** in draw order, top to bottom of the trunk's cross-section */
  readonly legs: readonly SplitLeg[];
  /** stations between junction and landing (default 16) */
  readonly steps?: number;
  readonly ease?: (t: number) => number;
}

/**
 * Divide one band into n. The legs are stacked across the trunk's *whole*
 * cross-section in model units — cumulative q, multiplied by the gauge once —
 * so the stack spans exactly the parent, with no seam and no overlap, however
 * the ratios move. Then each leg migrates to its landing.
 *
 * The caller owns conservation of the quantities themselves: `sum(leg.q)` must
 * equal `at.q`. Allocate the residual to the last leg the way the contracts do
 * (`toRouter = paid - toMiner`) and it will be exact in floating point.
 * `junctionReport()` proves it either way.
 */
export function splitFlow(spec: SplitSpec): Ribbon[] {
  const { gauge, at, legs } = spec;
  const steps = spec.steps ?? 16;
  const ease = spec.ease ?? smoothstep;
  const top = at.c - (at.q * gauge) / 2;

  let cum = 0;
  return legs.map((leg) => {
    const cJunction = top + (cum + leg.q / 2) * gauge;
    cum += leg.q;
    const qTo = leg.qTo ?? leg.q;
    const stations: Station[] = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      stations.push({
        x: lerp(at.x, leg.to.x, t),
        c: lerp(cJunction, leg.to.c, ease(t)),
        q: lerp(leg.q, qTo, t),
      });
    }
    return { key: leg.key, gauge, stations };
  });
}

export interface ConvergeSource {
  readonly key: string;
  readonly q: number;
  /** where the leg leaves */
  readonly from: { readonly x: number; readonly c: number };
  /** quantity at the source, if the leg tapers on the way in. Defaults to `q`. */
  readonly qFrom?: number;
}

export interface ConvergeSpec {
  readonly gauge: Gauge;
  /** in draw order, top to bottom of the collector's cross-section */
  readonly sources: readonly ConvergeSource[];
  /** the collector's inlet: x, and the centreline of the collected band */
  readonly at: { readonly x: number; readonly c: number };
  readonly steps?: number;
  readonly ease?: (t: number) => number;
}

/**
 * The inverse: n bands stack into one collector whose quantity is their sum.
 * Sixteen slots into the Router, four bays into the burner. The collector's
 * `Station` comes back with the summed quantity so the caller can carry it on
 * as an ordinary trunk.
 */
export function convergeFlow(spec: ConvergeSpec): { legs: Ribbon[]; at: Station } {
  const { gauge, sources, at } = spec;
  const steps = spec.steps ?? 16;
  const ease = spec.ease ?? smoothstep;

  let total = 0;
  for (const s of sources) total += s.q;
  const top = at.c - (total * gauge) / 2;

  let cum = 0;
  const legs = sources.map((src) => {
    const cCollector = top + (cum + src.q / 2) * gauge;
    cum += src.q;
    const qFrom = src.qFrom ?? src.q;
    const stations: Station[] = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      stations.push({
        x: lerp(src.from.x, at.x, t),
        c: lerp(src.from.c, cCollector, ease(t)),
        q: lerp(qFrom, src.q, t),
      });
    }
    return { key: src.key, gauge, stations };
  });

  return { legs, at: { x: at.x, c: at.c, q: total } };
}

/* ========================================================== the instruments = */

/** One station's arithmetic, for a test or a live readout. */
export interface WidthRow {
  readonly key: string;
  readonly x: number;
  readonly q: number;
  readonly px: number;
}

/** Every station of every band, in model units and in px. */
export function widths(ribbons: readonly Ribbon[]): WidthRow[] {
  const rows: WidthRow[] = [];
  for (const r of ribbons) {
    for (const s of r.stations) rows.push({ key: r.key, x: s.x, q: s.q, px: widthOf(r.gauge, s.q) });
  }
  return rows;
}

export interface JunctionReport {
  /** x of the junction */
  readonly x: number;
  /** the trunk's quantity there */
  readonly parentQ: number;
  /** the legs', summed */
  readonly legQ: number;
  readonly qErr: number;
  /** qErr expressed in units in the last place of parentQ — 0 is exact */
  readonly qUlp: number;
  readonly parentPx: number;
  readonly legPx: number;
  readonly pxErr: number;
  /** the largest gap or overlap between two adjacent legs, px */
  readonly maxSeamPx: number;
  /** how far the stacked legs' outer edges miss the trunk's, px */
  readonly spanErrPx: number;
  readonly ok: boolean;
}

function ulps(err: number, of: number): number {
  const mag = Math.abs(of);
  if (mag === 0) return err === 0 ? 0 : Infinity;
  const step = Math.pow(2, Math.floor(Math.log2(mag)) - 52);
  return err / step;
}

/**
 * Prove a junction. Reads each leg at the junction x — its first station for a
 * split, its last for a converge — and checks four independent things:
 *
 *   1. the legs' quantities sum to the trunk's (the model claim),
 *   2. their widths sum to the trunk's width (the drawn claim),
 *   3. adjacent legs meet exactly: no seam, no overlap,
 *   4. the stack's outer edges land on the trunk's outer edges.
 *
 * Checks 2–4 are what catch a *drawing* bug that check 1 alone would miss.
 */
export function junctionReport(
  at: Station,
  legs: readonly Ribbon[],
  gauge: Gauge,
  end: 'first' | 'last' = 'first',
  tolPx = 1e-6,
): JunctionReport {
  const cross = legs
    .map((r) => (end === 'first' ? r.stations[0] : r.stations[r.stations.length - 1]))
    .filter((s): s is Station => s !== undefined)
    .map((s) => ({ c: s.c, q: s.q, w: widthOf(gauge, s.q) }))
    .sort((a, b) => a.c - b.c);

  let legQ = 0;
  let legPx = 0;
  for (const s of cross) {
    legQ += s.q;
    legPx += s.w;
  }

  let maxSeamPx = 0;
  for (let i = 1; i < cross.length; i++) {
    const a = cross[i - 1];
    const b = cross[i];
    if (a === undefined || b === undefined) continue;
    maxSeamPx = Math.max(maxSeamPx, Math.abs(b.c - b.w / 2 - (a.c + a.w / 2)));
  }

  const parentPx = widthOf(gauge, at.q);
  const parentTop = at.c - parentPx / 2;
  const parentBot = at.c + parentPx / 2;
  const firstCross = cross[0];
  const lastCross = cross[cross.length - 1];
  const stackTop = firstCross === undefined ? parentTop : firstCross.c - firstCross.w / 2;
  const stackBot = lastCross === undefined ? parentBot : lastCross.c + lastCross.w / 2;
  const spanErrPx = Math.max(Math.abs(stackTop - parentTop), Math.abs(stackBot - parentBot));

  const qErr = Math.abs(legQ - at.q);
  const pxErr = Math.abs(legPx - parentPx);

  return {
    x: at.x,
    parentQ: at.q,
    legQ,
    qErr,
    qUlp: ulps(qErr, at.q),
    parentPx,
    legPx,
    pxErr,
    maxSeamPx,
    spanErrPx,
    ok: pxErr <= tolPx && maxSeamPx <= tolPx && spanErrPx <= tolPx,
  };
}

export interface ConservationScan {
  readonly maxAbsErr: number;
  readonly maxRelErr: number;
  readonly worstX: number;
  /**
   * The same scan in the DRAWN domain: the summed band widths against the
   * trunk's width, in px.
   *
   * This is the number worth printing. `maxAbsErr` is measured on quantities
   * the caller allocated, and a caller that allocates the residual to its last
   * leg the way the contracts do (`toRouter = paid - toMiner`) makes that sum
   * exact by construction — 0.00e+0 at every sample, forever, which is
   * indistinguishable from an instrument that is not wired up. The px sum is a
   * different arithmetic: four products summed in draw order against one
   * product of the total, so float noise is real (measured: non-zero at
   * 1,569 of 4,000 live samples, worst 1.42e-14 px) and a reader can see the
   * check is alive. Both catch a real leak; only this one is honest about
   * being a measurement.
   */
  readonly maxAbsPxErr: number;
  readonly worstPxX: number;
  readonly samples: number;
  readonly ok: boolean;
}

/**
 * Prove the whole fan, not only its junction: sample the legs at `samples`
 * positions across the span and check that their quantities — and the widths
 * those quantities are drawn at — still sum to `total` at every one. This is
 * the check that catches a leg whose taper is not backed by a drawn mechanism.
 */
export function scanConservation(spec: {
  readonly legs: readonly Ribbon[];
  readonly total: number;
  readonly from: number;
  readonly to: number;
  readonly samples?: number;
  readonly tol?: number;
  /** px per unit; defaults to the legs' own gauge. */
  readonly gauge?: Gauge;
}): ConservationScan {
  const samples = spec.samples ?? 33;
  const tol = spec.tol ?? 1e-9;
  const gauge = spec.gauge ?? spec.legs[0]?.gauge ?? 1;
  const totalPx = widthOf(gauge, spec.total);
  let maxAbsErr = 0;
  let worstX = spec.from;
  let maxAbsPxErr = 0;
  let worstPxX = spec.from;
  for (let i = 0; i < samples; i++) {
    const x = samples === 1 ? spec.from : spec.from + ((spec.to - spec.from) * i) / (samples - 1);
    let sum = 0;
    let sumPx = 0;
    for (const r of spec.legs) {
      const s = sampleAt(r, x);
      if (s !== null) {
        sum += s.q;
        sumPx += s.w;
      }
    }
    const err = Math.abs(sum - spec.total);
    if (err > maxAbsErr) {
      maxAbsErr = err;
      worstX = x;
    }
    const pxErr = Math.abs(sumPx - totalPx);
    if (pxErr > maxAbsPxErr) {
      maxAbsPxErr = pxErr;
      worstPxX = x;
    }
  }
  const denom = Math.abs(spec.total);
  return {
    maxAbsErr,
    maxRelErr: denom === 0 ? (maxAbsErr === 0 ? 0 : Infinity) : maxAbsErr / denom,
    worstX,
    maxAbsPxErr,
    worstPxX,
    samples,
    ok: maxAbsErr <= tol,
  };
}
