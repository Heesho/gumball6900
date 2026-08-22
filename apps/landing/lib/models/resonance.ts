/**
 * lib/models/resonance.ts — the Resonance stream model, MOVED here from
 * components/sections/Resonance.tsx.
 *
 * THE ONE RULE: frozen. The bodies below are the bodies that shipped, textually
 * unchanged apart from the mechanical edits the move required:
 *
 *   · `ASSETS` / `flow` / `cycle` became fields on `ResonanceState`
 *     (`flow.t` → `s.flow.t`, `ASSETS` → `s.assets`);
 *   · the DOM half of `AssetModel` (row, pctEl, deltaEl, barEl, subEl,
 *     rowTimer, lastPct…) left the model: `flashRow(a, scripted)` became
 *     `fx.flashRow(index, scripted)`, and the consumer keeps its own parallel
 *     array of elements;
 *   · the one layout read in `step` — the particle cap's `view.w` — became
 *     `fx.viewW()`.
 *
 * THE DISCONTINUITY. docs/MODELS.md §3: this model "begins after revenue has
 * been forwarded from ResonanceRouter. It accumulates an illustrative weekly
 * amount locally and restarts only after the current display stream finishes.
 * It is deliberately not a claim that a Mine handoff forwards or schedules
 * revenue synchronously." Anything drawing this stream must draw the break
 * above it — see the plate.
 */

export const STREAM = 7 * 86400; /* Resonance.DURATION — seven days, fixed in code */
export const TIME_SCALE = 900;
export const WEEKLY = 46000; /* the illustrative weekly stream, in USDG */
export const LOTS = [1000, 1500, 2000, 3000];
export const SCRIPTED_LOT = 2000;
export const MIN_DWELL = 2600; /* sim s a signaler waits before it can move again */
/* ------------------------------------------------ the split, in transit
   A new split does not appear at the vessels the moment the blades move:
   the fluid has to carry it there. Each channel's thickness at a point is
   sampled from a chain of NODES first-order lags, so the change leaves the
   comb and travels downstream — the blades cut the stream now, the vessel
   end is still carrying last week's split until the front reaches it.
   TRANSIT is the fluid's own pace: a coin that passes the blades as a lot
   lands arrives at its vessel just as that end finishes reshaping. */
export const NODES = 12;
export const TRANSIT = 2100; /* sim s, blades → vessel */
export const NODE_TAU = TRANSIT / NODES;
/* Emphasis: the scripted signal move is the thing this section is about and
   carries the plate; an ambient holder moving on its own clock is the same
   mechanism at a whisper. Every pink mark in the drawing is scaled by it. */
export const EMPH_DRIFT = 0.34;
/* The lot annotation's exit, in p units (p advances 1 per 0.95 real s):
   a single 180ms ramp on which the plane, its type, the leader, the disc
   and the arrival ring all reach zero together. Nothing outlives the rest. */
export const CHIP_TAIL = 0.19;
export const CHIP_END = 1 + CHIP_TAIL;

/* Illustrative strategies. Stakes in GBX; pct/bar/sub are the exact strings the
   fragment's initial updateRows() paints from these stakes (rate seeded to the
   46,000 USDG weekly stream) — rendered in JSX so server HTML has final
   geometry and the first paint shifts nothing. */
export const STRATEGIES = [
  { sym: 'NVDA', stake: 12400, pct: '39%', bar: '39.4%', sub: '12,400 GBX · ≈$18,100/wk at this weight' },
  { sym: 'QQQ', stake: 9200, pct: '29%', bar: '29.2%', sub: '9,200 GBX · ≈$13,400/wk at this weight' },
  { sym: 'WBTC', stake: 6100, pct: '19%', bar: '19.4%', sub: '6,100 GBX · ≈$8,900/wk at this weight' },
  { sym: 'AAPL', stake: 3800, pct: '12%', bar: '12.1%', sub: '3,800 GBX · ≈$5,500/wk at this weight' },
] as const;

export type Stage = 'hold' | 'move' | 'settle' | 'drift';

/* The narration in the panel foot. Nobody operates this panel; the foot says
   which beat of the programme is on screen instead of offering controls. */
export const STAGE_TEXT: Record<Stage, string> = {
  hold: 'hold · weights steady',
  move: 'signal moves',
  settle: 'settle · the split follows',
  drift: 'holders moving on their own clocks',
};

