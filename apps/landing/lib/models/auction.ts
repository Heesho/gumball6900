/**
 * lib/models/auction.ts — one live acquisition auction, MOVED here from
 * components/sections/Fund.tsx.
 *
 * THE ONE RULE: frozen. `openAuction` · `seedHistory` · `fill` · `aucStep` are
 * the bodies that shipped, textually unchanged apart from the mechanical edits
 * the move required:
 *
 *   · the `auc` closure object became the `AucState` the caller owns
 *     (`auc.t` → `s.t`);
 *   · the two DOM touches in `aucStep` and the four in `fill` / `openAuction` /
 *     `clearReceipt` became the `AucFx` sink: `meet(text, met)`, `receipt(…)`,
 *     `fadeReceipt()`, `clearReceipt()`, `flashTrader()`, `flashSplit()`.
 *
 * docs/MODELS.md §4 traps, all still true here: both stacks are in QQQ; the
 * settle price is the ask at the moment of crossing, not `fair()`; the lot
 * grows during the open phase and display values are frozen at fill; after
 * settling the lot resets to a random ~420–600 USDG rather than 0; the 90/10
 * split is applied to the QQQ paid, at settle time.
 */

export const QQQ = 486; /* $ per unit — illustrative */
export const EPOCH = 21600; /* six-hour epoch, inside Strategy's 1h-365d bounds */
export const BRIBE = 0.1; /* signaler share: default 10%, capped at 20% in code */
export const TS = 450; /* harness timeScale: 1 real s = 450 sim s */
/* A reader arrives mid-auction rather than at second zero, so the first
   settle lands ~6s after the panel scrolls in instead of ~13s. */
export const SEED = EPOCH * 0.12;
/* The settle window. The pour starts on the frame the ring appears and
   runs the whole window: a labelled stage is never left with nothing on
   it. What holds the argument to the end is not the candy but the ghost
   of the lot — a hatched band standing at the settle height, revealed as
   the lot leaves, with the meet-line and the ring still on top of it.
   The pour finishes at DRAIN_END and the window runs on: the empty vessel
   — hatch still standing, ask frozen, surface at nothing — is the frame
   that says the whole lot went to the buyer, so it is HELD before the
   cut rather than flashed for a frame. */
export const DRAIN_END = 3.5;
export const EMPTY_HOLD = 0.4;
export const TRADE_END = DRAIN_END + EMPTY_HOLD;
/* the pour: a beat of contact, then it empties, accelerating */
export const drainAt = (u: number) => {
  const x = Math.max(0, Math.min(1, u));
  return x * (0.34 + 0.66 * x);
};
/** inverse of drainAt: when the pour has given up `frac` of the lot */
export const drainU = (frac: number) => (-0.34 + Math.sqrt(0.1156 + 2.64 * frac)) / 1.32;
/* the departures are the pour: sphere i leaves as the level passes its own
   course, over the first 62% of the lot — the tail drains behind them so
   the last sphere still lands inside the window */
export const USDG_N = 12;
export const USDG_SP = 1 / 0.85; /* one real second of flight, near enough */
export const RETURN_SP = 1 / 1.05;
export const PAY_LANDS = 2.05; /* the return leg touches down; the wells rise then */
export const PAY_RISE = 0.72; /* real seconds the pile — and the ruler — take to move */
/* THE RULER. It opens low enough that the lot the reader arrives holding
   is candy on sight and the first live settle is a real pour — and high
   enough that the pile has somewhere to climb for the next six. It is
   shared by both destinations, so 90/10 stays one comparison. */
export const CAP0 = 10; /* QQQ — where the axis opens */
export const FILL_TRIG = 0.92; /* above this the next total no longer fits under it */
/* When the ruler has to grow, the payment still closes this much of what
   is left between the surface and the rim — so the level always RISES on
   the beat, and the relabel reads as headroom added, not candy removed. */
export const CLOSE = 0.3;
export const FILL_MAX = 0.985;
export const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
export const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);

/* a coin knows when it left and how fast it flies; its position is read
   off the settle clock, so nothing accumulates drift across a frame drop */
export interface Coin {
  t0: number;
  sp: number;
  kind: 'usdg' | 'fund' | 'sig';
}
export interface Drop {
  x: number;
  p: number;
}

