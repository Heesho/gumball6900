'use client';

import { useLayoutEffect } from 'react';
import { fontFamily, registerSim } from '../../lib/harness';
import { ease, ramp } from '../../lib/ease';
import { ASSETS as ASSET_HUES, GBX, USDG, drawLegend, legendAltText, legendFonts, readInk, wrap } from '../../lib/legend';
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
   THE DEFECT THIS FIXES. GBX-neutral is published in the colour law and then
   drawn — where it is drawn at all — as a tinted grey or at reduced alpha, so
   it reads against `--panel` as a scratch rather than as a flow. That is
   exactly backwards: the burn is how value LEAVES the protocol and is half the
   argument. So the plate fixes the treatment rather than picking an alpha per
   mark:

     · a neutral flow is filled with the law's own GBX — literally `#FFFFFF`,
       the value the published swatch carries — at FULL opacity, always. The
       key and the band are then the same colour, byte for byte, and there is
       nothing to drift;
     · it carries a shaded UNDERSIDE hairline, the same lit-from-above light
       the blue fluid gets, so it reads as material with a top rather than as
       a flat cut-out;
     · nothing neutral is ever painted below alpha 1. A band whose quantity is
       small is drawn NARROW, never faint: faintness would be a second,
       unpublished encoding sitting on top of width.

   `#FFFFFF` on `--panel #101017` is 18.94:1, so it clears AA at ribbon scale
   by an order of magnitude — which is the point: at the widths a Sankey band
   actually gets, a token colour is structural.

   This belongs in lib/legend.ts beside the rest of the colour law; it lives
   here only because that module is another builder's this round. */
const GBX_BODY = GBX;
const GBX_SHADE = 'rgba(2, 7, 13, 0.55)';

