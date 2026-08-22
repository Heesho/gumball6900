'use client';

import { useLayoutEffect } from 'react';
import { registerSim, fontFamily } from '../../lib/harness';
import './resonance.css';

/* Illustrative strategies. Stakes in GBX; pct/bar/sub are the exact strings the
   fragment's initial updateRows() paints from these stakes (rate seeded to the
   46,000 USDG weekly stream) — rendered in JSX so server HTML has final
   geometry and the first paint shifts nothing. */
const STRATEGIES = [
  { sym: 'NVDA', stake: 12400, pct: '39%', bar: '39.4%', sub: '12,400 GBX · ≈$18,100/wk at this weight' },
  { sym: 'QQQ', stake: 9200, pct: '29%', bar: '29.2%', sub: '9,200 GBX · ≈$13,400/wk at this weight' },
  { sym: 'WBTC', stake: 6100, pct: '19%', bar: '19.4%', sub: '6,100 GBX · ≈$8,900/wk at this weight' },
  { sym: 'AAPL', stake: 3800, pct: '12%', bar: '12.1%', sub: '3,800 GBX · ≈$5,500/wk at this weight' },
] as const;

type Stage = 'hold' | 'move' | 'settle' | 'drift';

/* The narration in the panel foot. Nobody operates this panel; the foot says
   which beat of the programme is on screen instead of offering controls. */
const STAGE_TEXT: Record<Stage, string> = {
  hold: 'hold · weights steady',
  move: 'signal moves',
  settle: 'settle · the split follows',
  drift: 'holders moving on their own clocks',
};

interface AssetModel {
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
  row: HTMLElement;
  pctEl: HTMLElement;
  deltaEl: HTMLElement;
  barEl: HTMLElement;
  subEl: HTMLElement;
  rowTimer?: ReturnType<typeof setTimeout>;
  lastPct?: string;
  lastDelta?: string;
  lastSub?: string;
}

interface Particle {
  p: number;
  lane: number;
  off: number /* −.42 … .42 of the channel thickness: the coin's line in the flow */;
  r: number;
}

interface Chip {
  from: number;
  to: number;
  p: number;
  lot: number;
}