export interface AucState {
  t: number;
  phase: 'open' | 'trade';
  tradeT: number;
  lot: number;
  inflow: number;
  ask: number;
  initialAsk: number;
  started: number;
  openedAt: number;
  fundTotal: number;
  sigTotal: number;
  fundShown: number;
  sigShown: number;
  toFund: number;
  toSig: number;
  cap: number;
  capShown: number;
  capTo: number /* where the ruler is going on THIS payment's beat */;
  capLit: number /* the axis stays emphasised for a beat after it moves */;
  payFund0: number /* the surfaces the payment beat starts from */;
  paySig0: number;
  payCap0: number;
  epoch: number;
  parts: Coin[];
  drops: Drop[];
  dropT: number;
  deltaT: number /* -1 = no receipt showing */;
  lastPaid: number;
  lastLot: number;
  landed: boolean;
  still: boolean;
  /* geometry stashed by the stage paint so the overlay can launch the lot
     from the vessel's actual surface at any breakpoint */
  geo: { mouthX: number; rimRightX: number; rimY: number; surfaceY: number };
}

export interface AucFx {
  /** the meet-line caption, and whether the two have met */
  meet?: (text: string, met: boolean) => void;
  /** the two-tone receipt, which LIVES FOR ONE EVENT */
  receipt?: (lastLot: number, lastPaid: number, toFund: number, toSig: number) => void;
  fadeReceipt?: () => void;
  receiptIsFading?: () => boolean;
  clearReceipt?: () => void;
  flashTrader?: () => void;
  /** the asset's return leg arrives: light the split */
  flashSplit?: () => void;
}

export function fair(s: AucState): number {
  return s.lot / QQQ;
}

export function createAucState(): AucState {
  return {
    t: 0,
    phase: 'open',
    tradeT: 0,
    lot: 486,
    inflow: 0.045,
    ask: 0,
    initialAsk: 0,
    started: 0,
    openedAt: 0,
    fundTotal: 0,
    sigTotal: 0,
    fundShown: 0,
    sigShown: 0,
    toFund: 0,
    toSig: 0,
    cap: CAP0,
    capShown: CAP0,
    capTo: CAP0,
    capLit: 0,
    payFund0: 0,
    paySig0: 0,
    payCap0: CAP0,
    epoch: 0,
    parts: [],
    drops: [],
    dropT: 0,
    deltaT: -1,
    lastPaid: 0,
    lastLot: 0,
    landed: false,
    still: false,
    geo: { mouthX: 0, rimRightX: 0, rimY: 0, surfaceY: 0 },
  };
}

export function openAuction(s: AucState, fx: AucFx, seed: number): void {
  s.phase = 'open';
  s.started = s.t - seed;
  s.openedAt = s.t;
  s.initialAsk = fair(s) * (1.85 + Math.random() * 0.35);
  s.lot += s.inflow * seed;
  s.ask = s.initialAsk * (1 - seed / EPOCH);
  s.landed = false;
  s.parts = [];
  s.drops = [];
  s.dropT = 0;
  fx.meet?.('settles when they meet', false);
}

/* A READER ARRIVES AT A STRATEGY THAT IS ALREADY RUNNING. The lot in front
   of them is part-grown and the ask part-fallen; the treasury it feeds is
   likewise not at zero. That opening pile is not asserted — it is stepped:
   one auction is opened, run against the model's own equations until the
   ask meets what the lot is worth, and its ninety/ten booked. So the
   vessel a cold arrival meets is holding a lot the model actually settled,
   and the panel never spends its first ten seconds as two empty boxes. */
export function seedHistory(s: AucState, fx: AucFx): void {
  s.lot = 420 + Math.random() * 180;
  openAuction(s, fx, 0);
  let guard = 0;
  while (s.ask > fair(s) && guard++ < 4000) {
    const dt = 30;
    s.t += dt;
    s.lot += s.inflow * dt;
    const elapsed = s.t - s.started;
    s.ask = elapsed >= EPOCH ? 0 : s.initialAsk * (1 - elapsed / EPOCH);
  }
  s.fundTotal = s.ask * (1 - BRIBE);
  s.sigTotal = s.ask * BRIBE;
  s.fundShown = s.fundTotal;
  s.sigShown = s.sigTotal;
  s.epoch = 1;
  s.cap = CAP0;
  s.capShown = CAP0;
  s.capTo = CAP0;
  s.capLit = 0;
  s.lot = 420 + Math.random() * 180;
  openAuction(s, fx, SEED);
}

