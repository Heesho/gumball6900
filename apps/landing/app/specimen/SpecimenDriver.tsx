'use client';

import { useEffect, useLayoutEffect } from 'react';
import { fontFamily, registerSim, startHarness } from '../../lib/harness';
import { PROCESS_REST, SIGNAL, node, setStroke, sink, splitter, tag, valve, vessel } from '../../lib/isa';
import { ASSETS, GBX, USDG, drawLegend, fillNeutral, legendFonts, readInk } from '../../lib/legend';
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
   one never idles into a state its own arithmetic cannot explain, and NOTHING
   IS EVER ZEROED BY FIAT. The four counters run cumulatively for as long as
   the page is open; the cycle boundary resets only the per-charge cap on the
   inlet. So `charged = vessel + bays + claimed` is not a statement about one
   scripted cycle that quietly restarts — it is a statement about every unit
   that has ever entered the figure, and the twentieth charge has to balance
   against the first nineteen. The bays are not emptied at the wrap either:
   they reach zero because a drawn claim took everything out of them, and any
   residue would be visible in the next cycle rather than deleted between
   frames.

   Two stations therefore carry material at once, twice per cycle: the inlet
   runs while the outlet is already dividing the flow, and GBX arrives at the
   burner while assets are leaving for the holder. A grammar for a plate whose
   stations are all live simultaneously has to demonstrate that somewhere. */

const GR_CHARGE = 120; /* units in one charge */
const GR_IN_RATE = 30; /* units/s arriving while the inlet is open */
const GR_OUT_RATE = 20; /* units/s leaving the vessel while it fills the bays */
const GR_BAY_FULL = 48; /* units — the published top of the bay axis */
const GR_VESSEL_FULL = 60; /* units — the vessel's published capacity */
/* GBX destroyed per unit of asset released. Illustrative, like every quantity
   in this figure; what matters to the grammar is that the burn is a MEASURED
   band of its own substance and not a recolour of the assets passing by. */
const GR_BURN_RATIO = 0.75;
/* s — the control signal's rotation. Deliberately not a factor of the cycle
   and read off the GLOBAL clock, so no two cycles split the flow the same way
   and a second viewing is not a repeat of the first. */
const GR_WEIGHT_PERIOD = 13;

const GR_T_OUT_OPEN = 1; /* the outlet opens while the inlet is still running */
const GR_T_IN_SHUT = 4; /* 4 s x 30 = one 120-unit charge */
const GR_T_OUT_SHUT = 7; /* 6 s x 20 = the same 120 units, out */
const GR_T_HOLD_END = 9;
const GR_T_CLAIM_END = 15; /* 6 s of claim */
const GR_CYCLE = 17;

const GR_BEATS = [GR_T_OUT_OPEN, GR_T_IN_SHUT, GR_T_OUT_SHUT, GR_T_HOLD_END, GR_T_CLAIM_END, GR_CYCLE];

/* Where each live reading taps its leg, as a fraction along the corridor, and
   which side of it the bubble sits. Art-directed rather than solved: the two
   inner legs are read late in the fan (and early in the collector), which is
   where their neighbours have moved far enough away that a bubble can never
   sit on a band it does not name. The outer pair are read EARLY, on the other
   side of the signal bus, so a bubble and a share reading never contend for
   the same span of corridor. Fixed values also mean a bubble cannot flicker in
   and out as the ratios move. */
const GR_TAP_FILL = [0.3, 0.8, 0.88, 0.38];
const GR_TAP_CLAIM = [0.3, 0.22, 0.22, 0.3];
const GR_TAP_DIR = [-1, -1, 1, 1];
/* where the control signal's branch meets each leg, as a fraction of the
   corridor — one common x, so the four branches read as one fan-out from the
   node rather than as four unrelated lines */
const GR_SIGNAL_TAP = 0.52;

/* The live positive control. A zero from an uncalibrated instrument is
   worthless, and three of this figure's checks sit at the floor of double
   precision, where "0.00e+0" and "not wired up" look identical. So the same
   junction check runs a second time every frame against a deliberately broken
   fan — one leg short by 0.4% — and the figure prints what it says. A reader
   can then see what a defect this instrument WOULD catch looks like, beside
   the zero it is actually reporting. */
const GR_CONTROL_LEAK = 0.996;

/* The reduced-motion still: the SECOND cycle, 3.7 s in — inlet still running,
   outlet already dividing, bays part filled and unequal, and the whole burn
   station drawn at rest with its valve visibly shut. The second cycle rather
   than the first because the first has nothing behind it: a still taken on
   cycle 2 shows a ledger that has already had to balance once. */
const GR_STILL_AT = GR_CYCLE + 3.7;

type GrPhase = 'charge' | 'both' | 'fill' | 'hold' | 'claim' | 'idle';

function grPhase(t: number): GrPhase {
  if (t < GR_T_OUT_OPEN) return 'charge';
  if (t < GR_T_IN_SHUT) return 'both';
  if (t < GR_T_OUT_SHUT) return 'fill';
  if (t < GR_T_HOLD_END) return 'hold';
  if (t < GR_T_CLAIM_END) return 'claim';
  return 'idle';
}

/* The three valves, as predicates on the cycle clock. A phase name is a
   caption; these are what the model and the drawing both read, so the two can
   never disagree about whether something is open. */
function grInOpen(t: number): boolean {
  return t < GR_T_IN_SHUT;
}
function grOutOpen(t: number): boolean {
  return t >= GR_T_OUT_OPEN && t < GR_T_OUT_SHUT;
}
function grClaimOpen(t: number): boolean {
  return t >= GR_T_HOLD_END && t < GR_T_CLAIM_END;
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
  /** the GBX burn line: it comes down from here to the burner */
  gbxTop: number;
  sinkSize: number;
  inletY: number;
}

