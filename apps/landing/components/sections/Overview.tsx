'use client';

import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { fontFamily, registerSim } from '../../lib/harness';
import './overview.css';

/* ============================================================ the machine ==
   One picture of the whole protocol, drawn as a cutaway. The drawing is a
   stack of five bands, each opened by its own rule. Every band label lives
   in a reserved gutter (wide) or on its own reserved row (narrow), so no
   rule and no drawn part ever crosses a word. Under each band's rule sits a
   live callout that names the beat and runs a leader line to the exact part
   it is talking about.

     01 money in     sixteen slot mouths, each on its own clock; USDG falls
                     into the seven-day stream
     02 aimed        the stream meets a gate bar whose openings ARE the
                     signal weights; the flow fans into channels
     03 converted    worth rises in each channel while the ask falls; when
                     they meet, USDG crosses to the trader and the asset
                     comes back
     04 the fund     a vessel that fills with the spheres it bought, stacked
                     in ranks of ten so the holding is countable
     05 your share   burn GBX up the chute, the floor gate opens, and a
                     proportional slice of the vessel rolls down to you

   Nothing here reports a protocol figure. It is the shape of the mechanism,
   which is what the four columns underneath describe in words. ============*/

interface Beat {
  start: number;
  /** index of the stage column this beat lights */
  card: number;
  band: number;
  label: string;
  tint: 'blue' | 'pink' | 'gbx';
  /** the burn: the holder line lights too, and stage 04 ("Yours") stays lit */
  holder?: boolean;
}

/* Five beats on the sim's own accumulated clock — never wall-clock, so a
   section reached by scrolling has not already spent its cycle. Each beat
   lights one stratum and dims the rest: one idea at a time, guaranteed. */
const BEATS: Beat[] = [
  { start: 0.0, card: 0, band: 0, label: 'Miners pay in', tint: 'blue' },
  { start: 3.0, card: 1, band: 1, label: 'Holders aim it', tint: 'pink' },
  { start: 6.4, card: 2, band: 2, label: 'Auctions convert it', tint: 'pink' },
  { start: 9.4, card: 3, band: 3, label: 'The fund holds it', tint: 'gbx' },
  /* The burn is stage 04's own payoff — "Yours" — so the tracker holds its
     stop lit through it. Four stops for five beats only works if the fifth
     beat keeps the fourth's stop; otherwise the strip goes dark on the
     payoff, which is 22% of the cycle spent saying nothing. */
  { start: 11.8, card: 3, band: 4, label: 'Burn GBX · your share', tint: 'gbx', holder: true },
];
const FALLBACK_BEAT: Beat = BEATS[0] ?? { start: 0, card: 0, band: 0, label: '', tint: 'blue' };
const CYCLE = 15.4;
/* The things that must be SEEN are fired at fixed offsets inside their beat,
   so every one of them is guaranteed rather than left to chance: the holder
   aims, an auction settles inside the beat that explains auctions, another
   settles as the fund beat opens so the vessel is seen taking delivery, the
   slice about to leave is marked, and then the holder burns. Ambient
   randomness decides only which slot pays next. */
const AIM_AT = 3.35;
const CONV_AT = 6.75;
const FUND_AT = 9.6;
/* the slice is dimmed in place first, so the fraction is legible as a SHAPE
   across every rank before any of it moves */
const MARK_AT = 11.85;
const BURN_AT = 12.1;

const SLOTS = 16;
/* The at-rest strength of a band that is not the live one. It is a dimming,
   never a clearing: the panel carries the whole machine at every moment. */
const REST_A = 0.86;
/* The band names carry the ordinal, and they are the only thing allowed in
   the label gutter — one line each, never wrapped, never a peer of another. */
const BAND_LABEL = ['01 · MONEY IN', '02 · AIMED', '03 · CONVERTED', '04 · THE FUND', '05 · YOUR SHARE'];
/* One asset hue. The vessel holds what signal bought, so pink is the honest
   colour; the only variation is a deterministic ±4% in lightness keyed to
   grid position, which reads as light falling across a field of spheres and
   can never be decoded as two asset classes. */
const ASSET_HUE = '#f92b92';
const SHADES = 7;

interface Stage {
  n: string;
  tag: string;
  head: string;
  body: string;
  tone: 'blue' | 'pink' | 'gbx';
}
const STAGES: Stage[] = [
  {
    n: '01',
    tag: 'Money in',
    head: 'Miners pay in',
    body: "Sixteen mining slots, every one always for sale. The USDG miners pay is the fund's only buying power.",
    tone: 'blue',
  },
  {
    n: '02',
    tag: 'Aimed',
    head: 'Holders aim it',
    body: 'Revenue releases as a rolling seven-day stream, split moment to moment by where holders point their GBX.',
    tone: 'pink',
  },
  {
    n: '03',
    tag: 'Converted',
    head: 'Auctions convert it',
    body: 'Each Strategy sells its USDG at a falling price — paid in the target asset itself, never in dollars. No oracle anywhere.',
    tone: 'pink',
  },
  {
    n: '04',
    tag: 'Yours',
    head: 'The fund holds it',
    body: 'At least 80% of every purchase, in code. Ownerless — assets leave only when a holder burns GBX for their share.',
    tone: 'gbx',
  },
];

/* ------------------------------------------------------------- colour maths */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const n = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  return [parseInt(n.slice(0, 2), 16) || 0, parseInt(n.slice(2, 4), 16) || 0, parseInt(n.slice(4, 6), 16) || 0];
}
function mix(hex: string, to: [number, number, number], k: number, a = 1): string {
  const [r, g, b] = parseHex(hex);
  const f = (x: number, y: number) => Math.round(x + (y - x) * k);
  const c = f(r, to[0]) + ',' + f(g, to[1]) + ',' + f(b, to[2]);
  return a >= 1 ? 'rgb(' + c + ')' : 'rgba(' + c + ',' + a + ')';
}
/* the chute's walls: a neutral that clears 3:1 against --panel, so the path
   the payoff travels is visible before anything moves along it */
const CHUTE_WALL = '#6a6a7c';
/* the divider standing in the gap after every tenth sphere: clearly visible
   (2.6:1) but ranked below the vessel's own walls */
const RANK_TICK = '#55556a';
const WHITE: [number, number, number] = [255, 255, 255];
const SHADOW: [number, number, number] = [7, 6, 12];
const lighten = (c: string, k: number, a = 1) => mix(c, WHITE, k, a);
const darken = (c: string, k: number, a = 1) => mix(c, SHADOW, k, a);

/* ------------------------------------------------------------- world types */
interface Slot {
  x: number;
  phase: number;
  period: number;
}
interface Chan {
  i: number;
  share: number;
  target: number;
  /* geometry, refreshed whenever shares move */
  segX0: number;
  segX1: number;
  openX: number;
  openW: number;
  potW: number;
  cx: number;
  /* auction */
  pot: number;
  askStart: number;
  askT: number;
  epoch: number;
  flash: number;
  /* the lot this lane last cleared, held as a dimmed at-rest drawing so a
     lane that has just sold is never a blank column */
  ghostH: number;
}
interface Drop {
  x: number;
  y: number;
  /* 'fall' mouth → stream, 'meter' stream → gate opening, 'chan' gate → pot */
  phase: 0 | 1 | 2;
  x0: number;
  y0: number;
  tx: number;
  p: number;
  dur: number;
  ch: number;
}
interface Coin {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  p: number;
  dur: number;
}
interface Ball {
  /** the grid cell this sphere owns. The grid is FROZEN: a sphere never
      leaves its cell, so a burn is a slice out of a fixed quantity rather
      than a pack that peels and re-packs. */
  cell: number;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  p: number;
  dur: number;
  x: number;
  y: number;
  /** 1 while this sphere is marked as part of the slice about to leave */
  doom: number;
}
interface Out {
  /** the cell it is leaving, held so the marked slice can be outlined while
      it drains and so an arrival can be re-seated behind it */
  cell: number;
  v: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** leg 0: 0→1 along the run to the gate. leg 1: arc-length fraction of the
      chute, so equal time is equal distance on a curve. */
  p: number;
  wait: number;
  leg: 0 | 1;
  /** leg-0 duration, set from the distance so every sphere in the slice
      travels at one speed and none can overtake — or interpenetrate */
  dur0: number;
  dur1: number;
}
/** a sphere resting in the chute: the last delivery, held as an at-rest
    drawing, at the same queue positions the moving train uses */
interface Held {
  v: number;
  u: number;
}
interface Splash {
  x: number;
  life: number;
}

interface Layout {
  W: number;
  H: number;
  fs: number;
  ui: number;
  narrow: boolean;
  /* the reserved label gutter, and the first x any drawn part may occupy */
  lgut: number;
  strip: number;
  mx0: number;
  mx1: number;
  px0: number;
  /* band rules, top to bottom, plus the reserved rows their type sits on */
  band: [number, number, number, number, number];
  labelY: number[];
  calloutY: number[];
  combY: number;
  mouthY: number;
  mouthW: number;
  slotStep: number;
  trY0: number;
  trY1: number;
  gateY: number;
  gateH: number;
  aucTop: number;
  aucY: number;
  potMax: number;
  ghostY: number;
  vx0: number;
  vx1: number;
  vy0: number;
  vy1: number;
  pad: number;
  cols: number;
  sp: number;
  rowStep: number;
  sr: number;
  rows: number;
  cap: number;
  /** ranks are built from GROUPS of ten with a half-diameter gap between
      them, so the holding can be counted at a glance at every width */
  groups: number;
  holeX: number;
  holeW: number;
  minerX: number;
  minerY: number;
  traderX: number;
  traderY: number;
  youX: number;
  youY: number;
  /** the chute measured by ARC LENGTH: u sampled at equal arc fractions, the
      total length, and the fraction at which a sphere's leading edge reaches
      the mouth — nothing on the chute is ever drawn past that */
  arcU: number[];
  arcLen: number;
  exitS: number;
  perSphere: number;
  periodBase: number;
  epochBase: number;
  chanN: number;
  sprites: (HTMLCanvasElement | null)[];
  shadow: HTMLCanvasElement | null;
  gbxSprite: HTMLCanvasElement | null;
}

interface Pal {
  pink: string;
  blue: string;
  hi: string;
  muted: string;
  faint: string;
  rule: string;
  ruleS: string;
  pinkL: string;
  blueL: string;
  panel: string;
}

function readPal(): Pal {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return {
    pink: v('--pink', '#f92b92'),
    blue: v('--blue', '#29b6f0'),
    hi: v('--hi', '#ffffff'),
    muted: v('--muted', '#adadc0'),
    faint: v('--faint', '#8a8aa0'),
    rule: v('--rule', '#26262f'),
    ruleS: v('--rule-strong', '#3b3b48'),
    pinkL: v('--pink-label', '#fb63ac'),
    blueL: v('--blue-label', '#9bddfa'),
    panel: v('--panel', '#101017'),
  };
}

