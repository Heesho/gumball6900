'use client';

import { useLayoutEffect } from 'react';
import { fontFamily, registerSim } from '../../lib/harness';
import { ease } from '../../lib/ease';
import { ASSETS as ASSET_HUES, GBX, USDG, fillNeutral, readInk } from '../../lib/legend';
import { PROCESS_REST, hairline } from '../../lib/isa';
import {
  centrePath,
  convergeFlow,
  ribbon,
  ribbonPath,
  splitFlow,
  widthOf,
  type Ribbon,
  type Station,
} from '../../lib/ribbon';
import {
  DECAY,
  MINE_START_TIME,
  NAMES,
  SIM_ARRIVAL_TIME,
  SLOTS,
  SLOT_HOURLY,
  createMineState,
  gbx as fmtGbx,
  globalTps,
  pad2,
  priceOf,
  stepMine,
  warmStart,
  type MineFx,
  type MineState,
} from '../../lib/models/mine';
import {
  NODES,
  STREAM,
  WEEKLY,
  createResonanceState,
  stepResonance,
  totalStake,
  type ResonanceState,
} from '../../lib/models/resonance';
import { BRIBE, aucStep, createAucState, seedHistory, type AucState } from '../../lib/models/auction';
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
/* THE MINE'S CLOCK IS DISPLAY CHOREOGRAPHY. docs/MODELS.md is explicit that
   the taker's reservation and its dwell are choreography, not Mine rules, and
   this is the same dial: it changes how fast the illustrative board is
   watched, never what a slot pays or how a payment is split. It was slowed so
   that takes arrive far enough apart to be read one at a time. */
const TS_MINE = 15;
const TS_RZ = 900;
const TS_AUC = 450;

/* The width of the emission board's opening window, in PROTOCOL seconds — so
   it is stated in the units the axis is drawn in and survives a change to the
   clock above. Ten protocol minutes is about forty real seconds at TS_MINE,
   and the board schedules a take every five to ten real seconds, so the head
   reaches the right-hand edge having drawn roughly half a dozen risers: a
   flight of stairs, not a picket fence and not two lonely steps. */
const EMIS_SPAN = 600;

/**
 * Protocol seconds, as a span a reader can hold — the x extent of the emission
 * board. Coarse on purpose: the axis is stating a SCALE, not a timestamp, and
 * `1h 20m` is a scale where `01:20:14` is a clock nobody asked for.
 */
