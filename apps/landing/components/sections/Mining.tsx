'use client';

import { useLayoutEffect, useRef } from 'react';
import { registerSim, fontFamily } from '../../lib/harness';
import './mining.css';

/* The mine — sixteen reverse Dutch auctions, lifted from docs/deck (mine sim).
   Mirrors Mine.sol mechanics: linear decay to zero over PRICE_DECAY_PERIOD,
   80/20 vs 100% payment allocation, tenure-locked tps, and the prospective
   time-based rate schedule anchored to Mine.startTime. The model stops the
   protocol share at ResonanceRouter: the later permissionless route call is a
   separate action with no timing guarantee. Market activity is illustrative.

   THE DRAWING. A falling price is a descent, so the mine is drawn as sixteen
   descents on one shared dollar axis: each slot owns a column, each column is
   one hour wide, and each slot's price is a straight ramp from wherever its
   tenure started down to $0 at the far side of its column. The solid part of a
   ramp is the hour already spent (the clock, filling); the dashed part is the
   hour still to come.

   A take has three drawn consequences, and each one owns its own place:

     · THE RESTART LEAP. The marker climbs the vertical from the price paid to
       the price the slot restarts at, leaving a ghost tick behind at what was
       paid. That leap is the sawtooth — the single move that makes this a
       market rather than a giveaway — so it is drawn, not implied.
     · THE PAYMENT LANE. A reserved strip below the columns and above the
       deposit bar that nothing else is ever drawn in. Money drops out of the
       taken column into the lane and runs along it to a fixed end: left is the
       displaced miner's 80% pull claim (and the GBX minted on settlement),
       right is the protocol's 20% Router deposit, landing on the blue segment
       of the bar below.
     · THE DEPOSIT BAR, permanently divided 80 / 20, widening to the full width
       for the one case that deposits everything: a slot nobody has ever taken.

   Nothing is ever drawn over a price label: prices are painted in their own
   pass on top of every mark, and the lane clips its own traffic. Nothing is
   ever cut off by the frame either — see the axis note below.

   TWO ENCODINGS, BOTH KEYED. A column drawn in brand blue is a slot nobody has
   ever taken, which is the only state that deposits the whole payment in the
   Router; the rail above the plot says so beside the plot itself, not four
   hundred pixels below it. And the reader's own lane carries a mark nothing
   else uses — a full-height hairline guide under a white YOU plate — so it
   survives the width at which the number row has no room to spell the word.

   WHO IS BUYING. Sixteen slots change hands constantly and the reader is one
   participant among them, not the market. The narrated programme is a five-beat
   cycle — another miner's 80/20 take, a never-taken slot depositing 100%, the
   reader's own take, another miner's take, and then the reader being displaced
   and credited a claim. One narrated take in five is the reader's; the reader holds
   at most one slot at a time; and the last beat is the only place the 80%
   claim is taught from the side of the person receiving it. How long that
   tenure runs is redrawn every cycle, so what the reader walks away with is a
   different number each time rather than a figure they can predict. */

// Contract constants the sim is bound by.
const SLOTS = 16;
const DECAY = 3600; // Mine.PRICE_DECAY_PERIOD, seconds
const MINER_BPS = 8000; // Mine.PREVIOUS_MINER_BPS
const BPS = 10000;
const MULT = 2; // Mine.PRICE_MULTIPLIER
const MIN_PRICE = 1; // Mine.MINIMUM_INITIAL_PRICE = 1e6 raw six-decimal USDG
const INITIAL_TPS = 64; // Mine.INITIAL_TPS, GBX/s globally
const HALVING_PERIOD = 69 * 86400; // Mine.HALVING_PERIOD, seconds from startTime
const TAIL_TPS = 1; // Mine.TAIL_TPS, GBX/s globally
const MINE_START_TIME = 0;
const SIM_ARRIVAL_TIME = 10 * 60; // enough reachable history to desynchronise occupied tenures
const SLOT_HOURLY = (INITIAL_TPS / SLOTS) * 3600;
const SLOT_HOURLY_LABEL = SLOT_HOURLY.toLocaleString('en-US');

const NAMES = [
  'ava',
  'kai',
  'rin',
  'moss',
  'juno',
  'pike',
  'wren',
  'isla',
  'odin',
  'nix',
  'sol',
  'vega',
  'bex',
  'tao',
  'koi',
  'lux',
];
// Never-taken slots: the only ones that can deposit 100%. Two of the four sit
// inside the detail strip, so the reader watches a cell go open → taken.
const OPEN_AT_START = new Set([1, 2, 9, 13]);
// The four slots the detail strip names. The other twelve are drawn, not
// truncated — the ghost row says which is which.
const DETAIL = [0, 1, 2, 3];

// The scripted programme, in sim seconds. timeScale is 60, so a beat is five
// real seconds and one full cycle of the programme is twenty-five.
const BEAT = 300;
type Beat = 'other-occ' | 'other-first' | 'you-buy' | 'you-out';
const PROGRAM: readonly Beat[] = ['other-occ', 'other-first', 'you-buy', 'other-occ', 'you-out'];
/* How long the reader holds a slot, in sim seconds, redrawn every cycle. What
   a tenure earns is its length times a locked rate, so a tenure scripted to a
   fixed length would report the same GBX on every exit for ever — the one beat
   that is about the reader would be the one beat that looks canned. Only the
   dwell varies: the rate, the split and every figure are the model's. */
const YOU_MIN = 420; // ~7 real seconds
const YOU_MAX = 840; // ~14 real seconds

// Event durations, in SIM seconds (timeScale 60 → 66 ≈ 1.1 real seconds), so
// they pause with the sim instead of running on a wall clock.
const EVT = 66;
const LEAP = 27; // the restart leap, ~450ms real
const DROP = 0.17; // the share of a chip's flight spent falling into the lane
/* Both halves of a payment are born at the same point and run to opposite ends
   of the lane, so a figure drawn the instant its chip lands on the rail is
   drawn on top of its twin — one frame in a thousand, but it is a number over
   a number. They pick up their figures a beat after they have parted. */
const PART = DROP + 0.06;
/* The allocation divider has to be telling the truth while the money it explains
   is still in the air. A payment's chips are airborne for well under a second,
   so a bar that is still easing at +1s draws the inverse of its own caption for
   the whole transfer — the reader is told 80/20 and shown 3% at the moment they
   look. It lands in ~350ms, inside the same event window the cell flash uses,
   and it LANDS: this is a fixed-length ease on the house curve, not a
   first-order lag, which only ever approaches its target. */
const DIV_EASE = 21; // sim-seconds ≈ 350ms real

/* The dollar axis holds the dearest thing the drawing has to show, and it can
   never cut anything off. A ceiling that clips draws two slots a full 1.7×
   apart at exactly the same height, and — far worse — it hides the restart
   leap on precisely the takes where the leap is largest, which is the one move
   that makes this a market rather than a giveaway. So the ceiling tracks the
   running peak with headroom; a slot mid-leap counts at its destination, so
   the frame opens ahead of the climb rather than being caught by it. It cannot
   ratchet away, because a restart price is capped and every price decays to
   zero within the hour, so the peak comes back down on its own. */
const AXIS_HEAD = 1.09; // headroom above the dearest slot
const AXIS_MIN = 6; // a quiet board still fills the frame
const AXIS_RISE = 10; // sim-seconds: opens fast, ahead of a leap
const AXIS_FALL = 90; // …and closes slowly, so the field never flickers
const AXIS_SAFE = 1.035; // hard floor: nothing being painted is ever cut

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** The house curve, in canvas terms: fast away, settling in. */
function easeOut(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - Math.pow(1 - c, 3);
}

// Deterministic initial shell for the four detail cells: the geometry is final
// in the server HTML; the effect's pre-run overwrites the text before the first
// post-hydration paint (useLayoutEffect). Text lengths mirror what paintSim
// writes, so nothing changes height.
const CELL_SHELL = DETAIL.map((i) => {
  const open = OPEN_AT_START.has(i);
  return {
    i,
    id: pad2(i + 1),
    open,
    owner: open ? 'open' : '@' + NAMES[i],
    price: '$' + (4 + ((i * 397) % 2600) / 100).toFixed(2),
    width: ((i * 53) % 88) + 6 + '%',
    sub: open ? 'never taken · 0/h' : ((i * 13) % 40).toFixed(1) + ' GBX · ' + SLOT_HOURLY_LABEL + '/h',
  };
});

interface Slot {
  owner: string | null;
  initialPrice: number;
  startedAt: number;
  lastAccruedAt: number;
  tps: number;
  mined: number;
  reserve: number;
}

interface CellRefs {
  root: HTMLElement;
  owner: HTMLElement;
  price: HTMLElement;
  bar: HTMLElement;
  sub: HTMLElement;
  timer: ReturnType<typeof setTimeout> | null;
}