function fillNeutral(ctx: CanvasRenderingContext2D, band: Path2D, under?: Path2D): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = GBX_BODY;
  ctx.fill(band);
  if (under !== undefined) {
    ctx.strokeStyle = GBX_SHADE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.stroke(under);
  }
  ctx.restore();
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
  /** px per GBX — the supply gauge: the burn */
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
  forkY: number;
  splitY: number;
  landY: number;
  claimC: number;
  tallyY: number;
  claimY: number;
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
  aucTapY: number;
  aucNoteY: number;
  /** the exchange: blue out to the trader, the asset back */
  yOut: number;
  yBack: number;
  bayTop: number;
  bayBot: number;
  supplyY: number;
  burnY0: number;
  burnY1: number;
  collectY: number;
  /** the plate's spine — where the trunk runs */
  cx: number;
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
      drawLegend(legendCtx, { x: 0, y: 0, w }, { ink, fonts, dpr });
    }

    function buildLayout(): Layout {
      const w = view.w;
      const h = view.h;
      const narrow = w < 720;
      const mid = w < 1024;
      const pad = narrow ? 14 : 26;
      const inner = w - pad * 2;
      const legendH = legendHeight(inner);

      /* HEAD_H is the reserved title row every station gets. Nothing is ever
         drawn into it, which is why no station title can collide with the
         station above it however the band heights move. */
      const HEAD_H = narrow ? 66 : 34;

      /* Fixed bands first, then the flexible ones share what is left by
         weight, each with a floor that is the sum of its own reserved rows.
         Nothing is ever cut by its own container: if the floors do not fit
         the section's declared height the plate grows past it, which the
         measurement catches, rather than a mark being silently clipped. */
      const gaugeH = narrow ? 134 : 76;
      const headH = legendH + gaugeH + (narrow ? 30 : 26);
      const brkH = narrow ? 132 : 106;
      const instrH = narrow ? 286 : 196;
      const fixed = headH + brkH + instrH + pad * 2;

      const cgap = narrow ? 5 : 8;
      const chMin = narrow ? 78 : 92;
      const mineMin = HEAD_H + (narrow ? 100 : 42) + (chMin * 4 + cgap * 3) + 20 + (narrow ? 140 : 126);
      const flex: { k: 'mine' | 'router' | 'stream' | 'auc' | 'fund' | 'you'; w: number; min: number }[] = [
        { k: 'mine', w: 30, min: mineMin },
        { k: 'router', w: 11, min: HEAD_H + (narrow ? 250 : 176) },
        { k: 'stream', w: 15, min: HEAD_H + (narrow ? 250 : 232) },
        { k: 'auc', w: 19, min: HEAD_H + (narrow ? 600 : 356) },
        { k: 'fund', w: 12, min: HEAD_H + (narrow ? 250 : 200) },
        { k: 'you', w: 13, min: HEAD_H + (narrow ? 280 : 206) },
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
      const claimY = mine.y1 - (narrow ? 46 : 40);
      const splitY = claimY - (narrow ? 46 : 42);
      const forkY = splitY - (narrow ? 48 : 44);
      const landY = router.y0 + HEAD_H + 12;
      const gridBot = forkY - 20;
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
      /* Every annotation this station owns sits ABOVE the exchange, so no
         label is ever under a band and no band is ever under a label. Below
         the notes there is nothing but flow and the 10% taps. */
      const aucValY = aucTop + Math.max(48, 0) + 0; // resolved below
      const aucBottom = auc.y1;
      const aucTapY = aucBottom - 14;
      const yBack = aucTapY - 26;
      const yOut = yBack - 26;
      const aucNoteY = yOut - 30;
      const aucValYReal = aucNoteY - 80;
      const aucH = Math.max(48, aucValYReal - 16 - aucTop);
      void aucValY;

      /* ---- the fund and the claim ---------------------------------------- */
      const bayTop = fund.y0 + HEAD_H + 14;
      const bayBot = fund.y1 - (narrow ? 74 : 48);
      const supplyY = you.y0 + HEAD_H + 16;
      const burnY0 = supplyY + 22;
      const burnY1 = burnY0 + (narrow ? 34 : 30);
      const collectY = you.y1 - (narrow ? 104 : 48);

      /* ---- THE GAUGES. Published, and drawn as scale bars ---------------- */
      /* gStock is only a seed here — station 01's live gauge is derived from
         the mine's own dollar axis in build(). gFlow and gLot are fixed,
         because the quantities they draw are bounded by their own models. */
      const gStock = Math.max(2.1, Math.min(6, inner / 300)); // px per USDG, seed
      /* The stream's rate is a constant of the model (WEEKLY over a seven-day
         DURATION), so its gauge is derived from the width once: the trunk is
         always the same share of the plate and can never be cut by the frame. */
      const gFlow = (inner * 0.32) / (WEEKLY / STREAM);
      const gGbx = (inner * 0.58) / SUPPLY0; // px per GBX
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
        cw,
        ch,
        cgap,
        gridX: pad,
        gridW,
        gridTop,
        gridBot,
        gbxX: pad + gridW + (narrow ? 0 : 14),
        gbxCol,
        forkY,
        splitY,
        landY,
        claimY,
        claimC: pad + 58,
        tallyY,
        routerVy: router.y0 + HEAD_H + 16,
        routerVh: Math.max(58, router.y1 - (router.y0 + HEAD_H + 16) - (narrow ? 124 : 58)),
        routerVw: narrow ? 80 : 104,
        routerValveY: router.y1 - (narrow ? 92 : 26),
        trunkY0,
        trunkY1,
        laneLandY,
        laneLabelY,
        fiY,
        aucTop,
        aucH,
        aucValY: aucValYReal,
        aucTapY,
        aucNoteY,
        yOut,
        yBack,
        bayTop,
        bayBot,
        supplyY,
        burnY0,
        burnY1,
        collectY,
        cx: pad + inner / 2,
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
      mineBands: [] as Painted[],
      streamBands: [] as Painted[],
      aucBands: [] as Painted[],
      claimBands: [] as Painted[],
      gbxNeutral: [] as { band: Path2D; edge: Path2D }[],
      burnNeutral: null as { band: Path2D; edge: Path2D } | null,
      pipes: [] as Path2D[],
      checks: [] as Check[],
      /** how far the live payment packet has run, 0..1 */
      packetP: 0,
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
      /** the fund's four slice widths, px, and their bays' drawn stock, px */
      slice: [0, 0, 0, 0],
      stock: [0, 0, 0, 0],
      burnW: 0,
    };
    let pipeKey = '';
    let pipeCache: Path2D[] = [];

    /** a straight run in flow space: x is DOWN, c is ACROSS. */
    function run(key: string, gauge: number, x0: number, x1: number, c: number, q: number): Ribbon {
      return ribbon(key, gauge, [
        { x: x0, c, q },
        { x: x1, c, q },
      ]);
    }

    function build(l: Layout): void {
      /* the live gauge, and a round unit for its scale bar */
      const room = (l.w - l.pad * 2) * 0.42;
      F.gStock = room / Math.max(1, mn.scaleTop);
      const raw = mn.scaleTop / 3;
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, raw))));
      const unit = raw / mag >= 5 ? 5 * mag : raw / mag >= 2 ? 2 * mag : mag;
      F.gStockUnit = unit;

      F.mineBands.length = 0;
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
        const zero = splitFlow({
          gauge: 1,
          at: { x: l.splitY, c: l.cx, q: 0 },
          legs: [
            { key: 'claim', q: 0, to: { x: l.claimY, c: l.claimC } },
            { key: 'rt', q: 0, to: { x: l.landY, c: l.cx } },
          ],
          steps: 14,
        });
        zero.forEach((r) => pipeCache.push(centrePath(r)));
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
          at: { x: l.collectY, c: l.cx },
          steps: 16,
        });
        zeroClaim.legs.forEach((r) => pipeCache.push(centrePath(r)));
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

      /* ══════════════════════════ S1 · the mine payment ════════════════════
         A payment is a discrete allocation, not a stream. It forks once:
         80% is credited to the displaced miner as a PULL CLAIM they must
         collect — a dead end — and the exact remainder is deposited in the
         Router. It is 100% only on an empty slot's first fill. */
      if (packet !== null) {
        const p = packet;
        F.packetP = Math.min(1, p.age / PACKET_RUN);
        const cell = cellBox(l, p.slot);
        const from = cell.x + l.cw / 2;
        /* The payment leaves the BOARD, not a cell: the trunk starts at the
           grid's bottom edge under the taken column, and a signal-weight
           leader — drawn behind the cells — is what ties it to the slot. A
           process band crossing fifteen other slots would be a false claim
           about where the money is. */
        const trunk = ribbon('pay', F.gStock, [
          { x: l.gridBot, c: from, q: p.paid },
          { x: l.forkY, c: from, q: p.paid },
          { x: l.splitY, c: l.cx, q: p.paid },
        ]);
        const legs =
          p.toMiner > 0
            ? [
                { key: 'claim', q: p.toMiner, to: { x: l.claimY, c: l.claimC } },
                { key: 'rt', q: p.toRouter, to: { x: l.landY, c: l.cx } },
              ]
            : [{ key: 'rt', q: p.toRouter, to: { x: l.landY, c: l.cx } }];
        const at: Station = { x: l.splitY, c: l.cx, q: p.paid };
        const fan = splitFlow({ gauge: F.gStock, at, legs, steps: 14 });
        F.mineBands.push({ path: ribbonPath(trunk), ink: USDG });
        fan.forEach((r) => F.mineBands.push({ path: ribbonPath(r), ink: r.key === 'claim' ? ink.blueLabel : USDG }));

        const rep = junctionReport(at, fan, F.gStock, 'first');
        F.checks.push({
          seg: 'S1',
          what: 'mine payment → claim + Router',
          claim: p.paid,
          drawn: rep.legQ,
          err: rep.qErr + rep.maxSeamPx + rep.spanErrPx,
        });
        const scan = scanConservation({ legs: fan, total: p.paid, from: l.splitY, to: l.landY, samples: 33 });
        F.checks.push({
          seg: 'S1',
          what: 'across the fork, 33 stations',
          claim: p.paid,
          drawn: p.paid + (scan.maxAbsErr || 0),
          err: scan.maxAbsErr,
        });
      } else {
        F.packetP = 0;
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
          at: { x: l.collectY, c: l.cx },
          steps: 16,
        });
        conv.legs.forEach((r, i) => F.claimBands.push({ path: ribbonPath(r), ink: hueOf(i) }));
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

      /* the burn itself: GBX, neutral, and a first-class flow */
      F.burnW = burning ? rd.burned * k * l.gGbx : 0;
      if (F.burnW > 0.4) {
        const q = rd.burned * k;
        const r = run('burn', l.gGbx, l.burnY0, l.burnY1, l.pad + F.burnW / 2 + 2, q);
        F.burnNeutral = {
          band: ribbonPath(r),
          edge: centrePath(
            ribbon('burnEdge', l.gGbx, [
              { x: l.burnY1, c: l.pad + 2, q: 0 },
              { x: l.burnY1, c: l.pad + 2 + F.burnW, q: 0 },
            ]),
          ),
        };
      }

      /* the mine's pending GBX, drawn as four row collectors into one trunk —
         neutral, at full strength, because this is how supply is created */
      if (!l.narrow) {
        const rows = [0, 1, 2, 3].map((r) => {
          let q = 0;
          for (let c = 0; c < 4; c++) q += mn.slots[r * 4 + c]?.mined ?? 0;
          return q;
        });
        const conv = convergeFlow({
          gauge: l.gMined,
          sources: rows.map((q, r) => ({
            key: 'g' + r,
            q,
            from: { x: cellBox(l, r * 4).y + l.ch / 2, c: l.gbxX },
          })),
          at: { x: l.gridTop + 1.5 * (l.ch + l.cgap), c: l.gbxX + 46 },
          steps: 10,
        });
        conv.legs.forEach((r) => F.gbxNeutral.push({ band: ribbonPath(r), edge: centrePath(r) }));
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
      redStep(rd, dt, {});

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
    function neutralFlow(band: Path2D, edge: Path2D): void {
      ctx.save();
      ctx.transform(0, 1, 1, 0, 0, 0);
      fillNeutral(ctx, band, edge);
      ctx.restore();
    }

    function label(text: string, x: number, y: number, size = 10, colour = ink.muted, align: CanvasTextAlign = 'left'): void {
      ctx.font = mono(size, 500);
      ctx.fillStyle = colour;
      ctx.textAlign = align;
      ctx.fillText(text, x, y);
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
      const nw = caps(n, gutter - tagW / 2, y + 15, 11, ink.hi);
      caps(title, gutter - tagW / 2 + nw + 12, y + 15, 11, ink.hi);
    }

    function stationHead(l: Layout, b: Band, n: string, title: string, note: string): void {
      rule(l, b.y0, l.pad, l.w - l.pad, ink.ruleStrong);
      const nw = caps(n, l.pad, b.y0 + 17, 11, ink.hi);
      const tw = caps(title, l.pad + nw + 14, b.y0 + 17, 11, ink.hi);
      ctx.font = mono(l.narrow ? 9 : 10, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      const nx = l.pad + nw + tw + 28;
      if (ctx.measureText(note).width + nx <= l.w - l.pad) ctx.fillText(note, nx, b.y0 + 17);
      else
        wrap(ctx, note, l.w - l.pad * 2)
          .slice(0, 2)
          .forEach((t, i) => ctx.fillText(t, l.pad, b.y0 + 30 + i * 11));
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
      paintInstruments(l);
    }

    /* --------------------------------------------------------------- head */
    function paintHead(l: Layout): void {
      const b = l.head;
      const used = l.legendH;
      if (legendCtx !== null) ctx.drawImage(legendTile, l.pad, b.y0, l.w - l.pad * 2, used);
      const y = b.y0 + used + (l.narrow ? 26 : 22);
      rule(l, y - 14, l.pad, l.w - l.pad, ink.rule);
      const tw = caps('THE THREE GAUGES', l.pad, y, 11, ink.hi);
      ctx.font = fonts.meta;
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      const note = 'width is quantity — hold a ruler against them';
      if (l.pad + tw + 16 + ctx.measureText(note).width < l.w - l.pad) ctx.fillText(note, l.pad + tw + 16, y);

      const bars: { w: number; ink: string; text: string; neutral?: boolean }[] = [
        {
          w: F.gStockUnit * F.gStock,
          ink: USDG,
          text: '= ' + money(F.gStockUnit) + ' of a mine payment — station 01, on the board\u2019s own dollar axis',
        },
        { w: 0.02 * l.gFlow, ink: USDG, text: '= 0.02 USDG/s — the stream and its lanes' },
        { w: 2e6 * l.gGbx, ink: GBX_BODY, text: '= 2M GBX — supply, and what is burned', neutral: true },
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
      ctx.font = mono(9, 400);
      ctx.fillStyle = ink.faint;
      ctx.textAlign = 'left';
      wrap(
        ctx,
        'Nothing on this plate is faded to mean "less": a small quantity is a NARROW band, never a dim one. Each station also prints any gauge of its own — the auctions\u2019 lots and every fund bay.',
        l.w - l.pad * 2,
      )
        .slice(0, l.narrow ? 3 : 1)
        .forEach((t, i) => ctx.fillText(t, l.pad, ry + 4 + i * 11));
    }

    /* --------------------------------------------------------------- mine */
    function paintMine(l: Layout): void {
      const b = l.mine;
      stationHead(l, b, '01', 'THE MINE', 'sixteen slots · a falling price, one hour to zero · the bar is the clock, empty at restart and full at the hour');

      /* THE LEADER, drawn FIRST so the opaque cells cover it. A wire that runs
         behind the board shows only in the gaps, which is what a leader is;
         a process band crossing fifteen other slots would be a false claim
         about where the money is. */
      if (packet !== null) {
        const cell = cellBox(l, packet.slot);
        setStroke(ctx, SIGNAL, ink.blueLabel);
        ctx.beginPath();
        ctx.moveTo(cell.x + l.cw / 2, cell.y + l.ch);
        ctx.lineTo(cell.x + l.cw / 2, l.gridBot);
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
        label(
          open ? (l.narrow ? 'never taken' : 'never taken · 0/h') : fmtGbx(slot.mined) + ' GBX',
          x + w - ip,
          y + h - 18,
          l.narrow ? 8 : 9,
          open ? ink.faint : ink.text,
          'right',
        );
      }

      /* --- the GBX column: USDG buys the SLOT; the slot mints on a clock -- */
      if (!l.narrow) {
        F.gbxNeutral.forEach((n) => neutralFlow(n.band, n.edge));
        let pending = 0;
        mn.slots.forEach((s) => (pending += s.mined));
        const nx = l.gbxX + 46;
        const ny = l.gridTop + 1.5 * (l.ch + l.cgap);
        node(ctx, nx + 11, ny, { ink: ink.muted, size: 16, fill: ink.raised });
        /* the mine's emission is on its own published gauge, the way a bay's
           stock is: a scale bar beside the band it measures */
        ctx.fillStyle = GBX_BODY;
        ctx.fillRect(l.gbxX, l.gridTop - 12, 20000 * l.gMined, 7);
        label('= 20k GBX pending', l.gbxX + 20000 * l.gMined + 7, l.gridTop - 6, 9, ink.faint);
        const tx = l.gbxX + 88;
        const wrapW = l.gbxCol - 92;
        label('PENDING GBX', tx, ny - 3, 9.5, ink.hi);
        label(fmtGbx(pending), tx, ny + 12, 11, ink.text);
        ctx.font = mono(9, 400);
        ctx.fillStyle = ink.muted;
        ctx.textAlign = 'left';
        const lines = wrap(
          ctx,
          'USDG buys the SLOT. The slot then mints GBX on a clock at globalTps/16 — tenure-locked, and independent of what was paid. It is minted to the miner at replacement.',
          wrapW,
        );
        const ly = Math.min(ny + 32, l.gridBot - lines.length * 12 - 32);
        lines.forEach((t, i) => ctx.fillText(t, tx, ly + i * 12));
        label('minted so far', tx, ly + lines.length * 12 + 12, 9, ink.faint);
        label(fmtGbx(mn.totalMined) + ' GBX', tx, ly + lines.length * 12 + 26, 11, ink.text);
      }

      /* --- the fork ---------------------------------------------------- */
      /* A resting route is drawn ONLY while its station is at zero. A hairline
         running alongside a live band reads as a ghost edge on the band, which
         is a mark carrying no quantity sitting on a mark that does. */
      if (packet === null) F.pipes.slice(0, 2).forEach((pp) => strokeFlow(pp, ink.rule, PROCESS_REST.width));

      if (packet !== null) {
        const head = l.gridBot + (l.landY - l.gridBot) * ease(F.packetP);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, l.gridBot - 1, l.w, Math.max(2, head - l.gridBot + 1));
        ctx.clip();
        F.mineBands.forEach((band) => fillFlow(band.path, band.ink));
        ctx.restore();
      }

      splitter(ctx, l.cx, l.splitY, { ink: ink.muted, size: 17, fill: ink.raised });

      /* the dead end: a pull claim is not a payment pushed to anyone, and it
         terminates INSIDE this station — it never crosses into the Router's */
      sink(ctx, l.claimC, l.claimY, { ink: ink.muted, size: 17, fill: ink.muted, barH: 26, angle: Math.PI / 2 });
      label('PULL CLAIM · 80%', l.claimC + 18, l.claimY - 2, 10, ink.hi);
      ctx.font = mono(9, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      wrap(ctx, 'they must collect it — it never reaches the Router', l.w - l.pad - l.claimC - 18)
        .slice(0, 1)
        .forEach((t, i) => ctx.fillText(t, l.claimC + 18, l.claimY + 11 + i * 11));
      label('credited so far  ' + money(mn.paidToMiners), l.claimC + 18, l.claimY + 23, 9, ink.text);

      if (packet !== null) {
        const p = packet;
        const cell = cellBox(l, p.slot);
        const cxp = cell.x + l.cw / 2;
        const alpha = 1 - ramp(p.age, PACKET_RUN + PACKET_HOLD - 0.3, PACKET_RUN + PACKET_HOLD);
        ctx.save();
        ctx.globalAlpha = alpha;
        const side = cxp > l.cx ? -1 : 1;
        const lx = cxp + side * (widthOf(F.gStock, p.paid) / 2 + 10);
        label(
          (p.buyer === 'you' ? 'YOU take' : '@' + p.buyer + ' takes') + ' slot ' + pad2(p.slot + 1) + ' for ' + money(p.paid),
          lx,
          l.gridBot + 14,
          10,
          ink.hi,
          side > 0 ? 'left' : 'right',
        );
        label(
          'it restarts at ' + money(p.restart) + ' — ' + leapNote(p.paid, p.restart),
          lx,
          l.gridBot + 27,
          9.5,
          ink.muted,
          side > 0 ? 'left' : 'right',
        );
        if (p.toMiner > 0) {
          if (l.narrow) {
            label('80% · ' + money(p.toMiner) + ' → the claim', l.pad, l.splitY - 24, 9.5, ink.blueLabel, 'left');
            label('20% · ' + money(p.toRouter) + ' → the Router', l.pad, l.splitY - 12, 9.5, ink.blueLabel, 'left');
          } else {
            label('80% · ' + money(p.toMiner) + ' → the claim', (l.cx + l.claimC) / 2, l.splitY - 12, 10, ink.blueLabel, 'center');
            label('20% · ' + money(p.toRouter) + ' → the Router', l.cx + 14, l.splitY - 12, 10, ink.blueLabel, 'left');
          }
        } else {
          label(
            l.narrow ? '100% deposited · ' + money(p.toRouter) : 'NO ONE DISPLACED — 100% deposited · ' + money(p.toRouter),
            l.narrow ? l.pad : l.cx + 14,
            l.splitY - 12,
            l.narrow ? 9.5 : 10,
            ink.blueLabel,
            'left',
          );
        }
        ctx.restore();
      } else {
        ctx.font = mono(9, 400);
        ctx.fillStyle = ink.faint;
        ctx.textAlign = 'left';
        wrap(ctx, 'nothing is in flight — an empty pipe is the truthful state between takes', l.w - l.pad - l.cx - 16)
          .slice(0, 2)
          .forEach((t, i) => ctx.fillText(t, l.cx + 14, l.splitY - 12 + i * 11));
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
      stationHead(l, b, '02', 'RESONANCE ROUTER', 'it HOLDS — a deposit is not a forward');

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
      label(money(router.capShown), vx - 9, vy + 4, 9, ink.muted, 'right');
      label('$0', vx - 9, vy + vh + 2, 9, ink.muted, 'right');
      label('HELD  ' + money(router.held), l.cx, vy - 8, 10.5, ink.hi, 'center');

      /* the inlet drip: every ambient deposit the board makes arrives here, so
         the level never rises without something visibly arriving */
      if (drip > 0) {
        const dy = vy - 16 + (1 - drip) * 14;
        ctx.fillStyle = USDG;
        ctx.beginPath();
        ctx.arc(l.cx, dy, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      /* the mine's remainder finishing its run into this vessel — the fork was
         drawn in station 01, and the leg that crosses the boundary is drawn
         here so it is never cut at a station edge */
      if (packet !== null) {
        const head = l.gridBot + (l.landY - l.gridBot) * ease(F.packetP);
        if (head > b.y0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, b.y0, l.w, Math.max(1, head - b.y0));
          ctx.clip();
          F.mineBands.forEach((band) => fillFlow(band.path, band.ink));
          ctx.restore();
        }
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
      label('route()', rx, valveY - 3, 10, open > 0 ? ink.hi : ink.muted);
      ctx.font = mono(9, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      wrap(
        ctx,
        open > 0
          ? 'someone called it — ' + money(router.lastRouted) + ' forwarded'
          : 'permissionless · no role, no bounty, no liveness · it has waited ' + router.sinceRoute.toFixed(1) + 's',
        l.w - l.pad - rx,
      )
        .slice(0, 2)
        .forEach((t, i) => ctx.fillText(t, rx, valveY + 10 + i * 11));

      /* the left gutter earns its space: the balance the vessel has to satisfy */
      ctx.font = mono(9, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      const bx = l.narrow ? l.pad : l.cx + vw / 2 + 16;
      const by = l.narrow ? valveY + 34 : vy + 14;
      const bw2 = l.narrow ? l.w - l.pad * 2 : l.w - l.pad - bx;
      ctx.fillText('deposited by the mine   ' + money(mn.routerDeposits), bx, by);
      ctx.fillText('forwarded by route()   ' + money(router.outTotal), bx, by + 14);
      ctx.fillText('still held   ' + money(router.held), bx, by + 28);
      wrap(ctx, 'and it can stay held for ever — nothing schedules the call', bw2)
        .slice(0, 2)
        .forEach((t, i) => ctx.fillText(t, bx, by + 46 + i * 11));
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
      const lines = l.narrow
        ? [
            'Mine emits RevenueDeposited and stops.',
            'Only RevenueRouted proves a forward.',
            'Above: USDG. Below: USDG per second.',
            'Nothing here claims they are the same money.',
          ]
        : [
            'Mine emits RevenueDeposited and stops there; only ResonanceRouter.RevenueRouted proves a later forward, and nothing schedules one.',
            'So the gauge changes across this line: everything above is conserved in USDG, everything below is a separate model conserved in USDG per second.',
            'The plate makes no claim that the money below is the money above.',
          ];
      lines.forEach((t, i) => ctx.fillText(t, l.cx, y + 20 + i * 13));
    }

    /* ------------------------------------------------------------- stream */
    function paintStream(l: Layout): void {
      const b = l.stream;
      stationHead(l, b, '03', 'THE SEVEN-DAY STREAM', 'split by signal — the lane widths ARE the shares');

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
        label('RESONANCE · ' + money(left) + ' left', tx, ty - 8, 9, ink.hi);
        label('releasing ' + rate.toFixed(4) + ' USDG/s', tx, ty + th + 12, 9, ink.muted);
      } else {
        label('RESONANCE', tx + tw + 10, ty + 13, 10, ink.hi);
        label(money(left) + ' left of this week', tx + tw + 10, ty + 26, 9.5, ink.muted);
        label('releasing ' + rate.toFixed(4) + ' USDG/s', tx + tw + 10, ty + 39, 9.5, ink.muted);
      }

      /* a resting channel is drawn only while it is resting — never beside the
         band that fills it, where it would read as a ghost edge */
      if (rate <= 0) F.pipes.slice(2, 6).forEach((pp) => strokeFlow(pp, ink.rule, PROCESS_REST.width));
      F.streamBands.forEach((band) => fillFlow(band.path, band.ink));

      /* the control node: signal is a thin dashed line and carries no width */
      const nodeY = l.trunkY0 - 12;
      const nx = l.w - l.pad - 11;
      const total = totalStake(rz);
      node(ctx, nx, nodeY, { ink: ink.pink, size: 15, fill: ink.raised });
      label('SIGNAL · ' + Math.round(total).toLocaleString('en-US') + ' GBX pointed', nx - 4, nodeY - 14, 10, ink.pinkLabel, 'right');
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
        label(
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
        ctx.fillStyle = ink.panel;
        ctx.fillRect(bay.cx - plateW / 2, l.laneLabelY - 13, plateW, 30);
        ctx.strokeStyle = ink.rule;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(hairline(bay.cx - plateW / 2, l.dpr), hairline(l.laneLabelY - 13, l.dpr), plateW, 30);
        label(a.sym, bay.cx, l.laneLabelY, l.narrow ? 9 : 10.5, ink.hi, 'center');
        label(sub, bay.cx, l.laneLabelY + 12, l.narrow ? 8 : 9, ink.muted, 'center');
      });
      label('FI · milli-USDG/s down this lane', l.pad, l.trunkY1 + 22, 9, ink.faint);
    }

    /* ----------------------------------------------------------- auctions */
    function paintAuctions(l: Layout): void {
      const b = l.auc;
      /* the rule steps around the four lanes; the tag sits in the middle
         gutter, where no band ever runs */
      const total0 = totalStake(rz);
      const rateNow = rz.flow.t < rz.flow.finish ? rz.flow.rate : 0;
      const laneHalf = (i: number) => (widthOf(l.gFlow, rateNow * ((rz.assets[i]?.stake ?? 0) / total0)) / 2 || 0) + 9;
      steppedHead(l, l.aucTop - 20, '04', l.narrow ? 'AUCTIONS' : 'FOUR AUCTIONS · EACH ON ITS OWN CLOCK', laneHalf, 0);
      void b;

      const potCap = l.potCap;
      /* the station's own gauge, drawn as a scale bar so it can be checked */
      ctx.fillStyle = USDG;
      ctx.fillRect(l.pad, l.aucNoteY - 22, 100 * l.gLot, 8);
      label('= 100 USDG of lot — this station\u2019s own gauge', l.pad + 100 * l.gLot + 8, l.aucNoteY - 15, 9, ink.faint);

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
        if (l.narrow) {
          label(a.sym + ' ' + money(a.pot), bay.cx, l.aucValY + 4, 8, ink.text, 'center');
        } else {
          label(a.sym + '  ' + money(a.pot), bay.cx, l.aucValY, 10.5, ink.text, 'center');
          label('USDG waiting for its auction', bay.cx, l.aucValY + 12, 9, ink.faint, 'center');
        }
      });

      /* the exchange, drawn as an exchange: the pipes at rest first, then the
         live bands over them, then the trader each pair passes through */
      F.pipes.slice(10, 14).forEach((pp, i) => {
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
          label('A TRADER', traderC + side * 13, l.yOut - 12, 9, ink.muted, side > 0 ? 'left' : 'right');
          label(
            'takes the USDG, hands back ' + a.sym,
            traderC + side * 13,
            l.yOut + 22,
            8.5,
            ink.faint,
            side > 0 ? 'left' : 'right',
          );
        }
      });
      label('USDG out · the asset back — the trade is the price', l.cx, l.yOut - 22, 9, ink.muted, 'center');

      /* --- the tenth. Drawn and labelled, and deliberately not followed --- */
      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        const x = bay.cx - l.bayW * 0.74;
        sink(ctx, x, l.aucTapY, { ink: hueOf(i), size: 13, fill: hueOf(i), barH: 13 });
        label('10%', x - 10, l.aucTapY + 4, 8.5, ink.muted, 'right');
      });
      ctx.font = mono(9, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      wrap(
        ctx,
        '10% of every fill is the signalers’ — Resonance.DEFAULT_BRIBE_BPS = 1000. Drawn, labelled, and not followed further on this plate. Tapped so far ' +
          money(tapped.reduce((n, v) => n + v, 0)) +
          '.',
        l.w - l.pad * 2,
      )
        .slice(0, 2)
        .forEach((t, i) => ctx.fillText(t, l.pad, l.aucNoteY + i * 11));

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
        if (!trading) label('worth ' + worth.toFixed(2), x + w + 22, wy + 3, 8.5, ink.blueLabel);
        /* the blade */
        ctx.fillStyle = hueOf(1);
        ctx.fillRect(x - 4, ay - 1.5, w + 8, 3);
        ctx.beginPath();
        ctx.moveTo(x + w + 9, ay - 5);
        ctx.lineTo(x + w + 15, ay);
        ctx.lineTo(x + w + 9, ay + 5);
        ctx.closePath();
        ctx.fill();
        label(
          trading ? 'settled at ' + asking.toFixed(2) + ' QQQ' : 'ask ' + asking.toFixed(2) + ' QQQ',
          x + w + 22,
          ay + 3,
          8.5,
          trading ? ink.hi : ink.pinkLabel,
        );
        ctx.font = mono(8.5, 400);
        ctx.fillStyle = trading ? ink.hi : ink.muted;
        ctx.textAlign = 'left';
        if (!trading)
          wrap(ctx, 'the ask falls until it meets what the lot is worth', l.narrow ? 92 : 108).forEach((t, k) =>
            ctx.fillText(t, x + w + 22, ay + 16 + k * 11),
          );
      }
      ctx.font = mono(9, 400);
      ctx.fillStyle = ink.faint;
      ctx.textAlign = 'left';
      wrap(
        ctx,
        'One auction in detail — lane 2. The other three run the same mechanism on their own clocks; the plate does not draw an ask it has no model for.',
        l.w - l.pad * 2,
      )
        .slice(0, 2)
        .forEach((t, i) => ctx.fillText(t, l.pad, l.aucNoteY - 48 + i * 11));
    }

    /* --------------------------------------------------------------- fund */
    function paintFund(l: Layout): void {
      const b = l.fund;
      steppedHead(l, b.y0, '05', 'THE FUND', () => l.bayW / 2 + 10, 1);
      const bayH = Math.max(30, l.bayBot - l.bayTop);
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
        /* the STOCK reading form the key publishes: name and number on ONE
           line, ticked to the vessel that holds it — never a bare numeral
           under a bare word */
        label(hh.sym, bay.cx, l.bayTop - 7, 10.5, ink.hi, 'center');
        ctx.strokeStyle = ink.ruleStrong;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(bay.cx, hairline(l.bayTop + bayH, l.dpr));
        ctx.lineTo(bay.cx, hairline(l.bayTop + bayH + 5, l.dpr));
        ctx.stroke();
        label(
          hh.sym + '  ' + hh.amt.toFixed(hh.amt < 10 ? 4 : 1),
          bay.cx,
          l.bayBot + 16,
          l.narrow ? 8.5 : 10,
          ink.text,
          'center',
        );
        if (i === 0) {
          const byy = l.bayTop + bayH * (1 - 1 / 1.22);
          ctx.strokeStyle = ink.ruleStrong;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(l.pad, hairline(byy, l.dpr));
          ctx.lineTo(x + w, hairline(byy, l.dpr));
          ctx.stroke();
          ctx.setLineDash([]);
          label(l.narrow ? 'gauge · full = ' + hh.base + ' ' + hh.sym : 'gauge · this bay full = ' + hh.base + ' ' + hh.sym, l.pad, byy - 5, l.narrow ? 8 : 9, ink.muted);
        }
      });
      ctx.font = mono(9, 400);
      ctx.fillStyle = ink.faint;
      ctx.textAlign = 'left';
      wrap(
        ctx,
        'Each bay is on its own gauge because each holds a different thing. What is comparable across bays is the SHARE a burn takes — the same everywhere.',
        l.w - l.pad * 2 - 4,
      )
        .slice(0, l.narrow ? 3 : 1)
        .forEach((t, i) => ctx.fillText(t, l.pad, l.bayBot + 32 + i * 11));
    }

    /* ---------------------------------------------------------------- you */
    function paintYou(l: Layout): void {
      const b = l.you;
      stationHead(l, b, '06', 'YOUR SHARE', 'burn GBX — and the same share leaves EVERY bay, in one transaction');

      /* the supply bar, and the burn leaving it — neutral, at full strength */
      const rxTable = l.narrow ? l.pad : Math.max(l.cx - 40, l.pad + 300);
      const sw = (l.narrow ? l.w - l.pad * 2 : rxTable - l.pad - 20) || 100;
      ctx.fillStyle = ink.raised;
      ctx.fillRect(l.pad, l.supplyY, sw, 9);
      ctx.fillStyle = ink.ruleStrong;
      ctx.fillRect(l.pad, l.supplyY, sw * (rd.supply / SUPPLY0), 9);
      label(Math.round(rd.supply).toLocaleString('en-US') + ' GBX in existence', l.pad, l.supplyY - 6, 9.5, ink.muted);

      if (F.burnNeutral !== null) neutralFlow(F.burnNeutral.band, F.burnNeutral.edge);

      const burnX = l.pad + Math.max(20, F.burnW) + 11;
      const burnY = (l.burnY0 + l.burnY1) / 2;
      valve(ctx, burnX, burnY, { ink: ink.panel, size: 21, weight: 4 });
      valve(ctx, burnX, burnY, { ink: ink.muted, size: 21, open: rd.phase === 'burn', fill: GBX_BODY });
      sink(ctx, burnX + 32, burnY, { ink: ink.muted, size: 19, fill: GBX_BODY, barH: 24, angle: 0 });
      label('BURN', burnX - 11, burnY + 26, 10, ink.hi);
      label('GBX leaves and does not return', burnX + 52, burnY + 4, 9.5, ink.muted);

      /* THE RECEIPT, per bay. The four rows are the pro-rata argument in
         figures beside the same argument in geometry: one share, applied to
         four different holdings, in one transaction. */
      const rx = rxTable;
      const rw = l.w - l.pad - rx;
      const ry = l.narrow ? burnY + 44 : l.supplyY - 4;
      const pct = rd.pct > 0 ? rd.pct : 0.1;
      caps('THE SAME SHARE, OUT OF EVERY BAY', rx, ry, 9.5, ink.hi);
      rd.holds.forEach((hh, i) => {
        const y = ry + 16 + i * 13;
        const take = (rd.phase === 'burn' ? takenAt(rd, i) : hh.amt * pct) || 0;
        label(hh.sym, rx, y, 9, hueOf(i));
        label((pct * 100).toFixed(2) + '%', rx + rw * 0.3, y, 9, ink.muted, 'right');
        label('of ' + hh.amt.toFixed(hh.amt < 10 ? 4 : 1), rx + rw * 0.62, y, 9, ink.muted, 'right');
        label('→ ' + take.toFixed(take < 10 ? 4 : 2), rx + rw, y, 9, ink.text, 'right');
      });
      label(
        rd.phase === 'burn' ? 'in flight now' : 'what a 10% burn would take at this instant',
        rx,
        ry + 16 + 4 * 13 + 4,
        8.5,
        ink.faint,
      );

      /* the four claim ribbons, and the collector */
      if (rd.phase !== 'burn') F.pipes.slice(6, 10).forEach((pp) => strokeFlow(pp, ink.rule, PROCESS_REST.width));
      F.claimBands.forEach((band) => fillFlow(band.path, band.ink));
      node(ctx, l.cx, l.collectY + 20, { ink: ink.muted, size: 18, fill: ink.raised });
      label('YOU', l.cx + 16, l.collectY + 24, 11, ink.hi);
      /* Where four bands run merged, the stack is named in its own order, so
         it can be read without telling the four hues apart. */
      label(
        l.narrow ? 'stacked NVDA·QQQ·WBTC·AAPL' : 'stacked NVDA · QQQ · WBTC · AAPL, in that order, top to bottom',
        l.cx - 16,
        l.collectY + (l.narrow ? 40 : 24),
        l.narrow ? 8 : 9,
        ink.faint,
        l.narrow ? 'center' : 'right',
      );

      ctx.font = mono(9.5, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'center';
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
      wrap(ctx, line, l.w - l.pad * 2)
        .slice(0, l.narrow ? 3 : 1)
        .forEach((t, i, arr) => ctx.fillText(t, l.cx, b.y1 - 6 - (arr.length - 1 - i) * 11));
    }

    /* -------------------------------------------------------- instruments */
    function paintInstruments(l: Layout): void {
      const b = l.instr;
      rule(l, b.y0, l.pad, l.w - l.pad, ink.ruleStrong);
      caps(l.narrow ? 'CONSERVATION, PER SEGMENT' : 'CONSERVATION, CHECKED EVERY FRAME — PER SEGMENT, NOT END TO END', l.pad, b.y0 + 17, l.narrow ? 9.5 : 10.5, ink.hi);
      ctx.font = mono(9, 400);
      ctx.fillStyle = ink.muted;
      ctx.textAlign = 'left';
      wrap(
        ctx,
        'Δ is printed in exponential form so an error can never hide behind a rounded zero, and it turns pink above 1e-11 of the quantity being checked — relative, because a six-figure GBX total floors an order of magnitude higher than a rate does. The Router row is the one that proves the break is honest: in − out − held. These are instantaneous checks, not counters; the tallies beside each station are the cumulative figures.',
        l.w - l.pad * 2,
      )
        .slice(0, 3)
        .forEach((t, i) => ctx.fillText(t, l.pad, b.y0 + 32 + i * 11));
      const rows = F.checks;
      const y0 = b.y0 + (l.narrow ? 84 : 68);
      const rh = Math.min(20, (b.y1 - y0 - 6) / Math.max(1, rows.length));
      const c1 = l.pad + 30;
      const c2 = l.pad + 330;
      const c3 = l.pad + 470;
      const c4 = l.w - l.pad;
      rows.forEach((r, i) => {
        const y = y0 + i * rh + 12;
        label(r.seg, l.pad, y, 9.5, ink.faint);
        ctx.font = mono(9.5, 400);
        ctx.fillStyle = ink.muted;
        ctx.textAlign = 'left';
        let what = r.what;
        const room = (l.narrow ? c4 - 84 : c2 - 12) - c1;
        while (ctx.measureText(what).width > room && what.length > 8) what = what.slice(0, -2);
        ctx.fillText(what, c1, y);
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
          stepMine(mn, 24, mineFx);
          stepResonance(rz, 380, {});
          aucStep(au, 190, {});
        }
        if (packet !== null) packet.age = PACKET_RUN * 0.82;
        router.outTotal = Math.max(0, mn.routerDeposits * 0.62);
        router.bookedIn = mn.routerDeposits;
        router.held = mn.routerDeposits - router.outTotal;
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