function elapsed(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${Math.max(1, m)}m`;
}

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
/* ═══════════ ONE CONSTANT GOVERNS EVERY VISUAL OF A TAKE ══════════════════
   The card's light and both streams are ONE event, so there is exactly ONE
   duration and ONE progress value in this file for them. Two timers drift;
   three drift visibly. `p` runs 0..1 across the window, both streams travel
   on `p`, and all three take their alpha from `1 - ease(p)` — the page's own
   easing token, on accumulated sim time.

   THE NUMBERS DO NOT RIDE THIS. The payment lands, the card's GBX steps to
   zero, LAST MINER changes and GBX MINTED steps, all at the instant of the
   take. Only the light and the bands decay. */
const TAKE_FADE = 3.5; // sim seconds — the whole visual life of a take
/* the head travels card → destination over the first stretch at full
   strength, then it has ARRIVED and the whole event holds and fades. A band
   that fades while it is still travelling can only ever reach its
   destination as it disappears, which is how a stream came to connect
   nothing to nothing. */
const TAKE_ARRIVE = 0.42;
/* …then it HOLDS at full strength, arrived, before it begins to fade. Without
   this the band started dissolving the instant it landed, so the arrival —
   the whole point of the event — was the one moment you could not see. */
const TAKE_HOLD = 0.72;

/**
 * THE ENVELOPE, AS ONE FUNCTION. Full strength while the event arrives and
 * holds, then eased out over what is left — and every light on this plate that
 * marks a discrete event rides it, so two marks for two halves of the same
 * event cannot run on two different clocks. `age` is in the same real seconds
 * `step()` is handed; it returns 1 at 0 and exactly 0 at TAKE_FADE.
 */
function takeAlpha(age: number): number {
  const t = Math.min(1, Math.max(0, age) / TAKE_FADE);
  return t < TAKE_HOLD ? 1 : 1 - ease((t - TAKE_HOLD) / (1 - TAKE_HOLD));
}

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
  /** px per USDG of LOT — the auctions' own gauge, published at the station */
  gLot: number;
  /** USDG — the published ceiling of a bucket's scale */
  potCap: number;
  mine: Band;
  router: Band;
  stream: Band;
  auc: Band;
  fund: Band;
  you: Band;
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
  /** the miner the mine's GBX is paid to: a slot-sized box above the board */
  minerY: number;
  minerH: number;
  /* ---- the payment's run, as an orthogonal pipe. Every leg is vertical where
     its width has to be read, so a stroke's perpendicular width IS the
     quantity. The run is one leg now: USDG in, and on into the Router. */
  /** the row the payment traverses on, from its slot's column to the spine */
  headerY: number;
  landY: number;
  routerVy: number;
  routerVh: number;
  routerVw: number;
  /** where the Router's outlet leaves the vessel and runs on down */
  routerOutY: number;
  buyerW: number;
  buyerH: number;
  buyerY: number;
  trunkY0: number;
  trunkY1: number;
  laneLandY: number;
  laneLabelY: number;
  aucTop: number;
  aucH: number;
  aucValY: number;
  /** the exchange: blue out to the trader, the asset back */
  yOut: number;
  yBack: number;
  bayTop: number;
  bayBot: number;
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

    /* EVERY TAKE GETS ITS OWN STREAM, and that is the mine's whole event: the
       card lights, and the USDG it was paid runs from THAT card down into the
       Router. The frozen model narrates only its scripted beats, but a reader
       watching the board sees ambient takes too — so the plate detects a take
       the way the board itself does, off the flash the model sets at the
       moment of the buy, and reads the payment off the model's own `paidAt`.
       The frame's Router deposit is shared between the takes in proportion to
       what each paid, so no constant is restated here and every width on the
       run is the model's own number. */
    interface Packet {
      /** real seconds since the take */
      age: number;
      slot: number;
      /** USDG, down to the Router */
      toRouter: number;
      /** the pending GBX this replacement minted, as a share of the board's
          largest pending balance at that instant — dimensionless, so the mark
          is the same fraction of a card at every breakpoint */
      gbxShare: number;
      /** GBX, up to the miner this take displaced */
      gbx: number;
      /** who was displaced. Null on a first fill: nobody is paid, and no
          GBX leaves the card. */
      displaced: string | null;
    }
    /* THE MINER IS A READOUT, NOT A FLOW. It holds the last payout the board
       made — who was displaced and the GBX they were minted — until the next
       take replaces it. The stream that fills it stays discrete: GBX is minted
       at replacement and at no other time, so a permanent connection would be
       a lie. Seeded from the model's own history through `narrate`, which is
       how the frozen mine reports a settled tenure. */
    const lastPayout = { who: '', gbx: 0 };
    /* ══ GBX MINTED — the emission curve, from zero ═══════════════════════
       THE MINE IS THE ONLY MINT AUTHORITY GBX HAS. docs/ECONOMICS.md: twenty
       million are created at genesis for liquidity and mint authority is then
       assigned permanently to Mine. And Mine mints at exactly one moment — a
       replacement settles the outgoing slot and mints it its accrual. So this
       series starts at ZERO, is flat between takes, and steps UP by exactly
       what a take minted, at the instant that take fires on the board below.
       It never eases and it never drifts: if it moved, a take moved it.

       WHY THIS IS NOT CIRCULATING SUPPLY. That is a different quantity and it
       has its own drawing, the bar at station 06: genesis plus everything ever
       minted minus everything ever burned, ~100,000,000 while the reader is
       here. A take mints about 0.006% of it, so against a zero-based axis it
       is a dead flat line — which is exactly what this board used to be, and
       it also meant the two readouts were drawing the same number twice. Two
       quantities, two places, and no readout that has to be both.

       WHY IT CAN NEVER BE BURNED DOWN. Cumulative issuance is monotone: a burn
       destroys GBX that was minted, it does not un-mint it. Station 06 draws
       the burn against the stock it actually reduces. This staircase only ever
       climbs, which is also why zero can stay pinned to the floor. */
    const emis = {
      /** the mine clock this board opened on; x is measured from here */
      t0: 0,
      /** GBX, cumulative — the model's own tally at t0, plus every riser the
          plate has DRAWN since */
      total: 0,
      /**
       * The y window, and the eased values the axis is actually drawn against.
       *
       * WHY THE AXIS IS WINDOWED AND NOT ZERO-BASED. Cumulative issuance never
       * comes down, so a floor pinned at zero has exactly one shape available
       * to it: the curve leaves the corner, climbs, and then — because the
       * ceiling has to keep growing to hold it — flattens against the top and
       * spends the rest of the reader's visit compressing. What the board is
       * for is the SHAPE of issuance: flat between takes, a riser at each one.
       * A window keeps that shape at full size for ever.
       *
       * WHY IT IS EASED. The base is the level the window OPENS at, and that
       * level steps whenever the left-hand edge crosses a riser — a real,
       * discrete change in what the box contains, but one that would jerk the
       * whole curve downward if it were applied on the frame it happened. The
       * ease turns the step into a glide, and it is the only easing on this
       * board: no drawn quantity rides it, only the frame around them.
       */
      lo: 0,
      hi: SLOT_HOURLY,
      loShown: 0,
      hiShown: SLOT_HOURLY,
    };
    /* THE STAIRCASE IS A TIME SERIES, NOT A LIST OF EVENTS. Indexed by event
       it drew every take the same distance apart, which says the board fires
       on a metronome; it does not. Sampled on the mine's own clock, a quiet
       stretch is a long flat run and a flurry is a tight flight of steps, and
       the line streams right at the rate the protocol actually issues. */
    const EMIS_CAP = 512;
    /* the origin is a real sample: the board opens at (0, 0) and the first
       frame draws the flat run leaving it, never an empty box */
    const emisHist: { x: number; v: number }[] = [{ x: 0, v: 0 }];
    function stepMinted(by: number): void {
      emis.total += by;
      emisHist.push({ x: mn.t - emis.t0, v: emis.total });
      /* BOUNDED, AND PRUNED FROM THE LEFT. Everything older than the window's
         opening edge is off the plate — except the one sample that brackets
         it, which is what sets the level the window opens at, so it is kept
         and everything behind it is dropped. */
      const edge = Math.max(0, mn.t - emis.t0 - EMIS_SPAN);
      while (emisHist.length > 2 && (emisHist[1]?.x ?? Infinity) <= edge) emisHist.shift();
      /* the backstop, for a window so quiet that nothing has aged out of it:
         drop every other INTERIOR sample rather than growing without bound */
      if (emisHist.length > EMIS_CAP) {
        for (let i = emisHist.length - 2; i > 0; i -= 2) emisHist.splice(i, 1);
      }
    }

    /**
     * The window the emission board is drawn in, advanced one frame.
     *
     * It is EXACTLY EMIS_SPAN wide at every instant. Before the board has that
     * much history the window still opens at zero and the head travels into
     * empty axis; afterwards the window slides and the head stays pinned to
     * the right-hand edge, which is what makes a chart that is always full of
     * staircase rather than one that is mostly floor.
     *
     * `dt <= 0` snaps instead of easing — the seed and the reduced-motion
     * still both need the frame they are about to draw, not the frame it was
     * on its way to from a previous reader's visit.
     */
    function frameWindow(dt: number): void {
      const now = Math.max(0, mn.t - emis.t0);
      const tA = Math.max(EMIS_SPAN, now) - EMIS_SPAN;
      let base = emisHist[0]?.v ?? 0;
      for (const p of emisHist) {
        if (p.x > tA) break;
        base = p.v;
      }
      /* the floor is one take's worth of issuance at minimum, so a window in
         which the board happened to be silent still draws a readable flat run
         instead of dividing by nothing */
      const rise = Math.max(SLOT_HOURLY * 0.25, emis.total - base);
      emis.lo = base - rise * 0.08;
      emis.hi = base + rise * 1.12;
      const k = dt <= 0 ? 1 : Math.min(1, dt * 3.2);
      emis.loShown += (emis.lo - emis.loShown) * k;
      emis.hiShown += (emis.hi - emis.hiShown) * k;
    }
    let seeding = true;
    const packets: Packet[] = [];
    /* ONE TAKE AT A TIME. Takes that land while one is still running wait
       here and are drawn in order. Nothing about the take is deferred — the
       frozen model bought at its own instant and at its own price; only the
       DRAWING waits, and with the mine's clock slowed the wait is usually
       nothing at all. Their deposits wait with them, so the Router still
       never rises without something visibly arriving. */
    const queued: Packet[] = [];
    const mineFx: MineFx = {
      narrate(_index, _buyer, displaced, _paid, _toMiner, _toRouter, accrued) {
        if (!seeding || displaced === null || accrued <= 0) return;
        lastPayout.who = displaced;
        lastPayout.gbx = accrued;
      },
    };
    warmStart(mn, mineFx);
    seeding = false;
    fillTheBoard();
    const flashWas = new Array<number>(SLOTS).fill(0);
    const minedWas = new Array<number>(SLOTS).fill(0);
    const ownerWas = new Array<string | null>(SLOTS).fill(null);
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
      /** a decaying memory of what a FULL load looks like — see routerCap */
      load: 0,
      /** the published ceiling of the vessel's own scale, eased like the fund's */
      cap: 24,
      capShown: 24,
      /** real seconds until route() is next called by nobody in particular */
      wait: ROUTE_MIN,
      open: 0,
      sinceRoute: 0,
    };
    /**
     * THE CELL'S SCALE IS WHAT A FULL LOAD LOOKS LIKE.
     *
     * Nothing prints this ceiling any more, so it has to be one the drawing
     * itself teaches. route() empties the Router completely every time it is
     * called, so a full load is simply what it was holding when that happened
     * — `router.load`, a decaying memory of the recent ones. Scaled to that,
     * the cell fills from empty to nearly full across every cycle and every
     * deposit is a step the eye can see.
     *
     * The fixed $24 ceiling it replaces was legible only while a figure was
     * printed beside it: measured over a cycle, an ordinary load filled three
     * pixels of a fifty-eight pixel cell, so a reader with no numbers left to
     * read saw an empty box flash at them.
     *
     * SO THE CELL IS A RELATIVE READING and the plate does not pretend
     * otherwise: how full the Router is against a normal load. The ABSOLUTE
     * amount has its own mark one station down — the outlet band's width is
     * `widthOf(gStock, lastRouted)`, a real quantity at the plate's published
     * gauge. One mark for the rhythm, one for the size.
     *
     * `held` stays in the max so a cycle larger than usual cannot overflow its
     * own cell — at a smaller multiplier than `load`, so it reads nearer the
     * brim rather than rescaling away the fact that it was a big one.
     */
    function routerCap(): number {
      return Math.max(0.75, router.load * 1.15, router.held * 1.05);
    }

    /* Ambient takes deposit too, and they are not narrated — so the Router's
       level would otherwise rise with nothing visibly arriving. Every booking
       lights the cell: nothing appears without a mechanism.

       THE LIGHT IS AN AGE, NOT A COUNTDOWN, so it runs on `takeAlpha` — the
       one envelope every discrete event on this plate is drawn with. It was a
       half-second linear blink, which put the station where money STOPS on a
       clock seven times shorter than the payment that landed in it: the card
       that paid was still lit and the tank it paid was already dark. Two marks
       for two halves of one event now hold for the same length of time. */
    let dripAge = TAKE_FADE;
    /* ══ THE LEVEL MOVES WITH THE LIGHT ═══════════════════════════════════
       THE DEFECT THIS FIXES. A deposit stepped the level in a single frame and
       THEN lit the cell for three and a half seconds, so the light was a
       decoration on something that had already finished happening — the tank
       flashed at a level that had not moved since. The rise now runs the
       arrival's own envelope, so the cell is lit exactly while it is filling,
       and the fall runs route()'s, so it empties exactly while the outlet is
       carrying it away.

       NO UNIT IS INVENTED. Both ends of every move are the model's own
       `router.held`; the only thing eased is how long the eye is given to
       watch it get there. `held` itself still steps at the instant it is
       booked, and every figure derived from it is still derived from it. */
    const level = { shown: 0, from: 0, age: 0, dur: TAKE_FADE };
    function moveLevel(dur: number): void {
      level.from = level.shown;
      level.age = 0;
      level.dur = dur;
    }

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
    /* ══ WHEN EACH AUCTION CLEARS ═════════════════════════════════════════
       Every pot runs its own auction on its own clock: the frozen model holds
       the instant it next clears in `epochEnd` and moves it on the frame it
       fires. The plate keeps the other end — where the current epoch STARTED —
       because an ask has to be drawn falling from somewhere, and that is the
       one fact the model does not carry. It is read off the model's own
       transitions, never invented: `epochEnd` changing IS the clearing. */
    const aucFrom = ASSET_HUES.map(() => 0);
    const aucEndWas = ASSET_HUES.map(() => 0);
    /* Called from EVERY place the resonance model is advanced — the live step,
       the seed's own warm-up and the reduced-motion still — so the four asks
       open part-way through four different epochs instead of in lockstep at
       the top of their cells, which is what four blades all reset on the same
       frame looks like. */
    function trackEpochs(): void {
      rz.assets.forEach((a, i) => {
        if (a.epochEnd !== aucEndWas[i]) {
          aucEndWas[i] = a.epochEnd;
          aucFrom[i] = rz.flow.t;
        }
      });
    }

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

    function buildLayout(): Layout {
      const w = view.w;
      const h = view.h;
      const narrow = w < 720;
      const mid = w < 1024;
      const pad = narrow ? 14 : 26;
      const inner = w - pad * 2;

      /* HEAD_H is the breath at the top of every station. There are no rules
         between the stations any more — the flow paths carry the eye from one
         to the next, and a ruled boundary only cut the machine into slices —
         so this is a gap and nothing else. */
      const HEAD_H = 8;

      /* Six stations and nothing else. The head's gauge block, the break, the
         conservation ledger and the key are all gone; the only fixed height
         left is the plate's own padding, and the six stations share the rest
         by weight with a floor that is the sum of each one's reserved rows.
         Nothing is ever cut by its own container. */
      const fixed = pad * 2;

      const cgap = narrow ? 10 : 22;
      /* the card is four rows now the price ramp has gone: number, owner,
         price, and the clock with its pending GBX */
      const chMin = narrow ? 66 : 68;
      /* the payment's reserved rows, below the board: its descent, and the row
         it traverses to the spine on */
      const forkH = (narrow ? 34 : 30) + (narrow ? 16 : 13);
      /* the row above the board: the MINER, a box the size of a slot card and
         spaced clear above row 1, and the corridor the GBX a take mints
         crosses to reach it */
      /* the box is a peer of the sixteen cards: the same width and the same
         height, so the grid keeps its rhythm. It says less, so its content is
         spread through that height rather than clustered at the top. */
      const minerH = chMin + 24;
      const riseH = minerH + (narrow ? 30 : 40);
      const mineMin = HEAD_H + riseH + (chMin * 4 + cgap * 3) + 16 + forkH;
      const flex: { k: 'mine' | 'router' | 'stream' | 'auc' | 'fund' | 'you'; w: number; min: number }[] = [
        { k: 'mine', w: 32, min: mineMin },
        { k: 'router', w: 10, min: HEAD_H + (narrow ? 150 : 120) },
        { k: 'stream', w: 14, min: HEAD_H + (narrow ? 130 : 120) },
        { k: 'auc', w: 20, min: HEAD_H + (narrow ? 275 : 230) },
        { k: 'fund', w: 10, min: HEAD_H + (narrow ? 175 : 165) },
        /* PARKED WITH ITS STATION. While station 06 is not painted its band
           must not go on reserving height, or the plate ends in a quarter of a
           screen of nothing. Restoring the station is restoring this weight
           and the `paintYou(l)` call together. */
        { k: 'you', w: 0, min: 0 },
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
      const mine = band(hs.mine ?? 640);
      const router = band(hs.router ?? 210);
      const stream = band(hs.stream ?? 270);
      const auc = band(hs.auc ?? 360);
      const fund = band(hs.fund ?? 234);
      const you = band(hs.you ?? 240);

      /* ---- the mine board: sixteen cells, always four across ------------
         The board takes the whole width now the GBX collector has gone, and
         the gutters are wide enough that a payment descending from the card
         that made it is visible between the rows it passes. */
      const gridW = inner;
      const cw = (gridW - cgap * 3) / 4;
      /* the board sits a rise clear of its own station line, because that is
         the row the GBX a take mints climbs into */
      const gridTop = mine.y0 + HEAD_H + riseH;
      /* ---- THE PAYMENT'S RESERVED ROWS, bottom-up from the station's foot.
         Each is a row nothing else is allowed into, which is what lets the leg
         run VERTICALLY for its whole length: a stroke's width is
         perpendicular, so a vertical leg is drawn at exactly its quantity. */
      const headerY = mine.y1 - (narrow ? 16 : 13);
      const gridBot = headerY - (narrow ? 34 : 30);
      const landY = router.y0 + HEAD_H + 12;
      const ch = Math.max(52, (gridBot - gridTop - cgap * 3) / 4);

      /* ---- the four lanes, in a fixed and permanent order --------------- */
      const laneW = inner / 4;
      const bays: Bay[] = ASSET_HUES.map((a, i) => ({ cx: pad + laneW * (i + 0.5), sym: a.sym, hue: a.hue }));

      /* ---- the stream ---------------------------------------------------- */
      const trunkY0 = stream.y0 + HEAD_H + 22;
      const trunkY1 = trunkY0 + 46;
      /* THE ROUTER SITS ON THE STREAM. It used to end well above the trunk with
         an empty route between them, and once both were the same width that
         gap was just a rectangle of black between two rectangles of blue —
         the connection stated by an absence. The reservoir's floor IS the
         trunk's ceiling now, so the two read as one column, and route() has
         its own mark on the join instead of its own strip of nothing. */
      const routerVy = router.y0 + HEAD_H + 16;
      const routerVh = Math.max(58, trunkY0 - routerVy);

      /* ---- the auctions -------------------------------------------------- */
      const aucTop = auc.y0 + HEAD_H + 10;
      /* A lane does not stop short of the thing it fills. It runs from the
         splitter onto the bucket's mouth in one piece, crossing station 04's
         rule — which is therefore drawn in the gutters BETWEEN the bands,
         with the station's tag in the middle gutter, the way a plant drawing
         steps a section line around a pipe rather than through it. */
      const laneLandY = aucTop;
      const laneLabelY = aucTop - 50;
      /* EVERY ROW BELOW THE BUCKETS IS RESERVED, bottom-up, and each one is
         wide enough for the type it carries. Rows, not offsets. */
      const yBack = auc.y1 - (narrow ? 26 : 22);
      const yOut = yBack - (narrow ? 26 : 30);
      /* ---- THE BUYER, one box for all four auctions ----------------------
         A peer of the MINER box at the head of the plate, and for the same
         reason: a party that is paid and pays back has to be a THING, not a
         turn in a pipe. Four little squares said "the line bends here"; a box
         says "somebody is on the other side of this trade". One of them, not
         four, because there is one market — every auction sells into it, and
         the plate has no model for who is buying. */
      const buyerW = narrow ? Math.min(inner * 0.5, 150) : Math.min(inner * 0.22, 240);
      const buyerH = narrow ? 40 : 46;
      const aucValY = yOut - (narrow ? 30 : 24); // the bucket readings
      const aucH = Math.max(48, aucValY - (narrow ? 22 : 18) - aucTop);

      /* ---- the fund and the claim ---------------------------------------- */
      const bayTop = fund.y0 + HEAD_H + 14;
      /* centred in the run between the buckets' floor and the bays' mouths, so
         both legs of every trade are the same length and neither reads as the
         important one */
      const buyerY = (aucTop + aucH + (bayTop - 6) - buyerH) / 2;
      const bayBot = fund.y1 - (narrow ? 42 : 44);
      /* stock and flow, in that order down the page: the mint arrives from
         above, the supply bar is the stock, the burn leaves below. Both flows
         are anchored on the bar's HEAD, which is the only place supply moves. */
      const mintY = you.y0 + HEAD_H + (narrow ? 26 : 20);
      const supplyY = mintY + (narrow ? 34 : 38);
      const burnY0 = supplyY + (narrow ? 22 : 20);
      const burnY1 = burnY0 + (narrow ? 36 : 32);
      const collectY = you.y1 - (narrow ? 22 : 18);
      /* THE FOUR CLAIM BANDS MERGE ONTO THE SPINE IMMEDIATELY. Fanning them
         across the whole width all the way down to the collector put the
         leftmost one straight through the GBX supply bar; merged at the top of
         the station they travel as one stack down the middle. */
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
        gLot,
        potCap,
        mine,
        router,
        stream,
        auc,
        fund,
        you,
        cw,
        ch,
        cgap,
        gridX: pad,
        gridW,
        gridTop,
        gridBot,
        minerY: mine.y0 + HEAD_H,
        minerH,
        headerY,
        landY,
        routerVy,
        routerVh,
        /* THE SAME WIDTH AS THE STREAM BELOW IT, and not by coincidence: the
           trunk is `gFlow × rate` and the stream's rate is a constant of the
           model, so the trunk is always exactly `inner × 0.32` wide. The
           reservoir is set from the same expression, so the two can never
           drift apart at a breakpoint nobody measured. */
        routerVw: inner * 0.32,
        routerOutY: router.y1 - (narrow ? 44 : 26),
        buyerW,
        buyerH,
        buyerY,
        trunkY0,
        trunkY1,
        laneLandY,
        laneLabelY,
        aucTop,
        aucH,
        aucValY,
        yOut,
        yBack,
        bayTop,
        bayBot,
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
      burnNeutral: null as { band: Path2D } | null,
      pipes: [] as Path2D[],
      /* THE TAKES IN FLIGHT, one stroked orthogonal run each. */
      runs: [] as {
        /** 0..1 — how far through its one envelope this take is */
        p: number;
        /** where the USDG run leaves the card that made it */
        top: number;
        c: number;
        w: number;
        path: Path2D;
        fade: number;
        /** and the GBX going the other way: out of the card, up to the miner */
        up: Path2D | null;
        upLen: number;
        upW: number;
      }[],
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
      /** the slot closest to being taken, off the model's own take condition */
      imminent: -1,
      /** the emission staircase: the stroked line, and the same shape closed
          down to the zero line so the stock reads as an accumulation rather
          than as a signal trace */
      emisLine: null as Path2D | null,
      emisArea: null as Path2D | null,
      /** the leading edge, so the head can be marked where it actually is */
      emisHeadX: 0,
      emisHeadY: 0,
      /** the protocol seconds the x axis spans, and the level it opens at */
      emisSpan: 0,
      emisBase: 0,
      /** where the band is proportioned: the framed run, and the seams in it */
      comb: {
        on: false,
        x0: 0,
        x1: 0,
        y0: 0,
        y1: 0,
        cuts: [] as { x: number; glow: number }[],
      },
      /** the fund's four slice widths, px, and their bays' drawn stock, px */
      slice: [0, 0, 0, 0],
      stock: [0, 0, 0, 0],
      burnW: 0,
    };
    let pipeKey = '';
    let pipeCache: Path2D[] = [];

    /**
     * WHERE A BUCKET'S BUYER STANDS. Out on one side, so the leg that leaves
     * and the leg that comes back are two visibly different runs rather than
     * one line drawn over itself. Defined once: the resting route and the live
     * bands both read it, so a band can never miss the pipe it runs in.
     */
    function traderOf(l: Layout, _cx: number, i: number): number {
      /* four landings across the buyer's face, in the buckets' own order, so
         the outer lanes' legs never cross the inner lanes' */
      const step = l.buyerW / 5;
      return l.cx - l.buyerW / 2 + step * (i + 1);
    }

    /** a straight run in flow space: x is DOWN, c is ACROSS. */
    function run(key: string, gauge: number, x0: number, x1: number, c: number, q: number): Ribbon {
      return ribbon(key, gauge, [
        { x: x0, c, q },
        { x: x1, c, q },
      ]);
    }

    /**
     * A straight band between two points that are not on the same centreline.
     *
     * `ribbon` interpolates its stations with a monotone curve, which is right
     * for a stream dividing — fluid does not turn corners — and wrong for an
     * exchange, where it drew a lazy S between a bucket and its buyer that
     * looked like a decoration rather than a leg. Sampling the straight line
     * gives the curve collinear stations to pass through, so it has nothing
     * left to bend, and every mark below the buckets is straight.
     */
    function leg(key: string, gauge: number, a: Station, b: Station, steps = 8): Ribbon {
      const st: Station[] = [];
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        st.push({ x: a.x + (b.x - a.x) * t, c: a.c + (b.c - a.c) * t, q: a.q + (b.q - a.q) * t });
      }
      return ribbon(key, gauge, st);
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

      /* WHICH SLOT FIRES NEXT. Read straight off the schedule, which is the
         same fact the take itself fires from — so the card that is lit and
         the card that flashes cannot disagree. */
      F.imminent = sched.slot;

      /* ══ THE EMISSION STAIRCASE ═══════════════════════════════════════════
         FLAT RUNS AND VERTICAL RISERS, NEVER A CURVE. A smoothed line would
         draw GBX appearing steadily between takes, and that is precisely what
         does not happen: accrual is a promise the slot is carrying, and the
         MINT is the settlement. Each riser is one take, and its height is
         exactly the GBX that take minted.

         IT IS A ROLLING WINDOW, NOT A HISTORY. Both axes are windowed to the
         last EMIS_SPAN of the mine's own clock, so the board looks the same
         after an hour as it does on the first frame: a flight of stairs, at
         full size, crossing the box. A chart anchored at the origin can only
         do that once — it leaves the corner, climbs, and then compresses
         under a ceiling that has to keep growing to hold it, until it is a
         line lying along the top of its own box.

         AND IT STREAMS. x is the mine's own clock, so a quiet board draws a
         long flat run and a flurry draws a tight flight, and the head advances
         at the rate the protocol actually issues. Older risers leave at the
         left as new ones arrive at the right. */
      {
        const bw = l.cw;
        const sx = l.gridX + bw + l.cgap;
        const sw = l.gridW - bw - l.cgap;
        const ip = l.narrow ? 4 : 6;
        const x0 = sx + ip;
        const x1 = sx + sw - ip;
        /* the base rule sits above the foot row, which carries what the window
           opens at and how wide it is; the head clears the title row */
        const y0 = l.minerY + 24;
        const y1 = l.minerY + l.minerH - (l.narrow ? 15 : 16);
        const now = Math.max(0, mn.t - emis.t0);
        const tA = Math.max(EMIS_SPAN, now) - EMIS_SPAN;
        const lo = emis.loShown;
        const hi = Math.max(lo + 1e-6, emis.hiShown);
        F.emisSpan = EMIS_SPAN;
        F.emisBase = lo;
        F.emisLine = null;
        F.emisArea = null;
        if (x1 > x0 + 10 && y1 > y0 + 6) {
          const xOf = (t: number) => x0 + ((x1 - x0) * Math.max(0, t - tA)) / EMIS_SPAN;
          /* clamped to the box: the window eases and the series does not, so a
             riser can briefly outrun its own frame. It flattens against the
             edge for those few frames rather than drawing outside the cell. */
          const yOf = (v: number) =>
            Math.max(y0, Math.min(y1, y1 - ((v - lo) / (hi - lo)) * (y1 - y0)));
          const line = new Path2D();
          const area = new Path2D();
          /* THE LINE ENTERS THE BOX AT THE LEVEL THE WINDOW OPENS AT — the
             last riser to have scrolled off the left, carried in flat. */
          let level = emisHist[0]?.v ?? 0;
          let from = 0;
          emisHist.forEach((p, i) => {
            if (p.x <= tA) {
              level = p.v;
              from = i;
            }
          });
          line.moveTo(x0, yOf(level));
          area.moveTo(x0, y1);
          area.lineTo(x0, yOf(level));
          for (let i = from + 1; i < emisHist.length; i++) {
            const p = emisHist[i];
            if (p === undefined) continue;
            const px = xOf(p.x);
            /* the run out to the riser, then the riser itself */
            line.lineTo(px, yOf(level));
            line.lineTo(px, yOf(p.v));
            area.lineTo(px, yOf(level));
            area.lineTo(px, yOf(p.v));
            level = p.v;
          }
          /* THE HEAD IS NOW, NOT THE LAST EVENT. Carrying the level out to the
             clock's own position is what makes the wait between takes visible
             — the flat run grows in front of the reader, and the next riser
             lifts off the end of it. */
          const hx = xOf(now);
          const hy = yOf(emis.total);
          line.lineTo(hx, hy);
          area.lineTo(hx, hy);
          area.lineTo(hx, y1);
          area.closePath();
          F.emisLine = line;
          F.emisArea = area;
          F.emisHeadX = hx;
          F.emisHeadY = hy;
        }
      }

      F.streamBands.length = 0;
      F.aucBands.length = 0;
      F.claimBands.length = 0;
      F.burnNeutral = null;

      /* ---- static plant: every route drawn as a hairline, so a shut leg
         reads as an empty pipe rather than as a hole in the composition ---- */
      const key = l.w + ':' + l.h;
      if (pipeKey !== key) {
        pipeCache = [];
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
        pipeKey = key;
      }
      F.pipes = pipeCache;

      /* ══════════════════════════ S1 · the mine payment ════════════════════
         A payment is a discrete allocation, not a stream, and on this plate it
         has one destination: the Router. It leaves the card that was taken.

         THE ROUTE IS ORTHOGONAL AND THE WIDTH IS A STROKE. The leg runs
         VERTICALLY where its width has to be read, so the width a reader
         measures — the perpendicular one — is exactly `q x gauge`. */
      F.runs.length = 0;
      packets.forEach((p) => {
        const cell = cellBox(l, p.slot);
        const from = cell.x + l.cw / 2;
        const wRt = widthOf(F.gStock, p.toRouter);
        /* the run is drawn where the money is, unless that would put a band
           through the frame — nothing is ever cut by its own container */
        const lo = l.pad + wRt / 2;
        const hi = l.w - l.pad - wRt / 2;
        const cRt = lo > hi ? l.cx : Math.max(lo, Math.min(hi, from));
        /* IT LEAVES THE CARD THAT MADE IT. The run starts at the foot of the
           slot that was taken, crosses the rows below it in the board's own
           gutters — the cards are opaque and painted after, so it shows only
           between them — and then runs on down into the Router. */
        const top = cell.y + l.ch;
        const rtPts: Pt[] = [
          { x: from, y: top },
          { x: from, y: l.gridBot },
          { x: cRt, y: l.headerY },
          { x: l.cx, y: l.headerY },
          { x: l.cx, y: l.landY },
        ];
        /* AND GBX THE OTHER WAY. A replacement mints the pending balance that
           was showing on the card to the miner it DISPLACED, and the card's
           figure steps to zero in the same instant. So one event sends USDG
           down to the Router and GBX up to the miner who was replaced:
           neutral, thin, discrete, and gone. It rises out of the card,
           crosses the rows above it in the board's own gutters — the cards
           are opaque and painted after, so it shows only between them — and
           lands on the miner marker above the board. A first fill displaces
           nobody, so nothing goes up. */
        const foot = l.minerY + l.minerH;
        const cross = foot + (l.narrow ? 16 : 22);
        const toMiner = l.gridX + l.cw / 2;
        let upLen = 0;
        const upPts: Pt[] = [
          { x: from, y: cell.y },
          { x: from, y: cross },
          { x: toMiner, y: cross },
          { x: toMiner, y: foot },
        ];
        for (let k = 1; k < upPts.length; k++) {
          const a = upPts[k - 1];
          const b2 = upPts[k];
          if (a && b2) upLen += Math.abs(b2.x - a.x) + Math.abs(b2.y - a.y);
        }
        /* ONE progress, ONE alpha, three consumers */
        const t = Math.min(1, p.age / TAKE_FADE);
        const travel = Math.min(1, t / TAKE_ARRIVE);
        const alpha = takeAlpha(p.age);
        F.runs.push({
          p: travel,
          top,
          c: cRt,
          w: wRt,
          path: pipePath(rtPts, Math.min(14, Math.max(3, wRt * 0.55))),
          fade: alpha,
          up: p.gbx > 0 ? pipePath(upPts, 0) : null,
          upLen,
          upW: Math.max(1.5, p.gbxShare * l.cw * 0.05),
        });
      });

      /* ═══════════════════ S3 · the stream, split by signal ════════════════
         Everything below the Router is a rate in USDG/s, and the four lane
         widths always sum to the trunk. */
      const total = totalStake(rz);
      const rate = rz.flow.t < rz.flow.finish ? rz.flow.rate : 0;
      F.comb.on = false;
      if (rate > 0) {
        const trunk = run('stream', l.gFlow, l.trunkY0, l.trunkY1, l.cx, rate);
        F.streamBands.push({ path: ribbonPath(trunk), ink: USDG });
        /* ── THE SPLIT STEPS, AND THEN IT TRAVELS ──────────────────────────
           Signalling and unsignalling are discrete: a weight holds still and
           then JUMPS, and the blades below jump with it. What is not instant
           is the arrival. Fluid already past the blades is still carrying the
           old split, so each channel is genuinely tapered for a beat — the new
           share where it is cut, last week's where it lands.

           BOTH ENDS ARE THE FROZEN MODEL'S OWN. `disp` is the weight AT the
           blades; `chain[NODES]` is the far end of the model's own transport
           chain, which is the weight that has actually reached the vessel. The
           plate does not interpolate between them — it reads both and hands
           them to `splitFlow` as `q` and `qTo`.

           The numerator and the denominator are now the same quantity, which
           they were not: shares were taken as `stake / Σdisp`, a live weight
           over a lagged total, so during a move they did not sum to one and
           the residual leg silently absorbed the difference. */
        const tailTotal = rz.assets.reduce((n, a) => n + (a.chain[NODES] ?? a.disp), 0) || 1;
        /* the residual goes on the last leg, exactly the way the contracts
           allocate it (`toRouter = paid − toMiner`), so the sum is exact in
           floating point rather than nearly exact */
        let acc = 0;
        let accTo = 0;
        const legs = rz.assets.map((a, i) => {
          const last = i === rz.assets.length - 1;
          const q = last ? rate - acc : rate * (a.disp / total);
          const qTo = last ? rate - accTo : rate * ((a.chain[NODES] ?? a.disp) / tailTotal);
          acc += q;
          accTo += qTo;
          return { key: a.sym, q, qTo, to: { x: l.laneLandY, c: l.bays[i]?.cx ?? l.cx } };
        });
        const at: Station = { x: l.trunkY1, c: l.cx, q: rate };
        const fan = splitFlow({ gauge: l.gFlow, at, legs, steps: 18 });
        fan.forEach((r) => F.streamBands.push({ path: ribbonPath(r), ink: USDG }));

        /* ── WHERE THE BAND IS PROPORTIONED ────────────────────────────────
           TWO MARKS TRIED AND DROPPED. A pink spine with blades hanging off it
           is the Resonance section's comb, and it does not survive the move:
           there the stream is tall and horizontal and the comb is a real
           object across it; here it was a hairline scratched over the widest
           blue in the drawing. A dark block was worse — a slab lying on the
           brightest thing on the plate, reading as a hole in it.

           SO THERE IS NO OBJECT. The band divides itself: the last stretch of
           the trunk carries a seam on each boundary, and the four widths
           between them ARE the four shares, on the same cumulative sums
           `splitFlow` lays the legs out from. Nothing is added to the drawing
           to say where the split is — something is taken away, at exactly the
           three places it happens, and each seam runs on into the gap its own
           two channels open as they part.

           THE SEAMS ARE ALWAYS THERE. A boundary that only appears while it is
           moving is a boundary that is invisible almost all of the time, and
           the split is a standing fact, not an event. What is an event is a
           boundary MOVING, and that lights its own seam pink for as long as
           the model says it is moving. */
        const bandW = rate * l.gFlow;
        const cx0 = l.cx - bandW / 2;
        F.comb.on = true;
        F.comb.x0 = cx0;
        F.comb.x1 = cx0 + bandW;
        /* THE FRAMED RUN IS THE TRUNK ITSELF, top rail to bottom rail. Three
           horizontal lines were appearing in forty-six pixels of band — the
           gate, then a frame inside it — and they read as a stack of boxes.
           There are two: the gate the load passes, and the face the channels
           leave from. Everything between them is the run the split happens in,
           which is what the trunk always was. */
        F.comb.y0 = l.trunkY0;
        F.comb.y1 = l.trunkY1;
        F.comb.cuts.length = 0;
        let cumB = 0;
        for (let i = 0; i < legs.length - 1; i++) {
          const a = legs[i];
          if (a === undefined) continue;
          cumB += a.q;
          const av = rz.assets[i];
          const bv = rz.assets[i + 1];
          F.comb.cuts.push({
            x: cx0 + cumB * l.gFlow,
            /* the model's own `moved × emph`: full for the scripted signal, a
               fraction of it for a holder drifting on their own clock */
            glow: Math.max(
              (av?.moved ?? 0) * (av?.emph ?? 0),
              (bv?.moved ?? 0) * (bv?.emph ?? 0),
            ),
          });
        }
      } else {
        /* between weeks — the resting channels are drawn by the station, and
           there is no comb: a comb across an empty channel would be drawing
           a split of nothing */
      }

      /* ════════════════════ S4 · the auction: an exchange ══════════════════
         The lot leaves as USDG and the asset comes back. The plate does not
         claim a unit conversion it has no price for: the asset band is drawn
         on the same gauge as the USDG that bought it — the trade IS the
         price — and what lands in the bay is the model's own net of a fill. */
      flush.forEach((f, i) => {
        if (f.age >= 1 || f.lot <= 0) return;
        const bay = l.bays[i];
        if (!bay) return;
        const hue = hueOf(i);
        const lot = f.lot;
        const toFund = lot * (1 - BRIBE);
        /* THE TRADE IS AN EXCHANGE, not a recolour in place. Blue USDG leaves
           the bucket and goes OUT to a trader; an asset hue comes BACK the
           other way. Both legs carry the same width because the trade IS the
           price: the asset band is drawn on the gauge of the USDG that bought
           it, which is the only claim the plate has a model for. */
        /* the trade lands on the buyer's own face, offset from the spine on
           the side its bucket sits, so the leg that pays and the leg that
           delivers are two visibly different runs rather than one drawn twice */
        const traderC = traderOf(l, bay.cx, i);
        const outR = leg(
          'out' + i,
          l.gLot,
          { x: l.aucTop + l.aucH + 4, c: bay.cx, q: lot },
          { x: l.buyerY, c: traderC, q: lot },
        );
        /* IT IS A SALE, AND IT IS TWO LEGS. Blue out of the bucket to the
           buyer, the asset back from the buyer into the fund — straight, and
           straight into the BAY, not down to a turn above it and then down
           again. The third segment was what made this read as a zig-zag: a
           leg that goes somewhere and then a leg that corrects for it. */
        const backR = leg(
          'back' + i,
          l.gLot,
          { x: l.buyerY + l.buyerH, c: traderC, q: toFund },
          { x: l.bayTop - 6, c: bay.cx, q: toFund },
        );
        F.aucBands.push({ path: ribbonPath(outR), ink: USDG });
        F.aucBands.push({ path: ribbonPath(backR), ink: hue });
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

    /**
     * A take, detected off the board itself. The model sets a slot's flash to
     * 1 at the instant of the buy and sets `paidAt` to what was paid, so a
     * flash that has just gone back up IS a take. The frame's Router deposit
     * is shared between the takes in proportion to what each paid, which is
     * exact — every take on this board is allocated the same way — and keeps
     * the split a figure of the frozen model rather than a constant restated
     * here.
     */
    function spawnTakes(depositsBefore: number, mintedBefore: number): void {
      const gained = mn.routerDeposits - depositsBefore;
      let paidSum = 0;
      let pendSum = 0;
      let pendTop = 0;
      const fired: number[] = [];
      mn.slots.forEach((_sl, i) => {
        const f = mn.flash[i] ?? 0;
        if (f > (flashWas[i] ?? 0) + 1e-9) {
          fired.push(i);
          paidSum += mn.paidAt[i] ?? 0;
          pendSum += minedWas[i] ?? 0;
        }
        flashWas[i] = f;
        pendTop = Math.max(pendTop, minedWas[i] ?? 0);
      });
      if (fired.length > 0) replan();
      if (gained <= 0 || paidSum <= 0) return;
      /* the GBX side: `totalMined` moved by exactly the accrual this
         replacement minted to the outgoing miner, and the card's own figure
         stepped to zero in the same instant */
      const minted = mn.totalMined - mintedBefore;
      fired.forEach((i) => {
        const paid = mn.paidAt[i] ?? 0;
        if (paid <= 0) return;
        const pend = minedWas[i] ?? 0;
        const gbx = pendSum > 0 ? (minted * pend) / pendSum : 0;
        /* THE OUTGOING MINER IS PAID, NOT THE INCOMING ONE. `ownerWas` is who
           held the slot when the frame began; the card now names whoever took
           it. On a first fill there is nobody to pay and nothing leaves. */
        const displaced = ownerWas[i] ?? null;
        /* THE NUMBERS STEP HERE, at the instant of the take, and never ease */
        if (displaced !== null && gbx > 0) {
          lastPayout.who = displaced;
          lastPayout.gbx = gbx;
          stepMinted(gbx);
        }
        queued.push({
          age: 0,
          slot: i,
          toRouter: (gained * paid) / paidSum,
          gbxShare: displaced === null ? 0 : pendTop > 0 ? Math.max(0, Math.min(1, gbx / pendTop)) : 0,
          gbx: displaced === null ? 0 : gbx,
          displaced,
        });
      });
    }

    /* ═══════════════ ONE SCHEDULE, ONE SOURCE OF TRUTH ═══════════════════
       docs/MODELS.md: the taker's reservation and its dwell are choreography,
       not Mine rules, and occupied tenures are already staggered to prevent
       lockstep. So the plate keeps ONE fact — which slot fires next, and when
       — and everything reads off it. The highlighted card IS `sched.slot`; it
       is not predicted, inferred or recomputed, so the card that is lit and
       the card that flashes cannot disagree.

       Nothing is faked and nothing is deferred. Every reservation is set to a
       price the slot's own decay curve genuinely reaches — `reserve =
       initialPrice x (1 - targetElapsed / DECAY)` — so the take still fires
       through the model's own `priceOf(slot) <= slot.reserve`, at exactly the
       price the model would have produced at that instant. */
    const sched = { slot: -1, at: 0 };
    function replan(): void {
      const now = mn.t;
      /* the latest any slot can wait: at elapsed = DECAY its price is zero and
         it will be taken whatever its reservation says */
      let deadline = Infinity;
      mn.slots.forEach((sl) => {
        if (sl.owner === null || sl.owner === 'you') return;
        deadline = Math.min(deadline, sl.startedAt + DECAY);
      });
      let want = now + (5 + Math.random() * 5) * TS_MINE;
      if (want > deadline) want = Math.max(now + TS_MINE, deadline - TS_MINE);
      /* the oldest tenure goes next — a rotation, and the one the board would
         reach first on its own. A slot still inside the model's own minimum
         tenure at that moment cannot be chosen. */
      let pick = -1;
      let oldest = Infinity;
      mn.slots.forEach((sl, i) => {
        if (sl.owner === null || sl.owner === 'you' || sl.initialPrice <= 0) return;
        if (want - sl.startedAt <= 260) return;
        if (sl.startedAt < oldest) {
          oldest = sl.startedAt;
          pick = i;
        }
      });
      if (pick < 0) return;
      sched.slot = pick;
      sched.at = want;
      mn.slots.forEach((sl, i) => {
        if (sl.owner === null || sl.initialPrice <= 0) return;
        /* the chosen slot's curve reaches its reservation exactly at `want`;
           every other slot's reaches its own only afterwards */
        const target = i === pick ? want : want + (2 + (i % 6)) * TS_MINE;
        const elapsed = Math.min(DECAY, Math.max(0, target - sl.startedAt));
        sl.reserve = sl.initialPrice * (1 - elapsed / DECAY);
      });
    }

    /** the board as it stood before this frame's step, for the two deltas above */
    function markBoard(): void {
      mn.slots.forEach((sl, i) => {
        minedWas[i] = sl.mined;
        ownerWas[i] = sl.owner;
      });
    }

    /* ═══════════════════════════════════════════════════════ the step ══════ */
    function step(dt: number): void {
      if (!resize()) return;
      if (!L) {
        L = buildLayout();
      }
      const l = L;

      /* each model on the clock it was written for */
      const depositsBefore = mn.routerDeposits;
      const mintedBefore = mn.totalMined;
      markBoard();
      stepMine(mn, dt * TS_MINE, mineFx);
      spawnTakes(depositsBefore, mintedBefore);
      /* the emission board's window, advanced after the takes it holds */
      frameWindow(dt);
      stepResonance(rz, dt * TS_RZ, {});
      trackEpochs();
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
         and has finished travelling, and never invents a unit. A payment is
         held back until its stream lands, so the level rises when the drawing
         says it does. */
      let inFlight = 0;
      for (let k = packets.length - 1; k >= 0; k--) {
        const p = packets[k];
        if (p === undefined) continue;
        p.age += dt;
        if (p.age >= TAKE_FADE) packets.splice(k, 1);
        else inFlight += p.toRouter;
      }
      /* the queue never grows without bound: past four waiting takes the
         oldest is let go undrawn rather than drawn minutes after it happened,
         and its deposit books at the inlet drip like any ambient take */
      while (queued.length > 4) queued.shift();
      if (packets.length === 0) {
        const next = queued.shift();
        if (next !== undefined) packets.push(next);
      }
      queued.forEach((q) => (inFlight += q.toRouter));
      const arrived = mn.routerDeposits - inFlight;
      if (arrived > router.bookedIn + 1e-12) {
        router.held += arrived - router.bookedIn;
        router.bookedIn = arrived;
        dripAge = 0;
        moveLevel(TAKE_FADE);
      } else if (dripAge < TAKE_FADE) dripAge = Math.min(TAKE_FADE, dripAge + dt);
      router.sinceRoute += dt;
      if (router.open > 0) {
        router.open = Math.max(0, router.open - dt);
      } else if (router.sinceRoute >= router.wait && router.held > 0) {
        router.lastRouted = router.held;
        router.load = router.load > 0 ? router.load + (router.held - router.load) * 0.4 : router.held;
        router.outTotal += router.held;
        router.held = 0;
        router.open = ROUTE_OPEN;
        router.sinceRoute = 0;
        router.wait = ROUTE_MIN + Math.random() * ROUTE_VAR;
        /* it empties over exactly as long as the outlet is drawn carrying */
        moveLevel(ROUTE_OPEN);
      }
      /* the drawn level, travelling to the model's own `held` over the length
         of whichever event last moved it */
      level.age += dt;
      const lp = level.dur <= 0 ? 1 : Math.min(1, level.age / level.dur);
      level.shown = level.from + (router.held - level.from) * ease(lp);
      const capWant = routerCap();
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

    function label(
      text: string,
      x: number,
      y: number,
      size = 10,
      colour = ink.muted,
      align: CanvasTextAlign = 'left',
    ): number {
      ctx.font = mono(size, 500);
      ctx.fillStyle = colour;
      ctx.textAlign = align;
      ctx.fillText(text, x, y);
      return ctx.measureText(text).width;
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

    /**
     * Two CSS colours mixed, as a solid.
     *
     * THE DEFECT THIS FIXES. A knockout has to be painted in the colour of the
     * thing it is punched OUT of, and inside a slot card that colour is not
     * `--raised`: on a take it is `--raised` with the event's own pink wash on
     * top. The ground was hard-coded to the unlit value, so the one card the
     * board was lighting carried a dark patch behind its GBX reading — the
     * only mark on the plate that did not know an event was happening.
     */
    function blend(a: string, b: string, t: number): string {
      const rgb = (c: string): [number, number, number] => {
        const v = c.trim();
        if (v.startsWith('#')) {
          const h = v.slice(1);
          const f =
            h.length === 3
              ? h
                  .split('')
                  .map((ch) => ch + ch)
                  .join('')
              : h;
          return [
            parseInt(f.slice(0, 2), 16) || 0,
            parseInt(f.slice(2, 4), 16) || 0,
            parseInt(f.slice(4, 6), 16) || 0,
          ];
        }
        const m = v.match(/-?\d+(\.\d+)?/g);
        return [Number(m?.[0] ?? 0), Number(m?.[1] ?? 0), Number(m?.[2] ?? 0)];
      };
      const [r0, g0, b0] = rgb(a);
      const [r1, g1, b1] = rgb(b);
      const k = Math.max(0, Math.min(1, t));
      const at = (u: number, v: number) => Math.round(u + (v - u) * k);
      return `rgb(${at(r0, r1)}, ${at(g0, g1)}, ${at(b0, b1)})`;
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

    function paint(): void {
      if (!resize()) return;
      if (!L) {
        L = buildLayout();
        build(L);
      }
      const l = L;
      ctx.setTransform(l.dpr, 0, 0, l.dpr, 0, 0);
      ctx.clearRect(0, 0, l.w, l.h);
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';

      paintMine(l);
      paintRouter(l);
      paintStream(l);
      paintAuctions(l);
      paintFund(l);
      /* STATION 06 IS OFF THE PLATE FOR NOW. The supply bar, the mint's own
         figure, the burn and the whole conservation ledger under it were a
         second drawing sharing a canvas with the first — a table of four
         percentages, four holdings and four conversions, set under a diagram
         whose entire argument is that you should not need a table. It is
         parked rather than deleted: `paintYou` and everything it reads are
         untouched, and putting the row back is putting this call back. */
      paintFundNotes(l);
    }

    /* --------------------------------------------------------------- mine */
    function paintMine(l: Layout): void {

      /* THE TAKE'S OWN STREAM, drawn FIRST so the opaque cards cover it. A
         payment leaves the card that made it and runs down into the Router;
         inside the board it shows only in the gutters between the rows it
         passes, because a band drawn OVER fifteen other slots would be a
         false claim about where the money is. */
      F.runs.forEach((r) => {
        /* THE BAND IS WHOLE AT THE INSTANT OF THE TAKE. A payment is not a
           thing that travels — it happens and it is over — so the run is
           drawn end to end at full token strength on the first frame and then
           fades on the take's one envelope. A revealed head could only ever
           reach its destination as it disappeared, which is how a stream came
           to connect nothing to nothing. */
        const head = r.top + (l.landY - r.top) * r.p;
        ctx.save();
        ctx.globalAlpha = r.fade;
        ctx.beginPath();
        ctx.rect(0, r.top - 2, l.w, Math.max(3, head - r.top + 2));
        ctx.clip();
        ctx.strokeStyle = USDG;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(2, r.w);
        ctx.stroke(r.path);
        ctx.restore();
        /* and the GBX, leaving the same card for the miner box, revealed
           along its own length so the two travel in step */
        if (r.up !== null && r.upLen > 0) {
          ctx.save();
          ctx.globalAlpha = r.fade;
          ctx.strokeStyle = GBX_BODY;
          ctx.lineWidth = Math.max(2, r.upW);
          ctx.lineCap = 'butt';
          ctx.lineJoin = 'round';
          ctx.setLineDash([r.upLen * r.p, r.upLen]);
          ctx.stroke(r.up);
          ctx.setLineDash([]);
          ctx.restore();
        }
      });

      /* --- the board -------------------------------------------------- */
      for (let i = 0; i < SLOTS; i++) {
        const slot = mn.slots[i];
        if (!slot) continue;
        const { x, y } = cellBox(l, i);
        const w = l.cw;
        const h = l.ch;
        /* the card's light IS the take's envelope — one event, one curve */
        let lit = 0;
        packets.forEach((pk, k) => {
          if (pk.slot === i) lit = Math.max(lit, F.runs[k]?.fade ?? 0);
        });
        const price = priceOf(mn, slot);

        /* A TAKE LIGHTS ITS OWN CARD IN PINK, and the USDG it pays leaves in
           blue. THE TWO ARE NOT THE SAME THING and they were drawn the same
           colour: the card is the EVENT — a slot changed hands — and the band
           is the MONEY. Lighting both in USDG's blue made the card read as a
           quantity of capital sitting in the slot, which is the one thing a
           slot never holds. Pink is already the cards' own ink, on every
           clock bar on the board, so the flash and the bar now agree. */
        ctx.fillStyle = ink.raised;
        ctx.fillRect(x, y, w, h);
        if (lit > 0) {
          ctx.save();
          ctx.globalAlpha = 0.22 * lit;
          ctx.fillStyle = ink.pink;
          ctx.fillRect(x, y, w, h);
          ctx.restore();
        }
        ctx.strokeStyle = lit > 0.15 ? ink.pink : ink.rule;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(hairline(x, l.dpr), hairline(y, l.dpr), w - 1, h - 1);

        const ip = l.narrow ? 4 : 6;
        const idSize = l.narrow ? 8 : 9;
        label(pad2(i + 1), x + ip, y + 13, idSize, ink.faint);
        ctx.font = mono(idSize, 500);
        let who = '@' + slot.owner;
        while (ctx.measureText(who).width > w - ip * 2 - 20 && who.length > 3) who = who.slice(0, -1);
        label(who, x + w - ip, y + 13, idSize, lit > 0.15 ? ink.text : ink.muted, 'right');
        label('$' + price.toFixed(2), x + ip, y + 30, l.narrow ? 12 : 14, ink.text);

        /* THE CLOCK — the card's ONE bar, and the only mark of its hour. It
           reads as a clock: empty at restart, full at the hour. It is not a
           shrinking bar, and it is not doubled by a price ramp; the price
           itself is printed above it. Both are the owner's standing rules. */
        const rx0 = x + ip;
        const rx1 = x + w - ip;
        const el = Math.max(0, Math.min(1, (mn.t - slot.startedAt) / DECAY));
        /* THE BAR ANSWERS "WHERE NEXT". The slot closest to its own reserve
           carries a brighter, heavier clock; every other one sits back, so
           the board says at a glance where the next take will land and the
           flash arrives somewhere the reader was already watching. */
        const next = i === F.imminent;
        const bh = next ? 4 : 2;
        const cy = y + h - 13;
        ctx.fillStyle = ink.rule;
        ctx.fillRect(rx0, cy, rx1 - rx0, bh);
        ctx.save();
        if (!next) ctx.globalAlpha = 0.42;
        ctx.fillStyle = ink.pink;
        ctx.fillRect(rx0, cy, (rx1 - rx0) * el, bh);
        ctx.restore();
        labelK(
          fmtGbx(slot.mined) + ' GBX',
          x + w - ip,
          y + h - 18,
          l.narrow ? 8 : 9,
          ink.text,
          'right',
          500,
          /* the card's ground AS IT IS THIS FRAME — lit cards included, at the
             same wash and the same envelope the card itself is drawn with */
          lit > 0 ? blend(ink.raised, ink.pink, 0.22 * lit) : ink.raised,
        );
      }

      /* THE MINER, above the board. Understated at rest — it is there so the
         GBX a take mints visibly goes somewhere rather than stopping in mid
         air — and on a take it takes the stream and names the miner who was
         DISPLACED and what they were paid. It settles back straight after. */
      {
        const bw = l.cw;
        const bh = l.minerH;
        const bx = l.gridX;
        const by = l.minerY;
        /* a landing arrives: the box takes the payout and keeps it */
        let lit = 0;
        packets.forEach((pk, k) => {
          if (pk.gbx <= 0 || pk.displaced === null) return;
          const r = F.runs[k];
          if (r === undefined) return;
          lit = Math.max(lit, r.fade);
        });
        ctx.fillStyle = ink.raised;
        ctx.fillRect(bx, by, bw, bh);
        if (lit > 0) {
          ctx.save();
          ctx.globalAlpha = 0.16 * lit;
          ctx.fillStyle = GBX_BODY;
          ctx.fillRect(bx, by, bw, bh);
          ctx.restore();
        }
        ctx.strokeStyle = lit > 0.15 ? GBX_BODY : ink.rule;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(hairline(bx, l.dpr), hairline(by, l.dpr), bw - 1, bh - 1);
        /* THE ONE EXCEPTION TO THE TEXT STRIP, and two words is the whole of
           it. A bare handle and a figure in a box above the board could be
           the next miner, the biggest, a queue; `LAST MINER` settles it, and
           it is set exactly like a slot card's own id — same row, same size,
           with the handle right-aligned beside it the way an owner is. */
        const ip = l.narrow ? 4 : 6;
        const idSize = l.narrow ? 7.5 : 9;
        const tw = label('LAST MINER', bx + ip, by + 13, idSize, ink.faint);
        if (lastPayout.who !== '') {
          ctx.font = mono(idSize, 500);
          let who = '@' + lastPayout.who;
          const room = bw - ip * 2 - tw - 8;
          while (ctx.measureText(who).width > room && who.length > 3) who = who.slice(0, -1);
          label(who, bx + bw - ip, by + 13, idSize, ink.muted, 'right');
          /* the figure is the hero, and it takes the room the price, the
             clock and the GBX row take on a slot card */
          label(fmtGbx(lastPayout.gbx) + ' GBX', bx + ip, by + (bh + 10) / 2 + 5, l.narrow ? 12 : 14, ink.hi);
        }

        /* AND EVERYTHING THE BOARD HAS MINTED, in the next column across. The
           MINER box is the last take; this is all of them, and it is the same
           events drawn twice — once as a figure that replaces itself and once
           as a line that keeps every one of them. */
        const sx = bx + bw + l.cgap;
        const sw = l.gridW - bw - l.cgap;
        ctx.fillStyle = ink.raised;
        ctx.fillRect(sx, by, sw, bh);
        ctx.strokeStyle = ink.rule;
        ctx.strokeRect(hairline(sx, l.dpr), hairline(by, l.dpr), sw - 1, bh - 1);
        label('GBX MINTED', sx + ip, by + 13, idSize, ink.faint);
        label(
          Math.round(emis.total).toLocaleString('en-US') + ' GBX',
          sx + sw - ip,
          by + 13,
          idSize,
          ink.muted,
          'right',
        );
        if (F.emisArea !== null && F.emisLine !== null) {
          const zy = by + bh - (l.narrow ? 15 : 16);
          /* THE BASE RULE IS DRAWN, because a windowed axis has to show where
             its own floor is. It runs the full width so the level the window
             opens at is unambiguous even where the curve lies close to it. */
          ctx.save();
          ctx.strokeStyle = ink.rule;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(sx + ip, hairline(zy, l.dpr));
          ctx.lineTo(sx + sw - ip, hairline(zy, l.dpr));
          ctx.stroke();
          /* THE STOCK IS A FILLED AREA, NOT A TRACE. A stroked line reads as a
             signal — a price, a rate, something that could come back down.
             What is under this line has been minted and is still there, so it
             is material lying on the box, and the plate already draws every
             other quantity that way. */
          ctx.globalAlpha = 0.13;
          ctx.fillStyle = GBX_BODY;
          ctx.fill(F.emisArea);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = GBX_BODY;
          ctx.lineWidth = 1.5;
          ctx.lineJoin = 'miter';
          ctx.lineCap = 'butt';
          ctx.stroke(F.emisLine);
          /* the head, marked: the flat run the next riser will lift off */
          ctx.beginPath();
          ctx.arc(F.emisHeadX, F.emisHeadY, 2, 0, Math.PI * 2);
          ctx.fillStyle = GBX_BODY;
          ctx.fill();
          ctx.restore();
          /* THE WINDOW, STATED — BOTH WAYS. This axis does not start at zero
             and it does not span all of time, so it prints the level its floor
             sits at and the stretch of the mine's clock it holds. Without the
             pair, a staircase is a shape rather than a reading. */
          const fy = by + bh - (l.narrow ? 5 : 6);
          const fSize = l.narrow ? 6.5 : 7.5;
          label(Math.round(F.emisBase).toLocaleString('en-US'), sx + ip, fy, fSize, ink.faint);
          label(elapsed(F.emisSpan) + ' window', sx + sw - ip, fy, fSize, ink.faint, 'right');
        }
      }

    }

    /* ------------------------------------------------------------- router */
    /* ══════════════════════════ THE TANK ══════════════════════════════════
       ONE MARK FOR EVERY PLACE MONEY STOPS. The Router and the four auction
       pots are the same kind of thing — capital sitting still until something
       opens an outlet — so on this plate they are the same rectangle: the
       panel's raised ground, filled from the floor to the level being held,
       ruled square. Square corners, because a level is read against an edge
       and a dished bottom bends the bottom fifth of every reading it carries.

       `flash` is ARRIVAL, not stock. A wash of the fill across the whole cell
       and a lit rule, on the same envelope every other event on this plate
       decays with. Money landing is an event; money sitting is a level; they
       are drawn as two different things because they are two different
       things. */
    function tank(
      l: Layout,
      x: number,
      y: number,
      w: number,
      h: number,
      level: number,
      fill: string,
      flash = 0,
    ): void {
      ctx.fillStyle = ink.raised;
      ctx.fillRect(x, y, w, h);
      const lv = Math.max(0, Math.min(1, level));
      if (lv > 0) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y + h * (1 - lv), w, h * lv);
      }
      if (flash > 0) {
        ctx.save();
        ctx.globalAlpha = 0.2 * flash;
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
      }
      ctx.strokeStyle = flash > 0.15 ? fill : ink.rule;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(hairline(x, l.dpr), hairline(y, l.dpr), w - 1, h - 1);
    }

    function paintRouter(l: Layout): void {
      /* THE ROUTER IS THE WIDTH OF THE STREAM IT FEEDS. It used to be a narrow
         flask on a plate where every other mark runs wide, so the one station
         where money STOPS read as the smallest thing on the drawing. Squared
         off and set to the trunk's own width, the reservoir and the flow it
         empties into are the same object seen at two moments. */
      const vw = l.routerVw;
      const vh = l.routerVh;
      const vx = l.cx - vw / 2;
      const vy = l.routerVy;
      /* THE CELL LIGHTS WHILE IT FILLS, and the two are one event: `dripAge`
         is zeroed at the instant a deposit is booked — the board's own,
         ambient or drawn — and `level.shown` leaves for its new level on the
         same frame and over the same envelope. So the wash is the arrival
         itself, and what the reader watches during it is the level actually
         moving. NO FIGURES: the level is the reading. */
      tank(
        l,
        vx,
        vy,
        vw,
        vh,
        level.shown / Math.max(1e-6, router.capShown),
        USDG,
        takeAlpha(dripAge),
      );

    }



    /* ------------------------------------------------------------- stream */
    function paintStream(l: Layout): void {
      const rate = rz.flow.t < rz.flow.finish ? rz.flow.rate : 0;

      /* a resting channel is drawn only while it is resting — never beside the
         band that fills it, where it would read as a ghost edge */
      if (rate <= 0) F.pipes.slice(0, 4).forEach((pp) => strokeFlow(pp, ink.rule, PROCESS_REST.width));
      F.streamBands.forEach((band) => fillFlow(band.path, band.ink));

      /* ── THE DIVIDER, drawn as apparatus ────────────────────────────────
         A BLOCK, NOT A LINE. It sits on the end of the trunk: the band runs
         into it and four channels leave its underside, and the four cells it
         is cut into are the four shares at full size. Dark against the fluid,
         because on this plate the bright thing is money and machinery is not.

         THE CUTS ARE GAPS. A boundary is drawn by the absence of fluid rather
         than by a mark laid over it — nothing to mistake for a quantity, and
         nothing to dissolve when a channel gets narrow. Pink enters a cut only
         while that boundary is actually moving, which is the rule everywhere
         else on this plate: if it moved, a drawn event moved it. */
      if (F.comb.on) {
        /* ── THE DISTRIBUTION, FRAMED ───────────────────────────────────────
           TWO RAILS AND THREE SEAMS. The rails run the band's full width and
           bracket the run the split happens in; the seams divide that run into
           four cells whose widths ARE the four shares. Together they are one
           mark — a proportioning face — instead of three stubs floating on a
           band, which is what seams with no frame around them were.

           CUT, NOT DRAWN. `destination-out` takes the fluid away rather than
           painting over it, so every line here is the page's own ground
           showing through at exactly the width it claims. The same erase the
           plate's labels use, for the same reason: a flat fill would be a
           visible object lying on the stream, and this is meant to be a
           division OF the stream. It is why neither the block nor the comb
           worked — both added something; this takes something away.

           THE RAILS ARE THINNER THAN THE SEAMS. A frame that reads as heavily
           as the boundaries it frames competes with them; the seams are the
           reading, the rails are what makes them one object. */
        const cutW = l.narrow ? 2.5 : 3;
        const railH = l.narrow ? 1.5 : 2;
        const y0 = F.comb.y0;
        const y1 = F.comb.y1;
        const h = y1 - y0;
        /* THE TOP RAIL IS route() ITSELF. The Router's floor is the trunk's
           ceiling now, so the line where the load enters this run is the line
           where somebody had to call the function — and it is drawn as what it
           is: a closed face, broken open to the width of the load while it is
           passing. Shut almost always, because nobody is obliged to open it. */
        const open =
          router.open > 0 ? ease(Math.min(1, (ROUTE_OPEN - router.open) / (ROUTE_OPEN * 0.55))) : 0;
        const gap = Math.max(2, Math.min(F.comb.x1 - F.comb.x0, widthOf(F.gStock, router.lastRouted))) * open;
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = open > 0.15 ? USDG : ink.ruleStrong;
        ctx.lineWidth = 2;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(F.comb.x0, hairline(y0, l.dpr));
        ctx.lineTo(l.cx - gap / 2, hairline(y0, l.dpr));
        ctx.moveTo(l.cx + gap / 2, hairline(y0, l.dpr));
        ctx.lineTo(F.comb.x1, hairline(y0, l.dpr));
        ctx.stroke();
        ctx.restore();
        /* the bottom rail is the face the four channels leave from */
        erase(F.comb.x0, y1 - railH / 2, F.comb.x1 - F.comb.x0, railH);
        F.comb.cuts.forEach((c) => erase(c.x - cutW / 2, y0, cutW, h));
        /* AND A SEAM THAT IS MOVING SAYS SO. It fills for as long as the model
           says that weight is in motion, and goes back to being a gap. */
        ctx.save();
        ctx.setLineDash([]);
        F.comb.cuts.forEach((c) => {
          if (c.glow <= 0) return;
          ctx.globalAlpha = Math.min(1, c.glow);
          ctx.fillStyle = ink.pink;
          ctx.fillRect(c.x - cutW / 2, y0, cutW, h);
        });
        ctx.restore();
      }

      /* NO TAGS ON THE LANES. The share was already drawn — it is the width of
         the lane — and the identity is now drawn too: each lane runs into a
         bucket carrying its own asset's ask, and out again into a bay filled
         in the same hue. A boxed ticker on every lane was a third statement of
         something the drawing makes twice, and four of them across the widest
         row on the plate were the busiest thing on it. */
    }

    /* ----------------------------------------------------------- auctions */
    function paintAuctions(l: Layout): void {
      const potCap = l.potCap;

      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        const w = l.bayW;
        const x = bay.cx - w / 2;
        /* THE SAME MARK AS THE ROUTER, one station down. Four pots filling
           from the stream and emptying into an auction are the Router's own
           job done four ways, so they are drawn the Router's own way — and the
           cell lights on `flash`, which the frozen model sets at the instant
           a lot is taken. */
        tank(l, x, l.aucTop, w, l.aucH, a.dispPot / potCap, USDG, a.flash);
      });

      /* the exchange, drawn as an exchange: the pipes at rest first, then the
         live bands over them */
      /* THE EXCHANGE AT REST — three straight runs: out of the bucket to the
         buyer, back from the buyer, and down into the bay. Drawn here from the
         layout rather than out of the shared pipe cache, because it is the
         only route on the plate that is not a ribbon centreline and threading
         it through a cache indexed by position made it impossible to see which
         leg was which. A resting route is a hairline: a pipe is not a flow. */
      l.bays.forEach((bay, i) => {
        const f = flush[i];
        if (f && f.age < 1 && f.lot > 0) return; // the live band replaces it
        const bx = traderOf(l, bay.cx, i);
        const po = new Path2D();
        po.moveTo(bay.cx, l.aucTop + l.aucH + 4);
        po.lineTo(bx, l.buyerY);
        po.moveTo(bx, l.buyerY + l.buyerH);
        po.lineTo(bay.cx, l.bayTop - 6);
        ctx.strokeStyle = ink.rule;
        ctx.lineWidth = PROCESS_REST.width;
        ctx.setLineDash([]);
        ctx.stroke(po);
      });

      /* ══ THE BUYER ════════════════════════════════════════════════════════
         A PEER OF THE MINER BOX, and for the same reason: something that is
         paid and pays back has to be a thing on the drawing. USDG lands on its
         top face and the asset leaves its bottom one, so the box is literally
         the place the trade turns around — which is what an auction sale is.

         ONE OF THEM, NOT FOUR. There is one market and every bucket sells into
         it; four separate marks would have claimed four counterparties the
         plate has no model for. It lights on whichever sale is running, on the
         same envelope every other event here decays with. */
      {
        const bw = l.buyerW;
        const bx = l.cx - bw / 2;
        const by = l.buyerY;
        const bh = l.buyerH;
        let lit = 0;
        flush.forEach((f) => {
          if (f.lot > 0 && f.age < 1) lit = Math.max(lit, 1 - f.age);
        });
        tank(l, bx, by, bw, bh, 0, USDG, lit);
        label('AUCTION BUYER', bx + (l.narrow ? 6 : 10), by + (bh + 10) / 2, l.narrow ? 7.5 : 9, ink.faint);
      }
      F.aucBands.forEach((band) => fillFlow(band.path, band.ink));

      /* ══ THE FALLING ASK, ONE PER AUCTION ═════════════════════════════════
         A DUTCH AUCTION IS A PRICE COMING DOWN TO MEET THE MONEY, and that is
         now the whole of what this station draws: each bucket carries a blade
         in its OWN asset's hue, falling from the top of the cell toward the
         blue it is going to be paid in. When the blade crosses the fluid — a
         hair past it — the auction clears, the bucket drains, the blue goes
         out to the buyer and the asset comes back to the fund.

         THE CROSSING IS NOT A NEW RULE. The frozen model decides when each pot
         clears, in `epochEnd`; the blade is drawn so that it reaches the fluid
         at exactly that instant. The geometry is a re-parameterisation of the
         model's own clock, never a trigger of its own — so what a reader sees
         cause the drain is what actually caused it.

         IT FALLS LINEARLY, because that is what the price does: Mine's own
         decay is `initialPrice − initialPrice × t / period`, and an eased
         blade would draw a price that hesitates. And it is a BLADE, not a
         level — constant thickness, spanning the cell and a little past it on
         both sides — so it can never be misread as stock.

         The rail, the dashed fair-value datum and the two figures beside them
         are gone. Four lanes each carrying a rail and two decimals was a
         diagram of an instrument panel; the statement was only ever that one
         line is falling onto another, and the drawing makes it without them. */
      rz.assets.forEach((a, i) => {
        const bay = l.bays[i];
        if (!bay) return;
        const span = a.epochEnd - (aucFrom[i] ?? 0);
        if (span <= 0) return;
        const p = Math.max(0, Math.min(1, (rz.flow.t - (aucFrom[i] ?? 0)) / span));
        const w = l.bayW;
        const x = bay.cx - w / 2;
        /* the top of the blue it is falling toward, and the hair past it that
           makes the crossing a crossing rather than a touch */
        const lvl = Math.max(0, Math.min(1, a.dispPot / potCap));
        const fluidY = l.aucTop + l.aucH * (1 - lvl);
        const from = l.aucTop + 2;
        const to = Math.min(l.aucTop + l.aucH - 2, fluidY + (l.narrow ? 3 : 4));
        const ay = from + (to - from) * p;
        ctx.fillStyle = hueOf(i);
        ctx.fillRect(x - 4, ay - 1.5, w + 8, 3);
      });
    }

    /* --------------------------------------------------------------- fund */
    function paintFund(l: Layout): void {
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
           bare word. The bay's own title above it has gone: it said the same
           word the reading says, over a bay already filled in that asset's
           hue, and three statements of one identity is two too many. */
        labelK(
          hh.sym + '  ' + hh.amt.toFixed(hh.amt < 10 ? 4 : 1),
          bay.cx,
          l.bayBot + 16,
          l.narrow ? 8.5 : 10,
          ink.text,
          'center',
        );
      });
    }

    /* ---------------------------------------------------------------- you */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked, see paint()
    function paintYou(l: Layout): void {
      /* THE BANDS FIRST, THE TYPE LAST — for the whole station. The four claim
         ribbons cross this band from the bays above it down to the collector,
         so anything drawn after them is type, and anything drawn before them
         is mechanism. The station's own head is type too, and goes on after. */
      if (rd.phase !== 'burn') F.pipes.slice(4, 9).forEach((pp) => strokeFlow(pp, ink.rule, PROCESS_REST.width));
      F.claimBands.forEach((band) => fillFlow(band.path, band.ink));

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
        labelK('+' + Math.round(mint.since).toLocaleString('en-US') + ' GBX', lx, l.mintY + 8, 9.5, ink.hi, 'right');
      }
      labelK(Math.round(rd.supply).toLocaleString('en-US') + ' GBX', barX, l.supplyY - 7, 9.5, ink.muted);

      const burnX = headX - F.burnW / 2;
      const burnY = l.burnY1;
      if (rd.phase === 'burn')
        labelK(Math.round(rd.burned).toLocaleString('en-US') + ' GBX', burnX + 18, burnY + 16, 9.5, ink.muted);

      /* THE RECEIPT, per bay. The four rows are the pro-rata argument in
         figures beside the same argument in geometry: one share, applied to
         four different holdings, in one transaction. */
      const rx = l.narrow ? l.pad : Math.max(barX + barW + 26, l.pad + 300);
      const rw = (l.narrow ? l.collectC - 44 : l.w - l.pad) - rx;
      const ry = l.narrow ? burnY + 52 : l.supplyY + 4;
      const pct = rd.pct > 0 ? rd.pct : 0.1;
      /* KNOCKED OUT PER CELL, NOT AS ONE BLOCK. A block-sized backdrop would
         take a bite out of the merged claim stack that runs down the spine
         between this table's columns; four small plates let the stack pass
         between them, which is what "the band goes behind the label" means. */
      rd.holds.forEach((hh, i) => {
        const y = ry + i * 13;
        const take = (rd.phase === 'burn' ? takenAt(rd, i) : hh.amt * pct) || 0;
        labelK(hh.sym, rx, y, 9, hueOf(i));
        labelK((pct * 100).toFixed(2) + '%', rx + rw * (l.narrow ? 0.4 : 0.3), y, 9, ink.muted, 'right');
        labelK(hh.amt.toFixed(hh.amt < 10 ? 4 : 1), rx + rw * (l.narrow ? 0.72 : 0.62), y, 9, ink.muted, 'right');
        labelK('→ ' + take.toFixed(take < 10 ? 4 : 2), rx + rw, y, 9, ink.text, 'right');
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
          build(L);
          paint();
        }
      });
      ro.observe(canvas);
    }

    /* EVERY SLOT OCCUPIED. A never-taken slot is a deployment-only state that
       a live board never shows, so the plate does not draw one. The frozen
       model is not touched: its empty-slot branch stays exactly where it is
       and simply never fires here, because any slot the seed left vacant is
       given a tenure built the way `seedBoard` builds an occupied one —
       spread start times, the board's own price band, the model's own rate. */
    function fillTheBoard(): void {
      mn.slots.forEach((sl, i) => {
        if (sl.owner !== null) return;
        sl.owner = NAMES[i] ?? 'miner';
        sl.initialPrice = 4 + Math.random() * 26;
        sl.startedAt = MINE_START_TIME + Math.random() * SIM_ARRIVAL_TIME;
        sl.lastAccruedAt = sl.startedAt;
        sl.tps = globalTps(mn.t - MINE_START_TIME) / SLOTS;
        sl.mined = (mn.t - sl.startedAt) * sl.tps;
        sl.reserve = sl.initialPrice * (0.25 + Math.random() * 0.55);
      });
    }

    function seed(): void {
      /* a reader arrives at a plate that is already running: the mine has a
         history, the stream is mid-week, the buckets are part full, and the
         Router is holding something it has actually been paid */
      seeding = true;
      warmStart(mn, mineFx);
      seeding = false;
      fillTheBoard();
      /* the scripted programme is the mining section's own choreography and
         it would land takes on top of the cadence, so the plate runs on the
         board's ambient takes alone and schedules every one of them */
      mn.nextBeat = Infinity;
      sched.slot = -1;
      replan();
      /* ══ THE EMISSION BOARD OPENS FULL ════════════════════════════════════
         A rolling window that opens empty spends its first minute drawing a
         flat line along its own floor: the reader arrives at a mine that has
         been running for twenty minutes and at a chart that says nothing has
         ever happened. So the plate rolls the board forward one whole window
         before the first frame — through exactly the loop `step()` runs, the
         model's own ambient takes, each one replanning the next the way a live
         take does — and records the risers as they fire.

         NOTHING IS INVENTED HERE. This is not a decorative back-fill: every
         riser is a settlement `stepMine` actually performed, at the price the
         model set, minting the accrual the outgoing tenure had earned. The
         staircase on the opening frame is the staircase a reader who had been
         watching for ten minutes would have seen drawn. */
      emis.t0 = mn.t;
      emis.total = mn.totalMined;
      emisHist.length = 0;
      emisHist.push({ x: 0, v: emis.total });
      /* THE WARM-UP'S DEPOSITS ARE HISTORY, NOT A BALANCE. They are booked as
         already routed before the pre-roll starts.

         THE DEFECT THIS FIXES. `bookedIn` used to be reset to zero against a
         `routerDeposits` tally the warm-up had already run up, so the first
         live frame booked twenty minutes of revenue in one step. The Router
         opened holding about ten cycles' worth, which set its ceiling for the
         rest of the visit — and every ordinary cycle after it then drew as a
         sliver about a tenth of the cell high. Nothing was wrong with the
         arithmetic; the plate was simply scaled to a lump that never recurs. */
      router.held = 0;
      router.bookedIn = mn.routerDeposits;
      router.outTotal = mn.routerDeposits;
      router.lastRouted = 0;
      router.load = 0;
      router.sinceRoute = 0;
      router.wait = ROUTE_MIN;
      router.open = 0;
      {
        const PRE = 4; // protocol seconds a pre-roll step advances
        /* the pre-roll runs on the same two clocks the live loop does: the
           mine on protocol seconds, the Router on the real seconds those are
           watched in, so route() fires on its own published cadence */
        const dtReal = PRE / TS_MINE;
        let banked = mn.totalMined;
        for (let t = 0; t < EMIS_SPAN; t += PRE) {
          stepMine(mn, PRE, mineFx);
          const d = mn.totalMined - banked;
          if (d > 0) {
            banked = mn.totalMined;
            stepMinted(d);
            replan();
          }
          /* THE ROUTER, PRE-ROLLED TOO. Nothing is in flight here — no take is
             mid-drawing — so every deposit books on the frame it is made, and
             route() empties it on the same wait the live loop uses. The reader
             arrives at a Router part-way through a cycle it has actually been
             paid into, and at a `lastRouted` that is a real previous load. */
          if (mn.routerDeposits > router.bookedIn) {
            router.held += mn.routerDeposits - router.bookedIn;
            router.bookedIn = mn.routerDeposits;
          }
          router.sinceRoute += dtReal;
          if (router.sinceRoute >= router.wait && router.held > 0) {
            router.lastRouted = router.held;
            router.load = router.load > 0 ? router.load + (router.held - router.load) * 0.4 : router.held;
            router.outTotal += router.held;
            router.held = 0;
            router.sinceRoute = 0;
            router.wait = ROUTE_MIN + Math.random() * ROUTE_VAR;
          }
        }
      }
      /* the window opens where the pre-roll left it rather than easing into
         place through the first second the reader is watching */
      frameWindow(0);
      packets.length = 0;
      queued.length = 0;
      mn.flash.forEach((f, i) => (flashWas[i] = f));
      /* nothing is mid-travel on a fresh seed: the drawn level IS `held`, and
         the cell's scale opens on the load the pre-roll last routed */
      level.shown = router.held;
      level.from = router.held;
      level.age = TAKE_FADE;
      level.dur = TAKE_FADE;
      dripAge = TAKE_FADE;
      router.cap = routerCap();
      router.capShown = router.cap;
      mint.mark = rd.supply;
      mint.since = 0;
      mint.total = 0;
      mint.burned = 0;
      mint.rate = 0;
      for (let i = 0; i < 40; i++) {
        stepResonance(rz, 240, {});
        trackEpochs();
      }
      seedHistory(au, {});
    }
    seed();
    if (resize()) {
      L = buildLayout();
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
        /* A still that teaches: a take caught mid-run with its stream leaving
           its own card, the Router holding, the seven-day stream mid-week
           split four ways, one auction settling, and a burn taking the same
           share out of every bay. Every number is stepped, not asserted. */
        seed();
        for (let i = 0; i < 26; i++) {
          const before = mn.routerDeposits;
          const mintedBefore = mn.totalMined;
          markBoard();
          stepMine(mn, 24, mineFx);
          spawnTakes(before, mintedBefore);
          stepResonance(rz, 380, {});
          trackEpochs();
          aucStep(au, 190, {});
        }
        /* the still steps the board past its own seed, so the emission window
           is re-solved against the risers that actually ended up in it */
        frameWindow(0);
        /* the still catches ONE take part-way along its run: the last one the
           board actually made, at its own drawn widths */
        packets.length = 0;
        const last = queued.pop();
        queued.length = 0;
        if (last !== undefined) packets.push(last);
        /* nine seconds of the redemption model: a burn lands, the bays and the
           supply move, and the mint puts some of it back — so the still shows
           the inflow with a real figure on it instead of `+0` */
        for (let i = 0; i < 36; i++) advanceRedeem(0.25);
        /* THE STILL SHOWS A TAKE MID-RUN. The board is stepped, so a take has
           actually happened; its stream is caught part-way down, and what it
           is carrying is deliberately not booked into the Router yet — in −
           routed − held − in flight closes in the still exactly as it does in
           a frame. */
        packets.forEach((p) => (p.age = TAKE_FADE * 0.45));
        const inFlightStill = packets.reduce((n, p) => n + p.toRouter, 0);
        const landed = Math.max(0, mn.routerDeposits - inFlightStill);
        router.outTotal = landed * 0.62;
        router.bookedIn = landed;
        router.held = landed - router.outTotal;
        /* the still is one frame: the drawn level has already arrived */
        level.shown = router.held;
        level.from = router.held;
        level.age = level.dur;
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
            <div className="pl-stage">
              <canvas
                id="pl-canvas"
                role="img"
                aria-label={
                  'One plate of the whole protocol, read top to bottom, with width as quantity everywhere. ' +
                  'Station 01, the mine: sixteen slots, each a falling-price auction running to zero over an hour, each with a clock that fills across its hour. A slot is bought with USDG, which is deposited in ResonanceRouter; the slot then mints GBX on a clock, tenure-locked and independent of what was paid. USDG in, GBX out. ' +
                  'Station 02, ResonanceRouter, is a vessel that holds: a deposit is not a forward. Its outlet is route(), which is permissionless, and when it is called the money runs down into the stream below. ' +
                  'Station 03, a seven-day stream, is split by live signal weights into four lanes whose widths are the shares and always sum to the trunk. ' +
                  'Station 04: each lane fills its own auction, which asks less every hour until the ask meets what the lot is worth, and the fill is traded for the asset. ' +
                  'Station 05, the fund, holds NVDA, QQQ, WBTC and AAPL in four bays, each on its own gauge. ' +
                  'Station 06: burning GBX sends you the same proportion of every bay in one transaction.'
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
