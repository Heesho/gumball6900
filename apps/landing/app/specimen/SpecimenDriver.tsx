'use client';

import { useEffect, useLayoutEffect } from 'react';
import { fontFamily, registerSim, startHarness } from '../../lib/harness';
import { SIGNAL, node, setStroke, sink, splitter, tag, valve, vessel } from '../../lib/isa';
import { ASSETS, USDG, drawLegend, legendFonts, readInk } from '../../lib/legend';
import { ramp } from '../../lib/ease';
import {
  centrePath,
  convergeFlow,
  junctionReport,
  ribbonPath,
  sampleAt,
  scanConservation,
  splitFlow,
  type Ribbon,
  type Station,
} from '../../lib/ribbon';

/* ============================================================================
   The specimen's four live instruments.

   A design system that documents motion in a table has not specified it, and a
   panel labelled LIVE MODEL that never changes a digit is the one thing this
   project cannot ship. So §05's board runs a real model, and §09's two curves
   and two event classes run themselves.

   Everything here goes through the same driver the site uses
   (lib/harness.ts): one rAF loop, IntersectionObserver pausing, a single
   meaningful static pass under prefers-reduced-motion, and registration from a
   layout effect so React StrictMode's double-invoke is idempotent. Every timer
   and every listener is cleared on cleanup.

   The page itself stays a server component: the opening state of every value
   below is in the server HTML, and the first paint reproduces it exactly, so
   nothing moves under the reader on hydration.
   ========================================================================== */

/* ------------------------------------------------------- 05 · the board -- */
/* Bound by Mine.sol exactly as components/sections/Mining.tsx is: a linear
   decay to zero over PRICE_DECAY_PERIOD, an 80% pull claim plus 20% Router
   deposit on an occupied slot, a 100% Router deposit on a never-taken one, the
   next price at paid ×2 with the $1 floor, and a per-slot rate locked for the
   tenure. The specimen shows illustrative market activity in Mine's first era. */
const DECAY = 3600; // Mine.PRICE_DECAY_PERIOD, seconds
const MINER_BPS = 8000; // Mine.PREVIOUS_MINER_BPS
const BPS = 10000;
const MULT = 2; // Mine.PRICE_MULTIPLIER
const MIN_PRICE = 1; // Mine.MINIMUM_INITIAL_PRICE = 1e6 raw USDG
const SLOT_TPS = 64 / 16; // Mine.INITIAL_TPS divided across sixteen first-era tenures
const BOARD_SCALE = 90; // one modelled hour ≈ 40s on the wall
const DWELL = 240; // no slot changes hands inside its first four minutes

// Twenty minutes after the simulated Mine start — the clock printed in the
// server HTML. This keeps the never-taken $1 auction in a reachable state.
const CLOCK_BASE = 20 * 60;

const NAMES = ['ava', 'kai', 'rin', 'moss', 'juno', 'pike', 'wren', 'isla', 'odin', 'nix', 'sol', 'vega'];

interface Slot {
  owner: string | null;
  initialPrice: number;
  startedAt: number;
  reserve: number;
}

/* The opening board, chosen so that price === initialPrice × (1 − frac) and
   bar === frac reproduce the four prices and four bar widths already printed
   in the server HTML at t = 0. Each slot carries its own reservation, so the
   four never come up for sale together. */
const OPENING: Slot[] = [
  { owner: 'odin', initialPrice: 19.868, startedAt: -0.22 * DECAY, reserve: 5.07 },
  { owner: 'kai', initialPrice: 17.983, startedAt: -0.12 * DECAY, reserve: 5.66 },
  { owner: null, initialPrice: MIN_PRICE, startedAt: -CLOCK_BASE, reserve: 0.5 },
  { owner: 'wren', initialPrice: 20.566, startedAt: -0.18 * DECAY, reserve: 6.89 },
];
const OPENING_ROUTER = 18.65;
const OPENING_PAID = 38.09;
const OPENING_MINTED = 1240;