export function Resonance() {
  useLayoutEffect(() => {
    /* Lifted from the deck's flow sim (docs/deck/gumball6900-deck.html, lines 1365–1589) and
       adapted: the flow ends at each Strategy holding USDG — the purchase is the next section.
       Sim time ×900 like the deck; particles advance in real time so the flow reads at a
       human pace whatever the sim clock does.

       The drawing begins after a separate successful ResonanceRouter.route call. A seven-day
       tank on the left holds the stream that forwarded revenue funds. One undivided blue band
       leaves it. At the comb,
       pink blades cut that band into four contiguous channels whose thicknesses ARE the live
       signal weights — so the four always sum to the whole stream. Each channel pours into a
       vessel that fills with USDG until that Strategy's auction takes the lot. Move signal and
       a pink lot slides along the comb face; the blades slide with it and the channels reshape —
       but not all at once. The blades cut the stream now; the new split has to be carried down
       the channels by the fluid, so for a beat the drawing is genuinely tapered: new at the
       comb, old at the vessels, with the front lit where the change has got to. That beat is
       the one the panel foot calls "settle", and it is the only thing that happens in it. */
    const el = document.getElementById('sec-resonance');
    const canvasNode = document.getElementById('rzCanvas');
    const clockEl = document.getElementById('rzClock');
    const stageEl = document.getElementById('rzStage');
    if (!el || !(canvasNode instanceof HTMLCanvasElement) || !clockEl || !stageEl) return;
    const canvas = canvasNode;
    const ctx2d = canvas.getContext('2d');
    const wrap = canvas.parentElement;
    if (!ctx2d || !wrap) return;
    const g: CanvasRenderingContext2D = ctx2d;

    const css = getComputedStyle(document.documentElement);
    const pick = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const C = {
      pink: pick('--pink', '#F92B92'),
      pinkLabel: pick('--pink-label', '#FB63AC'),
      blue: pick('--blue', '#29B6F0'),
      blueLabel: pick('--blue-label', '#9BDDFA'),
      onField: pick('--on-field', '#0C0C0C'),
      raised: pick('--raised', '#17171F'),
      rule: pick('--rule', '#26262F'),
      ruleStrong: pick('--rule-strong', '#3B3B48'),
      hi: pick('--hi', '#FFFFFF'),
      muted: pick('--muted', '#ADADC0'),
      faint: pick('--faint', '#8A8AA0'),
    };
    const MONO = fontFamily('--font-mono', '"JetBrains Mono", monospace');
    /* The fluid: blue is USDG, everywhere. Alphas only — the ground shows through,
       so channels layer instead of stacking as opaque slabs. The light is the
       panel's own: from above, so every channel is lit along its top edge and
       shaded along its underside, which is what makes it read as a tube. */
    const FLUID_NEAR = 'rgba(41, 182, 240, 0.23)';
    const FLUID_FAR = 'rgba(41, 182, 240, 0.13)';
    const FLUID_LIT = 'rgba(178, 230, 253, 0.46)'; /* the lit top edge of a channel */
    const FLUID_SHADE = 'rgba(2, 7, 13, 0.62)'; /* … and the shaded underside */
    const UNIT = 30; /* USDG per coin in a vessel's pile */

    const STREAM = 7 * 86400; /* Resonance.DURATION — seven days, fixed in code */
    const TIME_SCALE = 900;
    const WEEKLY = 46000; /* the illustrative weekly stream, in USDG */
    const LOTS = [1000, 1500, 2000, 3000];
    const SCRIPTED_LOT = 2000;
    const MIN_DWELL = 2600; /* sim s a signaler waits before it can move again */
    /* ------------------------------------------------ the split, in transit
       A new split does not appear at the vessels the moment the blades move:
       the fluid has to carry it there. Each channel's thickness at a point is
       sampled from a chain of NODES first-order lags, so the change leaves the
       comb and travels downstream — the blades cut the stream now, the vessel
       end is still carrying last week's split until the front reaches it.
       TRANSIT is the fluid's own pace: a coin that passes the blades as a lot
       lands arrives at its vessel just as that end finishes reshaping. */
    const NODES = 12;
    const TRANSIT = 2100; /* sim s, blades → vessel */
    const NODE_TAU = TRANSIT / NODES;
    /* Emphasis: the scripted signal move is the thing this section is about and
       carries the plate; an ambient holder moving on its own clock is the same
       mechanism at a whisper. Every pink mark in the drawing is scaled by it. */
    const EMPH_DRIFT = 0.34;
    /* The lot annotation's exit, in p units (p advances 1 per 0.95 real s):
       a single 180ms ramp on which the plane, its type, the leader, the disc
       and the arrival ring all reach zero together. Nothing outlives the rest. */
    const CHIP_TAIL = 0.19;
    const CHIP_END = 1 + CHIP_TAIL;

    /* Wire the JSX-rendered weight rows to the model — never rebuild them. */
    const rowEls = el.querySelectorAll<HTMLElement>('.rz-row');
    if (rowEls.length !== STRATEGIES.length) return;
    const ASSETS: AssetModel[] = [];
    for (let i = 0; i < STRATEGIES.length; i++) {
      const strat = STRATEGIES[i];
      const row = rowEls[i];
      if (!strat || !row) return;
      const pctEl = row.querySelector<HTMLElement>('.rz-row__pct');
      const deltaEl = row.querySelector<HTMLElement>('.rz-row__delta');
      const barEl = row.querySelector<HTMLElement>('.meter > i');
      const subEl = row.querySelector<HTMLElement>('.rz-row__sub');
      if (!pctEl || !deltaEl || !barEl || !subEl) return;
      ASSETS.push({
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
        row,
        pctEl,
        deltaEl,
        barEl,
        subEl,
      });
    }

    const flow = {
      t: 0,
      pending: WEEKLY,
      rate: 0,
      finish: 0,
      parts: [] as Particle[],
      spawnAcc: 0,
      chip: null as Chip | null,
      refill: 0 /* 1 → 0 beat while a weekly refill is fresh, and its size */,
      refillAmt: 0,
    };

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
    const PHASE: Record<Stage, number> = { hold: 1800, move: 1400, settle: 2000, drift: 4400 };
    /* 9,600 sim s ÷ 900 = 10.7 real seconds a cycle. */
    const DRIFT_WINDOW = 900; /* sim s at the head of DRIFT in which drift may fire */
    const cycle = { stage: 'hold' as Stage, left: PHASE.hold, target: 0 };

    let disposed = false;

    function totalStake() {
      return ASSETS.reduce((n, a) => n + a.stake, 0) || 1;
    }
    function totalDisp() {
      return ASSETS.reduce((n, a) => n + a.disp, 0) || 1;
    }
    function money(x: number) {
      x = Math.max(0, x);
      return '$' + (x >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(2));
    }
    function gbx(x: number) {
      return Math.abs(x).toLocaleString('en-US');
    }

    /* ------------------------------------------------------------ weight rows
       The row flash is ranked too: full strength for the scripted move, a
       whisper for ambient drift. Same event, different standing. */
    function flashRow(a: AssetModel, scripted: boolean) {
      a.row.classList.remove('evt-pink', 'rz-row--soft');
      void a.row.offsetWidth; /* restart the one-shot animation */
      if (!scripted) a.row.classList.add('rz-row--soft');
      a.row.classList.add('evt-pink');
      clearTimeout(a.rowTimer);
      a.rowTimer = setTimeout(() => {
        a.row.classList.remove('evt-pink', 'rz-row--soft');
      }, 1100);
    }

    /* `scripted` is the whole ranking. The plate-and-leader callout — the
       loudest mark the drawing owns — is reserved for the scripted signal move,
       the thing this section is about. An ambient holder moving on its own
       clock is the same mechanism at a whisper: the blades nudge, the ledger
       records the delta, and no plate ever appears. */
    function applyMove(from: AssetModel, to: AssetModel, lot: number, scripted: boolean) {
      from.stake -= lot;
      to.stake += lot;
      from.delta = -lot;
      to.delta = lot;
      from.moved = 1;
      to.moved = 1;
      from.emph = scripted ? 1 : EMPH_DRIFT;
      to.emph = from.emph;
      from.lastMove = flow.t;
      to.lastMove = flow.t;
      /* the lot itself, in flight along the comb face — the transfer, drawn */
      if (scripted) flow.chip = { from: ASSETS.indexOf(from), to: ASSETS.indexOf(to), p: 0, lot };
      flashRow(from, scripted);
      flashRow(to, scripted);
    }

    /* The note says the lot leaves the largest Strategy, so the SOURCE is picked
       first and the destination works around it. Picking the destination first
       and calling the largest *other* Strategy the source is not the same rule:
       whenever the rotation lands on the Strategy that is already largest, the
       lot ends up flowing into it — the opposite of what the note describes. */
    function largestAsset(): AssetModel | null {
      let big: AssetModel | null = null;
      ASSETS.forEach((a) => {
        if (a.stake - SCRIPTED_LOT > 800 && (!big || a.stake > big.stake)) big = a;
      });
      return big;
    }

    /* A holder moves one 2,000 GBX lot out of the largest Strategy and into
       another — the deliberate move the reader is meant to catch. The
       destination still follows the rotation, so all four get demonstrated over
       successive cycles; it only steps past the source. */
    function signalFromLargest(): boolean {
      const big = largestAsset();
      if (!big) return false;
      let to: AssetModel | null = null;
      for (let k = 0; k < ASSETS.length && !to; k++) {
        const idx = (cycle.target + k) % ASSETS.length;
        if (ASSETS[idx] !== big) {
          to = ASSETS[idx]!;
          cycle.target = (idx + 1) % ASSETS.length;
        }
      }
      if (!to) return false;
      applyMove(big, to, SCRIPTED_LOT, true);
      return true;
    }

    /* Advance the demonstration cycle. Returns true while the ambient
       signalers are allowed to move stake as well. */
    function runCycle(dt: number): boolean {
      cycle.left -= dt;
      if (cycle.left > 0) return cycle.stage === 'drift';
      if (cycle.stage === 'hold') {
        /* One call is the whole attempt: the largest of four Strategies always
           holds a quarter of a conserved total, so it can always spare the lot
           and the move is guaranteed to fire, never left to chance. */
        signalFromLargest();
        cycle.stage = 'move';
        cycle.left = PHASE.move;
      } else if (cycle.stage === 'move') {
        cycle.stage = 'settle';
        cycle.left = PHASE.settle;
      } else if (cycle.stage === 'settle') {
        cycle.stage = 'drift';
        cycle.left = PHASE.drift;
        /* Each ambient signaler gets a fresh reservation on its own clock,
           inside the window whose consequence still lands before HOLD. The
           order is reshuffled every cycle, so it is a different holder that
           gets there first rather than the same one every time. */
        const order = ASSETS.map((_, i) => i);
        for (let k = order.length - 1; k > 0; k--) {
          const j = Math.floor(Math.random() * (k + 1));
          const tmp = order[k]!;
          order[k] = order[j]!;
          order[j] = tmp;
        }
        order.forEach((idx, k) => {
          ASSETS[idx]!.nextMove = flow.t + 80 + k * 165 + Math.random() * 210;
        });
      } else {
        cycle.stage = 'hold';
        cycle.left = PHASE.hold;
      }
      return cycle.stage === 'drift';
    }

    /* ------------------------------------------------------------------ model */
    function step(dt: number) {
      const realDt = dt / TIME_SCALE;
      flow.t += dt;

      /* The staged demonstration owns the emphasis; ambient signalers only move
         while it is in its drift window, so two moves never land together. */
      const drifting = runCycle(dt);

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
            if (from.stake - lot > 800) applyMove(from, to, lot, false);
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
      const total = totalStake();
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
      const cap = view.w && view.w < 560 ? 74 : 118;
      if (flow.t < flow.finish && flow.parts.length < cap) {
        flow.spawnAcc += realDt * (view.w && view.w < 560 ? 19 : 30);
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

    /* ----------------------------------------------------------------- canvas */
    const view = { w: 0, h: 0, dpr: 1 };
    function resize() {
      const w = wrap!.clientWidth;
      const h = wrap!.clientHeight;
      if (w <= 0 || h <= 0) return;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      if (w === view.w && h === view.h && dpr === view.dpr) return;
      view.w = w;
      view.h = h;
      view.dpr = dpr;
      /* HiDPI: the backing store is device pixels, the transform is set per frame. */
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    /* --- geometry ----------------------------------------------------------
       One left-to-right section through the machine: tank → undivided band →
       comb → four channels → four vessels. Everything is derived, so a resize
       just re-derives it. */
    interface Geom {
      W: number;
      H: number;
      m: boolean;
      pad: number;
      tankX: number;
      tankW: number;
      tankTop: number;
      tankH: number;
      combX: number;
      throatTop: number;
      throatH: number;
      cellX: number;
      cellW: number;
      laneH: number;
      cellPad: number;
    }
    function geom(): Geom {
      const W = view.w;
      const H = view.h;
      const m = W < 560;
      const pad = 1;
      const tankW = m ? 34 : 98;
      const tankX = pad;
      const throatH = H * 0.47;
      /* The gauge is shorter than the throat is wide by this much at each end.
         It is deliberately tight: the ground it gives back under the tank is
         where the panel's one display-scale number stands — and, above it, the
         only ground on a narrow screen wide enough to carry the lot's plate
         without the plate's leader having to cross the tank's own caption. */
      const capPad = 30;
      const tankH = throatH + capPad * 2;
      const tankTop = H / 2 - tankH / 2;
      const combX = tankX + tankW + (m ? 20 : 64);
      /* The cells are sized to what they now carry — a ticker, one figure and a
         capped row of coins — so the board does not sit half-empty and the
         drawing keeps the width. */
      const cellW = m ? 112 : 190;
      const cellX = W - cellW;
      return {
        W,
        H,
        m,
        pad,
        tankX,
        tankW,
        tankTop,
        tankH,
        combX,
        throatTop: H / 2 - throatH / 2,
        throatH,
        cellX,
        cellW,
        laneH: H / 4,
        cellPad: m ? 10 : 16,
      };
    }

    function mono(size: number, weight = 400, tracking = '') {
      g.font = weight + ' ' + size + 'px ' + MONO;
      /* letterSpacing is Chrome-only; harmless where it is not implemented. */
      g.letterSpacing = tracking;
    }

    /* A gumball: the brand's own shape, used only where it carries meaning —
       blue is a unit of USDG in the stream, pink is a lot of signal. */
    function gumball(x: number, y: number, r: number, colour: string, alpha: number) {
      g.globalAlpha = alpha;
      g.fillStyle = colour;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = alpha * 0.5;
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.arc(x - r * 0.3, y - r * 0.34, r * 0.36, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    /* The channel's x at fraction t, and the weight its centreline gives to the
       lane it is heading for — the two halves of the same cubic the ribbon is
       drawn with, so coins, edges and labels all agree about where a channel is. */
    function bezX(t: number) {
      const mt = 1 - t;
      return 3 * mt * mt * t * 0.42 + 3 * mt * t * t * 0.58 + t * t * t;
    }
    function bezY(t: number) {
      const mt = 1 - t;
      return 3 * mt * t * t + t * t * t;
    }

    /* Channel bounds at the comb (contiguous — the four always sum to the whole
       stream) and at the vessel, from the lerped weights. This is station zero:
       the blades' own cross-section, which is what the blades are drawn on. */
    function channels(G: Geom) {
      const total = totalDisp();
      let cum = 0;
      return ASSETS.map((a, i) => {
        const share = a.disp / total;
        const y0a = G.throatTop + cum * G.throatH;
        cum += share;
        const y0b = G.throatTop + cum * G.throatH;
        const y0 = (y0a + y0b) / 2;
        const y1 = G.laneH * i + G.laneH / 2;
        return { a, i, share, y0, y1, top: y0a, bot: y0b };
      });
    }

    /* --- the section through the machine, station by station ----------------
       One cross-section per sample along the run. At each, the four weights are
       read from the chain at the lag that point has earned, so the four still
       sum to the whole stream — the filters are identical, so their total is
       carried unchanged — but the split they describe is the split that has
       reached that far. Everything downstream of here (ribbons, coins, the
       ceiling a label rests on) reads these and nothing else. */
    const SEC_MAX = 40;
    const secX = new Float64Array(SEC_MAX + 1);
    const secC = new Float64Array((SEC_MAX + 1) * 4); /* centreline */
    const secT = new Float64Array((SEC_MAX + 1) * 4); /* thickness */
    const secS = new Float64Array((SEC_MAX + 1) * 4); /* share, for the front */
    let nSec = SEC_MAX;

    function crossSections(G: Geom) {
      nSec = G.m ? 24 : SEC_MAX;
      /* A channel may fill its own lane at the vessel but no more, or two of
         them would run into each other where they arrive. Where a weight is
         big enough to want more than that, ALL FOUR are scaled by the same
         factor rather than the big one being capped — so thickness stays
         exactly proportional to weight at every x, which is the whole claim
         the drawing makes. At the comb the ceiling is the stream itself, so
         nothing is ever scaled there and the four are exactly contiguous. */
      const laneMax = G.laneH - (G.m ? 9 : 14);
      for (let s = 0; s <= nSec; s++) {
        const u = s / nSec;
        secX[s] = G.combX + (G.cellX - G.combX) * bezX(u);
        const w = bezY(u);
        const f = u * NODES;
        const n0 = Math.min(NODES, Math.floor(f));
        const n1 = Math.min(NODES, n0 + 1);
        const fr = f - n0;
        let tot = 0;
        for (let i = 0; i < 4; i++) {
          const c = ASSETS[i]!.chain;
          const v = c[n0]! + (c[n1]! - c[n0]!) * fr;
          secS[s * 4 + i] = v;
          tot += v;
        }
        if (tot <= 0) tot = 1;
        let maxShare = 0;
        for (let i = 0; i < 4; i++) {
          const share = secS[s * 4 + i]! / tot;
          secS[s * 4 + i] = share;
          if (share > maxShare) maxShare = share;
        }
        const thMax = G.throatH + (laneMax - G.throatH) * w;
        const raw = maxShare * G.throatH;
        const k = raw > thMax ? thMax / raw : 1;
        let cum = 0;
        for (let i = 0; i < 4; i++) {
          const share = secS[s * 4 + i]!;
          const yTop = G.throatTop + cum * G.throatH;
          cum += share;
          const yBot = G.throatTop + cum * G.throatH;
          secT[s * 4 + i] = (yBot - yTop) * k;
          secC[s * 4 + i] = ((yTop + yBot) / 2) * (1 - w) + (G.laneH * i + G.laneH / 2) * w;
        }
      }
    }

    /* The centreline and thickness of channel `i` at fraction u, read off the
       stations — so a coin rides inside the channel it belongs to even while
       that channel is still reshaping around it. */
    function secAt(u: number, i: number) {
      const f = Math.max(0, Math.min(1, u)) * nSec;
      const s0 = Math.floor(f);
      const s1 = Math.min(nSec, s0 + 1);
      const fr = f - s0;
      const c0 = secC[s0 * 4 + i]!;
      const t0 = secT[s0 * 4 + i]!;
      return { c: c0 + (secC[s1 * 4 + i]! - c0) * fr, t: t0 + (secT[s1 * 4 + i]! - t0) * fr };
    }

    /* The drawing's own ceiling at a given x: the top edge of the first
       channel, which fans upward from the band toward its cell. Anything the
       drawing writes in the clear ground above the stream is placed off this,
       which is why a label can never come to rest on a ribbon however the
       weights move — or however far along the run the new split has got. */
    function ceilingAt(xq: number) {
      if (xq <= secX[0]!) return secC[0]! - secT[0]! / 2;
      if (xq >= secX[nSec]!) return secC[nSec * 4]! - secT[nSec * 4]! / 2;
      let lo = 0;
      let hi = nSec;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (secX[mid]! < xq) lo = mid;
        else hi = mid;
      }
      const span = secX[hi]! - secX[lo]! || 1;
      const fr = (xq - secX[lo]!) / span;
      const a = secC[lo * 4]! - secT[lo * 4]! / 2;
      const b = secC[hi * 4]! - secT[hi * 4]! / 2;
      return a + (b - a) * fr;
    }

    /* The pile of USDG resting in a vessel: one coin per UNIT, laid out on ONE
       line at a fixed pitch, so two coins can never overlap into a blob. The
       line is capped at `per` and the remainder is printed as `+N`, so the pile
       can never run past the cell it belongs to. It occupies a band of the cell
       that carries no type — the coins land there and nowhere else. */
    function pileOf(a: AssetModel, G: Geom, i: number) {
      const rr = G.m ? 3.4 : 4.8;
      const pitch = G.m ? 9 : 12.6; /* > 2r: fixed, so spheres never touch */
      const per = G.m ? 6 : 9;
      const x0 = G.cellX + G.cellPad + rr;
      const cy = G.laneH * i + G.laneH - (G.m ? 9 : 12);
      const total = Math.floor(a.dispPot / UNIT);
      const n = Math.min(per, total);
      return { n, over: Math.max(0, total - per), rr, pitch, per, x0, cy, slotX: x0 + Math.min(n, per - 1) * pitch };
    }

    let lastClock = '';
    let lastStage = '';

    function paintFrame() {
      if (!view.w) resize();
      if (!view.w) return;
      const G = geom();
      const { W, H, m } = G;
      g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.textBaseline = 'alphabetic';
      g.letterSpacing = '';

      const streaming = flow.t < flow.finish;
      const remain = streaming ? (flow.finish - flow.t) / STREAM : 0;
      const chans = channels(G);
      crossSections(G);
      const bandX = G.tankX + G.tankW;

      /* ---------------------------------------------------------- the vessels
         A hairline-divided board, in the system's own instrument language: the
         cells are separated by rules, not boxed. Drawn first so the channels
         land in front of their left edge. */
      g.fillStyle = 'rgba(23, 23, 31, 0.5)';
      g.fillRect(G.cellX, 0, G.cellW, H);
      chans.forEach(({ a, i }) => {
        if (a.flash > 0) {
          /* the auction taking the lot, lit for its ~1.7s and then gone */
          g.fillStyle = 'rgba(41, 182, 240, ' + (0.07 * a.flash).toFixed(3) + ')';
          g.fillRect(G.cellX, G.laneH * i, G.cellW, G.laneH);
        }
      });
      g.fillStyle = C.rule;
      g.fillRect(G.cellX, 0, 1, H);
      for (let i = 1; i < 4; i++) g.fillRect(G.cellX, G.laneH * i, G.cellW, 1);

      /* -------------------------------------------------------------- the tank
         Seven bands, one per day of Resonance.DURATION. What has not been
         released yet stands as fluid in the tank, so "day 3 of 7" is readable
         off the level itself. Its right face is open across the throat: the
         stream leaves through it rather than past a drawn wall. */
      const tankBot = G.tankTop + G.tankH;
      const fluidTop = G.tankTop + G.tankH * (1 - remain);
      g.fillStyle = C.raised;
      g.fillRect(G.tankX, G.tankTop, G.tankW, G.tankH);
      if (remain > 0.002) {
        const tg = g.createLinearGradient(0, fluidTop, 0, tankBot);
        tg.addColorStop(0, 'rgba(41, 182, 240, 0.13)');
        tg.addColorStop(1, 'rgba(41, 182, 240, 0.34)');
        g.fillStyle = tg;
        g.fillRect(G.tankX, fluidTop, G.tankW, tankBot - fluidTop);
      }
      /* the seven days, and the one being released right now */
      const dayIdx = Math.min(6, Math.floor((1 - remain) * 7));
      g.fillStyle = 'rgba(255, 255, 255, 0.05)';
      g.fillRect(G.tankX, G.tankTop + (G.tankH * dayIdx) / 7, G.tankW, G.tankH / 7);
      g.fillStyle = 'rgba(255, 255, 255, 0.07)';
      for (let d = 1; d < 7; d++) g.fillRect(G.tankX, Math.round(G.tankTop + (G.tankH * d) / 7), G.tankW, 1);
      if (remain > 0.002) {
        g.fillStyle = C.blue;
        g.fillRect(G.tankX, Math.round(fluidTop), G.tankW, 1.5);
      }
      g.strokeStyle = flow.refill > 0 ? C.blue : 'rgba(41, 182, 240, 0.42)';
      g.lineWidth = flow.refill > 0 ? 2 : 1;
      g.beginPath();
      g.moveTo(bandX - 0.5, G.throatTop);
      g.lineTo(bandX - 0.5, G.tankTop + 0.5);
      g.lineTo(G.tankX + 0.5, G.tankTop + 0.5);
      g.lineTo(G.tankX + 0.5, tankBot - 0.5);
      g.lineTo(bandX - 0.5, tankBot - 0.5);
      g.lineTo(bandX - 0.5, G.throatTop + G.throatH);
      g.stroke();

      /* ------------------------------------------------- the undivided stream */
      const bandTop = G.throatTop;
      const bandBot = G.throatTop + G.throatH;
      const bandGrad = g.createLinearGradient(bandX, 0, G.combX, 0);
      bandGrad.addColorStop(0, 'rgba(41, 182, 240, 0.3)');
      bandGrad.addColorStop(1, FLUID_NEAR);
      g.fillStyle = bandGrad;
      g.fillRect(bandX, bandTop, G.combX - bandX, G.throatH);
      g.fillStyle = FLUID_LIT;
      g.fillRect(bandX, bandTop, G.combX - bandX, 1);
      g.fillStyle = FLUID_SHADE;
      g.fillRect(bandX, bandBot - 1, G.combX - bandX, 1);

      /* ------------------------------------------------------- the four channels
         Thickness IS the weight — the weight that has reached that point. The
         ribbon is walked station by station, so while a new split is travelling
         the channel is genuinely tapered: new at the blades, old at the vessel,
         with the change in between. Filled ribbons with a lit top edge and a
         shaded underside, so they read as tubes carrying fluid rather than as
         strokes on a chart. */
      const edgePath = (i: number, sign: number) => {
        g.beginPath();
        for (let s = 0; s <= nSec; s++) {
          const y = secC[s * 4 + i]! + (sign * secT[s * 4 + i]!) / 2;
          if (s === 0) g.moveTo(secX[s]!, y);
          else g.lineTo(secX[s]!, y);
        }
      };
      const runW = G.cellX - G.combX || 1;
      /* Four passes, not four channels: every fill lands before any edge, so a
         channel can never paint over its neighbour's underside. Near the comb,
         where the four are contiguous, the seam between two channels is then
         always the same dark line rather than whichever of the pair happened to
         be drawn second. */
      chans.forEach(({ i }) => {
        const grad = g.createLinearGradient(G.combX, 0, G.cellX, 0);
        grad.addColorStop(0, FLUID_NEAR);
        grad.addColorStop(0.9, FLUID_FAR);
        grad.addColorStop(1, 'rgba(41, 182, 240, 0.03)');
        g.beginPath();
        for (let s = 0; s <= nSec; s++) {
          const y = secC[s * 4 + i]! - secT[s * 4 + i]! / 2;
          if (s === 0) g.moveTo(secX[s]!, y);
          else g.lineTo(secX[s]!, y);
        }
        for (let s = nSec; s >= 0; s--) g.lineTo(secX[s]!, secC[s * 4 + i]! + secT[s * 4 + i]! / 2);
        g.closePath();
        g.fillStyle = grad;
        g.fill();
      });
      g.lineWidth = 1;
      g.strokeStyle = FLUID_LIT;
      chans.forEach(({ i }) => {
        edgePath(i, -1);
        g.stroke();
      });
      g.strokeStyle = FLUID_SHADE;
      chans.forEach(({ i }) => {
        edgePath(i, 1);
        g.stroke();
      });

      /* The front itself, lit. Where the share is changing fastest along the run
         is exactly where the new split has got to, so the pink rides that
         gradient down the channel instead of flooding the whole ribbon: the
         reader watches the re-split travel from the blades to the vessels.
         Scaled by the move's standing, so an ambient one is a whisper. */
      chans.forEach(({ a, i }) => {
        if (a.moved <= 0) return;
        let peak = 0;
        for (let s = 0; s <= nSec; s++) {
          const lo = Math.max(0, s - 1);
          const hi = Math.min(nSec, s + 1);
          const d = (Math.abs(secS[hi * 4 + i]! - secS[lo * 4 + i]!) / (hi - lo)) * nSec;
          if (d > peak) peak = d;
        }
        if (peak < 0.012) return;
        const front = g.createLinearGradient(G.combX, 0, G.cellX, 0);
        for (let s = 0; s <= nSec; s++) {
          const lo = Math.max(0, s - 1);
          const hi = Math.min(nSec, s + 1);
          const d = (Math.abs(secS[hi * 4 + i]! - secS[lo * 4 + i]!) / (hi - lo)) * nSec;
          /* squared against this move's own peak, so what lights is the front
             and not the whole length of channel behind it */
          const rel = d / peak;
          const al = rel * rel * Math.min(1, peak / 0.05) * 0.5 * a.emph;
          front.addColorStop(
            Math.max(0, Math.min(1, (secX[s]! - G.combX) / runW)),
            'rgba(252, 122, 186, ' + al.toFixed(3) + ')',
          );
        }
        g.strokeStyle = front;
        g.lineWidth = 1.4;
        edgePath(i, -1);
        g.stroke();
        edgePath(i, 1);
        g.stroke();
        g.lineWidth = 1;
      });

      /* ---------------------------------------------------------------- coins
         Each coin leaves the tank inside the undivided band at the height its
         channel occupies, passes the blades, and drops into its vessel's pile —
         one continuous journey, so the split is something you watch happen.
         The channel leg is drawn here; the leg INSIDE the cell is deferred to
         the vessel pass, which draws it clipped to the cell, so a coin can
         never appear outside the cell or on top of the cell's own type. */
      const preSpan = (G.combX - bandX) / (G.cellX - bandX);
      const ENTER = 0.9; /* the fraction of the journey spent before the lip */
      const inCell: { x: number; y: number; r: number; a: number }[][] = [[], [], [], []];
      chans.forEach(({ a, i, y0, y1 }) => {
        const pile = pileOf(a, G, i);
        flow.parts.forEach((pt) => {
          if (pt.lane !== i) return;
          const r = (m ? 2.5 : 3.3) * pt.r;
          const tt = pt.p < preSpan ? 0 : Math.min(1, (pt.p - preSpan) / (ENTER - preSpan));
          const sec = secAt(tt, i);
          const lift = Math.max(0, sec.t / 2 - r - 1.5);
          /* The channel carries the coin a whole radius past the vessel's lip,
             so by the time the cell's clip applies the coin is already wholly
             inside it: no coin is ever drawn as a half-moon on the hairline,
             and the two legs of the journey stay continuous. */
          const lip = G.cellX + r + 0.8;
          if (pt.p >= ENTER) {
            /* Over the lip: the coin carries on from exactly where the channel
               left it — same height, no jump — drops the whole way down the
               empty left gutter, and only then runs out along the pile line. It
               is still in the gutter while it passes the caption's row, so its
               path is clear of the cell's type from end to end. */
            const q = (pt.p - ENTER) / (1 - ENTER);
            const yIn = y1 + pt.off * 2 * lift;
            /* it settles INTO the pile rather than on top of it: over the last
               stretch the coin gives up its size to the row, so a landing never
               reads as two spheres stacked in one slot */
            const settle = 1 - Math.max(0, (q - 0.72) / 0.28);
            inCell[i]!.push({
              x: lip + (pile.slotX - lip) * q * q * q,
              y: yIn + (pile.cy - yIn) * (1 - Math.pow(1 - q, 3)),
              r: r * settle,
              a: 0.92 * settle,
            });
            return;
          }
          let x: number;
          let y: number;
          if (pt.p < preSpan) {
            x = bandX + (pt.p / preSpan) * (G.combX - bandX);
            y = y0;
          } else {
            x = G.combX + (lip - G.combX) * bezX(tt);
            y = sec.c;
          }
          gumball(x, y + pt.off * 2 * lift, r, C.blue, 0.92);
        });
      });

      /* ----------------------------------------------------------- the comb
         Pink blades standing in the stream. They sit exactly on the boundaries
         between channels, so their positions ARE the cumulative weights: move
         signal and the blades slide. The outer caps close the assembly, so the
         four channels visibly account for the whole stream and nothing else. */
      const nose = m ? 8 : 15;
      /* A blade is a boundary marker, not a quantity: constant thickness, no
         taper, and the same short length whatever the split — so three of them
         can never be read as three equal weights. */
      const vaneLen = m ? 15 : 25;
      const vaneTh = m ? 2 : 3;
      /* the comb's spine: every blade projects downstream from this one line,
         and the line spans exactly the stream's cross-section */
      g.fillStyle = 'rgba(249, 43, 146, 0.55)';
      g.fillRect(G.combX - nose - 1, bandTop, 2, G.throatH);
      g.beginPath();
      g.arc(G.combX - nose, bandTop, 1.6, 0, Math.PI * 2);
      g.arc(G.combX - nose, bandBot, 1.6, 0, Math.PI * 2);
      g.fill();
      for (let k = 0; k < chans.length - 1; k++) {
        const y = Math.round(chans[k]!.bot);
        /* A divider must never be the thickest thing in the lane it bounds. It
           dissolves once either neighbour closes to three times the blade's own
           thickness and is fully gone below that, so a 3% lane is drawn by its
           fluid rather than covered by its own boundary marker. */
        const gapH = Math.min(chans[k]!.bot - chans[k]!.top, chans[k + 1]!.bot - chans[k + 1]!.top);
        const vis = Math.max(0, Math.min(1, (gapH - vaneTh * 3) / (vaneTh * 2)));
        if (vis <= 0) continue;
        /* The nudge on a blade that just moved — full for the scripted lot,
           a fraction of it for a holder drifting on their own clock. */
        const glow = Math.max(chans[k]!.a.moved * chans[k]!.a.emph, chans[k + 1]!.a.moved * chans[k + 1]!.a.emph);
        if (glow > 0) {
          g.globalAlpha = Math.min(0.34, glow * 0.4) * vis;
          g.fillStyle = C.pink;
          g.fillRect(G.combX - nose, y - 4, vaneLen, 8);
          g.globalAlpha = 1;
        }
        /* the blade itself, with a dark line under it that seats it IN the
           stream rather than on top of it */
        g.globalAlpha = vis;
        g.fillStyle = 'rgba(2, 7, 13, 0.5)';
        g.fillRect(G.combX - nose, y - vaneTh / 2 + 1.6, vaneLen, vaneTh);
        g.fillStyle = C.pink;
        g.fillRect(G.combX - nose, y - vaneTh / 2, vaneLen, vaneTh);
        g.beginPath();
        g.arc(G.combX - nose, y, m ? 2.2 : 2.9, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }

      /* the lot in flight: signal arriving at the gate it is about to open */
      if (flow.chip) {
        const from = chans[flow.chip.from];
        const to = chans[flow.chip.to];
        if (from && to) {
          const q = Math.min(1, flow.chip.p);
          const e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
          const cy = from.y0 + (to.y0 - from.y0) * e;
          const cx = G.combX - nose;
          const rDisc = m ? 4.8 : 6.5;
          /* One curve for the whole annotation. It opens over 85ms, holds, and
             leaves on a single fast-out ramp: plane, type, leader, disc and the
             arrival ring all reach zero at the same instant, 180ms later. */
          const outK = Math.max(0, Math.min(1, (CHIP_END - flow.chip.p) / CHIP_TAIL));
          const fade = Math.min(1, flow.chip.p / 0.09, Math.sqrt(outK));
          /* … and the plane wipes open and shut on that same curve, squared, so
             what is on screen is always either a full-height plate carrying
             crisp type or nothing — never a slab with an illegible smudge in
             it. The wipe retreats toward the leader, so the last thing to go is
             the end that is attached to the lot. */
          const shutter = fade * fade;

          if (flow.chip.p > 1) {
            /* it has arrived: one small ring on the gate it just opened, on the
               annotation's own curve — it cannot outlive the lot it belongs to */
            const d = Math.min(1, (flow.chip.p - 1) / CHIP_TAIL);
            g.globalAlpha = fade * 0.8;
            g.strokeStyle = C.pink;
            g.lineWidth = 1.5;
            g.beginPath();
            g.arc(cx, cy, rDisc + d * (m ? 5 : 7), 0, Math.PI * 2);
            g.stroke();
            g.globalAlpha = 1;
          }

          /* Where it came from, said as a short trail that dies within ~24px
             behind the lot — a mark that explains itself by moving with the
             thing, rather than a hollow ring parked on the rail. */
          const dir = cy < from.y0 ? -1 : 1;
          const trail = Math.min(m ? 16 : 24, Math.abs(cy - from.y0));
          if (trail > 1.5) {
            const ty0 = cy - dir * rDisc;
            const ty1 = cy - dir * (rDisc + trail);
            const tg = g.createLinearGradient(0, ty0, 0, ty1);
            tg.addColorStop(0, 'rgba(252, 122, 186, 0.95)');
            tg.addColorStop(1, 'rgba(249, 43, 146, 0)');
            g.globalAlpha = fade;
            g.strokeStyle = tg;
            /* wider and brighter than the comb's own spine, or it would just be
               the rail again rather than a wake on it */
            g.lineWidth = m ? 2.8 : 3.6;
            g.beginPath();
            g.moveTo(cx, ty0);
            g.lineTo(cx, ty1);
            g.stroke();
            g.globalAlpha = 1;
          }

          /* The lot, named on a pink plane in black type — the brand's own
             contrast pair, and the only annotation the drawing ever shows. It
             is a callout, not an overlay: it stands in the clear ground above
             the stream, never inside the ribbon whose thickness is the whole
             argument, and a 1px pink leader ties it to the lot so the name and
             the thing named stay one object however thin a channel gets. */
          const label = gbx(flow.chip.lot) + ' GBX';
          mono(m ? 8.5 : 10, 600, '0.04em');
          const pw = g.measureText(label).width + (m ? 11 : 15);
          const phFull = m ? 15 : 19;
          const wipe = pw * shutter;
          let px: number;
          let pBot: number;
          let anchorX: number;
          if (m) {
            /* Narrow screens have one wedge of clear ground and the tank's own
               caption sits in it, so the callout is docked to the head of the
               rail instead of standing off to the side: the plate rests just
               above where the blades begin and the leader drops straight down
               the rail into the lot. A vertical leader in the gutter between
               the caption and the stream crosses no letterform at all, where a
               diagonal one had to thread the gaps between them. */
            px = Math.max(bandX + 6, Math.min(W - pw - 2, cx - pw * 0.5));
            pBot = Math.min(bandTop - 5, ceilingAt(px + pw) - 4);
            anchorX = cx;
          } else {
            px = Math.max(bandX + 4, Math.min(G.cellX - pw - 6, cx + 12));
            /* its floor is the drawing's ceiling at its own right edge … */
            pBot = ceilingAt(px + pw) - 12;
            /* … and, where it stands over the tank's lettering, that too */
            mono(9.5, 400, '0.11em');
            const lw = g.measureText('7-DAY STREAM').width;
            mono(11, 600, '0.13em');
            const letterRight = G.tankX + Math.max(lw, g.measureText('RESONANCE').width);
            if (px < letterRight + 6) pBot = Math.min(pBot, G.tankTop - 38);
            anchorX = Math.min(px + pw - 5, Math.max(px + 5, cx + rDisc));
          }
          pBot = Math.max(phFull + 3, pBot);
          const pyMid = pBot - phFull / 2;
          const py = pBot - phFull;
          mono(m ? 8.5 : 10, 600, '0.04em');
          g.globalAlpha = 0.5 * fade;
          g.strokeStyle = C.pink;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(anchorX, pBot);
          if (m) g.lineTo(cx, cy - rDisc);
          else g.lineTo(cx + rDisc * 0.72, cy - rDisc * 0.72);
          g.stroke();
          g.globalAlpha = fade;
          g.fillStyle = C.pink;
          g.fillRect(px, py, wipe, phFull);
          /* the type is clipped to the wipe, never scaled: at every alpha it is
             either crisp on its plane or gone with it */
          g.save();
          g.beginPath();
          g.rect(px, py, wipe, phFull);
          g.clip();
          g.fillStyle = C.onField;
          g.textAlign = 'left';
          g.fillText(label, px + (m ? 5.5 : 7.5), pyMid + (m ? 2.9 : 3.7));
          g.restore();
          g.letterSpacing = '';
          g.globalAlpha = 1;
          gumball(cx, cy, rDisc, C.pink, fade);
        }
      }

      /* ------------------------------------------------------- tank lettering
         On a narrow screen the caption sits higher, because the ground between
         it and the stream is the only place the lot's plate can stand: lifting
         it clears a corridor the callout's leader can drop straight down,
         instead of the leader having to thread the gaps between the letters. */
      g.textAlign = 'left';
      mono(m ? 10 : 11, 600, '0.13em');
      g.fillStyle = C.hi;
      g.fillText('RESONANCE', G.tankX, G.tankTop - (m ? 39 : 23));
      mono(m ? 9 : 9.5, 400, '0.11em');
      g.fillStyle = C.faint;
      g.fillText('7-DAY STREAM', G.tankX, G.tankTop - (m ? 27 : 9));
      /* The panel's one display-scale number. It stands OUTSIDE the gauge, in
         the ground the shortened tank gives back, at roughly three times the
         eyebrow under it — so the drawing has a headline fact instead of nine
         readings all the same size. It is printed here once and nowhere else. */
      const leftText = money(streaming ? flow.rate * Math.max(0, flow.finish - flow.t) : 0);
      mono(m ? 26 : 32, 600, '-0.02em');
      g.fillStyle = C.blue;
      g.fillText(leftText, G.tankX, tankBot + (m ? 30 : 36));
      mono(m ? 9 : 11.5, 500, '0.19em');
      g.fillStyle = C.faint;
      g.fillText('LEFT THIS WEEK', G.tankX + 1, tankBot + (m ? 45 : 53));
      mono(m ? 8.5 : 9.5, 400, '0.11em');
      g.fillStyle = 'rgba(41, 182, 240, 0.85)';
      g.fillText('ACCRUING · +' + money(flow.pending), G.tankX, tankBot + (m ? 58 : 68));
      g.letterSpacing = '';

      /* ------------------------------------------------------ vessel lettering
         The cell is the money side of the drawing: a ticker, the USDG accruing
         under it, and the pile that USDG makes. The weight and the delta are
         the ledger's job — printed once there, against a meter — so no figure
         in this panel is ever printed twice. */
      chans.forEach(({ a, i }) => {
        const top = G.laneH * i;
        const x = G.cellX + G.cellPad;
        const ty = top + (m ? 16 : 20);
        const pile = pileOf(a, G, i);

        /* Everything that moves inside a cell is clipped to that cell: no
           sphere can cross a hairline, and the pile band carries no type, so
           none of them can land on a label either. */
        g.save();
        g.beginPath();
        g.rect(G.cellX + 1, top + 1, G.cellW - 2, G.laneH - 2);
        g.clip();
        for (let k = 0; k < pile.n; k++) gumball(pile.x0 + k * pile.pitch, pile.cy, pile.rr, C.blue, 0.95);
        inCell[i]!.forEach((c) => {
          if (c.r > 0.4) gumball(c.x, c.y, c.r, C.blue, c.a);
        });
        if (a.flash > 0) {
          /* The flush: the lot lifts clear of the pile and leaves to the RIGHT,
             the way its USDG is actually going — to the auction. Radius and
             alpha die on one curve over the last ~30px, so the lot is already
             gone before the frame edge and no sphere is ever cut in half by the
             board's own hairline. */
          const exitX = G.cellX + G.cellW - (m ? 6 : 7);
          const lift = m ? 9 : 12;
          for (let k = 0; k < 4; k++) {
            const prog = Math.min(1, Math.max(0, (1 - a.flash) * 1.7 - k * 0.13));
            if (prog <= 0 || prog >= 1) continue;
            const sx = pile.x0 + k * pile.pitch;
            const out = Math.min(1, (1 - prog) / 0.26);
            const rise = 1 - Math.pow(1 - Math.min(1, prog / 0.22), 2);
            gumball(sx + (exitX - sx) * prog, pile.cy - lift * rise, pile.rr * (0.5 + 0.5 * out), C.blue, out);
          }
        }
        g.restore();
        if (pile.over > 0) {
          /* the row is capped, so the remainder is counted rather than stacked */
          mono(m ? 8 : 9.5, 500, '0.04em');
          g.textAlign = 'left';
          g.fillStyle = C.faint;
          g.fillText('+' + pile.over, pile.x0 + pile.per * pile.pitch - pile.rr, pile.cy + (m ? 3 : 3.4));
        }

        mono(m ? 10.5 : 12, 600, '0.06em');
        g.textAlign = 'left';
        g.fillStyle = C.hi;
        g.fillText(a.sym, x, ty);
        if (a.moved > 0) {
          /* this Strategy's signal just changed — said in colour, not in a
             second copy of the number the ledger already carries, and at the
             move's own standing so drift never shouts as loud as the signal */
          g.globalAlpha = Math.min(1, a.moved * 1.5) * a.emph;
          g.fillStyle = C.pinkLabel;
          g.fillText(a.sym, x, ty);
          g.globalAlpha = 1;
        }

        mono(m ? 13 : 18, 600, '');
        g.fillStyle = C.blue;
        g.fillText(money(a.pot), x, top + (m ? 34 : 44));

        mono(m ? 8 : 9.5, 400, '0.09em');
        if (a.flash > 0) {
          /* the flush beat — the departing lot named, and the USDG leaving */
          g.globalAlpha = Math.min(1, a.flash * 1.4);
          g.fillStyle = C.blueLabel;
          g.fillText(money(a.lastLot) + (m ? ' → AUCTION' : ' → ITS AUCTION'), x, top + (m ? 47 : 58));
          g.globalAlpha = 1;
        } else {
          g.fillStyle = C.faint;
          g.fillText(m ? 'USDG WAITING' : 'USDG FOR ITS AUCTION', x, top + (m ? 47 : 58));
        }
        g.letterSpacing = '';
      });

      /* The board's own hairlines, re-struck over everything: a coin crossing
         the vessel's lip passes UNDER the rule instead of breaking it, so the
         boundary stays a single unbroken line at every moment of the flow. */
      g.fillStyle = C.rule;
      g.fillRect(G.cellX, 0, 1, H);
      for (let i = 1; i < 4; i++) g.fillRect(G.cellX, G.laneH * i, G.cellW, 1);

      /* clock + the beat the reader is looking at */
      const week = Math.max(1, Math.ceil(flow.t / STREAM));
      const day = streaming ? Math.min(7, Math.floor((flow.t - (flow.finish - STREAM)) / 86400) + 1) : 7;
      const clock = 'week ' + week + ' · day ' + day;
      if (clock !== lastClock) {
        clockEl!.textContent = clock;
        lastClock = clock;
      }
      let stage = STAGE_TEXT[cycle.stage];
      if (cycle.stage === 'move' || (cycle.stage === 'hold' && flow.chip)) {
        const moving = ASSETS.find((a) => a.delta > 0);
        if (moving) stage = 'signal moves · ' + gbx(moving.delta) + ' GBX → ' + moving.sym;
      }
      if (stage !== lastStage) {
        stageEl!.textContent = stage;
        stageEl!.dataset.stage = cycle.stage;
        lastStage = stage;
      }
    }

    function updateRows() {
      const total = totalStake();
      const weekly = flow.rate * STREAM;
      ASSETS.forEach((a) => {
        const share = a.stake / total;
        const pct = Math.round(share * 100) + '%';
        if (pct !== a.lastPct) {
          a.pctEl.textContent = pct;
          a.lastPct = pct;
        }
        a.barEl.style.width = (share * 100).toFixed(1) + '%';
        const d = a.moved > 0 && a.delta ? (a.delta > 0 ? '+' : '−') + gbx(a.delta) : '';
        if (d !== a.lastDelta) {
          a.deltaEl.textContent = d;
          a.lastDelta = d;
        }
        /* Hold at 1 for the delta's whole life, then let the CSS transition
           fade it in ~320ms — a linear ramp here kept it on screen below AA
           for over a second (see .rz-row__delta). */
        const op = a.moved > 0 ? '1' : '0';
        if (a.deltaEl.style.opacity !== op) a.deltaEl.style.opacity = op;
        const est = Math.round((weekly * share) / 100) * 100;
        const sub = a.stake.toLocaleString('en-US') + ' GBX · ≈$' + est.toLocaleString('en-US') + '/wk at this weight';
        if (sub !== a.lastSub) {
          a.subEl.textContent = sub;
          a.lastSub = sub;
        }
      });
    }

    function paint() {
      resize();
      paintFrame();
      updateRows();
    }

    let ro: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => {
        const w = view.w;
        const h = view.h;
        resize();
        if (view.w !== w || view.h !== h) paintFrame();
      });
      ro.observe(wrap);
    }

    /* Re-arm the demonstration: a calm board, then the first scripted move
       about two seconds after the reader actually gets here. */
    function armCycle() {
      cycle.stage = 'hold';
      cycle.left = PHASE.hold;
      flow.chip = null;
      ASSETS.forEach((a) => {
        a.moved = 0;
        a.delta = 0;
        a.emph = 1;
        a.disp = a.stake;
        a.chain.fill(a.stake); /* a calm board is settled the whole way down */
        a.lastMove = flow.t;
        clearTimeout(a.rowTimer);
        a.row.classList.remove('evt-pink', 'rz-row--soft');
      });
    }

    /* Seed so the first visible frame is already mid-flow. No stake moves while
       seeding — the weights must still match the server-rendered rows exactly,
       and the first move the reader is owed should happen in front of them. */
    cycle.left = Infinity;
    step(1); /* starts the stream from the pending seed */
    step(3600); /* an hour in: vessels visibly filling */
    ASSETS.forEach((a) => {
      a.dispPot = a.pot;
    });
    armCycle();
    updateRows(); /* rows carry real text pre-paint — no shift on first paint */

    const unregister = registerSim({
      name: 'resonance',
      /* watch the panel, not the whole section: the drawing is what has to be
         on screen for the loop to be worth running (as Fund.tsx already does) */
      el: el.querySelector<HTMLElement>('.sim-panel') ?? el,
      timeScale: TIME_SCALE,
      step,
      paint,
      reset: () => {
        /* The coins in flight are kept: the sim was paused, not stale, so a
           returning reader gets a full stream rather than an empty one that
           takes three seconds to refill. */
        flow.spawnAcc = 0;
        flow.refill = 0;
        ASSETS.forEach((a, i) => {
          a.flash = 0;
          a.epochEnd = flow.t + 3000 + i * 2600;
        });
        armCycle(); /* the returning reader gets the whole beat again */
      },
      static: () => {
        /* A meaningful mid-stream still: day 3 of the week, vessels at four
           different levels, one auction taking its lot, and a 2,000 GBX signal
           lot frozen half-way along the comb face with the blades already
           sliding — the transfer itself, held still. The channels are frozen
           mid-transit too: new split at the blades, old split still standing at
           the vessels, and the front between them, so a reader who never sees
           a frame move is still told that the re-split takes time to arrive. */
        flow.t = 2.4 * 86400;
        flow.finish = flow.t + STREAM - 2.4 * 86400;
        flow.rate = WEEKLY / STREAM;
        flow.pending = (WEEKLY * 2.4 * 86400) / STREAM;
        flow.refill = 0; /* still frame — no event beats */
        let total = totalStake();
        const before = ASSETS.map((a) => a.stake);
        ASSETS.forEach((a, i) => {
          a.pot = flow.rate * (a.stake / total) * (5200 + i * 2600);
          a.dispPot = a.pot;
          a.disp = a.stake;
          a.moved = 0;
          a.delta = 0;
          a.flash = 0;
        });
        /* Same rule as the live beat, so the still frame a reduced-motion
           reader gets shows the lot leaving the largest Strategy too. */
        const src = largestAsset() ?? ASSETS[0]!;
        const dst = ASSETS[(ASSETS.indexOf(src) + 1) % ASSETS.length]!;
        applyMove(src, dst, SCRIPTED_LOT, true); /* out of the largest, fresh */
        src.moved = 0.82;
        dst.moved = 0.82;
        /* the blades have all but arrived; the run downstream has not */
        ASSETS.forEach((a, i) => {
          a.disp = before[i]! + (a.stake - before[i]!) * 0.92;
          const FRONT = 0.34; /* where along the run the change has got to */
          for (let n = 0; n <= NODES; n++) {
            const w = Math.max(0, Math.min(1, (FRONT * NODES + 2.2 - n) / 4.4));
            a.chain[n] = before[i]! + (a.disp - before[i]!) * w;
          }
        });
        if (flow.chip) flow.chip.p = 0.62;
        ASSETS[3]!.flash = 0.62; /* AAPL's auction is taking its lot */
        ASSETS[3]!.lastLot = 96;
        ASSETS[3]!.dispPot = ASSETS[3]!.pot * 0.4;
        cycle.stage = 'move';
        cycle.left = PHASE.move;
        flow.parts.length = 0;
        total = totalStake();
        for (let k = 0; k < 46; k++) {
          const r = ((k * 0.618) % 1) * total;
          let acc = 0;
          let lane = 0;
          for (let i = 0; i < ASSETS.length; i++) {
            acc += ASSETS[i]!.stake;
            if (r <= acc) {
              lane = i;
              break;
            }
          }
          flow.parts.push({
            p: (k * 0.137) % 0.97,
            lane,
            off: (((k * 0.37) % 1) - 0.5) * 0.84,
            r: 0.86 + ((k * 0.21) % 0.34),
          });
        }
        paint();
        ASSETS.forEach((a) => {
          clearTimeout(a.rowTimer);
          a.row.classList.remove('evt-pink', 'rz-row--soft');
        });
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => {
            if (!disposed) paintFrame();
          });
        }
      },
    });

    return () => {
      disposed = true;
      unregister();
      ro?.disconnect();
      ASSETS.forEach((a) => {
        clearTimeout(a.rowTimer);
        a.row.classList.remove('evt-pink', 'rz-row--soft');
      });
    };
  }, []);

  return (
    <section id="sec-resonance" className="section section--rule" aria-labelledby="sec-resonance-h">
      <div className="container">
        <header className="sec-head sec-head--indexed reveal">
          <div className="sec-head__index">
            <span className="sec-head__num" aria-hidden="true">
              03
            </span>
            <p className="eyebrow eyebrow--pink">Resonance</p>
          </div>
          <div className="sec-head__body">
            <h2 className="h1" id="sec-resonance-h">
              Where the signal sits is where the money goes
            </h2>
            <p className="lede">
              Deposit GBX and point it at a Strategy — that is the whole vote. Once revenue is inside Resonance, the
              fund&#39;s buying power follows signal moment to moment: no proposals or ballots.
            </p>
          </div>
        </header>

        <p className="small muted measure rz-how reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
          Once someone separately forwards qualifying Router revenue, Resonance releases it as a rolling seven-day
          stream and splits it across Strategies by live signal weights. Mine does not perform that forwarding. Each
          Strategy collects its released share as USDG; turning it into the asset is the next section.
        </p>

        <div className="sim-panel reveal" style={{ '--d': '180ms' } as React.CSSProperties}>
          <div className="sim-panel__head">
            <span className="sim-panel__title">Resonance — live model</span>
            <span className="chip chip--warn">Illustrative parameters</span>
          </div>
          <div className="sim-panel__body">
            <p className="rz-cap">The stream — USDG, split by signal</p>
            <div className="rz-stage-wrap">
              <canvas
                id="rzCanvas"
                role="img"
                aria-label="A seven-day stream of USDG leaving the Resonance tank as one blue band, cut by pink signal blades into four channels whose thickness is each Strategy's live signal weight, each channel filling that Strategy's vessel with USDG until its auction takes the lot"
              />
            </div>
            <p className="rz-cap rz-cap--ledger">
              Signal — <span className="num">31,500</span> GBX pointed
            </p>
            <div className="rz-ledger" id="rzRows">
              {STRATEGIES.map((s) => (
                <div className="rz-row" key={s.sym}>
                  <div className="rz-row__top">
                    <span className="rz-row__sym num">{s.sym}</span>
                    <span className="rz-row__pct num">{s.pct}</span>
                    <span className="rz-row__delta num" aria-hidden="true" />
                  </div>
                  <div className="meter meter--pink">
                    <i style={{ width: s.bar }} />
                  </div>
                  <div className="rz-row__sub num">{s.sub}</div>
                </div>
              ))}
            </div>
            <p className="note rz-hint">
              Every few seconds a holder moves a 2,000 GBX lot out of the largest Strategy and into another. The deltas
              mark where it went; the stream re-splits before the lanes have finished settling.
            </p>
          </div>
          <div className="sim-panel__foot">
            <div className="sim-panel__controls">
              <span className="sim-clock" id="rzClock">
                week 1 · day 1
              </span>
              <span className="rz-stage" id="rzStage" data-stage="hold">
                hold · weights steady
              </span>
            </div>
            <p className="sim-note">
              Weights, amounts and symbols are illustrative — the tickers are example strategies, not holdings. The
              seven-day stream is fixed in code; this model starts after a successful permissionless route and implies
              no routing cadence or guarantee.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
