'use client';

import { useLayoutEffect } from 'react';
import { fontFamily, registerSim } from '../../lib/harness';
import { ease, ramp } from '../../lib/ease';
import {
  ASSETS as ASSET_HUES,
  GBX,
  GBX_SHADE,
  USDG,
  drawLegend,
  fillNeutral,
  legendAltText,
  legendFonts,
  readInk,
  wrap,
} from '../../lib/legend';
import { PROCESS_REST, SIGNAL, hairline, node, setStroke, sink, splitter, tag, valve, vessel } from '../../lib/isa';
import {
  centrePath,
  convergeFlow,
  junctionReport,
  ribbon,
  ribbonPath,
  scanConservation,
  splitFlow,
  widthOf,
  type Ribbon,
  type Station,
} from '../../lib/ribbon';
import {
  DECAY,
  SLOTS,
  createMineState,
  gbx as fmtGbx,
  leapNote,
  money,
  pad2,
  priceOf,
  stepMine,
  warmStart,
  type MineFx,
  type MineState,
} from '../../lib/models/mine';
import {
  STREAM,
  WEEKLY,
  createResonanceState,
  stepResonance,
  totalStake,
  type ResonanceState,
} from '../../lib/models/resonance';
import { BRIBE, aucStep, createAucState, fair, seedHistory, type AucState } from '../../lib/models/auction';
import { SUPPLY0, createRedState, redStep, takenAt, type RedState } from '../../lib/models/redeem';
import './plate.css';

/* ══════════════════════════════════════════════════════════════════════════
   ONE PLATE — the whole system, flat orthographic, travelled top to bottom.

   THE PROJECTION IS THE ARGUMENT. Width is quantity. A band's width at every
   station is a model number times one published gauge, so conservation is
   checkable by eye and then checked numerically in the plate's own footer.
   That is why this is orthographic and not perspective: under perspective a
   narrowing band is ambiguous between "less money" and "further away", and
   the whole encoding collapses.

   ═══ THE DISCONTINUITY IS THE PLATE'S MOST IMPORTANT FEATURE ═══
   This is NOT one continuous conserved flow from mine to fund. docs/MODELS.md
   is explicit: Mine emits `RevenueDeposited` and stops; `ResonanceRouter`'s
   `route()` is a separate permissionless action with no role, bounty or
   liveness guarantee, and revenue may wait in the Router indefinitely. The
   Resonance model "begins after revenue has been forwarded … deliberately not
   a claim that a Mine handoff forwards or schedules revenue synchronously."
   So the plate is FOUR conserved segments with an explicit break between the
   first two, drawn as a break: a torn pipe, a full-width rule, and a change of
   gauge — above the break every quantity is USDG, below it every quantity is
   USDG per second. Two different units cannot be the same money, and the
   drawing says so before the caption does.

   THE MODELS ARE FROZEN. Every figure comes from lib/models/*.ts, which are
   the section components' own step functions moved verbatim (see the header of
   each module). The plate composes them; it does not restate them. Each keeps
   its own designed pacing, so the plate registers at timeScale 1 and multiplies
   each model's dt by the scale that model was written for.

   THE HARNESS CONTRACT. Every d3-shape call happens in `build()`, which runs
   from `step()` and from `resize()` — never from `paint()`. `paint()` costs one
   `ctx.fill(path)` per band. Sizes come from a ResizeObserver cache, so the
   frame never forces a synchronous layout.
   ══════════════════════════════════════════════════════════════════════════ */

/* ---------------------------------------------- the neutral treatment ----
   The treatment is now KIT-WIDE (`GBX_SHADE` / `fillNeutral` in lib/legend.ts),
   so the key and every band it describes are the same bytes. The plate only
   names the body colour locally, and follows the lead's ruling that a band
   running DOWN the page takes the flat fill with no shade — inventing a light
   direction for a vertical run would put two light sources on one drawing. */
const GBX_BODY = GBX;

/* --------------------------------------------- the orthogonal pipe run ----
   THE DEFECT THIS FIXES, and it is the plate's worst. A tapered ribbon's width
   is measured ACROSS the flow axis, so a band whose centreline moves sideways
   faster than it moves forward is drawn correct in cross-section and reads as
   a sliver on the page. Station 01's 80% dead-end measured 131.8 px across and
   7.4 px thick, beside a 20% leg four times thinner and twice as visible: the
   widths were arithmetically right and the drawing said the opposite.

   A discrete payment does not taper — it forks once and each leg carries a
   constant quantity — so the plate routes it the way a plant drawing routes a
   pipe: an orthogonal centreline STROKED at `q x gauge`. A stroke's width is
   perpendicular by definition, so `width === q * gauge` holds everywhere on
   the run and at every corner, which is the one thing a diagonal ribbon cannot
   promise. Tapering fans (the stream, the burn) keep the ribbon primitive,
   where the taper is the point. */
interface Pt {
  x: number;
  y: number;
}