export interface RzAsset {
  sym: string;
  stake: number;
  pot: number /* USDG waiting at the Strategy */;
  dispPot: number /* drawn level — lerps, so a flush drains rather than snaps */;
  disp: number /* displayed stake at the BLADES — lerps toward stake */;
  chain: Float64Array /* the same weight further and further downstream */;
  delta: number /* last move, ±GBX */;
  moved: number /* 1 → 0 decay while a move is fresh */;
  emph: number /* 1 for the scripted signal move, dimmer for ambient drift */;
  flash: number /* 1 → 0 decay after the auction takes the lot */;
  lastLot: number;
  epochEnd: number /* each auction flushes on its own clock */;
  nextMove: number /* this signaler's own reservation */;
  lastMove: number /* … and its own dwell */;
}

export interface RzParticle {
  p: number;
  lane: number;
  off: number /* −.42 … .42 of the channel thickness: the coin's line in the flow */;
  r: number;
}

export interface RzChip {
  from: number;
  to: number;
  p: number;
  lot: number;
}

export interface RzFlow {
  t: number;
  pending: number;
  rate: number;
  finish: number;
  parts: RzParticle[];
  spawnAcc: number;
  chip: RzChip | null;
  refill: number /* 1 → 0 beat while a weekly refill is fresh, and its size */;
  refillAmt: number;
}

/* ------------------------------------------------- the scripted signal beat
   Nobody operates this. The sim runs a four-phase cycle on its own clock —
   sim time, so a section that has never been on screen has not burned its
   cycle: a quiet HOLD so the reader is looking at a still board, the MOVE
   itself (a 2,000 GBX lot out of the largest other Strategy, riding the comb
   face while the blades slide), SETTLE — which is the front travelling from
   the blades to the vessels, the beat the drawing owes its own caption —
   and only then DRIFT, where the ambient signalers are allowed to move, so
   a scripted move is never buried under a random one.
   SETTLE is sized to the transit: the front reaches the far end just before
   the beat ends. DRIFT is long enough that a drift move fired in its first
   window has also finished travelling before HOLD — so hold really holds. */
export const PHASE: Record<Stage, number> = { hold: 1800, move: 1400, settle: 2000, drift: 4400 };
/* 9,600 sim s ÷ 900 = 10.7 real seconds a cycle. */
export const DRIFT_WINDOW = 900; /* sim s at the head of DRIFT in which drift may fire */

export interface ResonanceState {
  assets: RzAsset[];
  flow: RzFlow;
  cycle: { stage: Stage; left: number; target: number };
}

export interface ResonanceFx {
  /** the ledger row flash — full for the scripted move, a whisper for drift */
  flashRow?: (index: number, scripted: boolean) => void;
  /** the canvas's cached CSS width; the particle cap is narrower on a phone */
  viewW?: () => number;
}

export function createResonanceState(): ResonanceState {
  const assets: RzAsset[] = STRATEGIES.map((strat, i) => ({
    sym: strat.sym,
    stake: strat.stake,
    pot: 0,
    dispPot: 0,
    disp: strat.stake,
    chain: new Float64Array(NODES + 1).fill(strat.stake),
    delta: 0,
    moved: 0,
    emph: 1,
    flash: 0,
    lastLot: 0,
    /* Staggered so the first four flushes land inside the first cycle in view,
       then each auction runs on its own random clock from there. */
    epochEnd: 3000 + i * 2600,
    nextMove: 4200 + i * 3100,
    lastMove: -MIN_DWELL,
  }));
  return {
    assets,
    flow: {
      t: 0,
      pending: WEEKLY,
      rate: 0,
      finish: 0,
      parts: [],
      spawnAcc: 0,
      chip: null,
      refill: 0,
      refillAmt: 0,
    },
    cycle: { stage: 'hold', left: PHASE.hold, target: 0 },
  };
}

export function totalStake(s: ResonanceState): number {
  return s.assets.reduce((n, a) => n + a.stake, 0) || 1;
}
export function totalDisp(s: ResonanceState): number {
  return s.assets.reduce((n, a) => n + a.disp, 0) || 1;
}

/* `scripted` is the whole ranking. The plate-and-leader callout — the
   loudest mark the drawing owns — is reserved for the scripted signal move,
   the thing this section is about. An ambient holder moving on its own
   clock is the same mechanism at a whisper: the blades nudge, the ledger
   records the delta, and no plate ever appears. */
