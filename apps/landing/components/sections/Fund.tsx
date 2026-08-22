'use client';

import { useLayoutEffect } from 'react';
import { fontFamily, registerSim } from '../../lib/harness';
import './fund.css';

/* The vault's four holdings. The fund holds MANY DIFFERENT THINGS, so each bay
   gets its own hue inside the pink/magenta family (blue stays USDG capital,
   neutral stays GBX and its burning) and its own grain: WBTC's units are large
   and few, QQQ's small and many. Initial amounts must match `holdInit` in the
   effect so the server-rendered cells carry the exact first-paint values. */
const ASSETS = [
  { sym: 'NVDA', amt: 1200, init: '1200.0', hue: '#9E5CF2', grain: 1.0 },
  { sym: 'QQQ', amt: 400, init: '400.0', hue: '#F92B92', grain: 0.78 },
  { sym: 'WBTC', amt: 2.4, init: '2.4000', hue: '#FF6274', grain: 1.52 },
  { sym: 'AAPL', amt: 860, init: '860.0', hue: '#F57ACD', grain: 1.24 },
];

export function Fund() {
  useLayoutEffect(() => {
    const $ = (id: string) => document.getElementById(id);
    const css = getComputedStyle(document.documentElement);
    const C = {
      rule: css.getPropertyValue('--rule').trim() || '#26262f',
      ruleStrong: css.getPropertyValue('--rule-strong').trim() || '#3b3b48',
      blue: css.getPropertyValue('--blue').trim() || '#29b6f0',
      pink: css.getPropertyValue('--pink').trim() || '#f92b92',
      hi: css.getPropertyValue('--text-hi').trim() || '#ffffff',
      muted: css.getPropertyValue('--muted').trim() || '#adadc0',
      faint: css.getPropertyValue('--faint').trim() || '#8a8aa0',
      /* AA-safe text tints: full pink is 4.12:1 on a panel, these are 5.6:1 */
      pinkLabel: css.getPropertyValue('--pink-label').trim() || '#fb63ac',
      blueLabel: css.getPropertyValue('--blue-label').trim() || '#9bddfa',
    };
    const MONO = fontFamily('--font-mono', 'ui-monospace, SFMono-Regular, Menlo, monospace');
    const mono = (px: number, weight = 500) => `${weight} ${px}px ${MONO}`;
    const dprNow = () => Math.min(2, window.devicePixelRatio || 1);

    const flashTimers = new Map<HTMLElement, number>();
    const forceReflow = (node: HTMLElement) => node.offsetWidth;
    function flash(node: HTMLElement, cls: string) {
      node.classList.remove(cls);
      forceReflow(node); /* restart the animation on repeat events */
      node.classList.add(cls);
      const prev = flashTimers.get(node);
      if (prev !== undefined) clearTimeout(prev);
      flashTimers.set(
        node,
        window.setTimeout(() => {
          node.classList.remove(cls);
          flashTimers.delete(node);
        }, 1100),
      );
    }

    /* ---- wire the server-rendered elements (never rebuild them) ----------
       Rebind everything to non-null-typed consts after the guard so the
       hoisted sim functions below see them as definitely present. */
    const refsMaybe = {
      acqPanel: $('acqPanel'),
      acqWrap: $('acqWrap'),
      rdmPanel: $('rdmPanel'),
      rdmWrap: $('rdmWrap'),
      rdmVault: $('rdmVault'),
      rdmSupply: $('rdmSupply'),
      rdmOut: $('rdmOut'),
      rdmDest: $('rdmDest'),
      rdmWho: $('rdmWho'),
      rdmTake: $('rdmTake'),
      rdmSupplyFill: $('rdmSupplyFill'),
      rdmSupplySlice: $('rdmSupplySlice'),
    };
    if (Object.values(refsMaybe).some((n) => n === null)) return;
    const {
      acqPanel,
      acqWrap,
      rdmPanel,
      rdmWrap,
      rdmVault,
      rdmSupply,
      rdmOut,
      rdmDest,
      rdmWho,
      rdmTake,
      rdmSupplyFill,
      rdmSupplySlice,
    } = refsMaybe as { [K in keyof typeof refsMaybe]: HTMLElement };
    const canvasIds = ['acqWire', 'acqStage', 'acqFundWell', 'acqSigWell', 'rdmWire', 'rdmCup'];
    const canvases = canvasIds.map((id) => $(id));
    if (canvases.some((n) => !(n instanceof HTMLCanvasElement))) return;
    const [wire, stage, fundWellEl, sigWellEl, rdmWireEl, cupEl] = canvases as HTMLCanvasElement[] as [
      HTMLCanvasElement,
      HTMLCanvasElement,
      HTMLCanvasElement,
      HTMLCanvasElement,
      HTMLCanvasElement,
      HTMLCanvasElement,
    ];
    const ctxs = [wire, stage, fundWellEl, sigWellEl, rdmWireEl, cupEl].map((c) => c.getContext('2d'));
    if (ctxs.some((c) => !c)) return;
    const [wctx, sctx, fwctx, swctx, rctx, cupCtx] = ctxs as CanvasRenderingContext2D[] as [
      CanvasRenderingContext2D,
      CanvasRenderingContext2D,
      CanvasRenderingContext2D,
      CanvasRenderingContext2D,
      CanvasRenderingContext2D,
      CanvasRenderingContext2D,
    ];

    const elMaybe = {
      lot: $('acqLot'),
      ask: $('acqAsk'),
      worthCap: $('acqWorthCap'),
      askCap: $('acqAskCap'),
      meet: $('acqMeet'),
      state: $('acqState'),
      fundT: $('acqFundT'),
      sigT: $('acqSigT'),
      trader: $('acqTrader'),
      fund: $('acqFund'),
      sig: $('acqSig'),
      dTrader: $('acqTraderDelta'),
      dFund: $('acqFundDelta'),
      dSig: $('acqSigDelta'),
      auction: $('acqAuction'),
    };
    if (Object.values(elMaybe).some((n) => n === null)) return;
    const el = elMaybe as { [K in keyof typeof elMaybe]: HTMLElement };

    /* ---- shared helpers -------------------------------------------------- */
    function money(x: number) {
      return '$' + Math.round(x).toLocaleString('en-US');
    }
    function fit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
      const dpr = dprNow();
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: canvas.clientWidth, h: canvas.clientHeight };
    }
    function niceStep(raw: number) {
      const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
      const n = raw / p;
      return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
    }
    /* deterministic per-sphere variation: the same vessel always packs the
       same way, so a resize does not reshuffle the candy */
    function hash3(a: number, b: number, c: number) {
      let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2246822519)) >>> 0;
      h = (h ^ (h >>> 13)) >>> 0;
      h = Math.imul(h, 1274126177) >>> 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    /* ---- colour: one hue, many depths ------------------------------------ */
    function parseRGB(c: string): [number, number, number] {
      const s = c.trim();
      if (s.startsWith('#')) {
        const hex = s.slice(1);
        const full =
          hex.length === 3
            ? hex
                .split('')
                .map((ch) => ch + ch)
                .join('')
            : hex;
        return [
          parseInt(full.slice(0, 2), 16) || 0,
          parseInt(full.slice(2, 4), 16) || 0,
          parseInt(full.slice(4, 6), 16) || 0,
        ];
      }
      const m = s.match(/\d+(?:\.\d+)?/g) ?? [];
      return [Number(m[0] ?? 255), Number(m[1] ?? 255), Number(m[2] ?? 255)];
    }
    const mixCache = new Map<string, string>();
    /** k<1 darkens toward black (depth); lift mixes toward white (in transit). */
    function shadeOf(color: string, k: number) {
      const q = Math.round(k * 16) / 16;
      const key = `${color}|s${q}`;
      const hit = mixCache.get(key);
      if (hit) return hit;
      const [r, g, b] = parseRGB(color);
      const out = `rgb(${Math.round(r * q)},${Math.round(g * q)},${Math.round(b * q)})`;
      mixCache.set(key, out);
      return out;
    }
    function liftOf(color: string, k: number) {
      const key = `${color}|l${k}`;
      const hit = mixCache.get(key);
      if (hit) return hit;
      const [r, g, b] = parseRGB(color);
      const m = (v: number) => Math.round(v + (255 - v) * k);
      const out = `rgb(${m(r)},${m(g)},${m(b)})`;
      mixCache.set(key, out);
      return out;
    }

    /* ---- the material: one candy sphere ----------------------------------
       A sphere never carries a value on its own. In a vessel the LEVEL is the
       measure and the spheres are its volume; in a transfer the COUNT is a
       proportion (nine one way, one the other). Light falls from above: one
       shade under, one highlight over. No rim, no reflection, no chrome. */
    function renderSphere(g: CanvasRenderingContext2D, color: string, cx: number, cy: number, d: number) {
      const r = d / 2;
      g.fillStyle = color;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      const shade = g.createRadialGradient(cx + r * 0.3, cy + r * 0.42, r * 0.05, cx, cy, r * 1.3);
      shade.addColorStop(0, 'rgba(0,0,0,0.42)');
      shade.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = shade;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      const hl = g.createRadialGradient(cx - r * 0.36, cy - r * 0.44, 0, cx - r * 0.36, cy - r * 0.44, r * 0.95);
      hl.addColorStop(0, 'rgba(255,255,255,0.44)');
      hl.addColorStop(0.5, 'rgba(255,255,255,0)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hl;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
    const sphereCache = new Map<string, HTMLCanvasElement>();
    function sphere(color: string, d: number, dpr: number): HTMLCanvasElement {
      const key = `${color}|${d.toFixed(1)}|${dpr}`;
      const hit = sphereCache.get(key);
      if (hit) return hit;
      const c = document.createElement('canvas');
      const px = Math.max(2, Math.ceil(d * dpr));
      c.width = px;
      c.height = px;
      const g = c.getContext('2d');
      if (g) {
        g.scale(px / d, px / d);
        renderSphere(g, color, d / 2, d / 2, d);
      }
      if (sphereCache.size > 900) sphereCache.clear();
      sphereCache.set(key, c);
      return c;
    }
    function drawSphere(
      ctx: CanvasRenderingContext2D,
      color: string,
      x: number,
      y: number,
      d: number,
      dpr: number,
      shadow = false,
    ) {
      /* a sphere in transit passes over a field of its own colour, so it
         carries its own ground: the shadow is what puts it in front */
      if (shadow) {
        const g = ctx.createRadialGradient(x + 1, y + 2, d * 0.34, x + 1, y + 2, d * 0.9);
        g.addColorStop(0, 'rgba(8,8,11,0.9)');
        g.addColorStop(1, 'rgba(8,8,11,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + 1, y + 2, d * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.drawImage(sphere(color, Math.round(d * 2) / 2, dpr), x - d / 2, y - d / 2, d, d);
    }

    /* ---- a vessel of spheres ---------------------------------------------
       Packed candy, not a bar with a texture. Every sphere is whole: the field
       is inset so no wall cuts one, each column's top course sits at its own
       height so the surface is a meniscus rather than a razor cut, radius
       varies, lightness falls toward the floor and the walls, and the bottom
       course casts a contact shadow. The whole field is rasterised once per
       layout; a frame blits the part below the level and redraws only the
       courses at the surface, so a full vessel costs one drawImage plus a row. */
    interface Sph {
      x: number;
      y: number;
      d: number;
      k: number;
    }
    interface Field {
      cv: HTMLCanvasElement;
      w: number;
      h: number;
      dpr: number;
      color: string;
      rows: Sph[][] /* index 0 is the bottom course */;
      centre: number[];
    }
    interface Grain {
      d: number;
      pitch: number;
      vpitch: number;
      jit: number;
      rvar: number;
      /* how far lightness falls toward the floor and the walls, and the floor
         it never drops below — a white candy needs a shallower well than a
         saturated one or it turns into a ball bearing */
      depth?: number;
      kMin?: number;
    }
    const fieldCache = new Map<string, Field>();
    function buildField(color: string, w: number, h: number, g: Grain, seed: number, dpr: number): Field {
      const key = `${color}|${w.toFixed(1)}|${h.toFixed(1)}|${g.d.toFixed(2)}|${g.pitch}|${g.vpitch}|${g.jit}|${g.rvar}|${g.depth ?? ''}|${g.kMin ?? ''}|${seed}|${dpr}`;
      const hit = fieldCache.get(key);
      if (hit) return hit;
      if (fieldCache.size > 18) fieldCache.clear();
      const d = g.d;
      const r = d / 2;
      const dep = g.depth ?? 0.3;
      const kMin = g.kMin ?? 0.58;
      /* room for the contact shadow, and no wall ever cuts a sphere */
      const inset = r + Math.max(2, Math.min(4, d * 0.28));
      const usable = Math.max(1, w - inset * 2);
      const cols = Math.max(2, Math.round(usable / (d * g.pitch)) + 1);
      const sx = cols > 1 ? usable / (cols - 1) : 0;
      const vstep = Math.max(3, d * g.vpitch);
      const rows: Sph[][] = [];
      const centre: number[] = [];
      for (let j = 0; j < 400; j++) {
        const cy = h - inset - j * vstep;
        if (cy < -d) break;
        const odd = j % 2 === 1;
        const n = Math.max(1, odd ? cols - 1 : cols);
        const row: Sph[] = [];
        for (let i = 0; i < n; i++) {
          const x = inset + (odd ? sx / 2 : 0) + i * sx + (hash3(seed, j, i * 3 + 1) - 0.5) * sx * 0.1;
          const y = cy + (hash3(seed, j, i * 3 + 2) - 0.5) * 2 * g.jit * r;
          const dd = d * (1 - g.rvar + hash3(seed, j, i * 3 + 3) * g.rvar * 2);
          const vf = Math.min(1, Math.max(0, y / Math.max(1, h)));
          const hf = Math.min(1, Math.abs(x - w / 2) / Math.max(1, w / 2));
          const k = Math.max(kMin, 1 - dep * Math.pow(vf, 1.15) - dep * 0.47 * hf * hf);
          row.push({ x, y, d: dd, k });
        }
        rows.push(row);
        centre.push(cy);
      }
      const cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.ceil(w * dpr));
      cv.height = Math.max(2, Math.ceil(h * dpr));
      const gx = cv.getContext('2d');
      if (gx) {
        gx.setTransform(dpr, 0, 0, dpr, 0, 0);
        (rows[0] ?? []).forEach((s) => {
          const sg = gx.createRadialGradient(s.x, h - 2, 0, s.x, h - 2, s.d * 0.66);
          sg.addColorStop(0, 'rgba(0,0,0,0.8)');
          sg.addColorStop(1, 'rgba(0,0,0,0)');
          gx.fillStyle = sg;
          gx.beginPath();
          gx.ellipse(s.x, h - 2, s.d * 0.72, s.d * 0.34, 0, 0, Math.PI * 2);
          gx.fill();
        });
        /* bottom course first, so the lit surface courses sit in front */
        rows.forEach((row) => row.forEach((s) => renderSphere(gx, shadeOf(color, s.k), s.x, s.y, s.d)));
      }
      const fld: Field = { cv, w, h, dpr, color, rows, centre };
      fieldCache.set(key, fld);
      return fld;
    }
    /** Blit the packed field below `levelY`; courses above `litY` take `lit`.
        `tail` (0..1) fades the bottom course out below the last whole course,
        so a vessel emptying reaches nothing continuously instead of dropping
        its final row a quarter of a second early. */
    function paintField(
      ctx: CanvasRenderingContext2D,
      fld: Field,
      x0: number,
      topY: number,
      levelY: number,
      litY: number,
      lit: string,
      dpr: number,
      tail = 0,
    ) {
      const rowAt = (yy: number) => {
        let idx = -1;
        for (let j = 0; j < fld.centre.length; j++) {
          if ((fld.centre[j] ?? -1) >= yy) idx = j;
          else break;
        }
        return idx;
      };
      const jTop = rowAt(levelY - topY);
      if (jTop < 0) {
        if (tail <= 0.002) return;
        const last = fld.rows[0];
        if (!last) return;
        ctx.globalAlpha = Math.min(1, tail);
        last.forEach((s) => drawSphere(ctx, shadeOf(fld.color, s.k), x0 + s.x, topY + s.y, s.d, dpr));
        ctx.globalAlpha = 1;
        return;
      }
      const jLit = litY > 0 ? Math.min(jTop, rowAt(litY - topY)) : jTop;
      const base = Math.max(-1, jLit);
      if (base >= 0) {
        const sy = Math.max(0, (fld.centre[base] ?? 0) + 0.5);
        const sPx = Math.round(sy * fld.dpr);
        if (fld.cv.height - sPx > 0) {
          ctx.drawImage(fld.cv, 0, sPx, fld.cv.width, fld.cv.height - sPx, x0, topY + sy, fld.w, fld.h - sy);
        }
      }
      /* the surface courses, drawn whole — this is the meniscus */
      const from = Math.max(0, base);
      for (let j = from; j <= jTop && j - from < 5; j++) {
        const row = fld.rows[j];
        if (!row) continue;
        const isLit = litY > 0 && j > jLit;
        for (const s of row) {
          drawSphere(ctx, shadeOf(isLit ? lit : fld.color, s.k), x0 + s.x, topY + s.y, s.d, dpr);
        }
      }
    }
    /* A live figure sitting on top of the drawing needs its own ground, or it
       vanishes into the candy the moment the two lines converge. */
    function plate(
      ctx: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      align: 'left' | 'right',
      color: string,
    ) {
      ctx.font = mono(11, 600);
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      const w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(10,10,14,0.82)';
      ctx.fillRect(align === 'left' ? x - 3 : x - w - 3, y - 11, w + 6, 14);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    }
    /** The waterline: ruled behind the candy, ticked bright on both walls. */
    function levelRule(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: string, alpha = 0.5) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, Math.round(y) + 0.5);
      ctx.lineTo(x1, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function levelTicks(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: string, len = 9) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, Math.round(y) + 0.5);
      ctx.lineTo(x0 + len, Math.round(y) + 0.5);
      ctx.moveTo(x1 - len, Math.round(y) + 0.5);
      ctx.lineTo(x1, Math.round(y) + 0.5);
      ctx.stroke();
    }
    /** The vessel's own ground: a light source above, no dome and no chrome. */
    function vesselGround(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, 'rgba(0,0,0,0.34)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      g.addColorStop(1, 'rgba(255,255,255,0.035)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, w, h);
    }

    /* ---- plumbing: a smoothed polyline both the stroke and the spheres use */
    interface Seg {
      x0: number;
      y0: number;
      cx: number;
      cy: number;
      x1: number;
      y1: number;
      len: number;
    }
    type Pt = [number, number];
    function smoothPath(pts: Pt[]): Seg[] {
      const p = pts.filter(Boolean);
      if (p.length < 2) return [];
      if (p.length === 2) {
        const a = p[0] as Pt;
        const b = p[1] as Pt;
        return [seg(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, b[0], b[1])];
      }
      const out: Seg[] = [];
      let cur = p[0] as Pt;
      for (let i = 1; i < p.length - 1; i++) {
        const c = p[i] as Pt;
        const nxt = p[i + 1] as Pt;
        const mid: Pt = [(c[0] + nxt[0]) / 2, (c[1] + nxt[1]) / 2];
        out.push(seg(cur[0], cur[1], c[0], c[1], mid[0], mid[1]));
        cur = mid;
      }
      const c = p[p.length - 2] as Pt;
      const e = p[p.length - 1] as Pt;
      out.push(seg(cur[0], cur[1], c[0], c[1], e[0], e[1]));
      return out;
    }
    function seg(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): Seg {
      const len = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x1 - x0, y1 - y0);
      return { x0, y0, cx, cy, x1, y1, len: Math.max(1, len / 2) };
    }
    function pathPoint(segs: Seg[], t: number): Pt {
      if (!segs.length) return [0, 0];
      const total = segs.reduce((a, s) => a + s.len, 0);
      let want = Math.max(0, Math.min(1, t)) * total;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i] as Seg;
        if (want > s.len && i < segs.length - 1) {
          want -= s.len;
          continue;
        }
        const u = Math.max(0, Math.min(1, want / s.len));
        const mu = 1 - u;
        return [mu * mu * s.x0 + 2 * mu * u * s.cx + u * u * s.x1, mu * mu * s.y0 + 2 * mu * u * s.cy + u * u * s.y1];
      }
      const last = segs[segs.length - 1] as Seg;
      return [last.x1, last.y1];
    }
    function strokePath(ctx: CanvasRenderingContext2D, segs: Seg[]) {
      if (!segs.length) return;
      const first = segs[0] as Seg;
      ctx.beginPath();
      ctx.moveTo(first.x0, first.y0);
      segs.forEach((s) => ctx.quadraticCurveTo(s.cx, s.cy, s.x1, s.y1));
      ctx.stroke();
    }
    /* The net under every route: no travelling sphere and no path may render
       over running type. Routes are laid out to avoid the copy; this clips
       whatever a future breakpoint would otherwise let through. */
    function clipAwayText(ctx: CanvasRenderingContext2D, w: number, h: number, boxes: number[][]) {
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      boxes.forEach((b) => ctx.rect(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0));
      ctx.clip('evenodd');
    }
    /* The INK box, not the border box: a cell reserves its chute as padding,
       and measuring the padding would fence off the very channel a sphere is
       meant to travel down. A Range over the contents measures the glyphs. */
    function textBoxes(base: DOMRect, root: HTMLElement, sel: string, pad = 3): number[][] {
      const rng = document.createRange();
      return Array.from(root.querySelectorAll<HTMLElement>(sel))
        .map((n) => {
          /* a slot that is empty right now but reserves a line (the transient
             `→ N out` and the settle receipts) is fenced by its content box,
             so the cache stays valid when the text arrives */
          let r: DOMRect;
          if ((n.textContent ?? '').trim().length > 0) {
            rng.selectNodeContents(n);
            r = rng.getBoundingClientRect();
          } else {
            const cs = getComputedStyle(n);
            const b = n.getBoundingClientRect();
            const pl = parseFloat(cs.paddingLeft) || 0;
            const pr = parseFloat(cs.paddingRight) || 0;
            r = new DOMRect(b.left + pl, b.top, Math.max(0, b.width - pl - pr), b.height);
          }
          return [r.left - base.left - pad, r.top - base.top - pad, r.width + pad * 2, r.height + pad * 2];
        })
        .filter((b) => (b[2] ?? 0) > pad * 2 && (b[3] ?? 0) > pad * 2);
    }

    /* ================================================ acquisition auction ==
       Lifted from docs/deck/gumball6900-deck.html (auc, lines 1673-1846) and
       documented in docs/MODELS.md §4. Everything is measured in QQQ units,
       never dollars: fair() is what the USDG lot is worth in QQQ, and the ask
       decays linearly over a six-hour epoch. The lot keeps growing while the
       auction is open; the display freezes at the moment of fill.

       DRAWN as the thing it is: a wide vessel of large USDG spheres — liquid
       being poured, with a visible meniscus — while a pink blade, the ask,
       descends on a rail toward it. Where the blade meets the surface is the
       price, and the sim HOLDS there, because that crossing is the argument. */
    const QQQ = 486; /* $ per unit — illustrative */
    const EPOCH = 21600; /* six-hour epoch, inside Strategy's 1h-365d bounds */
    const BRIBE = 0.1; /* signaler share: default 10%, capped at 20% in code */
    const TS = 450; /* harness timeScale: 1 real s = 450 sim s */
    /* A reader arrives mid-auction rather than at second zero, so the first
       settle lands ~6s after the panel scrolls in instead of ~13s. */
    const SEED = EPOCH * 0.12;
    /* The settle window. The pour starts on the frame the ring appears and
       runs the whole window: a labelled stage is never left with nothing on
       it. What holds the argument to the end is not the candy but the ghost
       of the lot — a hatched band standing at the settle height, revealed as
       the lot leaves, with the meet-line and the ring still on top of it.
       The pour finishes at DRAIN_END and the window runs on: the empty vessel
       — hatch still standing, ask frozen, surface at nothing — is the frame
       that says the whole lot went to the buyer, so it is HELD before the
       cut rather than flashed for a frame. */
    const DRAIN_END = 3.5;
    const EMPTY_HOLD = 0.4;
    const TRADE_END = DRAIN_END + EMPTY_HOLD;
    /* the pour: a beat of contact, then it empties, accelerating */
    const drainAt = (u: number) => {
      const x = Math.max(0, Math.min(1, u));
      return x * (0.34 + 0.66 * x);
    };
    /** inverse of drainAt: when the pour has given up `frac` of the lot */
    const drainU = (frac: number) => (-0.34 + Math.sqrt(0.1156 + 2.64 * frac)) / 1.32;
    /* the departures are the pour: sphere i leaves as the level passes its own
       course, over the first 62% of the lot — the tail drains behind them so
       the last sphere still lands inside the window */
    const USDG_N = 12;
    const USDG_SP = 1 / 0.85; /* one real second of flight, near enough */
    const RETURN_SP = 1 / 1.05;
    const PAY_LANDS = 2.05; /* the return leg touches down; the wells rise then */
    const PAY_RISE = 0.72; /* real seconds the pile — and the ruler — take to move */
    /* THE RULER. It opens low enough that the lot the reader arrives holding
       is candy on sight and the first live settle is a real pour — and high
       enough that the pile has somewhere to climb for the next six. It is
       shared by both destinations, so 90/10 stays one comparison. */
    const CAP0 = 10; /* QQQ — where the axis opens */
    const FILL_TRIG = 0.92; /* above this the next total no longer fits under it */
    /* When the ruler has to grow, the payment still closes this much of what
       is left between the surface and the rim — so the level always RISES on
       the beat, and the relabel reads as headroom added, not candy removed. */
    const CLOSE = 0.3;
    const FILL_MAX = 0.985;
    const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
    const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
    /* MODELS.md §4: "blue USDG auction→trader, white QQQ trader→fund, pink QQQ
       trader→signalers". The ninety and the tenth are different inks, so the
       split is legible without counting — and the count backs it up, 9 to 1. */
    const FUND_INK = C.hi;
    const SIG_INK = C.pink;

    /* a coin knows when it left and how fast it flies; its position is read
       off the settle clock, so nothing accumulates drift across a frame drop */
    interface Coin {
      t0: number;
      sp: number;
      kind: 'usdg' | 'fund' | 'sig';
    }
    interface Drop {
      x: number;
      p: number;
    }

    const auc = {
      t: 0,
      phase: 'open' as 'open' | 'trade',
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
      capTo: CAP0 /* where the ruler is going on THIS payment's beat */,
      capLit: 0 /* the axis stays emphasised for a beat after it moves */,
      payFund0: 0 /* the surfaces the payment beat starts from */,
      paySig0: 0,
      payCap0: CAP0,
      epoch: 0,
      parts: [] as Coin[],
      drops: [] as Drop[],
      dropT: 0,
      deltaT: -1 /* -1 = no receipt showing */,
      lastPaid: 0,
      lastLot: 0,
      landed: false,
      still: false,
      /* geometry stashed by the stage paint so the overlay can launch the lot
         from the vessel's actual surface at any breakpoint */
      geo: { mouthX: 0, rimRightX: 0, rimY: 0, surfaceY: 0 },
    };
    const fair = () => auc.lot / QQQ;
    /* measured once per layout, not once per frame */
    let wireKey = '';
    let stageOff = 0;
    let pathLot: Seg[] = [];
    let pathFund: Seg[] = [];
    let pathSig: Seg[] = [];
    let acqBoxes: number[][] = [];

    function clearReceipt() {
      auc.deltaT = -1;
      [el.dTrader, el.dFund, el.dSig].forEach((n) => {
        n.classList.remove('is-fading');
        n.textContent = '';
      });
    }
    function openAuction(seed: number) {
      auc.phase = 'open';
      auc.started = auc.t - seed;
      auc.openedAt = auc.t;
      auc.initialAsk = fair() * (1.85 + Math.random() * 0.35);
      auc.lot += auc.inflow * seed;
      auc.ask = auc.initialAsk * (1 - seed / EPOCH);
      auc.landed = false;
      auc.parts = [];
      auc.drops = [];
      auc.dropT = 0;
      el.meet.textContent = 'settles when they meet';
      el.meet.classList.remove('is-met');
    }
    /* A READER ARRIVES AT A STRATEGY THAT IS ALREADY RUNNING. The lot in front
       of them is part-grown and the ask part-fallen; the treasury it feeds is
       likewise not at zero. That opening pile is not asserted — it is stepped:
       one auction is opened, run against the model's own equations until the
       ask meets what the lot is worth, and its ninety/ten booked. So the
       vessel a cold arrival meets is holding a lot the model actually settled,
       and the panel never spends its first ten seconds as two empty boxes. */
    function seedHistory() {
      auc.lot = 420 + Math.random() * 180;
      openAuction(0);
      let guard = 0;
      while (auc.ask > fair() && guard++ < 4000) {
        const dt = 30;
        auc.t += dt;
        auc.lot += auc.inflow * dt;
        const elapsed = auc.t - auc.started;
        auc.ask = elapsed >= EPOCH ? 0 : auc.initialAsk * (1 - elapsed / EPOCH);
      }
      auc.fundTotal = auc.ask * (1 - BRIBE);
      auc.sigTotal = auc.ask * BRIBE;
      auc.fundShown = auc.fundTotal;
      auc.sigShown = auc.sigTotal;
      auc.epoch = 1;
      auc.cap = CAP0;
      auc.capShown = CAP0;
      auc.capTo = CAP0;
      auc.capLit = 0;
      auc.lot = 420 + Math.random() * 180;
      openAuction(SEED);
    }
    seedHistory();

    function fill() {
      auc.phase = 'trade';
      auc.tradeT = 0;
      auc.lastPaid = auc.ask;
      auc.lastLot = auc.lot;
      auc.toFund = auc.lastPaid * (1 - BRIBE);
      auc.toSig = auc.lastPaid * BRIBE;
      auc.fundTotal += auc.toFund;
      auc.sigTotal += auc.toSig;
      /* THE RULER MOVES WITH THE PAYMENT — never on its own, and never after
         it. When the new total will not fit under the ceiling, the ceiling is
         raised on the very beat the spheres land, and the new maximum is
         chosen from the surface that is currently on screen so that the
         post-payment surface stands HIGHER than the pre-payment one. The pile
         and the ruler then run on ONE eased progress (aucStep), and
         level = total/ceiling is monotone in that progress exactly when
         post > pre — so no frame in between can show the pile fall. */
      auc.payFund0 = auc.fundShown;
      auc.paySig0 = auc.sigShown;
      auc.payCap0 = auc.capShown;
      auc.capTo = auc.cap;
      if (auc.fundTotal > auc.cap * FILL_TRIG) {
        const pre = auc.payFund0 / Math.max(1e-6, auc.payCap0);
        const post = Math.min(FILL_MAX, pre + CLOSE * (1 - pre));
        auc.capTo = Math.max(auc.cap, auc.fundTotal / post);
      }
      auc.epoch++;
      auc.drops = [];
      /* The lot empties into the trader; the asset comes back and splits.
         Ten spheres return — nine to the treasury, one to the signalers — so
         the 90/10 is countable as well as coloured. Each USDG sphere leaves as
         the level passes its own course: the pour and the transfer are one
         event, not a drain beside an unrelated flight of coins. */
      auc.parts = [];
      for (let i = 0; i < USDG_N; i++) {
        auc.parts.push({ t0: drainU(((i + 0.6) / USDG_N) * 0.62) * DRAIN_END, sp: USDG_SP, kind: 'usdg' });
      }
      for (let f = 0; f < 9; f++) auc.parts.push({ t0: 1.0 + f * 0.115, sp: RETURN_SP, kind: 'fund' });
      auc.parts.push({ t0: 1.575, sp: RETURN_SP, kind: 'sig' });
      el.meet.textContent = 'they met — settled';
      el.meet.classList.add('is-met');
      /* the receipt: two-tone, and it LIVES FOR ONE EVENT. deltaT ages it out
         so an open auction never asserts a settle that is not happening. */
      auc.deltaT = 0;
      [el.dTrader, el.dFund, el.dSig].forEach((n) => n.classList.remove('is-fading'));
      el.dTrader.innerHTML =
        '<span class="blue">+ ' +
        money(auc.lastLot) +
        ' USDG in</span> · <span class="pink">' +
        auc.lastPaid.toFixed(2) +
        ' QQQ out</span>';
      el.dFund.textContent = '+ ' + auc.toFund.toFixed(2) + ' QQQ';
      el.dSig.textContent = '+ ' + auc.toSig.toFixed(2) + ' QQQ';
      flash(el.trader, 'evt-blue');
    }

    function aucStep(dt: number) {
      /* dt is simulated seconds (x450) */
      auc.t += dt;
      const rdt = dt / TS;
      /* the receipt ages on the sim's own accumulated time, never wall-clock */
      if (auc.deltaT >= 0 && !auc.still) {
        auc.deltaT += rdt;
        /* the figure outlives the arrival it names: it is still on screen while
           the asset lands and the two vessels rise, and gone before the next
           auction opens */
        if (auc.deltaT > 2.45 && !el.dTrader.classList.contains('is-fading')) {
          [el.dTrader, el.dFund, el.dSig].forEach((n) => n.classList.add('is-fading'));
        }
        if (auc.deltaT > 3.1) clearReceipt();
      }
      if (auc.phase === 'open') {
        auc.lot += auc.inflow * dt; /* the lot keeps growing during the auction */
        const elapsed = auc.t - auc.started;
        auc.ask = elapsed >= EPOCH ? 0 : auc.initialAsk * (1 - elapsed / EPOCH);
        /* the stream keeps arriving: a slow drip into the open vessel */
        auc.dropT += rdt;
        if (auc.dropT > 0.7 && auc.drops.length < 3) {
          auc.dropT = 0;
          auc.drops.push({ x: 0.16, p: 0 });
        }
        auc.drops.forEach((d) => {
          d.p += rdt * 1.5;
        });
        auc.drops = auc.drops.filter((d) => d.p < 1);
        if (auc.ask <= fair()) fill();
      } else {
        auc.tradeT += rdt;
        if (!auc.landed && auc.tradeT > PAY_LANDS) {
          auc.landed = true; /* the asset's return leg arrives: light the split */
          flash(el.fund, 'evt-white');
          flash(el.sig, 'evt-pink');
        }
        if (auc.tradeT > TRADE_END) {
          /* an event lasts ONE event: whatever the frame rate did, no receipt
             from the settle just closed survives into the auction just opened */
          clearReceipt();
          auc.fundShown = auc.fundTotal;
          auc.sigShown = auc.sigTotal;
          auc.cap = auc.capTo;
          auc.capShown = auc.capTo;
          auc.lot = 420 + Math.random() * 180;
          openAuction(0);
        }
      }
      /* THE PAYMENT BEAT. The pile rises WHEN THE ASSET LANDS, not when the
         model books it — and the ruler, if it has to grow, grows on the same
         progress, so the two can never be read as separate events and the
         surface is a monotone function of one number. */
      if (auc.phase === 'trade') {
        const u = easeOut(clamp01((auc.tradeT - PAY_LANDS) / PAY_RISE));
        auc.fundShown = auc.payFund0 + (auc.fundTotal - auc.payFund0) * u;
        auc.sigShown = auc.paySig0 + (auc.sigTotal - auc.paySig0) * u;
        auc.capShown = auc.payCap0 + (auc.capTo - auc.payCap0) * u;
      }
      auc.capLit = Math.abs(auc.capTo - auc.capShown) > 0.02 ? 1 : Math.max(0, auc.capLit - rdt);
    }

    /* ---- the stage: the vessel, the ruler, the descending blade ---------- */
    function aucStage() {
      const s = fit(stage, sctx);
      const dpr = dprNow();
      sctx.clearRect(0, 0, s.w, s.h);
      if (s.w < 40 || s.h < 40) return;
      const trading = auc.phase === 'trade';
      const worth = trading ? auc.lastLot / QQQ : fair();
      const asking = trading ? auc.lastPaid : auc.ask;

      const rulerW = Math.max(26, Math.min(46, s.w * 0.105));
      const railW = Math.max(20, Math.min(32, s.w * 0.075));
      const x0 = rulerW,
        x1 = s.w - railW;
      const topY = 16,
        floorY = s.h - 10;
      const H = floorY - topY;
      const yMax = Math.max(auc.initialAsk, worth, 0.001) * 1.1;
      const Y = (v: number) => floorY - (Math.max(0, Math.min(v, yMax)) / yMax) * H;

      vesselGround(sctx, x0, topY, x1 - x0, H);

      /* THE GHOST OF THE LOT. Struck the instant the two meet and left standing
         for the whole window: a hatched column from the floor to the settle
         height, so what the trade WAS survives after the candy has gone to the
         buyer. The pack is drawn over it and reveals it as it drains. */
      if (trading) {
        const gy = Y(auc.lastPaid);
        sctx.save();
        sctx.beginPath();
        sctx.rect(x0, gy, x1 - x0, floorY - gy);
        sctx.clip();
        sctx.strokeStyle = C.hi;
        sctx.globalAlpha = 0.13;
        sctx.lineWidth = 1;
        sctx.beginPath();
        const band = floorY - gy;
        for (let dx = -band; dx < x1 - x0; dx += 10) {
          sctx.moveTo(x0 + dx, floorY);
          sctx.lineTo(x0 + dx + band, gy);
        }
        sctx.stroke();
        sctx.restore();
        sctx.globalAlpha = 1;
      }

      /* the QQQ scale — both quantities are read against the SAME ruler,
         because both the ask and the lot's worth are measured in QQQ */
      const step = niceStep(yMax / (s.h > 235 ? 4 : 3));
      sctx.font = mono(10);
      sctx.textAlign = 'right';
      sctx.textBaseline = 'middle';
      for (let v = 0; v <= yMax + 1e-9; v += step) {
        const y = Y(v);
        sctx.strokeStyle = C.rule;
        sctx.lineWidth = 1;
        sctx.beginPath();
        sctx.moveTo(x0 - 5, Math.round(y) + 0.5);
        sctx.lineTo(x0, Math.round(y) + 0.5);
        sctx.stroke();
        sctx.fillStyle = C.faint;
        sctx.fillText(v.toFixed(step < 1 ? 1 : 0), x0 - 8, y);
      }
      sctx.textAlign = 'left';
      sctx.textBaseline = 'alphabetic';
      sctx.fillStyle = C.faint;
      sctx.font = mono(9);
      sctx.fillText('QQQ', 0, topY - 5);

      /* the lot itself: USDG, drawn as what it is — capital piling up. Big
         spheres, loosely packed: this is liquid being poured and drained. */
      const drain = trading ? drainAt(auc.tradeT / DRAIN_END) : 0;
      const level = worth * (1 - drain);
      const levelY = Y(level);
      const grain: Grain = {
        d: Math.max(15, Math.min(27, (x1 - x0) / 20)),
        pitch: 0.99,
        vpitch: 0.88,
        jit: 0.3,
        rvar: 0.06,
        depth: 0.34,
      };
      const fld = buildField(C.blue, x1 - x0, H, grain, 11, dpr);
      /* the level below which no whole course can stand: the last of the lot
         fades out across it, so the pour lands on empty exactly as the window
         closes instead of a third of it early */
      const v0 = (yMax * (H - (fld.centre[0] ?? H))) / H;
      const tail = level >= v0 ? 1 : Math.max(0, level / Math.max(1e-6, v0));
      /* the waterline is ruled BEHIND the candy: the crowns break it, which is
         what a free surface of packed spheres actually looks like */
      if (level > 0.001) levelRule(sctx, x0, x1, levelY, C.blue, 0.45);
      paintField(sctx, fld, x0, topY, levelY, -1, '', dpr, tail);

      /* the inlet: USDG is still arriving, so the lot keeps growing. One
         chute, a falling column — a stream, never a stray sphere. */
      if (!trading) {
        const inletX = x0 + 0.16 * (x1 - x0);
        sctx.strokeStyle = C.blue;
        sctx.globalAlpha = 0.55;
        sctx.lineWidth = 1;
        sctx.beginPath();
        sctx.moveTo(inletX - 8, topY + 0.5);
        sctx.lineTo(inletX + 8, topY + 0.5);
        sctx.stroke();
        sctx.globalAlpha = 1;
        auc.drops.forEach((d) => {
          const dy = topY + 3 + d.p * d.p * (levelY - topY - 6);
          drawSphere(sctx, liftOf(C.blue, 0.18), inletX, dy, grain.d * 0.8, dpr, true);
        });
      }

      /* walls last, so the candy is contained by them */
      sctx.strokeStyle = C.ruleStrong;
      sctx.lineWidth = 1;
      sctx.beginPath();
      sctx.moveTo(Math.round(x0) + 0.5, topY);
      sctx.lineTo(Math.round(x0) + 0.5, floorY);
      sctx.moveTo(Math.round(x1) + 0.5, topY);
      sctx.lineTo(Math.round(x1) + 0.5, floorY);
      sctx.stroke();
      sctx.strokeStyle = C.hi;
      sctx.globalAlpha = 0.5;
      sctx.lineWidth = 1.5;
      sctx.beginPath();
      sctx.moveTo(x0, Math.round(floorY) + 0.5);
      sctx.lineTo(x1, Math.round(floorY) + 0.5);
      sctx.stroke();
      sctx.globalAlpha = 1;

      /* the exact worth, ticked on both walls. While the lot DRAINS the figure
         is withdrawn: the caption below already states the settled worth, and
         two live numbers for one quantity that disagree is a lie on screen. */
      const draining = trading && !auc.still && drain > 0.02;
      if (level > 0.001) {
        levelTicks(sctx, x0, x1, levelY, C.blue);
        if (!draining) {
          const tight = Y(asking) > levelY - 26;
          plate(sctx, level.toFixed(2), x0 + 7, levelY + (tight ? 15 : -7), 'left', C.blueLabel);
        }
      }
      if (draining) {
        sctx.font = mono(10, 600);
        sctx.textAlign = 'left';
        sctx.fillStyle = C.blueLabel;
        sctx.globalAlpha = Math.min(1, drain * 4);
        sctx.fillText('USDG TO THE BUYER', x0 + 7, topY + 14);
        sctx.globalAlpha = 1;
      }

      /* the rail the ask rides: from the opening price straight down to zero.
         Behind the carriage it is solid; ahead of it, dashed — the descent is
         committed and it ends at nothing. */
      const railX = Math.round(x1 + railW * 0.5) + 0.5;
      sctx.strokeStyle = C.pink;
      sctx.globalAlpha = 0.3;
      sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.moveTo(railX, Y(auc.initialAsk));
      sctx.lineTo(railX, Y(asking));
      sctx.stroke();
      /* the descent still to come — drawn only while the ask is still falling.
         Once it has met the lot the descent is over, and a track ahead of a
         carriage that has stopped is a path with nothing on it. */
      if (!trading) {
        sctx.globalAlpha = 0.8;
        sctx.setLineDash([3, 4]);
        sctx.beginPath();
        sctx.moveTo(railX, Y(asking));
        sctx.lineTo(railX, floorY);
        sctx.stroke();
        sctx.setLineDash([]);
        sctx.fillStyle = C.pink;
        sctx.fillRect(railX - 4, floorY - 1, 8, 2);
      }
      sctx.globalAlpha = 1;

      /* the ask: a blade lying across the vessel, descending onto the lot */
      const askY = Y(asking);
      sctx.globalAlpha = trading ? 0.42 : 1;
      sctx.fillStyle = C.pink;
      sctx.fillRect(x0, askY - 1.5, x1 - x0, 3);
      sctx.fillRect(x1, askY - 1.5, railX - x1 + 4, 3);
      sctx.fillRect(railX - 3.5, askY - 5, 7, 10);
      sctx.globalAlpha = 1;
      plate(sctx, asking.toFixed(2), x1 - 7, askY - 7, 'right', trading ? C.hi : C.pinkLabel);

      /* THE CROSSING. Struck in white and ringed at the meet point, and left
         standing on top of its own hatched ghost for the whole window — so the
         argument is still on the drawing after the lot has gone. */
      if (trading) {
        const my = Y(auc.lastPaid);
        const mx = (x0 + x1) / 2;
        sctx.strokeStyle = C.hi;
        sctx.globalAlpha = auc.tradeT < 0.5 ? 1 : 0.82;
        sctx.lineWidth = 2;
        sctx.beginPath();
        sctx.moveTo(x0, my);
        sctx.lineTo(x1, my);
        sctx.stroke();
        const ping = Math.min(1, auc.tradeT / 0.34);
        if (ping < 1) {
          sctx.lineWidth = 1.5;
          sctx.globalAlpha = Math.max(0, 1 - ping) * 0.9;
          sctx.beginPath();
          sctx.arc(mx, my, 5 + ping * 16, 0, Math.PI * 2);
          sctx.stroke();
        }
        /* the marker itself stays for the whole trade, exactly as the
           reduced-motion still draws it */
        sctx.globalAlpha = 1;
        sctx.fillStyle = '#0c0c0c';
        sctx.beginPath();
        sctx.arc(mx, my, 5.5, 0, Math.PI * 2);
        sctx.fill();
        sctx.strokeStyle = C.hi;
        sctx.lineWidth = 2;
        sctx.beginPath();
        sctx.arc(mx, my, 5.5, 0, Math.PI * 2);
        sctx.stroke();
      }

      auc.geo.mouthX = (x0 + x1) / 2;
      auc.geo.rimRightX = x1 - 10;
      auc.geo.rimY = topY + 4;
      /* the lot leaves from the surface of the lot, wherever that currently
         is — so the transfer starts at the candy, not at an empty rim */
      auc.geo.surfaceY = Math.min(levelY, floorY - 4);
    }

    /* ---- the two destinations, drawn as vessels on ONE shared scale -------
       Same capacity, same grain: the treasury's ninety and the signalers'
       tenth are the same picture at nine times the height. Neutral for the
       treasury leg and pink for the signalers, per MODELS.md §4. */
    function destVessel(
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D,
      total: number,
      color: string,
      seed: number,
    ) {
      const s = fit(canvas, ctx);
      const dpr = dprNow();
      ctx.clearRect(0, 0, s.w, s.h);
      if (s.w < 24 || s.h < 24) return;
      const x0 = 1,
        x1 = s.w - 1,
        topY = 1,
        floorY = s.h - 1;
      const H = floorY - topY;
      vesselGround(ctx, x0, topY, x1 - x0, H);
      const frac = Math.max(0, Math.min(1, total / Math.max(0.001, auc.capShown)));
      const levelY = floorY - frac * H;
      /* a shallow ambient is baked into the pack; the light itself is applied
         below, measured from the surface, so a tenth-full store is lit too */
      const grain: Grain = {
        d: Math.max(7.5, Math.min(11, (x1 - x0) / 17)),
        pitch: 1.02,
        vpitch: 0.88,
        jit: 0.26,
        rvar: 0.06,
        depth: 0.1,
        kMin: 0.86,
      };
      const fld = buildField(color, x1 - x0, H, grain, seed, dpr);
      /* the signalers' tenth is smaller than one course for the first settles;
         it fades in as a part-course rather than showing an empty vessel while
         the figure beneath it already reads 0.15 QQQ */
      const c0 = (H - (fld.centre[0] ?? H)) / H;
      const tail = frac >= c0 ? 1 : Math.max(0, frac / Math.max(1e-6, c0));
      if (frac > 0.0005) {
        levelRule(ctx, x0, x1, levelY, color, 0.5);
        paintField(ctx, fld, x0, topY, levelY, -1, '', dpr, tail);
        /* ONE LIGHT SOURCE, from above, the same one the lot vessel obeys: the
           surface course takes the light, the body falls away under it, and
           the floor takes a contact shadow. Measured from the LEVEL, not from
           the rim, or a store that is a tenth full reads as flat speckle. */
        const depth = Math.max(1, floorY - levelY);
        const lg = ctx.createLinearGradient(0, levelY, 0, floorY);
        lg.addColorStop(0, 'rgba(255,255,255,0.10)');
        lg.addColorStop(0.2, 'rgba(255,255,255,0)');
        lg.addColorStop(1, 'rgba(5,5,8,0.36)');
        ctx.fillStyle = lg;
        ctx.fillRect(x0, levelY, x1 - x0, depth);
        const shad = Math.min(10, depth);
        const cs = ctx.createLinearGradient(0, floorY - shad, 0, floorY);
        cs.addColorStop(0, 'rgba(5,5,8,0)');
        cs.addColorStop(1, 'rgba(5,5,8,0.2)');
        ctx.fillStyle = cs;
        ctx.fillRect(x0, floorY - shad, x1 - x0, shad);
        levelTicks(ctx, x0, x1, levelY, color, 7);
      }
      ctx.strokeStyle = C.ruleStrong;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x0) + 0.5, Math.round(topY) + 0.5, Math.round(x1 - x0) - 1, Math.round(H) - 1);
      /* THE RULER. One ceiling for both vessels, so the treasury's pile and
         the tenth beside it are the same picture nine times apart. It is an
         axis, not a corner digit: a ticked ceiling and a ticked floor. When a
         payment outgrows it the ceiling is raised ON THAT PAYMENT and counts
         up while the pile rises past its old level — headroom being added,
         never contents being taken away. */
      const moving = auc.capLit > 0.001;
      const axis = moving ? C.hi : C.muted;
      ctx.strokeStyle = axis;
      ctx.globalAlpha = moving ? 0.9 : 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1 - 7, Math.round(topY) + 1.5);
      ctx.lineTo(x1 - 1, Math.round(topY) + 1.5);
      ctx.moveTo(x1 - 5, Math.round(topY + H / 2) + 0.5);
      ctx.lineTo(x1 - 1, Math.round(topY + H / 2) + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      /* the rungs are read against the candy as often as against the ground,
         so each carries its own dark halo rather than dissolving into a pack */
      const rung = (t: string, y: number, baseline: CanvasTextBaseline, col: string, px: number) => {
        ctx.font = mono(px, 500);
        ctx.textAlign = 'right';
        ctx.textBaseline = baseline;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(10,10,14,0.88)';
        ctx.strokeText(t, x1 - 10, y);
        ctx.fillStyle = col;
        ctx.fillText(t, x1 - 10, y);
      };
      /* the ceiling is a live quantity, not a round decoration: it carries its
         tenth so the label and the level can never disagree by more than half
         a percent, whatever the last payment stretched it to */
      rung(auc.capShown.toFixed(1), topY + 3, 'top', axis, 10.5);
      rung('0', floorY - 3, 'bottom', C.muted, 9.5);
    }

    function aucPaint() {
      const trading = auc.phase === 'trade';
      const worth = trading ? auc.lastLot / QQQ : fair();
      const asking = trading ? auc.lastPaid : auc.ask;

      el.lot.textContent = money(trading ? auc.lastLot : auc.lot);
      el.ask.textContent = asking.toFixed(2) + ' QQQ';
      el.worthCap.textContent = worth.toFixed(2);
      el.askCap.textContent = asking.toFixed(2);
      el.fundT.textContent = auc.fundTotal.toFixed(2) + ' QQQ';
      el.sigT.textContent = auc.sigTotal.toFixed(2) + ' QQQ';
      el.state.textContent = trading
        ? 'settled: ' + money(auc.lastLot) + ' for ' + auc.lastPaid.toFixed(2) + ' QQQ'
        : 'lot ' +
          money(auc.lot) +
          ' · asking ' +
          auc.ask.toFixed(2) +
          ' QQQ' +
          (auc.epoch ? ' · ' + auc.epoch + ' settled' : '');

      aucStage();

      destVessel(fundWellEl, fwctx, auc.fundShown, FUND_INK, 41);
      destVessel(sigWellEl, swctx, auc.sigShown, SIG_INK, 57);

      /* ---- the linkage. Drawn ONLY while something is travelling it: a path
         with nothing on it is decoration, and it was eating half the panel.
         Measured only when the canvas resizes, so a paint never forces a
         reflow, and routed so no sphere and no track crosses running type. */
      const wsz = fit(wire, wctx);
      const dpr = dprNow();
      wctx.clearRect(0, 0, wsz.w, wsz.h);
      const key = `${wsz.w}x${wsz.h}|${auc.geo.mouthX.toFixed(0)}`;
      if (key !== wireKey) {
        wireKey = key;
        const base = acqWrap.getBoundingClientRect();
        const sr = stage.getBoundingClientRect();
        const tr = el.trader.getBoundingClientRect();
        const fr = el.fund.getBoundingClientRect();
        const gr = el.sig.getBoundingClientRect();
        const fw = fundWellEl.getBoundingClientRect();
        const gw = sigWellEl.getBoundingClientRect();
        stageOff = sr.top - base.top;
        const stacked = tr.top - base.top - (sr.top - base.top + auc.geo.rimY) > 90;
        const rimX = sr.left - base.left + auc.geo.rimRightX;
        if (stacked) {
          /* everything is a full-width row: the lot hops down the clear right
             channel beside the captions, never across them */
          const chan = Math.min(wsz.w - 12, rimX + 8);
          pathLot = smoothPath([
            [rimX, 0],
            [chan, sr.bottom - base.top + 10],
            [Math.min(tr.right - base.left - 14, chan), tr.top - base.top - 2],
          ]);
        } else {
          /* out of the vessel, up through the empty gutter between the two
             columns, and onto the LEFT tip of the trader's rule — the arc
             never reaches the x of the paragraph, let alone its line boxes */
          const gutter = (sr.right + tr.left) / 2 - base.left;
          pathLot = smoothPath([
            [rimX, 0],
            [gutter, sr.top - base.top + 10],
            [tr.left - base.left - 16, tr.top - base.top - 5],
            [tr.left - base.left + 5, tr.top - base.top - 4],
          ]);
        }
        /* the split leaves the trader's bottom edge, runs the gap above the
           destinations as a manifold, then drops into each vessel's mouth on
           the clear side of its label. The label is a block, so its ink is
           measured with a Range — its box spans the whole column. */
        const inkRight = (label: HTMLElement | null) => {
          if (!label) return -Infinity;
          const rng = document.createRange();
          rng.selectNodeContents(label);
          return rng.getBoundingClientRect().right;
        };
        const dropInto = (well: DOMRect, label: HTMLElement | null): Pt => {
          const min = well.left - base.left + 13;
          const max = well.right - base.left - 13;
          const want = inkRight(label) - base.left + 15;
          return [Math.max(min, Math.min(max, want)), well.top - base.top + 3];
        };
        /* the manifold runs down the middle of the clear gap between the
           trader and the destinations — never grazing the receipt line that
           closes the trader block, whether it is written or reserved */
        const gapTop = tr.bottom - base.top;
        const busY = gapTop + (Math.min(fr.top, gr.top) - base.top - gapTop) * 0.55;
        const fEnd = dropInto(fw, el.fund.querySelector('.acq__label'));
        const gEnd = dropInto(gw, el.sig.querySelector('.acq__label'));
        const startX = tr.left - base.left + 10;
        pathFund = smoothPath([[startX, busY], [fEnd[0], busY], fEnd]);
        pathSig = smoothPath([[startX, busY], [gEnd[0], busY], gEnd]);
        acqBoxes = textBoxes(
          base,
          acqWrap,
          '.acq__label, .acq__read .v, .acq__read .l, .acq__party p, .acq__total, .acq__delta, .acq__caps > *',
          2,
        );
      }
      /* the launch point tracks the surface every frame; the cached path only
         has to be re-measured when the layout itself changes */
      const first = pathLot[0];
      if (first) first.y0 = stageOff + auc.geo.surfaceY;
      if (!trading && !auc.still) return;

      wctx.save();
      clipAwayText(wctx, wsz.w, wsz.h, acqBoxes);
      wctx.setLineDash([2, 5]);
      wctx.lineWidth = 1;
      wctx.globalAlpha = 0.55;
      wctx.strokeStyle = C.blue;
      strokePath(wctx, pathLot);
      wctx.strokeStyle = FUND_INK;
      wctx.globalAlpha = 0.4;
      strokePath(wctx, pathFund);
      wctx.strokeStyle = SIG_INK;
      wctx.globalAlpha = 0.55;
      strokePath(wctx, pathSig);
      wctx.setLineDash([]);
      wctx.globalAlpha = 1;

      const d = wsz.w < 560 ? 11 : 13;
      if (auc.still) {
        /* frozen: the asset at rest where it landed — nine to the treasury and
           one to the signalers, countable without a frame of motion */
        for (let i = 0; i < 3; i++) {
          const xy = pathPoint(pathLot, 0.42 + i * 0.16);
          drawSphere(wctx, liftOf(C.blue, 0.16), xy[0], xy[1], d, dpr, true);
        }
        for (let i = 0; i < 9; i++) {
          const xy = pathPoint(pathFund, 0.1 + i * 0.079);
          drawSphere(wctx, liftOf(FUND_INK, 0), xy[0], xy[1], d, dpr, true);
        }
        const sxy = pathPoint(pathSig, 0.92);
        drawSphere(wctx, liftOf(SIG_INK, 0.2), sxy[0], sxy[1], d, dpr, true);
        wctx.restore();
        return;
      }

      auc.parts.forEach((pt) => {
        const p = (auc.tradeT - pt.t0) * pt.sp;
        if (p < 0 || p > 1) return;
        const segs = pt.kind === 'usdg' ? pathLot : pt.kind === 'fund' ? pathFund : pathSig;
        const xy = pathPoint(segs, p);
        const ink = pt.kind === 'usdg' ? liftOf(C.blue, 0.16) : pt.kind === 'fund' ? FUND_INK : liftOf(SIG_INK, 0.2);
        drawSphere(wctx, ink, xy[0], xy[1], d, dpr, true);
      });
      wctx.restore();
    }

    function aucReset() {
      auc.still = false;
      auc.parts = [];
      clearReceipt();
      /* a returning reader arrives the same way the first one did: one settled
         lot already in the vessel, against the ruler's opening ceiling */
      seedHistory();
    }

    /* Paint once at wiring time so every readout carries its final shape
       before the first post-hydration frame — the JSX pre-fills carry the
       geometry; this stamps the live (randomised) opening state over them. */
    aucPaint();

    const unregisterAcquire = registerSim({
      name: 'acquire',
      el: acqPanel,
      timeScale: TS,
      step: aucStep,
      paint: aucPaint,
      reset: aucReset,
      static: () => {
        /* the moment of contact, which is the whole mechanism in one frame:
           the blade resting exactly on the surface of the lot, the crossing
           ringed, and the asset already delivered nine-to-one */
        auc.still = true;
        auc.epoch = 5;
        /* several settles in: the treasury's pile is most of the vessel and
           the signalers' is a ninth of it, against the ceiling the ruler will
           have grown to by then — the same instrument the live sim shows, at a
           later moment in the same run */
        auc.fundTotal = 5.67;
        auc.sigTotal = 0.63;
        auc.fundShown = 5.67;
        auc.sigShown = 0.63;
        auc.cap = 8;
        auc.capShown = 8;
        auc.capTo = 8;
        auc.capLit = 0;
        auc.payFund0 = 5.67;
        auc.paySig0 = 0.63;
        auc.payCap0 = 8;
        auc.deltaT = -1;
        [el.dTrader, el.dFund, el.dSig].forEach((n) => n.classList.remove('is-fading'));
        el.dTrader.innerHTML = '<span class="blue">+ $505 USDG in</span> · <span class="pink">1.04 QQQ out</span>';
        el.dFund.textContent = '+ 0.94 QQQ';
        el.dSig.textContent = '+ 0.10 QQQ';
        auc.lot = 505;
        auc.lastLot = 505;
        auc.lastPaid = 505 / QQQ;
        auc.initialAsk = 2.05;
        auc.started = 0;
        auc.t = EPOCH * (1 - auc.lastPaid / auc.initialAsk);
        auc.ask = auc.lastPaid;
        auc.phase = 'trade';
        auc.tradeT = 0.02; /* frozen inside the hold: level and ask coincide */
        auc.openedAt = auc.t - 10 * TS;
        auc.parts = [];
        auc.drops = [];
        el.meet.textContent = 'they met — settled';
        el.meet.classList.add('is-met');
        aucPaint();
      },
    });

    /* ====================================================== redemption ==
       Lifted from docs/deck/gumball6900-deck.html (red, lines 1848-1929) and
       documented in docs/MODELS.md §5. Nobody operates it: burns arrive on a
       programme of the panel's own accumulated time, alternating other
       holders' small burns with the reader's own 10%-of-supply burn — the
       headline mechanism, with the full receipt. The animated phase only
       interpolates the display; state mutates once, at the end. Real time.

       DRAWN as the thing it is: the fund is four bays of packed candy, each a
       different asset in its own hue and grain. A burn lifts the same
       proportion out of EVERY bay at the same instant; those spheres leave by
       each bay's own chute, run one manifold, and fill the redeemer's cup. */
    const HOLDERS = ['@ava', '@pike', '@juno', '@wren', '@sol', '@bex'];
    const SUPPLY0 = 100000000;

    function amtFmt(v: number) {
      return v.toFixed(v < 10 ? 4 : 1);
    }
    function takenFmt(v: number) {
      return v.toFixed(v < 10 ? 4 : 2);
    }

    interface Hold {
      sym: string;
      amt: number;
      base: number;
      hue: string;
      grain: number;
      el: HTMLElement;
      amtEl: HTMLElement;
      wellEl: HTMLCanvasElement;
      wellCtx: CanvasRenderingContext2D;
      outEl: HTMLElement;
      levelY: number;
    }
    /* The cells are server-rendered (zero CLS) — wire them, don't rebuild. */
    const cells = Array.from(rdmVault.querySelectorAll<HTMLElement>('.hold'));
    if (cells.length !== ASSETS.length) return;
    const holds: Hold[] = [];
    for (let i = 0; i < ASSETS.length; i++) {
      const def = ASSETS[i];
      const cell = cells[i];
      if (!def || !cell) return;
      const amtEl = cell.querySelector<HTMLElement>('.hold__amt');
      const wellEl = cell.querySelector<HTMLCanvasElement>('canvas.hold__well');
      const outEl = cell.querySelector<HTMLElement>('.hold__out');
      if (!amtEl || !wellEl || !outEl) return;
      const wellCtx = wellEl.getContext('2d');
      if (!wellCtx) return;
      holds.push({
        sym: def.sym,
        amt: def.amt,
        base: def.amt,
        hue: def.hue,
        grain: def.grain,
        el: cell,
        amtEl,
        wellEl,
        wellCtx,
        outEl,
        levelY: 0,
      });
    }

    const red = {
      t: 0,
      supply: SUPPLY0,
      next: 1.6,
      phase: 'idle' as 'idle' | 'burn',
      pt: 0,
      who: '',
      mine: false,
      pct: 0,
      burned: 0,
      still: false,
      taken: [] as number[],
      parts: [] as { i: number; d: number }[],
      /* what the cup holds, PER BAY: the four piles are the proof that the
         same proportion came out of every holding, and they sit under the bay
         each one fell from */
      cupBy: ASSETS.map(() => 0),
      cupX: [] as number[],
      holds,
    };
    const TRAVEL = 0.62; /* real seconds a sphere spends on the manifold */
    /* Same-shape zero-state line so the destination card wraps to its final
       height at load instead of shifting on the first burn. */
    rdmTake.textContent = '→ ' + red.holds.map((h) => takenFmt(0) + ' ' + h.sym).join(' · ');

    /* indexed reads under noUncheckedIndexedAccess: taken[] always mirrors
       holds[] (built together in begin()), so a missing slot reads as 0 */
    const takenAt = (i: number) => red.taken[i] ?? 0;

    function receiptHTML() {
      return (
        '<strong>' +
        red.who +
        '</strong> received ' +
        red.holds.map((h, i) => '<strong>' + takenFmt(takenAt(i)) + ' ' + h.sym + '</strong>').join(', ') +
        ' — the same ' +
        (red.pct * 100).toFixed(2) +
        '% of every holding, in one transaction.'
      );
    }
    function takeLine(k: number) {
      return '→ ' + red.holds.map((h, i) => takenFmt(takenAt(i) * k) + ' ' + h.sym).join(' · ');
    }

    function begin(who: string, pct: number) {
      red.phase = 'burn';
      red.pt = 0;
      red.who = who;
      red.mine = who === '@you';
      red.pct = pct;
      red.burned = red.supply * pct;
      red.taken = red.holds.map((h) => h.amt * pct);
      red.holds.forEach((h) => h.el.classList.add('is-paying'));
      rdmVault.classList.add('is-paying');
      rdmDest.classList.add('is-receiving');
      rdmDest.classList.toggle('is-mine', red.mine);
      rdmWho.textContent = who + (red.mine ? ' receive' : ' receives');
      /* every bay gives up the same proportion at the same instant, so all
         four emit the same count, interleaved — the cup fills with a mix */
      const per = Math.max(3, Math.min(10, Math.round(pct * 70)));
      red.parts = [];
      const total = per * red.holds.length;
      for (let k = 0; k < per; k++) {
        for (let i = 0; i < red.holds.length; i++) {
          const n = red.parts.length;
          red.parts.push({ i, d: (n / Math.max(1, total - 1)) * 0.52 });
        }
      }
      red.cupBy = red.holds.map(() => 0);
      rdmOut.innerHTML =
        '<strong>' +
        red.who +
        '</strong> burns <strong>' +
        Math.round(red.burned).toLocaleString('en-US') +
        ' GBX</strong> — ' +
        (red.pct * 100).toFixed(2) +
        '% of everything in existence.';
    }
    function finalize() {
      red.supply -= red.burned;
      red.holds.forEach((h, i) => {
        h.amt -= takenAt(i);
        h.el.classList.remove('is-paying');
      });
      rdmVault.classList.remove('is-paying');
      rdmDest.classList.remove('is-receiving');
      rdmTake.textContent = takeLine(1);
      /* the cup keeps what it received until the next redeemer takes theirs,
         so the vessel and the receipt printed under it never disagree */
      red.cupBy = red.holds.map((_, i) => red.parts.filter((p) => p.i === i).length);
      red.parts = [];
      rdmOut.innerHTML = receiptHTML();
      red.phase = 'idle';
      red.next = red.t + (red.mine ? 4.6 + Math.random() : 3.0 + Math.random() * 0.9);
    }

    /* The programme: the reader's own burn first, then an ambient one, and so
       on. Deterministic order, so the headline beat is guaranteed, not lucky. */
    let burnIdx = 0;
    function nextScheduledBurn() {
      const mine = burnIdx % 2 === 0;
      burnIdx++;
      if (mine) begin('@you', 0.1);
      else begin(HOLDERS[Math.floor(Math.random() * HOLDERS.length)] ?? '@ava', 0.04 + Math.random() * 0.04);
    }

    function redStep(rdt: number) {
      red.t += rdt;
      if (red.phase === 'idle') {
        /* between burns the panel is never still: the Strategies keep buying,
           so each holding creeps back toward its pre-burn baseline, and the
           Mine keeps issuing, so the supply ticks steadily back up. */
        const g = 1 - Math.exp(-rdt * 0.13);
        red.holds.forEach((h) => {
          h.amt = Math.min(h.base, h.amt + (h.base - h.amt) * g + h.base * 0.004 * rdt);
        });
        red.supply = Math.min(SUPPLY0, red.supply + (SUPPLY0 - red.supply) * g + 45000 * rdt);
        if (red.t >= red.next) nextScheduledBurn();
        return;
      }
      red.pt += rdt;
      const landed = red.holds.map(() => 0);
      red.parts.forEach((p) => {
        if ((red.pt - p.d) / TRAVEL >= 1) landed[p.i] = (landed[p.i] ?? 0) + 1;
      });
      red.cupBy = landed;
      if (red.pt >= 1.5) finalize();
    }

    /* ---- one bay of the vault: a compartment of the fund, in spheres ----- */
    function drawWell(h: Hold, idx: number, shownFrac: number, finalFrac: number, burning: boolean) {
      const w = fit(h.wellEl, h.wellCtx);
      const ctx = h.wellCtx;
      const dpr = dprNow();
      ctx.clearRect(0, 0, w.w, w.h);
      if (w.w < 20 || w.h < 20) return;
      const x0 = 1,
        x1 = w.w - 1,
        topY = 1,
        floorY = w.h - 1;
      const H = floorY - topY;
      const cap = 1.22; /* headroom, so a level and its refill are both visible */
      const levelY = floorY - Math.max(0, Math.min(shownFrac, cap)) * (H / cap);
      const finalY = floorY - Math.max(0, Math.min(finalFrac, cap)) * (H / cap);

      vesselGround(ctx, x0, topY, x1 - x0, H);
      /* a store, not a pour: many smaller spheres, tightly packed, and each
         asset with its own grain so four bays are four different things */
      const grain: Grain = {
        d: Math.max(7, Math.min(17, ((x1 - x0) / 15) * h.grain)),
        pitch: 1.02,
        vpitch: 0.88,
        jit: 0.26,
        rvar: 0.06,
        depth: 0.34,
      };
      const fld = buildField(h.hue, x1 - x0, H, grain, 7 + idx * 13, dpr);
      levelRule(ctx, x0, x1, levelY, h.hue, 0.5);
      paintField(ctx, fld, x0, topY, levelY, burning ? finalY : -1, liftOf(h.hue, 0.52), dpr);

      /* the baseline this bay is measured against, so a level can never be
         mistaken for an absolute quantity — the figure above the bay is that */
      ctx.strokeStyle = C.ruleStrong;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      const baseY = floorY - H / cap;
      ctx.beginPath();
      ctx.moveTo(x0, Math.round(baseY) + 0.5);
      ctx.lineTo(x1, Math.round(baseY) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      levelTicks(ctx, x0, x1, levelY, h.hue, 8);
      /* where the burn is taking it: neutral, because a burn is neutral */
      if (burning) {
        ctx.strokeStyle = C.hi;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, finalY);
        ctx.lineTo(x1, finalY);
        ctx.stroke();
      }

      ctx.strokeStyle = burning ? C.hi : C.ruleStrong;
      ctx.globalAlpha = burning ? 0.75 : 1;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x0) + 0.5, Math.round(topY) + 0.5, Math.round(x1 - x0) - 1, Math.round(H) - 1);
      ctx.globalAlpha = 1;
      h.levelY = levelY;
    }

    /* ---- the redeemer's cup: a vessel in the same material as the vault ----
       It spans the full width UNDER the bays, so the four streams land ACROSS
       it instead of pinching to a point, and each bay's share settles into its
       own pile directly beneath the bay it came out of — four piles of equal
       height, which is the pro-rata argument drawn rather than asserted. */
    function drawCup(counts: number[], lit: boolean) {
      const s = fit(cupEl, cupCtx);
      const dpr = dprNow();
      cupCtx.clearRect(0, 0, s.w, s.h);
      if (s.w < 30 || s.h < 20) return;
      const x0 = 1,
        x1 = s.w - 1,
        topY = 1,
        floorY = s.h - 1;
      vesselGround(cupCtx, x0, topY, x1 - x0, floorY - topY);
      const d = Math.max(9, Math.min(15, (floorY - topY) / 5.2));
      const inset = d / 2 + 4;
      const vstep = d * 0.86;
      counts.forEach((n, i) => {
        const hue = red.holds[i]?.hue;
        if (!hue) return;
        const cx = red.cupX[i] ?? (s.w * (i + 0.5)) / Math.max(1, counts.length);
        const wide = n > 6 ? 4 : 3;
        let left = Math.max(0, Math.min(Math.round(n), 14));
        let row = 0;
        while (left > 0 && row < 4) {
          const cols = row % 2 === 1 ? wide - 1 : wide;
          const take = Math.min(left, cols);
          const span = (take - 1) * d * 0.95;
          for (let c = 0; c < take; c++) {
            const px = cx - span / 2 + c * d * 0.95;
            const py = floorY - inset - row * vstep + (hash3(91 + i, row, c) - 0.5) * 0.28 * d;
            if (py > topY + d / 2) drawSphere(cupCtx, liftOf(hue, 0.3), px, py, d, dpr);
          }
          left -= take;
          row++;
        }
      });
      /* the floor the piles rest on */
      const cs = cupCtx.createLinearGradient(0, floorY - 9, 0, floorY);
      cs.addColorStop(0, 'rgba(5,5,8,0)');
      cs.addColorStop(1, 'rgba(5,5,8,0.3)');
      cupCtx.fillStyle = cs;
      cupCtx.fillRect(x0, floorY - 9, x1 - x0, 9);
      /* the vessel carries its own name, so it is never an unlabelled box */
      cupCtx.font = mono(10, 500);
      cupCtx.textAlign = 'left';
      cupCtx.textBaseline = 'top';
      cupCtx.fillStyle = lit ? C.muted : C.faint;
      cupCtx.fillText('THE REDEEMER’S CUP', x0 + 9, topY + 8);
      /* the rim lights only for the reader's own burn — the headline beat */
      cupCtx.strokeStyle = lit ? C.hi : C.ruleStrong;
      cupCtx.globalAlpha = lit ? 0.9 : 1;
      cupCtx.lineWidth = lit ? 1.5 : 1;
      cupCtx.strokeRect(
        Math.round(x0) + 0.5,
        Math.round(topY) + 0.5,
        Math.round(x1 - x0) - 1,
        Math.round(floorY - topY) - 1,
      );
      cupCtx.globalAlpha = 1;
      return;
    }

    let rdmKey = '';
    let rdmPaths: Seg[][] = [];
    let rdmBoxes: number[][] = [];
    /* measured with the rest of the layout, never per frame */
    let supplyBarW = 0;

    function redPaint() {
      const burning = red.phase === 'burn';
      const k = burning ? Math.min(1, red.pt / 1.1) : 0;
      /* every text write first, then every canvas measure — interleaving them
         would force one layout per bay instead of one for the whole frame */
      const frac = red.holds.map((h, i) => {
        const out = burning ? takenAt(i) * k : 0;
        const shown = h.amt - out;
        h.amtEl.textContent = amtFmt(shown);
        h.outEl.textContent = burning ? '→ ' + takenFmt(takenAt(i) * k) + ' out' : '';
        return [Math.max(0, shown / h.base), burning ? (h.amt - takenAt(i)) / h.base : 0];
      });
      /* GBX supply: the burned slice extinguishes off the end of the bar. It
         goes out, it does not travel — nothing receives a burned token. */
      const supShown = red.supply - (burning ? red.burned * k : 0);
      rdmSupply.textContent = Math.round(supShown).toLocaleString('en-US');
      rdmSupplyFill.style.width = (Math.max(0, supShown / SUPPLY0) * 100).toFixed(2) + '%';
      if (burning) {
        const supFinal = (red.supply - red.burned) / SUPPLY0;
        /* placed with a transform, not with `left`: a box moved by a layout
           property registers as a layout shift even absolutely positioned */
        rdmSupplySlice.style.transform = 'translateX(' + (supFinal * supplyBarW).toFixed(1) + 'px)';
        rdmSupplySlice.style.width = (Math.max(0, supShown / SUPPLY0 - supFinal) * 100).toFixed(2) + '%';
        rdmTake.textContent = takeLine(k);
      } else {
        rdmSupplySlice.style.width = '0';
      }
      red.holds.forEach((h, i) => {
        const f = frac[i];
        drawWell(h, i, f?.[0] ?? 0, f?.[1] ?? 0, burning);
      });

      /* the journey: the same proportion lifts off the surface of EVERY bay at
         the same instant, leaves by that bay's own chute, runs one manifold
         and lands in the cup. Four tracks, drawn on every burn. */
      const ws = fit(rdmWireEl, rctx);
      const dpr = dprNow();
      rctx.clearRect(0, 0, ws.w, ws.h);
      /* Coordinates are measured against the TRANSFER LAYER, not the block it
         covers: where the bays reflow, that canvas reaches past the
         composition into the panel's margin so a stream can descend outside
         the board. At full width the two coincide. */
      const base = rdmWireEl.getBoundingClientRect();
      const cr = cupEl.getBoundingClientRect();
      const key = `${ws.w}x${ws.h}|${(cr.top - base.top).toFixed(0)}`;
      if (key !== rdmKey) {
        rdmKey = key;
        supplyBarW = (rdmSupplyFill.parentElement as HTMLElement | null)?.clientWidth ?? 0;
        const boardR = rdmVault.getBoundingClientRect();
        const boardBottom = boardR.bottom - base.top;
        const mouthY = cr.top - base.top + 3;
        const gapH = mouthY - boardBottom;
        const cxRaw = red.holds.map((h) => {
          const wr = h.wellEl.getBoundingClientRect();
          return wr.left - base.left + wr.width / 2;
        });
        /* the rows of the board as it is actually laid out: four across at a
           full width, two by two when it reflows */
        const rowTops = Array.from(new Set(red.holds.map((h) => Math.round(h.el.getBoundingClientRect().top)))).sort(
          (a, b) => a - b,
        );
        const rowOf = (i: number) => rowTops.indexOf(Math.round((red.holds[i] as Hold).el.getBoundingClientRect().top));
        const stacked = rowTops.length > 1;
        /* THE CLEAR MARGINS either side of the instrument. A bay with another
           bay beneath it cannot descend inside the board without drawing one
           asset's candy over another asset's cell, so it leaves the board
           sideways and drops OUTSIDE it — the same clear channel on its own
           side that the outer bays already use. */
        const outL = (boardR.left - base.left) / 2;
        const outR = (boardR.right - base.left + ws.w) / 2;
        /* all sideways travel happens between the board's bottom rule and the
           cup's mouth; the two rows take their own lanes in that band so no
           two streams ever share a line */
        const laneOf = (i: number) =>
          stacked ? boardBottom + gapH * (rowOf(i) === 0 ? 0.3 : 0.68) : boardBottom + Math.max(8, gapH * 0.5);
        /* Where each share lands. With one row every pile sits under the bay
           it fell from. Reflowed, two bays share a column and cannot — so the
           piles are laid out in the order of the receipt printed under them,
           which is also the reading order of the bays above. */
        const landX = red.holds.map((h, i) =>
          stacked ? cr.left - base.left + ((i + 0.5) / red.holds.length) * cr.width : (cxRaw[i] ?? 0),
        );
        red.cupX = landX.map((x) => x + base.left - cr.left);
        rdmPaths = red.holds.map((h, i) => {
          const wr = h.wellEl.getBoundingClientRect();
          const cellR = h.el.getBoundingClientRect();
          const wellCx = cxRaw[i] ?? 0;
          const rimY = wr.top - base.top + 6;
          /* the chute: the clear channel reserved down the right of every bay,
             so a sphere on its way out never crosses a figure */
          const chuteX =
            stacked && rowOf(i) < rowTops.length - 1
              ? wellCx < ws.w / 2
                ? outL
                : outR
              : (wr.right + cellR.right) / 2 - base.left;
          const drop = landX[i] ?? wellCx;
          const laneY = laneOf(i);
          return smoothPath([
            [wellCx, 0],
            [wellCx, rimY],
            [chuteX, rimY],
            [chuteX, boardBottom],
            [chuteX, laneY] /* the descent finishes before anything turns */,
            [drop, laneY],
            [drop, mouthY],
          ]);
        });
        rdmBoxes = textBoxes(
          base,
          rdmWrap,
          '.hold__sym, .hold__amt, .hold__out, .rdm__supply, .rdm__dest > *, .rdm__out',
        );
      }
      /* the surface each track leaves from moves with the level */
      red.holds.forEach((h, i) => {
        const p = rdmPaths[i];
        const f = p?.[0];
        if (!p || !f) return;
        const wr = h.wellEl.getBoundingClientRect();
        f.y0 = wr.top - base.top + h.levelY;
      });
      /* painted after the lanes are measured, so every pile sits under the bay
         it fell out of from the very first frame */
      const inCup = red.cupBy.reduce((a, b) => a + b, 0);
      drawCup(red.cupBy, red.mine && (burning || inCup > 0 || red.still));

      if (!burning && !red.still) return;
      rctx.save();
      clipAwayText(rctx, ws.w, ws.h, rdmBoxes);
      rctx.setLineDash([1.5, 5]);
      rctx.lineWidth = 1;
      rctx.globalAlpha = red.mine ? 0.62 : 0.42;
      red.holds.forEach((h, i) => {
        const p = rdmPaths[i];
        if (!p) return;
        rctx.strokeStyle = liftOf(h.hue, 0.3);
        strokePath(rctx, p);
      });
      rctx.setLineDash([]);
      rctx.globalAlpha = 1;

      const d = ws.w < 560 ? 10 : 13;
      if (red.still) {
        /* frozen: the share already in flight on all four tracks, so the
           journey reads with nothing moving */
        red.holds.forEach((h, i) => {
          const p = rdmPaths[i];
          if (!p) return;
          for (let n = 0; n < 3; n++) {
            const xy = pathPoint(p, 0.36 + n * 0.19);
            drawSphere(rctx, liftOf(h.hue, 0.5), xy[0], xy[1], d, dpr, true);
          }
        });
        rctx.restore();
        return;
      }

      red.parts.forEach((pt) => {
        const pr = (red.pt - pt.d) / TRAVEL;
        if (pr <= 0 || pr >= 1) return;
        const p = rdmPaths[pt.i];
        const h = red.holds[pt.i];
        if (!p || !h) return;
        const xy = pathPoint(p, pr);
        /* what is leaving is the BRIGHTEST ink in the panel */
        drawSphere(rctx, liftOf(h.hue, 0.5), xy[0], xy[1], d, dpr, true);
      });
      rctx.restore();
    }
    /* re-derive every dynamic slot once at wiring time (StrictMode-safe) */
    redPaint();

    const unregisterRedeem = registerSim({
      name: 'redeem',
      el: rdmPanel,
      step: redStep,
      paint: redPaint,
      reset: () => {
        /* cancel any half-shown burn without applying it, and re-arm the
           programme so a returning reader gets the 10% burn first */
        red.still = false;
        red.phase = 'idle';
        red.parts = [];
        red.cupBy = red.holds.map(() => 0);
        red.holds.forEach((h) => h.el.classList.remove('is-paying'));
        rdmVault.classList.remove('is-paying');
        rdmDest.classList.remove('is-receiving');
        burnIdx = 0;
        red.next = red.t + 1.4;
        redPaint();
      },
      static: () => {
        /* a meaningful still: the headline burn is in flight — 10% of supply
           gone, four tracks converging out of four bays, the share on its way
           and the receipt naming the same proportion of every holding */
        red.still = true;
        begin('@you', 0.1);
        finalize();
        /* the same share out of every bay, part of it already in the cup and
           part of it still on the four lanes below the board */
        red.cupBy = red.cupBy.map((n) => Math.round(n * 0.55));
        red.mine = true;
        redPaint();
        redPaint(); /* a second pass: the lanes are measured on the first */
      },
    });

    return () => {
      unregisterAcquire();
      unregisterRedeem();
      flashTimers.forEach((timer) => clearTimeout(timer));
      flashTimers.clear();
      [el.trader, el.fund, el.sig].forEach((n) => n.classList.remove('evt-blue', 'evt-pink', 'evt-white'));
      [el.dTrader, el.dFund, el.dSig].forEach((n) => n.classList.remove('is-fading'));
      el.meet.classList.remove('is-met');
      holds.forEach((h) => h.el.classList.remove('is-paying'));
      rdmVault.classList.remove('is-paying');
      rdmDest.classList.remove('is-receiving', 'is-mine');
      sphereCache.clear();
      fieldCache.clear();
      mixCache.clear();
    };
  }, []);

  return (
    <section id="sec-fund" className="section section--rule" aria-labelledby="sec-fund-h">
      <div className="container">
        <header className="sec-head sec-head--indexed reveal">
          <div className="sec-head__index">
            <span className="sec-head__num" aria-hidden="true">
              04
            </span>
            <p className="eyebrow">The fund</p>
          </div>
          <div className="sec-head__body">
            <h2 className="h1" id="sec-fund-h">
              A vault with no manager, and one way out
            </h2>
            <p className="lede">
              Everything the Strategies buy lands in the Fund and stays there. No one can pause it, upgrade it, or reach
              in — the only way assets leave is a holder burning GBX for their share.
            </p>
          </div>
        </header>

        <div className="stats fund-stats reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
          <div className="stat">
            <div className="stat__value">0</div>
            <div className="stat__label">roles, upgrade paths, or rescues</div>
          </div>
          <div className="stat">
            <div className="stat__value">0</div>
            <div className="stat__label">oracles, anywhere in the protocol</div>
          </div>
          <div className="stat">
            <div className="stat__value">≥ 80%</div>
            <div className="stat__label">of every purchase to the treasury, in code</div>
          </div>
          <div className="stat">
            <div className="stat__value">1</div>
            <div className="stat__label">way out: burn GBX, take your share</div>
          </div>
        </div>

        {/* ---------------------------------------------- how assets arrive -- */}
        <div className="fund-block reveal">
          <h3 className="h2">How assets arrive</h3>
          <p className="fund-block__intro">
            Each Strategy pools the USDG the stream has sent it and sells the whole lot in one falling-price auction —
            asking to be paid in the asset itself, never in dollars. The lot keeps growing while the ask falls; a trader
            fills the moment the ask drops to what the lot is worth. That is the entire price discovery. The asset
            splits as it lands: at least 80% to the treasury, and the signalers’ share — 10% by default, never more than
            20% — to the holders who aimed it.
          </p>

          <div className="sim-panel" id="acqPanel">
            <div className="sim-panel__head">
              <span className="sim-panel__title">Acquisition — live model</span>
              <span className="chip chip--warn">Illustrative parameters</span>
            </div>
            <div className="sim-panel__body">
              <div className="acq" id="acqWrap">
                <canvas className="acq__wire" id="acqWire" aria-hidden="true" />
                <div className="acq__grid">
                  <div className="acq__lot" id="acqAuction">
                    <div className="acq__label">The auction — one Strategy’s lot</div>
                    <div className="acq__read">
                      <div>
                        <div className="v num blue" id="acqLot">
                          $486
                        </div>
                        <div className="l">USDG in the lot — still growing</div>
                      </div>
                      <div>
                        <div className="v num pink" id="acqAsk">
                          2.02 QQQ
                        </div>
                        <div className="l">the ask — falling in a straight line</div>
                      </div>
                    </div>
                    <div className="acq__stage">
                      <canvas
                        id="acqStage"
                        role="img"
                        aria-label="A vessel filling with the USDG lot while the asking price rides a rail down onto it. Both are measured in QQQ against one scale on the left: the lot's surface rises as more USDG arrives, the ask falls in a straight line toward zero, and the auction settles at the instant they meet."
                      />
                    </div>
                    <div className="acq__caps">
                      <span>
                        worth{' '}
                        <b className="num blue" id="acqWorthCap">
                          1.00
                        </b>{' '}
                        QQQ, rising
                      </span>
                      <span id="acqMeet">settles when they meet</span>
                      <span>
                        asking{' '}
                        <b className="num pink" id="acqAskCap">
                          2.02
                        </b>{' '}
                        QQQ, falling
                      </span>
                    </div>
                  </div>
                  <div className="acq__side">
                    <div className="acq__party" id="acqTrader">
                      <div className="acq__label">A trader</div>
                      <p>
                        Watches the ask fall, and fills the moment it is cheap enough: pays the QQQ, takes the whole
                        USDG lot.
                      </p>
                      <div className="acq__delta num" id="acqTraderDelta" />
                    </div>
                    <div className="acq__dests">
                      <div className="acq__party acq__party--dest" id="acqFund">
                        <div className="acq__label">The treasury</div>
                        <div className="acq__vessel">
                          <canvas id="acqFundWell" aria-hidden="true" />
                        </div>
                        <div className="acq__total num" id="acqFundT">
                          0.00 QQQ
                        </div>
                        <p className="note">≥ 80% in code · 90% by default</p>
                        <div className="acq__delta num" id="acqFundDelta" />
                      </div>
                      <div className="acq__party acq__party--dest acq__party--sig" id="acqSig">
                        <div className="acq__label acq__label--pink">The signalers</div>
                        <div className="acq__vessel">
                          <canvas id="acqSigWell" aria-hidden="true" />
                        </div>
                        <div className="acq__total num" id="acqSigT">
                          0.00 QQQ
                        </div>
                        <p className="note">≤ 20% in code · 10% by default</p>
                        <div className="acq__delta acq__delta--pink num" id="acqSigDelta" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="sim-panel__foot">
              <div className="sim-panel__controls">
                <span className="sim-clock" id="acqState">
                  lot $486 · asking 2.02 QQQ
                </span>
              </div>
              <p className="sim-note">
                A six-hour auction, sped up ~450×. Production auction parameters are unselected; every figure is
                illustrative. Both stacks are measured in QQQ — no dollar price for the asset exists anywhere in the
                protocol.
              </p>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------- how assets leave -- */}
        <div className="fund-block reveal">
          <h3 className="h2">How assets leave</h3>
          <p className="fund-block__intro">
            Burn any amount of GBX at any time and receive that same proportion of <strong>every</strong> holding — in
            the tokens themselves, in one transaction. Nobody approves it and nothing is priced.
          </p>

          <div className="sim-panel" id="rdmPanel">
            <div className="sim-panel__head">
              <span className="sim-panel__title sim-panel__title--gbx">Redemption — live model</span>
              <span className="chip chip--warn">Illustrative parameters</span>
            </div>
            <div className="sim-panel__body">
              <div className="rdm" id="rdmWrap">
                <canvas className="rdm__wire" id="rdmWire" aria-hidden="true" />
                <p className="rdm__supply">
                  <span className="num" id="rdmSupply">
                    100,000,000
                  </span>{' '}
                  GBX in existence
                </p>
                <div className="meter meter--thick rdm__supplybar" aria-hidden="true">
                  <i id="rdmSupplyFill" style={{ width: '100%' }} />
                  <span className="m-slice" id="rdmSupplySlice" />
                </div>
                <div className="board rdm__vault" id="rdmVault">
                  {ASSETS.map((h) => (
                    <div className="cell hold" key={h.sym}>
                      <div className="hold__sym">{h.sym}</div>
                      <div className="hold__amt num">{h.init}</div>
                      <div className="hold__out num" />
                      <canvas className="hold__well" aria-hidden="true" />
                    </div>
                  ))}
                </div>
                <div className="rdm__cupwrap">
                  <canvas className="rdm__cup" id="rdmCup" aria-hidden="true" />
                </div>
                <div className="rdm__dest" id="rdmDest">
                  <span className="acq__label">Leaves the fund →</span>
                  <span className="rdm__dest-who num" id="rdmWho">
                    the redeemer
                  </span>
                  <span className="rdm__dest-take num" id="rdmTake">
                    → 0.0000 NVDA · 0.0000 QQQ · 0.0000 WBTC · 0.0000 AAPL
                  </span>
                </div>
                <p className="rdm__out" id="rdmOut">
                  Waiting for the next burn — every one takes the same share of every holding.
                </p>
              </div>
            </div>
            <div className="sim-panel__foot">
              <div className="sim-panel__controls">
                <span className="note rdm__legend">
                  Burns arrive on their own. Other holders take small slices; every other one is yours, at 10% of
                  everything in existence — read the receipt as it lands.
                </span>
              </div>
              <p className="sim-note">
                Illustrative holdings; production parameters are unselected. Between burns the vault refills because the
                Strategies keep buying, and the supply climbs back because the Mine keeps issuing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