function pipePath(pts: readonly Pt[], radius: number): Path2D {
  const path = new Path2D();
  const n = pts.length;
  const first = pts[0];
  if (first === undefined) return path;
  path.moveTo(first.x, first.y);
  for (let i = 1; i < n - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    if (a === undefined || b === undefined || c === undefined) continue;
    const r = Math.min(radius, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    path.arcTo(b.x, b.y, c.x, c.y, Math.max(0, r));
  }
  const last = pts[n - 1];
  if (last !== undefined && n > 1) path.lineTo(last.x, last.y);
  return path;
}

/* --------------------------------------------------------------- the clocks
   Each model keeps the pacing it was written for; the plate is the sum. */
const TS_MINE = 60;
const TS_RZ = 900;
const TS_AUC = 450;

/* route() has no schedule in the contract at all — no role, no bounty, no
   liveness. The plate draws a wait, and the wait is deliberately long and
   irregular so a reader watches the Router HOLD across several mine takes
   before anything moves. The caption carries what the drawing cannot: that
   the real wait is unbounded. */
const ROUTE_MIN = 9.5; // real seconds
const ROUTE_VAR = 7.0;
const ROUTE_OPEN = 1.15; // how long the outlet stands open, real seconds

/* The reveal of a discrete packet. A payment is not a stream: it is one
   allocation that happens and is over. The width is the model's the whole
   time; only how much of the run has been REACHED advances. */
const PACKET_RUN = 1.05; // real seconds, cell → splitter → landings
const PACKET_HOLD = 0.85; // … then it stands, so the figures can be read

/* ══════════════════════ THE PROSE, IN ONE PLACE ═══════════════════════════
   OWNER, round 2: *"theres way too much text and words over the diagram."*

   Every full sentence the plate paints is declared HERE and painted through
   ONE path — `prose()` / `proseLine()`, gated on `PROSE_ON_CANVAS`. Nothing
   else in this file writes a sentence onto the canvas.

   THE POINT OF THE SPLIT. A string is on the drawing only if detaching it
   would destroy it: an ISA tag, a live reading, a lane's share, a bay's
   ticker and stock, a station number, a scale bar's unit. Those are readings
   and they stay. Everything below is PROSE — it explains, it does not
   measure — and prose can live anywhere the reader will see it. Flipping
   `PROSE_ON_CANVAS` to false takes all of it off the drawing surface in one
   line; rendering the same record in the section's DOM puts it back beside
   the plate, where it wraps instead of truncating and where no ribbon can
   ever paint over it.

   NO HONESTY CONTENT MAY BE LOST, ONLY RELOCATED. The load-bearing contract
   facts are marked `‡` and must survive wherever this record is rendered. */
export const PROSE_ON_CANVAS = true;

export const PLATE_PROSE = {
  gaugeNote: 'width is quantity — hold a ruler against them',
  fadeNote:
    'Nothing on this plate is faded to mean "less": a small quantity is a NARROW band, never a dim one. Each station also prints any gauge of its own — the auctions\u2019 lots and every fund bay.',
  keyPointer:
    'THE KEY — six glyphs, three weights, three readings and the ball-colour law — is printed in full at the FOOT of the plate. Every band, bay and lane below is labelled where it runs, so read the plate first and the key when you want it.',
  keyNote: 'learn it once — it reads every station above',

  /* 01 · the mine */
  mineNote:
    'sixteen slots · a falling price, one hour to zero · the bar is the clock, empty at restart and full at the hour',
  /* ‡ a pull claim is not a payment pushed to anyone */
  claimNote: 'they must collect it — it never reaches the Router',
  idleFork: 'nothing is in flight — an empty pipe is the truthful state between takes',
  gbxBands: 'each band is one row of four clocks — its width is that row\u2019s pending GBX',
  /* ‡ USDG does not buy GBX; it buys the slot */
  buysTheSlot:
    'USDG buys the SLOT. The slot then mints GBX on a clock at globalTps/16 — tenure-locked, and independent of what was paid.',
  mintedAtReplacement:
    'At replacement it is minted to the miner and leaves this board — that is the inflow drawn against GBX supply at station 06.',

  /* 02 · the Router */
  routerNote: 'it HOLDS — a deposit is not a forward',
  /* ‡ route() has no role, no bounty and no liveness guarantee */
  routeWaiting: 'permissionless · no role, no bounty, no liveness · it has waited ',
  routeCalled: 'someone called it — ',
  /* ‡ the wait is unbounded */
  heldForEver: 'and it can stay held for ever — nothing schedules the call',

  /* the break */
  breakWide: [
    'Mine emits RevenueDeposited and stops there; only ResonanceRouter.RevenueRouted proves a later forward, and nothing schedules one.',
    'So the gauge changes across this line: everything above is conserved in USDG, everything below is a separate model conserved in USDG per second.',
    'The plate makes no claim that the money below is the money above.',
  ],
  breakNarrow: [
    'Mine emits RevenueDeposited and stops.',
    'Only RevenueRouted proves a forward.',
    'Above: USDG. Below: USDG per second.',
    'Nothing here claims they are the same money.',
  ],

  /* 03 · the stream */
  streamNote: 'split by signal — the lane widths ARE the shares',
  fiUnits: 'FI · milli-USDG/s down this lane',

  /* 04 · the auctions */
  potWaiting: 'USDG waiting for its auction',
  traderHands: 'takes the USDG, hands back ',
  tradeIsPrice: 'USDG out · the asset back — the trade is the price',
  askFalls: 'the ask falls until it meets what the lot is worth',
  /* ‡ the tenth is drawn and labelled, and deliberately not followed */
  signalerTap:
    '10% of every fill is the signalers’ — Resonance.DEFAULT_BRIBE_BPS = 1000. Drawn, labelled, and not followed further on this plate. Tapped so far ',
  /* ‡ only lane 2 has a modelled ask */
  oneInDetail:
    'One auction in detail — lane 2. The other three run the same mechanism on their own clocks; the plate does not draw an ask it has no model for.',
  oneInDetailNarrow:
    'One auction in detail — lane 2: the pink blade is the ask and it falls until it meets the dashed line, what the lot is worth. The other three run the same mechanism on their own clocks; the plate does not draw an ask it has no model for.',

  /* 05 · the fund */
  bayGauges:
    'Each bay is on its own gauge because each holds a different thing. What is comparable across bays is the SHARE a burn takes — the same everywhere.',

  /* 06 · your share */
  youNote: 'burn GBX — and the same share leaves EVERY bay, in one transaction',
  burnSink: 'GBX leaves and does not return',
  burnIdle: ' burn would take at this instant',
  burnIdleNarrow: ' burn would take now',
  burnLive: ' of everything in existence',
  burnLiveNarrow: ' of all GBX',
  stackOrder: 'stacked NVDA · QQQ · WBTC · AAPL — bay order, left to right',
  stackOrderNarrow: 'stacked NVDA·QQQ·WBTC·AAPL, left to right',

  /* the instruments */
  deltaNote:
    'Δ is printed in exponential form so an error can never hide behind a rounded zero, and it turns pink above 1e-11 of the quantity being checked — relative, because a six-figure GBX total floors an order of magnitude higher than a rate does. The Router row is the one that proves the break is honest: in − out − held. These are instantaneous checks, not counters; the tallies beside each station are the cumulative figures.',
} as const;

interface Band {
  y0: number;
  y1: number;
}

interface Bay {
  cx: number;
  sym: string;
  hue: string;
}

interface Layout {
  w: number;
  h: number;
  dpr: number;
  pad: number;
  narrow: boolean;
  mid: boolean;
  /** px per USDG — the stock gauge: mine payments, Router level, bucket fills */
  gStock: number;
  /** px per USDG/s — the flow gauge: the seven-day stream and its four lanes */
  gFlow: number;
  /** px per GBX — the supply gauge: the burn, and the mint that refills it */
  gGbx: number;
  /** px per GBX — the mine's pending-emission collector */
  gMined: number;
  /** px per USDG of LOT — the auctions' own gauge, published at the station */
  gLot: number;
  /** USDG — the published ceiling of a bucket's scale */
  potCap: number;
  legendH: number;
  head: Band;
  mine: Band;
  router: Band;
  brk: Band;
  stream: Band;
  auc: Band;
  fund: Band;
  you: Band;
  instr: Band;
  /** THE KEY, at the FOOT: a reader meets 01 THE MINE first and refers back */
  key: Band;
  /* ---- every coordinate build() and paint() BOTH need lives here, once.
     Two functions computing the same y from the same formula is how a band
     and the glyph that gates it drift apart on one breakpoint and nobody
     notices. There is one source. */
  cw: number;
  ch: number;
  cgap: number;
  gridX: number;
  gridW: number;
  gridTop: number;
  gridBot: number;
  gbxX: number;
  gbxCol: number;
  /** the mine's GBX collector: where the four row bands die */
  gbxSinkX: number;
  gbxSinkY: number;
  /* ---- the fork, as an orthogonal pipe run. Every leg is vertical where its
     width has to be read, so a stroke's perpendicular width IS the quantity. */
  splitY: number;
  claimY: number;
  /** the row the 20% remainder traverses on, clear of the claim's sink */
  headerY: number;
  landY: number;
  tallyY: number;
  routerVy: number;
  routerVh: number;
  routerVw: number;
  routerValveY: number;
  trunkY0: number;
  trunkY1: number;
  laneLandY: number;
  laneLabelY: number;
  fiY: number;
  aucTop: number;
  aucH: number;
  aucValY: number;
  aucDetailY: number;
  aucGaugeY: number;
  aucNoteY: number;
  aucTradeY: number;
  aucTapY: number;
  /** the exchange: blue out to the trader, the asset back */
  yOut: number;
  yBack: number;
  bayTop: number;
  bayBot: number;
  bayNoteY: number;
  supplyY: number;
  /** the four claim bands merge onto the spine HERE, then run down together */
  mergeY: number;
  /** the mint: the inflow that puts back what the burn took */
  mintY: number;
  burnY0: number;
  burnY1: number;
  collectY: number;
  /** the plate's spine — where the trunk runs */
  cx: number;
  /** where the four claim bands collect. Off-spine at 390, see mergeY. */
  collectC: number;
  /** the four lanes, fixed order, at every station */
  bays: Bay[];
  bayW: number;
}

interface Painted {
  path: Path2D;
  ink: string;
}

interface Check {
  seg: string;
  what: string;
  claim: number;
  drawn: number;
  err: number;
  /** a row that is SUPPOSED to be non-zero: it calibrates the zeros beside it */
  control?: boolean;
}

export function Plate() {
  useLayoutEffect(() => {
    const root = document.getElementById('sec-plate');
    const canvasNode = document.getElementById('pl-canvas');
    if (!root || !(canvasNode instanceof HTMLCanvasElement)) return;
    const canvas = canvasNode;
    const ctxOrNull = canvas.getContext('2d');
    if (!ctxOrNull) return;
    const ctx = ctxOrNull;
    const panel = root.querySelector<HTMLElement>('.sim-panel');
    if (!panel) return;

    /* ---------------------------------------------------------- the palette */
    const ink = readInk();
    const MONO = fontFamily('--font-mono', '"JetBrains Mono", monospace');
    const mono = (px: number, weight = 500) => `${weight} ${px}px ${MONO}`;
    const fonts = legendFonts(MONO);
    const hueOf = (i: number) => ASSET_HUES[i]?.hue ?? ink.hi;

    /* ------------------------------------------------------------ the models
       Frozen. Each is stepped on the scale it was written for. */
    const mn: MineState = createMineState();
    const rz: ResonanceState = createResonanceState();
    const au: AucState = createAucState();
    const rd: RedState = createRedState(
      ASSET_HUES.map((a, i) => ({
        sym: a.sym,
        amt: [1200, 400, 2.4, 860][i] ?? 100,
        base: [1200, 400, 2.4, 860][i] ?? 100,
        hue: a.hue,
        grain: 1,
      })),
    );

    /* The mine's effects on THIS plate. The tape and the detail-cell flash
       belong to the mining section; here a take spawns the payment packet the
       fork is drawn from, and nothing else. */
    interface Packet {
      /** real seconds since the take */
      age: number;
      slot: number;
      paid: number;
      toMiner: number;
      toRouter: number;
      accrued: number;
      displaced: string | null;
      buyer: string;
      restart: number;
    }
    let packet: Packet | null = null;
    const mineFx: MineFx = {
      narrate(index, buyer, displaced, paid, toMiner, toRouter, accrued) {
        if (mn.warming || paid <= 0) return;
        packet = {
          age: 0,
          slot: index,
          paid,
          toMiner,
          toRouter,
          accrued,
          displaced,
          buyer,
          restart: mn.slots[index]?.initialPrice ?? paid,
        };
      },
    };
    warmStart(mn, mineFx);
    packet = null;
    seedHistory(au, {});

    /* ---------------------------------------------------- the Router, drawn
       The one piece of state the plate owns, because no shipped model owns it:
       ResonanceRouter is where Mine's deposits STOP. It is not a quantity the
       plate invents — every unit in it arrived from a `buy()` the frozen mine
       model performed, and every unit leaves through the outlet below. */
    const router = {
      held: 0,
      /** everything of the mine's own tally the plate has drawn arriving */
      bookedIn: 0,
      outTotal: 0,
      lastRouted: 0,
      /** the published ceiling of the vessel's own scale, eased like the fund's */
      cap: 24,
      capShown: 24,
      /** real seconds until route() is next called by nobody in particular */
      wait: ROUTE_MIN,
      open: 0,
      sinceRoute: 0,
    };
    /* GBX accounting the plate must not lose: the mine mints an outgoing
       tenure's pending emission at replacement. */
    /* THE MINE'S GBX IDENTITY. Every unit of emission is either still pending
       in a slot's clock or already minted at a replacement — nothing else can
       happen to it. `issued` integrates the board's own assigned rates
       independently of both, so a unit that appeared or vanished anywhere in
       the model would move this off zero. It is not the same statement twice. */
    let issued = 0;
    /* Ambient takes deposit too, and they are not narrated — so the Router's
       level would otherwise rise with nothing visibly arriving. Every booking
       lights this drip at the inlet: nothing appears without a mechanism. */
    let drip = 0;

    /* THE MINT, at station 06. `mark` is the supply the last burn left behind;
       `since` is everything the model has issued since, banked one frame at a
       time. `mark + since` and the model's own `supply` are two independent
       arithmetics, and the plate prints their difference. */
    const mint = { mark: SUPPLY0, since: 0, total: 0, burned: 0, rate: 0 };


    /* ------------------------------------------------------------- the fund
       What the auctions have delivered into each bay, in USDG of value spent.
       This is a plate-level tally of the frozen resonance model's own flushes;
       it is drawn as a number, never as unbounded geometry. */
    const bought = [0, 0, 0, 0];
    const tapped = [0, 0, 0, 0];
    /** the live flush, per lane: the lot the auction just took */
    const flush = ASSET_HUES.map(() => ({ age: 2, lot: 0 }));
    const prevFlash = ASSET_HUES.map(() => 0);

    /* --------------------------------------------------------------- sizing */
    const hasRO = typeof ResizeObserver !== 'undefined';
    const meas = { w: canvas.clientWidth, h: canvas.clientHeight };
    const view = { w: 0, h: 0, dpr: 1 };
    function resize(): boolean {
      const w = hasRO ? meas.w : canvas.clientWidth;
      const h = hasRO ? meas.h : canvas.clientHeight;
      if (w <= 0 || h <= 0) return false;
      /* A plate is tall. Cap the backing store so a 1440x3400 canvas at dpr 2
         does not ask for 40 megapixels of GPU memory on a laptop. */
      const want = Math.min(2, window.devicePixelRatio || 1);
      const px = w * h * want * want;
      const dpr = px > 9e6 ? Math.max(1, want * Math.sqrt(9e6 / px)) : want;
      if (w === view.w && h === view.h && dpr === view.dpr) return true;
      view.w = w;
      view.h = h;
      view.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      L = null;
      return true;
    }

    let L: Layout | null = null;

    /* THE LEGEND IS PAINTED ONCE, NOT EVERY FRAME. `drawLegend` solves its own
       columns from measured text — hundreds of `measureText` calls and a
       thousand draw ops — and none of it changes between frames. So it is
       rendered into an offscreen canvas at layout time and a frame costs one
       `drawImage`. Same rule the harness applies to d3: no layout work inside
       paint. */
    const legendTile = document.createElement('canvas');
    const legendCtx = legendTile.getContext('2d');
    let legendW = 0;
    let legendDpr = 0;

    /** The legend solves its own height from measured text, so ask it. */
    function legendHeight(w: number): number {
      const probe = document.createElement('canvas').getContext('2d');
      if (!probe) return 300;
      probe.font = fonts.name;
      /* drawLegend lays out from measured text; running it into a throwaway
         context is cheaper and more honest than guessing a constant. */
      return drawLegend(probe, { x: 0, y: 0, w }, { ink, fonts, dpr: 1 });
    }

    function renderLegend(w: number, h: number, dpr: number): void {
      if (legendCtx === null) return;
      if (legendW === w && legendDpr === dpr && legendTile.height === Math.round(h * dpr)) return;
      legendW = w;
      legendDpr = dpr;
      legendTile.width = Math.max(1, Math.round(w * dpr));
      legendTile.height = Math.max(1, Math.round(h * dpr));
      legendCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      legendCtx.clearRect(0, 0, w, h);
      legendCtx.textBaseline = 'alphabetic';
      drawLegend(legendCtx, { x: 0, y: 0, w: w - 16 }, { ink, fonts, dpr });
    }

    function buildLayout(): Layout {
      const w = view.w;
      const h = view.h;
      const narrow = w < 720;
      const mid = w < 1024;
      const pad = narrow ? 14 : 26;
      const inner = w - pad * 2;
      /* the key is laid out into a box 16px narrower than the tile it is drawn
         into, so a row that composes wider than its column (the QQQ swatch pair
         at 390 rendered as `QQC`) has somewhere to go instead of the tile edge */
      const legendH = legendHeight(inner - 16);

      /* HEAD_H is the reserved title row every station gets. Nothing is ever
         drawn into it, which is why no station title can collide with the
         station above it however the band heights move. */
      const HEAD_H = narrow ? 66 : 34;

      /* Fixed bands first, then the flexible ones share what is left by
         weight, each with a floor that is the sum of its own reserved rows.
         Nothing is ever cut by its own container: if the floors do not fit
         the section's declared height the plate grows past it, which the
         measurement catches, rather than a mark being silently clipped. */
      const gaugeH = narrow ? 232 : 96;
      const headH = gaugeH + (narrow ? 26 : 22);
      const brkH = narrow ? 132 : 106;
      const instrH = narrow ? 366 : 196;
      /* THE KEY MOVED TO THE FOOT. A reader should meet `01 THE MINE` first and
         use the key as reference afterwards; every band, bay and lane on this
         plate is labelled inline, so it reads without the key in front of it.
         At the head the legend was 22% of the plate at 1440 and 30% at 390 —
         two viewport-heights of key before the first mechanism. */
      const keyH = legendH + (narrow ? 40 : 34);
      const fixed = headH + brkH + instrH + keyH + pad * 2;

      const cgap = narrow ? 5 : 8;
      const chMin = narrow ? 78 : 92;
      /* the fork's reserved rows, below the board — see FORK, in build() */
      const forkH = (narrow ? 40 : 44) + (narrow ? 78 : 116) + (narrow ? 78 : 52) + (narrow ? 30 : 26);
      const mineMin = HEAD_H + (narrow ? 100 : 42) + (chMin * 4 + cgap * 3) + 20 + forkH;
      const flex: { k: 'mine' | 'router' | 'stream' | 'auc' | 'fund' | 'you'; w: number; min: number }[] = [
        { k: 'mine', w: 32, min: mineMin },
        { k: 'router', w: 10, min: HEAD_H + (narrow ? 300 : 176) },
        { k: 'stream', w: 14, min: HEAD_H + (narrow ? 250 : 232) },
        { k: 'auc', w: 20, min: HEAD_H + (narrow ? 640 : 392) },
        { k: 'fund', w: 10, min: HEAD_H + (narrow ? 250 : 200) },
        { k: 'you', w: 14, min: HEAD_H + (narrow ? 420 : 250) },
      ];
      const room = Math.max(0, h - fixed);
      const wsum = flex.reduce((n, f) => n + f.w, 0);
      const hs: Record<string, number> = {};
      flex.forEach((f) => {
        hs[f.k] = Math.max(f.min, (room * f.w) / wsum);
      });
      /* NOTHING IS EVER CUT BY ITS OWN CONTAINER — the primary bar. If the
         floors do not fit the height the section declared (a legend that has
         grown, a breakpoint nobody measured), every flexible band is scaled
         down together rather than the last station falling off the bottom.
         The plate gets tighter; it never gets truncated. */
      let want = 0;
      for (const f of flex) want += hs[f.k] ?? 0;
      if (want > room && want > 0) {
        const k = room / want;
        for (const f of flex) hs[f.k] = (hs[f.k] ?? 0) * k;
      }

      let y = pad;
      const band = (hh: number): Band => {
        const b = { y0: y, y1: y + hh };
        y += hh;
        return b;
      };
      const head = band(headH);
      const mine = band(hs.mine ?? 640);
      const router = band(hs.router ?? 210);
      const brk = band(brkH);
      const stream = band(hs.stream ?? 270);
      const auc = band(hs.auc ?? 360);
      const fund = band(hs.fund ?? 234);
      const you = band(hs.you ?? 240);
      const instr = band(instrH);
      const key = band(keyH);

      /* ---- the mine board: sixteen cells, always four across ------------ */
      const gbxCol = narrow ? 0 : Math.max(168, Math.min(250, inner * 0.2));
      const gridW = inner - gbxCol;
      const cw = (gridW - cgap * 3) / 4;
      /* The tallies are the station's readout, so they sit at its head where
         nothing crosses them; the fork runs below the board, and the 80% leg
         DEAD-ENDS INSIDE STATION 01 — only the remainder crosses into the
         Router's station, which is the truth about where each half goes. */
      const tallyY = mine.y0 + HEAD_H + (narrow ? 30 : 22);
      const gridTop = tallyY + (narrow ? 62 : 20);
      /* ---- THE FORK'S RESERVED ROWS, bottom-up from the station's foot.
         Each is a row nothing else is allowed into, which is what lets the
         claim leg run VERTICALLY for its whole length: a stroke's width is
         perpendicular, so a vertical leg is drawn at exactly its quantity. */
      const capH = narrow ? 40 : 44; // the take caption, under the board
      const claimRun = narrow ? 78 : 116; // the 80% leg's descent, and its readings
      /* at 390 the corridor beside the leg is too narrow to set type in, so the
         sink's three readings go BELOW the sink instead, in rows the header
         band is held clear of */
      const sinkH = narrow ? 78 : 52;
      const headerY = mine.y1 - (narrow ? 16 : 13);
      const claimY = headerY - sinkH;
      const splitY = claimY - claimRun;
      const gridBot = splitY - capH;
      const landY = router.y0 + HEAD_H + 12;
      const ch = Math.max(52, (gridBot - gridTop - cgap * 3) / 4);

      /* ---- the four lanes, in a fixed and permanent order --------------- */
      const laneW = inner / 4;
      const bays: Bay[] = ASSET_HUES.map((a, i) => ({ cx: pad + laneW * (i + 0.5), sym: a.sym, hue: a.hue }));

      /* ---- the stream ---------------------------------------------------- */
      const trunkY0 = stream.y0 + HEAD_H + 22;
      const trunkY1 = trunkY0 + 46;

      /* ---- the auctions -------------------------------------------------- */
      const aucTop = auc.y0 + HEAD_H + 10;
      /* A lane does not stop short of the thing it fills. It runs from the
         splitter onto the bucket's mouth in one piece, crossing station 04's
         rule — which is therefore drawn in the gutters BETWEEN the bands,
         with the station's tag in the middle gutter, the way a plant drawing
         steps a section line around a pipe rather than through it. */
      const laneLandY = aucTop;
      const laneLabelY = aucTop - 58;
      const fiY = trunkY1 + (laneLandY - trunkY1) * 0.58;
      /* EVERY ROW BELOW THE BUCKETS IS RESERVED, bottom-up, and each one is
         wide enough for the type it carries. The old spacing put the trade
         caption 8px under a two-line note and the two overprinted in EVERY
         capture, reduced motion included. Rows, not offsets. */
      const aucTapY = auc.y1 - 14;
      const yBack = aucTapY - (narrow ? 24 : 28);
      const yOut = yBack - (narrow ? 26 : 30);
      const aucTradeY = yOut - 22; // "USDG out · the asset back" — its own row
      const aucNoteY = aucTradeY - (narrow ? 42 : 34); // the 10% note, two lines
      const aucGaugeY = aucNoteY - (narrow ? 30 : 24); // the lot scale bar
      const aucDetailY = aucGaugeY - (narrow ? 48 : 26); // "one auction in detail"
      const aucValY = aucDetailY - (narrow ? 40 : 34); // the bucket readings
      const aucH = Math.max(48, aucValY - (narrow ? 22 : 18) - aucTop);

      /* ---- the fund and the claim ---------------------------------------- */
      const bayTop = fund.y0 + HEAD_H + 14;
      const bayNoteY = fund.y1 - (narrow ? 34 : 12);
      const bayBot = bayNoteY - (narrow ? 44 : 46);
      /* stock and flow, in that order down the page: the mint arrives from
         above, the supply bar is the stock, the burn leaves below. Both flows
         are anchored on the bar's HEAD, which is the only place supply moves. */
      const mintY = you.y0 + HEAD_H + (narrow ? 26 : 20);
      const supplyY = mintY + (narrow ? 34 : 38);
      const burnY0 = supplyY + (narrow ? 22 : 20);
      const burnY1 = burnY0 + (narrow ? 36 : 32);
      const collectY = you.y1 - (narrow ? 120 : 48);
      /* THE FOUR CLAIM BANDS MERGE ONTO THE SPINE IMMEDIATELY. Fanning them
         across the whole width all the way down to the collector put the
         leftmost one straight through the GBX supply bar; merged at the top of
         the station they travel as one stack down the middle, which is also
         what the stack-order caption below the collector describes. */
      const mergeY = you.y0 + HEAD_H + 4;
      /* AT 390 THE STATION SPLITS INTO TWO COLUMNS. The four claim bands merge
         at the top of the station and run down a lane against the right
         margin; the supply bar, the burn and the receipt all live left of it.
         Fanned across the width they crossed every row of the receipt, and
         knocking each label out of them left the bands notched at four
         places — a reserved LANE is the better half of the same rule. */
      const collectC = narrow ? w - pad - 46 : pad + inner / 2;

      /* ---- THE GAUGES. Published, and drawn as scale bars ---------------- */
      /* gStock is only a seed here — station 01's live gauge is derived from
         the mine's own dollar axis in build(). gFlow and gLot are fixed,
         because the quantities they draw are bounded by their own models. */
      const gStock = Math.max(2.1, Math.min(6, inner / 300)); // px per USDG, seed
      /* The stream's rate is a constant of the model (WEEKLY over a seven-day
         DURATION), so its gauge is derived from the width once: the trunk is
         always the same share of the plate and can never be cut by the frame. */
      const gFlow = (inner * 0.32) / (WEEKLY / STREAM);
      /* the bar IS this gauge, and it is kept off the plate's spine: the four
         claim ribbons converge at `cx`, so a supply bar whose head landed there
         would put the burn's own band through the collector */
      const gGbx = (inner * (narrow ? 0.62 : 0.34)) / SUPPLY0; // px per GBX
      const gMined = (narrow ? 0 : 22) / 20000; // px per GBX of pending emission
      /* A LOT IS TWO ORDERS OF MAGNITUDE BIGGER THAN A MINE PAYMENT — hundreds
         of USDG against tens — and no single gauge draws both: at the mine's
         gauge a lot is three plate-widths wide, and at a lot's gauge a $4
         payment is a hairline. So the auctions carry their own gauge, printed
         at the station as a scale bar, exactly the way each fund bay does.
         The alternative is a drawing that lies about one of them. */
      const potCap = 520;
      const gLot = Math.max(46, Math.min(140, laneW * 0.56)) / potCap;

      return {
        w,
        h,
        dpr: view.dpr,
        pad,
        narrow,
        mid,
        gStock,
        gFlow,
        gGbx,
        gMined,
        gLot,
        potCap,
        legendH,
        head,
        mine,
        router,
        brk,
        stream,
        auc,
        fund,
        you,
        instr,
        key,
        cw,
        ch,
        cgap,
        gridX: pad,
        gridW,
        gridTop,
        gridBot,
        gbxX: pad + gridW + (narrow ? 0 : 10),
        gbxCol,
        gbxSinkX: pad + gridW + (narrow ? 0 : 10) + 46,
        gbxSinkY: gridTop + 1.5 * (ch + cgap),
        splitY,
        claimY,
        headerY,
        landY,
        tallyY,
        routerVy: router.y0 + HEAD_H + 16,
        routerVh: Math.max(58, router.y1 - (router.y0 + HEAD_H + 16) - (narrow ? 124 : 58)),
        routerVw: narrow ? 80 : 104,
        routerValveY: router.y1 - (narrow ? 128 : 26),
        trunkY0,
        trunkY1,
        laneLandY,
        laneLabelY,
        fiY,
        aucTop,
        aucH,
        aucValY,
        aucDetailY,
        aucGaugeY,
        aucNoteY,
        aucTradeY,
        aucTapY,
        yOut,
        yBack,
        bayTop,
        bayBot,
        bayNoteY,
        supplyY,
        mergeY,
        mintY,
        burnY0,
        burnY1,
        collectY,
        cx: pad + inner / 2,
        collectC,
        bays,
        bayW: Math.max(46, Math.min(140, laneW * 0.56)),
      };
    }

    function cellBox(l: Layout, i: number): { x: number; y: number } {
      const col = i % 4;
      const row = Math.floor(i / 4);
      return { x: l.gridX + col * (l.cw + l.cgap), y: l.gridTop + row * (l.ch + l.cgap) };
    }


    /* ═════════════════════════════════════════════════════ the build ═══════
       Every d3-shape call on the plate is inside this function, which runs
       from step() and from resize() — never from a frame's paint. */
    const F = {
      /* one list per station, so a station paints exactly its own flows and
         nothing has to be filtered out of a shared pile at frame time */
      streamBands: [] as Painted[],
      aucBands: [] as Painted[],
      claimBands: [] as Painted[],
      gbxNeutral: [] as { band: Path2D }[],
      burnNeutral: null as { band: Path2D } | null,
      pipes: [] as Path2D[],
      checks: [] as Check[],
      /** how far the live payment packet has run, 0..1 */
      packetP: 0,
      /* THE FORK, as stroked orthogonal runs. Every number the stroke uses is
         here, so the checks below read the DRAWN geometry rather than a
         parallel copy of it. */
      fork: null as null | {
        cT: number;
        wT: number;
        trunk: Path2D;
        claim: { path: Path2D; c: number; w: number; q: number } | null;
        rt: { path: Path2D; c: number; w: number; q: number };
      },
      restPipes: [] as Path2D[],
      /* THE MINE'S GAUGE IS LIVE, AND PRINTED LIVE.
         Mine restarts every tenure at paid x2 with a $1 floor, so over a long
         watch the board's prices compound: 30 hours of modelled time takes a
         payment from tens of USDG to tens of millions. A gauge fixed at load
         would therefore draw a correct figure today and a band four hundred
         plate-widths wide tomorrow — the classic failure of a diagram that is
         only ever looked at for ten seconds. So station 01's gauge is derived
         from the mine's OWN dollar axis, the same eased ceiling the board's
         sixteen ramps are drawn against, and the scale bar at the head is
         relabelled from it every frame. Width is still exactly quantity times
         gauge; the gauge is simply published rather than assumed. */
      gStock: 1,
      gStockUnit: 20,
      routeP: 0,
      /** the mine's pending GBX, summed — the collector trunk's own quantity */
      gbxTotal: 0,
      /** the fund's four slice widths, px, and their bays' drawn stock, px */
      slice: [0, 0, 0, 0],
      stock: [0, 0, 0, 0],
      burnW: 0,
    };
    let pipeKey = '';
    let pipeCache: Path2D[] = [];
    let restFork: Path2D[] = [];

    /** a straight run in flow space: x is DOWN, c is ACROSS. */
    function run(key: string, gauge: number, x0: number, x1: number, c: number, q: number): Ribbon {
      return ribbon(key, gauge, [
        { x: x0, c, q },
        { x: x1, c, q },
      ]);
    }

    function build(l: Layout): void {
      /* the live gauge, and a round unit for its scale bar */
      /* the widest band the mine can ever draw is `room`; it is a third of the
         plate so a payment at the top of the board's own dollar axis still has
         a gutter on both sides and the fork's reserved rows still clear it */
      const room = (l.w - l.pad * 2) * 0.34;
      F.gStock = room / Math.max(1, mn.scaleTop);
      const raw = mn.scaleTop / 3;
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, raw))));
      const unit = raw / mag >= 5 ? 5 * mag : raw / mag >= 2 ? 2 * mag : mag;
      F.gStockUnit = unit;

      F.streamBands.length = 0;
      F.aucBands.length = 0;
      F.claimBands.length = 0;
      F.gbxNeutral.length = 0;
      F.burnNeutral = null;
      F.checks.length = 0;

      /* ---- static plant: every route drawn as a hairline, so a shut leg
         reads as an empty pipe rather than as a hole in the composition ---- */
      const key = l.w + ':' + l.h;
      if (pipeKey !== key) {
        pipeCache = [];
        /* THE FORK AT REST — the same orthogonal route the payment takes, with
           nothing in it. It is drawn under the board's centre column because
           that is where a route with no payment on it has to be; the live run
           follows whichever slot was actually taken. */
        const restC = l.gridX + l.gridW / 2;
        restFork = [
          pipePath(
            [
              { x: restC, y: l.gridBot },
              { x: restC, y: l.splitY },
              { x: restC - 22, y: l.splitY + 16 },
              { x: restC - 22, y: l.claimY },
            ],
            10,
          ),
          pipePath(
            [
              { x: restC, y: l.splitY },
              { x: restC + 22, y: l.splitY + 16 },
              { x: restC + 22, y: l.headerY },
              { x: l.cx, y: l.headerY },
              { x: l.cx, y: l.landY },
            ],
            12,
          ),
        ];
        const zeroSplit = splitFlow({
          gauge: 1,
          at: { x: l.trunkY1, c: l.cx, q: 0 },
          legs: l.bays.map((b, i) => ({ key: 'l' + i, q: 0, to: { x: l.laneLandY, c: b.cx } })),
          steps: 16,
        });
        zeroSplit.forEach((r) => pipeCache.push(centrePath(r)));
        const zeroClaim = convergeFlow({
          gauge: 1,
          sources: l.bays.map((b, i) => ({ key: 'c' + i, q: 0, from: { x: l.bayBot + 4, c: b.cx } })),
          at: { x: l.mergeY, c: l.collectC },
          steps: 16,
        });
        zeroClaim.legs.forEach((r) => pipeCache.push(centrePath(r)));
        pipeCache.push(
          centrePath(
            ribbon('claimTail', 1, [
              { x: l.mergeY, c: l.collectC, q: 0 },
              { x: l.collectY, c: l.collectC, q: 0 },
            ]),
          ),
        );
        /* the exchange's own two legs, at rest */
        l.bays.forEach((bay, i) => {
          const side = i < 2 ? 1 : -1;
          const traderC = bay.cx + side * (l.bayW * 0.5 + (l.narrow ? 26 : 46));
          pipeCache.push(
            centrePath(
              ribbon('po' + i, 1, [
                { x: l.aucTop + l.aucH + 4, c: bay.cx, q: 0 },
                { x: l.yOut, c: traderC, q: 0 },
                { x: l.yBack, c: bay.cx, q: 0 },
                { x: l.bayTop - 6, c: bay.cx, q: 0 },
              ]),
            ),
          );
        });
        pipeKey = key;
      }
      F.pipes = pipeCache;
      F.restPipes = restFork;

      /* ══════════════════════════ S1 · the mine payment ════════════════════
         A payment is a discrete allocation, not a stream. It forks once:
         80% is credited to the displaced miner as a PULL CLAIM they must
         collect — a dead end — and the exact remainder is deposited in the
         Router. It is 100% only on an empty slot's first fill.

         THE ROUTE IS ORTHOGONAL AND THE WIDTH IS A STROKE. The 80% leg runs
         VERTICALLY for its whole length, so the width a reader measures — the
         perpendicular one — is exactly `q x gauge`. The old drawing sent it
         across the plate in 42px of descent: 131.8px in cross-section, 7.4px
         on the page, beside a 20% leg that read twice as thick. Same numbers,
         opposite drawing. */
      if (packet !== null) {
        const p = packet;
        F.packetP = Math.min(1, p.age / PACKET_RUN);
        const cell = cellBox(l, p.slot);
        const from = cell.x + l.cw / 2;
        const wT = widthOf(F.gStock, p.paid);
        /* the trunk is drawn where the money is, unless that would put a band
           through the frame — nothing is ever cut by its own container */
        const lo = l.pad + wT / 2;
        const hi = l.w - l.pad - wT / 2;
        const cT = lo > hi ? l.cx : Math.max(lo, Math.min(hi, from));
        const wClaim = widthOf(F.gStock, p.toMiner);
        const wRt = widthOf(F.gStock, p.toRouter);
        /* the two legs stack across the trunk's WHOLE cross-section: the claim
           takes the left of it, the remainder the right, and their outer edges
           are the trunk's own. No seam, no overlap — checked below. */
        const cClaim = cT - wT / 2 + wClaim / 2;
        const cRt = cT + wT / 2 - wRt / 2;
        const trunk = pipePath(
          [
            { x: cT, y: l.gridBot },
            { x: cT, y: l.splitY },
          ],
          0,
        );
        const claimPath =
          p.toMiner > 0
            ? pipePath(
                [
                  { x: cClaim, y: l.splitY },
                  { x: cClaim, y: l.claimY },
                ],
                0,
              )
            : null;
        /* the remainder steps clear of the claim, so the fork is a fork and not
           one band that happens to stop being one. The step is orthogonal, so
           the stroke is still perpendicular the whole way. */
        const jog =
          p.toMiner > 0 ? Math.max(0, Math.min(18, l.w - l.pad - (cRt + wRt / 2) - 2)) : 0;
        const rtPts: Pt[] =
          jog > 1
            ? [
                { x: cRt, y: l.splitY },
                { x: cRt, y: l.splitY + 24 },
                { x: cRt + jog, y: l.splitY + 24 },
                { x: cRt + jog, y: l.headerY },
                { x: l.cx, y: l.headerY },
                { x: l.cx, y: l.landY },
              ]
            : [
                { x: cRt, y: l.splitY },
                { x: cRt, y: l.headerY },
                { x: l.cx, y: l.headerY },
                { x: l.cx, y: l.landY },
              ];
        const rtPath = pipePath(rtPts, Math.min(14, Math.max(3, wRt * 0.55)));
        F.fork = {
          cT,
          wT,
          trunk,
          claim: claimPath === null ? null : { path: claimPath, c: cClaim, w: wClaim, q: p.toMiner },
          rt: { path: rtPath, c: cRt, w: wRt, q: p.toRouter },
        };

        /* THE JUNCTION, read off the numbers the strokes actually use. */
        const at: Station = { x: l.splitY, c: cT, q: p.paid };
        const legs: Ribbon[] = [];
        if (claimPath !== null)
          legs.push(ribbon('claim', F.gStock, [{ x: l.splitY, c: cClaim, q: p.toMiner }]));
        legs.push(ribbon('rt', F.gStock, [{ x: l.splitY, c: cRt, q: p.toRouter }]));
        const rep = junctionReport(at, legs, F.gStock, 'first');
        F.checks.push({
          seg: 'S1',
          what: 'mine payment → claim + Router',
          claim: p.paid,
          drawn: rep.legQ,
          err: rep.qErr + rep.maxSeamPx + rep.spanErrPx,
        });
        /* THE ROW THAT GUARDS THE FIX. A stroke's width is perpendicular, so a
           leg drawn on an axis is drawn at exactly its quantity — and a leg
           drawn on a slant is not, whatever its cross-section says. Every
           segment of every leg must therefore be axis-aligned: the error is
           the worst segment's smaller displacement, in px, and it goes
           non-zero the instant anyone re-routes a leg diagonally again. */
        const runs: Pt[][] = [
          [
            { x: cT, y: l.gridBot },
            { x: cT, y: l.splitY },
          ],
          rtPts,
        ];
        if (claimPath !== null)
          runs.push([
            { x: cClaim, y: l.splitY },
            { x: cClaim, y: l.claimY },
          ]);
        let offAxis = 0;
        runs.forEach((pts) => {
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            if (a === undefined || b === undefined) continue;
            offAxis = Math.max(offAxis, Math.min(Math.abs(b.x - a.x), Math.abs(b.y - a.y)));
          }
        });
        F.checks.push({
          seg: 'S1',
          what: 'every leg on an axis — width is perpendicular · px',
          claim: 0,
          drawn: offAxis,
          err: offAxis,
        });
      } else {
        F.packetP = 0;
        F.fork = null;
        F.checks.push({ seg: 'S1', what: 'no payment in flight', claim: 0, drawn: 0, err: 0 });
      }

      let pendingGbx = 0;
      mn.slots.forEach((sl) => (pendingGbx += sl.mined));
      F.checks.push({
        seg: 'S1',
        what: 'GBX issued = pending on the clocks + minted',
        claim: issued,
        drawn: pendingGbx + mn.totalMined,
        err: Math.abs(issued - pendingGbx - mn.totalMined),
      });

      /* ══════════════════════════ S2 · the Router ══════════════════════════
         It HOLDS. The outlet is a separate mechanism and the balance below is
         the proof that nothing leaks: in − out − held must be exactly zero. */
      /* Two independent accumulators against the frozen model's own tally:
         `held` is added to on every booking and zeroed by route(), `outTotal`
         is added to only by route(). A leak in either — a discharge that
         forgets to bank what it took, a booking that lands twice — moves this
         off zero. It is not the same statement twice. */
      const inFlightNow = packet !== null && packet.age < PACKET_RUN ? packet.toRouter : 0;
      F.checks.push({
        seg: 'S2',
        what: 'Router: mine deposits − routed − held − in flight',
        claim: mn.routerDeposits,
        drawn: router.outTotal + router.held + inFlightNow,
        err: Math.abs(mn.routerDeposits - router.outTotal - router.held - inFlightNow),
      });

      /* ═══════════════════ S3 · the stream, split by signal ════════════════
         A NEW segment. Everything below the break is a rate in USDG/s, and
         the four lane widths always sum to the trunk. */
      const total = totalStake(rz);
      const rate = rz.flow.t < rz.flow.finish ? rz.flow.rate : 0;
      if (rate > 0) {
        const trunk = run('stream', l.gFlow, l.trunkY0, l.trunkY1, l.cx, rate);
        F.streamBands.push({ path: ribbonPath(trunk), ink: USDG });
        /* the residual goes on the last leg, exactly the way the contracts
           allocate it (`toRouter = paid − toMiner`), so the sum is exact in
           floating point rather than nearly exact */
        let acc = 0;
        const legs = rz.assets.map((a, i) => {
          const q = i === rz.assets.length - 1 ? rate - acc : rate * (a.stake / total);
          acc += q;
          return { key: a.sym, q, to: { x: l.laneLandY, c: l.bays[i]?.cx ?? l.cx } };
        });
        const at: Station = { x: l.trunkY1, c: l.cx, q: rate };
        const fan = splitFlow({ gauge: l.gFlow, at, legs, steps: 18 });
        fan.forEach((r) => F.streamBands.push({ path: ribbonPath(r), ink: USDG }));
        const rep = junctionReport(at, fan, l.gFlow, 'first');
        F.checks.push({
          seg: 'S3',
          what: 'stream → four lanes, by signal',
          claim: rate,
          drawn: rep.legQ,
          err: rep.qErr + rep.maxSeamPx + rep.spanErrPx,
        });
        /* THE PX ERROR, NOT THE UNIT ERROR. In units the scan is exactly zero
           for ever, because the residual goes on the last lane by construction
           — a zero indistinguishable from an unwired instrument. The px error
           is a different arithmetic (four products summed against one) and
           carries real float noise, so it moves. */
        const scan = scanConservation({ legs: fan, total: rate, from: l.trunkY1, to: l.laneLandY, samples: 33 });
        F.checks.push({
          seg: 'S3',
          what: 'across the fan, 33 stations · px',
          claim: widthOf(l.gFlow, rate),
          drawn: widthOf(l.gFlow, rate) + scan.maxAbsPxErr,
          err: scan.maxAbsPxErr,
        });
        /* AND THE LIVE POSITIVE CONTROL. The same check, every frame, against
           a fan with one lane 0.4% short — so the zero beside it is calibrated
           rather than asserted. If this row ever reads zero, the instrument is
           broken and the row above it means nothing. */
        const bad = splitFlow({
          gauge: l.gFlow,
          at,
          legs: legs.map((lg, i) => (i === 1 ? { ...lg, q: lg.q * 0.996 } : lg)),
          steps: 18,
        });
        const badScan = scanConservation({ legs: bad, total: rate, from: l.trunkY1, to: l.laneLandY, samples: 33 });
        F.checks.push({
          seg: '··',
          what: 'positive control — one lane 0.4% short',
          claim: widthOf(l.gFlow, rate),
          drawn: widthOf(l.gFlow, rate) - badScan.maxAbsPxErr,
          err: badScan.maxAbsPxErr,
          control: true,
        });
        /* THE ONE THAT IS NOT FREE. Sum-of-legs = trunk holds by construction,
           because the residual goes on the last lane the way the contracts
           allocate it — an injected error on one lane is absorbed by another
           and that row never moves. What is not free is that every lane's
           DRAWN width is its own signal share, so it is checked lane by lane. */
        let shareErr = 0;
        let widest = 0;
        fan.forEach((r, i) => {
          const want = rate * ((rz.assets[i]?.stake ?? 0) / total);
          const got = r.stations[0]?.q ?? 0;
          shareErr = Math.max(shareErr, Math.abs(got - want));
          widest = Math.max(widest, want);
        });
        F.checks.push({
          seg: 'S3',
          what: 'each lane width = its own signal share',
          claim: widest,
          drawn: widest + shareErr,
          err: shareErr,
        });
      } else {
        F.checks.push({ seg: 'S3', what: 'stream between weeks', claim: 0, drawn: 0, err: 0 });
      }

      /* ══════════ S4 · the auction: an exchange, and the tenth ═════════════
         The lot leaves as USDG and the asset comes back. The plate does not
         claim a unit conversion it has no price for: the asset band is drawn
         on the same gauge as the USDG that bought it — the trade IS the price
         — and the split across it is the contract's 90/10. */
      let s4claim = 0;
      let s4drawn = 0;
      let s4x = 0;
      flush.forEach((f, i) => {
        if (f.age >= 1 || f.lot <= 0) return;
        const bay = l.bays[i];
        if (!bay) return;
        const hue = hueOf(i);
        const lot = f.lot;
        const toFund = lot * (1 - BRIBE);
        const toSig = lot - toFund;
        /* THE TRADE IS AN EXCHANGE, not a recolour in place. Blue USDG leaves
           the bucket and goes OUT to a trader; an asset hue comes BACK the
           other way. Both legs carry the same width because the trade IS the
           price: the asset band is drawn on the gauge of the USDG that bought
           it, which is the only claim the plate has a model for. */
        const side = i < 2 ? 1 : -1;
        const traderC = bay.cx + side * (l.bayW * 0.5 + (l.narrow ? 26 : 46));
        const outR = ribbon('out' + i, l.gLot, [
          { x: l.aucTop + l.aucH + 4, c: bay.cx, q: lot },
          { x: l.yOut, c: traderC, q: lot },
        ]);
        const backR = ribbon('back' + i, l.gLot, [
          { x: l.yOut, c: traderC, q: lot },
          { x: l.yBack, c: bay.cx, q: lot },
        ]);
        F.aucBands.push({ path: ribbonPath(outR), ink: USDG });
        F.aucBands.push({ path: ribbonPath(backR), ink: hue });
        const at: Station = { x: l.yBack, c: bay.cx, q: lot };
        const legs = [
          { key: 'sig' + i, q: toSig, to: { x: l.aucTapY, c: bay.cx - l.bayW * 0.74 } },
          { key: 'bay' + i, q: toFund, to: { x: l.bayTop - 6, c: bay.cx } },
        ];
        const fan = splitFlow({ gauge: l.gLot, at, legs, steps: 12 });
        fan.forEach((r) => F.aucBands.push({ path: ribbonPath(r), ink: hue }));
        const rep = junctionReport(at, fan, l.gLot, 'first');
        s4claim += lot;
        s4drawn += rep.legQ;
        /* the exchange itself, read off the two bands as drawn: what left for
           the trader and what came back must be the same width, because the
           asset band is on the gauge of the USDG that bought it */
        const outEnd = outR.stations[outR.stations.length - 1]?.q ?? 0;
        const backStart = backR.stations[0]?.q ?? 0;
        s4x = Math.max(s4x, Math.abs(widthOf(l.gLot, outEnd) - widthOf(l.gLot, backStart)));
      });
      F.checks.push({
        seg: 'S4',
        what: 'lot → 90% the fund + 10% signalers',
        claim: s4claim,
        drawn: s4drawn,
        err: Math.abs(s4claim - s4drawn) + s4x,
      });

      /* ═══════════════ S5 · the burn, and the same slice everywhere ════════
         A burn of p% of supply takes p% of EVERY bay. The four claim ribbons
         are therefore the same FRACTION of their own bays, which is the
         pro-rata argument drawn rather than asserted. Their widths are read
         off the bays' own drawn stock, so what leaves a bay is exactly the
         band that vanished from it. */
      const bayH = Math.max(30, l.bayBot - l.bayTop);
      const burning = rd.phase === 'burn';
      const k = burning ? Math.min(1, rd.pt / 1.1) : 0;
      let sliceSum = 0;
      rd.holds.forEach((hh, i) => {
        const cap = 1.22;
        const frac = Math.max(0, Math.min(hh.amt / hh.base, cap)) / cap;
        F.stock[i] = frac * bayH;
        F.slice[i] = burning ? rd.pct * F.stock[i] : 0;
        sliceSum += F.slice[i]!;
      });
      if (burning && sliceSum > 0) {
        const conv = convergeFlow({
          gauge: 1, // already in px: a fraction of a drawn stock IS a length
          sources: l.bays.map((b, i) => ({
            key: 'claim' + i,
            q: (F.slice[i] ?? 0) * ease(Math.min(1, k * 1.25)),
            from: { x: l.bayBot + 4, c: b.cx },
          })),
          at: { x: l.mergeY, c: l.collectC },
          steps: 16,
        });
        conv.legs.forEach((r, i) => {
          F.claimBands.push({ path: ribbonPath(r), ink: hueOf(i) });
          /* and on down the spine to the collector, each keeping its place in
             the stack — bay order, left to right, at every station */
          const end = r.stations[r.stations.length - 1];
          if (end === undefined) return;
          F.claimBands.push({
            path: ribbonPath(run('tail' + i, 1, l.mergeY, l.collectY, end.c, end.q)),
            ink: hueOf(i),
          });
        });
        const rep = junctionReport(conv.at, conv.legs, 1, 'last');
        F.checks.push({
          seg: 'S5',
          what: 'the same % out of every bay → you',
          claim: conv.at.q,
          drawn: rep.legQ,
          err: rep.qErr + rep.maxSeamPx + rep.spanErrPx,
        });
      } else {
        F.checks.push({ seg: 'S5', what: 'between burns — the bays refill', claim: 0, drawn: 0, err: 0 });
      }

      /* the burn itself: GBX, neutral, and a first-class flow. It leaves the
         bar's HEAD, which is the only place supply moves — the same head the
         mint arrives at, so one stock has exactly one inflow and one outflow
         and a reader can see both against the same edge. */
      F.burnW = burning ? rd.burned * k * l.gGbx : 0;
      if (F.burnW > 0.4) {
        const q = rd.burned * k;
        const head = l.pad + rd.supply * l.gGbx;
        const r = run('burn', l.gGbx, l.supplyY + 11, l.burnY1, head - F.burnW / 2, q);
        F.burnNeutral = { band: ribbonPath(r) };
      }

      /* ═══════════════ S6 · the stock, and the two flows on it ════════════
         NOTHING APPEARS WITHOUT A DRAWN MECHANISM. The bar's fill is
         `supply x gGbx`; the mint band's width is `since x gGbx`; the mark is
         the supply the last burn left. Two independent accumulators — one
         banked frame by frame, one read straight off the model — have to
         agree on where the bar's head is, in px. If a burn ever moved the bar
         without moving the mark, or a frame's issue were dropped on the floor,
         this row moves off zero and the drawing above it is a lie. */
      F.checks.push({
        seg: 'S6',
        what: 'GBX supply = the mark + the mint band drawn on it · px',
        claim: rd.supply * l.gGbx,
        drawn: (mint.mark + mint.since) * l.gGbx,
        err: Math.abs(rd.supply - mint.mark - mint.since) * l.gGbx,
      });

      /* THE MINE'S PENDING GBX — four row collectors into one trunk, and the
         trunk into a terminal. Neutral, at full strength, because this is how
         supply is created.

         THE DEFECT THIS FIXES. The four bands used to begin ten pixels clear
         of the board and end blunt in mid-air past a node, so three white
         ribbons floated in the gutter with no source, no sink and no label of
         their own. Now each one leaves its row's edge — its LEFT edge is the
         board's right edge, so it visibly comes out of the four clocks it sums
         — they stack into one trunk whose width is the total, and the trunk
         runs into a sink that says where it goes. */
      F.gbxTotal = 0;
      if (!l.narrow) {
        const rows = [0, 1, 2, 3].map((r) => {
          let q = 0;
          for (let c = 0; c < 4; c++) q += mn.slots[r * 4 + c]?.mined ?? 0;
          return q;
        });
        rows.forEach((q) => (F.gbxTotal += q));
        const conv = convergeFlow({
          gauge: l.gMined,
          sources: rows.map((q, r) => ({
            key: 'g' + r,
            q,
            /* the band's own left edge IS the board's right edge */
            from: { x: cellBox(l, r * 4).y + l.ch / 2, c: l.gridX + l.gridW + widthOf(l.gMined, q) / 2 },
          })),
          at: { x: l.gbxSinkY, c: l.gbxSinkX },
          steps: 10,
        });
        conv.legs.forEach((r) => F.gbxNeutral.push({ band: ribbonPath(r) }));
        /* and the trunk that carries the sum to its terminal */
        const trunk = run('gbxOut', l.gMined, l.gbxSinkY, l.gbxSinkY + 30, l.gbxSinkX, conv.at.q);
        F.gbxNeutral.push({ band: ribbonPath(trunk) });
        const rep = junctionReport(conv.at, conv.legs, l.gMined, 'last');
        F.checks.push({
          seg: 'S1',
          what: 'four clock rows → one pending trunk',
          claim: conv.at.q,
          drawn: rep.legQ,
          err: rep.qErr + rep.maxSeamPx + rep.spanErrPx,
        });
      }
    }

    /**
     * The redemption model, advanced — and every unit it issues, banked.
     * `redStep` is frozen: idle, the Mine keeps issuing and supply ticks back
     * toward its start. The plate does not change that; it measures it, so
     * station 06 can DRAW the inflow that is putting the stock back. Used by
     * both `step()` and the reduced-motion still, so the still's figures come
     * from the same arithmetic the live plate's do.
     */
    function advanceRedeem(dt: number): void {
      const before = rd.supply;
      redStep(rd, dt, {});
      const d = rd.supply - before;
      if (d > 0) {
        mint.since += d;
        mint.total += d;
        mint.rate = mint.rate + (d / Math.max(1e-6, dt) - mint.rate) * Math.min(1, dt * 4);
      } else if (d < 0) {
        mint.burned += -d;
        mint.mark = rd.supply;
        mint.since = 0;
      }
    }

    /* ═══════════════════════════════════════════════════════ the step ══════ */
    function step(dt: number): void {
      if (!resize()) return;
      if (!L) {
        L = buildLayout();
        renderLegend(L.w - L.pad * 2, L.legendH, L.dpr);
      }
      const l = L;

      /* each model on the clock it was written for */
      let rateBefore = 0;
      mn.slots.forEach((sl) => (rateBefore += sl.tps));
      stepMine(mn, dt * TS_MINE, mineFx);
      /* integrated at the rate the board was assigned when the frame began —
         a replacement inside the step re-rates the slot for the NEXT frame,
         which is exactly what a tenure-locked rate means */
      issued += rateBefore * dt * TS_MINE;
      stepResonance(rz, dt * TS_RZ, {});
      aucStep(au, dt * TS_AUC, {});

      /* ---- THE MINT, watched rather than invented -----------------------
         THE DEFECT THIS FIXES. GBX supply climbed 6–8 million in five seconds
         with the only GBX mechanism at station 06 being the burn, so the stock
         grew with no drawn inflow — the exact failure the definition of done
         names. The refill is the frozen model's own (`redStep` idle: the Mine
         keeps issuing, so supply ticks back toward its start), so the plate
         does not change it. It measures it: every positive step of the model's
         own supply is banked here, and station 06 draws it arriving as a band
         whose width is exactly what it added to the bar. */
      advanceRedeem(dt);

      /* ---- the Router: deposits in, route() out, nothing in between ------
         THE SOURCE IS THE MINE, not the plate. `mn.routerDeposits` is the
         frozen model's own tally; the plate books whatever of it has arrived
         and has finished travelling, and never invents a unit. The narrated
         payment is held back until its packet lands, so the level rises when
         the drawing says it does; every other (ambient, unnarrated) take is
         booked at once and lights the inlet drip, so nothing ever appears in
         the vessel without something visibly arriving. */
      if (packet !== null) {
        const p = packet;
        p.age += dt;
        if (p.age > PACKET_RUN + PACKET_HOLD) packet = null;
      }
      const inFlight = packet !== null && packet.age < PACKET_RUN ? packet.toRouter : 0;
      const arrived = mn.routerDeposits - inFlight;
      if (arrived > router.bookedIn + 1e-12) {
        router.held += arrived - router.bookedIn;
        router.bookedIn = arrived;
        drip = 1;
      }
      if (drip > 0) drip = Math.max(0, drip - dt / 0.5);
      router.sinceRoute += dt;
      if (router.open > 0) {
        router.open = Math.max(0, router.open - dt);
      } else if (router.sinceRoute >= router.wait && router.held > 0) {
        router.lastRouted = router.held;
        router.outTotal += router.held;
        router.held = 0;
        router.open = ROUTE_OPEN;
        router.sinceRoute = 0;
        router.wait = ROUTE_MIN + Math.random() * ROUTE_VAR;
      }
      const capWant = Math.max(24, router.held * 1.22);
      router.cap = capWant > router.cap ? capWant : router.cap + (capWant - router.cap) * Math.min(1, dt * 0.35);
      router.capShown += (router.cap - router.capShown) * Math.min(1, dt * 3.4);

      /* ---- the auctions: the frozen model's own flushes ------------------ */
      rz.assets.forEach((a, i) => {
        const f = flush[i];
        if (!f) return;
        if (a.flash > prevFlash[i]!) {
          f.age = 0;
          f.lot = a.lastLot;
          bought[i] = (bought[i] ?? 0) + a.lastLot * (1 - BRIBE);
          tapped[i] = (tapped[i] ?? 0) + a.lastLot * BRIBE;
        }
        prevFlash[i] = a.flash;
        if (f.age < 1) f.age = Math.min(1, f.age + dt / 1.5);
      });

      build(l);
    }

    /* ═══════════════════════════════════════════════════════ the paint ═════
       Draw ops only. Every Path2D was built above. */
    function fillFlow(path: Path2D, colour: string): void {
      ctx.save();
      ctx.transform(0, 1, 1, 0, 0, 0);
      ctx.fillStyle = colour;
      ctx.fill(path);
      ctx.restore();
    }
    function strokeFlow(path: Path2D, colour: string, width: number, dash: number[] = []): void {
      ctx.save();
      ctx.transform(0, 1, 1, 0, 0, 0);
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.stroke(path);
      ctx.restore();
    }
    /**
     * Every neutral band on this plate runs DOWN the page, and the lead's
     * ruling is that a band running down takes the flat fill with no shade:
     * inventing a light direction for a vertical run would put two light
     * sources on one drawing. The shaded underside `fillNeutral` offers is
     * used only on the head's horizontal scale bar, where there is an
     * underside to shade.
     */
    function neutralFlow(band: Path2D): void {
      ctx.save();
      ctx.transform(0, 1, 1, 0, 0, 0);
      fillNeutral(ctx, band);
      ctx.restore();
    }

    function label(text: string, x: number, y: number, size = 10, colour = ink.muted, align: CanvasTextAlign = 'left'): void {
      ctx.font = mono(size, 500);
      ctx.fillStyle = colour;
      ctx.textAlign = align;
      ctx.fillText(text, x, y);
    }

    /* ------------------------------------------------------- the knockout ---
       THE DEFECT THIS FIXES. A tall plate has flows running through it at every
       instant, and a caption printed straight onto the panel is legible only
       until a band arrives under it: at 1440 a burn was striking through nine
       label rows at once, and because the reduced-motion still deliberately
       draws an acquisition AND a redemption together, the damage there was
       permanent. ciechanow's bar is explicit — a callout never occludes what
       it names — and the converse has to hold too.

       So every annotation on this plate is set on its own ground: a 2px
       backdrop in `--panel`, painted immediately before the glyphs, so the
       type reads at its published contrast whatever is flowing underneath and
       the band visibly passes BEHIND the label rather than through it. */
    /**
     * The knockout ERASES rather than paints. The panel behind this canvas is
     * a two-stop gradient with a blue radial over it, so a flat `--panel`
     * rectangle would read as a visible box wherever it landed. Compositing
     * `destination-out` cuts a hole in the frame instead and lets the panel's
     * own ground show through, which is the same ground the type was
     * contrast-measured against — so a label reads identically whether a band
     * happens to be under it or not.
     */
    function erase(x: number, y: number, w: number, h: number): void {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    function knock(text: string, x: number, y: number, size: number, align: CanvasTextAlign, ground?: string): void {
      const wpx = ctx.measureText(text).width;
      const x0 = align === 'right' ? x - wpx : align === 'center' ? x - wpx / 2 : x;
      /* inside a raised cell the ground is the cell, not the panel: erasing
         there would punch a hole through the board */
      /* a ground-backed label stands alone inside a cell, so it can afford the
         taller plate that clears a price ramp landing on its own row; an
         erased one sits in a stack, where 11px of lead is the whole budget */
      if (ground !== undefined) {
        ctx.fillStyle = ground;
        ctx.fillRect(x0 - 3, y - size - 3, wpx + 6, size + 7);
      } else erase(x0 - 3, y - size + 1, wpx + 6, size + 2);
    }

    /** A label on its own ground. */
    function labelK(
      text: string,
      x: number,
      y: number,
      size = 10,
      colour = ink.muted,
      align: CanvasTextAlign = 'left',
      weight = 500,
      ground?: string,
    ): void {
      ctx.font = mono(size, weight);
      ctx.textAlign = align;
      knock(text, x, y, size, align, ground);
      ctx.fillStyle = colour;
      ctx.fillText(text, x, y);
    }

    /* ─────────────────────── THE ONE PROSE PATH ─────────────────────────
       Every sentence on this plate goes through these two functions and comes
       out of `PLATE_PROSE`. They are no-ops when `PROSE_ON_CANVAS` is false,
       so the whole (b) set leaves the drawing surface in one line and can be
       rendered from the same record in the section's DOM instead — where it
       wraps rather than truncates and where no ribbon can reach it. */
    type ProseKey = keyof typeof PLATE_PROSE;
    function proseOf(key: ProseKey, extra = ''): string {
      const v = PLATE_PROSE[key];
      return (typeof v === 'string' ? v : v.join(' ')) + extra;
    }
    function prose(
      key: ProseKey,
      x: number,
      y: number,
      maxW: number,
      size: number,
      colour: string,
      align: CanvasTextAlign = 'left',
      maxLines = 4,
      extra = '',
    ): number {
      if (!PROSE_ON_CANVAS) return 0;
      return wrapK(proseOf(key, extra), x, y, maxW, size, colour, align, maxLines);
    }
    function proseLine(
      key: ProseKey,
      x: number,
      y: number,
      size: number,
      colour: string,
      align: CanvasTextAlign = 'left',
      weight = 500,
      extra = '',
    ): void {
      if (!PROSE_ON_CANVAS) return;
      labelK(proseOf(key, extra), x, y, size, colour, align, weight);
    }

    /** Wrapped copy on its own ground. Returns how many lines it drew. */
    function wrapK(
      text: string,
      x: number,
      y: number,
      maxW: number,
      size: number,
      colour: string,
      align: CanvasTextAlign = 'left',
      maxLines = 4,
      lead = 11,
    ): number {
      ctx.font = mono(size, 400);
      ctx.textAlign = align;
      const lines = wrap(ctx, text, Math.max(40, maxW)).slice(0, maxLines);
      lines.forEach((t, i) => {
        knock(t, x, y + i * lead, size, align);
        ctx.fillStyle = colour;
        ctx.fillText(t, x, y + i * lead);
      });
      return lines.length;
    }
    function caps(text: string, x: number, y: number, size = 10.5, colour = ink.hi): number {
      ctx.font = mono(size, 600);
      ctx.fillStyle = colour;
      ctx.textAlign = 'left';
      const extra = size * 0.19;
      let cx = x;
      for (const ch of text) {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + extra;
      }
      return cx - x - extra;
    }
    function rule(l: Layout, y: number, x0: number, x1: number, colour: string): void {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      const yy = hairline(y, l.dpr);
      ctx.moveTo(x0, yy);
      ctx.lineTo(x1, yy);
      ctx.stroke();
    }
    /**
     * A rule that steps AROUND the four lanes and puts its tag in the middle
     * gutter, the way a plant drawing steps a section line around a pipe
     * rather than through it. Stations 04 and 05 use it because the flow runs
     * straight through where their titles would otherwise sit.
     */
    function steppedHead(l: Layout, y: number, n: string, title: string, halfOf: (i: number) => number, gap = 1): void {
      ctx.strokeStyle = ink.ruleStrong;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      const yy = hairline(y, l.dpr);
      let cursor = l.pad;
      ctx.beginPath();
      l.bays.forEach((bay, i) => {
        ctx.moveTo(cursor, yy);
        ctx.lineTo(Math.max(cursor, bay.cx - halfOf(i)), yy);
        cursor = Math.max(cursor, bay.cx + halfOf(i));
      });
      ctx.moveTo(cursor, yy);
      ctx.lineTo(l.w - l.pad, yy);
      ctx.stroke();
      const gutter = ((l.bays[gap]?.cx ?? l.cx) + halfOf(gap) + (l.bays[gap + 1]?.cx ?? l.cx) - halfOf(gap + 1)) / 2;
      ctx.font = mono(11, 600);
      const tagW = ctx.measureText(n + '  ' + title).width * 1.19;
      /* a knockout under the tag: a station's name may sit in a gutter that a
         transient band later runs through, and a title half on a band is worse
         than a title that has cleared itself a plate */
      erase(gutter - tagW / 2 - 8, y + 2, tagW + 16, 18);
      const nw = caps(n, gutter - tagW / 2, y + 15, 11, ink.hi);
      caps(title, gutter - tagW / 2 + nw + 12, y + 15, 11, ink.hi);
    }

    function stationHead(
      l: Layout,
      b: Band,
      n: string,
      title: string,
      noteKey: ProseKey,
      gap?: { c: number; half: number },
    ): void {
      const note = proseOf(noteKey);
      /* a section line steps AROUND a pipe, it never draws through it */
      if (gap !== undefined && gap.half > 0.5) {
        rule(l, b.y0, l.pad, Math.max(l.pad, gap.c - gap.half - 3), ink.ruleStrong);
        rule(l, b.y0, Math.min(l.w - l.pad, gap.c + gap.half + 3), l.w - l.pad, ink.ruleStrong);
      } else rule(l, b.y0, l.pad, l.w - l.pad, ink.ruleStrong);
      const nw = caps(n, l.pad, b.y0 + 17, 11, ink.hi);
      const tw = caps(title, l.pad + nw + 14, b.y0 + 17, 11, ink.hi);
      if (!PROSE_ON_CANVAS) return;
      ctx.font = mono(l.narrow ? 9 : 10, 400);
      const nx = l.pad + nw + tw + 28;
      if (ctx.measureText(note).width + nx <= l.w - l.pad)
        labelK(note, nx, b.y0 + 17, l.narrow ? 9 : 10, ink.muted, 'left', 400);
      else wrapK(note, l.pad, b.y0 + 30, l.w - l.pad * 2, l.narrow ? 9 : 10, ink.muted, 'left', 3);
    }

    function paint(): void {
      if (!resize()) return;
      if (!L) {
        L = buildLayout();
        renderLegend(L.w - L.pad * 2, L.legendH, L.dpr);
        build(L);
      }
      const l = L;
      ctx.setTransform(l.dpr, 0, 0, l.dpr, 0, 0);
      ctx.clearRect(0, 0, l.w, l.h);
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';

      paintHead(l);
      paintMine(l);
      paintRouter(l);
      paintBreak(l);
      paintStream(l);
      paintAuctions(l);
      paintFund(l);
      paintYou(l);
      paintFundNotes(l);
      paintInstruments(l);
      paintKey(l);
    }

    /* --------------------------------------------------------------- head */
    /* THE KEY IS AT THE FOOT. What stands at the head is the one thing a
       reader needs BEFORE the first mechanism: the gauges the widths are
       drawn at, and a pointer to where the rest of the key lives. */
    function paintHead(l: Layout): void {
      const b = l.head;
      const y = b.y0 + 15;
      const tw = caps('THE THREE GAUGES', l.pad, y, 11, ink.hi);
      ctx.font = fonts.meta;
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      const note = PROSE_ON_CANVAS ? proseOf('gaugeNote') : '';
      if (note !== '' && l.pad + tw + 16 + ctx.measureText(note).width < l.w - l.pad)
        ctx.fillText(note, l.pad + tw + 16, y);

      const bars: { w: number; ink: string; text: string; neutral?: boolean }[] = [
        {
          w: F.gStockUnit * F.gStock,
          ink: USDG,
          text: '= ' + money(F.gStockUnit) + ' of a mine payment — station 01, on the board\u2019s own dollar axis',
        },
        { w: 0.02 * l.gFlow, ink: USDG, text: '= 0.02 USDG/s — the stream and its lanes' },
        { w: 2e6 * l.gGbx, ink: GBX_BODY, text: '= 2M GBX — supply, minted and burned', neutral: true },
      ];
      /* THE THIRD WEIGHT. Most of a tall plate is at rest at any instant, so
         at-rest is the weight a reader sees most. It is published here rather
         than left to be inferred: a drawn channel with nothing in it. */
      const cols = l.narrow ? 1 : 3;
      const stepW = (l.w - l.pad * 2) / cols;
      bars.forEach((bar, i) => {
        const x = l.pad + (i % cols) * stepW;
        const yy = y + 22 + Math.floor(i / cols) * (l.narrow ? 24 : 0);
        const bw = Math.max(2, bar.w);
        ctx.fillStyle = bar.ink;
        ctx.fillRect(x, yy - 5, bw, 10);
        if (bar.neutral === true) {
          ctx.strokeStyle = GBX_SHADE;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(x, hairline(yy + 5, l.dpr));
          ctx.lineTo(x + bw, hairline(yy + 5, l.dpr));
          ctx.stroke();
        }
        ctx.font = mono(9.5, 500);
        ctx.fillStyle = ink.muted;
        ctx.textAlign = 'left';
        const tx = x + bw + 9;
        const room = x + stepW - 10 - tx;
        let text = bar.text;
        if (ctx.measureText(text).width > room) text = text.split(' — ')[0] ?? text;
        ctx.fillText(text, tx, yy + 4);
      });
      const ry = y + 22 + (l.narrow ? 3 * 24 : 20);
      const n = prose('fadeNote', l.pad, ry + 4, l.w - l.pad * 2, 9, ink.faint, 'left', 6);
      prose('keyPointer', l.pad, ry + 4 + n * 11 + 4, l.w - l.pad * 2, 9, ink.muted, 'left', 6);
      rule(l, b.y1 - 10, l.pad, l.w - l.pad, ink.rule);
    }

    /* ---------------------------------------------------------------- key */
    function paintKey(l: Layout): void {
      const b = l.key;
      rule(l, b.y0, l.pad, l.w - l.pad, ink.ruleStrong);
      const nw = caps('07', l.pad, b.y0 + 17, 11, ink.hi);
      const tw = caps('THE KEY', l.pad + nw + 14, b.y0 + 17, 11, ink.hi);
      ctx.font = mono(l.narrow ? 9 : 10, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      const note = PROSE_ON_CANVAS ? proseOf('keyNote') : '';
      const nx = l.pad + nw + tw + 28;
      if (note !== '' && ctx.measureText(note).width + nx <= l.w - l.pad) ctx.fillText(note, nx, b.y0 + 17);
      if (legendCtx !== null) ctx.drawImage(legendTile, l.pad, b.y0 + (l.narrow ? 40 : 34), l.w - l.pad * 2, l.legendH);
    }

    /* --------------------------------------------------------------- mine */
    function paintMine(l: Layout): void {
      const b = l.mine;
      stationHead(l, b, '01', 'THE MINE', 'mineNote');

      /* THE LEADER, drawn FIRST so the opaque cells cover it. A wire that runs
         behind the board shows only in the gaps, which is what a leader is;
         a process band crossing fifteen other slots would be a false claim
         about where the money is. */
      if (packet !== null) {
        const cell = cellBox(l, packet.slot);
        setStroke(ctx, SIGNAL, ink.blueLabel);
        ctx.beginPath();
        ctx.moveTo(cell.x + l.cw / 2, cell.y + l.ch);
        ctx.lineTo(cell.x + l.cw / 2, l.gridBot - 4);
        ctx.lineTo(F.fork !== null ? F.fork.cT : cell.x + l.cw / 2, l.gridBot);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* --- the board -------------------------------------------------- */
      for (let i = 0; i < SLOTS; i++) {
        const slot = mn.slots[i];
        if (!slot) continue;
        const { x, y } = cellBox(l, i);
        const w = l.cw;
        const h = l.ch;
        const lit = mn.flash[i] ?? 0;
        const open = slot.owner === null;
        const you = slot.owner === 'you';
        const price = priceOf(mn, slot);

        ctx.fillStyle = ink.raised;
        ctx.fillRect(x, y, w, h);
        if (lit > 0) {
          ctx.save();
          ctx.globalAlpha = 0.1 * lit;
          ctx.fillStyle = USDG;
          ctx.fillRect(x, y, w, h);
          ctx.restore();
        }
        ctx.strokeStyle = you ? ink.hi : open ? USDG : lit > 0.2 ? ink.ruleStrong : ink.rule;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(hairline(x, l.dpr), hairline(y, l.dpr), w - 1, h - 1);

        const ip = l.narrow ? 4 : 6;
        const idSize = l.narrow ? 8 : 9;
        label(pad2(i + 1), x + ip, y + 13, idSize, ink.faint);
        ctx.font = mono(idSize, 500);
        let who = open ? 'open' : you ? 'YOU' : '@' + slot.owner;
        while (ctx.measureText(who).width > w - ip * 2 - 20 && who.length > 3) who = who.slice(0, -1);
        label(who, x + w - ip, y + 13, idSize, open ? USDG : you ? ink.hi : ink.muted, 'right');
        label('$' + price.toFixed(2), x + ip, y + 30, l.narrow ? 12 : 14, ink.text);

        /* the price ramp: a straight descent across the slot's own hour, on
           the board's shared dollar axis, so sixteen cells are comparable */
        const rx0 = x + ip;
        const rx1 = x + w - ip;
        const ry1 = y + h - 21;
        const ry0 = y + 36;
        const top = Math.max(1e-6, mn.scaleTop);
        const yOf = (v: number) => ry1 - Math.max(0, Math.min(1, v / top)) * (ry1 - ry0);
        const el = Math.max(0, Math.min(1, (mn.t - slot.startedAt) / DECAY));
        const px = rx0 + (rx1 - rx0) * el;
        /* the hour still to come, first, so the spent hour draws over it */
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = ink.rule;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, yOf(price));
        ctx.lineTo(rx1, ry1);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = open ? USDG : lit > 0.15 ? ink.hi : ink.muted;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx0, yOf(slot.initialPrice));
        ctx.lineTo(px, yOf(price));
        ctx.stroke();
        ctx.fillStyle = open ? USDG : you ? ink.hi : ink.text;
        ctx.beginPath();
        ctx.arc(px, yOf(price), 2.4, 0, Math.PI * 2);
        ctx.fill();

        /* THE CLOCK. A slot meter reads as a clock: empty at restart, full at
           the hour. It is not a shrinking bar — the owner's standing rule. */
        const cy = y + h - 13;
        ctx.fillStyle = ink.rule;
        ctx.fillRect(rx0, cy, rx1 - rx0, 3);
        ctx.fillStyle = open ? USDG : ink.muted;
        ctx.fillRect(rx0, cy, (rx1 - rx0) * el, 3);
        /* the clock's reading is knocked out of the CELL, not the panel — the
           price ramp lands on this row and used to strike straight through it */
        labelK(
          open ? (l.narrow ? 'never taken' : 'never taken · 0/h') : fmtGbx(slot.mined) + ' GBX',
          x + w - ip,
          y + h - 18,
          l.narrow ? 8 : 9,
          open ? ink.faint : ink.text,
          'right',
          500,
          ink.raised,
        );
      }

      /* --- the GBX column: USDG buys the SLOT; the slot mints on a clock --
         Four bands, one per row of clocks, leaving the board's own edge and
         stacking into a trunk whose width is the total pending. The trunk runs
         into a sink, because at replacement the emission leaves this board —
         and the sink says where it goes. */
      if (!l.narrow) {
        F.gbxNeutral.forEach((n) => neutralFlow(n.band));
        const nx = l.gbxSinkX;
        const ny = l.gbxSinkY;
        const totW = widthOf(l.gMined, F.gbxTotal);
        /* the mine's emission is on its own published gauge, the way a bay's
           stock is: a scale bar beside the band it measures */
        ctx.fillStyle = GBX_BODY;
        ctx.fillRect(l.gbxX, l.gridTop - 12, 20000 * l.gMined, 7);
        labelK('= 20k GBX pending', l.gbxX + 20000 * l.gMined + 7, l.gridTop - 6, 9, ink.faint);
        /* the terminal: it leaves the board at replacement */
        /* the arrow reads dark inside the white band; the wall and its hatches
           read grey on the panel below it */
        sink(ctx, nx, ny + 30, { ink: ink.muted, size: 17, fill: ink.bg, barH: totW + 10, angle: Math.PI / 2 });
        const tx = l.gbxX + 88;
        const wrapW = l.gbxCol - 92;
        /* the reading, ticked to the trunk it measures */
        ctx.strokeStyle = ink.ruleStrong;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(nx + totW / 2, hairline(ny + 6, l.dpr));
        ctx.lineTo(tx - 6, hairline(ny + 6, l.dpr));
        ctx.stroke();
        labelK('PENDING  ' + fmtGbx(F.gbxTotal) + ' GBX', tx, ny + 10, 9.5, ink.text);
        let ly = ny + 26;
        ly += prose('gbxBands', tx, ly, wrapW, 9, ink.faint, 'left', 5) * 11 + 6;
        ly += prose('buysTheSlot', tx, ly, wrapW, 9, ink.muted, 'left', 6) * 11 + 6;
        ly += prose('mintedAtReplacement', tx, ly, wrapW, 9, ink.muted, 'left', 6) * 11 + 8;
        labelK('minted so far', tx, ly, 9, ink.faint);
        labelK(fmtGbx(mn.totalMined) + ' GBX', tx, ly + 14, 11, ink.text);
      }

      /* --- THE FORK ------------------------------------------------------
         Every leg is stroked at `q x gauge` along an orthogonal centreline, so
         the width a reader measures with a ruler held square to the pipe IS
         the quantity, at every point of the run and at every corner. */
      /* A resting route is drawn ONLY while its station is at zero. A hairline
         running alongside a live band reads as a ghost edge on the band, which
         is a mark carrying no quantity sitting on a mark that does. */
      if (packet === null) {
        ctx.save();
        ctx.strokeStyle = ink.rule;
        ctx.lineWidth = PROCESS_REST.width;
        ctx.setLineDash([]);
        F.restPipes.forEach((pp) => ctx.stroke(pp));
        ctx.restore();
      }

      const fk = F.fork;
      if (packet !== null && fk !== null) {
        const head = l.gridBot + (l.landY - l.gridBot) * ease(F.packetP);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, l.gridBot - 1, l.w, Math.max(2, head - l.gridBot + 1));
        ctx.clip();
        ctx.strokeStyle = USDG;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(1, fk.wT);
        ctx.stroke(fk.trunk);
        if (fk.claim !== null) {
          ctx.lineWidth = Math.max(1, fk.claim.w);
          ctx.stroke(fk.claim.path);
        }
        ctx.lineWidth = Math.max(1, fk.rt.w);
        ctx.stroke(fk.rt.path);
        ctx.restore();
      }

      /* the splitter sits on the pipe it splits — under the slot that paid */
      splitter(ctx, fk !== null ? fk.cT : l.gridX + l.gridW / 2, l.splitY, {
        ink: ink.muted,
        size: 17,
        fill: ink.raised,
      });

      /* the dead end: a pull claim is not a payment pushed to anyone, and it
         terminates INSIDE this station — it never crosses into the Router's.
         The sink's bar spans the band, so a wide claim visibly runs into a
         wall instead of tapering into a symbol. */
      {
        const claim = fk?.claim ?? null;
        const cS = claim !== null ? claim.c : l.gridX + l.gridW / 2 - 22;
        const barW = claim !== null ? claim.w + 12 : 26;
        sink(ctx, cS, l.claimY, { ink: ink.muted, size: 17, fill: ink.muted, barH: barW, angle: Math.PI / 2 });
        /* THE READINGS GET A ROW THE BANDS ARE HELD CLEAR OF.
           On a wide plate they sit above the sink, in the corridor beside the
           leg — the remainder's header run crosses immediately below. At 390
           that corridor is too narrow to set type in, so they go below the
           sink instead, full width, in rows the header band is reserved out
           of. Either way no band is ever under a caption. */
        if (l.narrow) {
          const lx = l.pad;
          const lw = l.w - l.pad * 2;
          labelK('PULL CLAIM · 80%' + (claim !== null ? '  ' + money(claim.q) : ''), lx, l.claimY + 16, 9, ink.hi);
          const nl = prose('claimNote', lx, l.claimY + 29, lw, 9, ink.muted, 'left', 2);
          labelK('credited so far  ' + money(mn.paidToMiners), lx, l.claimY + 29 + nl * 11, 9, ink.text);
        } else {
          const room = l.w - l.pad - (cS + barW / 2 + 14);
          const left = room < 250;
          const lx = left ? cS - barW / 2 - 14 : cS + barW / 2 + 14;
          const al: CanvasTextAlign = left ? 'right' : 'left';
          const lw = Math.max(90, left ? lx - l.pad : l.w - l.pad - lx);
          ctx.font = mono(9, 400);
          const nl = PROSE_ON_CANVAS ? wrap(ctx, proseOf('claimNote'), lw).slice(0, 2).length : 0;
          const bot = l.claimY - 11;
          labelK('credited so far  ' + money(mn.paidToMiners), lx, bot, 9, ink.text, al);
          prose('claimNote', lx, bot - nl * 11, lw, 9, ink.muted, al, 2);
          labelK(
            'PULL CLAIM · 80%' + (claim !== null ? '  ' + money(claim.q) : ''),
            lx,
            bot - (nl + 1) * 11 - 3,
            10,
            ink.hi,
            al,
          );
        }
      }

      if (packet !== null && fk !== null) {
        const p = packet;
        const alpha = 1 - ramp(p.age, PACKET_RUN + PACKET_HOLD - 0.3, PACKET_RUN + PACKET_HOLD);
        ctx.save();
        ctx.globalAlpha = alpha;
        /* the take caption sits in its own reserved row under the board */
        const side = fk.cT > l.cx ? -1 : 1;
        const lx = l.narrow ? l.pad : fk.cT + side * (fk.wT / 2 + 10);
        const al: CanvasTextAlign = l.narrow ? 'left' : side > 0 ? 'left' : 'right';
        labelK(
          (p.buyer === 'you' ? 'YOU take' : '@' + p.buyer + ' takes') + ' slot ' + pad2(p.slot + 1) + ' for ' + money(p.paid),
          lx,
          l.gridBot + 15,
          l.narrow ? 9 : 10,
          ink.hi,
          al,
        );
        labelK(
          'it restarts at ' + money(p.restart) + ' — ' + leapNote(p.paid, p.restart),
          lx,
          l.gridBot + 29,
          9.5,
          ink.muted,
          al,
        );
        /* the remainder is labelled ON its own header run, where it crosses */
        const hx = Math.min(fk.rt.c, l.cx) + Math.abs(l.cx - fk.rt.c) / 2;
        labelK(
          p.toMiner > 0
            ? '20% · ' + money(p.toRouter) + ' → the Router'
            : 'NO ONE DISPLACED — 100% deposited · ' + money(p.toRouter),
          hx,
          l.headerY - fk.rt.w / 2 - 6,
          l.narrow ? 8.5 : 9.5,
          USDG,
          'center',
        );
        ctx.restore();
      } else if (l.narrow) {
        prose('idleFork', l.pad, l.gridBot + 15, l.w - l.pad * 2, 9, ink.faint, 'left', 3);
      } else {
        const px = l.gridX + l.gridW / 2 + 30;
        prose('idleFork', px, l.splitY - 6, l.w - l.pad - px, 9, ink.faint, 'left', 3);
      }

      /* the tallies, on the mechanism they come from */
      rule(l, l.tallyY - 24, l.pad, l.w - l.pad, ink.rule);
      const cells: [string, string][] = [
        ['USDG deposited in the Router', money(mn.routerDeposits)],
        ['claims credited to displaced miners', money(mn.paidToMiners)],
        ['GBX minted so far', fmtGbx(mn.totalMined)],
        ['slots never taken · they deposit 100%', String(mn.slots.filter((s) => s.owner === null).length)],
      ];
      const nCol = l.narrow ? 2 : 4;
      const cwid = (l.w - l.pad * 2) / nCol;
      cells.forEach(([k, v], i) => {
        const x = l.pad + (i % nCol) * cwid;
        const y = l.tallyY + (l.narrow ? Math.floor(i / nCol) * 44 : 0);
        ctx.font = mono(l.narrow ? 8 : 9, 400);
        ctx.fillStyle = ink.muted;
        ctx.textAlign = 'left';
        const lines = wrap(ctx, k, cwid - 10).slice(0, 2);
        lines.forEach((t, j) => ctx.fillText(t, x, y - 22 + j * 10));
        label(v, x, y + 2, l.narrow ? 10.5 : 12, ink.text);
      });
    }

    /* ------------------------------------------------------------- router */
    function paintRouter(l: Layout): void {
      const b = l.router;
      stationHead(l, b, '02', 'RESONANCE ROUTER', 'routerNote', {
        c: l.cx,
        half: packet !== null && F.fork !== null ? F.fork.rt.w / 2 : 0,
      });

      const vw = l.routerVw;
      const vh = l.routerVh;
      const valveY = l.routerValveY;
      const vx = l.cx - vw / 2;
      const vy = l.routerVy;
      vessel(ctx, vx, vy, {
        ink: ink.muted,
        w: vw,
        h: vh,
        level: Math.max(0, Math.min(1, router.held / Math.max(1e-6, router.capShown))),
        levelFill: USDG,
        ground: ink.raised,
      });
      ctx.strokeStyle = ink.ruleStrong;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(vx - 6, hairline(vy, l.dpr));
      ctx.lineTo(vx, hairline(vy, l.dpr));
      ctx.stroke();
      labelK(money(router.capShown), vx - 9, vy + 4, 9, ink.muted, 'right');
      labelK('$0', vx - 9, vy + vh + 2, 9, ink.muted, 'right');
      labelK('HELD  ' + money(router.held), l.cx, vy - 8, 10.5, ink.hi, 'center');

      /* the inlet drip: every ambient deposit the board makes arrives here, so
         the level never rises without something visibly arriving */
      if (drip > 0) {
        const dy = vy - 16 + (1 - drip) * 14;
        ctx.fillStyle = USDG;
        ctx.beginPath();
        ctx.arc(l.cx, dy, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      /* the outlet. Solid = open, hollow = shut, and it is shut nearly always. */
      const open = router.open > 0 ? Math.min(1, router.open / 0.35) : 0;
      ctx.strokeStyle = ink.ruleStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.cx, vy + vh);
      ctx.lineTo(l.cx, valveY - 11);
      ctx.stroke();
      valve(ctx, l.cx, valveY, { ink: ink.panel, size: 21, weight: 4 });
      valve(ctx, l.cx, valveY, { ink: ink.muted, size: 21 });
      if (open > 0) {
        ctx.save();
        ctx.globalAlpha = open;
        valve(ctx, l.cx, valveY, { ink: ink.muted, size: 21, open: true, fill: USDG });
        ctx.restore();
      }
      const rx = l.cx + 22;
      labelK('route()', rx, valveY - 3, 10, open > 0 ? ink.hi : ink.muted);
      if (open > 0) prose('routeCalled', rx, valveY + 10, l.w - l.pad - rx, 9, ink.muted, 'left', 3, money(router.lastRouted) + ' forwarded');
      else prose('routeWaiting', rx, valveY + 10, l.w - l.pad - rx, 9, ink.muted, 'left', 3, router.sinceRoute.toFixed(1) + 's');

      /* the left gutter earns its space: the balance the vessel has to satisfy */
      ctx.font = mono(9, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      const bx = l.narrow ? l.pad : l.cx + vw / 2 + 16;
      const by = l.narrow ? valveY + 50 : vy + 14;
      const bw2 = l.narrow ? l.w - l.pad * 2 : l.w - l.pad - bx;
      labelK('deposited by the mine   ' + money(mn.routerDeposits), bx, by, 9, ink.muted, 'left', 400);
      labelK('forwarded by route()   ' + money(router.outTotal), bx, by + 14, 9, ink.muted, 'left', 400);
      labelK('still held   ' + money(router.held), bx, by + 28, 9, ink.muted, 'left', 400);
      prose('heldForEver', bx, by + 46, bw2, 9, ink.muted, 'left', 3);
    }

    /* -------------------------------------------------------------- break */
    function paintBreak(l: Layout): void {
      const b = l.brk;
      const y = b.y0 + (l.narrow ? 26 : 22);

      /* the torn end of the pipe above */
      ctx.strokeStyle = ink.ruleStrong;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(l.cx, b.y0 - 14);
      ctx.lineTo(l.cx, y - 16);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const yy = y - 16 + i * 3;
        ctx.moveTo(l.cx - 11 + (i % 2) * 6, yy);
        ctx.lineTo(l.cx + 11 - (i % 2) * 6, yy + 1.5);
      }
      ctx.stroke();

      /* the break rule: two dashed runs with the caption between them */
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = ink.pink;
      ctx.lineWidth = 1;
      ctx.font = mono(10.5, 600);
      const capTxt = l.narrow ? 'THE CHAIN BREAKS HERE' : 'THE CHAIN IS BROKEN HERE — AND THAT IS THE POINT';
      const tw = ctx.measureText(capTxt).width + 22;
      ctx.beginPath();
      ctx.moveTo(l.pad, hairline(y, l.dpr));
      ctx.lineTo(l.cx - tw / 2, hairline(y, l.dpr));
      ctx.moveTo(l.cx + tw / 2, hairline(y, l.dpr));
      ctx.lineTo(l.w - l.pad, hairline(y, l.dpr));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink.pinkLabel;
      ctx.textAlign = 'center';
      ctx.fillText(capTxt, l.cx, y + 4);

      ctx.font = mono(9.5, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'center';
      const lines = PROSE_ON_CANVAS ? (l.narrow ? PLATE_PROSE.breakNarrow : PLATE_PROSE.breakWide) : [];
      lines.forEach((t, i) => ctx.fillText(t, l.cx, y + 20 + i * 13));
    }

    /* ------------------------------------------------------------- stream */
    function paintStream(l: Layout): void {
      const b = l.stream;
      stationHead(l, b, '03', 'THE SEVEN-DAY STREAM', 'streamNote');

      const rate = rz.flow.t < rz.flow.finish ? rz.flow.rate : 0;
      const left = Math.max(0, rz.flow.rate * (rz.flow.finish - rz.flow.t));

      /* the tank, on the left, so the gutter beside the trunk is not dead */
      const tw = l.narrow ? 46 : 62;
      const th = 48;
      const tx = l.pad;
      const ty = l.trunkY0 - 14;
      vessel(ctx, tx, ty, {
        ink: ink.muted,
        w: tw,
        h: th,
        level: Math.max(0, Math.min(1, left / WEEKLY)),
        levelFill: USDG,
        ground: ink.raised,
      });
      if (l.narrow) {
        /* the tank's own readings, kept inside the gutter the trunk leaves */
        labelK('RESONANCE', tx, ty + th + 12, 8.5, ink.hi);
        labelK(money(left) + ' left', tx, ty + th + 23, 8.5, ink.muted);
        labelK(rate.toFixed(4) + ' USDG/s', tx, ty + th + 34, 8.5, ink.muted);
        labelK('FI · mUSDG/s', tx, ty + th + 45, 8.5, ink.faint);
      } else {
        labelK('RESONANCE', tx + tw + 10, ty + 13, 10, ink.hi);
        labelK(money(left) + ' left of this week', tx + tw + 10, ty + 26, 9.5, ink.muted);
        labelK('releasing ' + rate.toFixed(4) + ' USDG/s', tx + tw + 10, ty + 39, 9.5, ink.muted);
      }

      /* a resting channel is drawn only while it is resting — never beside the
         band that fills it, where it would read as a ghost edge */
      if (rate <= 0) F.pipes.slice(0, 4).forEach((pp) => strokeFlow(pp, ink.rule, PROCESS_REST.width));
      F.streamBands.forEach((band) => fillFlow(band.path, band.ink));

      /* the control node: signal is a thin dashed line and carries no width */
      const nodeY = l.trunkY0 - 12;
      const nx = l.w - l.pad - 11;
      const total = totalStake(rz);
      node(ctx, nx, nodeY, { ink: ink.pink, size: 15, fill: ink.raised });
      labelK(
        'SIGNAL · ' + Math.round(total).toLocaleString('en-US') + ' GBX pointed',
        nx - 4,
        nodeY - 14,
        l.narrow ? 8.5 : 10,
        ink.pinkLabel,
        'right',
      );
      setStroke(ctx, SIGNAL, ink.pink);
      ctx.beginPath();
      ctx.moveTo(nx - 8, nodeY);
      ctx.lineTo(l.cx + 13, nodeY);
      ctx.lineTo(l.cx + 13, l.trunkY1);
      ctx.stroke();
      /* THE SIGNAL SETS THE SPLIT, so it is wired to every lane it sets and
         carries the reading it is setting. A control line with no reading is
         the one mechanism on a plate that cannot be checked. */
      const branchY = l.fiY - (l.narrow ? 18 : 26);
      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        ctx.beginPath();
        ctx.moveTo(l.cx + 13, l.trunkY1 + 6);
        ctx.lineTo(bay.cx, branchY);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        ctx.fillStyle = ink.pink;
        ctx.beginPath();
        ctx.arc(bay.cx, branchY, 2.6, 0, Math.PI * 2);
        ctx.fill();
        labelK(
          ((a.stake / total) * 100).toFixed(1) + (l.narrow ? '%' : '% set here'),
          bay.cx,
          branchY - 7,
          l.narrow ? 8 : 9,
          ink.pinkLabel,
          'center',
        );
      });
      splitter(ctx, l.cx, l.trunkY1, { ink: ink.muted, size: 17, fill: ink.raised });

      /* every lane labelled at BOTH ends and in a permanent order, so a band
         can be traced from split to bay without using hue at all */
      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        const share = a.stake / total;
        if (!l.narrow) {
          const side = i < 2 ? -1 : 1;
          tag(ctx, bay.cx + side * (l.bayW * 0.5 + 22), l.fiY, {
            ink: ink.muted,
            r: 15,
            tag: 'FI' + (i + 1),
            value: (rate * share * 1000).toFixed(1),
            from: { x: bay.cx, y: l.fiY },
            tagFont: mono(l.narrow ? 7 : 8, 500),
            valueFont: mono(l.narrow ? 7.5 : 8.5, 600),
            tagInk: ink.muted,
            valueInk: ink.hi,
            ground: ink.panel,
          });
        }
        /* labelled at BOTH ends and in a permanent order: here where the lane
           arrives, and again on the bucket it fills. Position is the second
           channel, so a band can be traced from split to bay without using
           hue at all — which is what a reader with a colour deficiency has. */
        const sub = l.narrow ? (share * 100).toFixed(1) + '%' : (share * 100).toFixed(1) + '% of the stream';
        ctx.font = mono(l.narrow ? 8 : 9, 500);
        const plateW = Math.min(l.w / 4 - 6, Math.max(ctx.measureText(sub).width, 36) + 12);
        erase(bay.cx - plateW / 2, l.laneLabelY - 13, plateW, 30);
        ctx.strokeStyle = ink.rule;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(hairline(bay.cx - plateW / 2, l.dpr), hairline(l.laneLabelY - 13, l.dpr), plateW, 30);
        label(a.sym, bay.cx, l.laneLabelY, l.narrow ? 9 : 10.5, ink.hi, 'center');
        label(sub, bay.cx, l.laneLabelY + 12, l.narrow ? 8 : 9, ink.muted, 'center');
      });
      if (!l.narrow) proseLine('fiUnits', l.pad, l.trunkY1 + 22, 9, ink.faint);
    }

    /* ----------------------------------------------------------- auctions */
    function paintAuctions(l: Layout): void {
      /* the rule steps around the four lanes; the tag sits in the middle
         gutter, where no band ever runs */
      const total0 = totalStake(rz);
      const rateNow = rz.flow.t < rz.flow.finish ? rz.flow.rate : 0;
      const laneHalf = (i: number) => (widthOf(l.gFlow, rateNow * ((rz.assets[i]?.stake ?? 0) / total0)) / 2 || 0) + 9;
      steppedHead(l, l.aucTop - 20, '04', l.narrow ? 'AUCTIONS' : 'FOUR AUCTIONS · EACH ON ITS OWN CLOCK', laneHalf, 0);

      const potCap = l.potCap;

      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        const w = l.bayW;
        const x = bay.cx - w / 2;
        vessel(ctx, x, l.aucTop, {
          ink: a.flash > 0.2 ? ink.hi : ink.muted,
          w,
          h: l.aucH,
          level: Math.max(0, Math.min(1, a.dispPot / potCap)),
          levelFill: USDG,
          ground: ink.raised,
        });
      });

      /* the exchange, drawn as an exchange: the pipes at rest first, then the
         live bands over them, then the trader each pair passes through */
      F.pipes.slice(9, 13).forEach((pp, i) => {
        const f = flush[i];
        if (!f || f.age >= 1 || f.lot <= 0) strokeFlow(pp, ink.rule, PROCESS_REST.width);
      });
      F.aucBands.forEach((band) => fillFlow(band.path, band.ink));
      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        const f = flush[i];
        if (!bay || !f) return;
        const side = i < 2 ? 1 : -1;
        const traderC = bay.cx + side * (l.bayW * 0.5 + (l.narrow ? 26 : 46));
        const live = f.age < 1 && f.lot > 0;
        node(ctx, traderC, l.yOut, { ink: live ? ink.hi : ink.ruleStrong, size: 15, fill: ink.raised });
        if (live && !l.narrow) {
          labelK('A TRADER', traderC + side * 13, l.yOut - 12, 9, ink.muted, side > 0 ? 'left' : 'right');
          proseLine('traderHands', traderC + side * 13, l.yOut + 22, 8.5, ink.faint, side > 0 ? 'left' : 'right', 500, a.sym);
        }
      });

      /* --- the tenth. Drawn and labelled, and deliberately not followed --- */
      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        /* the tap is pulled inside the frame if the lane would push it out —
           at 390 lane 1's reading rendered as `%` with the `10` cut off */
        const x = Math.max(l.pad + 30, bay.cx - l.bayW * 0.74);
        sink(ctx, x, l.aucTapY, { ink: hueOf(i), size: 13, fill: hueOf(i), barH: 13 });
        labelK('10%', x - 10, l.aucTapY + 4, 8.5, ink.muted, 'right');
      });

      /* --- THE FALLING ASK, drawn ON the bucket it belongs to. It is a
             BLADE on a rail — a descending set-point — not a level, so it can
             never be misread as stock. Only lane 2 has a modelled ask
             (docs/MODELS.md §4 is one live QQQ acquisition); the other three
             run the same mechanism on their own clocks and the caption says
             so rather than the plate inventing three asks it cannot back. */
      const qbay = l.bays[1];
      if (qbay) {
        const w = l.bayW;
        const x = qbay.cx - w / 2;
        const trading = au.phase === 'trade';
        const asking = trading ? au.lastPaid : au.ask;
        const worth = trading ? au.lastLot / 486 : fair(au);
        const scale = Math.max(au.initialAsk, worth, 0.001) * 1.06;
        const by = (v: number) => l.aucTop + l.aucH - Math.max(0, Math.min(1, v / scale)) * l.aucH;
        const ay = by(asking);
        const wy = by(worth);
        /* the rail the blade runs down */
        ctx.strokeStyle = ink.rule;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(hairline(x + w + 9, l.dpr), l.aucTop);
        ctx.lineTo(hairline(x + w + 9, l.dpr), l.aucTop + l.aucH);
        ctx.stroke();
        ctx.setLineDash([]);
        /* what the lot is worth — the thing the blade is descending toward */
        ctx.strokeStyle = ink.blueLabel;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x - 4, hairline(wy, l.dpr));
        ctx.lineTo(x + w + 16, hairline(wy, l.dpr));
        ctx.stroke();
        ctx.setLineDash([]);
        /* the blade */
        ctx.fillStyle = hueOf(1);
        ctx.fillRect(x - 4, ay - 1.5, w + 8, 3);
        ctx.beginPath();
        ctx.moveTo(x + w + 9, ay - 5);
        ctx.lineTo(x + w + 15, ay);
        ctx.lineTo(x + w + 9, ay + 5);
        ctx.closePath();
        ctx.fill();
        /* THE ASK FALLS ONTO THE WORTH, so at the end of every cycle the two
           readings are a few pixels apart and printed blind they strike
           through each other. Within one line-height they are printed as ONE
           reading, which is also the truer statement: the ask has met it. */
        const met = !trading && Math.abs(ay - wy) < 13;
        /* at 390 there is no side column wide enough for a callout, so the
           readings are set compact in the gutter LEFT of the bucket and the
           sentence that explains them moves to the station's caption row */
        const rx2 = l.narrow ? x - 6 : x + w + 22;
        const ral: CanvasTextAlign = l.narrow ? 'right' : 'left';
        const rsz = l.narrow ? 8 : 8.5;
        labelK(
          trading
            ? (l.narrow ? 'settled ' : 'settled at ') + asking.toFixed(2) + (l.narrow ? '' : ' QQQ')
            : met
              ? l.narrow
                ? 'ask=worth ' + worth.toFixed(2)
                : 'ask ' + asking.toFixed(2) + ' · worth ' + worth.toFixed(2) + ' QQQ'
              : 'ask ' + asking.toFixed(2) + (l.narrow ? '' : ' QQQ'),
          rx2,
          ay + 3,
          rsz,
          trading ? ink.hi : ink.pinkLabel,
          ral,
        );
        /* THE CALLOUT TAKES WHICHEVER SIDE OF THE BLADE IS FREE.
           The ask falls TOWARD what the lot is worth, so the two readings
           converge: printed blind, `meets what the lot is` and `worth 1.58`
           landed on one baseline in five of eight captures. The callout is
           given the gap below the blade only when the gap is big enough to
           hold it, and goes above the blade otherwise — so it always tracks
           the blade and never sits on the line it is descending toward. */
        if (!trading) {
          if (!l.narrow) {
            ctx.font = mono(8.5, 400);
            const lines = PROSE_ON_CANVAS ? wrap(ctx, proseOf('askFalls'), 108) : [];
            const need = lines.length * 11 + 8;
            const below = wy - ay > need + 14;
            const top = below ? ay + 16 : Math.max(l.aucTop + 10, ay - 8 - lines.length * 11);
            prose('askFalls', x + w + 22, top, 108, 8.5, ink.muted, 'left', 3);
          }
          if (!met) labelK('worth ' + worth.toFixed(2), rx2, wy + 3, rsz, ink.blueLabel, ral);
        }
      }

      /* ---- EVERY ROW BELOW THE BUCKETS IS ITS OWN, and each is drawn in the
         order it is read. The trade caption used to be printed eight pixels
         under a two-line note and struck through it in every capture, reduced
         motion included. */
      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        if (l.narrow) {
          labelK(a.sym + ' ' + money(a.pot), bay.cx, l.aucValY + (i % 2) * 11, 7.5, ink.text, 'center');
        } else {
          labelK(a.sym + '  ' + money(a.pot), bay.cx, l.aucValY, 10.5, ink.text, 'center');
          proseLine('potWaiting', bay.cx, l.aucValY + 12, 9, ink.faint, 'center');
        }
      });
      prose(
        l.narrow ? 'oneInDetailNarrow' : 'oneInDetail',
        l.pad,
        l.aucDetailY,
        l.w - l.pad * 2,
        9,
        ink.faint,
        'left',
        l.narrow ? 5 : 2,
      );
      /* the station's own gauge, drawn as a scale bar so it can be checked */
      erase(l.pad - 2, l.aucGaugeY - 10, 100 * l.gLot + 4, 14);
      ctx.fillStyle = USDG;
      ctx.fillRect(l.pad, l.aucGaugeY - 8, 100 * l.gLot, 8);
      labelK('= 100 USDG of lot — this station\u2019s own gauge', l.pad + 100 * l.gLot + 8, l.aucGaugeY, 9, ink.faint);
      prose(
        'signalerTap',
        l.pad,
        l.aucNoteY,
        l.w - l.pad * 2,
        9,
        ink.muted,
        'left',
        l.narrow ? 4 : 2,
        money(tapped.reduce((n, v) => n + v, 0)) + '.',
      );
      proseLine('tradeIsPrice', l.cx, l.aucTradeY, 9, ink.muted, 'center');
    }

    /* --------------------------------------------------------------- fund */
    function paintFund(l: Layout): void {
      steppedHead(l, l.fund.y0, '05', 'THE FUND', () => l.bayW / 2 + 10, 1);
      const bayH = Math.max(30, l.bayBot - l.bayTop);

      /* EVERY BAY BODY FIRST, THEN EVERY ANNOTATION. Painting a bay's own
         reading and then the NEXT bay's rectangle over it is how `gauge · this
         bay full = 1200 NVDA` came out as `gauge · full = 120` at 390 — cut by
         a mark drawn after it, not by its container. One pass for the
         mechanism, one for the type, in that order, always. */
      rd.holds.forEach((hh, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        const w = l.bayW;
        const x = bay.cx - w / 2;
        const hue = hueOf(i);
        const stock = F.stock[i] ?? 0;
        ctx.fillStyle = ink.bg;
        ctx.fillRect(x, l.bayTop, w, bayH);
        ctx.fillStyle = hue;
        ctx.fillRect(x + 1, l.bayTop + bayH - stock, w - 2, Math.max(0, stock));
        /* the slice, marked on the bay it is leaving */
        const slice = F.slice[i] ?? 0;
        if (slice > 0.5) {
          ctx.strokeStyle = GBX_BODY;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(x, hairline(l.bayTop + bayH - stock + slice, l.dpr));
          ctx.lineTo(x + w, hairline(l.bayTop + bayH - stock + slice, l.dpr));
          ctx.stroke();
        }
        ctx.strokeStyle = hue;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(hairline(x, l.dpr), hairline(l.bayTop, l.dpr), w - 1, bayH - 1);
        /* the tick that ties the reading below to the vessel holding it */
        ctx.strokeStyle = ink.ruleStrong;
        ctx.beginPath();
        ctx.moveTo(bay.cx, hairline(l.bayTop + bayH, l.dpr));
        ctx.lineTo(bay.cx, hairline(l.bayTop + bayH + 5, l.dpr));
        ctx.stroke();
        if (i === 0) {
          /* the bay's own full mark, drawn ACROSS THE BAY IT GAUGES and no
             further: it used to run from the left margin, where its caption
             sat under the next bay's rectangle and came out as
             `gauge · full = 120`. The reading now sits under the vessel with
             the stock it qualifies. */
          const byy = l.bayTop + bayH * (1 - 1 / 1.22);
          ctx.strokeStyle = ink.ruleStrong;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(x - 5, hairline(byy, l.dpr));
          ctx.lineTo(x + w + 5, hairline(byy, l.dpr));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

    }

    /* THE FUND'S READINGS ARE PAINTED AFTER STATION 06'S BANDS.
       The four claim ribbons leave the bays' feet and run down through exactly
       the rows the bays' own readings sit in, so those readings are the last
       layer on the plate, not the first. */
    function paintFundNotes(l: Layout): void {
      rd.holds.forEach((hh, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        /* the STOCK reading the key publishes: name and number on ONE line,
           ticked to the vessel that holds it — never a bare numeral under a
           bare word */
        labelK(hh.sym, bay.cx, l.bayTop - 7, 10.5, ink.hi, 'center');
        labelK(
          hh.sym + '  ' + hh.amt.toFixed(hh.amt < 10 ? 4 : 1),
          bay.cx,
          l.bayBot + 16,
          l.narrow ? 8.5 : 10,
          ink.text,
          'center',
        );
        if (i === 0)
          labelK(
            l.narrow ? 'of ' + hh.base + ' full' : 'of ' + hh.base + ' · the dashed line, this bay full',
            bay.cx,
            l.bayBot + 28,
            l.narrow ? 7.5 : 9,
            ink.faint,
            'center',
          );
      });
      prose('bayGauges', l.pad, l.bayNoteY, l.w - l.pad * 2 - 4, 9, ink.faint, 'left', l.narrow ? 4 : 2);
    }

    /* ---------------------------------------------------------------- you */
    function paintYou(l: Layout): void {
      const b = l.you;
      /* THE BANDS FIRST, THE TYPE LAST — for the whole station. The four claim
         ribbons cross this band from the bays above it down to the collector,
         so anything drawn after them is type, and anything drawn before them
         is mechanism. The station's own head is type too, and goes on after. */
      if (rd.phase !== 'burn') F.pipes.slice(4, 9).forEach((pp) => strokeFlow(pp, ink.rule, PROCESS_REST.width));
      F.claimBands.forEach((band) => fillFlow(band.path, band.ink));
      node(ctx, l.collectC, l.collectY, { ink: ink.muted, size: 18, fill: ink.raised });
      stationHead(l, b, '06', 'YOUR SHARE', 'youNote');

      /* ---- the stock, ON the published gauge -----------------------------
         The bar is `SUPPLY0 x gGbx` long and its fill is `supply x gGbx`, so a
         reader can hold the head's "= 2M GBX" scale bar against it. Both flows
         are anchored on the bar's HEAD, because that is the only place supply
         ever moves: the mint arrives there from above, the burn leaves there
         from below. One stock, one inflow, one outflow. */
      const barW = SUPPLY0 * l.gGbx;
      const fillW = rd.supply * l.gGbx;
      const markW = mint.mark * l.gGbx;
      const mintW = Math.max(0, mint.since * l.gGbx);
      const barX = l.pad;
      const headX = barX + fillW;
      ctx.fillStyle = ink.raised;
      ctx.fillRect(barX, l.supplyY, barW, 11);
      ctx.fillStyle = ink.ruleStrong;
      ctx.fillRect(barX, l.supplyY, fillW, 11);
      /* the strip the mint put back, on the bar it put it back on */
      if (mintW > 0.5) {
        ctx.fillStyle = GBX_BODY;
        ctx.fillRect(barX + markW, l.supplyY, mintW, 11);
      }
      ctx.strokeStyle = ink.rule;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(hairline(barX, l.dpr), hairline(l.supplyY, l.dpr), barW, 11);
      /* the two readings share the row ABOVE the bar, where neither the mint
         band arriving at its head nor the burn band leaving it ever runs */
      /* ---- THE MINT, drawn arriving. Its width IS the length it added ---- */
      if (mintW > 0.5) {
        const r = run('mint', l.gGbx, l.mintY, l.supplyY, barX + markW + mintW / 2, mint.since);
        neutralFlow(ribbonPath(r));
      }
      /* ---- THE BURN, leaving the same head ------------------------------- */
      if (F.burnNeutral !== null) neutralFlow(F.burnNeutral.band);
      {
        /* the mark the last burn left, ticked on the bar it left it on */
        ctx.strokeStyle = ink.ruleStrong;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(hairline(barX + markW, l.dpr), l.mintY + 8);
        ctx.lineTo(hairline(barX + markW, l.dpr), l.supplyY + 15);
        ctx.stroke();
        /* the reading goes on the left of the band, where the row is empty at
           every value the mark can take */
        const lx = barX + markW - 10;
        labelK(
          'MINT  +' +
            Math.round(mint.since).toLocaleString('en-US') +
            (l.narrow ? ' GBX' : ' GBX since the last burn'),
          lx,
          l.mintY + 4,
          9.5,
          ink.hi,
          'right',
        );
        labelK(
          (l.narrow ? 'station 01 · +' : 'the mine\u2019s clocks at station 01 · +') +
            Math.round(mint.rate).toLocaleString('en-US') +
            ' GBX/s',
          lx,
          l.mintY + 16,
          9,
          ink.muted,
          'right',
        );
      }
      labelK(Math.round(rd.supply).toLocaleString('en-US') + ' GBX in existence', barX, l.supplyY - 7, 9.5, ink.muted);
      labelK('the whole bar = 100,000,000 GBX', barX, l.supplyY + 24, 9, ink.faint);

      const burnX = headX - F.burnW / 2;
      const burnY = l.burnY1;
      valve(ctx, burnX, burnY + 12, { ink: ink.panel, size: 21, weight: 4 });
      valve(ctx, burnX, burnY + 12, { ink: ink.muted, size: 21, open: rd.phase === 'burn', fill: GBX_BODY });
      sink(ctx, burnX, burnY + 40, { ink: ink.muted, size: 19, fill: GBX_BODY, barH: Math.max(24, F.burnW + 10), angle: Math.PI / 2 });
      labelK('BURN', headX - F.burnW - 16, burnY + 16, 10, ink.hi, 'right');
      const burnNote =
        (rd.phase === 'burn' ? Math.round(rd.burned).toLocaleString('en-US') + ' ' : '') + proseOf('burnSink');
      if (l.narrow) wrapK(burnNote, l.pad, burnY + 64, l.collectC - 46 - l.pad, 9, ink.muted, 'left', 2);
      else labelK(burnNote, burnX + 18, burnY + 44, 9.5, ink.muted);

      /* THE RECEIPT, per bay. The four rows are the pro-rata argument in
         figures beside the same argument in geometry: one share, applied to
         four different holdings, in one transaction. */
      const rx = l.narrow ? l.pad : Math.max(barX + barW + 26, l.pad + 300);
      const rw = (l.narrow ? l.collectC - 44 : l.w - l.pad) - rx;
      const ry = l.narrow ? burnY + 100 : l.supplyY - 6;
      const pct = rd.pct > 0 ? rd.pct : 0.1;
      /* KNOCKED OUT PER CELL, NOT AS ONE BLOCK. A block-sized backdrop would
         take a bite out of the merged claim stack that runs down the spine
         between this table's columns; four small plates let the stack pass
         between them, which is what "the band goes behind the label" means. */
      const title = l.narrow ? 'SAME SHARE, EVERY BAY' : 'THE SAME SHARE, OUT OF EVERY BAY';
      ctx.font = mono(9.5, 600);
      erase(rx - 3, ry - 10, ctx.measureText(title).width * 1.19 + 6, 14);
      caps(title, rx, ry, 9.5, ink.hi);
      rd.holds.forEach((hh, i) => {
        const y = ry + 16 + i * 13;
        const take = (rd.phase === 'burn' ? takenAt(rd, i) : hh.amt * pct) || 0;
        labelK(hh.sym, rx, y, 9, hueOf(i));
        labelK((pct * 100).toFixed(2) + '%', rx + rw * (l.narrow ? 0.4 : 0.3), y, 9, ink.muted, 'right');
        labelK('of ' + hh.amt.toFixed(hh.amt < 10 ? 4 : 1), rx + rw * (l.narrow ? 0.72 : 0.62), y, 9, ink.muted, 'right');
        labelK('→ ' + take.toFixed(take < 10 ? 4 : 2), rx + rw, y, 9, ink.text, 'right');
      });
      /* THE CAPTION PRINTS THE LIVE SHARE. It used to assert "a 10% burn" over
         rows reading 6.25%–7.65% on six of fifteen idle samples: the figure a
         reader checks it against is right there in the column beside it. */
      /* AND IT PRINTS AT THE STATION'S OWN CONTRAST. This line disambiguates
         the table's mode and used to be the dimmest type on the plate — p90
         3.02:1 where a declared 4.5:1 measures 4.09:1 on the calibration ramp.
         It is now `--muted` at 9px, the same ink as the rows it qualifies. */
      labelK(
        rd.phase === 'burn'
          ? 'in flight now — ' + (pct * 100).toFixed(2) + '%' + proseOf(l.narrow ? 'burnLiveNarrow' : 'burnLive')
          : 'what a ' + (pct * 100).toFixed(2) + '%' + proseOf(l.narrow ? 'burnIdleNarrow' : 'burnIdle'),
        rx,
        ry + 16 + 4 * 13 + 5,
        9,
        ink.muted,
      );

      labelK('YOU', l.narrow ? l.collectC - 48 : l.collectC + 16, l.collectY + 4, 11, ink.hi, l.narrow ? 'right' : 'left');
      /* Where four bands run merged, the stack is named in the order they
         actually arrive — LEFT TO RIGHT across the collector, which is bay
         order, so the stack can be read without telling the four hues apart. */
      proseLine(
        l.narrow ? 'stackOrderNarrow' : 'stackOrder',
        l.narrow ? l.w - l.pad : l.collectC,
        l.collectY + (l.narrow ? 30 : 28),
        l.narrow ? 8 : 9,
        ink.muted,
        l.narrow ? 'right' : 'center',
      );

      const line =
        rd.phase === 'burn'
          ? rd.who +
            ' burns ' +
            Math.round(rd.burned).toLocaleString('en-US') +
            ' GBX — ' +
            (rd.pct * 100).toFixed(2) +
            '% of everything in existence, and takes ' +
            (rd.pct * 100).toFixed(2) +
            '% of every bay'
          : rd.who
            ? rd.who +
              ' received ' +
              rd.holds.map((hh, i) => takenAt(rd, i).toFixed(takenAt(rd, i) < 10 ? 4 : 2) + ' ' + hh.sym).join(' · ') +
              ' — the same ' +
              (rd.pct * 100).toFixed(2) +
              '% of every holding, in one transaction'
            : 'burns arrive on their own — every other one is yours, at 10% of everything in existence';
      /* measured first, then drawn once, so the last line lands on the
         station's last row instead of running into the checks below it */
      ctx.font = mono(9.5, 400);
      const n = wrap(ctx, line, l.w - l.pad * 2).slice(0, l.narrow ? 5 : 2).length;
      wrapK(line, l.cx, b.y1 - 6 - (n - 1) * 11, l.w - l.pad * 2, 9.5, ink.muted, 'center', n, 11);
    }

    /* -------------------------------------------------------- instruments */
    function paintInstruments(l: Layout): void {
      const b = l.instr;
      rule(l, b.y0, l.pad, l.w - l.pad, ink.ruleStrong);
      caps(l.narrow ? 'CONSERVATION, PER SEGMENT' : 'CONSERVATION, CHECKED EVERY FRAME — PER SEGMENT, NOT END TO END', l.pad, b.y0 + 17, l.narrow ? 9.5 : 10.5, ink.hi);
      prose('deltaNote', l.pad, b.y0 + 32, l.w - l.pad * 2, 9, ink.muted, 'left', l.narrow ? 4 : 3);
      const rows = F.checks;
      const y0 = b.y0 + (l.narrow ? 84 : 68);
      const rh = Math.min(l.narrow ? 30 : 20, (b.y1 - y0 - 6) / Math.max(1, rows.length));
      const c1 = l.pad + 30;
      const c2 = Math.max(l.pad + 330, (l.w - l.pad * 2) * 0.44);
      const c3 = c2 + 140;
      const c4 = l.w - l.pad;
      rows.forEach((r, i) => {
        const y = y0 + i * rh + 12;
        label(r.seg, l.pad, y, 9.5, ink.faint);
        ctx.font = mono(9.5, 400);
        ctx.fillStyle = ink.muted;
        ctx.textAlign = 'left';
        /* THE LABEL WRAPS, IT DOES NOT TRUNCATE. At 390 this column was cutting
           five rows mid-phrase — `GBX issued = pending on the`, `Router: mine
           deposits − route` — and those clauses are the honesty. */
        const room = (l.narrow ? c4 - 78 : c2 - 12) - c1;
        wrap(ctx, r.what, room)
          .slice(0, 2)
          .forEach((t, k) => ctx.fillText(t, c1, y + k * 10));
        if (!l.narrow) {
          label(r.claim.toPrecision(6), c2, y, 9.5, ink.text);
          label(r.drawn.toPrecision(6), c3, y, 9.5, ink.text);
        }
        /* THE THRESHOLD IS RELATIVE, and it has to be. `GBX issued` is a
           six-figure quantity, so its floating-point floor is ~1e-8 in
           absolute terms while every rate on this plate floors at 1e-13. An
           absolute threshold flags the big row for ever and teaches a reader
           to ignore the colour — which is worse than no colour at all. */
        const tol = 1e-11 * Math.max(1, Math.abs(r.claim));
        const bad = r.control === true ? r.err < tol : r.err > tol;
        label(r.err.toExponential(2), c4, y, 9.5, bad ? ink.pinkLabel : r.control === true ? ink.muted : ink.text, 'right');
      });
    }

    /* ═══════════════════════════════════════════════════════ registration ══ */
    let ro: ResizeObserver | null = null;
    if (hasRO) {
      ro = new ResizeObserver((entries) => {
        const e = entries[entries.length - 1];
        if (e) {
          meas.w = Math.round(e.contentRect.width);
          meas.h = Math.round(e.contentRect.height);
        }
        const w = view.w;
        const h = view.h;
        if (resize() && (view.w !== w || view.h !== h)) {
          L = buildLayout();
          renderLegend(L.w - L.pad * 2, L.legendH, L.dpr);
          build(L);
          paint();
        }
      });
      ro.observe(canvas);
    }

    function seed(): void {
      /* a reader arrives at a plate that is already running: the mine has a
         history, the stream is mid-week, the buckets are part full, and the
         Router is holding something it has actually been paid */
      warmStart(mn, mineFx);
      packet = null;
      router.held = 0;
      router.bookedIn = 0;
      router.outTotal = 0;
      router.lastRouted = 0;
      router.sinceRoute = 0;
      router.wait = ROUTE_MIN;
      router.open = 0;
      let seeded = 0;
      mn.slots.forEach((sl) => (seeded += sl.mined));
      issued = seeded + mn.totalMined;
      mint.mark = rd.supply;
      mint.since = 0;
      mint.total = 0;
      mint.burned = 0;
      mint.rate = 0;
      for (let i = 0; i < 40; i++) stepResonance(rz, 240, {});
      seedHistory(au, {});
    }
    seed();
    if (resize()) {
      L = buildLayout();
      renderLegend(L.w - L.pad * 2, L.legendH, L.dpr);
      build(L);
      paint();
    }

    const unregister = registerSim({
      name: 'plate',
      /* the PANEL, never the section: the harness's `seen` gate is what keeps
         a sim from running before a reader has actually laid eyes on it */
      el: panel,
      timeScale: 1,
      step,
      paint,
      reset: () => {
        seed();
        if (L) build(L);
        paint();
      },
      static: () => {
        /* A still that teaches: a payment caught mid-fork with both legs
           drawn and figured, the Router holding, the stream mid-week split
           four ways, one auction settling, and a burn taking the same share
           out of every bay. Every number below is stepped, not asserted. */
        seed();
        for (let i = 0; i < 26; i++) {
          let rateBefore = 0;
          mn.slots.forEach((sl) => (rateBefore += sl.tps));
          stepMine(mn, 24, mineFx);
          /* the still integrates GBX exactly the way a frame does, so the
             `issued = pending + minted` row closes here too rather than being
             re-asserted for the benefit of the photograph */
          issued += rateBefore * 24;
          stepResonance(rz, 380, {});
          aucStep(au, 190, {});
        }
        /* nine seconds of the redemption model: a burn lands, the bays and the
           supply move, and the mint puts some of it back — so the still shows
           the inflow with a real figure on it instead of `+0` */
        for (let i = 0; i < 36; i++) advanceRedeem(0.25);
        if (packet !== null) packet.age = PACKET_RUN * 0.82;
        /* the packet's remainder has not landed yet, so it is IN FLIGHT and is
           deliberately not booked: in − routed − held − in flight is zero in
           the still exactly as it is in a frame */
        const inFlightStill = packet !== null ? packet.toRouter : 0;
        const landed = Math.max(0, mn.routerDeposits - inFlightStill);
        router.outTotal = landed * 0.62;
        router.bookedIn = landed;
        router.held = landed - router.outTotal;
        rd.phase = 'burn';
        rd.who = '@you';
        rd.mine = true;
        rd.pct = 0.1;
        rd.burned = rd.supply * 0.1;
        rd.taken = rd.holds.map((hh) => hh.amt * 0.1);
        rd.pt = 0.78;
        rz.assets.forEach((a, i) => {
          if (i === 3) {
            a.flash = 0.7;
            a.lastLot = 96;
          }
        });
        flush[3] = { age: 0.45, lot: 96 };
        if (resize()) {
          L = buildLayout();
          renderLegend(L.w - L.pad * 2, L.legendH, L.dpr);
          build(L);
          paint();
        }
      },
    });

    return () => {
      unregister();
      ro?.disconnect();
    };
  }, []);

  return (
    <section id="sec-plate" className="section section--rule" aria-labelledby="sec-plate-h">
      <div className="container">
        <header className="sec-head sec-head--indexed reveal">
          <div className="sec-head__index">
            <span className="sec-head__num" aria-hidden="true">
              00
            </span>
            <p className="eyebrow">The plate</p>
          </div>
          <div className="sec-head__body">
            <h2 className="h1" id="sec-plate-h">
              One drawing, the whole system
            </h2>
            <p className="lede">
              Sixteen slots, a router that holds, a seven-day stream, four auctions, four bays and your share — drawn
              once, at one altitude, with width as quantity everywhere.
            </p>
          </div>
        </header>

        <p className="small muted measure pl-how reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
          Read it top to bottom. Conservation holds strictly <em>within</em> each segment; at the Router the chain is
          deliberately broken, because a Mine deposit is not a forward and nothing schedules one.
        </p>

        <div className="sim-panel reveal" style={{ '--d': '180ms' } as React.CSSProperties}>
          <div className="sim-panel__head">
            <span className="sim-panel__title">The plate — live model</span>
            <span className="chip chip--warn">Illustrative parameters</span>
          </div>
          <div className="sim-panel__body">
            <p className="pl-cap">One plate · six stations · four conserved segments</p>
            <div className="pl-stage">
              <canvas
                id="pl-canvas"
                role="img"
                aria-label={
                  'One plate of the whole protocol, read top to bottom. ' +
                  'The mine: sixteen slots, each a falling-price auction running to zero over an hour. Taking an occupied slot credits 80% of the price to the displaced miner as a pull claim they must collect — a dead end — and deposits the exact remainder in ResonanceRouter; an empty slot on its first fill deposits 100%. USDG buys the slot; the slot then mints GBX on a clock at one sixteenth of the global rate, tenure-locked and independent of what was paid. ' +
                  'ResonanceRouter is a vessel that holds: a deposit is not a forward. Its outlet is route(), which is permissionless with no role, no bounty and no liveness guarantee, so revenue may wait indefinitely. The plate draws the chain breaking there, and changes gauge across the break: everything above is measured in USDG, everything below in USDG per second. ' +
                  'Below the break, a seven-day stream is split by live signal weights into four lanes whose widths are the shares and always sum to the trunk. Each lane fills its own auction, which asks less every hour until the ask meets what the lot is worth; ten per cent of every fill is the signalers’ share, drawn and labelled but not followed further. The rest lands in the fund, which holds NVDA, QQQ, WBTC and AAPL in four bays, each on its own gauge. ' +
                  'Burning GBX sends you the same proportion of every bay in one transaction. ' +
                  legendAltText()
                }
              />
            </div>
          </div>
          <div className="sim-panel__foot">
            <p className="small muted">
              Every figure comes from the same frozen models the sections below run. Prices, takers and timing are
              illustrative; the constants, the 80/20 allocation, the ×2 restart with its $1 floor, the seven-day
              duration and the 10% signaler share are the contracts&#39;.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