export function applyMove(s: ResonanceState, fx: ResonanceFx, from: RzAsset, to: RzAsset, lot: number, scripted: boolean) {
  from.stake -= lot;
  to.stake += lot;
  from.delta = -lot;
  to.delta = lot;
  from.moved = 1;
  to.moved = 1;
  from.emph = scripted ? 1 : EMPH_DRIFT;
  to.emph = from.emph;
  from.lastMove = s.flow.t;
  to.lastMove = s.flow.t;
  /* the lot itself, in flight along the comb face — the transfer, drawn */
  if (scripted) s.flow.chip = { from: s.assets.indexOf(from), to: s.assets.indexOf(to), p: 0, lot };
  fx.flashRow?.(s.assets.indexOf(from), scripted);
  fx.flashRow?.(s.assets.indexOf(to), scripted);
}

/* The note says the lot leaves the largest Strategy, so the SOURCE is picked
   first and the destination works around it. Picking the destination first
   and calling the largest *other* Strategy the source is not the same rule:
   whenever the rotation lands on the Strategy that is already largest, the
   lot ends up flowing into it — the opposite of what the note describes. */
export function largestAsset(s: ResonanceState): RzAsset | null {
  let big: RzAsset | null = null;
  s.assets.forEach((a) => {
    if (a.stake - SCRIPTED_LOT > 800 && (!big || a.stake > big.stake)) big = a;
  });
  return big;
}

/* A holder moves one 2,000 GBX lot out of the largest Strategy and into
   another — the deliberate move the reader is meant to catch. The
   destination still follows the rotation, so all four get demonstrated over
   successive cycles; it only steps past the source. */
function signalFromLargest(s: ResonanceState, fx: ResonanceFx): boolean {
  const big = largestAsset(s);
  if (!big) return false;
  let to: RzAsset | null = null;
  for (let k = 0; k < s.assets.length && !to; k++) {
    const idx = (s.cycle.target + k) % s.assets.length;
    if (s.assets[idx] !== big) {
      to = s.assets[idx]!;
      s.cycle.target = (idx + 1) % s.assets.length;
    }
  }
  if (!to) return false;
  applyMove(s, fx, big, to, SCRIPTED_LOT, true);
  return true;
}

/* Advance the demonstration cycle. Returns true while the ambient
   signalers are allowed to move stake as well. */
function runCycle(s: ResonanceState, fx: ResonanceFx, dt: number): boolean {
  s.cycle.left -= dt;
  if (s.cycle.left > 0) return s.cycle.stage === 'drift';
  if (s.cycle.stage === 'hold') {
    /* One call is the whole attempt: the largest of four Strategies always
       holds a quarter of a conserved total, so it can always spare the lot
       and the move is guaranteed to fire, never left to chance. */
    signalFromLargest(s, fx);
    s.cycle.stage = 'move';
    s.cycle.left = PHASE.move;
  } else if (s.cycle.stage === 'move') {
    s.cycle.stage = 'settle';
    s.cycle.left = PHASE.settle;
  } else if (s.cycle.stage === 'settle') {
    s.cycle.stage = 'drift';
    s.cycle.left = PHASE.drift;
    /* Each ambient signaler gets a fresh reservation on its own clock,
       inside the window whose consequence still lands before HOLD. The
       order is reshuffled every cycle, so it is a different holder that
       gets there first rather than the same one every time. */
    const order = s.assets.map((_, i) => i);
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      const tmp = order[k]!;
      order[k] = order[j]!;
      order[j] = tmp;
    }
    order.forEach((idx, k) => {
      s.assets[idx]!.nextMove = s.flow.t + 80 + k * 165 + Math.random() * 210;
    });
  } else {
    s.cycle.stage = 'hold';
    s.cycle.left = PHASE.hold;
  }
  return s.cycle.stage === 'drift';
}