/** A payment allocation in flight. It falls out of the taken column into the
    lane and then runs along the lane to one of its two ends. `a`/`b` are its
    window inside the event, so the claim and GBX that follows it never overlap. */
interface Part {
  x0: number;
  x1: number;
  age: number;
  a: number;
  b: number;
  size: number;
  colour: string;
  /* The square is the keyed mark and takes its destination's exact tone; the
     figure beside it is text and takes whatever tone survives 10px antialiasing
     on the knockout. They are the same colour except on the 80% leg, whose
     segment tone is far too dark to carry type — see CHIP_INK_80. */
  ink: string;
  label: string;
  align: CanvasTextAlign;
}

interface Layout {
  w: number;
  h: number;
  axisW: number;
  chartTop: number;
  baseY: number;
  numY: number;
  cw: number;
  laneY: number;
  laneH: number;
  /** Baseline of the lane's annotation row — the restart multiplier. */
  laneNote: number;
  /** Centreline of the lane's money row — where the payment runs. */
  laneMid: number;
  laneL: number;
  laneR: number;
  sepY: number;
  barY: number;
  barH: number;
  barX: number;
  barW: number;
  narrow: boolean;
  wide: boolean;
}

function globalTps(elapsedSinceStart: number): number {
  // Mirrors Mine._globalTps: only deployment-time age selects the prospective
  // rate. Minted and pending supply do not participate.
  const halvings = Math.floor(Math.max(0, elapsedSinceStart) / HALVING_PERIOD);
  return Math.max(INITIAL_TPS / Math.pow(2, halvings), TAIL_TPS);
}

function money(n: number): string {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(2);
}

function gbx(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return Math.round(n).toLocaleString();
  return n.toFixed(1);
}

/* The annotation on a restart leap is derived from the two prices the leap is
   drawn between — the ghost tick at what was paid, and the head of the column
   it climbed to. Mine fixes the multiplier at ×2; this display never approaches
   the contract's uint192 raw-price cap.

   When the FLOOR is what set the price, the label names the floor instead of
   quoting a ratio. Nothing was multiplied — a $0.17 take does not restart at
   $0.34, it restarts at the minimum — and a ratio there would be a figure the
   reader cannot check: the panel prints money to the cent, so "$0.17 → $1.00"
   reads as ×5.88 on screen while the unrounded prices make it ×5.74. Naming
   the floor is both the true cause and the one statement the two printed
   prices confirm exactly. */
function leapNote(paid: number, restart: number): string {
  if (paid * MULT < MIN_PRICE) return '$' + MIN_PRICE + ' floor';
  return '×' + (restart / paid).toFixed(2).replace(/\.?0+$/, '');
}