/** Deterministic per-tenure reservations: reproducible frames, no lockstep. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function money(n: number): string {
  return '$' + n.toFixed(2);
}
function gbx(n: number): string {
  return n >= 1000 ? Math.round(n).toLocaleString('en-US') : n.toFixed(1);
}

interface CellEls {
  root: HTMLElement;
  owner: HTMLElement;
  price: HTMLElement;
  bar: HTMLElement;
  sub: HTMLElement;
}

function readCells(): CellEls[] | null {
  const out: CellEls[] = [];
  for (let i = 1; i <= 4; i++) {
    const root = document.getElementById('sp-cell-' + i);
    const owner = root?.querySelector<HTMLElement>('.cell__owner');
    const price = root?.querySelector<HTMLElement>('.cell__price');
    const bar = root?.querySelector<HTMLElement>('.meter > i');
    const sub = root?.querySelector<HTMLElement>('.cell__sub');
    if (!root || !owner || !price || !bar || !sub) return null;
    out.push({ root, owner, price, bar, sub });
  }
  return out;
}

function mountBoard(): (() => void) | null {
  const panel = document.getElementById('sp-panel');
  const cells = readCells();
  const clockEl = document.getElementById('sp-clock');
  const evtEl = document.getElementById('sp-evtline');
  const tFund = document.getElementById('sp-t-fund');
  const tPaid = document.getElementById('sp-t-paid');
  const tGbx = document.getElementById('sp-t-gbx');
  if (!panel || !cells || !clockEl || !evtEl || !tFund || !tPaid || !tGbx) return null;
  // Narrowed once, into one bag: the functions below are hoisted declarations,
  // which do not inherit the narrowing from the guard above.
  const els = { cells, clockEl, evtEl, tFund, tPaid, tGbx };

  const slots: Slot[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  let rnd = lcg(0x6900);
  let t = 0;
  let routerDeposits = 0;
  let paidOut = 0;
  let minted = 0;
  let evtText = '';
  let silent = false; // the static pass replays the model without lighting it up

  function seed(): void {
    slots.length = 0;
    OPENING.forEach((s) => slots.push({ ...s }));
    rnd = lcg(0x6900);
    t = 0;
    routerDeposits = OPENING_ROUTER;
    paidOut = OPENING_PAID;
    minted = OPENING_MINTED;
    evtText = '';
    els.cells.forEach((c, i) => {
      c.root.classList.remove('evt-blue');
      c.root.classList.toggle('cell--open', slots[i]?.owner == null);
      c.owner.classList.toggle('cell__owner--open', slots[i]?.owner == null);
    });
  }
  seed();

  function priceOf(slot: Slot): number {
    const elapsed = t - slot.startedAt;
    if (elapsed >= DECAY) return 0;
    return slot.initialPrice * (1 - elapsed / DECAY);
  }

  /* ~1s of visible consequence, then the class comes back off — a lit state
     that is never removed is a lit state that stays lit forever. */
  function flash(cell: CellEls): void {
    cell.root.classList.remove('evt-blue');
    void cell.root.offsetWidth;
    cell.root.classList.add('evt-blue');
    const timer = setTimeout(() => {
      cell.root.classList.remove('evt-blue');
      const at = timers.indexOf(timer);
      if (at !== -1) timers.splice(at, 1);
    }, 1100);
    timers.push(timer);
  }

  function take(i: number): void {
    const slot = slots[i];
    const cell = els.cells[i];
    if (!slot || !cell) return;

    const paid = priceOf(slot);
    const displaced = slot.owner;

    // Settle the outgoing tenure: its accrual mints to the displaced miner.
    let accrued = 0;
    if (displaced !== null) {
      accrued = (t - slot.startedAt) * SLOT_TPS;
      minted += accrued;
    }

    // Allocate the payment. A never-taken slot has no prior-miner claim, so
    // Mine deposits the whole nonzero payment in ResonanceRouter.
    let toMiner = 0;
    let toRouter = 0;
    if (paid > 0) {
      if (displaced === null) {
        toRouter = paid;
      } else {
        toMiner = (paid * MINER_BPS) / BPS;
        toRouter = paid - toMiner;
      }
      routerDeposits += toRouter;
      paidOut += toMiner;
    }

    const buyer = NAMES[Math.floor(rnd() * NAMES.length)] ?? 'ava';
    slot.owner = buyer;
    slot.initialPrice = Math.max(paid * MULT, MIN_PRICE);
    slot.startedAt = t;
    slot.reserve = slot.initialPrice * (0.3 + rnd() * 0.55);

    evtText = displaced
      ? 'slot ' +
        pad2(i + 1) +
        ' retaken at ' +
        money(paid) +
        ' — 80% claim ' +
        money(toMiner) +
        ' for @' +
        displaced +
        ', 20% ' +
        money(toRouter) +
        ' deposited in ResonanceRouter. ' +
        gbx(accrued) +
        ' GBX minted to @' +
        displaced +
        '.'
      : 'slot ' +
        pad2(i + 1) +
        ' taken for the first time at ' +
        money(paid) +
        ' — no one to displace, so 100% ' +
        money(toRouter) +
        ' deposited in ResonanceRouter.';

    // The open cell has just stopped being open; the chrome must follow.
    cell.root.classList.remove('cell--open');
    cell.owner.classList.remove('cell__owner--open');
    if (!silent) flash(cell);
  }

  function step(dt: number): void {
    t += dt;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;
      if (t - slot.startedAt > DWELL && priceOf(slot) <= slot.reserve) take(i);
    }
  }

  function paint(): void {
    for (let i = 0; i < els.cells.length; i++) {
      const slot = slots[i];
      const cell = els.cells[i];
      if (!slot || !cell) continue;
      const frac = Math.min(1, Math.max(0, (t - slot.startedAt) / DECAY));
      cell.owner.textContent = slot.owner === null ? 'open' : '@' + slot.owner;
      cell.price.textContent = money(priceOf(slot));
      // The meter is a CLOCK: empty when the tenure starts, full at the hour,
      // by which point the price has decayed to zero.
      cell.bar.style.width = (frac * 100).toFixed(1) + '%';
      cell.sub.textContent =
        slot.owner === null ? 'never taken · 0/h' : ((t - slot.startedAt) * SLOT_TPS).toFixed(1) + ' GBX · 14,400/h';
    }
    const total = CLOCK_BASE + t;
    els.clockEl.textContent =
      'day ' +
      Math.floor(total / 86400) +
      ', ' +
      pad2(Math.floor((total % 86400) / 3600)) +
      ':' +
      pad2(Math.floor((total % 3600) / 60));
    els.evtEl.textContent = evtText || 'waiting — no slot has reached a taker’s reservation yet.';
    els.tFund.textContent = money(routerDeposits);
    els.tPaid.textContent = money(paidOut);
    els.tGbx.textContent = gbx(minted);
  }

  const unregister = registerSim({
    name: 'specimen-board',
    el: panel,
    timeScale: BOARD_SCALE,
    step,
    paint,
    reset: () => {
      seed();
      paint();
    },
    // A still that has already been somewhere: fifteen modelled minutes in,
    // one slot has changed hands, and the tallies and the event line carry it.
    static: () => {
      silent = true;
      seed();
      for (let n = 0; n < 90; n++) step(10);
      paint();
      silent = false;
    },
  });

  return () => {
    unregister();
    timers.splice(0).forEach(clearTimeout);
  };
}

/* ------------------------------------------------- 09 · the two curves --- */
/* Travel, then a short park. The park used to be 1400ms of a 2400ms cycle, so
   58% of every cycle showed two dots stopped in the same place — which is why
   a still of this figure, and its reduced-motion frame, taught nothing at all.
   600ms is long enough to read the arrival and short enough that travel
   dominates the cycle.

   The comb is what makes the comparison survive being frozen. Both curves end
   in the same place, so the dots can only be told apart while they are moving;
   the ticks record WHERE the dot was at every 100ms of the travel, and those
   two patterns differ from the first tick on. They are solved from the same
   custom property the CSS transition reads — the element's own --curve, whose
   computed value is the substituted value of --ease / --ease-out — so the comb
   cannot drift away from the token the way a hardcoded table of positions
   would. If the token is ever re-cut, the comb moves with it. */
const TRACK_TRAVEL = 1.0; // seconds; the same span as --t-event
const TRACK_PARK = 0.6;
const TRACK_CYCLE = TRACK_TRAVEL + TRACK_PARK;
const TICK_STEP = 0.1; // one tick per 100ms of travel
const TICK_COUNT = Math.round(TRACK_TRAVEL / TICK_STEP);

type Curve = [number, number, number, number];

/** The 1D cubic bezier with the endpoints CSS fixes at 0 and 1. */
function bez1(a: number, b: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

/** Progress of a cubic-bezier easing at time fraction x. Bisection, because
 *  it runs ten times per rail at mount and never again. */
function easeAt(c: Curve, x: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bez1(c[0], c[2], mid) < x) lo = mid;
    else hi = mid;
  }
  return bez1(c[1], c[3], (lo + hi) / 2);
}

/** The element's own --curve, resolved. Returns null rather than guessing: a
 *  comb drawn from the wrong curve would be worse than no comb, and the drawn
 *  plot beside each rail still carries the shape. */
