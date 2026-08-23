/**
 * lib/ease.ts — canvas motion on the page's own easing tokens.
 *
 * The five figures used to ease with hand-rolled cubics that did not match
 * `--ease`, so a canvas beat and the CSS transition beside it arrived on
 * different curves. This binds `bezier-easing` to the tokens themselves.
 *
 * The token is READ AT RUNTIME, the way `fontFamily()` in lib/harness.ts reads
 * `--font-mono`, so a re-cut of `--ease` in globals.css moves canvas motion
 * with it and the specimen's §09 comb keeps describing what the canvases do.
 * It is read **once per token and memoised**: `getComputedStyle` forces a
 * style recalculation, which must never happen inside a frame. Resolution is
 * lazy, so importing this module is SSR-safe.
 *
 * The literals below are the fallback for SSR and for a first call made before
 * the stylesheet has landed; they are the current token values, and
 * `easingSource()` reports whether the live curve came from the token or from
 * the fallback so a specimen can print which one it is using.
 */

import BezierEasing from 'bezier-easing';

export type Curve = readonly [number, number, number, number];

/** The tokens this module knows, and their values in app/globals.css. */
export const EASE_TOKENS = {
  '--ease': [0.2, 0.6, 0.2, 1] as Curve,
  '--ease-out': [0.16, 1, 0.3, 1] as Curve,
} as const;

export type EaseToken = keyof typeof EASE_TOKENS;

interface Resolved {
  readonly fn: (t: number) => number;
  readonly curve: Curve;
  readonly source: 'token' | 'fallback';
}

const cache = new Map<EaseToken, Resolved>();

function parseCubicBezier(value: string): Curve | null {
  const inner = /^cubic-bezier\(([^)]*)\)$/.exec(value.trim())?.[1];
  if (inner === undefined) return null;
  const parts = inner.split(',').map((s) => Number(s.trim()));
  const [a, b, c, d] = parts;
  if (parts.length !== 4 || a === undefined || b === undefined || c === undefined || d === undefined) return null;
  if (![a, b, c, d].every(Number.isFinite)) return null;
  return [a, b, c, d];
}

function resolve(token: EaseToken): Resolved {
  const hit = cache.get(token);
  if (hit !== undefined) return hit;

  const fallback = EASE_TOKENS[token];
  let curve = fallback;
  let source: 'token' | 'fallback' = 'fallback';
  if (typeof document !== 'undefined') {
    const read = parseCubicBezier(getComputedStyle(document.documentElement).getPropertyValue(token));
    if (read !== null) {
      curve = read;
      source = 'token';
    }
  }
  const fn = BezierEasing(curve[0], curve[1], curve[2], curve[3]);
  const out: Resolved = { fn, curve, source };
  cache.set(token, out);
  return out;
}

/** The easing function for a token. Memoised; safe to call per frame. */
export function easing(token: EaseToken): (t: number) => number {
  return resolve(token).fn;
}

/** The four control points actually in force, for a legend or a report. */
export function easingCurve(token: EaseToken): Curve {
  return resolve(token).curve;
}

/** 'token' if the live stylesheet supplied the curve, 'fallback' otherwise. */
export function easingSource(token: EaseToken): 'token' | 'fallback' {
  return resolve(token).source;
}

/** `--ease` — cubic-bezier(.2,.6,.2,1). The standard curve: state changes. */
export function ease(t: number): number {
  return resolve('--ease').fn(t);
}

/** `--ease-out` — cubic-bezier(.16,1,.3,1). Entrances and arrivals. */
export function easeOut(t: number): number {
  return resolve('--ease-out').fn(t);
}

/** 0 below `a`, 1 above `b`, eased in between. The workhorse for a sim beat. */
export function ramp(t: number, a: number, b: number, curve: (u: number) => number = ease): number {
  if (b <= a) return t >= b ? 1 : 0;
  const u = (t - a) / (b - a);
  return curve(u < 0 ? 0 : u > 1 ? 1 : u);
}

/** Drop the memoised curves — only for a test that re-cuts the tokens. */
export function resetEasingCache(): void {
  cache.clear();
}
