'use client';

import { useEffect, useLayoutEffect } from 'react';
import { registerSim, startHarness } from '../../lib/harness';

/* ============================================================================
   The specimen's three live instruments.

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

export function SpecimenDriver(): null {
  useLayoutEffect(() => {
    const offs = [mountBoard(), mountTracks(), mountEvents()];
    return () => offs.forEach((off) => off?.());
  }, []);

  // Registration first, then the loop: layout effects run before passive ones,
  // so every sim above is on the list by the time the harness starts.
  useEffect(() => startHarness(), []);

  return null;
}