function readCurve(el: HTMLElement): Curve | null {
  const inner = /^cubic-bezier\(([^)]*)\)$/.exec(getComputedStyle(el).getPropertyValue('--curve').trim())?.[1];
  if (inner === undefined) return null;
  const n = inner.split(',').map((s) => Number(s.trim()));
  const [a, b, c, d] = n;
  if (n.length !== 4 || a === undefined || b === undefined || c === undefined || d === undefined) return null;
  return [a, b, c, d].every(Number.isFinite) ? [a, b, c, d] : null;
}

function mountTracks(): (() => void) | null {
  const root = document.getElementById('sp-tracks');
  if (!root) return null;
  const tracks = Array.from(root.querySelectorAll<HTMLElement>('.sp-track'));
  if (tracks.length === 0) return null;

  /* Placed once, from the token. The ticks ship in the server HTML but stay
     at opacity 0 until they carry a real position, so the pre-hydration frame
     never shows ten of them stacked on the start line. */
  const combs = tracks.map((el) => {
    const ticks = Array.from(el.querySelectorAll<HTMLElement>('.sp-track__comb i'));
    const curve = readCurve(el);
    if (curve === null) return [];
    ticks.forEach((tick, k) => {
      tick.style.left = (easeAt(curve, ((k + 1) * TICK_STEP) / TRACK_TRAVEL) * 100).toFixed(3) + '%';
      tick.classList.add('is-set');
    });
    return ticks;
  });

  let lit = -1;
  const setLit = (n: number): void => {
    if (n === lit) return;
    lit = n;
    combs.forEach((ticks) => ticks.forEach((tick, k) => tick.classList.toggle('is-lit', k < n)));
  };

  const send = (): void => {
    tracks.forEach((el) => {
      el.classList.add('is-snap');
      el.classList.remove('is-out');
      void el.offsetWidth; // park at the start line with transitions off
      el.classList.remove('is-snap');
      el.classList.add('is-out');
    });
  };

  let t = TRACK_CYCLE; // fire on the first frame the section is on screen
  return registerSim({
    name: 'specimen-tracks',
    el: root,
    step: (dt) => {
      t += dt;
      if (t >= TRACK_CYCLE) {
        t -= TRACK_CYCLE;
        send();
        setLit(0);
      }
      setLit(Math.min(TICK_COUNT, Math.floor(t / TICK_STEP)));
    },
    reset: () => {
      t = TRACK_CYCLE;
      setLit(0);
    },
    /* The still that has to do the teaching: both dots at the end of travel —
       where they always end up together — and both combs fully lit, which is
       the entire comparison, standing still. */
    static: () => {
      tracks.forEach((el) => {
        el.classList.remove('is-snap');
        el.classList.add('is-out');
      });
      setLit(TICK_COUNT);
    },
  });
}

/* ------------------------------------------- 09 · the two event classes -- */
const EVT_CYCLE = 3; // seconds
/* Offsets are 700ms apart so the four never fire in lockstep, and none of them
   sits at 0: the crossing test below is `prev < at && t >= at`, which a zero
   offset can never satisfy once the cycle has wrapped. */
const EVT_PLAN = [
  { id: 'sp-evt-1', at: 0.3, cls: 'evt-blue' },
  { id: 'sp-evt-2', at: 1.0, cls: 'evt-pink' },
  { id: 'sp-evt-3', at: 1.7, cls: 'evt-blue' },
  { id: 'sp-evt-4', at: 2.4, cls: 'evt-pink' },
];

function mountEvents(): (() => void) | null {
  const root = document.getElementById('sp-evts');
  if (!root) return null;

  const parts = EVT_PLAN.map((plan) => {
    const el = document.getElementById(plan.id);
    const state = el?.querySelector<HTMLElement>('.sp-evt__s');
    return el && state ? { ...plan, el, state } : null;
  });
  if (parts.some((p) => p === null)) return null;
  const swatches = parts as NonNullable<(typeof parts)[number]>[];

  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  const listeners: (() => void)[] = [];

  const clear = (el: HTMLElement, state: HTMLElement, cls: string): void => {
    el.classList.remove(cls);
    state.textContent = 'cleared';
    const timer = timers.get(el);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(el);
    }
  };

  swatches.forEach(({ el, state, cls }) => {
    const onEnd = (): void => clear(el, state, cls);
    el.addEventListener('animationend', onEnd);
    listeners.push(() => el.removeEventListener('animationend', onEnd));
  });

  const fire = (el: HTMLElement, state: HTMLElement, cls: string): void => {
    el.classList.remove('is-held-blue', 'is-held-pink', cls);
    void el.offsetWidth;
    el.classList.add(cls);
    state.textContent = 'firing';
    const prev = timers.get(el);
    if (prev !== undefined) clearTimeout(prev);
    // animationend does the work; this is only the belt for the braces.
    timers.set(
      el,
      setTimeout(() => clear(el, state, cls), 1400),
    );
  };

  let t = 0;
  const unregister = registerSim({
    name: 'specimen-events',
    el: root,
    step: (dt) => {
      const prev = t;
      t += dt;
      swatches.forEach(({ at, el, state, cls }) => {
        if (prev < at && t >= at) fire(el, state, cls);
      });
      if (t >= EVT_CYCLE) t -= EVT_CYCLE;
    },
    // Both halves of the contract, side by side: two swatches held at the
    // first frame of the flash, two showing what the element looks like once
    // the class has come back off.
    static: () => {
      swatches.forEach(({ el, state, cls }, i) => {
        el.classList.remove('evt-blue', 'evt-pink', 'is-held-blue', 'is-held-pink');
        if (i < 2) {
          el.classList.add(cls === 'evt-blue' ? 'is-held-blue' : 'is-held-pink');
          state.textContent = 'firing';
        } else {
          state.textContent = 'cleared';
        }
      });
    },
  });

  return () => {
    unregister();
    listeners.forEach((off) => off());
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  };
}

/* ---------------------------------------------- 10 · the flow grammar ---- */
/* The shared vocabulary, running, so the specimen shows the grammar rather
   than describing it. One charge of capital arrives in a vessel, is released
   through a valve, divided by a splitter into four bays in a ratio a control
   signal sets, held there, then claimed back out pro-rata through a collector
   into a terminal sink. Every band's width is `quantity x gauge` and nothing
   else, which is what the two checks under the figure prove live.

   Quantities are illustrative and in one unit: this figure demonstrates the
   drawing grammar, and makes no protocol claim. The models that DO make
   protocol claims are frozen and live in components/sections.

   Idle policy — the thing an accumulating figure most often gets wrong: this
   one never idles into a state its own arithmetic cannot explain. The vessel
   holds a finite charge, the bays are emptied by a drawn claim, and the next
   charge ARRIVES as a drawn band rather than appearing between frames. The
   balance `charged = vessel + bays + claimed` therefore holds at every instant
   of every cycle, not only while a script is running. */