/* ------------------------------------------------------------------ model */
export function stepResonance(s: ResonanceState, dt: number, fx: ResonanceFx): void {
  const flow = s.flow;
  const cycle = s.cycle;
  const ASSETS = s.assets;
  const viewW = fx.viewW?.() ?? 0;
  const realDt = dt / TIME_SCALE;
  flow.t += dt;

  /* The staged demonstration owns the emphasis; ambient signalers only move
     while it is in its drift window, so two moves never land together. */
  const drifting = runCycle(s, fx, dt);

  /* Signalers move stake in discrete whole lots, not a continuous trickle.
     Four independent actors: each owns a reservation (nextMove) and a dwell
     (lastMove), so they never all decide in the same frame. Drift fires
     only in the head of its beat, because a move started later would still
     be travelling down the channels when HOLD claims the board is steady. */
  if (drifting && cycle.left > PHASE.drift - DRIFT_WINDOW) {
    const busy = ASSETS.some((a) => a.moved > 0.3);
    if (!busy) {
      let pick = -1;
      for (let i = 0; i < ASSETS.length; i++) {
        const a = ASSETS[i]!;
        if (flow.t < a.nextMove || flow.t - a.lastMove < MIN_DWELL) continue;
        if (pick < 0 || a.nextMove < ASSETS[pick]!.nextMove) pick = i;
      }
      if (pick >= 0) {
        const from = ASSETS[pick]!;
        const lot = LOTS[Math.floor(Math.random() * LOTS.length)]!;
        const to = ASSETS[(pick + 1 + Math.floor(Math.random() * (ASSETS.length - 1))) % ASSETS.length]!;
        if (from.stake - lot > 800) applyMove(s, fx, from, to, lot, false);
        from.nextMove = flow.t + 5200 + Math.random() * 6400;
      }
    }
  }

  if (flow.chip) {
    flow.chip.p += realDt / 0.95;
    if (flow.chip.p >= CHIP_END) flow.chip = null;
  }

  /* The marks that name a move outlive it by exactly as long as its
     consequence is still travelling: the delta stands in the ledger until
     the front has reached the vessels, then goes. */
  const carry = 1 - Math.exp(-dt / NODE_TAU);
  ASSETS.forEach((a) => {
    if (a.moved > 0) {
      a.moved = Math.max(0, a.moved - dt / 3400);
      if (a.moved === 0) a.delta = 0;
    }
    if (a.flash > 0) a.flash = Math.max(0, a.flash - dt / 1500);
    /* At the blades the split follows the ledger within ~a second … */
    a.disp += (a.stake - a.disp) * Math.min(1, realDt * 4);
    /* … and downstream it is carried, station by station, at the pace of
       the fluid. Walking the chain backwards is what makes it a transport
       delay and not a smear: each station takes what its upstream
       neighbour held a moment ago, never what it holds now. */
    a.chain[0] = a.disp;
    for (let n = NODES; n >= 1; n--) a.chain[n]! += (a.chain[n - 1]! - a.chain[n]!) * carry;
  });

  /* Illustrative revenue already forwarded from the Router restarts this
     display stream once the last one ends. */
  if (flow.pending > 0 && flow.t >= flow.finish) {
    flow.rate = flow.pending / STREAM;
    flow.finish = flow.t + STREAM;
    flow.refillAmt = flow.pending; /* the refill beat — drawn at the tank */
    flow.refill = 1;
    flow.pending = 0;
  }
  /* The model accrues an illustrative forwarded amount for its next week.
     It does not model or promise the separate permissionless route call. */
  flow.pending += (WEEKLY * dt) / STREAM;
  if (flow.refill > 0) flow.refill = Math.max(0, flow.refill - dt / 1500);

  /* Split the released USDG by the weights as they are right now. */
  const released = flow.t < flow.finish ? flow.rate * dt : 0;
  const total = totalStake(s);
  ASSETS.forEach((a) => {
    a.pot += released * (a.stake / total);
    if (flow.t >= a.epochEnd && a.pot > 0) {
      /* its auction takes the lot */
      a.lastLot = a.pot;
      a.pot = 0;
      a.flash = 1;
      a.epochEnd = flow.t + 9000 + Math.random() * 9000;
    }
    a.dispPot += (a.pot - a.dispPot) * Math.min(1, realDt * 3.4);
  });

  /* Coins: blue USDG, channel picked at the blades by the live weight — so the
     split of the FLOW is instant while the shape of the CHANNEL is not. That is
     the whole of the panel's note: the density changes at the comb the moment a
     lot lands, and the lanes are still catching up behind it. */
  const cap = viewW && viewW < 560 ? 74 : 118;
  if (flow.t < flow.finish && flow.parts.length < cap) {
    flow.spawnAcc += realDt * (viewW && viewW < 560 ? 19 : 30);
    while (flow.spawnAcc >= 1) {
      flow.spawnAcc -= 1;
      const r = Math.random() * total;
      let acc = 0;
      let lane = 0;
      for (let i = 0; i < ASSETS.length; i++) {
        acc += ASSETS[i]!.stake;
        if (r <= acc) {
          lane = i;
          break;
        }
      }
      flow.parts.push({ p: 0, lane, off: (Math.random() - 0.5) * 0.84, r: 0.82 + Math.random() * 0.36 });
    }
  }
  for (let j = flow.parts.length - 1; j >= 0; j--) {
    flow.parts[j]!.p += 0.3 * realDt;
    if (flow.parts[j]!.p >= 1) flow.parts.splice(j, 1);
  }
}
