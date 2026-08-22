/**
 * lib/models/redeem.ts — redemption, MOVED here from components/sections/Fund.tsx.
 *
 * THE ONE RULE: frozen. `begin` · `finalize` · `nextScheduledBurn` · `redStep`
 * are the bodies that shipped, textually unchanged apart from the mechanical
 * edits the move required:
 *
 *   · the `red` closure object and `burnIdx` became `RedState`
 *     (`red.t` → `s.t`, `burnIdx` → `s.burnIdx`);
 *   · the DOM half of `Hold` (el, amtEl, wellEl, wellCtx, outEl, levelY) left
 *     the model, and every DOM write in `begin` / `finalize` became the
 *     `RedFx` sink.
 *
 * docs/MODELS.md §5 traps, all still true here: the same fraction leaves EVERY
 * holding, never a per-asset choice; the animated phase does not mutate state
 * (the display interpolates with `k`, the decrement happens once at the end);
 * and refills can push `amt` above `base`, so bar widths can exceed 100%.
 */

export const HOLDERS = ['@ava', '@pike', '@juno', '@wren', '@sol', '@bex'];
export const SUPPLY0 = 100000000;
export const TRAVEL = 0.62; /* real seconds a sphere spends on the manifold */

export function amtFmt(v: number): string {
  return v.toFixed(v < 10 ? 4 : 1);
}
export function takenFmt(v: number): string {
  return v.toFixed(v < 10 ? 4 : 2);
}

export interface RedHold {
  sym: string;
  amt: number;
  base: number;
  hue: string;
  grain: number;
}

export interface RedState {
  t: number;
  supply: number;
  next: number;
  phase: 'idle' | 'burn';
  pt: number;
  who: string;
  mine: boolean;
  pct: number;
  burned: number;
  still: boolean;
  taken: number[];
  parts: { i: number; d: number }[];
  /* what the cup holds, PER BAY: the four piles are the proof that the
     same proportion came out of every holding, and they sit under the bay
     each one fell from */
  cupBy: number[];
  cupX: number[];
  holds: RedHold[];
  /* The programme: the reader's own burn first, then an ambient one, and so
     on. Deterministic order, so the headline beat is guaranteed, not lucky. */
  burnIdx: number;
}

export interface RedFx {
  /** a burn opens: the bays and the destination card light up */
  onBegin?: (who: string, mine: boolean, burned: number, pct: number) => void;
  /** the burn settles: the receipt is printed and the bays release */
  onFinalize?: (taken: readonly number[]) => void;
}

export function createRedState(assets: readonly RedHold[]): RedState {
  return {
    t: 0,
    supply: SUPPLY0,
    next: 1.6,
    phase: 'idle',
    pt: 0,
    who: '',
    mine: false,
    pct: 0,
    burned: 0,
    still: false,
    taken: [],
    parts: [],
    cupBy: assets.map(() => 0),
    cupX: [],
    holds: assets.map((a) => ({ sym: a.sym, amt: a.amt, base: a.base, hue: a.hue, grain: a.grain })),
    burnIdx: 0,
  };
}

/* indexed reads under noUncheckedIndexedAccess: taken[] always mirrors
   holds[] (built together in begin()), so a missing slot reads as 0 */
export function takenAt(s: RedState, i: number): number {
  return s.taken[i] ?? 0;
}

export function begin(s: RedState, fx: RedFx, who: string, pct: number): void {
  s.phase = 'burn';
  s.pt = 0;
  s.who = who;
  s.mine = who === '@you';
  s.pct = pct;
  s.burned = s.supply * pct;
  s.taken = s.holds.map((h) => h.amt * pct);
  /* every bay gives up the same proportion at the same instant, so all
     four emit the same count, interleaved — the cup fills with a mix */
  const per = Math.max(3, Math.min(10, Math.round(pct * 70)));
  s.parts = [];
  const total = per * s.holds.length;
  for (let k = 0; k < per; k++) {
    for (let i = 0; i < s.holds.length; i++) {
      const n = s.parts.length;
      s.parts.push({ i, d: (n / Math.max(1, total - 1)) * 0.52 });
    }
  }
  s.cupBy = s.holds.map(() => 0);
  fx.onBegin?.(s.who, s.mine, s.burned, s.pct);
}

export function finalize(s: RedState, fx: RedFx): void {
  s.supply -= s.burned;
  s.holds.forEach((h, i) => {
    h.amt -= takenAt(s, i);
  });
  /* the cup keeps what it received until the next redeemer takes theirs,
     so the vessel and the receipt printed under it never disagree */
  s.cupBy = s.holds.map((_, i) => s.parts.filter((p) => p.i === i).length);
  s.parts = [];
  fx.onFinalize?.(s.taken);
  s.phase = 'idle';
  s.next = s.t + (s.mine ? 4.6 + Math.random() : 3.0 + Math.random() * 0.9);
}

export function nextScheduledBurn(s: RedState, fx: RedFx): void {
  const mine = s.burnIdx % 2 === 0;
  s.burnIdx++;
  if (mine) begin(s, fx, '@you', 0.1);
  else begin(s, fx, HOLDERS[Math.floor(Math.random() * HOLDERS.length)] ?? '@ava', 0.04 + Math.random() * 0.04);
}

export function redStep(s: RedState, rdt: number, fx: RedFx): void {
  s.t += rdt;
  if (s.phase === 'idle') {
    /* between burns the panel is never still: the Strategies keep buying,
       so each holding creeps back toward its pre-burn baseline, and the
       Mine keeps issuing, so the supply ticks steadily back up. */
    const g = 1 - Math.exp(-rdt * 0.13);
    s.holds.forEach((h) => {
      h.amt = Math.min(h.base, h.amt + (h.base - h.amt) * g + h.base * 0.004 * rdt);
    });
    s.supply = Math.min(SUPPLY0, s.supply + (SUPPLY0 - s.supply) * g + 45000 * rdt);
    if (s.t >= s.next) nextScheduledBurn(s, fx);
    return;
  }
  s.pt += rdt;
  const landed = s.holds.map(() => 0);
  s.parts.forEach((p) => {
    if ((s.pt - p.d) / TRAVEL >= 1) landed[p.i] = (landed[p.i] ?? 0) + 1;
  });
  s.cupBy = landed;
  if (s.pt >= 1.5) finalize(s, fx);
}