const GR_CHARGE = 120; /* units in one charge */
const GR_IN_RATE = 30; /* units/s arriving while the vessel charges */
const GR_OUT_RATE = 20; /* units/s leaving the vessel while it fills the bays */
const GR_CLAIM_S = 6; /* seconds to claim every bay back to zero */
const GR_BAY_FULL = 40; /* units — the published top of the bay axis */
const GR_WEIGHT_PERIOD = 9; /* s — how long the control signal takes to rotate */

const GR_T_CHARGE = GR_CHARGE / GR_IN_RATE; /* 4 */
const GR_T_FILL = GR_T_CHARGE + GR_CHARGE / GR_OUT_RATE; /* 10 */
const GR_T_HOLD = GR_T_FILL + 2; /* 12 */
const GR_T_CLAIM = GR_T_HOLD + GR_CLAIM_S; /* 18 */
const GR_CYCLE = GR_T_CLAIM + 2; /* 20 */

const GR_BEATS = [GR_T_CHARGE, GR_T_FILL, GR_T_HOLD, GR_T_CLAIM, GR_CYCLE];

/* Where each live reading taps its leg, as a fraction along the corridor, and
   which side of it the bubble sits. Art-directed rather than solved: the two
   inner legs are read late in the fan (and early in the collector), which is
   where their neighbours have moved far enough away that a bubble can never
   sit on a band it does not name. Fixed values also mean a bubble cannot
   flicker in and out as the ratios move. */
const GR_TAP_FILL = [0.4, 0.78, 0.86, 0.55];
const GR_TAP_CLAIM = [0.3, 0.22, 0.22, 0.3];
const GR_TAP_DIR = [-1, -1, 1, 1];

const GR_STILL_AT = 8.4; /* the reduced-motion still: 73% through the fill */

type GrPhase = 'charge' | 'fill' | 'hold' | 'claim' | 'idle';

function grPhase(t: number): GrPhase {
  if (t < GR_T_CHARGE) return 'charge';
  if (t < GR_T_FILL) return 'fill';
  if (t < GR_T_HOLD) return 'hold';
  if (t < GR_T_CLAIM) return 'claim';
  return 'idle';
}

/**
 * The control signal's aim, as four quantities that sum to `total` EXACTLY.
 * The residual goes to the last leg, which is how the contracts allocate too
 * (`toRouter = paid - toMiner`); dividing four ways and hoping is how a Sankey
 * acquires a seam.
 */
function grLegs(total: number, time: number): number[] {
  const raw: number[] = [];
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const v = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((2 * Math.PI * time) / GR_WEIGHT_PERIOD + (i * Math.PI) / 2));
    raw.push(v);
    s += v;
  }
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < 3; i++) {
    const q = (total * (raw[i] ?? 0)) / s;
    out.push(q);
    acc += q;
  }
  out.push(total - acc);
  return out;
}

function grSum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

function fix(n: number, d: number): string {
  return n.toFixed(d);
}
/** Exact zero prints as an exact zero; anything else prints its real size. */
function sci(n: number): string {
  return n === 0 ? '0.00e+0' : n.toExponential(2);
}

interface GrGeo {
  w: number;
  h: number;
  vesselX: number;
  vesselY: number;
  vesselW: number;
  vesselH: number;
  valveX: number;
  trunkY: number;
  splitX: number;
  bayX: number;
  bayW: number;
  bayH: number;
  collectX: number;
  burnX: number;
  sinkX: number;
  lanes: number[];
  gFlow: number;
  gStock: number;
  tagX: number;
  tagR: number;
  nodeY: number;
}

interface GrPaths {
  charge: Path2D | null;
  trunk: Path2D | null;
  /** the plant's routes, drawn at zero flow — a pipe is not a flow */
  pipes: Path2D[];
  bands: { path: Path2D; ink: string }[];
  runs: { path: Path2D; ink: string }[];
  /** where each live reading attaches, on the band it measures */
  meters: { x: number; y: number; q: number; w: number; dir: number }[];
}