export function fill(s: AucState, fx: AucFx): void {
  s.phase = 'trade';
  s.tradeT = 0;
  s.lastPaid = s.ask;
  s.lastLot = s.lot;
  s.toFund = s.lastPaid * (1 - BRIBE);
  s.toSig = s.lastPaid * BRIBE;
  s.fundTotal += s.toFund;
  s.sigTotal += s.toSig;
  /* THE RULER MOVES WITH THE PAYMENT — never on its own, and never after
     it. When the new total will not fit under the ceiling, the ceiling is
     raised on the very beat the spheres land, and the new maximum is
     chosen from the surface that is currently on screen so that the
     post-payment surface stands HIGHER than the pre-payment one. The pile
     and the ruler then run on ONE eased progress (aucStep), and
     level = total/ceiling is monotone in that progress exactly when
     post > pre — so no frame in between can show the pile fall. */
  s.payFund0 = s.fundShown;
  s.paySig0 = s.sigShown;
  s.payCap0 = s.capShown;
  s.capTo = s.cap;
  if (s.fundTotal > s.cap * FILL_TRIG) {
    const pre = s.payFund0 / Math.max(1e-6, s.payCap0);
    const post = Math.min(FILL_MAX, pre + CLOSE * (1 - pre));
    s.capTo = Math.max(s.cap, s.fundTotal / post);
  }
  s.epoch++;
  s.drops = [];
  /* The lot empties into the trader; the asset comes back and splits.
     Ten spheres return — nine to the treasury, one to the signalers — so
     the 90/10 is countable as well as coloured. Each USDG sphere leaves as
     the level passes its own course: the pour and the transfer are one
     event, not a drain beside an unrelated flight of coins. */
  s.parts = [];
  for (let i = 0; i < USDG_N; i++) {
    s.parts.push({ t0: drainU(((i + 0.6) / USDG_N) * 0.62) * DRAIN_END, sp: USDG_SP, kind: 'usdg' });
  }
  for (let f = 0; f < 9; f++) s.parts.push({ t0: 1.0 + f * 0.115, sp: RETURN_SP, kind: 'fund' });
  s.parts.push({ t0: 1.575, sp: RETURN_SP, kind: 'sig' });
  fx.meet?.('they met — settled', true);
  /* the receipt: two-tone, and it LIVES FOR ONE EVENT. deltaT ages it out
     so an open auction never asserts a settle that is not happening. */
  s.deltaT = 0;
  fx.receipt?.(s.lastLot, s.lastPaid, s.toFund, s.toSig);
  fx.flashTrader?.();
}

export function aucStep(s: AucState, dt: number, fx: AucFx): void {
  /* dt is simulated seconds (x450) */
  s.t += dt;
  const rdt = dt / TS;
  /* the receipt ages on the sim's own accumulated time, never wall-clock */
  if (s.deltaT >= 0 && !s.still) {
    s.deltaT += rdt;
    /* the figure outlives the arrival it names: it is still on screen while
       the asset lands and the two vessels rise, and gone before the next
       auction opens */
    if (s.deltaT > 2.45 && !(fx.receiptIsFading?.() ?? true)) {
      fx.fadeReceipt?.();
    }
    if (s.deltaT > 3.1) fx.clearReceipt?.();
  }
  if (s.phase === 'open') {
    s.lot += s.inflow * dt; /* the lot keeps growing during the auction */
    const elapsed = s.t - s.started;
    s.ask = elapsed >= EPOCH ? 0 : s.initialAsk * (1 - elapsed / EPOCH);
    /* the stream keeps arriving: a slow drip into the open vessel */
    s.dropT += rdt;
    if (s.dropT > 0.7 && s.drops.length < 3) {
      s.dropT = 0;
      s.drops.push({ x: 0.16, p: 0 });
    }
    s.drops.forEach((d) => {
      d.p += rdt * 1.5;
    });
    s.drops = s.drops.filter((d) => d.p < 1);
    if (s.ask <= fair(s)) fill(s, fx);
  } else {
    s.tradeT += rdt;
    if (!s.landed && s.tradeT > PAY_LANDS) {
      s.landed = true; /* the asset's return leg arrives: light the split */
      fx.flashSplit?.();
    }
    if (s.tradeT > TRADE_END) {
      /* an event lasts ONE event: whatever the frame rate did, no receipt
         from the settle just closed survives into the auction just opened */
      fx.clearReceipt?.();
      s.fundShown = s.fundTotal;
      s.sigShown = s.sigTotal;
      s.cap = s.capTo;
      s.capShown = s.capTo;
      s.lot = 420 + Math.random() * 180;
      openAuction(s, fx, 0);
    }
  }
  /* THE PAYMENT BEAT. The pile rises WHEN THE ASSET LANDS, not when the
     model books it — and the ruler, if it has to grow, grows on the same
     progress, so the two can never be read as separate events and the
     surface is a monotone function of one number. */
  if (s.phase === 'trade') {
    const u = easeOut(clamp01((s.tradeT - PAY_LANDS) / PAY_RISE));
    s.fundShown = s.payFund0 + (s.fundTotal - s.payFund0) * u;
    s.sigShown = s.paySig0 + (s.sigTotal - s.paySig0) * u;
    s.capShown = s.payCap0 + (s.capTo - s.payCap0) * u;
  }
  s.capLit = Math.abs(s.capTo - s.capShown) > 0.02 ? 1 : Math.max(0, s.capLit - rdt);
}