interface GrPaths {
  charge: Path2D | null;
  trunk: Path2D | null;
  /** the GBX band, built along a rotated axis and drawn under a transform */
  gbx: Path2D | null;
  /** the plant's routes, at rest — drawn ONLY where nothing is flowing */
  pipeSplit: Path2D[];
  pipeClaim: Path2D[];
  bands: { path: Path2D; ink: string }[];
  runs: { path: Path2D; ink: string }[];
  /** where each live reading attaches, on the band it measures */
  meters: { x: number; y: number; q: number; w: number; dir: number; n: number }[];
  /** the four shares the control signal is setting, and where its branch lands */
  shares: { x: number; y: number; edge: number; pct: number; dir: number }[];
  /** the signal bus: one dashed line crossing every leg at the same station */
  bus: { x: number; y0: number; y1: number; right: boolean } | null;
  /** the collector's stripes, in stack order, for the placard */
  stack: { sym: string; c: number }[];
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
    'sp-gj-dpx',
    'sp-gj-seam',
    'sp-gj-scan',
    'sp-gj-ctl',
    'sp-gb-in',
    'sp-gb-vessel',
    'sp-gb-bays',
    'sp-gb-out',
    'sp-gb-delta',
    'sp-gb-burn',
  ] as const;
  const found = readoutIds.map((id) => document.getElementById(id));
  if (found.some((el) => el === null)) return null;
  const out = found as HTMLElement[];
  const [rPhase, rName, rTrunk, rLegs, rDpx, rSeam, rScan, rCtl, rIn, rVessel, rBays, rOut, rDelta, rBurn] = out as [
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
  let t = 0; /* position in the cycle */
  let tAll = 0; /* the global clock — the control signal runs off this */
  let cycle = 1;
  let inCycle = 0; /* this charge's progress, the ONLY per-cycle counter */
  let chargedIn = 0; /* cumulative in, for as long as the page is open */
  let held = 0; /* stock in the vessel */
  let claimedOut = 0; /* cumulative out */
  let burned = 0; /* cumulative GBX destroyed — its own substance, its own ledger */
  const bay = [0, 0, 0, 0]; /* stock */

  function seed(): void {
    t = 0;
    tAll = 0;
    cycle = 1;
    inCycle = 0;
    chargedIn = 0;
    held = 0;
    claimedOut = 0;
    burned = 0;
    bay.fill(0);
  }

  function tick(h: number): void {
    /* Each valve is tested independently at the START of the substep, and
       `advance` never lets a substep cross a beat, so a boundary can never
       swallow part of a parcel. It used to: the substep straddling the end of
       the charge was classified as fill, so up to 0.48 units per cycle were
       never charged and then vanished at the wrap — 0.4% of the figure, gone
       without a mechanism. Testing valves rather than a single phase name is
       also what lets the inlet and the outlet be open at the same time. */
    const now = t;
    if (grInOpen(now)) {
      const dIn = Math.min(GR_IN_RATE * h, GR_CHARGE - inCycle);
      inCycle += dIn;
      chargedIn += dIn;
      held += dIn;
    }
    if (grOutOpen(now)) {
      const dOut = Math.min(GR_OUT_RATE * h, held);
      if (dOut > 0) {
        held -= dOut;
        const parts = grLegs(dOut, tAll);
        for (let i = 0; i < 4; i++) bay[i] = (bay[i] ?? 0) + (parts[i] ?? 0);
      }
    }
    if (grClaimOpen(now)) {
      /* Every bay releases the same share of what it holds: the balance spread
         evenly over the claim window that is left. Written this way the drain
         is self-correcting — a substep the browser never delivered raises the
         rate of the ones that follow — so the bays reach exactly zero at the
         close of the window instead of leaving a residue that the old
         `bay.fill(0)` at the wrap would then have deleted. Measured over 40
         cycles of jittered frames: residue 0.00e+0 at every one of 4,949 idle
         samples. */
      const left = GR_T_CLAIM_END - now;
      for (let i = 0; i < 4; i++) {
        const stock = bay[i] ?? 0;
        const dq = left <= h ? stock : (stock * h) / left;
        bay[i] = stock - dq;
        claimedOut += dq;
        burned += dq * GR_BURN_RATIO;
      }
    }
    t += h;
    tAll += h;
    if (t >= GR_CYCLE - 1e-9) {
      t = Math.max(0, t - GR_CYCLE);
      cycle += 1;
      /* the ONLY thing the wrap resets. Every ledger term carries on. */
      inCycle = 0;
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
  const paths: GrPaths = {
    charge: null,
    trunk: null,
    gbx: null,
    pipeSplit: [],
    pipeClaim: [],
    bands: [],
    runs: [],
    meters: [],
    shares: [],
    bus: null,
    stack: [],
  };
  let pipeSplitCache: Path2D[] = [];
  let pipeClaimCache: Path2D[] = [];
  let pipeKey = '';
  let burnSize = 22;
  let burnRate = 0;
  /* where the GBX band dies — solved in rebuild from the collector's own width
     so the terminator can never land inside the assets passing underneath */
  let burnerY = 0;
  let burnSinkSize = 16;
  let controlPx = 0;
  let report = junctionReport({ x: 0, c: 0, q: 0 }, [], 1);
  let scan = scanConservation({ legs: [], total: 0, from: 0, to: 0 });
  let junctionName = 'SHUT';

  function layout(w: number, h: number): GrGeo {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const narrow = w < 560;
    const vesselW = clamp(w * 0.055, 18, 54);
    const vesselH = clamp(h * 0.3, 58, 112);
    const trunkY = Math.round(h * 0.52);
    const laneTop = 20;
    const laneBot = h - 34;
    const laneH = (laneBot - laneTop) / 4;
    const lanes = [0, 1, 2, 3].map((i) => laneTop + (i + 0.5) * laneH);
    /* the vessel sits off the left edge by enough that the charge arriving
       reads as a band rather than as a stub */
    const vesselX = clamp(w * 0.07, 18, 86);
    /* the gauge is bounded by BOTH axes: a band sized only off the height does
       not leave room on a 310px canvas for the vessel, the gate and the
       splitter to stand apart */
    const gFlow = Math.min(66, h * 0.185, w * 0.125) / GR_IN_RATE;
    /* one bay, and the gutter under it: ~3px above the ticker and >=12px below
       it, so a reading is never equidistant between the bay it names and the
       one it does not */
    const bayW = clamp(w * 0.038, 22, 44);
    /* a bay is a container, not a thermometer: its height is capped against its
       own width as well as against the lane, so it does not turn into a stick
       at 390 */
    const bayH = Math.min(56, laneH - 26, bayW * 2);

    /* The right end is budgeted from the glyphs outward rather than from three
       fractions of the width. At 390 the fractions put the sink's hatching
       0.5px from the frame and landed the four-into-one merge inside the burn
       valve; solved from the glyph sizes, both clearances hold at every width
       the canvas can take. */
    const widest = GR_OUT_RATE * gFlow; /* the widest the trunk or collector can be */
    const sinkSize = clamp(widest * 0.62, 14, 24);
    const burnHalf = (widest + 12) * 0.58;
    const sinkX = w - (Math.max(sinkSize * 0.46, 9) + 13);
    const burnX = sinkX - Math.max(30, burnHalf + 14, w * 0.075);
    const collectX = burnX - Math.max(26, burnHalf + 10 + w * 0.012, w * 0.085);

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
      valveX: 0 /* solved below, once the gauge is known */,
      trunkY,
      splitX: w * (narrow ? 0.34 : 0.27),
      bayX: w * (narrow ? 0.5 : 0.47),
      bayW,
      bayH,
      collectX,
      burnX,
      sinkX,
      lanes,
      gFlow,
      gStock: (bayH - 2) / GR_BAY_FULL,
      tagX: 0,
      tagR: clamp(w * 0.013, 9, 16),
      nodeY: 13,
      gbxTop: 26,
      sinkSize,
      inletY: 0 /* solved in rebuild, once the vessel is placed */,
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
      /* the inlet sits far enough down that the whole band is inside the
         vessel's own height — a band overhanging the tank it feeds reads as a
         drawing error, not as an inlet */
      geo.inletY = geo.vesselY + Math.max(geo.vesselH * 0.16, (GR_IN_RATE * geo.gFlow) / 2 + 5);
      dirty = false;
    }
    const g = geo;
    const gauge = g.gFlow;
    const corridor = g.bayX - g.splitX;

    paths.bands = [];
    paths.runs = [];
    paths.meters = [];
    paths.shares = [];
    paths.bus = null;
    paths.stack = [];
    paths.charge = null;
    paths.trunk = null;
    paths.gbx = null;

    /* Every rate below is read off the SAME predicate the model steps on, so
       nothing is ever drawn moving while the model holds it still. */
    const inRate = grInOpen(t) && inCycle < GR_CHARGE ? GR_IN_RATE : 0;
    const outRate = grOutOpen(t) && held > 0 ? GR_OUT_RATE : 0;
    const claimLeft = Math.max(GR_T_CLAIM_END - t, 1e-6);
    const claimRate = [0, 1, 2, 3].map((i) =>
      grClaimOpen(t) ? Math.max(0, (bay[i] ?? 0) / claimLeft) : 0,
    );

    /* the charge arriving: a band from off the left edge into the vessel's
       upper third. It is drawn, so the next cycle is a mechanism and not a
       counter that refills itself between frames. */
    if (inRate > 0) {
      paths.charge = ribbonPath({
        key: 'in',
        gauge,
        stations: [
          { x: -4, c: g.inletY, q: inRate },
          { x: g.vesselX, c: g.inletY, q: inRate },
        ],
      });
    }

    const at: Station = { x: g.splitX, c: g.trunkY, q: outRate };
    const legQ = grLegs(outRate, tAll);

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

    /* ---- the plant, at rest ---------------------------------------------
       A P&ID draws every route whether or not anything is in it; a Sankey
       draws only what is moving. This figure is both, so the routes are drawn
       as hairlines solved from the SAME fan at zero width — fixed geometry
       that cannot drift with the model. They are painted ONLY where nothing is
       flowing: a hairline beside a live band is a ghost edge on one side of a
       ribbon, which is a drawing artefact rather than a reading. */
    if (pipeKey !== g.w + ':' + g.h) {
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
      pipeSplitCache = zeroSplit.map((r) => centrePath(r));
      pipeClaimCache = zeroClaim.legs.map((r) => centrePath(r));
      pipeKey = g.w + ':' + g.h;
    }
    paths.pipeSplit = outRate > 0 ? [] : pipeSplitCache;
    paths.pipeClaim = claim.at.q > 0 ? [] : pipeClaimCache;

    if (outRate > 0) {
      splitLegs.forEach((r) => paths.bands.push({ path: ribbonPath(r), ink: USDG }));
      report = junctionReport(at, splitLegs, gauge, 'first');
      scan = scanConservation({ legs: splitLegs, total: outRate, from: g.splitX, to: g.bayX, samples: 33, gauge });
      junctionName = 'SPLIT';
      burnerY = g.trunkY - 15;
      /* A 50px corridor cannot hold four bubbles AND four share readings. It
         holds the SHARES, because the signal is what this station is for — and
         the TAG form is not lost, because the claim corridor further right
         picks it up in the same cycle (see the collector below). At 390 the old
         threshold dropped bubbles everywhere, so a reader met the glyph in the
         key and then never saw one used. */
      const tight = corridor < 132;
      const legIdx = tight ? [] : [0, 1, 2, 3];
      const taps = GR_TAP_FILL;
      legIdx.forEach((i) => {
        const r = splitLegs[i];
        if (r === undefined) return;
        const x = g.splitX + corridor * (taps[i] ?? 0.5);
        const s = sampleAt(r, x);
        if (s !== null) paths.meters.push({ x, y: s.c, q: s.q, w: s.w, dir: GR_TAP_DIR[i] ?? -1, n: i + 1 });
      });
      /* the ratio the signal is setting, read off ONE bus that crosses every
         leg at the same station — so the reader sees four numbers taken at one
         instant from one control, not four unrelated captions. The labels sit
         on the far side of the bus from the bubbles, which is why the two can
         never land on top of each other however narrow the corridor gets. */
      /* the bus sits far enough down the corridor that the fan has opened: a
         reading taken where the four legs are still stacked in the trunk is a
         reading laid across three bands it does not name */
      /* On a 50px corridor every leg sweeps through every height, so a reading
         parked mid-fan is crossed by whichever leg is passing. The bus goes to
         the far end instead, where each leg has arrived in its own lane and the
         four readings have 80px of clear air between them. */
      const busX = g.splitX + corridor * (tight ? 0.82 : GR_SIGNAL_TAP);
      /* on a narrow canvas the readings hang to the LEFT of the bus: to their
         right is the bay wall, and a share printed over a bay is a share
         belonging to nothing */
      const right = !tight;
      /* THE LABEL HAS TO CLEAR THE WHOLE FAN, NOT ITS OWN BAND.
         A reading is ~26px of corridor wide and every leg is climbing or
         falling under it the whole way, so an offset taken from one leg's edge
         at one x is clear where it starts and 0.5px clear where it ends — and
         it is the NEIGHBOUR that it lands on, not its own band. So: sample
         every leg across the label's own x-span, take each band's extreme
         there, and place the reading in the gap between its leg and the
         neighbour on that side. Where no gap on either side can hold it, the
         reading is not drawn: a number laid over a band it does not name is
         worse than a number a reader has to get from somewhere else. */
      flowCtx.font = mono(9, 600);
      const labelW = flowCtx.measureText('99%').width + 6;
      const xa = right ? busX : busX - labelW;
      const xb = right ? busX + labelW : busX;
      const env = splitLegs.map((r) => {
        let top = Infinity;
        let bot = -Infinity;
        for (let k = 0; k <= 6; k++) {
          const sp = sampleAt(r, xa + ((xb - xa) * k) / 6);
          if (sp !== null) {
            top = Math.min(top, sp.c - sp.w / 2);
            bot = Math.max(bot, sp.c + sp.w / 2);
          }
        }
        return { top, bot };
      });
      const GAP_ABOVE = 13; /* 7px cap + a 4px gap + 2px of margin */
      const GAP_BELOW = 15;
      let y0 = Infinity;
      let y1 = -Infinity;
      splitLegs.forEach((r, i) => {
        const s = sampleAt(r, busX);
        const me = env[i];
        if (s === null || me === undefined) return;
        y0 = Math.min(y0, s.c);
        y1 = Math.max(y1, s.c);
        const up = i === 0 ? Infinity : me.top - (env[i - 1]?.bot ?? -Infinity);
        const down = i === 3 ? Infinity : (env[i + 1]?.top ?? Infinity) - me.bot;
        const prefer = GR_TAP_DIR[i] ?? -1;
        let dir = 0;
        if (prefer < 0 && up >= GAP_ABOVE) dir = -1;
        else if (prefer > 0 && down >= GAP_BELOW) dir = 1;
        else if (up >= GAP_ABOVE) dir = -1;
        else if (down >= GAP_BELOW) dir = 1;
        if (dir === 0) return;
        paths.shares.push({
          x: busX,
          y: s.c,
          edge: dir < 0 ? me.top : me.bot,
          pct: (s.q / outRate) * 100,
          dir,
        });
      });
      if (y0 < y1) paths.bus = { x: busX, y0, y1, right };
    } else if (claim.at.q > 0) {
      /* the collected stack continues to the burner and past it at its stacked
         centrelines — four bands, still one hue each, never a mixed colour. The
         burn is NOT on this path: what is destroyed is GBX, which arrives at
         the burner on its own line and dead-ends there. */
      burnSize = Math.max(22, claim.at.q * GR_BURN_RATIO * gauge + 12);
      const top = g.trunkY - (claim.at.q * gauge) / 2;
      let cum = 0;
      claim.legs.forEach((r, i) => {
        const hue = ASSETS[i]?.hue ?? ink.hi;
        paths.bands.push({ path: ribbonPath(r), ink: hue });
        const q = claimRate[i] ?? 0;
        const c = top + (cum + q / 2) * gauge;
        cum += q;
        paths.stack.push({ sym: ASSETS[i]?.sym ?? '', c });
        paths.runs.push({
          path: ribbonPath({
            key: 'run' + i,
            gauge,
            stations: [
              { x: g.collectX, c, q },
              { x: g.sinkX - g.sinkSize * 0.72, c, q },
            ],
          }),
          ink: hue,
        });
      });
      /* the burn: a neutral GBX band arriving at the burner and stopping. It is
         built along a rotated axis — stations run DOWN the page — and drawn
         under one transform, so it is the same primitive and the same
         `width === q x gauge` claim as every horizontal band on the figure. */
      const burnQ = claim.at.q * GR_BURN_RATIO;
      burnerY = g.trunkY - (claim.at.q * gauge) / 2 - 15;
      /* the band stops just short of the terminator's arrow rather than under
         it: a grey arrowhead drawn ON a white band is a hole in the band, and
         the one mark that says "destroyed here" has to read */
      burnSinkSize = Math.max(14, Math.min(22, burnSize * 0.5));
      paths.gbx = ribbonPath({
        key: 'gbx',
        gauge,
        stations: [
          { x: g.gbxTop, c: 0, q: burnQ },
          { x: burnerY - burnSinkSize * 0.72, c: 0, q: burnQ },
        ],
      });
      report = junctionReport(claim.at, claim.legs, gauge, 'last');
      scan = scanConservation({
        legs: claim.legs,
        total: claim.at.q,
        from: g.bayX + g.bayW,
        to: g.collectX,
        samples: 33,
        gauge,
      });
      junctionName = 'COLLECT';
      const claimRun = g.collectX - g.bayX - g.bayW;
      /* the collector is where a narrow canvas still has room for a bubble:
         nothing else competes for the wedge above and below the merge */
      const idx = claimRun >= 132 ? [0, 1, 2, 3] : claimRun >= 34 ? [1, 2] : [];
      const taps = claimRun >= 132 ? GR_TAP_CLAIM : [0, 0.3, 0.3, 0];
      idx.forEach((i) => {
        const r = claim.legs[i];
        if (r === undefined) return;
        const x = g.bayX + g.bayW + claimRun * (taps[i] ?? 0.25);
        const s = sampleAt(r, x);
        /* on a narrow canvas both bubbles go UP: the gutter under a bay is the
           bay's own reading, and a bubble dropped into it lands on the label */
        const dir = claimRun >= 132 ? (GR_TAP_DIR[i] ?? -1) : -1;
        if (s !== null && s.q > 0) paths.meters.push({ x, y: s.c, q: s.q, w: s.w, dir, n: i + 1 });
      });
    } else {
      burnSize = 22;
      burnerY = g.trunkY - 15;
      report = junctionReport(at, splitLegs, gauge, 'first');
      scan = scanConservation({ legs: splitLegs, total: 0, from: g.splitX, to: g.bayX, samples: 33, gauge });
      junctionName = 'SHUT';
    }
    burnRate = grSum(claimRate) * GR_BURN_RATIO;

    /* the control: the same splitFlow and the same junctionReport, on a fan
       whose second leg is 0.4% short of what the trunk says it took */
    const ctlQ = grLegs(GR_OUT_RATE, tAll);
    const ctlLegs = splitFlow({
      gauge,
      at: { x: g.splitX, c: g.trunkY, q: GR_OUT_RATE },
      legs: [0, 1, 2, 3].map((i) => ({
        key: 'ctl' + i,
        q: (ctlQ[i] ?? 0) * (i === 1 ? GR_CONTROL_LEAK : 1),
        to: { x: g.bayX, c: bays[i]?.c ?? g.trunkY },
      })),
      steps: 18,
    });
    controlPx = junctionReport(
      { x: g.splitX, c: g.trunkY, q: GR_OUT_RATE },
      ctlLegs,
      gauge,
      'first',
    ).pxErr;
  }

  /* ---- the paint: draw ops only ----------------------------------------- */
  /** A valve, part-open. The ground-coloured halo under the outline is what
   *  lets the glyph read while sitting ON a band of its own colour — gapping
   *  the band around it instead only works while the canvas is wide. */
  function drawValve(x: number, y: number, size: number, open: number, fill: string, vertical = false): void {
    valve(flowCtx, x, y, { ink: ink.panel, size, open: false, weight: 4, vertical });
    valve(flowCtx, x, y, { ink: ink.muted, size, open: false, vertical });
    if (open <= 0.001) return;
    flowCtx.save();
    flowCtx.globalAlpha = Math.min(1, open);
    valve(flowCtx, x, y, { ink: ink.muted, size, open: true, fill, vertical });
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
    const flowing = paths.trunk !== null;
    const claiming = paths.runs.length > 0;
    const half = (GR_OUT_RATE * g.gFlow) / 2;

    /* ---- the plant at rest: PROCESS_REST, and only where nothing is moving.
       A hairline that runs beside a live band is a ghost edge on one side of a
       ribbon; a hairline standing in for a band that is not there is a route.
       Only the second is a reading, so only the second is painted. */
    setStroke(ctx, PROCESS_REST, ink.ruleStrong);
    ctx.beginPath();
    if (paths.charge === null) {
      ctx.moveTo(0, g.inletY);
      ctx.lineTo(g.vesselX, g.inletY);
    }
    if (!flowing) {
      ctx.moveTo(g.vesselX + g.vesselW, g.trunkY);
      ctx.lineTo(g.splitX, g.trunkY);
    }
    if (!claiming) {
      ctx.moveTo(g.collectX, g.trunkY);
      ctx.lineTo(g.sinkX, g.trunkY);
      ctx.moveTo(g.burnX, g.gbxTop);
      ctx.lineTo(g.burnX, burnerY);
    }
    ctx.stroke();
    for (const pipe of paths.pipeSplit) ctx.stroke(pipe);
    for (const pipe of paths.pipeClaim) ctx.stroke(pipe);

    /* ---- then the flows, which are the only things with width ------------ */
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
    /* the GBX band, down its own axis. Neutral white at full ribbon weight:
       the burn is half of what this protocol does, and a scratch of grey would
       say it was an afterthought. */
    if (paths.gbx !== null) {
      ctx.save();
      ctx.translate(g.burnX, 0);
      ctx.rotate(Math.PI / 2);
      /* through the kit's own neutral treatment, so every neutral band on the
         page is painted by one function. This run goes DOWN the page and so
         has no underside — see GBX_SHADE — and takes the flat fill. */
      fillNeutral(ctx, paths.gbx);
      ctx.restore();
    }

    /* ---- the bays — stock, on the published bay axis ---------------------- */
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
      ctx.setLineDash([]);
      ctx.strokeRect(g.bayX + 0.5 / dpr, top + 0.5 / dpr, g.bayW, g.bayH);

      /* One STOCK reading, in the published form: the name and the number on
         one line, ticked to the bay that holds it. Two lines floating in the
         gutter sat 3.3px under the bay they named and 3.0px above the one they
         did not, which is a caption belonging to whichever bay the reader
         guessed. */
      ctx.strokeStyle = ink.ruleStrong;
      ctx.beginPath();
      ctx.moveTo(g.bayX + g.bayW / 2, top + g.bayH);
      ctx.lineTo(g.bayX + g.bayW / 2, top + g.bayH + 4);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.font = mono(10, 600);
      ctx.fillStyle = ink.hi;
      /* left-aligned ON the bay's own left edge rather than centred under it:
         centred, the reading overhangs into the corridor the legs climb
         through, and at 390 a leg ran straight across its own bay's label */
      ctx.fillText((ASSETS[i]?.sym ?? '') + '  ' + fix(stock, 1), g.bayX, top + g.bayH + 12.5);
    }
    /* the bay axis, stated once and drawn on the mechanism: 0 at the floor,
       the published top at the rim. Every bay is the same box on the same
       axis, so it is marked once rather than four times. */
    ctx.strokeStyle = ink.ruleStrong;
    ctx.setLineDash([]);
    const axTop = (g.lanes[0] ?? 0) - g.bayH / 2;
    const axBot = axTop + g.bayH;
    const axX = g.bayX + g.bayW;
    ctx.beginPath();
    ctx.moveTo(axX, axTop + 0.5 / dpr);
    ctx.lineTo(axX + 6, axTop + 0.5 / dpr);
    ctx.moveTo(axX, axBot - 0.5 / dpr);
    ctx.lineTo(axX + 6, axBot - 0.5 / dpr);
    ctx.moveTo(axX + 3, axTop);
    ctx.lineTo(axX + 3, axBot);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = mono(9, 500);
    ctx.fillStyle = ink.muted;
    ctx.fillText(String(GR_BAY_FULL), axX + 9, axTop + 4);
    /* the zero sits ABOVE its tick, so it cannot crowd the bay's own reading
       on the line below */
    ctx.fillText('0', axX + 9, axBot - 2);

    /* ---- mechanisms ------------------------------------------------------- */
    vessel(ctx, g.vesselX, g.vesselY, {
      ink: ink.muted,
      w: g.vesselW,
      h: g.vesselH,
      level: Math.min(1, vesselLevel / GR_VESSEL_FULL),
      levelFill: USDG,
    });
    /* the vessel's capacity, marked the way the bay axis is — on the far side
       from the inlet, because a mark laid over an incoming band is a mark on
       the band */
    ctx.strokeStyle = ink.ruleStrong;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(g.vesselX + g.vesselW, g.vesselY + 0.5 / dpr);
    ctx.lineTo(g.vesselX + g.vesselW + 5, g.vesselY + 0.5 / dpr);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = mono(9, 500);
    ctx.fillStyle = ink.muted;
    ctx.fillText(String(GR_VESSEL_FULL), g.vesselX + g.vesselW + 7, g.vesselY + 4);

    /* A valve is a STATE, not a quantity, so it is the one thing in this figure
       that eases: both gates cross-fade over --t-base on the page's own --ease
       (lib/ease.ts reads the token at runtime), which is why a canvas beat here
       lands on the same curve as a CSS transition beside it. Nothing a width
       depends on is eased — that would be drawing a number the model never
       had. */
    const gate = (from: number, to: number) => ramp(t, from, from + 0.2) - ramp(t, to, to + 0.2);
    const outletGate = gate(GR_T_OUT_OPEN, GR_T_OUT_SHUT);
    const burnGate = gate(GR_T_HOLD_END, GR_T_CLAIM_END);
    drawValve(g.valveX, g.trunkY, GR_OUT_RATE * g.gFlow + 10, outletGate, USDG);
    splitter(ctx, g.splitX, g.trunkY, { ink: ink.muted, size: Math.min(18, g.bayH * 0.4) });
    /* the burn valve is on the GBX line, vertical, and its fill is the
       substance it passes: what this valve opens is the destruction of GBX, not
       the passage of the assets, which continue underneath it either way */
    drawValve(g.burnX, (g.gbxTop + burnerY) / 2, burnSize, burnGate, GBX, true);
    /* GBX dies here. The bar spans the band so a wide flow runs into a wall. */
    sink(ctx, g.burnX, burnerY, {
      ink: ink.muted,
      size: burnSinkSize,
      fill: ink.muted,
      barH: Math.max(18, burnRate * g.gFlow),
      angle: Math.PI / 2,
    });
    sink(ctx, g.sinkX, g.trunkY, {
      ink: ink.muted,
      size: g.sinkSize,
      fill: ink.muted,
      barH: Math.max(18, GR_OUT_RATE * g.gFlow),
    });

    /* ---- the control signal: a node, a stem, and one bus ------------------
       The stem says WHERE the signal acts — on the splitter. The bus says WHAT
       it set: it crosses all four legs at one station and prints the share at
       each crossing. Before this the pink line was pixel-identical at every
       instant while the leg widths swung threefold, which is a control with no
       reading on the one mechanism that causes the whole split. */
    node(ctx, g.splitX, g.nodeY, { ink: ink.pink, size: 14 });
    setStroke(ctx, SIGNAL, ink.pink);
    ctx.beginPath();
    ctx.moveTo(g.splitX, g.nodeY + 7);
    ctx.lineTo(g.splitX, g.trunkY - Math.min(18, g.bayH * 0.4) - 2);
    const bus = paths.bus;
    if (bus !== null) {
      /* the bus leaves the stem BELOW the node's own label, not through it */
      ctx.moveTo(g.splitX, g.nodeY + 13);
      ctx.lineTo(bus.x, g.nodeY + 13);
      ctx.lineTo(bus.x, bus.y1);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    /* the ratio, printed at the crossing of the bus and the leg it sets */
    ctx.font = mono(9, 600);
    ctx.textAlign = bus !== null && bus.right ? 'left' : 'right';
    ctx.fillStyle = ink.pinkLabel;
    for (const s of paths.shares) {
      const lx = bus !== null && bus.right ? s.x + 4 : s.x - 4;
      /* cleared off the band by the band's OWN half-width: a share printed at a
         fixed offset lands on top of its own leg as soon as that leg is wide */
      ctx.fillText(fix(s.pct, 0) + '%', lx, s.dir < 0 ? s.edge - 4 : s.edge + 11);
    }

    /* ---- the collector's stack, named in order ----------------------------
       Four stripes of similar lightness carried identity by hue alone for a
       third of the figure's width. Position is the second channel: the stack is
       always in bay order, and the placard says which stripe is which without
       a reader having to distinguish two purples. */
    if (paths.stack.length > 0) {
      const stackBot = g.trunkY + (GR_OUT_RATE * g.gFlow) / 2;
      const rowTop = stackBot + 26;
      ctx.font = mono(9, 600);
      const labelX = g.collectX + 26;
      paths.stack.forEach((s, i) => {
        const lx = g.collectX + 6 + (3 - i) * 4;
        const ry = rowTop + i * 11;
        /* the leader is drawn in two inks: dark where it crosses the bands, so
           it reads as a callout rather than as a seam between two stripes, and
           in the resting-route grey once it is out in the open */
        setStroke(ctx, PROCESS_REST, ink.bg);
        ctx.beginPath();
        ctx.moveTo(lx, s.c);
        ctx.lineTo(lx, stackBot);
        ctx.stroke();
        setStroke(ctx, PROCESS_REST, ink.ruleStrong);
        ctx.beginPath();
        ctx.moveTo(lx, stackBot);
        ctx.lineTo(lx, ry - 3);
        ctx.lineTo(labelX - 3, ry - 3);
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = ink.hi;
        ctx.fillText(s.sym, labelX, ry);
      });
      /* the title only where the whole of it fits clear of the sink's own
         label — the rule itself is published in the key, so the placard can
         lose its heading without losing its meaning */
      ctx.font = mono(8.5, 500);
      ctx.fillStyle = ink.muted;
      const titleW = ctx.measureText('STACK ORDER').width;
      if (g.sinkX - (g.collectX + 6) > titleW + 26) ctx.fillText('STACK ORDER', g.collectX + 6, rowTop - 9);
    }

    /* ---- the readings ----------------------------------------------------
       Each bubble is anchored to the band it measures, at that band's own
       centreline, and offset clear of it: a callout must track what it names
       and must not sit on top of it. */
    paths.meters.forEach((m) => {
      const lift = g.tagR + 11 + m.w / 2;
      const cy = Math.min(g.h - g.tagR - 2, Math.max(g.tagR + 2, m.y + m.dir * lift));
      tag(ctx, m.x, cy, {
        ink: ink.muted,
        r: g.tagR,
        tag: 'FI' + m.n,
        value: fix(m.q, 1),
        from: { x: m.x, y: m.y },
        tagFont: mono(Math.max(7, g.tagR * 0.52), 500),
        valueFont: mono(Math.max(8, g.tagR * 0.62), 600),
        tagInk: ink.muted,
        valueInk: ink.hi,
        ground: ink.panel,
      });
    });
    /* and one on the burn, because the quantity destroyed is the price of
       everything leaving on the other line */
    if (burnRate > 0) {
      const bw = burnRate * g.gFlow;
      const bx = g.burnX - g.tagR - 9 - bw / 2;
      tag(ctx, bx, g.gbxTop + 22, {
        ink: ink.muted,
        r: g.tagR,
        tag: 'FQ',
        value: fix(burnRate, 1),
        from: { x: g.burnX - bw / 2, y: g.gbxTop + 22 },
        tagFont: mono(Math.max(7, g.tagR * 0.52), 500),
        valueFont: mono(Math.max(8, g.tagR * 0.62), 600),
        tagInk: ink.muted,
        valueInk: ink.hi,
        ground: ink.panel,
      });
    }

    /* ---- labels — mono, on the mechanism they name ------------------------ */
    ctx.textAlign = 'left';
    ctx.font = mono(9.5, 600);
    ctx.fillStyle = ink.muted;
    if (paths.charge !== null) ctx.fillText('IN', 2, g.inletY - (GR_IN_RATE * g.gFlow) / 2 - 6);
    /* centred on the vessel, but never off the left edge: at 390 the vessel is
       18px wide and 18px from the frame, so a centred reading loses its first
       letter to the container it lives in */
    const centred = (txt: string, cx: number, y: number): void => {
      ctx.textAlign = 'left';
      ctx.fillText(txt, Math.max(2, cx - ctx.measureText(txt).width / 2), y);
    };
    centred('VESSEL', g.vesselX + g.vesselW / 2, g.vesselY + g.vesselH + 13);
    /* the vessel's own STOCK reading, in the same published form as a bay's */
    ctx.strokeStyle = ink.ruleStrong;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(g.vesselX + g.vesselW / 2, g.vesselY + g.vesselH + 16);
    ctx.lineTo(g.vesselX + g.vesselW / 2, g.vesselY + g.vesselH + 20);
    ctx.stroke();
    ctx.font = mono(10, 600);
    ctx.fillStyle = ink.hi;
    centred('HELD  ' + fix(vesselLevel, 1), g.vesselX + g.vesselW / 2, g.vesselY + g.vesselH + 29);
    ctx.font = mono(9.5, 600);
    ctx.fillStyle = ink.muted;
    /* under the splitter, and clear of the widest the trunk can ever be, so
       the label sits in the wedge the fan has not opened into yet */
    /* below the splitter where the fan leaves room, beside it where it does
       not: at 390 the corridor is 50px and the label and the shares were
       contending for the same 30px of it */
    const splitHalf = Math.min(18, g.bayH * 0.4) * 0.58;
    if (g.w < 560) {
      ctx.textAlign = 'right';
      ctx.fillText('SPLIT', g.splitX - splitHalf - 6, g.trunkY + half + 16);
      ctx.textAlign = 'center';
    } else ctx.fillText('SPLIT', g.splitX, g.trunkY + half + 28);
    ctx.textAlign = 'left';
    ctx.fillText('SIGNAL', g.splitX + 12, g.nodeY + 4);
    ctx.textAlign = 'center';
    ctx.fillText('BURN GBX', g.burnX, g.gbxTop - 12);
    ctx.fillText('OUT', g.sinkX, g.trunkY + Math.max(24, GR_OUT_RATE * g.gFlow / 2 + 15));

    /* ---- the two gauges, drawn rather than asserted ------------------------
       Both are VERTICAL, because every quantity on this figure is a vertical
       extent: a band's width and a bay's level. A horizontal scale bar asked a
       reader to rotate it in their head before they could lay it on anything.
       Flow in px per unit/s, stock in px per unit — the page-wide pair. */
    const flowH = GR_OUT_RATE * g.gFlow;
    const stockH = GR_BAY_FULL * g.gStock;
    const gy = g.h - 8;
    const fy = gy - stockH - 10;
    ctx.setLineDash([]);
    ctx.fillStyle = USDG;
    ctx.fillRect(6, fy - flowH, 9, flowH);
    ctx.textAlign = 'left';
    ctx.font = mono(9, 500);
    ctx.fillStyle = ink.muted;
    ctx.fillText('= ' + GR_OUT_RATE + ' UNITS/S', 19, fy - flowH / 2 + 3.5);
    /* the stock gauge is drawn in the BAY's own form — an outlined box, not a
       filled bar — so the two gauges cannot be confused with one another and
       neither borrows a hue from the colour law */
    ctx.strokeStyle = ink.muted;
    ctx.lineWidth = 1;
    ctx.strokeRect(6 + 0.5 / dpr, gy - stockH + 0.5 / dpr, 9, stockH);
    ctx.fillStyle = ink.muted;
    ctx.fillText('= ' + GR_BAY_FULL + ' UNITS', 19, gy - stockH / 2 + 3.5);

    /* ---- the readouts ----------------------------------------------------- */
    const caption =
      ph === 'charge'
        ? 'capital arriving, the outlet still shut'
        : ph === 'both'
          ? 'arriving and dividing at the same time — two stations live'
          : ph === 'fill'
            ? 'the signal is dividing what the vessel still holds'
            : ph === 'hold'
              ? 'both valves shut, the bays full, nothing moving'
              : ph === 'claim'
                ? 'GBX burns and every bay releases the same share'
                : 'the bays are empty and it all left through the sink';
    rPhase.textContent = 'cycle ' + String(cycle).padStart(2, '0') + ' · ' + ph + ' — ' + caption;
    rName.textContent = junctionName;
    rTrunk.textContent = fix(report.parentQ, 3);
    rLegs.textContent = fix(report.legQ, 3);
    rDpx.textContent = sci(report.pxErr);
    rSeam.textContent = sci(report.maxSeamPx);
    rScan.textContent = sci(scan.maxAbsPxErr);
    rCtl.textContent = sci(controlPx);

    const bays = grSum(bay);
    const delta = held + bays + claimedOut - chargedIn;
    rIn.textContent = fix(chargedIn, 3);
    rVessel.textContent = fix(held, 3);
    rBays.textContent = fix(bays, 3);
    rOut.textContent = fix(claimedOut, 3);
    rDelta.textContent = sci(delta) + (chargedIn > 0 ? '  (' + sci(Math.abs(delta) / chargedIn) + ')' : '');
    rBurn.textContent = fix(burned, 3);
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
    /* The still has to teach, and it has to teach the whole grammar: it lands
       in the SECOND cycle, 3.7s in, where the inlet is still running while the
       outlet is already dividing — two stations carrying material at once —
       with the vessel part full, four unequal legs each carrying a reading and
       a share, four bays at different stock, the burn station drawn at rest
       with its valve visibly shut, and a ledger that has already had to
       balance across one cycle boundary. */
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
