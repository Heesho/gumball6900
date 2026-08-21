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

interface AssetModel {
  sym: string;
  stake: number;
  pot: number /* USDG waiting at the Strategy */;
  disp: number /* displayed stake — lerps toward stake so lanes reshape */;
  delta: number /* last move, ±GBX */;
  moved: number /* 1 → 0 decay while a move is fresh */;
  flash: number /* 1 → 0 decay after the auction takes the lot */;
  lastLot: number;
  epochEnd: number /* each auction flushes on its own clock */;
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
}

export function Resonance() {
  useLayoutEffect(() => {
    /* Lifted from the deck's flow sim (docs/deck/gumball6900-deck.html, lines 1365–1589) and
       adapted: the flow ends at each Strategy holding USDG — the purchase is the next section.
       Sim time ×900 like the deck; particles advance in real time so the flow reads at a
       human pace whatever the sim clock does. */
    const el = document.getElementById('sec-resonance');
    const canvasNode = document.getElementById('rzCanvas');
    const clockEl = document.getElementById('rzClock');
    if (!el || !(canvasNode instanceof HTMLCanvasElement) || !clockEl) return;
    const canvas = canvasNode;
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;
    if (!ctx || !wrap) return;

    const css = getComputedStyle(document.documentElement);
    const C = {
      pink: css.getPropertyValue('--pink').trim() || '#F92B92',
      blue: css.getPropertyValue('--blue').trim() || '#29B6F0',
      raised: css.getPropertyValue('--bg-raised').trim() || '#1C1C24',
      rule: css.getPropertyValue('--rule').trim() || '#2A2A36',
      ruleStrong: css.getPropertyValue('--rule-strong').trim() || '#3C3C4C',
      hi: css.getPropertyValue('--text-hi').trim() || '#FFFFFF',
      muted: css.getPropertyValue('--text-muted').trim() || '#ADADC0',
      faint: css.getPropertyValue('--text-faint').trim() || '#8A8AA0',
    };
    const MONO = fontFamily('--font-mono', '"JetBrains Mono", monospace');
    const SANS = fontFamily('--font-sans', '"Schibsted Grotesk", sans-serif');

    const STREAM = 7 * 86400; /* Resonance.DURATION — seven days, fixed in code */
    const TIME_SCALE = 900;

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
        disp: strat.stake,
        delta: 0,
        moved: 0,
        flash: 0,
        lastLot: 0,
        epochEnd: 6000 + i * 4200,
        row,
        pctEl,
        deltaEl,
        barEl,
        subEl,
      });
    }

    const flow = {
      t: 0,
      pending: 46000,
      rate: 0,
      finish: 0,
      nextShift: 3600,
      parts: [] as Particle[],
      spawnAcc: 0,
      refill: 0 /* 1 → 0 beat while a weekly refill is fresh, and its size */,
      refillAmt: 0,
    };

    /* ------------------------------------------------- the scripted signal beat
       Nobody operates this. The sim runs a three-phase cycle on its own clock —
       sim time, so a section that has never been on screen has not burned its
       cycle: a quiet HOLD so the reader is looking at a still board, the MOVE
       itself (a 2,000 GBX lot out of the largest other Strategy, deltas and a
       pink lane rim), then SETTLE while the split follows and the emphasis
       decays. Only after that does the ambient drift resume, so a scripted
       move is never buried under a random one. */
    const PHASE = { hold: 1980, settle: 3240, drift: 4050 }; /* sim s ≈ 2.2/3.6/4.5 real s */
    const cycle = { stage: 'hold' as 'hold' | 'settle' | 'drift', left: PHASE.hold, target: 0 };

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

    /* ------------------------------------------------------------ weight rows */
    function flashRow(a: AssetModel) {
      a.row.classList.remove('evt-pink');
      void a.row.offsetWidth; /* restart the one-shot animation */
      a.row.classList.add('evt-pink');
      clearTimeout(a.rowTimer);
      a.rowTimer = setTimeout(() => {
        a.row.classList.remove('evt-pink');
      }, 1100);
    }

    function applyMove(from: AssetModel, to: AssetModel, lot: number) {
      from.stake -= lot;
      to.stake += lot;
      from.delta = -lot;
      to.delta = lot;
      from.moved = 1;
      to.moved = 1;
      flashRow(from);
      flashRow(to);
    }

    /* A holder moves one 2,000 GBX lot into `i`, out of the largest Strategy
       that can spare it — the deliberate move the reader is meant to catch. */
    function signalTo(i: number): boolean {
      const to = ASSETS[i];
      if (!to) return false;
      const lot = 2000;
      let from: AssetModel | null = null;
      ASSETS.forEach((a) => {
        if (a !== to && a.stake - lot > 800 && (!from || a.stake > from.stake)) from = a;
      });
      if (!from) return false;
      const src: AssetModel = from;
      applyMove(src, to, lot);
      return true;
    }

    /* Advance the demonstration cycle. Returns true while the ambient
       signalers are allowed to move stake as well. */
    function runCycle(dt: number): boolean {
      cycle.left -= dt;
      if (cycle.left > 0) return cycle.stage === 'drift';
      if (cycle.stage === 'hold') {
        /* try each Strategy in turn until one of them can actually take a lot */
        let fired = false;
        for (let k = 0; k < ASSETS.length && !fired; k++) {
          fired = signalTo(cycle.target);
          cycle.target = (cycle.target + 1) % ASSETS.length;
        }
        cycle.stage = 'settle';
        cycle.left = PHASE.settle;
      } else if (cycle.stage === 'settle') {
        cycle.stage = 'drift';
        cycle.left = PHASE.drift;
        flow.nextShift = flow.t + 900; /* the ambient mover gets a fresh clock */
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

      /* Signalers move stake in discrete whole lots, not a continuous trickle. */
      if (drifting && flow.t >= flow.nextShift) {
        const LOTS = [1000, 1500, 2000, 3000];
        const lot = LOTS[Math.floor(Math.random() * LOTS.length)]!;
        const from = ASSETS[Math.floor(Math.random() * ASSETS.length)]!;
        const to = ASSETS[Math.floor(Math.random() * ASSETS.length)]!;
        if (from !== to && from.stake - lot > 800) applyMove(from, to, lot);
        flow.nextShift = flow.t + 3200 + Math.random() * 5200;
      }
      ASSETS.forEach((a) => {
        if (a.moved > 0) {
          a.moved = Math.max(0, a.moved - dt / 2600);
          if (a.moved === 0) a.delta = 0;
        }
        if (a.flash > 0) a.flash = Math.max(0, a.flash - dt / 1500);
        /* Lanes reshape toward the new weights within ~a second of a move. */
        a.disp += (a.stake - a.disp) * Math.min(1, realDt * 6);
      });

      /* Mining revenue restarts the seven-day stream once the last one ends. */
      if (flow.pending > 0 && flow.t >= flow.finish) {
        flow.rate = flow.pending / STREAM;
        flow.finish = flow.t + STREAM;
        flow.refillAmt = flow.pending; /* the refill beat — drawn at the Resonance box */
        flow.refill = 1;
        flow.pending = 0;
      }
      /* Mining revenue keeps accruing for next week's stream (in the deck the mine sim
         feeds this directly; here it accrues at the illustrative weekly rate). */
      flow.pending += (46000 * dt) / STREAM;
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
      });

      /* Particles: blue USDG, lane picked by live weight — the re-split is instant. */
      if (flow.t < flow.finish && flow.parts.length < 110) {
        flow.spawnAcc += realDt * 26;
        while (flow.spawnAcc >= 1) {
          flow.spawnAcc -= 1;
          const r = Math.random() * total;
          let acc = 0,
            pick = 0;
          for (let i = 0; i < ASSETS.length; i++) {
            acc += ASSETS[i]!.stake;
            if (r <= acc) {
              pick = i;
              break;
            }
          }
          flow.parts.push({ p: 0, lane: pick });
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
      if (w <= 0) return;
      const h = w < 480 ? 340 : 420;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      if (w === view.w && h === view.h && dpr === view.dpr) return;
      view.w = w;
      view.h = h;
      view.dpr = dpr;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.height = h + 'px';
    }

    let lastClock = '';
    function paintFrame() {
      if (!view.w) resize();
      if (!view.w) return;
      const W = view.w,
        H = view.h,
        m = W < 480;
      ctx!.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);

      const srcW = m ? 86 : 172,
        srcH = m ? 92 : 108;
      const stratW = m ? 126 : 226,
        stratH = m ? 66 : 84;
      const srcX = 1.5,
        srcR = srcX + srcW;
      const stratX = W - stratW - 1.5;
      const laneH = (H - 8) / ASSETS.length;
      const laneY = (i: number) => 4 + laneH * i + laneH / 2;
      const srcY = H / 2;
      const totalD = totalDisp();
      const streaming = flow.t < flow.finish;

      /* lanes — width IS the live weight; a fresh signal move rims its lane pink */
      ASSETS.forEach((a, i) => {
        const y = laneY(i);
        const share = a.disp / totalD;
        const lane = () => {
          ctx!.beginPath();
          ctx!.moveTo(srcR, srcY);
          ctx!.bezierCurveTo((srcR + stratX) / 2, srcY, (srcR + stratX) / 2, y, stratX, y);
          ctx!.stroke();
        };
        const wdt = Math.max(2, share * (m ? 34 : 52));
        if (a.moved > 0) {
          ctx!.globalAlpha = Math.min(0.85, a.moved * 1.2);
          ctx!.strokeStyle = C.pink;
          ctx!.lineWidth = wdt + 3;
          lane();
          ctx!.globalAlpha = 1;
        }
        ctx!.strokeStyle = a.moved > 0 ? C.ruleStrong : C.rule;
        ctx!.lineWidth = wdt;
        lane();
      });

      /* Resonance — the source of the stream; rims blue for a beat when mining
         revenue refills it (flow.refill is set only by an actual model refill). */
      ctx!.fillStyle = C.raised;
      ctx!.strokeStyle =
        flow.refill > 0 ? 'rgba(41,182,240,' + (0.45 + 0.55 * flow.refill).toFixed(3) + ')' /* --blue */ : C.ruleStrong;
      ctx!.lineWidth = flow.refill > 0 ? 2 : 1.5;
      ctx!.beginPath();
      ctx!.roundRect(srcX, srcY - srcH / 2, srcW, srcH, 9);
      ctx!.fill();
      ctx!.stroke();
      ctx!.textAlign = 'center';
      const scx = srcX + srcW / 2;
      if (flow.refill > 0) {
        /* the inflow, named: this week's mining revenue arriving at the stream */
        ctx!.globalAlpha = Math.min(1, flow.refill * 1.4);
        ctx!.fillStyle = C.blue;
        ctx!.font = '600 ' + (m ? 10 : 11.5) + 'px ' + MONO;
        if (m) ctx!.textAlign = 'left'; /* centred it would clip the canvas edge */
        ctx!.fillText('+' + money(flow.refillAmt) + ' from mining', m ? srcX + 1 : scx, srcY - srcH / 2 - (m ? 8 : 10));
        if (m) ctx!.textAlign = 'center';
        ctx!.globalAlpha = 1;
      }
      const left = money(streaming ? flow.rate * Math.max(0, flow.finish - flow.t) : 0);
      if (m) {
        ctx!.fillStyle = C.hi;
        ctx!.font = '700 12.5px ' + SANS;
        ctx!.fillText('Resonance', scx, srcY - 22);
        ctx!.fillStyle = C.faint;
        ctx!.font = '400 10px ' + SANS;
        ctx!.fillText('7-day stream', scx, srcY - 5);
        ctx!.fillStyle = C.blue;
        ctx!.font = '600 11.5px ' + MONO;
        ctx!.fillText(left, scx, srcY + 15);
        ctx!.fillStyle = C.faint;
        ctx!.font = '400 9.5px ' + SANS;
        ctx!.fillText('left this week', scx, srcY + 31);
      } else {
        ctx!.fillStyle = C.hi;
        ctx!.font = '700 15px ' + SANS;
        ctx!.fillText('Resonance', scx, srcY - 26);
        ctx!.fillStyle = C.faint;
        ctx!.font = '400 11.5px ' + SANS;
        ctx!.fillText('7-day stream', scx, srcY - 7);
        ctx!.fillStyle = C.blue;
        ctx!.font = '600 15px ' + MONO;
        ctx!.fillText(left, scx, srcY + 18);
        ctx!.fillStyle = C.faint;
        ctx!.font = '400 10.5px ' + SANS;
        ctx!.fillText('left this week', scx, srcY + 36);
      }

      /* strategies — each one holds USDG for its own auction */
      ASSETS.forEach((a, i) => {
        const y = laneY(i);
        const top = y - stratH / 2;
        ctx!.fillStyle = C.raised;
        ctx!.strokeStyle = a.flash > 0 ? 'rgba(255,255,255,' + (0.28 + 0.5 * a.flash).toFixed(3) + ')' : C.ruleStrong;
        ctx!.lineWidth = a.flash > 0 ? 2 : 1.5;
        ctx!.beginPath();
        ctx!.roundRect(stratX, top, stratW, stratH, 8);
        ctx!.fill();
        ctx!.stroke();
        ctx!.textAlign = 'left';
        const pad = m ? 12 : 16;
        ctx!.fillStyle = C.hi;
        ctx!.font = '600 ' + (m ? 11 : 12.5) + 'px ' + MONO;
        ctx!.fillText(a.sym, stratX + pad, top + (m ? 20 : 24));
        ctx!.fillStyle = C.blue;
        ctx!.font = '600 ' + (m ? 14 : 17) + 'px ' + MONO;
        ctx!.fillText(money(a.pot), stratX + pad, top + (m ? 44 : 48));
        if (!m) {
          if (a.flash > 0) {
            /* the flush beat — the departing lot named in blue while it is fresh */
            ctx!.globalAlpha = Math.min(1, a.flash * 1.4);
            ctx!.fillStyle = C.blue;
            ctx!.font = '600 10.5px ' + SANS;
            ctx!.fillText(money(a.lastLot) + ' → its auction', stratX + pad, top + 68);
            ctx!.globalAlpha = 1;
          } else {
            ctx!.fillStyle = C.faint;
            ctx!.font = '400 10.5px ' + SANS;
            ctx!.fillText('USDG for its auction', stratX + pad, top + 68);
          }
        }
        if (a.flash > 0) {
          /* the USDG itself leaving the card, downward — its auction is the next section */
          const q = 1 - a.flash;
          ctx!.globalAlpha = a.flash * 0.9;
          ctx!.fillStyle = C.blue;
          ctx!.beginPath();
          ctx!.arc(stratX + stratW - pad, top + stratH - 6 + q * (m ? 14 : 18), m ? 3 : 4, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalAlpha = 1;
        }
        /* the signal move, named in pink, right where the flow changes */
        if (a.moved > 0 && a.delta) {
          ctx!.globalAlpha = Math.min(1, a.moved * 1.6);
          ctx!.textAlign = 'right';
          ctx!.fillStyle = C.pink;
          ctx!.font = '600 ' + (m ? 10 : 11.5) + 'px ' + MONO;
          ctx!.fillText(
            (a.delta > 0 ? '+' : '−') + Math.abs(a.delta).toLocaleString('en-US') + ' GBX',
            stratX + stratW - pad,
            top + (m ? 20 : 24),
          );
          ctx!.globalAlpha = 1;
          ctx!.textAlign = 'left';
        }
      });

      /* the USDG itself, in motion */
      const r = m ? 3 : 4;
      ctx!.fillStyle = C.blue;
      ctx!.globalAlpha = 0.9;
      flow.parts.forEach((pt) => {
        const y = laneY(pt.lane),
          t = pt.p,
          mt = 1 - t,
          cx = (srcR + stratX) / 2;
        const x = mt * mt * mt * srcR + 3 * mt * mt * t * cx + 3 * mt * t * t * cx + t * t * t * stratX;
        const yy = mt * mt * mt * srcY + 3 * mt * mt * t * srcY + 3 * mt * t * t * y + t * t * t * y;
        ctx!.beginPath();
        ctx!.arc(x, yy, r, 0, Math.PI * 2);
        ctx!.fill();
      });
      ctx!.globalAlpha = 1;

      /* clock */
      const week = Math.max(1, Math.ceil(flow.t / STREAM));
      const day = streaming ? Math.min(7, Math.floor((flow.t - (flow.finish - STREAM)) / 86400) + 1) : 7;
      const clock = 'week ' + week + ' · day ' + day;
      if (clock !== lastClock) {
        clockEl!.textContent = clock;
        lastClock = clock;
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
        const d = a.moved > 0 && a.delta ? (a.delta > 0 ? '+' : '−') + Math.abs(a.delta).toLocaleString('en-US') : '';
        if (d !== a.lastDelta) {
          a.deltaEl.textContent = d;
          a.lastDelta = d;
        }
        a.deltaEl.style.opacity = a.moved > 0 ? Math.min(1, a.moved * 1.6).toFixed(2) : '0';
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
        resize();
        if (view.w !== w) paintFrame();
      });
      ro.observe(wrap);
    }

    /* Re-arm the demonstration: a calm board, then the first scripted move
       about two seconds after the reader actually gets here. */
    function armCycle() {
      cycle.stage = 'hold';
      cycle.left = PHASE.hold;
      ASSETS.forEach((a) => {
        a.moved = 0;
        a.delta = 0;
        a.disp = a.stake;
      });
      ASSETS.forEach((a) => {
        clearTimeout(a.rowTimer);
        a.row.classList.remove('evt-pink');
      });
    }

    /* Seed so the first visible frame is already mid-flow. No stake moves while
       seeding — the weights must still match the server-rendered rows exactly,
       and the first move the reader is owed should happen in front of them. */
    cycle.left = Infinity;
    step(1); /* starts the stream from the pending seed */
    step(3600); /* an hour in: pots visibly filling */
    armCycle();
    updateRows(); /* rows carry real text pre-paint — no shift on first paint */

    const unregister = registerSim({
      name: 'resonance',
      el,
      timeScale: TIME_SCALE,
      step,
      paint,
      reset: () => {
        flow.parts.length = 0;
        flow.spawnAcc = 0;
        flow.refill = 0;
        ASSETS.forEach((a) => {
          a.flash = 0;
        });
        armCycle(); /* the returning reader gets the whole beat again */
      },
      static: () => {
        /* A meaningful mid-stream still: day 3 of the week, pots part-filled,
           one signal move fresh enough that its delta and re-split are visible. */
        flow.t = 2.4 * 86400;
        flow.finish = flow.t + STREAM - 2.4 * 86400;
        flow.rate = 46000 / STREAM;
        flow.refill = 0; /* still frame — no event beats */
        let total = totalStake();
        ASSETS.forEach((a, i) => {
          a.pot = flow.rate * (a.stake / total) * (5200 + i * 2400);
          a.disp = a.stake;
          a.moved = 0;
          a.delta = 0;
          a.flash = 0;
        });
        applyMove(ASSETS[1]!, ASSETS[0]!, 2000); /* QQQ → NVDA, fresh */
        ASSETS[0]!.moved = 0.8;
        ASSETS[1]!.moved = 0.8;
        ASSETS.forEach((a) => {
          a.disp = a.stake;
        });
        flow.parts.length = 0;
        total = totalStake();
        for (let k = 0; k < 26; k++) {
          const r = ((k * 0.618) % 1) * total;
          let acc = 0,
            pick = 0;
          for (let i = 0; i < ASSETS.length; i++) {
            acc += ASSETS[i]!.stake;
            if (r <= acc) {
              pick = i;
              break;
            }
          }
          flow.parts.push({ p: (k * 0.137) % 0.97, lane: pick });
        }
        paint();
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
        a.row.classList.remove('evt-pink');
      });
    };
  }, []);

  return (
    <section id="sec-resonance" className="section section--rule" aria-labelledby="sec-resonance-h">
      <div className="container">
        <header className="sec-head reveal">
          <p className="eyebrow eyebrow--pink">Resonance</p>
          <h2 className="h1" id="sec-resonance-h">
            Where the signal sits is where the money goes
          </h2>
          <p className="lede">
            Deposit GBX and point it at a Strategy — that is the whole vote. The fund&#39;s buying power follows the
            signal moment to moment: no proposals, no ballots, no waiting for anyone.
          </p>
        </header>

        <p className="small muted measure rz-how reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
          Underneath, mining revenue is released as a rolling seven-day stream, and the stream is split across
          Strategies by live signal weights — the instant a holder moves signal, the split moves with it. Each Strategy
          collects its share as USDG; turning that USDG into the asset is the next section.
        </p>

        <div className="sim-panel reveal" style={{ '--d': '180ms' } as React.CSSProperties}>
          <div className="sim-panel__head">
            <span className="sim-panel__title">Resonance — live model</span>
            <span className="chip chip--warn">Illustrative parameters</span>
          </div>
          <div className="sim-panel__body">
            <div className="rz-grid">
              <div className="rz-weights">
                <p className="rz-cap">
                  Signal — <span className="num">31,500</span> GBX pointed
                </p>
                <div className="rz-rows" id="rzRows">
                  {STRATEGIES.map((s) => (
                    <div className="rz-row" key={s.sym}>
                      <div className="rz-row__top">
                        <span className="rz-row__sym num">{s.sym}</span>
                        <span className="rz-row__pct num">{s.pct}</span>
                        <span className="rz-row__delta num" aria-hidden="true" />
                      </div>
                      <div className="meter meter--pink meter--thick">
                        <i style={{ width: s.bar }} />
                      </div>
                      <div className="rz-row__sub num">{s.sub}</div>
                    </div>
                  ))}
                </div>
                <p className="note rz-hint">
                  Every few seconds a holder moves a 2,000 GBX lot out of the largest Strategy and into another. The
                  deltas mark where it went; the stream re-splits before the lanes have finished settling.
                </p>
              </div>
              <div className="rz-canvas-wrap">
                <p className="rz-cap">The stream — USDG, split by signal</p>
                <canvas
                  id="rzCanvas"
                  aria-label="USDG flowing from the Resonance seven-day stream to four strategies, each lane's thickness proportional to its live signal weight"
                />
              </div>
            </div>
          </div>
          <div className="sim-panel__foot">
            <div className="sim-panel__controls">
              <span className="sim-clock" id="rzClock">
                week 1 · day 1
              </span>
            </div>
            <p className="sim-note">
              Weights, amounts and symbols are illustrative — the tickers are example strategies, not holdings. The
              seven-day stream is fixed in code; production revenue is unselected.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