export function Mining() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const $ = (id: string) => document.getElementById(id);
    const board = $('mn-board');
    const clock = $('mn-clock');
    const stateLine = $('mn-state');
    const buyline = $('mn-buyline');
    const labMiner = $('mn-lab-miner');
    const valMiner = $('mn-val-miner');
    const labFund = $('mn-lab-fund');
    const valFund = $('mn-val-fund');
    const exitline = $('mn-exitline');
    const tFund = $('mn-t-fund');
    const tPaid = $('mn-t-paid');
    const tGbx = $('mn-t-gbx');
    const tRate = $('mn-t-rate');
    const keyOpen = $('mn-key-open');
    const canvasNode = $('mn-canvas');
    if (
      !board ||
      !clock ||
      !stateLine ||
      !buyline ||
      !labMiner ||
      !valMiner ||
      !labFund ||
      !valFund ||
      !exitline ||
      !tFund ||
      !tPaid ||
      !tGbx ||
      !tRate ||
      !keyOpen ||
      !(canvasNode instanceof HTMLCanvasElement)
    )
      return;
    const canvas = canvasNode;
    const ctxOrNull = canvas.getContext('2d');
    if (!ctxOrNull) return;
    const ctx = ctxOrNull;

    // Captured post-narrowing so the closures below see non-null elements.
    const els = {
      clock,
      stateLine,
      buyline,
      labMiner,
      valMiner,
      labFund,
      valFund,
      exitline,
      tFund,
      tPaid,
      tGbx,
      tRate,
      keyOpen,
    };

    /* Every write this panel makes into the DOM goes through one of these two,
       and neither writes a value that is already there.

       The paint loop runs on the frame clock, but almost nothing it paints
       changes between frames. Unguarded, the four detail cells and the four
       tallies replaced 240,513 text nodes in 125 seconds — sixteen writes a
       frame, ~1,900 a second — of which 41,610 were real changes. Nothing here
       is a live region and nothing is announced, but a screen reader rebuilds
       its virtual buffer from DOM mutations: continuously replacing unchanged
       text inside a region can move a reader's cursor or make the region
       unreadable while they are browsing it. Writing only on change makes the
       mutation stream a record of what actually happened, which is what an
       assistive client is entitled to assume it is. */
    const setText = (node: HTMLElement, next: string): void => {
      if (node.textContent !== next) node.textContent = next;
    };
    const setWidth = (node: HTMLElement, next: string): void => {
      if (node.style.width !== next) node.style.width = next;
    };

    /* ------------------------------------------------------------- palette */
    // next/font hashes family names and the tokens are the design system's, so
    // both are resolved at runtime — never hardcoded here.
    const css = getComputedStyle(document.documentElement);
    const tok = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const rgb = (hex: string): [number, number, number] => {
      const h = hex.replace('#', '');
      const s = h.length === 3 ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]! : h;
      return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
    };
    const BLUE = tok('--blue', '#29b6f0');
    const HI = tok('--hi', '#ffffff');
    const TEXT = tok('--text', '#efeff4');
    const MUTED = tok('--muted', '#adadc0');
    const FAINT = tok('--faint', '#8a8aa0');
    const RULE = tok('--rule', '#26262f');
    const RULE_STRONG = tok('--rule-strong', '#3b3b48');
    const ON_FIELD = tok('--on-field', '#0c0c0c'); // black type on a bright plane
    const blueRGB = rgb(BLUE);
    const inkRGB = rgb(TEXT);
    const hiRGB = rgb(HI);
    const mutedRGB = rgb(MUTED);
    const faintRGB = rgb(FAINT);
    const blueA = (a: number) => `rgba(${blueRGB[0]},${blueRGB[1]},${blueRGB[2]},${a})`;
    const inkA = (a: number) => `rgba(${inkRGB[0]},${inkRGB[1]},${inkRGB[2]},${a})`;
    /* The deposit bar keys two blues: the 20% leg is brand blue at full
       strength, the 80% leg is the same blue laid down at .6. Flatten that
       second tone to one opaque value — resolved by the browser's own
       compositor against the panel ground, so it is exact rather than
       arithmetic — and paint both the segment and the chip flying toward it
       with it. A chip then already IS the segment it is going to land on, and
       neither the panel's scanline nor the lane's rail can tint one of them
       and not the other. */
    const flatten = (over: string, on: string): string => {
      // Walk the same two steps the page walks — the translucent fill onto a
      // transparent canvas, then that canvas over the panel — so the answer is
      // the tone the bar has always rendered, to the byte, and not arithmetic
      // guessing at how the compositor rounds.
      const src = document.createElement('canvas');
      const out = document.createElement('canvas');
      src.width = src.height = out.width = out.height = 1;
      const sg = src.getContext('2d');
      const og = out.getContext('2d');
      if (!sg || !og) return over;
      sg.fillStyle = over;
      sg.fillRect(0, 0, 1, 1);
      og.fillStyle = on;
      og.fillRect(0, 0, 1, 1);
      og.drawImage(src, 0, 0);
      const d = og.getImageData(0, 0, 1, 1).data;
      return `rgb(${d[0]},${d[1]},${d[2]})`;
    };
    const BLUE_80 = flatten(blueA(0.6), tok('--panel', '#101017'));
    /** Cool a mark back down to its resting colour as its event decays. */
    const mix = (from: [number, number, number], to: [number, number, number], t: number) =>
      `rgb(${Math.round(from[0] + (to[0] - from[0]) * t)},${Math.round(from[1] + (to[1] - from[1]) * t)},${Math.round(
        from[2] + (to[2] - from[2]) * t,
      )})`;
    /* The figure beside a chip is text, and text is a different problem from a
       square. At 10px almost no glyph pixel reaches its own fill colour — the
       tone the reader integrates is the antialiased blend, which drags toward
       the knockout beneath it. Painting the 80% figure in the segment's own
       dimmed blue put that blend at 3.5:1, so the larger of the two numbers
       read fainter than the smaller one beside it. The figure is therefore
       decoupled from the segment it belongs to: brand blue carried toward the
       page's own ink until the blend itself clears AA, while the square keeps
       the segment's exact tone and the key with it. */
    const CHIP_INK_80 = mix(blueRGB, mutedRGB, 0.41);
    const MONO = fontFamily('--font-mono', '"JetBrains Mono", monospace');
    const mono = (px: number) => px + 'px ' + MONO;
    const KNOCK = 'rgba(11,11,15,0.9)'; // the ground a label knocks itself out of

    // Wire the JSX-rendered detail cells (do NOT rebuild them — zero shift).
    const cells = new Map<number, CellRefs>();
    const cellRoots = Array.from(board.querySelectorAll<HTMLElement>('.cell'));
    if (cellRoots.length !== DETAIL.length) return;
    cellRoots.forEach((cellRoot, k) => {
      const owner = cellRoot.querySelector<HTMLElement>('.cell__owner');
      const price = cellRoot.querySelector<HTMLElement>('.cell__price');
      const bar = cellRoot.querySelector<HTMLElement>('.meter i');
      const sub = cellRoot.querySelector<HTMLElement>('.cell__sub');
      const index = DETAIL[k];
      if (!owner || !price || !bar || !sub || index === undefined) return;
      cells.set(index, { root: cellRoot, owner, price, bar, sub, timer: null });
    });
    if (cells.size !== DETAIL.length) return;

    const S = { t: 0, totalMined: 0, routerDeposits: 0, paidToMiners: 0, slots: [] as Slot[] };
    // Per-slot event emphasis, in sim seconds, decayed every step so lit
    // states can never accumulate.
    const flash = new Array<number>(SLOTS).fill(0);
    // What the slot last sold for, and how far its restart leap has climbed.
    // leapP === 1 means the leap is over; nothing lingers.
    const paidAt = new Array<number>(SLOTS).fill(0);
    const leapP = new Array<number>(SLOTS).fill(1);
    const parts: Part[] = [];
    let scaleTop = 30; // the dollar axis, eased so it never snaps
    // The deposit bar states the rule at rest and shows the exception while the
    // narrated take is the one that deposited everything. It is tied to the tape,
    // never to a timer, so bar and narration can never disagree.
    let depositFull = false;
    // …and it moves as a fixed-length ease between the two allocations, so it is
    // done inside the event window rather than creeping after it.
    let divFrom = 0.8;
    let divTo = 0.8;
    let divP = 1;
    let divShown = 0.8;
    // The one column the tape is talking about — whoever's take it is. It gets
    // the emphasis: brighter stroke, solid marker, full-brightness price.
    let featured = -1;
    // The one slot the reader holds, or -1. Capped at one by construction: the
    // programme only buys when this is -1, and ambient takes never touch it.
    let youSlot = -1;
    // The ×2 annotation that rides the payment lane under the narrated take.
    let x2Col = -1;
    let x2Age = 0;
    // True only while the board is being pre-run to build history off-screen.
    let warming = false;
    let L: Layout | null = null;

    function seedBoard(): void {
      S.t = SIM_ARRIVAL_TIME;
      S.totalMined = 0;
      S.routerDeposits = 0;
      S.paidToMiners = 0;
      S.slots.length = 0;
      flash.fill(0);
      paidAt.fill(0);
      leapP.fill(1);
      parts.length = 0;
      depositFull = false;
      divFrom = 0.8;
      divTo = 0.8;
      divP = 1;
      divShown = 0.8;
      featured = -1;
      youSlot = -1;
      x2Col = -1;
      x2Age = 0;
      NAMES.forEach((name, i) => {
        const open = OPEN_AT_START.has(i);
        const slot: Slot = {
          // Start occupied slots at independently reachable times after deployment,
          // otherwise the whole board reaches its reservation together and all
          // sixteen change hands at once. Empty slots retain Mine's deployment-time
          // $1 auction and never get silently reopened.
          owner: open ? null : name,
          initialPrice: open ? MIN_PRICE : 4 + Math.random() * 26,
          startedAt: open ? MINE_START_TIME : MINE_START_TIME + Math.random() * S.t,
          lastAccruedAt: open ? MINE_START_TIME : MINE_START_TIME + Math.random() * S.t,
          tps: open ? 0 : globalTps(S.t - MINE_START_TIME) / SLOTS, // vacant slots emit nothing
          mined: 0,
          // Reservation as a fraction of the slot's own price, redrawn per tenure —
          // the desync that keeps the board from churning in lockstep.
          reserve: 0,
        };
        if (!open) {
          slot.lastAccruedAt = slot.startedAt;
          slot.mined = (S.t - slot.startedAt) * slot.tps;
        }
        slot.reserve = slot.initialPrice * (0.25 + Math.random() * 0.55);
        S.slots.push(slot);
      });
    }
    seedBoard();

    /** The decay law at any point of a slot's own hour — Mine._price, which is
        as valid read forward as read now. */
    function priceAt(slot: Slot, at: number): number {
      const elapsed = at - slot.startedAt;
      if (elapsed >= DECAY) return 0;
      return slot.initialPrice * (1 - elapsed / DECAY);
    }
    function priceOf(slot: Slot): number {
      return priceAt(slot, S.t);
    }

    function neverTaken(): number {
      let n = 0;
      S.slots.forEach((s) => {
        if (s.owner === null) n++;
      });
      return n;
    }

    /* ------------------------------------------------- canvas measurements */
    const view = { w: 0, h: 0, dpr: 1 };
    /* The canvas's CSS size, read OUTSIDE the frame loop: paintSim writes DOM
       text before paintCanvas runs, so a clientWidth read here would force
       one synchronous layout every frame (Overview registers 0.00ms because
       its layout is clean when it reads). The ResizeObserver below keeps this
       cache fresh; browsers without one fall back to the live read. */
    const hasRO = typeof ResizeObserver !== 'undefined';
    const meas = { w: canvas.clientWidth, h: canvas.clientHeight };
    function resize(): boolean {
      const w = hasRO ? meas.w : canvas.clientWidth;
      const h = hasRO ? meas.h : canvas.clientHeight;
      if (w <= 0 || h <= 0) return false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (w === view.w && h === view.h && dpr === view.dpr) return true;
      view.w = w;
      view.h = h;
      view.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      return true;
    }

    /* Vertical order, top to bottom: the plot, the slot-number row, the
       payment lane, the rule, the deposit bar. The lane is reserved: no ramp,
       marker or price ever enters it, and no payment ever leaves it. */
    function layout(): Layout {
      const w = view.w;
      const h = view.h;
      const narrow = w < 620;
      const wide = w >= 860;
      const axisW = narrow ? 30 : 40;
      const chartTop = narrow ? 26 : 32;
      const splitH = narrow ? 52 : 60;
      const laneH = narrow ? 22 : 28;
      const sepY = h - splitH;
      const laneY = sepY - 6 - laneH;
      const baseY = laneY - 21;
      const cw = (w - axisW - 2) / SLOTS;
      return {
        w,
        h,
        axisW,
        chartTop,
        baseY,
        numY: baseY + 13,
        cw,
        laneY,
        laneH,
        laneNote: laneY + (narrow ? 9 : 10),
        laneMid: laneY + laneH - (narrow ? 7 : 9),
        laneL: axisW + 7,
        laneR: w - 9,
        sepY,
        barX: axisW,
        barW: w - axisW - 2,
        barY: sepY + (narrow ? 18 : 21),
        barH: narrow ? 12 : 14,
        narrow,
        wide,
      };
    }

    function yOf(l: Layout, price: number): number {
      const f = Math.max(0, Math.min(1, price / scaleTop));
      return l.baseY - f * (l.baseY - l.chartTop);
    }
    /** Unclamped: a ramp that begins above the ceiling must keep its true slope
        and be cut by the frame, not bent flat along the top of it. */
    function yRaw(l: Layout, price: number): number {
      return l.baseY - (price / scaleTop) * (l.baseY - l.chartTop);
    }
    function colX(l: Layout, i: number): { x0: number; x1: number; mid: number } {
      const gap = Math.min(3.5, l.cw * 0.14);
      const x0 = l.axisW + i * l.cw + gap;
      const x1 = l.axisW + (i + 1) * l.cw - gap;
      return { x0, x1, mid: (x0 + x1) / 2 };
    }
    function markerXY(l: Layout, i: number, slot: Slot): { x: number; y: number } {
      const { x0, x1 } = colX(l, i);
      const e = Math.max(0, Math.min(1, (S.t - slot.startedAt) / DECAY));
      return { x: x0 + (x1 - x0) * e, y: yOf(l, priceOf(slot)) };
    }

    /* ------------------------------------------------------ the transfer fx */
    function spawn(
      x0: number,
      x1: number,
      size: number,
      colour: string,
      label: string,
      align: CanvasTextAlign,
      a: number,
      b: number,
      ink: string = colour,
    ): void {
      if (parts.length > 24) parts.splice(0, parts.length - 24);
      parts.push({ x0, x1, age: 0, a, b, size, colour, ink, label, align });
    }

    /* Only the take the tape is narrating draws its money. Sixteen slots change
       hands constantly; animating every one of them would be sixteen arguments
       at once. An ambient take restarts its ramp, leaps, and marks its own slot
       number — the narrated take is the one followed all the way through.

       The geometry is the argument: both legs enter the lane directly beneath
       the taken column — the one that is leaping at that moment — settle onto
       the rail and run to a fixed end of it. Left is the pull claim credited to
       the person who just left the mine, and behind it the GBX minted to them at
       settlement. Right is ResonanceRouter, directly above the blue segment of
       the bar that the 20% deposit becomes.

       Each chip is painted in the exact tone of the segment it is flying to, so
       the colour says where the money is going before it arrives: the deep blue
       runs left to the displaced miner's claim, the bright blue runs right to
       ResonanceRouter. */
    function transferFx(from: { x: number }, toMiner: number, toRouter: number, accrued: number): void {
      if (warming || !L) return;
      const l = L;
      if (toMiner > 0) {
        spawn(from.x, l.laneL, 9, BLUE_80, 'claim ' + money(toMiner), 'left', 0, 0.78, CHIP_INK_80);
        spawn(from.x, l.laneR, 5, BLUE, money(toRouter), 'right', 0, 0.78);
      } else {
        spawn(from.x, l.laneR, 10, BLUE, money(toRouter), 'right', 0, 0.86);
      }
      /* Whoever is displaced receives their mined GBX as well as the 80% claim,
         so the GBX follows that leg down the same lane, one pass behind it.
         Strictly behind: it enters at 0.78, the exact age the two USDG chips
         are retired at, because it enters at the taken column — where the
         Router figure is still standing while that figure is on its way out.
         Overlapping the two passes put a white square and a white knockout on
         top of a live money label for a fifth of a second. The lane carries the
         claim pass, then the GBX pass; never both. */
      if (accrued > 0) {
        spawn(from.x, l.laneL, 5, inkA(0.92), '+' + gbx(accrued) + ' GBX', 'left', 0.78, 1.28);
      }
    }

    /* The tape. Every narrated take says who bought, who was displaced, and
       where each allocated share went — including the beat where the reader
       is the one displaced, which is the only place the claim is shown from
       the receiving side. */
    function narrate(
      index: number,
      buyer: string,
      displaced: string | null,
      paid: number,
      toMiner: number,
      toRouter: number,
      accrued: number,
    ): void {
      const who = buyer === 'you' ? 'You take slot ' : '@' + buyer + ' takes slot ';
      setText(els.buyline, who + pad2(index + 1) + ' for ' + money(paid) + '.');
      depositFull = !displaced;
      if (displaced) {
        setText(els.labMiner, '80% claim → ' + (displaced === 'you' ? 'you' : '@' + displaced));
        setText(els.valMiner, money(toMiner));
        setText(els.labFund, '20% deposited → ResonanceRouter');
        setText(els.valFund, money(toRouter));
        setText(
          els.exitline,
          (displaced === 'you' ? 'You exit' : '@' + displaced + ' exits') +
            ' with ' +
            gbx(accrued) +
            ' GBX minted; the USDG claim is withdrawable.',
        );
      } else {
        setText(els.labMiner, 'no one displaced — first-ever take');
        setText(els.valMiner, '—');
        setText(els.labFund, '100% deposited → ResonanceRouter');
        setText(els.valFund, money(toRouter));
        setText(els.exitline, 'Mine deposits the whole payment and stops there.');
      }
      els.labMiner.classList.toggle('is-off', !displaced);
    }

    /** A miner from the pool who is not the one being displaced. */
    function otherName(exclude: string | null): string {
      for (let k = 0; k < 8; k++) {
        const n = NAMES[Math.floor(Math.random() * NAMES.length)];
        if (n && n !== exclude) return n;
      }
      return NAMES[0]!;
    }

    function buy(index: number, forcedOwner: string | undefined, narrated: boolean): void {
      const slot = S.slots[index];
      if (!slot) return;
      const from = L ? markerXY(L, index, slot) : null;
      const paid = priceOf(slot);
      const displaced = slot.owner;

      // Settle the outgoing tenure: its accrual mints to the displaced miner.
      let accrued = 0;
      if (displaced !== null) {
        accrued = (S.t - slot.lastAccruedAt) * slot.tps;
        S.totalMined += accrued;
      }

      // Allocate the payment: vacant slot → 100% Router deposit; occupied →
      // an 80% pull claim plus the exact 20% Router deposit.
      let toMiner = 0;
      let toRouter = 0;
      if (paid > 0) {
        if (displaced === null) {
          toRouter = paid;
        } else {
          toMiner = (paid * MINER_BPS) / BPS;
          toRouter = paid - toMiner;
        }
        S.routerDeposits += toRouter;
        S.paidToMiners += toMiner;
      }

      // New tenure: restart price at paid ×2 with the $1 floor; only deployment-
      // time age selects the prospective rate, which is divided by sixteen and
      // locked until this slot is replaced.
      // Nobody displaces themselves: the incoming miner is never the outgoing one.
      slot.owner = forcedOwner || otherName(displaced);
      slot.initialPrice = Math.max(paid * MULT, MIN_PRICE);
      slot.startedAt = S.t;
      slot.lastAccruedAt = S.t;
      slot.tps = globalTps(S.t - MINE_START_TIME) / SLOTS;
      slot.mined = 0;
      slot.reserve = slot.initialPrice * (0.3 + Math.random() * 0.55);

      if (displaced === 'you') youSlot = -1;
      if (slot.owner === 'you') youSlot = index;

      if (!warming) {
        // The leap: the marker climbs from what was paid to what it restarts at.
        flash[index] = 1;
        paidAt[index] = paid;
        leapP[index] = 0;
        // A detail cell names its own consequence for ~1s, then cleans up.
        const cell = cells.get(index);
        if (cell) {
          cell.root.classList.remove('evt-blue');
          void cell.root.offsetWidth; // restart the flash on repeat purchase
          cell.root.classList.add('evt-blue');
          if (cell.timer !== null) clearTimeout(cell.timer);
          cell.timer = setTimeout(function () {
            cell.root.classList.remove('evt-blue');
          }, 1100);
        }
      }

      if (narrated) {
        featured = index;
        narrate(index, slot.owner, displaced, paid, toMiner, toRouter, accrued);
        if (!warming) {
          x2Col = index;
          x2Age = 1;
          if (from) transferFx(from, toMiner, toRouter, accrued);
        }
      }
    }

    /* ---------------------------------------------------- the scripted beats
       No one operates this board. On its own clock — sim time, so a section
       that has never been on screen has not burned its cycle — one take is
       narrated every BEAT. The cycle guarantees, in order: an ordinary 80/20
       take by a miner; a never-taken slot depositing 100% in the Router; the
       reader's own take; another miner's; and the reader being displaced and
       credited its claim. Ambient miner purchases keep running underneath, unnarrated. */
    let beatIdx = 0;
    let nextBeat = 0;
    // The two beats the reader's tenure spans, drawn fresh each time they buy.
    let youLegA = BEAT;
    let youLegB = BEAT;

    /** Which never-taken slot the scripted first-take spends next.

        CHEAPEST FIRST, and it matters. There are exactly four slots that can
        ever deposit 100%, they are spent one at a time over about forty seconds,
        and every one of them is decaying towards zero the whole while. Spending
        the dearest first leaves the cheapest — the one closest to being worth
        nothing — to carry the last and most recent demonstration of the
        headline allocation, which is how the panel came to teach "the whole
        payment is deposited" over a payment of $0.00 and a Router tally that did
        not move. Cheapest first spends each vacancy while it still has a price
        to spend and leaves the dearest standing, so the last 100% take on
        screen — the one a reader arriving late sees — is the one worth the
        most. Same four slots, same prices, same order of magnitude of total
        Router deposits: only which of the eligible slots the beat targets changes,
        exactly as the reader's own beat already chooses among occupied slots.

        Cheapest measured AT THE MOMENT ITS TURN WOULD COME, not at this
        instant, and the difference decides the tail. The four vacancies fall at
        four different rates — a slot's whole price is surrendered across one
        hour, so the dearest one is also the one shedding cents fastest — and
        the walk takes about a beat and a half per slot. Ranking on the price
        right now therefore keeps back whichever slot happens to be dearest
        today and hands the last beat a slot that has since expired: over 30,000
        modelled walks that lands the final 100% take on exactly $0.00 in 3.6%
        of them. Ranking on the price the slot will still have when its turn
        arrives spends the ones that are about to run their hour out while they
        are still worth something and keeps back the one that will still be
        alive at the end — $0.00 in 0.8%, and a median final take of $2.43
        against $0.58 for taking the dearest first.

        Nothing is skipped and nothing is re-opened: every vacancy is still
        spent, in a different order, so the counter's walk down to "every slot
        has been taken once" always completes.

        Still weighted toward the detail strip, so a named cell is seen flipping
        open → taken. */
    const FIRST_GAP = 720; // sim seconds between scripted first-takes, measured
    function pickFirst(): number {
      const open: number[] = [];
      S.slots.forEach(function (slot, i) {
        if (slot.owner === null) open.push(i);
      });
      if (!open.length) return -1;
      const turn = S.t + (open.length - 1) * FIRST_GAP;
      const bias = (i: number) => (DETAIL.includes(i) ? 1 / 1.35 : 1);
      const worth = (i: number, at: number) => priceAt(S.slots[i]!, at) * bias(i);
      // …and where two will both be worth nothing by then, spend the deader one
      // now and leave the other its remaining minutes.
      open.sort((a, b) => worth(a, turn) - worth(b, turn) || worth(a, S.t) - worth(b, S.t));
      return open[0]!;
    }

    /** An occupied slot the reader does not hold, from the dearer middle of the
        board so the 80/20 split is worth reading, picked with enough spread that
        the narrated column moves around the board instead of sitting on one
        slot and bidding it into the price cap. */
    function pickOccupied(): number {
      const held: { i: number; p: number }[] = [];
      const any: { i: number; p: number }[] = [];
      S.slots.forEach(function (slot, i) {
        if (slot.owner === null || slot.owner === 'you') return;
        const entry = { i, p: priceOf(slot) };
        any.push(entry);
        // Longer than a beat, so the tape can never narrate the same column
        // twice running, and no slot churns in lockstep with the programme.
        if (S.t - slot.startedAt > BEAT + 60) held.push(entry);
      });
      const pool = held.length ? held : any;
      if (!pool.length) return -1;
      pool.sort(function (a, b) {
        return a.p - b.p;
      });
      const lo = Math.floor(pool.length * 0.35);
      const hi = Math.max(lo, pool.length - 1 - Math.floor(pool.length * 0.2));
      const k = Math.min(pool.length - 1, lo + Math.floor(Math.random() * (hi - lo + 1)));
      return pool[k]!.i;
    }

    function runBeat(): void {
      const scripted = PROGRAM[beatIdx % PROGRAM.length] ?? 'other-occ';
      /* A never-taken slot's hour runs out whether or not anyone takes it, and
         those four are the only slots that can ever deposit 100%. So while any
         remain, the cycle's second miner beat spends one too: all four are seen
         at a real price, and the foot counter's walk down to "every slot has
         been taken once" is a thing that happens rather than a thing that
         stalls. Nothing is re-opened — when they are gone the beat is an
         ordinary 80/20 take, which is the truth from then on. */
      const slot0 = beatIdx % PROGRAM.length;
      const kind: Beat = slot0 === 3 && scripted === 'other-occ' && pickFirst() >= 0 ? 'other-first' : scripted;
      beatIdx++;
      /* The reader's tenure runs from the 'you-buy' beat to the 'you-out' beat
         two beats later, so those two beats carry its length between them.
         Both stay long enough to read the take they narrate. */
      if (slot0 === 2) {
        const span = YOU_MIN + Math.random() * (YOU_MAX - YOU_MIN);
        youLegA = span * (0.4 + Math.random() * 0.2);
        youLegB = span - youLegA;
      }
      nextBeat = S.t + (slot0 === 2 ? youLegA : slot0 === 3 ? youLegB : BEAT);
      if (kind === 'you-out' && youSlot >= 0) {
        // Someone takes the slot the reader holds: 80% and the GBX go to them.
        buy(youSlot, undefined, true);
        return;
      }
      if (kind === 'you-buy' && youSlot < 0) {
        const i = pickOccupied();
        if (i >= 0) {
          buy(i, 'you', true);
          return;
        }
      }
      if (kind === 'other-first') {
        const i = pickFirst();
        if (i >= 0) {
          buy(i, undefined, true);
          return;
        }
        // Every slot has been taken once: the 100% deposit honestly no longer
        // exists, and the foot counter has already said so.
      }
      const i = pickOccupied();
      if (i >= 0) buy(i, undefined, true);
    }

    function stepSim(dt: number): void {
      S.t += dt;
      S.slots.forEach(function (slot, i) {
        if (slot.owner !== null) slot.mined += dt * slot.tps;
        // Never inside the first stretch of a tenure, so slots cannot churn in
        // lockstep. Never-taken slots are left for the scripted first-take, and
        // the reader's own slot is left for the scripted displacement.
        if (slot.owner !== null && slot.owner !== 'you' && S.t - slot.startedAt > 240 && priceOf(slot) <= slot.reserve)
          buy(i, undefined, false);
        if (flash[i]! > 0) flash[i] = Math.max(0, flash[i]! - dt / EVT);
        if (leapP[i]! < 1) leapP[i] = Math.min(1, leapP[i]! + dt / LEAP);
      });
      if (x2Age > 0) x2Age = Math.max(0, x2Age - dt / EVT);

      /* The axis. `peak` is what the frame has to hold a moment from now — a
         slot mid-leap counts at the price it is climbing to — and `drawn` is
         what is on the glass this frame, computed exactly as the painter
         computes it. The ceiling eases toward a round-dollar peak, quick to
         open and slow to close, and is then floored just above `drawn`, so no
         column can ever terminate at the ceiling with its price flattened
         against its neighbours'. */
      let peak = 0;
      let drawn = 0;
      S.slots.forEach(function (slot, i) {
        const p = priceOf(slot);
        if (leapP[i]! < 1) {
          peak = Math.max(peak, slot.initialPrice);
          drawn = Math.max(drawn, paidAt[i]! + (slot.initialPrice - paidAt[i]!) * easeOut(leapP[i]!));
        } else {
          peak = Math.max(peak, p);
          drawn = Math.max(drawn, p);
        }
      });
      const raw = Math.max(AXIS_MIN, peak * AXIS_HEAD);
      const step = raw > 48 ? 10 : raw > 24 ? 4 : raw > 9 ? 2 : 1;
      const wanted = Math.ceil(raw / step) * step;
      scaleTop += (wanted - scaleTop) * Math.min(1, dt / (wanted > scaleTop ? AXIS_RISE : AXIS_FALL));
      scaleTop = Math.max(scaleTop, drawn * AXIS_SAFE, AXIS_MIN);

      const divWant = depositFull ? 0 : 0.8;
      if (divWant !== divTo) {
        divFrom = divShown;
        divTo = divWant;
        divP = 0;
      }
      if (divP < 1) {
        divP = Math.min(1, divP + dt / DIV_EASE);
        divShown = divFrom + (divTo - divFrom) * easeOut(divP);
      }
      for (let j = parts.length - 1; j >= 0; j--) {
        const part = parts[j]!;
        part.age += dt / EVT;
        if (part.age >= part.b) parts.splice(j, 1);
      }
      if (S.t >= nextBeat) runBeat();
    }

    /* --------------------------------------------------------- the drawing */
    function paintCanvas(): void {
      if (!resize()) return;
      const l = layout();
      L = l;
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.clearRect(0, 0, l.w, l.h);
      ctx.textBaseline = 'alphabetic';
      ctx.lineCap = 'butt';

      const idSize = l.narrow ? 8.5 : 9.5;
      const axSize = l.narrow ? 8.5 : 9.5;

      // --- the dollar axis: three levels, only the ends labelled -----------
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = RULE;
      ctx.lineWidth = 1;
      [1, 0.5].forEach((f) => {
        const y = Math.round(yOf(l, scaleTop * f)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(l.axisW, y);
        ctx.lineTo(l.w - 2, y);
        ctx.stroke();
      });
      ctx.restore();
      ctx.strokeStyle = RULE_STRONG;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.axisW, Math.round(l.baseY) + 0.5);
      ctx.lineTo(l.w - 2, Math.round(l.baseY) + 0.5);
      ctx.stroke();

      ctx.font = mono(axSize);
      ctx.textAlign = 'right';
      ctx.fillStyle = FAINT;
      ctx.fillText('$' + Math.round(scaleTop), l.axisW - 7, yOf(l, scaleTop) + 3);
      ctx.fillText('$0', l.axisW - 7, l.baseY + 3);

      /* --- the reader's own lane -------------------------------------------
         One slot in sixteen is the reader's, and it has to be findable in a
         glance at any width — including the width where the number row has no
         room to spell "YOU". So it gets a mark nothing else on this canvas
         uses: a hairline guide the whole height of the plot, and a solid white
         plate at the head of it in the empty band above the ceiling. Every
         other emphasis here is a stroke weight or a hue on a mark that already
         existed; this is the only plate and the only full-height line, so it
         cannot be read as anything but the reader. */
      if (youSlot >= 0) {
        const gx = Math.round(colX(l, youSlot).mid) + 0.5;
        ctx.strokeStyle = inkA(0.34);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, l.chartTop - 4);
        ctx.lineTo(gx, l.baseY + 4);
        ctx.stroke();
        ctx.font = mono(l.narrow ? 8 : 8.5);
        ctx.textAlign = 'center';
        const bw = Math.round(ctx.measureText('YOU').width + 9);
        const bx = Math.max(l.axisW, Math.min(l.w - 2 - bw, Math.round(gx - bw / 2)));
        const by = Math.round(l.chartTop) - 16;
        ctx.fillStyle = HI;
        ctx.fillRect(bx, by, bw, 12);
        ctx.fillStyle = ON_FIELD;
        ctx.fillText('YOU', bx + bw / 2, by + 9);
      }

      /* --- sixteen descents ------------------------------------------------
         Geometry once, then two passes: every mark, then every price on top of
         every mark. A label can therefore never be buried by a neighbouring
         ramp, a leap, or anything else the drawing does. */
      const geo = S.slots.map((slot, i) => {
        const { x0, x1, mid } = colX(l, i);
        const lp = leapP[i]!;
        const leaping = lp < 1;
        const e = Math.max(0, Math.min(1, (S.t - slot.startedAt) / DECAY));
        // Mid-leap the marker is climbing from what was paid to the restart
        // price, and its number rides with it — the ×2 made visible.
        const shown = leaping ? paidAt[i]! + (slot.initialPrice - paidAt[i]!) * easeOut(lp) : priceOf(slot);
        const over = shown > scaleTop;
        return {
          slot,
          i,
          x0,
          x1,
          mid,
          leaping,
          shown,
          over,
          mx: leaping ? x0 : x0 + (x1 - x0) * e,
          my: over ? l.chartTop : yRaw(l, shown),
        };
      });

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, l.chartTop, l.w, l.baseY - l.chartTop + 1);
      ctx.clip();
      geo.forEach((g) => {
        const { slot, i, x0, x1, mx, my } = g;
        const open = slot.owner === null;
        const isFeat = i === featured;
        const top = yRaw(l, slot.initialPrice);
        const age = flash[i]!;

        // the hour still to come
        ctx.save();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = open ? blueA(0.36) : inkA(isFeat ? 0.3 : 0.2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(x1, l.baseY);
        ctx.stroke();
        ctx.restore();

        // The hour already spent, as an area: empty when the slot is taken and
        // filling until the price reaches zero. This IS the slot's clock — the
        // same geometry read the other way, since the price surrendered and the
        // time elapsed are one line.
        if (mx > x0 + 0.5) {
          ctx.fillStyle = open ? blueA(0.09) : inkA(isFeat ? 0.085 : 0.05);
          ctx.beginPath();
          ctx.moveTo(x0, top);
          ctx.lineTo(mx, my);
          ctx.lineTo(mx, l.baseY);
          ctx.lineTo(x0, l.baseY);
          ctx.closePath();
          ctx.fill();
        }

        /* What the slot last sold for, left behind as a tick: the foot of the
           leap, so the restart reads as a multiple of something and not as a
           number that simply changed between frames.

           A STUB, not a rule across the column. Drawn a full column wide it
           terminates unlabelled a few pixels from the next column's price, and
           whenever the two happen to sit at the same height it stops being this
           slot's mark and reads as a leader line into that neighbour's number.
           Anchored on the leap's own vertical and stopped well inside its own
           column, its only free end is over empty plot. */
        if (age > 0 && paidAt[i]! > 0) {
          const gy = Math.round(yRaw(l, paidAt[i]!)) + 0.5;
          const stub = Math.min(20, (x1 - x0) * 0.6);
          ctx.strokeStyle = inkA(0.48 * age);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0, gy);
          ctx.lineTo(x0 + stub, gy);
          ctx.stroke();
        }

        // the leap itself
        if (g.leaping) {
          ctx.strokeStyle = open ? BLUE : isFeat ? HI : inkA(0.75);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x0, yRaw(l, paidAt[i]!));
          ctx.lineTo(x0, my);
          ctx.stroke();
        }

        // …and the ramp that bounds the hour spent
        ctx.strokeStyle = open ? BLUE : isFeat ? HI : inkA(0.5);
        ctx.lineWidth = isFeat ? 2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, top);
        ctx.lineTo(mx, my);
        ctx.stroke();

        // the price, sitting on its ramp — or pegged at the ceiling, pointing
        // off the top, when the slot is dearer than the frame can hold
        const ms = isFeat ? 7 : 5;
        ctx.fillStyle = open ? BLUE : isFeat ? HI : inkA(0.62);
        if (g.over) {
          ctx.beginPath();
          ctx.moveTo(mx, l.chartTop + 1);
          ctx.lineTo(mx - ms / 2 - 1, l.chartTop + ms + 1);
          ctx.lineTo(mx + ms / 2 + 1, l.chartTop + ms + 1);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(mx - ms / 2, my - ms / 2, ms, ms);
        }
      });
      ctx.restore();

      // --- every price, on top of every mark -------------------------------
      if (l.wide) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, l.chartTop - 17, l.w, l.baseY - l.chartTop + 37);
        ctx.clip();
        ctx.font = mono(10);
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        geo.forEach((g) => {
          const { slot, i, x0, x1, mx, my } = g;
          const open = slot.owner === null;
          const isFeat = i === featured;
          const label = '$' + g.shown.toFixed(2);
          const half = ctx.measureText(label).width / 2;
          // A slot dearer than the frame keeps its number, pinned above the
          // ceiling behind a caret: off the top, and by how much.
          const pad = g.over ? 8 : 0;
          const lo = x0 - 3 + half + pad;
          // A price is allowed to lean out of its column on the left, where
          // nothing else is drawn, but never on the right: that is where the
          // next column's leap and its ghost tick begin, and a number sitting
          // against that tick is the leader-line misread the stub above exists
          // to prevent.
          const hi = x1 - 2 - half;
          if (hi <= lo) return;
          const lx = Math.min(hi, Math.max(lo, mx));
          const ly = g.over ? l.chartTop - 7 : my - 10 >= l.chartTop + 8 ? my - 10 : my + 14;
          ctx.lineWidth = 3;
          ctx.strokeStyle = KNOCK;
          ctx.strokeText(label, lx, ly);
          ctx.fillStyle = open ? BLUE : isFeat ? HI : FAINT;
          ctx.fillText(label, lx, ly);
          if (g.over) {
            const cx = lx - half - 7;
            ctx.beginPath();
            ctx.moveTo(cx, ly - 7.5);
            ctx.lineTo(cx - 3.5, ly - 1.5);
            ctx.lineTo(cx + 3.5, ly - 1.5);
            ctx.closePath();
            ctx.fill();
          }
        });
        ctx.restore();
      }

      /* --- the slot numbers, and who is where ------------------------------
         The reader's lane is neutral all the way down — plate, guide, marker
         and this underline — because brand blue already means something on
         this plot: a slot nobody has ever taken. The reader's column is by
         definition occupied, so it cannot borrow that hue for emphasis. A slot
         that has just changed hands says so by holding its number at full white
         and cooling back to grey as the event decays — a temperature, not a
         second mark in the reader's own language. */
      ctx.font = mono(idSize);
      ctx.textAlign = 'center';
      geo.forEach((g) => {
        const { slot, i, mid, x0, x1 } = g;
        const you = slot.owner === 'you';
        const isFeat = i === featured;
        let text = pad2(i + 1);
        if (you && !l.narrow) {
          const withCaption = text + ' YOU';
          if (ctx.measureText(withCaption).width <= x1 - x0 + 5) text = withCaption;
        }
        ctx.fillStyle = you || isFeat ? HI : mix(DETAIL.includes(i) ? mutedRGB : faintRGB, hiRGB, flash[i]!);
        ctx.fillText(text, mid, l.numY);
        if (you) {
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = HI;
          ctx.fillRect(Math.round(mid - tw / 2 - 2), Math.round(l.numY + 4), Math.round(tw + 4), 3);
        }
      });

      /* --- the payment lane -------------------------------------------------
         A reserved strip, empty at rest but for its rail and the two ends the
         money runs to. Left end sits over "the displaced miner", right end over
         "ResonanceRouter" and the blue segment of the bar below it. */
      ctx.strokeStyle = inkA(0.09);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.laneL, Math.round(l.laneMid) + 0.5);
      ctx.lineTo(l.laneR, Math.round(l.laneMid) + 0.5);
      ctx.stroke();
      ctx.fillStyle = RULE_STRONG;
      ctx.fillRect(Math.round(l.laneL) - 1, Math.round(l.laneMid) - 4, 1, 9);
      ctx.fillRect(Math.round(l.laneR), Math.round(l.laneMid) - 4, 1, 9);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, l.laneY, l.w, l.laneH);
      ctx.clip();
      const chipSize = l.narrow ? 9 : 10;
      parts.forEach((part) => {
        const u = (part.age - part.a) / (part.b - part.a);
        if (u <= 0) return;
        const uc = u > 1 ? 1 : u;
        // The whole flight stays inside the lane's own bounds, so a chip is
        // never a glyph sliced in half by the clip: it arrives under the column
        // that was taken, settles onto the rail, and then runs.
        const enterY = l.laneY + part.size / 2 + 1;
        let x: number;
        let y: number;
        if (uc < DROP) {
          x = part.x0;
          y = enterY + (l.laneMid - enterY) * easeOut(uc / DROP);
        } else {
          x = part.x0 + (part.x1 - part.x0) * easeOut((uc - DROP) / (1 - DROP));
          y = l.laneMid;
        }
        ctx.globalAlpha = uc < DROP ? easeOut(uc / DROP) : uc < 0.82 ? 1 : Math.max(0, (1 - uc) / 0.18);
        ctx.fillStyle = part.colour;
        ctx.fillRect(x - part.size / 2, y - part.size / 2, part.size, part.size);
        if (part.label && uc >= PART) {
          ctx.font = mono(chipSize);
          ctx.textAlign = part.align;
          const off = part.align === 'right' ? -part.size / 2 - 5 : part.size / 2 + 5;
          const tx = Math.max(l.axisW + 2, Math.min(l.w - 3, x + off));
          const tw = ctx.measureText(part.label).width;
          ctx.fillStyle = KNOCK;
          ctx.fillRect(part.align === 'right' ? tx - tw - 3 : tx - 3, y - chipSize / 2 - 4, tw + 6, chipSize + 8);
          ctx.fillStyle = part.ink;
          ctx.fillText(part.label, tx, y + 3.5);
        }
        ctx.globalAlpha = 1;
      });
      /* …and what the slot actually restarted at, on the lane's own annotation
         row directly under the column that leapt — above the money, never in
         its way. Read off the leap itself: ghost tick → column head, so the
         label can only ever say what the drawing is doing. */
      const leapt = x2Col >= 0 ? S.slots[x2Col] : undefined;
      if (x2Age > 0 && leapt) {
        const { x0 } = colX(l, x2Col);
        const note = leapNote(paidAt[x2Col]!, leapt.initialPrice);
        ctx.globalAlpha = Math.min(1, x2Age * 2.4);
        ctx.font = mono(l.narrow ? 8.5 : 9.5);
        ctx.textAlign = 'left';
        const tw = ctx.measureText(note).width;
        // A derived note is longer than a bare multiplier can be, and the last
        // column has nothing to its right, so hold the whole plate inside the
        // frame rather than letting the glyphs run off it.
        const nx = Math.max(l.axisW + 4, Math.min(x0, l.w - 5 - tw));
        ctx.fillStyle = KNOCK;
        ctx.fillRect(nx - 3, l.laneNote - 9, tw + 6, 13);
        ctx.fillStyle = inkA(0.88);
        ctx.fillText(note, nx, l.laneNote);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // --- where the payment goes ------------------------------------------
      // A bar permanently divided 80 / 20, that widens to the whole width for
      // the one case that deposits everything: a slot nobody has ever taken.
      const div = divShown;
      const isFull = depositFull;

      ctx.strokeStyle = RULE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(l.sepY) + 0.5);
      ctx.lineTo(l.w, Math.round(l.sepY) + 0.5);
      ctx.stroke();

      ctx.font = mono(l.narrow ? 8.5 : 9.5);
      ctx.textAlign = 'left';
      ctx.fillStyle = FAINT;
      ctx.fillText('MINE ALLOCATES THE PAYMENT', l.barX, l.sepY + 14);

      const dw = 2;
      ctx.fillStyle = BLUE_80;
      if (l.barW * div > 8) ctx.fillRect(l.barX, l.barY, l.barW * div - dw, l.barH);
      ctx.fillStyle = BLUE;
      ctx.fillRect(l.barX + l.barW * div, l.barY, l.barW * (1 - div), l.barH);

      const labY = l.barY + l.barH + 12;
      ctx.font = mono(l.narrow ? 8.5 : 9.5);
      ctx.textAlign = 'left';
      // inkA(0.55), not fainter: this label teaches the undisplaced case that
      // routes 100%, and at 0.3 it printed at 2.48:1 against the panel — below AA.
      ctx.fillStyle = isFull ? inkA(0.55) : MUTED;
      ctx.fillText(
        isFull ? 'NO ONE DISPLACED' : l.narrow ? '80% → CLAIM' : '80% → DISPLACED MINER CLAIM',
        l.barX,
        labY,
      );
      ctx.textAlign = 'right';
      ctx.fillStyle = BLUE;
      ctx.fillText(isFull ? '100% → ROUTER' : '20% → ROUTER', l.barX + l.barW, labY);
    }

    /* ------------------------------------------------------------ DOM paint */
    function paintSim(): void {
      let live = 0;
      S.slots.forEach(function (slot, i) {
        live += slot.tps;
        const c = cells.get(i);
        if (!c) return;
        const frac = Math.min(1, Math.max(0, (S.t - slot.startedAt) / DECAY));
        const open = slot.owner === null;
        const you = slot.owner === 'you';
        setText(c.owner, open ? 'open' : you ? 'you' : '@' + slot.owner);
        c.owner.classList.toggle('cell__owner--open', open);
        c.owner.classList.toggle('cell__owner--you', you);
        c.root.classList.toggle('cell--open', open);
        setText(c.price, '$' + priceOf(slot).toFixed(2));
        // Slot clock — EMPTY at (re)start, FULL at the hour, when the price has
        // decayed to zero. It fills; it does not drain.
        setWidth(c.bar, (frac * 100).toFixed(1) + '%');
        setText(c.sub, open ? 'never taken · 0/h' : gbx(slot.mined) + ' GBX · ' + Math.round(slot.tps * 3600) + '/h');
      });
      const d = Math.floor(S.t / 86400);
      const h = Math.floor((S.t % 86400) / 3600);
      const m = Math.floor((S.t % 3600) / 60);
      setText(els.clock, 'day ' + d + ', ' + pad2(h) + ':' + pad2(m));
      const n = neverTaken();
      setText(
        els.stateLine,
        n > 0
          ? n + (n === 1 ? ' slot never taken · it deposits 100%' : ' slots never taken · they deposit 100%')
          : 'every slot has been taken once · every take now splits 80/20',
      );
      /* …and the plot's own key says the same thing the counter does. While a
         never-taken slot remains, the blue key names a live deposit and a blue
         column is on the plot to point at. Once the last one is spent there is
         no blue column left and there never can be again, so the key stops
         advertising a deposit the reader can no longer see: it dims to spent
         rather than disappearing, because the history of watching it drain is
         the argument. Driven off the same count as the counter, so the head of
         the panel and its foot cannot say different things — including after a
         reset re-arms the board and the count returns to four. */
      els.keyOpen.classList.toggle('is-spent', n === 0);
      setText(els.tFund, money(S.routerDeposits));
      setText(els.tPaid, money(S.paidToMiners));
      setText(els.tGbx, gbx(S.totalMined));
      setText(els.tRate, Math.round(live * 3600).toLocaleString('en-US'));
      paintCanvas();
    }

    // Arrive mid-life: pre-run ten sim minutes so the reader lands on a board with
    // history — tallies non-zero, prices spread across the axis — and then
    // watches live purchases happen on top of it. `landOn` walks the programme
    // forward off-screen to a chosen beat, which is how the reduced-motion still
    // is composed without faking a state the mechanism cannot reach.
    function warmStart(landOn?: Beat): void {
      seedBoard();
      beatIdx = 0;
      nextBeat = Infinity; // no scripted beats during the warm-up
      warming = true;
      for (let k = 0; k < 100; k++) stepSim(6);
      if (landOn) {
        let guard = 0;
        // One beat per turn regardless of how long that beat is scheduled to
        // run for, so the walk cannot stall on a long scripted tenure.
        while (guard++ < 24 && PROGRAM[beatIdx % PROGRAM.length] !== landOn) {
          nextBeat = S.t;
          stepSim(BEAT);
        }
        nextBeat = Infinity;
      }
      warming = false;
      parts.length = 0;
      flash.fill(0);
      paidAt.fill(0);
      leapP.fill(1);
      x2Col = -1;
      x2Age = 0;
      depositFull = false;
      divFrom = 0.8;
      divTo = 0.8;
      divP = 1;
      divShown = 0.8;
      // Land on a real take rather than a placeholder: the tape, the deposit
      // bar and the money all tell the truth from the very first frame.
      if (resize()) paintCanvas();
      runBeat();
      // …including the bar. There is no previous allocation to ease away from on a
      // cold start, so the divider begins where the take it is drawn beside
      // already is, rather than sliding into agreement with its own caption.
      divShown = divFrom = divTo = depositFull ? 0 : 0.8;
      divP = 1;
    }
    warmStart();
    paintSim();

    let ro: ResizeObserver | null = null;
    if (hasRO) {
      ro = new ResizeObserver((entries) => {
        const e = entries[entries.length - 1];
        if (e) {
          /* refresh the size cache here, where the observer hands the box
             over for free, so the paint loop never reads layout */
          meas.w = Math.round(e.contentRect.width);
          meas.h = Math.round(e.contentRect.height);
        }
        const w = view.w;
        const h = view.h;
        if (resize() && (view.w !== w || view.h !== h)) paintCanvas();
      });
      ro.observe(canvas);
    }

    const unregister = registerSim({
      name: 'mining',
      // watch the panel, not the whole section: the drawing is what has to be
      // on screen for the loop to be worth running (as Fund.tsx already does)
      el: root.querySelector<HTMLElement>('.sim-panel') ?? root,
      timeScale: 60, // one real second ≈ one sim minute
      step: stepSim,
      paint: paintSim,
      // Scrolled back after a long absence: restart the mine at genesis so the
      // programme's first-ever-take beats are there to be seen again. The
      // harness only calls this on the off-screen → on-screen edge after 30s
      // away, so the board is never rewound under the reader's eyes.
      reset: function () {
        warmStart();
        paintSim();
      },
      static: function () {
        // A meaningful still: sixteen descents caught at sixteen different
        // points of their own hours, the reader's own take mid-leap with its
        // ghost tick and ×2 still showing, both halves of the payment caught in
        // the lane, and the counter still reporting the never-taken slots that
        // deposit 100% — both allocations taught in one frozen frame.
        warmStart('you-buy');
        stepSim(18);
        paintSim();
      },
    });

    return () => {
      unregister();
      ro?.disconnect();
      keyOpen.classList.remove('is-spent');
      cells.forEach((c) => {
        if (c.timer !== null) clearTimeout(c.timer);
        c.root.classList.remove('evt-blue');
      });
    };
  }, []);

  return (
    <section id="sec-mining" className="section section--rule" aria-labelledby="sec-mining-h" ref={rootRef}>
      <div className="container">
        <header className="sec-head sec-head--indexed reveal">
          <div className="sec-head__index">
            <span className="sec-head__num" aria-hidden="true">
              02
            </span>
            <p className="eyebrow eyebrow--blue">Mining</p>
          </div>
          <div className="sec-head__body">
            <h2 className="h1" id="sec-mining-h">
              Sixteen slots pay for everything
            </h2>
            <p className="lede">
              Mining funds the protocol&apos;s buying power. Miners pay USDG for one of sixteen permanent slots; Mine
              deposits the protocol share in ResonanceRouter for a later, separate routing call. There is no team
              allocation or presale.
            </p>
          </div>
        </header>

        <div className="sim-panel reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
          <div className="sim-panel__head">
            <span className="sim-panel__title sim-panel__title--blue">Mine — live model</span>
            <span className="chip chip--warn">Illustrative market activity</span>
          </div>
          <div className="sim-panel__body">
            <p className="note mn-cap">
              All sixteen slots, each on its own clock. Every one is always for sale: its price falls in a straight line
              to zero over one hour and restarts when taken.
            </p>

            <div className="mn-axis" aria-hidden="true">
              <span className="mn-axis__l">Price, USDG</span>
              <span className="mn-axis__key">
                <span className="mn-axis__k mn-axis__k--open" id="mn-key-open">
                  <i />
                  Never taken · 100% to Router
                </span>
                <span className="mn-axis__k mn-axis__k--held">
                  <i />
                  Occupied · 80/20
                </span>
              </span>
              <span className="mn-axis__r">Each column is one slot, one hour wide — zero at the foot</span>
            </div>
            <div className="mn-stage">
              <canvas
                id="mn-canvas"
                role="img"
                aria-label="Sixteen slot prices drawn as sixteen straight descents on one dollar axis, each falling to zero one hour after its own tenure began. When an occupied slot is taken, eighty per cent becomes a pull claim for the displaced miner and twenty per cent is deposited in ResonanceRouter. A first fill deposits the complete payment. Mine does not forward that Router deposit into Resonance."
              />
            </div>

            <div className="mn-tape">
              <div className="mn-tape__say">
                <p className="mn-tape__line" id="mn-buyline">
                  @moss takes slot 06 for $9.79.
                </p>
                <p className="note mn-tape__exit" id="mn-exitline">
                  @pike exits with 40.8 GBX, minted on the spot.
                </p>
              </div>
              <dl className="mn-route">
                <div className="mn-route__leg">
                  <dt id="mn-lab-miner">80% claim → @pike</dt>
                  <dd className="num" id="mn-val-miner">
                    $7.83
                  </dd>
                </div>
                <div className="mn-route__leg">
                  <dt id="mn-lab-fund">20% deposited → ResonanceRouter</dt>
                  <dd className="num blue" id="mn-val-fund">
                    $1.96
                  </dd>
                </div>
              </dl>
            </div>

            <div className="board mn-board" id="mn-board">
              {CELL_SHELL.map((c) => (
                <div className={'cell' + (c.open ? ' cell--open' : '')} key={c.id}>
                  <div className="cell__top">
                    <span className="cell__id">{c.id}</span>
                    <span className={'cell__owner' + (c.open ? ' cell__owner--open' : '')}>{c.owner}</span>
                  </div>
                  <div className="cell__price">{c.price}</div>
                  <div className="meter meter--blue">
                    <i style={{ width: c.width }} />
                  </div>
                  <div className="cell__sub">{c.sub}</div>
                </div>
              ))}
              <div className="cell--ghost">
                <em>+ twelve more slots</em>
                <i aria-hidden="true" />
                <em>each on its own clock, all drawn above</em>
              </div>
            </div>

            <dl className="tallies tallies--4 mn-tallies">
              <div className="tally">
                <dt>USDG deposited in ResonanceRouter</dt>
                <dd className="blue" id="mn-t-fund">
                  $0
                </dd>
              </div>
              <div className="tally">
                <dt>Claims credited to displaced miners</dt>
                <dd id="mn-t-paid">$0</dd>
              </div>
              <div className="tally">
                <dt>GBX mined so far</dt>
                <dd id="mn-t-gbx">0</dd>
              </div>
              <div className="tally">
                <dt>GBX per hour, all slots</dt>
                <dd id="mn-t-rate">—</dd>
              </div>
            </dl>
          </div>
          <div className="sim-panel__foot">
            <div className="sim-panel__controls">
              <span className="sim-clock" id="mn-clock">
                day 0, 00:00
              </span>
              <span className="mn-state" id="mn-state">
                4 slots never taken · they deposit 100%
              </span>
            </div>
            <p className="sim-note">
              Sped up ~60×; prices and taker timing are illustrative. Fixed development constants: ×2 restart, $1 USDG
              floor, and 64 GBX/s initially. The prospective rate halves every 69 days from Mine deployment to a 1 GBX/s
              tail; only new tenures receive the new rate.
            </p>
          </div>
        </div>

        <div className="cardrow cardrow--blue mn-facts reveal" style={{ '--d': '180ms' } as React.CSSProperties}>
          <div className="col">
            <span className="col__n" aria-hidden="true">
              01
            </span>
            <h3 className="h3 col__t">One hour to zero</h3>
            <p className="col__b">
              Every slot&apos;s price falls in a straight line to zero over one hour, forever. Take one and it restarts
              at twice what you paid, with a $1 USDG floor — so a slot nobody wants gets cheap and a contested slot gets
              expensive, with no oracle and no admin.
            </p>
          </div>
          <div className="col">
            <span className="col__n" aria-hidden="true">
              02
            </span>
            <h3 className="h3 col__t">80% claim, 20% Router deposit</h3>
            <p className="col__b">
              Taking an occupied slot credits 80% of the price as the displaced miner&apos;s pull claim and
              exact-transfers the other 20% into ResonanceRouter. A paid first fill deposits 100%. Mine then emits{' '}
              <span className="num">RevenueDeposited</span> and never calls <span className="num">route()</span>; a
              zero-price handoff moves no USDG.
            </p>
          </div>
          <div className="col">
            <span className="col__n" aria-hidden="true">
              03
            </span>
            <h3 className="h3 col__t">Your rate is locked</h3>
            <p className="col__b">
              A new tenure receives one-sixteenth of the prospective global rate at that moment. The schedule starts at
              64 GBX/s, halves every 69 days from Mine deployment, and stops falling at 1 GBX/s. Your assigned rate
              stays fixed for the whole tenure; what you mined is minted when that tenure ends.
            </p>
          </div>
        </div>
        <p className="small muted measure mn-next reveal" style={{ '--d': '270ms' } as React.CSSProperties}>
          Router deposits can wait indefinitely. If anyone later calls the permissionless route, qualifying revenue can
          enter Resonance&apos;s seven-day schedule — the Mine handoff itself never promises that step.
        </p>
      </div>
    </section>
  );
}