function mountGrammar(): (() => void) | null {
  const panelEl = document.getElementById('sp-gramPanel');
  const keyMaybe = document.getElementById('sp-gramKey');
  const flowMaybe = document.getElementById('sp-gramFlow');
  if (!panelEl || !(keyMaybe instanceof HTMLCanvasElement) || !(flowMaybe instanceof HTMLCanvasElement)) return null;
  /* Rebound to non-null consts: the hoisted function declarations below do not
     inherit the narrowing from the guard above. */
  const panel = panelEl;
  const keyEl = keyMaybe;
  const flowEl = flowMaybe;
  const keyCtxMaybe = keyEl.getContext('2d');
  const flowCtxMaybe = flowEl.getContext('2d');
  if (!keyCtxMaybe || !flowCtxMaybe) return null;
  const keyCtx = keyCtxMaybe;
  const flowCtx = flowCtxMaybe;

  const readoutIds = [
    'sp-gramPhase',
    'sp-gj-name',
    'sp-gj-trunk',
    'sp-gj-legs',
    'sp-gj-dq',
    'sp-gj-dpx',
    'sp-gj-scan',
    'sp-gb-in',
    'sp-gb-vessel',
    'sp-gb-bays',
    'sp-gb-out',
    'sp-gb-delta',
  ] as const;
  const found = readoutIds.map((id) => document.getElementById(id));
  if (found.some((el) => el === null)) return null;
  const out = found as HTMLElement[];
  const [rPhase, rName, rTrunk, rLegs, rDq, rDpx, rScan, rIn, rVessel, rBays, rOut, rDelta] = out as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
  ];

  const ink = readInk();
  const MONO = fontFamily('--font-mono', 'ui-monospace, SFMono-Regular, Menlo, monospace');
  const fonts = legendFonts(MONO);
  const mono = (px: number, weight = 500) => `${weight} ${px}px ${MONO}`;
  const dprNow = () => Math.min(2, window.devicePixelRatio || 1);

  /* ---- sizes come from a ResizeObserver; a frame never reads layout ------ */
  const cssSize = new Map<HTMLCanvasElement, { w: number; h: number }>();
  let dirty = true;
  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          entries.forEach((e) => {
            if (e.target instanceof HTMLCanvasElement) {
              cssSize.set(e.target, { w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
            }
          });
          dirty = true;
          paintKey();
        })
      : null;
  function measure(c: HTMLCanvasElement): { w: number; h: number } {
    if (!ro) return { w: c.clientWidth, h: c.clientHeight };
    let s = cssSize.get(c);
    if (!s) {
      s = { w: c.clientWidth, h: c.clientHeight };
      cssSize.set(c, s);
      ro.observe(c);
    }
    return s;
  }
  function fit(c: HTMLCanvasElement, ctx: CanvasRenderingContext2D): { w: number; h: number; dpr: number } {
    const { w: cw, h: ch } = measure(c);
    const dpr = dprNow();
    const w = Math.round(cw * dpr);
    const h = Math.round(ch * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: cw, h: ch, dpr };
  }

  /* ---- the key: painted on mount and on resize, never per frame --------- */
  function paintKey(): void {
    const { w, h, dpr } = fit(keyEl, keyCtx);
    keyCtx.clearRect(0, 0, w, h);
    drawLegend(keyCtx, { x: 0, y: 2, w, h }, { ink, fonts, dpr });
  }

  /* ---- the model -------------------------------------------------------- */
  /* Every term of the balance is its OWN accumulator, moved only by a parcel
     that also moved another term. That is the difference between a balance and
     a restatement: an earlier draft derived the vessel level as
     `charged - delivered`, which makes `vessel + bays + out === charged` true
     by algebra, so the check could never fail and a deliberately injected leak
     did not move it off zero. It reads zero now because nothing is leaking. */
  let t = 0;
  let cycle = 1;
  let chargedIn = 0; /* cumulative in */
  let held = 0; /* stock in the vessel */
  let claimedOut = 0; /* cumulative out */
  const delivered = [0, 0, 0, 0]; /* cumulative into each bay — the claim basis */
  const bay = [0, 0, 0, 0]; /* stock */

  function seed(): void {
    t = 0;
    cycle = 1;
    chargedIn = 0;
    held = 0;
    claimedOut = 0;
    delivered.fill(0);
    bay.fill(0);
  }

  function tick(h: number): void {
    /* The phase is read at the START of the substep and `advance` never lets a
       substep cross a beat, so a boundary can never swallow part of a parcel.
       It used to: the substep straddling the end of the charge was classified
       as fill, so up to 0.48 units per cycle were never charged and then
       vanished at the wrap — 0.4% of the figure, gone without a mechanism. */
    const ph = grPhase(t);
    if (ph === 'charge') {
      const dIn = Math.min(GR_IN_RATE * h, GR_CHARGE - chargedIn);
      chargedIn += dIn;
      held += dIn;
    } else if (ph === 'fill') {
      const dOut = Math.min(GR_OUT_RATE * h, held);
      if (dOut > 0) {
        held -= dOut;
        const parts = grLegs(dOut, t);
        for (let i = 0; i < 4; i++) {
          const q = parts[i] ?? 0;
          delivered[i] = (delivered[i] ?? 0) + q;
          bay[i] = (bay[i] ?? 0) + q;
        }
      }
    } else if (ph === 'claim') {
      for (let i = 0; i < 4; i++) {
        const dq = Math.min(bay[i] ?? 0, ((delivered[i] ?? 0) / GR_CLAIM_S) * h);
        bay[i] = (bay[i] ?? 0) - dq;
        claimedOut += dq;
      }
    }
    t += h;
    if (t >= GR_CYCLE - 1e-9) {
      t = Math.max(0, t - GR_CYCLE);
      cycle += 1;
      chargedIn = 0;
      held = 0;
      claimedOut = 0;
      delivered.fill(0);
      bay.fill(0);
    }
  }

  /** Sub-stepped, and clipped to the next beat, so no parcel spans two beats. */
  function advance(dt: number): void {
    let left = Math.max(0, dt);
    let guard = 0;
    while (left > 1e-9 && guard++ < 20000) {
      let h = Math.min(left, 1 / 60);
      const beat = GR_BEATS.find((b) => b > t + 1e-12) ?? GR_CYCLE;
      if (t + h > beat) h = beat - t;
      if (h <= 0) break;
      left -= h;
      tick(h);
    }
  }

  /* ---- the geometry ----------------------------------------------------- */
  let geo: GrGeo | null = null;
  const paths: GrPaths = { charge: null, trunk: null, pipes: [], bands: [], runs: [], meters: [] };
  let pipeCache: Path2D[] = [];
  let pipeKey = '';
  let burnSize = 22;
  let report = junctionReport({ x: 0, c: 0, q: 0 }, [], 1);
  let scan = scanConservation({ legs: [], total: 0, from: 0, to: 0 });
  let junctionName = 'SHUT';

  function layout(w: number, h: number): GrGeo {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const narrow = w < 560;
    const vesselW = clamp(w * 0.055, 18, 54);
    const vesselH = clamp(h * 0.32, 58, 116);
    const trunkY = Math.round(h * 0.52);
    const laneTop = 20;
    const laneBot = h - 30;
    const laneH = (laneBot - laneTop) / 4;
    const lanes = [0, 1, 2, 3].map((i) => laneTop + (i + 0.5) * laneH);
    /* the vessel sits off the left edge by enough that the charge arriving
       reads as a band rather than as a stub */
    const vesselX = clamp(w * 0.075, 24, 86);
    return {
      w,
      h,
      vesselX,
      /* the outlet leaves the straight wall, above the dish and well below the
         inlet: a vessel with its inlet and outlet at the same height is an
         elbow wearing a tank's clothes */
      vesselY: trunkY - vesselH * 0.72,
      vesselW,
      vesselH,
      valveX: 0, /* solved below, once the gauge is known */
      trunkY,
      splitX: w * (narrow ? 0.34 : 0.27),
      bayX: w * (narrow ? 0.53 : 0.5),
      bayW: clamp(w * 0.038, 16, 44),
      bayH: Math.min(56, laneH - 26),
      collectX: w * 0.76,
      burnX: w * 0.85,
      sinkX: w * 0.955,
      lanes,
      /* the gauge is bounded by BOTH axes: a band sized only off the height
         does not leave room on a 310px canvas for the vessel, the gate and the
         splitter to stand apart */
      gFlow: Math.min(60, h * 0.16, w * 0.115) / GR_IN_RATE,
      gStock: (Math.min(56, laneH - 26) - 2) / GR_BAY_FULL,
      tagX: 0,
      tagR: clamp(w * 0.013, 10.5, 16),
      nodeY: 13,
    };
  }

  /**
   * Rebuild every band from the model's current quantities. This is where all
   * d3-shape work happens — never in paint(), so a parked canvas costs nothing
   * and static() gets real geometry instead of a blank.
   */
  function rebuild(): void {
    if (dirty || geo === null) {
      const { w, h } = fit(flowEl, flowCtx);
      geo = layout(w, h);
      /* the outlet gate straddles its band, so it needs its own half-width of
         clearance from the vessel wall */
      const gateHalf = (GR_OUT_RATE * geo.gFlow + 10) * 0.58;
      const wall = geo.vesselX + geo.vesselW;
      geo.valveX = wall + Math.max(12, gateHalf + 4);
      dirty = false;
    }
    const g = geo;
    const ph = grPhase(t);
    const gauge = g.gFlow;
    const corridor = g.bayX - g.splitX;

    paths.bands = [];
    paths.runs = [];
    paths.pipes = [];
    paths.meters = [];
    paths.charge = null;
    paths.trunk = null;

    /* the charge arriving: a band from off the left edge into the vessel's
       upper third. It is drawn, so the next cycle is a mechanism and not a
       counter that refills itself between frames. */
    if (ph === 'charge') {
      /* the inlet sits far enough down that the whole band is inside the
         vessel's own height — a band overhanging the tank it feeds reads as a
         drawing error, not as an inlet */
      const inlet = g.vesselY + Math.max(g.vesselH * 0.16, (GR_IN_RATE * gauge) / 2 + 5);
      paths.charge = ribbonPath({
        key: 'in',
        gauge,
        stations: [
          { x: -4, c: inlet, q: GR_IN_RATE },
          { x: g.vesselX, c: inlet, q: GR_IN_RATE },
        ],
      });
    }

    const outRate = ph === 'fill' ? GR_OUT_RATE : 0;
    const at: Station = { x: g.splitX, c: g.trunkY, q: outRate };
    const legQ = grLegs(outRate, t);

    if (outRate > 0) {
      paths.trunk = ribbonPath({
        key: 'trunk',
        gauge,
        stations: [
          { x: g.vesselX + g.vesselW, c: g.trunkY, q: outRate },
          { x: g.splitX, c: g.trunkY, q: outRate },
        ],
      });
    }

    const bays = [0, 1, 2, 3].map((i) => ({ c: g.lanes[i] ?? g.trunkY }));

    const splitLegs: Ribbon[] = splitFlow({
      gauge,
      at,
      legs: [0, 1, 2, 3].map((i) => ({
        key: ASSETS[i]?.sym ?? String(i),
        q: legQ[i] ?? 0,
        to: { x: g.bayX, c: bays[i]?.c ?? g.trunkY },
      })),
      steps: 18,
    });

    const claimRate =
      ph === 'claim' ? [0, 1, 2, 3].map((i) => ((bay[i] ?? 0) > 0 ? (delivered[i] ?? 0) / GR_CLAIM_S : 0)) : [0, 0, 0, 0];
    const claim = convergeFlow({
      gauge,
      sources: [0, 1, 2, 3].map((i) => ({
        key: ASSETS[i]?.sym ?? String(i),
        q: claimRate[i] ?? 0,
        from: { x: g.bayX + g.bayW, c: bays[i]?.c ?? g.trunkY },
      })),
      at: { x: g.collectX, c: g.trunkY },
      steps: 18,
    });

    /* ---- the plant, drawn at zero flow ---------------------------------
       A P&ID draws every route whether or not anything is in it; a Sankey
       draws only what is moving. This figure is both, so the routes are drawn
       as hairlines solved from the SAME fan at zero width — fixed geometry
       that cannot drift with the model — and the bands ride on top of them. A
       shut leg is then an empty pipe rather than a hole in the composition. */
    if (pipeKey !== g.w + ':' + g.h) {
      pipeCache = [];
      const zeroSplit = splitFlow({
        gauge,
        at: { x: g.splitX, c: g.trunkY, q: 0 },
        legs: [0, 1, 2, 3].map((i) => ({ key: 'p' + i, q: 0, to: { x: g.bayX, c: bays[i]?.c ?? g.trunkY } })),
        steps: 18,
      });
      const zeroClaim = convergeFlow({
        gauge,
        sources: [0, 1, 2, 3].map((i) => ({
          key: 'c' + i,
          q: 0,
          from: { x: g.bayX + g.bayW, c: bays[i]?.c ?? g.trunkY },
        })),
        at: { x: g.collectX, c: g.trunkY },
        steps: 18,
      });
      zeroSplit.forEach((r) => pipeCache.push(centrePath(r)));
      zeroClaim.legs.forEach((r) => pipeCache.push(centrePath(r)));
      pipeKey = g.w + ':' + g.h;
    }
    paths.pipes = pipeCache;

    if (outRate > 0) {
      splitLegs.forEach((r) => paths.bands.push({ path: ribbonPath(r), ink: USDG }));
      report = junctionReport(at, splitLegs, gauge, 'first');
      scan = scanConservation({ legs: splitLegs, total: outRate, from: g.splitX, to: g.bayX, samples: 33 });
      junctionName = 'SPLIT';
      if (corridor >= 190) {
        splitLegs.forEach((r, i) => {
          const x = g.splitX + corridor * (GR_TAP_FILL[i] ?? 0.5);
          const s = sampleAt(r, x);
          if (s !== null) paths.meters.push({ x, y: s.c, q: s.q, w: s.w, dir: GR_TAP_DIR[i] ?? -1 });
        });
      }
    } else if (claim.at.q > 0) {
      /* the collected stack continues to the burner at its stacked
         centrelines — four bands, still one hue each, never a mixed colour,
         and gapped around the burn valve so the valve is on the pipe rather
         than lost inside it */
      burnSize = Math.max(22, claim.at.q * gauge + 12);
      const top = g.trunkY - (claim.at.q * gauge) / 2;
      let cum = 0;
      claim.legs.forEach((r, i) => {
        const hue = ASSETS[i]?.hue ?? ink.hi;
        paths.bands.push({ path: ribbonPath(r), ink: hue });
        const q = claimRate[i] ?? 0;
        const c = top + (cum + q / 2) * gauge;
        cum += q;
        paths.runs.push({
          path: ribbonPath({
            key: 'run' + i,
            gauge,
            stations: [
              { x: g.collectX, c, q },
              { x: g.sinkX - 3, c, q },
            ],
          }),
          ink: hue,
        });
      });
      report = junctionReport(claim.at, claim.legs, gauge, 'last');
      scan = scanConservation({
        legs: claim.legs,
        total: claim.at.q,
        from: g.bayX + g.bayW,
        to: g.collectX,
        samples: 33,
      });
      junctionName = 'COLLECT';
      const claimRun = g.collectX - g.bayX - g.bayW;
      if (claimRun >= 190) {
        claim.legs.forEach((r, i) => {
          const x = g.bayX + g.bayW + claimRun * (GR_TAP_CLAIM[i] ?? 0.25);
          const s = sampleAt(r, x);
          if (s !== null && s.q > 0) paths.meters.push({ x, y: s.c, q: s.q, w: s.w, dir: GR_TAP_DIR[i] ?? -1 });
        });
      }
    } else {
      burnSize = 22;
      report = junctionReport(at, splitLegs, gauge, 'first');
      scan = scanConservation({ legs: splitLegs, total: 0, from: g.splitX, to: g.bayX, samples: 33 });
      junctionName = 'SHUT';
    }
  }

  /* ---- the paint: draw ops only ----------------------------------------- */
  /** A valve, part-open. The ground-coloured halo under the outline is what
   *  lets the glyph read while sitting ON a band of its own colour — gapping
   *  the band around it instead only works while the canvas is wide. */
  function drawValve(x: number, y: number, size: number, open: number, fill: string): void {
    valve(flowCtx, x, y, { ink: ink.panel, size, open: false, weight: 4 });
    valve(flowCtx, x, y, { ink: ink.muted, size, open: false });
    if (open <= 0.001) return;
    flowCtx.save();
    flowCtx.globalAlpha = Math.min(1, open);
    valve(flowCtx, x, y, { ink: ink.muted, size, open: true, fill });
    flowCtx.restore();
  }

  function paint(): void {
    const g = geo;
    if (g === null) return;
    const ctx = flowCtx;
    const dpr = dprNow();
    ctx.clearRect(0, 0, g.w, g.h);
    ctx.textBaseline = 'alphabetic';

    const ph = grPhase(t);
    const vesselLevel = Math.max(0, held);

    /* the plant first: every route as a hairline, so a shut leg reads as an
       empty pipe instead of as missing composition */
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink.ruleStrong;
    ctx.beginPath();
    ctx.moveTo(g.vesselX + g.vesselW, g.trunkY);
    ctx.lineTo(g.splitX, g.trunkY);
    ctx.moveTo(g.collectX, g.trunkY);
    ctx.lineTo(g.sinkX, g.trunkY);
    ctx.stroke();
    for (const pipe of paths.pipes) ctx.stroke(pipe);

    /* then the flows, which are the only things with width */
    if (paths.charge !== null) {
      ctx.fillStyle = USDG;
      ctx.fill(paths.charge);
    }
    if (paths.trunk !== null) {
      ctx.fillStyle = USDG;
      ctx.fill(paths.trunk);
    }
    for (const band of paths.bands) {
      ctx.fillStyle = band.ink;
      ctx.fill(band.path);
    }
    for (const run of paths.runs) {
      ctx.fillStyle = run.ink;
      ctx.fill(run.path);
    }

    /* the bays — stock, on their own published gauge */
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const cy = g.lanes[i] ?? g.trunkY;
      const hue = ASSETS[i]?.hue ?? ink.hi;
      const top = cy - g.bayH / 2;
      const stock = Math.max(0, bay[i] ?? 0);
      const fillH = Math.min(g.bayH - 2, stock * g.gStock);
      ctx.fillStyle = ink.bg;
      ctx.fillRect(g.bayX, top, g.bayW, g.bayH);
      if (fillH > 0) {
        ctx.fillStyle = hue;
        ctx.fillRect(g.bayX + 1, top + g.bayH - 1 - fillH, g.bayW - 2, fillH);
      }
      ctx.strokeStyle = hue;
      ctx.strokeRect(g.bayX + 0.5 / dpr, top + 0.5 / dpr, g.bayW, g.bayH);

      ctx.textAlign = 'center';
      ctx.font = mono(10, 600);
      ctx.fillStyle = ink.hi;
      ctx.fillText(ASSETS[i]?.sym ?? '', g.bayX + g.bayW / 2, top + g.bayH + 13);
      ctx.font = mono(9.5, 500);
      ctx.fillStyle = ink.muted;
      ctx.fillText(fix(stock, 1), g.bayX + g.bayW / 2, top + g.bayH + 24);
    }
    /* the bay axis, stated once rather than assumed */
    ctx.strokeStyle = ink.ruleStrong;
    ctx.beginPath();
    const axY = (g.lanes[0] ?? 0) - g.bayH / 2;
    ctx.moveTo(g.bayX - 5, axY + 0.5 / dpr);
    ctx.lineTo(g.bayX, axY + 0.5 / dpr);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.font = mono(9, 500);
    ctx.fillStyle = ink.muted;
    ctx.fillText(String(GR_BAY_FULL), g.bayX - 7, axY + 4);

    /* mechanisms */
    vessel(ctx, g.vesselX, g.vesselY, {
      ink: ink.muted,
      w: g.vesselW,
      h: g.vesselH,
      level: vesselLevel / GR_CHARGE,
      levelFill: USDG,
    });
    /* A valve is a STATE, not a quantity, so it is the one thing in this figure
       that eases: both gates cross-fade over --t-base on the page's own --ease
       (lib/ease.ts reads the token at runtime), which is why a canvas beat here
       lands on the same curve as a CSS transition beside it. Nothing a width
       depends on is eased — that would be drawing a number the model never
       had. */
    const gate = (from: number, to: number) => ramp(t, from, from + 0.2) - ramp(t, to, to + 0.2);
    const outletGate = gate(GR_T_CHARGE, GR_T_FILL);
    const burnGate = gate(GR_T_HOLD, GR_T_CLAIM);
    drawValve(g.valveX, g.trunkY, GR_OUT_RATE * g.gFlow + 10, outletGate, USDG);
    splitter(ctx, g.splitX, g.trunkY, { ink: ink.muted, size: Math.min(18, g.bayH * 0.4) });
    drawValve(g.burnX, g.trunkY, burnSize, burnGate, ink.raised);
    const sinkSize = Math.max(14, Math.min(24, GR_OUT_RATE * g.gFlow * 0.62));
    sink(ctx, g.sinkX, g.trunkY, { ink: ink.muted, size: sinkSize, fill: ink.muted, barH: burnSize });

    /* the control signal: a node, and a dashed line with no width */
    node(ctx, g.splitX, g.nodeY, { ink: ink.pink, size: 14 });
    setStroke(ctx, SIGNAL, ink.pink);
    ctx.beginPath();
    ctx.moveTo(g.splitX, g.nodeY + 7);
    ctx.lineTo(g.splitX, g.trunkY - Math.min(18, g.bayH * 0.4) - 2);
    ctx.stroke();
    ctx.setLineDash([]);

    /* the readings. Each bubble is anchored to the band it measures, at that
       band's own centreline, and offset clear of it: a callout must track what
       it names and must not sit on top of it. They are staggered along the
       corridor so no two can ever collide, and dropped entirely where the
       corridor is too short to hold them — the bay figures still carry the
       numbers, so nothing is lost and nothing is cut. */
    paths.meters.forEach((m, i) => {
      const lift = g.tagR + 11 + m.w / 2;
      const cy = Math.min(g.h - g.tagR - 2, Math.max(g.tagR + 2, m.y + m.dir * lift));
      tag(ctx, m.x, cy, {
        ink: ink.muted,
        r: g.tagR,
        tag: 'FI' + (i + 1),
        value: fix(m.q, 1),
        from: { x: m.x, y: m.y },
        tagFont: mono(Math.max(7, g.tagR * 0.52), 500),
        valueFont: mono(Math.max(8, g.tagR * 0.62), 600),
        tagInk: ink.muted,
        valueInk: ink.hi,
        ground: ink.panel,
      });
    });

    /* labels — mono, on the mechanism they name */
    ctx.textAlign = 'left';
    ctx.font = mono(9.5, 600);
    ctx.fillStyle = ink.muted;
    if (ph === 'charge') {
      const inlet = g.vesselY + Math.max(g.vesselH * 0.16, (GR_IN_RATE * g.gFlow) / 2 + 5);
      ctx.fillText('IN', 2, inlet - (GR_IN_RATE * g.gFlow) / 2 - 6);
    }
    ctx.textAlign = 'center';
    ctx.fillText('VESSEL', g.vesselX + g.vesselW / 2, g.vesselY + g.vesselH + 13);
    ctx.font = mono(9.5, 500);
    ctx.fillStyle = ink.hi;
    ctx.fillText(fix(vesselLevel, 1), g.vesselX + g.vesselW / 2, g.vesselY + g.vesselH + 24);
    ctx.font = mono(9.5, 600);
    ctx.fillStyle = ink.muted;
    /* under the splitter, and clear of the widest the trunk can ever be, so
       the label sits in the wedge the fan has not opened into yet */
    ctx.fillText('SPLIT', g.splitX, g.trunkY + (GR_OUT_RATE * g.gFlow) / 2 + 28);
    ctx.textAlign = 'left';
    ctx.fillText('SIGNAL', g.splitX + 12, g.nodeY + 4);
    /* BURN and OUT go side by side only where both fit between their glyphs;
       otherwise they stack, above and below. Two labels that overlap at 390px
       are two labels that say nothing. */
    const labelY = g.trunkY + Math.max(24, burnSize / 2 + 15);
    const room = g.sinkX - g.burnX - (ctx.measureText('BURN').width + ctx.measureText('OUT').width) / 2;
    ctx.textAlign = 'center';
    if (room >= 8) {
      ctx.fillText('BURN', g.burnX, labelY);
      ctx.fillText('OUT', g.sinkX, labelY);
    } else {
      ctx.fillText('BURN', g.burnX, g.trunkY - burnSize / 2 - 9);
      ctx.fillText('OUT', g.sinkX, labelY);
    }

    /* the scale bar: the gauge, drawn rather than asserted, so a reader can
       measure any band on the figure against a stated quantity */
    const barW = GR_OUT_RATE * g.gFlow;
    const barY = g.h - 13;
    ctx.fillStyle = USDG;
    ctx.fillRect(4, barY - 4, barW, 8);
    ctx.textAlign = 'left';
    ctx.font = mono(9, 500);
    ctx.fillStyle = ink.muted;
    ctx.fillText('= ' + GR_OUT_RATE + ' UNITS/S', 4 + barW + 7, barY + 3.5);

    /* the readouts */
    rPhase.textContent =
      ph === 'charge'
        ? 'charge ' + String(cycle).padStart(2, '0') + ' — capital arriving'
        : ph === 'fill'
          ? 'fill — the signal is dividing the flow'
          : ph === 'hold'
            ? 'hold — the outlet is shut, nothing moves'
            : ph === 'claim'
              ? 'claim — every bay releases the same share'
              : 'idle — the bays are empty and it all left through the sink';
    rName.textContent = junctionName;
    rTrunk.textContent = fix(report.parentQ, 3);
    rLegs.textContent = fix(report.legQ, 3);
    rDq.textContent = sci(report.qErr);
    rDpx.textContent = fix(report.pxErr, 2) + ' / ' + fix(report.maxSeamPx, 2);
    rScan.textContent = sci(scan.maxAbsErr);

    const bays = grSum(bay);
    rIn.textContent = fix(chargedIn, 3);
    rVessel.textContent = fix(held, 3);
    rBays.textContent = fix(bays, 3);
    rOut.textContent = fix(claimedOut, 3);
    rDelta.textContent = sci(held + bays + claimedOut - chargedIn);
  }

  paintKey();
  /* Seed the flow canvas's size cache and attach its observer HERE, outside
     any frame. Left to the first rebuild(), the first-touch clientWidth /
     clientHeight read would happen inside a rAF callback — two forced
     synchronous layouts, which is two more than this page allows. */
  fit(flowEl, flowCtx);
  /* The key solves its own column counts from measured text, so it must be
     measured in the face it will be drawn in. next/font loads after mount, and
     a plate laid out on fallback metrics comes out with the wrong number of
     columns and captions that collide. One repaint when the faces land. */
  let live = true;
  if (typeof document !== 'undefined' && 'fonts' in document) {
    void document.fonts.ready.then(() => {
      if (live) paintKey();
    });
  }

  const unregister = registerSim({
    name: 'specimen-grammar',
    el: panel,
    step: (dt) => {
      advance(dt);
      rebuild();
    },
    paint,
    reset: () => {
      seed();
      rebuild();
      paint();
    },
    /* The still has to teach: 73% through the fill, where the vessel is part
       drained, the four legs are visibly unequal, the bays carry different
       stock and both checks read zero. */
    static: () => {
      seed();
      advance(GR_STILL_AT);
      rebuild();
      paint();
    },
  });

  return () => {
    live = false;
    unregister();
    ro?.disconnect();
  };
}

export function SpecimenDriver(): null {
  useLayoutEffect(() => {
    const offs = [mountBoard(), mountTracks(), mountEvents(), mountGrammar()];
    return () => offs.forEach((off) => off?.());
  }, []);

  // Registration first, then the loop: layout effects run before passive ones,
  // so every sim above is on the list by the time the harness starts.
  useEffect(() => startHarness(), []);

  return null;
}