export function Overview() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const canvasQ = root.querySelector<HTMLCanvasElement>('#ovCanvas');
    const holderQ = root.querySelector<HTMLElement>('#ovHolder');
    const stripQ = root.querySelector<HTMLElement>('#ovStages');
    /* The harness watches the PANEL, not the <section>. The hero is a full
       viewport, so this section's top edge sits exactly on the fold at every
       desktop height — the section is "visible" to the harness at scroll 0 and
       the loop would spend its cycle while the reader is still reading the
       hero, then greet them mid-argument. The panel is ~280px lower, which is
       clear of the warm band, so the clock starts when the drawing does. This
       is the same element choice Fund.tsx already makes. */
    const panelQ = root.querySelector<HTMLElement>('.ov-panel');
    const stageEls = Array.from(root.querySelectorAll<HTMLElement>('.ov-stage'));
    if (!canvasQ || !holderQ || !stripQ || !panelQ || stageEls.length !== STAGES.length) return;
    const ctxQ = canvasQ.getContext('2d');
    if (!ctxQ) return;

    /* narrowed aliases — TS does not carry the guard above into the closures */
    const canvas = canvasQ;
    const holderEl = holderQ;
    const stripEl = stripQ;
    const panelEl = panelQ;
    const ctx = ctxQ;

    let pal = readPal();
    let mono = "'JetBrains Mono', monospace";
    let L: Layout | null = null;

    /* --------------------------------------------------------------- world */
    const slots: Slot[] = [];
    const chans: Chan[] = [];
    const drops: Drop[] = [];
    const coins: Coin[] = [];
    const pile: Ball[] = [];
    const outs: Out[] = [];
    /* spheres an auction has bought, waiting their turn to be delivered: a
       lot arrives in file rather than as one heap of four */
    const EMIT_GAP = 0.38;
    let emitPend = 0;
    let emitCd = 0;
    /* what the last burn delivered, left standing in the chute at rest: the
       payoff band always shows the path AND what travelled it, so the moving
       frame is a brightening of the still rather than the only thing drawn */
    const chute: Held[] = [];
    const splash: Splash[] = [];
    const trough = { level: 0.5, acc: 0 };
    let aimP = -1;
    let aimTarget = 0;
    let burnP = -1;
    let burnFlash = 0;
    let gateOpen = 0;
    /* 1 the instant the chute delivers a sphere into YOU, decaying after: the
       terminal marker lights as it receives instead of being buried by a pile
       of spheres parked on top of it */
    let youTake = 0;
    let t = 0;
    let cycles = 0;
    let fired = 0;
    let staticMode = false;
    let bandA = [1, 1, 1, 1, 1];
    let liveCard = -2;
    /* the slot the 01 callout points at — chosen once per beat so the leader
       line does not skitter from mouth to mouth while the reader looks */
    let calloutSlot = 5;

    for (let i = 0; i < SLOTS; i++) {
      slots.push({ x: 0, phase: Math.random(), period: 3.4 + Math.random() * 2.6 });
    }

    /* The channel count is a function of the width: four lanes at full size,
       or two at full size plus a ghost row, never four squeezed to stubs. */
    function ensureChans(n: number) {
      if (chans.length === n) return;
      const base = n <= 2 ? [0.58, 0.42] : [0.34, 0.26, 0.22, 0.18];
      chans.length = 0;
      for (let i = 0; i < n; i++) {
        const s = base[i] ?? 1 / n;
        chans.push({
          i,
          share: s,
          target: s,
          segX0: 0,
          segX1: 0,
          openX: 0,
          openW: 0,
          potW: 12,
          cx: 0,
          pot: 2 + Math.random() * 5,
          askStart: 1.0 + Math.random() * 0.14,
          /* each channel gets its own reservation and dwell so they never
             reach their ask together and settle in one frame */
          askT: Math.random() * 3,
          epoch: 3.6 + Math.random() * 3.4,
          flash: 0,
          ghostH: 0,
        });
      }
      drops.forEach((d) => {
        if (d.ch >= n) d.ch = n - 1;
      });
      aimTarget = aimTarget % n;
    }
    ensureChans(4);

    /* ------------------------------------------------------------- sprites --
       One renderer for every sphere on the page: the ones in the vessel, the
       ones in flight, and the GBX being burned. One light source, upper left. */
    function makeBall(base: string, r: number): HTMLCanvasElement | null {
      /* supersampled a step beyond the display: the specular is a couple of
         pixels wide and goes grey the moment it is resampled down */
      const dpr = Math.min(3, (window.devicePixelRatio || 1) + 1);
      const d = Math.ceil(r * 2) + 4;
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round(d * dpr));
      c.height = Math.max(2, Math.round(d * dpr));
      const g = c.getContext('2d');
      if (!g) return null;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = d / 2;
      const cy = d / 2;
      const lx = cx - r * 0.34;
      const ly = cy - r * 0.38;
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.clip();
      /* body: lit face through the terminator to a darkened edge */
      const body = g.createRadialGradient(lx, ly, r * 0.05, cx, cy, r * 1.22);
      body.addColorStop(0, lighten(base, 0.44));
      body.addColorStop(0.34, base);
      body.addColorStop(0.78, darken(base, 0.44));
      body.addColorStop(1, darken(base, 0.7));
      g.fillStyle = body;
      g.fillRect(0, 0, d, d);
      /* reflected light: the bounce that keeps the shadow side from going dead */
      const bx = cx + r * 0.5;
      const by = cy + r * 0.6;
      const bounce = g.createRadialGradient(bx, by, r * 0.02, bx, by, r * 0.8);
      bounce.addColorStop(0, lighten(base, 0.3, 0.36));
      bounce.addColorStop(1, lighten(base, 0.3, 0));
      g.fillStyle = bounce;
      g.fillRect(0, 0, d, d);
      /* rim light on the lit edge — the one mark that makes a disc a sphere */
      g.beginPath();
      g.arc(cx, cy, r - Math.max(0.5, r * 0.06), Math.PI * 1.02, Math.PI * 1.74);
      g.lineWidth = Math.max(0.9, r * 0.12);
      const rim = g.createLinearGradient(cx - r, cy - r, cx + r * 0.3, cy + r * 0.3);
      rim.addColorStop(0, 'rgba(255,255,255,.34)');
      rim.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = rim;
      g.stroke();
      /* specular: white, tight, offset toward the light */
      const sr2 = Math.max(1.8, r * 0.42);
      const spec = g.createRadialGradient(lx, ly, 0, lx, ly, sr2);
      spec.addColorStop(0, 'rgba(255,255,255,.96)');
      spec.addColorStop(0.3, 'rgba(255,255,255,.76)');
      spec.addColorStop(0.62, 'rgba(255,255,255,.2)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = spec;
      g.fillRect(0, 0, d, d);
      g.restore();
      return c;
    }

    function makeShadow(r: number): HTMLCanvasElement | null {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(4, Math.ceil(r * 2.3));
      const h = Math.max(2, Math.ceil(r * 0.86));
      const c = document.createElement('canvas');
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const g = c.getContext('2d');
      if (!g) return null;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.translate(w / 2, h / 2);
      g.scale(1, h / w);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
      grad.addColorStop(0, 'rgba(0,0,0,.46)');
      grad.addColorStop(0.5, 'rgba(0,0,0,.24)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(-w / 2, -w / 2, w, w);
      return c;
    }

    /* -------------------------------------------------------------- layout */
    function labelWidth(s: string, size: number, track: number) {
      ctx.font = '500 ' + size.toFixed(1) + 'px ' + mono;
      return ctx.measureText(s).width + s.length * size * track;
    }

    function buildLayout(W: number, H: number) {
      /* The CSS owns the box; the drawing reads its shape back, so the two
         can never disagree about which way round the machine is laid out. */
      const narrow = W < 620 || W / H < 1.2;
      const fs = narrow ? 9.4 : 11;
      const y = (p: number) => Math.round((p / 1000) * H);
      const strip = Math.round(fs + 13);
      const mx0 = 1;
      /* Wide: the three parties stand in a right-hand gutter, and the band
         names get a measured left gutter. Narrow: both gutters are spent on
         the drawing — the parties attach inline and the names take a row. */
      const rgut = narrow ? 0 : 128;
      const mx1 = Math.round(W - rgut - (narrow ? 2 : 0));
      const lgut = narrow ? 0 : Math.ceil(BAND_LABEL.reduce((m, s) => Math.max(m, labelWidth(s, fs, 0.14)), 0));
      const px0 = mx0 + (lgut > 0 ? lgut + 24 : 0);
      const gx = mx1 + rgut / 2;

      /* Every band's content starts a clear line below its callout row: the
         callout's knockout plate must never bite into a drawn part. */
      const band: [number, number, number, number, number] = narrow
        ? [y(28), y(252), y(404), y(696), y(878)]
        : [y(18), y(232), y(384), y(636), y(864)];
      const combY = narrow ? y(84) : y(66);
      const mouthY = narrow ? y(118) : y(100);
      const trY0 = narrow ? y(176) : y(160);
      const trY1 = narrow ? y(216) : y(202);
      const gateY = narrow ? y(296) : y(282);
      const aucTop = narrow ? y(452) : y(436);
      const aucY = narrow ? y(600) : y(610);
      const ghostY = narrow ? y(646) : y(636);
      const vy0 = narrow ? y(740) : y(688);
      const vy1 = narrow ? y(878) : y(864);
      const youY = narrow ? y(974) : y(948);
      /* Every band name gets a reserved row of its own — in the left gutter
         where there is one, otherwise above the band's rule. Band 05's name
         goes UNDER the vessel floor, never inside the vessel. The callout
         then takes the row beneath the name. Nothing else may enter either. */
      const labelY = band.map((b, i) =>
        narrow ? (i === 4 ? vy1 + fs + 9 : b - 6) : b + fs * 0.36,
      );
      const calloutY = band.map((b, i) => (narrow && i === 4 ? vy1 + fs + 9 : b) + strip - 6);

      const vx0 = px0 + (narrow ? 3 : 10);
      /* The vessel keeps to the left; the chute and the holder use the space
         beside it. Nothing in this drawing is centred. */
      const vx1 = narrow ? mx1 - 3 : Math.round(px0 + (mx1 - px0) * 0.86);
      const pad = narrow ? 4 : 7;
      const innerW = vx1 - vx0 - pad * 2;
      const innerH = vy1 - vy0 - 6;
      /* Ranks of ten, and they must LOOK like ranks of ten: the rank is built
         from groups of exactly ten with a full empty column — half a diameter
         of clear air either side of a divider — between every group. A reader
         counts groups, not spheres, at any width. */
      const groups = Math.max(1, Math.min(4, Math.round(innerW / 232)));
      const cols = groups * 10;
      /* one empty column-unit per gap, so the pitch inside a group is even,
         plus a column and a half at the right end kept clear as the DRAIN
         LANE: the slice a burn takes steps sideways into it along its own
         emptied rank and falls to the gate down a path of its own, so a
         sphere on its way out never crosses one that is staying. */
      const laneU = 1.5;
      const sp = innerW / (cols + (groups - 1) + laneU);
      const sr = Math.max(3.5, Math.min(sp * 0.47, 26));
      /* just clear of the sphere diameter (0.94 * sp), so ranks stack in
         contact and never overlap */
      const rowStep = sp * 0.955;
      const rows = Math.max(2, Math.floor(innerH / rowStep));
      const cap = cols * rows;
      const periodBase = narrow ? 4.6 : 3.4;
      const epochBase = narrow ? 8 : 6.4;
      const dropsPerCycle = (SLOTS * CYCLE) / periodBase;
      const perSphere = Math.max(2.5, Math.min(26, dropsPerCycle / Math.max(2, cap * 0.62 * 0.26)));
      const shades: string[] = [];
      for (let i = 0; i < SHADES; i++) {
        const k = ((i - (SHADES - 1) / 2) / ((SHADES - 1) / 2)) * 0.04;
        shades.push(k >= 0 ? lighten(ASSET_HUE, k) : darken(ASSET_HUE, -k));
      }
      return {
        W,
        H,
        fs,
        ui: narrow ? 0.82 : 1,
        narrow,
        lgut,
        strip,
        mx0,
        mx1,
        px0,
        band,
        labelY,
        calloutY,
        combY,
        mouthY,
        mouthW: Math.min(24, ((mx1 - px0) / SLOTS) * 0.58),
        slotStep: (mx1 - px0 - 14) / SLOTS,
        trY0,
        trY1,
        gateY,
        gateH: Math.max(7, y(13)),
        aucTop,
        aucY,
        /* the ask starts above any pot the lane can hold, but never so high
           that it climbs into the caption row and puts a leader inside a word */
        potMax: Math.round((aucY - aucTop) / 1.45),
        ghostY,
        vx0,
        vx1,
        vy0,
        vy1,
        pad,
        cols,
        sp,
        rowStep,
        sr,
        rows,
        cap,
        groups,
        /* the gate is the foot of the drain lane, so the path out of the
           vessel and the chute below it are one continuous channel */
        holeX: Math.round(vx0 + pad + sp * (cols + groups - 1 + laneU / 2)),
        holeW: Math.max(2 * sr + 6, sp * laneU),
        minerX: narrow ? mx1 - 7 : gx,
        minerY: combY,
        traderX: narrow ? mx1 - 7 : gx,
        traderY: aucY,
        youX: narrow ? mx1 - 7 : gx,
        youY,
        arcU: [] as number[],
        arcLen: 1,
        exitS: 1,
        perSphere,
        periodBase,
        epochBase,
        chanN: narrow ? 2 : 4,
        sprites: shades.map((c) => makeBall(c, sr)),
        shadow: makeShadow(sr),
        gbxSprite: makeBall('#e6e6ee', Math.max(3.5, sr * 0.6)),
      } satisfies Layout;
    }

    function layoutSlots(l: Layout) {
      slots.forEach((s, i) => {
        s.x = l.px0 + 7 + l.slotStep * (i + 0.5);
      });
    }

    /* Gate openings ARE the signal weights: the geometry is recomputed from
       the live shares, so aiming the stream physically reshapes the machine. */
    function layoutGates(l: Layout) {
      const span = l.mx1 - l.px0 - 8;
      let x = l.px0 + 4;
      chans.forEach((c) => {
        const w = span * c.share;
        c.segX0 = x;
        c.segX1 = x + w;
        c.openW = Math.max(9, Math.min(w * 0.42, 54));
        c.openX = x + w / 2;
        c.cx = c.openX;
        c.potW = Math.max(9, Math.min(w * 0.3, 62));
        x += w;
      });
    }

    /* ONE reading order for the whole vessel: LEFT TO RIGHT along a rank,
       bottom rank first. Cell 0 is the bottom-left sphere; every tenth
       sphere is followed by an empty column-unit, so the rank reads as
       groups of ten. Filling appends at the tail of that order, a burn takes
       the tail of that order, and refill continues the same tail — so the
       holding is ALWAYS full ranks plus one partial rank at the end, with no
       interior hole and no detached row at any instant.
       The grid is FROZEN — a sphere keeps its cell until it leaves the fund —
       so the vessel is a fixed quantity that a burn slices, and survivors
       never move, never re-pack, and never interpenetrate. */
    function unitOf(j: number) {
      return j + Math.floor(j / 10);
    }
    function ballPos(l: Layout, cell: number) {
      const row = Math.floor(cell / l.cols);
      const j = cell % l.cols;
      return {
        x: l.vx0 + l.pad + l.sp * (unitOf(j) + 0.5),
        y: l.vy1 - 3 - l.sr - l.rowStep * row,
      };
    }
    /* keyed to the cell, so a sphere's value never changes under the reader
       and the field reads as many objects rather than one pink mass */
    const shadeOf = (cell: number) => (cell * 3 + Math.floor(cell / 7) * 2) % SHADES;

    let occ: boolean[] = [];
    function lowestFree(l: Layout) {
      for (let i = 0; i < l.cap; i++) if (!occ[i]) return i;
      return -1;
    }
    /* re-seat the holding on a new grid: keep what still fits, snap it home,
       and top the fund up to its resting level so it is never drawn empty */
    function seat(l: Layout) {
      occ = new Array(l.cap).fill(false);
      for (let i = pile.length - 1; i >= 0; i--) {
        const b = pile[i];
        if (!b || b.cell >= l.cap || occ[b.cell]) pile.splice(i, 1);
        else occ[b.cell] = true;
      }
      pile.forEach((b) => {
        const p = ballPos(l, b.cell);
        b.x = p.x;
        b.y = p.y;
        b.sx = p.x;
        b.sy = p.y;
        b.cx = p.x;
        b.cy = p.y;
        b.p = 1;
        b.doom = 0;
      });
      const want = Math.max(4, Math.round(l.cap * 0.62));
      while (pile.length < want) {
        const c = lowestFree(l);
        if (c < 0) break;
        occ[c] = true;
        const p = ballPos(l, c);
        pile.push({ cell: c, sx: p.x, sy: p.y, cx: p.x, cy: p.y, p: 1, dur: 1, x: p.x, y: p.y, doom: 0 });
      }
    }

    function resize(): boolean {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      /* Full-page capture bounces the viewport through a degenerate size
         before restoring it; never rebuild from that frame. */
      if (w < 120 || h < 120) return L !== null;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(w * dpr);
      const bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!L || L.W !== w || L.H !== h) {
        L = buildLayout(w, h);
        chuteTable(L);
        ensureChans(L.chanN);
        layoutSlots(L);
        layoutGates(L);
        seat(L);
      }
      return true;
    }

    /* ---------------------------------------------------------------- text */
    let tracking: boolean | null = null;
    /* Every caption is printed on an OPAQUE plate of the panel's own ground,
       so a drop passing behind it can never eat the word and every label's
       contrast is exactly its ink against --panel — measurable, not incidental. */
    function plateBox(x: number, y: number, w: number, size: number, align: CanvasTextAlign) {
      const kx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
      return { x0: kx - 4, y0: y - size - 2, x1: kx + w + 4, y1: y + 5 };
    }
    function plate(x: number, y: number, w: number, size: number, align: CanvasTextAlign) {
      const b = plateBox(x, y, w, size, align);
      const a = ctx.globalAlpha;
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.panel;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.globalAlpha = a;
    }
    function text(
      s: string,
      x: number,
      y: number,
      size: number,
      color: string,
      align: CanvasTextAlign,
      track = 0.14,
      knock = false,
    ) {
      ctx.font = '500 ' + size.toFixed(1) + 'px ' + mono;
      ctx.textBaseline = 'alphabetic';
      if (tracking === null) tracking = 'letterSpacing' in ctx;
      let mw = 0;
      if (tracking) mw = ctx.measureText(s).width + s.length * size * track;
      else for (const ch of s) mw += ctx.measureText(ch).width + size * track;
      if (knock) plate(x, y, mw, size, align);
      ctx.fillStyle = color;
      if (tracking) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = (size * track).toFixed(2) + 'px';
        ctx.textAlign = align;
        ctx.fillText(s, x, y);
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
        return mw;
      }
      const step = size * track;
      let cx = align === 'right' ? x - mw : align === 'center' ? x - mw / 2 : x;
      ctx.textAlign = 'left';
      for (const ch of s) {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + step;
      }
      return mw;
    }

    /* -------------------------------------------------------------- labels --
       EVERY printed word in the drawing goes through here, at full strength on
       an opaque plate. A band at rest dims its DRAWING, never its key: the
       floor for any label is --faint (5.7:1) and the five band names sit at
       --muted (8.7:1). Emphasis is carried by colour — the live band's name
       takes its tint — not by taking a word below readable. */
    interface Box {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }
    function labBox(s: string, x: number, y: number, size: number, align: CanvasTextAlign, track: number): Box {
      return plateBox(x, y, labelWidth(s, size, track), size, align);
    }
    /* every printed word registers its plate, and no leader may cross one */
    const chipBoxes: Box[] = [];
    function lab(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign, track = 0.14) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = 1;
      const w = text(s, x, y, size, color, align, track, true);
      ctx.globalAlpha = a;
      chipBoxes.push(plateBox(x, y, w, size, align));
      return w;
    }

    /* ------------------------------------------------------------- leaders --
       Leader geometry is laid down BEFORE any chip and is cut around every
       chip box, so a leader can never be printed across a word and no
       arrowhead can land inside a label. */
    function inBox(x: number, y: number, boxes: Box[], pad = 5) {
      return boxes.some((b) => x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad);
    }
    function cutRun(lo: number, hi: number, blocks: [number, number][]) {
      const segs: [number, number][] = [];
      let cur = lo;
      blocks
        .slice()
        .sort((a, b) => a[0] - b[0])
        .forEach(([a, b]) => {
          if (b <= cur) return;
          if (a > cur) segs.push([cur, Math.min(a, hi)]);
          cur = Math.max(cur, b);
        });
      if (cur < hi) segs.push([cur, hi]);
      return segs.filter(([a, b]) => b - a > 2.5);
    }
    /* both return the runs they actually DREW, so an arrowhead can be put on
       the end of a line that exists rather than floating in a cut gap */
    function hRun(x0: number, x1: number, y: number, boxes: Box[], color: string, alpha: number) {
      const blocks = boxes.filter((b) => y >= b.y0 - 4 && y <= b.y1 + 4).map((b) => [b.x0 - 6, b.x1 + 6] as [number, number]);
      const segs = cutRun(Math.min(x0, x1), Math.max(x0, x1), blocks);
      segs.forEach(([a, b]) => tick(a, y, b, y, color, alpha));
      return segs;
    }
    function vRun(y0: number, y1: number, x: number, boxes: Box[], color: string, alpha: number) {
      const blocks = boxes.filter((b) => x >= b.x0 - 4 && x <= b.x1 + 4).map((b) => [b.y0 - 6, b.y1 + 6] as [number, number]);
      const segs = cutRun(Math.min(y0, y1), Math.max(y0, y1), blocks);
      segs.forEach(([a, b]) => tick(x, a, x, b, color, alpha));
      return segs;
    }
    /* a leader at any angle, walked in short steps and broken wherever it
       would enter a chip — the narration's line can never sit on a word */
    function segRun(x0: number, y0: number, x1: number, y1: number, boxes: Box[], color: string, alpha: number) {
      const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let open = false;
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const x = x0 + (x1 - x0) * u;
        const y = y0 + (y1 - y0) * u;
        if (inBox(x, y, boxes, 5)) {
          open = false;
          continue;
        }
        if (open) ctx.lineTo(x, y);
        else {
          ctx.moveTo(x, y);
          open = true;
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    /* --------------------------------------------------------------- model */
    function emitSphere(l: Layout) {
      const cell = lowestFree(l);
      if (cell < 0) return;
      occ[cell] = true;
      const p = ballPos(l, cell);
      const sx = l.traderX;
      const sy = l.traderY + Math.max(12, l.sr * 0.9 + 9);
      pile.push({
        cell,
        sx,
        sy,
        cx: (sx + p.x) / 2,
        cy: Math.min(sy, p.y) - l.H * 0.1,
        p: 0,
        /* one flight time for every arrival. With a random one, a later
           sphere could overtake the one in front and be drawn inside it;
           fixed, the release stagger below is a guaranteed separation. */
        dur: 1.05,
        x: sx,
        y: sy,
        doom: 0,
      });
    }

    /* A lot of several spheres arrives in FILE, not in a heap. What an
       auction bought is queued and released one at a time, never closer than
       EMIT_GAP apart and never while a burn is draining — so two arrivals are
       never drawn inside each other, and a backlog held back during a burn
       comes out in file afterwards rather than all in one frame. */
    function queueSpheres(n: number) {
      emitPend = Math.min(12, emitPend + n);
    }

    function settle(l: Layout, c: Chan) {
      const n = Math.max(1, Math.min(4, Math.round(c.pot / l.perSphere)));
      const m = Math.max(2, Math.min(7, Math.round(c.pot / 2)));
      const potH = Math.min(l.potMax, c.pot * (l.potMax / 9));
      for (let k = 0; k < m; k++) {
        coins.push({
          x0: c.cx,
          y0: l.aucY - potH * (0.15 + Math.random() * 0.7),
          cx: (c.cx + l.traderX) / 2,
          cy: l.aucY - l.H * 0.075,
          p: -k * 0.055,
          dur: 0.62,
        });
      }
      queueSpheres(n);
      /* the lot that just cleared is held as a dimmed ghost until this lane
         clears again, so a lane is never a blank column between auctions */
      c.ghostH = potH;
      c.pot = Math.max(0, c.pot - n * l.perSphere);
      c.flash = 1;
      c.askStart = 1.0 + Math.random() * 0.14;
      c.askT = 0;
      /* a fresh reservation each tenure — the auctions never march in step */
      c.epoch = l.epochBase * (0.78 + Math.random() * 0.62);
    }

    /* Nudge the ask on whichever channel is holding the most to zero: the fill
       still happens the only way the model allows — ask meets worth — but the
       beat that explains auctions is guaranteed to contain one. */
    function fullestChan(): Chan | undefined {
      let bi = 0;
      for (let i = 1; i < chans.length; i++) {
        const a = chans[i];
        const b = chans[bi];
        if (a && b && a.pot > b.pot) bi = i;
      }
      return chans[bi];
    }
    function forceSettle() {
      const pick = fullestChan();
      if (pick && pick.pot > 0.6) pick.askT = pick.epoch;
    }

    function doAim() {
      const boost = 0.13;
      const others = chans.filter((c) => c.i !== aimTarget);
      const pool = others.reduce((a, c) => a + c.share, 0);
      chans.forEach((c) => {
        c.target = c.i === aimTarget ? c.share + boost : c.share - (boost * c.share) / Math.max(0.001, pool);
      });
      let sum = 0;
      const lo = chans.length <= 2 ? 0.24 : 0.09;
      const hi = chans.length <= 2 ? 0.76 : 0.52;
      chans.forEach((c) => {
        c.target = Math.max(lo, Math.min(hi, c.target));
        sum += c.target;
      });
      chans.forEach((c) => {
        c.target /= sum;
      });
    }

    /* A burn takes the same fraction of everything the vessel holds, and it
       takes it as the TAIL of the one reading order the vessel is filled in.
       What is left is therefore always full ranks plus one partial rank at
       the end — countable at a glance, with no hole in it — and refill
       carries straight on from that partial rank. The slice is marked
       (dimmed in place, outlined) a beat before it moves, so the fraction is
       legible as a shape before any of it travels. */
    let burnFrac = 0.24;
    function markBurn(l: Layout, first: boolean) {
      if (first) {
        burnFrac = pile.length > l.cap * 0.72 ? 0.3 : pile.length < l.cap * 0.45 ? 0.16 : 0.24;
        chute.length = 0;
        /* anything still in the air lands NOW, well before the gate opens:
           no sphere is ever crossing the vessel while the slice leaves it.
           They land in the order they are flying in, one after another, so
           hurrying them can never pack two into the same place. */
        pile
          .filter((b) => b.p < 1)
          .sort((a, b) => b.p - a.p)
          .forEach((b, i) => {
            b.dur = (0.12 + i * 0.1) / Math.max(0.05, 1 - b.p);
          });
      }
      /* Re-marked every frame until the gate opens, so a sphere that lands
         in the meantime joins the slice instead of being stranded above it:
         what the outline shows is exactly what leaves. */
      const all = pile.slice().sort((a, b) => b.cell - a.cell);
      const n = Math.min(all.length, Math.max(1, Math.round(pile.length * burnFrac)));
      all.forEach((b, k) => {
        b.doom = k < n ? 1 : 0;
      });
    }

    /* After a burn, anything left standing ABOVE the unbroken run — an
       arrival that came in while the slice was marked — drops into the
       lowest free cell. Everything inside the run keeps its cell and never
       moves; this only ever touches the one or two spheres at the very top,
       and it is what guarantees the holding is a solid run at every instant. */
    function reseat(l: Layout) {
      const sorted = pile.slice().sort((a, b) => a.cell - b.cell);
      let k = 0;
      while (k < sorted.length && (sorted[k]?.cell ?? -1) === k) k++;
      const loose = sorted.slice(k);
      if (loose.length === 0) return;
      loose.forEach((b) => {
        occ[b.cell] = false;
      });
      loose.forEach((b) => {
        const c = lowestFree(l);
        if (c < 0) {
          occ[b.cell] = true;
          return;
        }
        occ[c] = true;
        if (c === b.cell) return;
        b.cell = c;
        if (b.p >= 1) {
          /* it had already landed, so it settles into its new slot rather
             than snapping — an arrival still finding its place */
          const q = ballPos(l, c);
          b.sx = b.x;
          b.sy = b.y;
          b.cx = (b.x + q.x) / 2;
          b.cy = Math.min(b.y, q.y) - l.rowStep * 0.9;
          b.p = 0;
          b.dur = 0.42;
        }
      });
    }

    /** The lift a sphere makes on its way out: clear of its own rank line, so
        a sphere leaving is never mistaken for one still standing in it — but
        never steeper than about 24°, because the turn into the lane is what
        sets the closest two spheres in the train ever come, and a steep
        approach into a vertical drop is the one place that can pinch. */
    function outRise(l: Layout, sx: number) {
      return Math.min(l.rowStep * 1.15, Math.abs(l.holeX - sx) * 0.45);
    }
    /** the two legs out of the vessel: up and across to the drain lane over
        cells the slice has ALREADY given up, then straight down the lane */
    function outLegs(l: Layout, sx: number, sy: number) {
      const rise = outRise(l, sx);
      const a = Math.hypot(l.holeX - sx, rise);
      const b = l.vy1 + 2 - (sy - rise);
      return { a, b, rise, tot: a + Math.max(0, b) };
    }

    function doBurn(l: Layout) {
      const gone = pile.filter((b) => b.doom > 0);
      if (gone.length === 0) return;
      /* The slice leaves in the EXACT REVERSE of the order the vessel was
         filled in — last sphere first, right to left along a rank, top rank
         down. Two things follow. What is left in the fund is a solid run at
         every instant of the drain, never a hole. And each sphere's way out
         is already clear: it lifts clear of its own rank and crosses to the
         drain lane over cells the slice has already given up — every point
         on that diagonal is a higher cell than its own, and every higher
         cell has already gone — then falls down the lane. Nothing on its way
         out is ever drawn over anything that is staying.
         One constant speed and a SCHEDULED arrival at the gate: consecutive
         spheres are always more than a clear diameter apart, at the corner
         as well as on the straights, so the train never stacks. */
      gone.sort((a, b) => b.cell - a.cell);
      const spd = outSpeed(l);
      const gapT = releaseGapPx(l) / spd;
      let enter = 0;
      gone.forEach((b, k) => {
        occ[b.cell] = false;
        const d0 = Math.max(0.02, outLegs(l, b.x, b.y).tot / spd);
        enter = k === 0 ? d0 : Math.max(enter + gapT, d0);
        outs.push({
          cell: b.cell,
          v: shadeOf(b.cell),
          x: b.x,
          y: b.y,
          sx: b.x,
          sy: b.y,
          p: 0,
          wait: enter - d0,
          leg: 0,
          dur0: d0,
          dur1: Math.max(0.05, l.arcLen / spd),
        });
      });
      for (let i = pile.length - 1; i >= 0; i--) if ((pile[i]?.doom ?? 0) > 0) pile.splice(i, 1);
      reseat(l);
    }

    /* the chute's own centreline — the assets come down it and the GBX that
       paid for them goes up it, so cause and effect are one gesture */
    function chuteAt(l: Layout, u: number) {
      const x0 = l.holeX;
      const y0 = l.vy1 + 2;
      const x1 = l.youX;
      const y1 = l.youY - 10;
      const cx = l.holeX + (l.youX - l.holeX) * 0.4;
      const cy = l.vy1 + (l.youY - l.vy1) * 0.88;
      const iu = 1 - u;
      return {
        x: iu * iu * x0 + 2 * iu * u * cx + u * u * x1,
        y: iu * iu * y0 + 2 * iu * u * cy + u * u * y1,
        dx: 2 * iu * (cx - x0) + 2 * u * (x1 - cx),
        dy: 2 * iu * (cy - y0) + 2 * u * (y1 - cy),
      };
    }
    /* Measure the chute by ARC LENGTH and invert it, so equal time is equal
       distance on a curve: without this, spacing set at the gate collapses
       wherever the bend runs slow. Also fixes where the train stops: the
       head's centre halts one radius plus the terminal's own half-width back
       from the mouth, so nothing is ever drawn past the rails and nothing
       ever covers the YOU marker. */
    function chuteTable(l: Layout) {
      const N = 64;
      const acc: number[] = [0];
      let p = chuteAt(l, 0);
      let d = 0;
      for (let k = 1; k <= N; k++) {
        const q = chuteAt(l, k / N);
        d += Math.hypot(q.x - p.x, q.y - p.y);
        acc.push(d);
        p = q;
      }
      l.arcLen = Math.max(1, d);
      const M = 48;
      const u: number[] = [];
      let j = 0;
      for (let m = 0; m <= M; m++) {
        const target = (m / M) * l.arcLen;
        while (j < N - 1 && (acc[j + 1] ?? 0) < target) j++;
        const a = acc[j] ?? 0;
        const b = acc[j + 1] ?? l.arcLen;
        u.push((j + (b > a ? (target - a) / (b - a) : 0)) / N);
      }
      l.arcU = u;
      l.exitS = Math.max(0.3, Math.min(0.985, 1 - (l.sr + 5.5 * l.ui + 2) / l.arcLen));
    }
    function chuteS(l: Layout, s: number) {
      const M = l.arcU.length - 1;
      if (M < 1) return chuteAt(l, Math.max(0, Math.min(1, s)));
      const t = Math.max(0, Math.min(1, s)) * M;
      const i = Math.min(M - 1, Math.floor(t));
      const a = l.arcU[i] ?? 0;
      const b = l.arcU[i + 1] ?? 1;
      return chuteAt(l, a + (b - a) * (t - i));
    }
    /** u for an arc fraction — the wall polyline is sampled in u, not in s */
    function chuteU(l: Layout, s: number) {
      const M = l.arcU.length - 1;
      if (M < 1) return Math.max(0, Math.min(1, s));
      const t = Math.max(0, Math.min(1, s)) * M;
      const i = Math.min(M - 1, Math.floor(t));
      const a = l.arcU[i] ?? 0;
      const b = l.arcU[i + 1] ?? 1;
      return a + (b - a) * (t - i);
    }
    /** The queue's pitch, in real pixels — comfortably over one diameter even
        where the path turns a corner (a right angle costs a factor of √2, and
        2.9r clears 2r with that spent). ONE speed and ONE pitch for the whole
        journey, so the spacing set at the gate holds all the way to the mouth
        and nothing ever has to stall behind anything. */
    function queueGapPx(l: Layout) {
      return l.sr * 2.9 + 3;
    }
    /** What the burn actually releases at — a third again on top of the floor
        above. The chute is then never loaded past about three quarters of
        what it can hold, so a dropped frame cannot make an arrival close on
        the sphere in front of it and nothing ever has to stall. */
    function releaseGapPx(l: Layout) {
      return queueGapPx(l) * 1.35;
    }
    /** the release pitch along the chute, which is also where the delivered
        spheres come to rest — one train, one spacing, moving or still */
    function queueGapS(l: Layout) {
      return releaseGapPx(l) / l.arcLen;
    }
    /** the hard floor the per-frame clamp enforces, in the same units */
    function minGapS(l: Layout) {
      return queueGapPx(l) / l.arcLen;
    }
    /** how fast anything travels: the same speed in the lane and the chute */
    function outSpeed(l: Layout) {
      return l.H * 1.05;
    }

    function step(dt: number) {
      if (!L) return;
      const l = L;
      t += dt;
      if (t >= CYCLE) {
        t -= CYCLE;
        cycles++;
        fired = 0;
        /* a different channel is aimed at every cycle, in turn — so a reader
           watching several cycles sees the split reshaped several ways */
        aimTarget = cycles % chans.length;
      }

      /* ---- beats ---- */
      let bi = 0;
      for (let i = 0; i < BEATS.length; i++) {
        const b = BEATS[i];
        if (b && t >= b.start) bi = i;
      }
      const beat = BEATS[bi] ?? FALLBACK_BEAT;
      /* A band at rest is DIMMED, not cleared: the whole machine stays drawn
         at 0.86 and the live band comes up to full, so the beat reads as a
         brightening rather than as the only thing on the panel. */
      const want = [0, 1, 2, 3, 4].map((b) => (b === beat.band ? 1 : REST_A));
      bandA = bandA.map((a, i) => {
        const target = want[i] ?? 1;
        return a + (target - a) * Math.min(1, dt * 5);
      });
      if (liveCard !== bi) {
        liveCard = bi;
        stageEls.forEach((el, i) => el.classList.toggle('is-live', i === beat.card));
        /* The burn is stage 04's payoff, not a fifth stage: its stop stays
           lit and the strip takes the neutral burn ink, so the tracker says
           "all of it, leaving" instead of going dark on the payoff beat. */
        stripEl.classList.toggle('is-exit', beat.band === 4);
        holderEl.classList.toggle('is-live', !!beat.holder);
        holderEl.classList.toggle('is-aim', beat.tint === 'pink' && beat.card === 1);
        if (beat.band === 0) {
          let best = 0;
          slots.forEach((s, i) => {
            const b = slots[best];
            if (b && s.phase > b.phase) best = i;
          });
          calloutSlot = best;
        }
      }

      /* ---- the five guaranteed events ---- */
      if (!(fired & 1) && t >= AIM_AT) {
        fired |= 1;
        aimP = 0;
      }
      if (!(fired & 2) && t >= CONV_AT) {
        fired |= 2;
        forceSettle();
      }
      if (!(fired & 4) && t >= FUND_AT) {
        fired |= 4;
        forceSettle();
      }
      if (t >= MARK_AT && t < BURN_AT) {
        markBurn(l, !(fired & 8));
        fired |= 8;
      }
      if (!(fired & 16) && t >= BURN_AT) {
        fired |= 16;
        burnP = 0;
      }

      /* ---- slot clocks: sixteen, each on its own ---- */
      slots.forEach((s) => {
        s.phase += dt / s.period;
        while (s.phase >= 1) {
          s.phase -= 1;
          s.period = l.periodBase * (0.72 + Math.random() * 0.56);
          drops.push({
            x: s.x,
            y: l.mouthY,
            phase: 0,
            x0: s.x,
            y0: l.mouthY,
            tx: s.x,
            p: 0,
            dur: 1.25 + Math.random() * 0.35,
            ch: 0,
          });
        }
      });

      /* ---- the stream: bursty in, smooth out ---- */
      const inRate = SLOTS / l.periodBase;
      trough.acc += dt * inRate * (0.35 + trough.level * 1.1);
      while (trough.acc >= 1 && trough.level > 0.03) {
        trough.acc -= 1;
        trough.level = Math.max(0, trough.level - 0.028);
        const r = Math.random();
        let acc = 0;
        let pick = chans[chans.length - 1];
        for (const c of chans) {
          acc += c.share;
          if (r <= acc) {
            pick = c;
            break;
          }
        }
        if (pick) {
          const sx = l.px0 + 8 + Math.random() * (l.mx1 - l.px0 - 16);
          drops.push({
            x: sx,
            y: l.trY1,
            phase: 1,
            x0: sx,
            y0: l.trY1,
            tx: pick.openX,
            p: 0,
            dur: 0.85 + Math.random() * 0.3,
            ch: pick.i,
          });
        }
      }
      if (trough.acc > 4) trough.acc = 4;

      /* ---- drops ---- */
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (!d) continue;
        d.p += dt / d.dur;
        if (d.phase === 0) {
          const e = d.p * d.p * 0.35 + d.p * 0.65;
          d.y = d.y0 + (l.trY0 - d.y0) * e;
          if (d.p >= 1) {
            trough.level = Math.min(1, trough.level + 0.03);
            splash.push({ x: d.x, life: 1 });
            drops.splice(i, 1);
          }
        } else if (d.phase === 1) {
          const c = chans[d.ch];
          const tx = c ? c.openX : d.x0;
          const e = d.p < 0.5 ? 2 * d.p * d.p : 1 - Math.pow(-2 * d.p + 2, 2) / 2;
          d.x = d.x0 + (tx - d.x0) * e;
          d.y = d.y0 + (l.gateY + l.gateH - d.y0) * d.p;
          if (d.p >= 1) {
            d.phase = 2;
            d.p = 0;
            d.x0 = d.x;
            d.y0 = l.gateY + l.gateH;
            /* land on the lane's own stack, not in a single thin column */
            d.tx = c ? c.cx + (Math.random() - 0.5) * c.potW * 0.72 : d.x;
            d.dur = 0.85;
          }
        } else {
          const c = chans[d.ch];
          const potH = c ? Math.min(l.potMax, c.pot * (l.potMax / 9)) : 0;
          const ty = l.aucY - potH - 2;
          d.x = d.x0 + (d.tx - d.x0) * Math.min(1, d.p * 1.6);
          d.y = d.y0 + (ty - d.y0) * d.p;
          if (d.p >= 1 || d.y >= ty) {
            if (c) c.pot += 1;
            drops.splice(i, 1);
          }
        }
      }

      /* ---- shares glide to their target after an aim ---- */
      let moved = false;
      chans.forEach((c) => {
        if (Math.abs(c.target - c.share) > 0.0005) {
          c.share += (c.target - c.share) * Math.min(1, dt * 3.4);
          moved = true;
        }
      });
      if (moved) layoutGates(l);

      /* ---- independent falling-price auctions ---- */
      chans.forEach((c) => {
        c.askT += dt;
        const askH = Math.max(0, c.askStart * (1 - c.askT / c.epoch)) * l.potMax;
        const potH = Math.min(l.potMax, c.pot * (l.potMax / 9));
        if (askH <= potH && c.pot > 0.6) settle(l, c);
        if (c.flash > 0) c.flash = Math.max(0, c.flash - dt);
      });

      /* ---- coins out, spheres in ---- */
      /* one arrival at a time, never closer than EMIT_GAP, and none while the
         slice is on its way out — so an arrival can never cross the train
         leaving, and never lands on top of the arrival in front of it */
      emitCd = Math.max(0, emitCd - dt);
      if (emitPend > 0 && emitCd <= 0 && outs.length === 0) {
        emitPend--;
        emitCd = EMIT_GAP;
        emitSphere(l);
      }
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        if (!c) continue;
        c.p += dt / c.dur;
        if (c.p >= 1) coins.splice(i, 1);
      }
      pile.forEach((b) => {
        if (b.p < 1) {
          b.p = Math.min(1, b.p + dt / b.dur);
          /* eased in, but only gently: a hard ease-out bunches the last
             stretch of the arc, and two arrivals released a fixed time apart
             would then land almost on top of each other */
          const e = 1 - Math.pow(1 - b.p, 1.5);
          const tp = ballPos(l, b.cell);
          const u = 1 - e;
          b.x = u * u * b.sx + 2 * u * e * b.cx + e * e * tp.x;
          b.y = u * u * b.sy + 2 * u * e * b.cy + e * e * tp.y;
        }
      });

      /* ---- the holder's two moves ---- */
      if (aimP >= 0) {
        aimP += dt / 1.85;
        if (aimP >= 1) {
          aimP = -1;
          doAim();
        }
      }
      if (burnP >= 0) {
        burnP += dt / 0.85;
        if (burnP >= 1) {
          burnP = -1;
          burnFlash = 1;
          gateOpen = 1;
          doBurn(l);
        }
      }
      if (burnFlash > 0) burnFlash = Math.max(0, burnFlash - dt / 1.1);
      if (outs.length === 0 && burnFlash <= 0 && gateOpen > 0) gateOpen = Math.max(0, gateOpen - dt / 0.5);

      /* ---- the slice leaving: a QUEUE, never a stack ---- */
      outs.forEach((o) => {
        let d = dt;
        if (o.wait > 0) {
          /* it is still standing in its cell, waiting its turn at the gate */
          if (o.wait >= d) {
            o.wait -= d;
            return;
          }
          d -= o.wait;
          o.wait = 0;
        }
        if (o.leg === 0) {
          o.p += d / o.dur0;
          if (o.p < 1) {
            /* up clear of its own rank and across to the drain lane, then
               straight down the lane to the gate — one constant speed, and
               the lane mouth is exactly where the chute starts, so nothing
               jumps at the change of leg */
            const legs = outLegs(l, o.sx, o.sy);
            const s = o.p * legs.tot;
            if (s < legs.a) {
              const u = s / Math.max(0.001, legs.a);
              o.x = o.sx + (l.holeX - o.sx) * u;
              o.y = o.sy - legs.rise * u;
            } else {
              o.x = l.holeX;
              o.y = o.sy - legs.rise + (s - legs.a);
            }
            return;
          }
          /* carry the overshoot across the leg change: the spacing set at
             the gate must survive the frame boundary exactly */
          d = (o.p - 1) * o.dur0;
          o.leg = 1;
          o.p = 0;
        }
        o.p = Math.min(l.exitS, o.p + d / o.dur1);
      });
      /* one clear diameter centre to centre, enforced every frame: a sphere
         stalls behind the one in front of it and can never be drawn inside
         it, and the head stops at the mouth so none leaves the rails */
      const train = outs.filter((o) => o.leg === 1 && o.wait <= 0).sort((a, b) => b.p - a.p);
      const gapS = minGapS(l);
      for (let i = 1; i < train.length; i++) {
        const a = train[i - 1];
        const b = train[i];
        /* only ever pushes a sphere BACK, and never onto the mouth of a chute
           too short to hold the pair — the schedule already spaces them */
        const lim = (a?.p ?? 0) - gapS;
        if (a && b && lim > 0 && b.p > lim) b.p = lim;
      }
      train.forEach((o) => {
        const c = chuteS(l, o.p);
        o.x = c.x;
        o.y = c.y;
      });
      for (let i = outs.length - 1; i >= 0; i--) {
        const o = outs[i];
        if (!o || o.leg !== 1 || o.wait > 0) continue;
        if (o.p >= l.exitS - 1e-4) {
          /* delivered: YOU takes it, and the last few stay standing in the
             chute at the same queue positions as the at-rest drawing */
          youTake = 1;
          chute.push({ v: o.v, u: 0 });
          while (chute.length > 3) chute.shift();
          const hg = queueGapS(l);
          while (chute.length > 1 && l.exitS - (chute.length - 1) * hg < 0.04) chute.shift();
          chute.forEach((h, k) => {
            h.u = l.exitS - (chute.length - 1 - k) * hg;
          });
          outs.splice(i, 1);
        }
      }
      if (youTake > 0) youTake = Math.max(0, youTake - dt / 0.9);
      for (let i = splash.length - 1; i >= 0; i--) {
        const s = splash[i];
        if (!s) continue;
        s.life -= dt / 0.5;
        if (s.life <= 0) splash.splice(i, 1);
      }
    }

    /* ---------------------------------------------------------------- paint */
    /* A band opens with its rule. The name sits in the reserved gutter (wide)
       or on its own reserved row (narrow); the rule itself starts at px0, so
       no rule can ever cross a word and no two names can read as peers. */
    function bandRule(l: Layout, i: number, tint: string, alpha: number, lit: boolean, drawRule: boolean) {
      const label = BAND_LABEL[i] ?? '';
      const y = l.band[i] ?? 0;
      /* the name is printed at full strength whatever the band is doing: the
         drawing dims between beats, the drawing's key never does */
      lab(label, l.mx0, l.labelY[i] ?? y, l.fs, lit ? tint : pal.muted, 'left', 0.14);
      if (drawRule) {
        ctx.save();
        ctx.globalAlpha = lit ? 0.75 : alpha * 0.9;
        ctx.strokeStyle = lit ? tint : pal.rule;
        ctx.lineWidth = lit ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(l.px0, y - 0.5);
        ctx.lineTo(l.mx1, y - 0.5);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* The narration is inside the picture, under the band it describes, with
       a leader to the exact part it names — never a status chip in a corner. */
    function callout(l: Layout, beat: Beat, target: { x: number; y: number } | null, alpha: number) {
      const y = l.calloutY[beat.band] ?? 0;
      const tint = beat.tint === 'blue' ? pal.blueL : beat.tint === 'pink' ? pal.pinkL : pal.hi;
      const label = beat.label.toUpperCase();
      /* directly under the band's own name: the gutter entry at wide, the
         reserved label row at narrow. Never floating in a corner. */
      const x = l.narrow ? l.mx0 : l.px0;
      const room = (l.mx1 - 14 - x) / (label.length + 2) / 0.79;
      const size = Math.max(l.fs * 0.8, Math.min(l.fs, room));
      ctx.save();
      ctx.globalAlpha = 1;
      const bs = Math.round(size * 0.58);
      const w = labelWidth(label, size, 0.19);
      plate(x, y, w + bs + 7, size, 'left');
      ctx.fillStyle = tint;
      ctx.fillRect(x, y - size * 0.72, bs, bs);
      text(label, x + bs + 7, y, size, tint, 'left', 0.19, false);
      ctx.restore();
      /* The narration's own leader. It leaves the chip FLUSH on the edge that
         faces the part it names and runs monotonically to it — y only ever
         increases, x only ever moves toward the target — so it can never
         double back and no mark it makes can be mistaken for a glyph. The
         chip's own plate is excluded from the cut list, which is what lets
         the line touch the chip instead of floating clear of it. */
      const others = chipBoxes.slice();
      const cb = plateBox(x, y, w + bs + 7, size, 'left');
      chipBoxes.push(cb);
      if (target) {
        let sx: number;
        let sy: number;
        if (target.y > cb.y1 + 2) {
          /* below: leave from the chip's bottom edge, directly over the part
             where the part is under the chip, otherwise from the corner the
             part lies beyond — one straight run, never an elbow */
          sx = Math.max(cb.x0 + 2, Math.min(cb.x1 - 2, target.x));
          sy = cb.y1;
        } else {
          sx = target.x >= cb.x1 ? cb.x1 : cb.x0;
          sy = y - size * 0.34;
        }
        segRun(sx, sy, target.x, target.y, others, tint, alpha * 0.5);
        if (!inBox(target.x, target.y, others, 3)) {
          ctx.save();
          ctx.globalAlpha = alpha * 0.85;
          ctx.fillStyle = tint;
          ctx.beginPath();
          ctx.arc(target.x, target.y, 2.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    function party(
      l: Layout,
      x: number,
      y: number,
      label: string,
      color: string,
      alpha: number,
      lit: number,
      up = false,
    ) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const s = 11 * l.ui;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x - s / 2 + 0.5, y - s / 2 + 0.5, s, s);
      if (lit > 0) {
        ctx.globalAlpha = alpha * lit;
        ctx.fillStyle = color;
        ctx.fillRect(x - s / 2 + 3, y - s / 2 + 3, s - 5, s - 5);
        ctx.globalAlpha = alpha;
      }
      /* wide: the label hangs off the marker in the gutter — above where a
         band name in the left gutter shares its baseline, so two unrelated
         labels can never read as a pair. narrow: it sits beside the glyph,
         so the parties cost the drawing a glyph, not a column. */
      ctx.restore();
      /* the actor's name is printed at full strength on its own plate, so a
         party the current beat is not about is still legible */
      if (l.narrow) lab(label, x - s / 2 - 6, y + l.fs * 0.36, l.fs, color, 'right', 0.16);
      else if (up) lab(label, x, y - s / 2 - 7, l.fs * 0.92, color, 'center', 0.16);
      else lab(label, x, y + s / 2 + l.fs + 5, l.fs * 0.92, color, 'center', 0.16);
    }

    function chevron(x: number, y: number, s: number, color: string, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s * 0.72);
      ctx.lineTo(x + s, y - s * 0.72);
      ctx.lineTo(x, y + s * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function arrowAt(x: number, y: number, ang: number, s: number, color: string, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s, -s * 0.66);
      ctx.lineTo(-s, s * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function sprite(img: HTMLCanvasElement | null, x: number, y: number, r: number) {
      if (!img) return;
      const d = r * 2 + 4;
      ctx.drawImage(img, x - d / 2, y - d / 2, d, d);
    }
    function ballAt(l: Layout, v: number, x: number, y: number, r: number, ground: boolean) {
      if (ground && l.shadow) {
        const w = r * 2.3;
        ctx.drawImage(l.shadow, x - w / 2 + r * 0.16, y + r * 0.5, w, r * 0.86);
      }
      sprite(l.sprites[v % SHADES] ?? null, x, y, r);
    }

    /* a short tick from a micro-label to the thing it names */
    function tick(x0: number, y0: number, x1: number, y1: number, color: string, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + 0.5);
      ctx.lineTo(x1, y1 + 0.5);
      ctx.stroke();
      ctx.restore();
    }

    function paint() {
      if (!resize() || !L) return;
      const l = L;
      ctx.clearRect(0, 0, l.W, l.H);
      chipBoxes.length = 0;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'butt';
      const a0 = bandA[0] ?? 1;
      const a1 = bandA[1] ?? 1;
      const a2 = bandA[2] ?? 1;
      const a3 = bandA[3] ?? 1;
      const a4 = bandA[4] ?? 1;
      const beat = BEATS[Math.max(0, liveCard)] ?? FALLBACK_BEAT;
      /* which band the sentence is about; in the reduced-motion still every
         band names itself, so every band is lit */
      const isLit = (i: number) => staticMode || i === beat.band;

      /* The lit stratum gets a ground: light falls on the part of the machine
         being explained, and the rest of it stays in the room's shadow. */
      const bands: [number, number, number, string][] = [
        [l.band[0], l.band[1], a0, '41,182,240'],
        [l.band[1], l.band[2], a1, '249,43,146'],
        [l.band[2], l.band[3], a2, '249,43,146'],
        [l.band[3], l.band[4], a3, '255,255,255'],
        [l.band[4], l.H, a4, '255,255,255'],
      ];
      bands.forEach(([yA, yB, a, rgb]) => {
        const k = Math.max(0, (a - REST_A) / (1 - REST_A));
        if (k <= 0.01) return;
        /* eased in at both ends: light, not a lit rectangle */
        const g = ctx.createLinearGradient(0, yA, 0, yB);
        g.addColorStop(0, 'rgba(' + rgb + ',0)');
        g.addColorStop(0.14, 'rgba(' + rgb + ',' + (0.1 * k).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + rgb + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, yA, l.mx1, yB - yA);
      });

      /* the machine body: one hairline separating it from the outside world */
      if (!l.narrow) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = pal.rule;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(l.mx1 + 0.5, l.band[0]);
        ctx.lineTo(l.mx1 + 0.5, l.youY + 4);
        ctx.stroke();
        ctx.restore();
      }

      /* ---------------------------------------------------- 01 · money in */
      bandRule(l, 0, pal.blueL, a0, isLit(0), true);
      ctx.save();
      ctx.globalAlpha = a0;
      ctx.strokeStyle = pal.ruleS;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.px0, l.combY + 0.5);
      ctx.lineTo(l.minerX - (l.narrow ? 22 : 8) - (l.narrow ? labelWidth('MINERS', l.fs, 0.16) : 0), l.combY + 0.5);
      ctx.stroke();
      const clockY = l.mouthY - 7;
      slots.forEach((s) => {
        const x = Math.round(s.x) + 0.5;
        const w = l.mouthW;
        ctx.globalAlpha = a0 * 0.8;
        ctx.strokeStyle = pal.ruleS;
        ctx.beginPath();
        ctx.moveTo(x, l.combY);
        ctx.lineTo(x, clockY - 3);
        ctx.stroke();
        /* the slot's own clock: empty when it is taken, filling over its hour */
        ctx.globalAlpha = a0;
        ctx.fillStyle = pal.rule;
        ctx.fillRect(s.x - w / 2, clockY, w, 4);
        ctx.fillStyle = pal.blue;
        ctx.globalAlpha = a0 * (0.42 + s.phase * 0.58);
        ctx.fillRect(s.x - w / 2, clockY, w * s.phase, 4);
        /* the mouth it pays out of */
        ctx.globalAlpha = a0 * 0.75;
        ctx.strokeStyle = pal.ruleS;
        ctx.beginPath();
        ctx.moveTo(s.x - w / 2, l.mouthY - 5);
        ctx.lineTo(s.x - w / 2, l.mouthY);
        ctx.moveTo(s.x + w / 2, l.mouthY - 5);
        ctx.lineTo(s.x + w / 2, l.mouthY);
        ctx.stroke();
      });
      ctx.restore();

      /* drops falling from the mouths */
      ctx.save();
      ctx.fillStyle = pal.blue;
      ctx.strokeStyle = pal.blue;
      const dr = 3.2 * l.ui + 0.8;
      const trail = (d: Drop, a: number) => {
        ctx.globalAlpha = a * 0.3;
        ctx.lineWidth = dr * 0.9;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - dr * 3.4);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
      };
      drops.forEach((d) => {
        if (d.phase !== 0) return;
        trail(d, a0);
        ctx.globalAlpha = a0 * 0.2;
        ctx.beginPath();
        ctx.arc(d.x, d.y, dr * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a0;
        ctx.beginPath();
        ctx.arc(d.x, d.y, dr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      /* the seven-day stream: a trough that fills in bursts and drains smooth */
      ctx.save();
      const aTr = Math.max(a0, a1);
      ctx.globalAlpha = aTr;
      const th = l.trY1 - l.trY0;
      const lvl = l.trY1 - Math.max(3, th * trough.level);
      const tg = ctx.createLinearGradient(0, lvl, 0, l.trY1);
      tg.addColorStop(0, 'rgba(41,182,240,.36)');
      tg.addColorStop(1, 'rgba(41,182,240,.17)');
      ctx.fillStyle = tg;
      ctx.fillRect(l.px0 + 4, lvl, l.mx1 - l.px0 - 8, l.trY1 - lvl);
      ctx.strokeStyle = pal.blue;
      ctx.globalAlpha = aTr * 0.9;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(l.px0 + 4, lvl);
      ctx.lineTo(l.mx1 - 4, lvl);
      ctx.stroke();
      splash.forEach((s) => {
        ctx.globalAlpha = aTr * s.life * 0.8;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(s.x - 11 * (1 - s.life) - 3, lvl);
        ctx.lineTo(s.x + 11 * (1 - s.life) + 3, lvl);
        ctx.stroke();
      });
      ctx.globalAlpha = aTr;
      ctx.strokeStyle = pal.ruleS;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(l.px0 + 4.5, l.trY0);
      ctx.lineTo(l.px0 + 4.5, l.trY1 + 0.5);
      ctx.lineTo(l.mx1 - 4.5, l.trY1 + 0.5);
      ctx.lineTo(l.mx1 - 4.5, l.trY0);
      ctx.stroke();
      /* the rim: an open tank, so it is obvious this thing holds and meters */
      ctx.globalAlpha = aTr * 0.55;
      ctx.beginPath();
      ctx.moveTo(l.px0 + 4.5, l.trY0 + 0.5);
      ctx.lineTo(l.px0 + 26, l.trY0 + 0.5);
      ctx.moveTo(l.mx1 - 26, l.trY0 + 0.5);
      ctx.lineTo(l.mx1 - 4.5, l.trY0 + 0.5);
      ctx.stroke();
      ctx.restore();

      /* ------------------------------------------------------ 02 · aimed  */
      bandRule(l, 1, pal.pinkL, a1, isLit(1), true);

      /* Lanes tiling the whole stream: each lane's WIDTH is its share of the
         signal, so the split is readable all the way down to the auction. */
      ctx.save();
      const laneTop = l.gateY + l.gateH;
      /* The wash belongs to band 02 and stops at band 03's rule, so the two
         bands never merge into one tall pink block; the lane hairlines keep
         running down past it, which is what ties each auction to its lane. */
      const laneWash = l.band[2];
      chans.forEach((c) => {
        /* the lane is a plane of brand colour, not a garnish: its weight is
           its share, and it stays a visible field even between beats */
        ctx.globalAlpha = a1 * (0.86 + (c.share / 0.6) * 0.14);
        const g = ctx.createLinearGradient(0, laneTop, 0, laneWash);
        g.addColorStop(0, 'rgba(249,43,146,.20)');
        g.addColorStop(1, 'rgba(249,43,146,.115)');
        ctx.fillStyle = g;
        ctx.fillRect(c.segX0, laneTop, c.segX1 - c.segX0, laneWash - laneTop);
        ctx.globalAlpha = a1;
        ctx.strokeStyle = 'rgba(249,43,146,.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(c.segX0) + 0.5, laneTop);
        ctx.lineTo(Math.round(c.segX0) + 0.5, l.aucY);
        ctx.stroke();
        chevron(c.cx, laneTop + 15 * l.ui, 4.4 * l.ui, pal.pink, a1 * 0.55);
      });
      const last = chans[chans.length - 1];
      if (last) {
        ctx.globalAlpha = a1;
        ctx.beginPath();
        ctx.moveTo(Math.round(last.segX1) + 0.5, laneTop);
        ctx.lineTo(Math.round(last.segX1) + 0.5, l.aucY);
        ctx.stroke();
      }
      ctx.restore();

      /* metered drops, fanning out to their gate */
      ctx.save();
      ctx.fillStyle = pal.blue;
      ctx.strokeStyle = pal.blue;
      ctx.lineCap = 'round';
      drops.forEach((d) => {
        if (d.phase === 0) return;
        const a = d.phase === 1 ? a1 : Math.max(a1, a2);
        if (d.phase === 2) trail(d, a);
        ctx.globalAlpha = a * 0.95;
        ctx.beginPath();
        ctx.arc(d.x, d.y, dr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.lineCap = 'butt';
      ctx.restore();

      /* the gate bar: the openings ARE the weights, drawn in front of the flow */
      ctx.save();
      ctx.globalAlpha = a1;
      chans.forEach((c) => {
        const o0 = c.openX - c.openW / 2;
        const o1 = c.openX + c.openW / 2;
        ctx.fillStyle = pal.pink;
        ctx.fillRect(c.segX0 + 1, l.gateY, Math.max(0, o0 - c.segX0 - 1), l.gateH);
        ctx.fillRect(o1, l.gateY, Math.max(0, c.segX1 - 1 - o1), l.gateH);
        /* a lit top edge, so the bar is a machined part and not a swatch */
        ctx.fillStyle = 'rgba(255,255,255,.34)';
        ctx.fillRect(c.segX0 + 1, l.gateY, Math.max(0, o0 - c.segX0 - 1), 1);
        ctx.fillRect(o1, l.gateY, Math.max(0, c.segX1 - 1 - o1), 1);
        ctx.strokeStyle = 'rgba(12,12,12,.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(c.segX1) + 0.5, l.gateY - 3);
        ctx.lineTo(Math.round(c.segX1) + 0.5, l.gateY + l.gateH + 3);
        ctx.stroke();
      });
      ctx.restore();

      /* --------------------------------------------------- 03 · converted */
      bandRule(l, 2, pal.pinkL, a2, isLit(2), true);
      /* worth rising, ask falling, in each channel */
      const named = chans[0];
      ctx.save();
      chans.forEach((c) => {
        const potH = Math.min(l.potMax, c.pot * (l.potMax / 9));
        const askH = Math.max(0, c.askStart * (1 - c.askT / c.epoch)) * l.potMax;
        const bw = c.potW;
        /* the lane's own time axis */
        ctx.globalAlpha = a2 * 0.24;
        ctx.strokeStyle = pal.pink;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(c.cx, l.aucTop);
        ctx.lineTo(c.cx, l.aucY - 2);
        ctx.stroke();
        ctx.setLineDash([]);
        /* the hopper this lane's USDG collects in: permanent chrome with a
           real interior, so a lane between auctions is still a drawn part of
           the machine and the pot reads as a level inside a vessel */
        ctx.globalAlpha = a2 * 0.95;
        const hg = ctx.createLinearGradient(0, l.aucY - l.potMax, 0, l.aucY);
        hg.addColorStop(0, 'rgba(255,255,255,.15)');
        hg.addColorStop(1, 'rgba(255,255,255,.21)');
        ctx.fillStyle = hg;
        ctx.fillRect(c.cx - bw / 2, l.aucY - l.potMax, bw, l.potMax);
        ctx.globalAlpha = a2 * 0.9;
        ctx.strokeStyle = pal.ruleS;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(c.cx - bw / 2) - 0.5, l.aucY - l.potMax);
        ctx.lineTo(Math.round(c.cx - bw / 2) - 0.5, l.aucY - 0.5);
        ctx.lineTo(Math.round(c.cx + bw / 2) + 0.5, l.aucY - 0.5);
        ctx.lineTo(Math.round(c.cx + bw / 2) + 0.5, l.aucY - l.potMax);
        ctx.stroke();
        /* the lot this lane last cleared, held until it clears again: the
           at-rest drawing of an auction that has already happened, so no lane
           is ever an empty column between beats */
        if (c.ghostH > 1) {
          ctx.globalAlpha = a2;
          ctx.fillStyle = 'rgba(41,182,240,.17)';
          ctx.fillRect(c.cx - bw / 2, l.aucY - c.ghostH, bw, c.ghostH);
          ctx.strokeStyle = 'rgba(41,182,240,.55)';
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(c.cx - bw / 2, l.aucY - c.ghostH - 0.5);
          ctx.lineTo(c.cx + bw / 2, l.aucY - c.ghostH - 0.5);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        /* worth, rising: the USDG this lane is holding */
        ctx.globalAlpha = a2;
        const pg = ctx.createLinearGradient(0, l.aucY - potH, 0, l.aucY);
        pg.addColorStop(0, pal.blue);
        pg.addColorStop(1, 'rgba(41,182,240,.42)');
        ctx.fillStyle = pg;
        ctx.fillRect(c.cx - bw / 2, l.aucY - potH, bw, potH);
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.fillRect(c.cx - bw / 2, l.aucY - potH, bw, 1);
        /* asking, falling: settles the moment it reaches what the lane holds */
        ctx.globalAlpha = a2;
        ctx.strokeStyle = pal.pink;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(c.cx - bw * 0.85, l.aucY - askH - 1.5);
        ctx.lineTo(c.cx + bw * 0.85, l.aucY - askH - 1.5);
        ctx.stroke();
        arrowAt(c.cx + bw * 0.85 + 5, l.aucY - askH - 1.5, Math.PI / 2, 3.4 * l.ui, pal.pink, a2 * 0.8);
        if (c.flash > 0) {
          ctx.globalAlpha = a2 * c.flash;
          ctx.strokeStyle = pal.hi;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(c.segX0 + 2, l.aucY - 1);
          ctx.lineTo(c.segX1 - 2, l.aucY - 1);
          ctx.stroke();
        }
      });
      ctx.restore();

      /* the three parts of an auction, named where they happen and left there */
      /* the auction line runs out to the counterparty that fills it */
      ctx.save();
      ctx.globalAlpha = a2 * 0.55;
      ctx.strokeStyle = pal.ruleS;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(l.mx1, l.aucY - 0.5);
      ctx.lineTo(l.traderX - (l.narrow ? 24 : 8) - (l.narrow ? labelWidth('TRADER', l.fs, 0.16) : 0), l.aucY - 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      /* the trade itself: USDG out to the trader, the asset back in */
      ctx.save();
      coins.forEach((c) => {
        if (c.p < 0) return;
        const u = 1 - c.p;
        const x = u * u * c.x0 + 2 * u * c.p * c.cx + c.p * c.p * l.traderX;
        const y = u * u * c.y0 + 2 * u * c.p * c.cy + c.p * c.p * (l.traderY - 10);
        ctx.globalAlpha = a2 * (1 - c.p * 0.35);
        ctx.fillStyle = pal.blue;
        ctx.beginPath();
        ctx.arc(x, y, 3 * l.ui + 0.7, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      /* ------------------------------------------------------ 04 · the fund */
      bandRule(l, 3, pal.hi, a3, isLit(3), true);

      ctx.save();
      ctx.globalAlpha = Math.max(a3, a4);
      /* the vessel: two walls and a floor, open at the top, lit from above */
      const grd = ctx.createLinearGradient(0, l.vy0, 0, l.vy1);
      grd.addColorStop(0, 'rgba(255,255,255,.028)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(l.vx0, l.vy0, l.vx1 - l.vx0, l.vy1 - l.vy0);
      /* the vessel's own walls out-rank the rank dividers inside it, so the
         holding reads as one countable field and not as three bins */
      ctx.strokeStyle = CHUTE_WALL;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(l.vx0 + 1, l.vy0);
      ctx.lineTo(l.vx0 + 1, l.vy1 - 1);
      ctx.lineTo(l.holeX - l.holeW / 2, l.vy1 - 1);
      ctx.moveTo(l.holeX + l.holeW / 2, l.vy1 - 1);
      ctx.lineTo(l.vx1 - 1, l.vy1 - 1);
      ctx.lineTo(l.vx1 - 1, l.vy0);
      ctx.stroke();
      /* the deck the vessel is mounted on — it is a machine, not a floating
         box. A real plinth, so the payoff band has a floor at every moment
         and the floor gate reads as an opening cut through something. */
      {
        const hx0 = l.holeX - l.holeW / 2;
        const hx1 = l.holeX + l.holeW / 2;
        ctx.globalAlpha = Math.max(a3, a4) * 0.92;
        ctx.fillStyle = 'rgba(255,255,255,.13)';
        ctx.fillRect(l.px0, l.vy1, Math.max(0, hx0 - l.px0), 5);
        ctx.fillRect(hx1, l.vy1, Math.max(0, l.mx1 - hx1), 5);
        ctx.fillStyle = pal.ruleS;
        ctx.globalAlpha = Math.max(a3, a4) * 0.85;
        ctx.fillRect(l.px0, l.vy1 + 5, Math.max(0, hx0 - l.px0), 1);
        ctx.fillRect(hx1, l.vy1 + 5, Math.max(0, l.mx1 - hx1), 1);
        ctx.globalAlpha = Math.max(a3, a4) * 0.6;
        ctx.strokeStyle = pal.rule;
        ctx.lineWidth = 1;
        for (let x = l.px0 + 13; x < l.mx1 - 8; x += 27) {
          if (x > hx0 - 6 && x < hx1 + 6) continue;
          ctx.beginPath();
          ctx.moveTo(Math.round(x) + 0.5, l.vy1 + 6);
          ctx.lineTo(Math.round(x) + 0.5, l.vy1 + 11);
          ctx.stroke();
        }
      }
      /* light from above catches the rim */
      ctx.globalAlpha = Math.max(a3, a4) * 0.5;
      ctx.strokeStyle = pal.muted;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(l.vx0 + 1, l.vy0);
      ctx.lineTo(l.vx0 + 22, l.vy0);
      ctx.moveTo(l.vx1 - 22, l.vy0);
      ctx.lineTo(l.vx1 - 1, l.vy0);
      ctx.stroke();
      /* Ranks of ten, kept: a full empty column between every group of ten
         with a divider standing in it, the whole height of the vessel, at
         every width. The reader counts groups, and a burn then reads as a
         fraction of a countable whole rather than as a glitch. */
      ctx.globalAlpha = Math.max(a3, a4);
      ctx.strokeStyle = RANK_TICK;
      ctx.lineWidth = 1;
      for (let g = 1; g < l.groups; g++) {
        const rx = Math.round(l.vx0 + l.pad + l.sp * (11 * g - 0.5)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(rx, l.vy0 + 3);
        ctx.lineTo(rx, l.vy1 - 2);
        ctx.stroke();
      }
      /* the drain lane: the way out, drawn as the same channel the chute is,
         so the path the payoff takes is visible before anything moves along
         it and the floor gate reads as its foot rather than a stray hole */
      {
        const lx0 = l.holeX - l.holeW / 2;
        ctx.globalAlpha = Math.max(a3, a4) * (0.55 + 0.45 * Math.max(gateOpen, burnFlash));
        ctx.fillStyle = 'rgba(255,255,255,.05)';
        ctx.fillRect(lx0, l.vy0 + 3, l.holeW, l.vy1 - l.vy0 - 4);
        ctx.strokeStyle = CHUTE_WALL;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(lx0) + 0.5, l.vy0 + 3);
        ctx.lineTo(Math.round(lx0) + 0.5, l.vy1 - 2);
        ctx.stroke();
      }
      ctx.restore();

      /* the spheres: what the fund actually holds. One renderer, one light.
         The slice a burn is about to take is dimmed IN PLACE and outlined a
         beat before it moves, so the fraction is legible as a shape first.
         Survivors never move, so nothing interpenetrates; the slice's own
         spheres wait their turn IN THEIR CELLS and peel off one at a time,
         so the tally only ever loses the sphere that is actually leaving. */
      ctx.save();
      const aPile = Math.max(0.9, a3);
      /* every marked sphere, whether it is still in the pile or already
         queued for the gate but not yet moving — the outline tracks the
         slice as it drains instead of lying about what is left */
      const marked: { cell: number; x: number; y: number }[] = [];
      outs.forEach((o) => {
        if (o.leg !== 0 || o.wait <= 0) return;
        ctx.globalAlpha = aPile * 0.32;
        ballAt(l, o.v, o.sx, o.sy, l.sr, true);
        marked.push({ cell: o.cell, x: o.sx, y: o.sy });
      });
      pile.forEach((b) => {
        ctx.globalAlpha = b.doom > 0 ? aPile * 0.32 : aPile;
        ballAt(l, shadeOf(b.cell), b.x, b.y, l.sr, b.p >= 1);
        if (b.doom > 0) marked.push({ cell: b.cell, x: b.x, y: b.y });
      });
      /* on its way out: along its own emptied rank, then down the drain lane.
         Both stretches are clear of everything that is staying, so it is
         drawn at full strength and never overlaps a standing sphere. */
      ctx.globalAlpha = Math.max(0.85, a4);
      outs.forEach((o) => {
        if (o.leg !== 0 || o.wait > 0) return;
        ballAt(l, o.v, o.x, o.y, l.sr, false);
      });
      if (marked.length > 0) {
        /* The slice is the TAIL of one reading order, so it is a run out of
           the last rank or two — never a rectangle. It is outlined RUN BY
           RUN, tight around each rank's own stretch: a bounding box would
           enclose survivors and claim they were leaving too. */
        const rows = new Map<number, { a: number; b: number; y: number }>();
        marked.forEach((m) => {
          const r = Math.floor(m.cell / l.cols);
          const e = rows.get(r);
          if (e) {
            e.a = Math.min(e.a, m.x);
            e.b = Math.max(e.b, m.x);
          } else rows.set(r, { a: m.x, b: m.x, y: m.y });
        });
        const keys = Array.from(rows.keys()).sort((p, q) => p - q);
        const mpad = l.sr + 3;
        ctx.globalAlpha = Math.max(a3, a4) * 0.9;
        ctx.strokeStyle = pal.muted;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        /* consecutive ranks with the same stretch share one outline, so a
           slice several ranks deep is one shape and not a stack of boxes */
        let i = 0;
        while (i < keys.length) {
          const e = rows.get(keys[i] ?? -1);
          if (!e) break;
          let j = i;
          while (j + 1 < keys.length) {
            const f = rows.get(keys[j + 1] ?? -1);
            if (!f || (keys[j + 1] ?? 0) !== (keys[j] ?? 0) + 1 || Math.abs(f.a - e.a) > 0.5 || Math.abs(f.b - e.b) > 0.5) break;
            j++;
          }
          const top = rows.get(keys[j] ?? -1) ?? e;
          ctx.strokeRect(
            Math.round(e.a - mpad) + 0.5,
            Math.round(top.y - mpad) + 0.5,
            Math.round(e.b - e.a + mpad * 2),
            Math.round(e.y - top.y + mpad * 2),
          );
          i = j + 1;
        }
        ctx.setLineDash([]);
      }
      ctx.restore();

      /* the floor gate: shut, or swung open while a burn is being paid */
      ctx.save();
      ctx.globalAlpha = Math.max(a3, a4);
      ctx.translate(l.holeX - l.holeW / 2, l.vy1 - 0.5);
      ctx.rotate(gateOpen * 1.15);
      ctx.strokeStyle = gateOpen > 0.02 ? pal.hi : pal.ruleS;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(l.holeW, 0);
      ctx.stroke();
      ctx.restore();

      /* -------------------------------------------------------- 05 · yours */
      bandRule(l, 4, pal.hi, a4, isLit(4), false);
      /* The chute is a FORMED CHANNEL, not two hairlines: an interior with a
         visible neutral tint, cross ribs, walls that read at better than 3:1
         against the panel, and a lit upper rail with a lit mouth at the gate.
         On the payoff beat the path the assets travel has to be at least as
         material as the assets on it. */
      ctx.save();
      const burning = Math.max(gateOpen, burnFlash);
      const aCh = 1;
      ctx.globalAlpha = aCh;
      const half = l.holeW / 2;
      const wall = (side: number) => {
        const pts: [number, number][] = [];
        for (let k = 0; k <= 26; k++) {
          const c = chuteAt(l, k / 26);
          const m = Math.hypot(c.dx, c.dy) || 1;
          pts.push([c.x + (-c.dy / m) * half * side, c.y + (c.dx / m) * half * side]);
        }
        return pts;
      };
      const wa = wall(-1);
      const wb = wall(1);
      ctx.beginPath();
      wa.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      for (let k = wb.length - 1; k >= 0; k--) {
        const q = wb[k];
        if (q) ctx.lineTo(q[0], q[1]);
      }
      ctx.closePath();
      const cA = chuteAt(l, 0);
      const cB = chuteAt(l, 1);
      const cg = ctx.createLinearGradient(cA.x, cA.y, cB.x, cB.y);
      cg.addColorStop(0, 'rgba(255,255,255,' + (burning > 0.02 ? 0.27 : 0.22) + ')');
      cg.addColorStop(1, 'rgba(255,255,255,' + (burning > 0.02 ? 0.22 : 0.18) + ')');
      ctx.fillStyle = cg;
      ctx.fill();
      /* cross ribs: the channel is a made part, with a floor you can see */
      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.lineWidth = 1;
      for (let k = 1; k < 9; k++) {
        const c = chuteAt(l, k / 9);
        const m = Math.hypot(c.dx, c.dy) || 1;
        const nx = (-c.dy / m) * half * 0.84;
        const ny = (c.dx / m) * half * 0.84;
        ctx.beginPath();
        ctx.moveTo(c.x - nx, c.y - ny);
        ctx.lineTo(c.x + nx, c.y + ny);
        ctx.stroke();
      }
      ctx.strokeStyle = burning > 0.02 ? mix(CHUTE_WALL, parseHex(pal.hi), burning * 0.65) : CHUTE_WALL;
      ctx.lineWidth = 1.9;
      [wa, wb].forEach((pts) => {
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      });
      /* the lit upper rail and the lit mouth: light falls on the channel */
      ctx.strokeStyle = 'rgba(255,255,255,.34)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      wa.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y - 1.5) : ctx.lineTo(x, y - 1.5)));
      ctx.stroke();
      const w0 = wa[0];
      const w1 = wb[0];
      if (w0 && w1) {
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(w0[0], w0[1]);
        ctx.lineTo(w1[0], w1[1]);
        ctx.stroke();
      }
      /* what the last burn delivered, left standing in the channel: at rest
         this band shows the path AND what travelled it */
      if (outs.length === 0) {
        chute.forEach((h) => {
          const c = chuteS(l, h.u);
          ctx.globalAlpha = 0.5;
          ballAt(l, h.v, c.x, c.y, l.sr * 0.92, false);
        });
        ctx.globalAlpha = aCh;
      }
      /* one travelling highlight on the upper rail per sphere passing under it */
      ctx.strokeStyle = pal.hi;
      ctx.lineWidth = 1.8;
      outs.forEach((o) => {
        if (o.leg !== 1 || o.wait > 0) return;
        const c0 = Math.max(0, Math.floor(chuteU(l, o.p) * 26) - 2);
        const c1 = Math.min(26, c0 + 5);
        ctx.globalAlpha = aCh * 0.55 * Math.sin(Math.min(1, o.p / l.exitS) * Math.PI);
        ctx.beginPath();
        for (let k = c0; k <= c1; k++) {
          const q = wa[k];
          if (!q) continue;
          if (k === c0) ctx.moveTo(q[0], q[1]);
          else ctx.lineTo(q[0], q[1]);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = aCh;
      /* the delivery arrow sits ON the chute's centreline at the mouth, clear
         of the terminal it points into — the marker is never drawn under it */
      const end = chuteAt(l, 1);
      arrowAt(end.x, end.y - 1, Math.atan2(end.dy, end.dx), 4.6 * l.ui, burning > 0.02 ? pal.hi : pal.muted, aCh);
      ctx.restore();

      /* the train on the chute: spaced one clear diameter, stopped at the
         mouth, so nothing overlaps and nothing is drawn past the rails */
      ctx.save();
      ctx.globalAlpha = Math.max(0.85, a4);
      outs.forEach((o) => {
        if (o.leg !== 1 || o.wait > 0) return;
        ballAt(l, o.v, o.x, o.y, l.sr, false);
      });
      ctx.restore();

      /* ------------------------------------------------- the three parties */
      party(l, l.minerX, l.minerY, 'MINERS', pal.blueL, a0, 0);
      party(l, l.traderX, l.traderY, 'TRADER', pal.faint, a2, coins.length > 0 ? 0.8 : 0, true);
      party(l, l.youX, l.youY, 'YOU', pal.hi, Math.max(a1, a4), Math.max(youTake, burnP >= 0 || aimP >= 0 ? 0.9 : 0.25));
      if (youTake > 0.02) {
        /* the terminal takes delivery: a ring off the marker, over the chute
           end, so the payoff lands IN the marker instead of burying it */
        ctx.save();
        ctx.globalAlpha = youTake * 0.55;
        ctx.strokeStyle = pal.hi;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(l.youX, l.youY, 7 * l.ui + (1 - youTake) * 9 * l.ui, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      /* the holder's two moves: aim the gate, and burn up the chute */
      ctx.save();
      if (aimP >= 0) {
        const p = aimP;
        const c = chans[aimTarget];
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(249,43,146,.55)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 4]);
        let x: number;
        let y: number;
        if (l.narrow) {
          /* no gutter to run up: the signal cuts straight to the gate it moves */
          const tx = c ? c.openX : l.youX;
          const ty = l.gateY + l.gateH / 2;
          const e = p * p * 0.3 + p * 0.7;
          x = l.youX + (tx - l.youX) * e;
          y = l.youY - 14 + (ty - (l.youY - 14)) * e;
          ctx.beginPath();
          ctx.moveTo(l.youX, l.youY - 14);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else {
          const climb = Math.min(1, p / 0.62);
          const cross = Math.max(0, (p - 0.62) / 0.38);
          y = l.youY - 14 - (l.youY - 14 - l.gateY) * (climb * climb * 0.25 + climb * 0.75);
          x = cross > 0 && c ? l.youX + (c.openX - l.youX) * (cross * (2 - cross)) : l.youX;
          const top = Math.max(y, l.gateY);
          const skip0 = l.traderY - 13;
          const skip1 = l.traderY + 13;
          ctx.beginPath();
          if (l.youY - 16 > skip1) {
            ctx.moveTo(l.youX, l.youY - 16);
            ctx.lineTo(l.youX, Math.max(top, skip1));
          }
          if (top < skip0) {
            ctx.moveTo(l.youX, skip0);
            ctx.lineTo(l.youX, top);
          }
          if (cross > 0) {
            ctx.moveTo(l.youX, l.gateY);
            ctx.lineTo(x, l.gateY);
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = pal.pink;
        ctx.beginPath();
        ctx.arc(x, y, 13 * l.ui, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, 6 * l.ui + 1, 0, Math.PI * 2);
        ctx.fill();
        arrowAt(x, y - 11, -Math.PI / 2, 4.6 * l.ui, pal.pink, 1);
      }
      if (burnP >= 0) {
        /* the GBX goes UP the chute the assets come down: one gesture */
        const c = chuteAt(l, 1 - burnP);
        ctx.globalAlpha = 0.95;
        sprite(l.gbxSprite, c.x, c.y, Math.max(3.5, l.sr * 0.6));
        arrowAt(c.x - 1, c.y - l.sr * 0.6 - 7, Math.atan2(-c.dy, -c.dx), 3.6 * l.ui, pal.hi, 0.8);
      }
      if (burnFlash > 0) {
        ctx.globalAlpha = burnFlash * 0.85;
        ctx.strokeStyle = pal.hi;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(l.holeX, l.vy1, l.holeW * (0.5 + (1 - burnFlash) * 0.5), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      /* ------------------------------------------------------- the words --
         Every drawn word is printed last, over the whole machine, each on a
         plate of the panel's own ground. A sphere, a drop or a rail passing
         behind a label can never eat it, at any width. */
      lab('USDG', l.mx1 - 9, l.trY0 - 7, l.fs, pal.blueL, 'right', 0.14);

      /* The three parts of a falling-price auction, named where they happen.
         The caption row is pinned to the top of the band — PRICE FALLS on its
         left end, ASSET on its right — and FILLED rides the clearing level in
         the middle. Every leader is laid down FIRST and cut around every chip
         box, and the chips are printed last on opaque plates: no leader can
         be drawn across a word and no arrowhead can land inside a label. */
      const mfs = l.fs * 0.94;
      const capY = l.aucTop + mfs + 1;
      const ax = l.mx1 - 8;
      const pfB = labBox('PRICE FALLS', l.px0 + 2, capY, mfs, 'left', 0.19);
      /* every word already printed blocks a leader too, not just these three */
      const chips: Box[] = chipBoxes.concat([pfB, labBox('ASSET', ax, capY, mfs, 'right', 0.19)]);
      let fx = 0;
      let fy = 0;
      let potH0 = 0;
      if (named) {
        potH0 = Math.min(l.potMax, named.pot * (l.potMax / 9));
        fx = named.cx - named.potW / 2 - 9;
        fy = Math.max(capY + mfs * 2.4, Math.min(l.aucY - potH0, l.aucY - mfs - 20));
        chips.push(labBox('FILLED', fx, fy + mfs * 0.36, mfs, 'right', 0.19));
      }

      /* ---- leaders, before any chip ---- */
      ctx.save();
      if (named) {
        const askH = Math.max(0, named.askStart * (1 - named.askT / named.epoch)) * l.potMax;
        const askY = l.aucY - askH - 1.5;
        const lineL = named.cx - named.potW * 0.85;
        /* the rail leaves the word on its inner edge and stays clear of it */
        const pvx = Math.round(pfB.x0 + 11) + 0.5;
        const drop = vRun(pfB.y1 + 3, askY, pvx, chips, pal.faint, 0.55);
        hRun(pvx, lineL - 2, askY, chips, pal.faint, 0.55);
        /* the arrowhead sits ON the end of the run that was actually drawn —
           never floating off the end of a line the cut removed */
        const tail = drop[drop.length - 1];
        if (tail && tail[1] - tail[0] > 14) {
          arrowAt(pvx, tail[1] - 2.4 * l.ui, Math.PI / 2, 2.9 * l.ui, pal.faint, 0.7);
        }
        const fex = named.cx - named.potW / 2 - 2;
        hRun(fx + 5, fex, fy, chips, pal.faint, 0.6);
        vRun(fy, l.aucY - potH0, fex, chips, pal.faint, 0.6);
      }
      /* what comes back is the asset itself, never dollars — named at the far
         end of the lane row and ticked down to the rail the trader answers on */
      vRun(capY + 5, l.aucY - 5, ax - 6, chips, pal.faint, 0.5);
      ctx.restore();

      /* ---- the chips, last, on opaque plates at full ink ---- */
      lab('PRICE FALLS', l.px0 + 2, capY, mfs, pal.faint, 'left', 0.19);
      lab('ASSET', ax, capY, mfs, pal.faint, 'right', 0.19);
      ctx.save();
      ctx.globalAlpha = 1;
      ballAt(l, 1, ax - labelWidth('ASSET', mfs, 0.19) - l.sr * 0.4 - 9, capY - mfs * 0.32, l.sr * 0.4, false);
      ctx.restore();
      if (named) lab('FILLED', fx, fy + mfs * 0.36, mfs, pal.faint, 'right', 0.19);

      /* where a lane is not shown, say so — never truncate silently */
      if (l.narrow) {
        /* measured so the row always stops clear of the lane the bought
           assets fly up — a knockout plate must never bite a sphere */
        const ghost = '+ TWO MORE CHANNELS, EACH ON ITS OWN CLOCK';
        const room = l.mx1 - l.px0 - 64;
        let gfs = l.fs * 0.92;
        const gw = labelWidth(ghost, gfs, 0.075);
        if (gw > room) gfs *= room / gw;
        lab(ghost, l.px0, l.ghostY, gfs, pal.faint, 'left', 0.075);
      }

      lab('RANKS OF 10', l.vx0 + 7, l.vy0 + l.fs + 7, l.fs * 0.94, pal.faint, 'left', 0.19);

      /* --------------------------------------------------- the narration --
         Last, over everything, so a sphere passing behind a word can never
         eat it. In the reduced-motion still every band is lit at once, so
         every band names itself. */
      if (staticMode) {
        BEATS.forEach((b) => callout(l, b, calloutTarget(l, b), 1));
      } else {
        callout(l, beat, calloutTarget(l, beat), 1);
      }
    }

    /* the exact part the current sentence is about */
    function calloutTarget(l: Layout, beat: Beat): { x: number; y: number } | null {
      if (beat.band === 0) {
        const s = slots[calloutSlot] ?? slots[0];
        return s ? { x: s.x, y: l.mouthY + 3 } : null;
      }
      if (beat.band === 1) {
        const c = chans[aimTarget] ?? chans[0];
        return c ? { x: c.openX, y: l.gateY + l.gateH / 2 } : null;
      }
      if (beat.band === 2) {
        const c = staticMode ? chans[0] : fullestChan();
        if (!c) return null;
        const askH = Math.max(0, c.askStart * (1 - c.askT / c.epoch)) * l.potMax;
        return { x: c.cx - c.potW * 0.85, y: l.aucY - askH - 1.5 };
      }
      if (beat.band === 3) {
        let top = 0;
        pile.forEach((b) => {
          if (b.cell > top) top = b.cell;
        });
        const p = ballPos(l, top);
        return { x: p.x, y: p.y - l.sr - 2 };
      }
      return { x: l.holeX, y: l.vy1 + 4 };
    }

    /* ------------------------------------------------------ reduced motion --
       A meaningful still, not a blank frame: every stratum lit and named,
       value frozen mid-flight on every leg, the vessel part full, and a burn
       being paid down the chute. */
    function poseStatic() {
      staticMode = true;
      if (!resize() || !L) return;
      const l = L;
      drops.length = 0;
      coins.length = 0;
      pile.length = 0;
      outs.length = 0;
      emitPend = 0;
      emitCd = 0;
      chute.length = 0;
      splash.length = 0;
      youTake = 0;
      occ = new Array(l.cap).fill(false);
      bandA = [1, 1, 1, 1, 1];
      t = BURN_AT + 1.4;
      trough.level = 0.62;
      let seed = 7;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      slots.forEach((s, i) => {
        s.phase = ((i * 5) % 16) / 16;
      });
      calloutSlot = 2;
      for (let i = 0; i < 10; i++) {
        const s = slots[(i * 3) % SLOTS];
        if (!s) continue;
        drops.push({
          x: s.x,
          y: l.mouthY + (l.trY0 - l.mouthY) * ((i * 0.11 + 0.08) % 1),
          phase: 0,
          x0: s.x,
          y0: l.mouthY,
          tx: s.x,
          p: 0.5,
          dur: 1.3,
          ch: 0,
        });
      }
      chans.forEach((c, i) => {
        c.pot = 4 + i * 2.2;
        c.askStart = 1.2;
        c.askT = c.epoch * (0.3 + i * 0.16);
      });
      for (let i = 0; i < 12; i++) {
        const c = chans[i % chans.length];
        if (!c) continue;
        const u = ((i * 0.17 + 0.1) % 1) * 0.9;
        drops.push({
          x: c.cx + (rnd() - 0.5) * c.potW * 0.7,
          y: l.trY1 + (l.aucY - l.potMax - l.trY1) * u,
          phase: u < 0.42 ? 1 : 2,
          x0: c.cx,
          y0: l.trY1,
          tx: c.cx,
          p: 0.5,
          dur: 1,
          ch: c.i,
        });
      }
      /* one channel caught mid-trade: coins leaving, spheres arriving */
      const tc = chans[chans.length - 1];
      if (tc) {
        for (let k = 0; k < 4; k++) {
          coins.push({
            x0: tc.cx,
            y0: l.aucY - l.potMax * 0.3,
            cx: (tc.cx + l.traderX) / 2,
            cy: l.aucY - l.H * 0.075,
            p: 0.22 + k * 0.17,
            dur: 0.62,
          });
        }
        tc.flash = 0.8;
      }
      const n = Math.max(6, Math.round(l.cap * 0.62));
      for (let i = 0; i < n; i++) {
        const pos = ballPos(l, i);
        occ[i] = true;
        pile.push({ cell: i, sx: pos.x, sy: pos.y, cx: pos.x, cy: pos.y, p: 1, dur: 1, x: pos.x, y: pos.y, doom: 0 });
      }
      for (let k = 0; k < 2; k++) {
        const pos = ballPos(l, n + k);
        occ[n + k] = true;
        const sx = l.traderX;
        const sy = l.traderY + Math.max(12, l.sr * 0.9 + 9);
        const p = 0.4 + k * 0.26;
        const u = 1 - p;
        const cx = (sx + pos.x) / 2;
        const cy = Math.min(sy, pos.y) - l.H * 0.1;
        pile.push({
          cell: n + k,
          sx,
          sy,
          cx,
          cy,
          p,
          dur: 1,
          x: u * u * sx + 2 * u * p * cx + p * p * pos.x,
          y: u * u * sy + 2 * u * p * cy + p * p * pos.y,
          doom: 0,
        });
      }
      /* the still teaches the burn whole: the tail slice marked and outlined
         where it stands, and its leading spheres already down the chute */
      markBurn(l, true);
      /* a burn being paid: the gate open, spheres queued down the chute */
      gateOpen = 1;
      burnFlash = 0.5;
      burnP = -1;
      aimP = -1;
      youTake = 0.55;
      /* the three at the head of the slice are already travelling — taken off
         the TAIL of the holding, so the still's arrangement is a clean run
         exactly like every moving frame */
      const gapS = queueGapS(l);
      const away = pile.filter((b) => b.doom > 0).sort((a, b) => b.cell - a.cell);
      for (let k = 0; k < 3; k++) {
        const b = away[k];
        if (!b) break;
        const s = l.exitS - k * gapS;
        if (s < 0.04) break;
        const c = chuteS(l, s);
        occ[b.cell] = false;
        pile.splice(pile.indexOf(b), 1);
        outs.push({
          cell: b.cell,
          v: shadeOf(b.cell),
          x: c.x,
          y: c.y,
          sx: l.holeX,
          sy: l.vy1,
          p: s,
          wait: 0,
          leg: 1,
          dur0: 0.4,
          dur1: 1,
        });
      }
      /* the still is the burn beat, so the tracker reads the same as it does
         in motion: stage 04's stop lit, the rest in the neutral burn ink */
      const last = BEATS[BEATS.length - 1] ?? FALLBACK_BEAT;
      stageEls.forEach((el, i) => el.classList.toggle('is-live', i === last.card));
      stripEl.classList.add('is-exit');
      holderEl.classList.add('is-live');
      liveCard = BEATS.length - 1;
      paint();
    }

    /* --------------------------------------------------------- lifecycle -- */
    let disposed = false;
    function remeasure() {
      pal = readPal();
      mono = fontFamily('--font-mono', "'JetBrains Mono', monospace");
      tracking = null;
      /* the gutter is measured from the type, so a font swap must rebuild it */
      L = null;
      if (staticMode) poseStatic();
    }
    mono = fontFamily('--font-mono', "'JetBrains Mono', monospace");
    window.addEventListener('resize', remeasure);
    if (document.fonts && document.fonts.ready) {
      void document.fonts.ready.then(() => {
        if (!disposed) remeasure();
      });
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => remeasure()) : null;
    ro?.observe(canvas);

    const unregister = registerSim({
      name: 'overview',
      el: panelEl,
      step,
      paint,
      reset: () => {
        /* re-arm the whole sequence for a reader who comes back, and clear
           every transient so nothing is left lit or stranded mid-flight */
        t = 0;
        fired = 0;
        liveCard = -2;
        aimP = -1;
        burnP = -1;
        burnFlash = 0;
        gateOpen = 0;
        youTake = 0;
        coins.length = 0;
        emitPend = 0;
        emitCd = 0;
        outs.length = 0;
        chute.length = 0;
        splash.length = 0;
        pile.forEach((b) => {
          b.doom = 0;
        });
      },
      static: poseStatic,
    });

    return () => {
      disposed = true;
      unregister();
      window.removeEventListener('resize', remeasure);
      ro?.disconnect();
      stageEls.forEach((el) => el.classList.remove('is-live'));
      stripEl.classList.remove('is-exit');
      holderEl.classList.remove('is-live', 'is-aim');
    };
  }, []);

  return (
    <section id="sec-overview" className="section section--rule" aria-labelledby="sec-overview-h" ref={rootRef}>
      <div className="container">
        <header className="sec-head sec-head--indexed sec-head--blue reveal">
          <div className="sec-head__index">
            <span className="sec-head__num" aria-hidden="true">
              01
            </span>
            <p className="eyebrow eyebrow--blue">How it works</p>
          </div>
          <div className="sec-head__body">
            <h2 className="h1" id="sec-overview-h">
              Money in, aimed by holders, out as assets you can claim
            </h2>
            <p className="lede">
              Miners pay USDG for mining slots — the only money in. Holders point that stream at assets, falling-price
              auctions convert it, and burning GBX takes your share out at any time.
            </p>
          </div>
        </header>

        <div className="sim-panel ov-panel reveal" style={{ '--d': '90ms' } as CSSProperties}>
          <div className="sim-panel__head">
            <span className="sim-panel__title sim-panel__title--blue">The whole loop</span>
          </div>
          <div className="sim-panel__body ov-body">
            <canvas
              id="ovCanvas"
              className="ov-canvas"
              role="img"
              aria-label="Diagram of the whole loop: USDG paid for sixteen mining slots collects in a seven-day stream, gates sized by holder signal split it into channels, a falling-price auction in each channel trades the USDG to a trader for the asset itself, the assets stack up in the fund in ranks of ten, and burning GBX opens a floor gate that sends the same share of every holding down a chute to the holder."
            />
          </div>
          <div className="sim-panel__foot">
            <p className="ov-holder" id="ovHolder">
              <span className="ov-holder__gum gum gum--white" aria-hidden="true" />
              <strong className="ov-holder__title">You hold GBX</strong>
              <span className="ov-holder__note">Aim the stream any time · burn to claim your share of everything</span>
            </p>
          </div>
        </div>

        <p className="note ov-note reveal" style={{ '--d': '140ms' } as CSSProperties}>
          Every arrow is a contract call anyone can make — no step waits on a person. The sections below zoom in: the
          money, the aim, the assets.
        </p>

        <ol className="cardrow cardrow--4 ov-stages reveal" id="ovStages" style={{ '--d': '180ms' } as CSSProperties}>
          {STAGES.map((s) => (
            <li className={'col ov-stage ov-stage--' + s.tone} key={s.n}>
              <span className="col__n ov-stage__n" aria-hidden="true">
                {s.n}
              </span>
              <span className="ov-stage__tag">{s.tag}</span>
              <h3 className="h3 col__t">{s.head}</h3>
              <p className="col__b">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
