'use client';

import { useLayoutEffect } from 'react';
import { registerSim } from '../../lib/harness';
import './fund.css';

/* Initial vault holdings — must match the model's `holds` in the effect so the
   server-rendered cells carry the exact values the first paint would show. */
const HOLD_DEFS = [
  { sym: 'NVDA', amt: '1200.0' },
  { sym: 'QQQ', amt: '400.0' },
  { sym: 'WBTC', amt: '2.4000' },
  { sym: 'AAPL', amt: '860.0' },
];

export function Fund() {
  useLayoutEffect(() => {
    const $ = (id: string) => document.getElementById(id);
    const css = getComputedStyle(document.documentElement);
    const C = {
      rule: css.getPropertyValue('--rule').trim() || '#2A2A36',
      ruleStrong: css.getPropertyValue('--rule-strong').trim() || '#3C3C4C',
      blue: css.getPropertyValue('--blue').trim() || '#29B6F0',
      pink: css.getPropertyValue('--pink').trim() || '#F92B92',
      hi: css.getPropertyValue('--text-hi').trim() || '#FFFFFF',
    };

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
    const wireN = $('acqWire');
    const stacksN = $('acqStacks');
    const rdmWireN = $('rdmWire');
    if (
      !(wireN instanceof HTMLCanvasElement) ||
      !(stacksN instanceof HTMLCanvasElement) ||
      !(rdmWireN instanceof HTMLCanvasElement)
    )
      return;
    const wire: HTMLCanvasElement = wireN;
    const stacks: HTMLCanvasElement = stacksN;
    const rdmWireEl: HTMLCanvasElement = rdmWireN;
    const wctxN = wire.getContext('2d');
    const sctxN = stacks.getContext('2d');
    const rctxN = rdmWireEl.getContext('2d');
    if (!wctxN || !sctxN || !rctxN) return;
    const wctx: CanvasRenderingContext2D = wctxN;
    const sctx: CanvasRenderingContext2D = sctxN;
    const rctx: CanvasRenderingContext2D = rctxN;

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

    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* ---- shared helpers -------------------------------------------------- */
    function money(x: number) {
      return '$' + Math.round(x).toLocaleString('en-US');
    }
    function fit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: canvas.clientWidth, h: canvas.clientHeight };
    }
    /* quadratic arc so a coin lifts over the layout instead of cutting through */
    function arcAt(t: number, x0: number, y0: number, x1: number, y1: number, lift: number): [number, number] {
      const mt = 1 - t,
        cx = (x0 + x1) / 2,
        cy = Math.min(y0, y1) - lift;
      return [mt * mt * x0 + 2 * mt * t * cx + t * t * x1, mt * mt * y0 + 2 * mt * t * cy + t * t * y1];
    }
    function anchors(fromEl: HTMLElement, toEl: HTMLElement, base: DOMRect): [number, number, number, number] {
      const a = fromEl.getBoundingClientRect(),
        b = toEl.getBoundingClientRect();
      let ax: number, ay: number, bx: number, by: number;
      if (b.top >= a.bottom - 8) {
        /* stacked: leave from the bottom, land on the top */
        ax = a.left - base.left + a.width / 2;
        ay = a.bottom - base.top - 6;
        bx = b.left - base.left + b.width / 2;
        by = b.top - base.top + 6;
      } else if (b.left >= a.right - 8) {
        ax = a.right - base.left - 6;
        ay = a.top - base.top + a.height / 2;
        bx = b.left - base.left + 6;
        by = b.top - base.top + b.height / 2;
      } else {
        ax = a.left - base.left + a.width / 2;
        ay = a.top - base.top + a.height / 2;
        bx = b.left - base.left + b.width / 2;
        by = b.top - base.top + b.height / 2;
      }
      return [ax, ay, bx, by];
    }

    /* ================================================ acquisition auction ==
       Lifted from docs/deck/gumball6900-deck.html (auc, lines 1673-1846).
       Everything is measured in QQQ units, never dollars: fair() is what the
       USDG lot is worth in QQQ, and the ask decays linearly over a six-hour
       epoch. The lot keeps growing while the auction is open; the display
       freezes at the moment of fill. */
    const QQQ = 486; /* $ per unit — illustrative */
    const EPOCH = 21600; /* six-hour epoch, inside Strategy's 1h-365d bounds */
    const BRIBE = 0.1; /* signaler share: default 10%, capped at 20% in code */
    const TS = 450; /* harness timeScale: 1 real s = 450 sim s */

    interface HistPt {
      x: number;
      ask: number;
      worth: number;
    }
    interface Coin {
      p: number;
      kind: 'usdg' | 'fund' | 'sig';
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
      fundTotal: 0,
      sigTotal: 0,
      epoch: 0,
      parts: [] as Coin[],
      lastPaid: 0,
      lastLot: 0,
      landed: false,
      hist: [] as HistPt[],
      meetX: 0,
    };
    const fair = () => auc.lot / QQQ;
    function openAuction() {
      auc.phase = 'open';
      auc.started = auc.t;
      auc.initialAsk = fair() * (1.85 + Math.random() * 0.35);
      auc.landed = false;
      /* the traces start over: the ask's straight line and the worth's climb */
      auc.hist = [{ x: 0, ask: auc.initialAsk, worth: fair() }];
      /* the last lot's transfer record stays up until the next fill */
      el.meet.textContent = 'settles when they meet';
      el.meet.classList.remove('is-met');
    }
    openAuction();

    function fill() {
      auc.phase = 'trade';
      auc.tradeT = 0;
      auc.lastPaid = auc.ask;
      auc.lastLot = auc.lot;
      /* pin the meeting point so the frozen chart shows exactly where they met */
      auc.meetX = Math.min(1, (auc.t - auc.started) / EPOCH);
      auc.hist.push({ x: auc.meetX, ask: auc.ask, worth: fair() });
      const toFund = auc.lastPaid * (1 - BRIBE),
        toSig = auc.lastPaid * BRIBE;
      auc.fundTotal += toFund;
      auc.sigTotal += toSig;
      auc.epoch++;
      auc.parts = [];
      /* USDG coins out first; the asset's return legs lag half a beat */
      for (let i = 0; i < 14; i++) auc.parts.push({ p: -i * 0.045, kind: 'usdg' });
      for (let f = 0; f < 9; f++) auc.parts.push({ p: -0.5 - f * 0.045, kind: 'fund' });
      auc.parts.push({ p: -0.5, kind: 'sig' });
      el.meet.textContent = 'they met — settled';
      el.meet.classList.add('is-met');
      /* two-tone receipt: USDG capital in blue, the acquired asset in pink */
      el.dTrader.innerHTML =
        '<span class="blue">+ ' +
        money(auc.lastLot) +
        ' USDG in</span> · <span class="pink">' +
        auc.lastPaid.toFixed(2) +
        ' QQQ out</span>';
      el.dFund.textContent = '+ ' + toFund.toFixed(2) + ' QQQ';
      el.dSig.textContent = '+ ' + toSig.toFixed(2) + ' QQQ';
      flash(el.trader, 'evt-blue');
    }

    function aucStep(dt: number) {
      /* dt is simulated seconds (x450) */
      auc.t += dt;
      const rdt = dt / TS;
      if (auc.phase === 'open') {
        auc.lot += auc.inflow * dt; /* the lot keeps growing during the auction */
        const elapsed = auc.t - auc.started;
        auc.ask = elapsed >= EPOCH ? 0 : auc.initialAsk * (1 - elapsed / EPOCH);
        const f = Math.min(1, elapsed / EPOCH);
        const lastPt = auc.hist[auc.hist.length - 1];
        if (!lastPt || f - lastPt.x >= 0.0045) {
          auc.hist.push({ x: f, ask: auc.ask, worth: fair() });
        }
        if (auc.ask <= fair()) fill();
      } else {
        auc.tradeT += rdt;
        auc.parts.forEach((pt) => {
          pt.p += rdt * 0.5;
        });
        if (!auc.landed && auc.tradeT > 1.35) {
          auc.landed = true; /* the asset's return leg arrives: light the split */
          flash(el.fund, 'evt-pink');
          flash(el.sig, 'evt-pink');
        }
        if (auc.tradeT > 3.0) {
          auc.lot = 420 + Math.random() * 180;
          openAuction();
        }
      }
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

      /* ---- the price discovery, DRAWN: x is time across the whole epoch,
         y is QQQ. The ask's straight pink diagonal falls toward the worth's
         rising blue curve; where the traces meet is where it settles. */
      const s = fit(stacks, sctx);
      sctx.clearRect(0, 0, s.w, s.h);
      const padL = 6,
        padR = 6,
        padT = 12,
        padB = 9;
      const plotW = s.w - padL - padR,
        plotH = s.h - padT - padB;
      const yMax = Math.max(auc.initialAsk, 0.001) * 1.06;
      const X = (f: number) => padL + f * plotW;
      const Y = (v: number) => padT + (1 - Math.min(v, yMax) / yMax) * plotH;
      const hist = auc.hist,
        tip = hist[hist.length - 1];
      /* zero line */
      sctx.strokeStyle = C.rule;
      sctx.lineWidth = 1;
      sctx.beginPath();
      sctx.moveTo(padL, Y(0));
      sctx.lineTo(padL + plotW, Y(0));
      sctx.stroke();
      /* the ask's committed path: a straight line to zero at epoch end */
      if (!trading && tip) {
        sctx.strokeStyle = C.pink;
        sctx.globalAlpha = 0.35;
        sctx.lineWidth = 1.5;
        sctx.setLineDash([4, 6]);
        sctx.beginPath();
        sctx.moveTo(X(tip.x), Y(tip.ask));
        sctx.lineTo(X(1), Y(0));
        sctx.stroke();
        sctx.setLineDash([]);
        sctx.globalAlpha = 1;
      }
      /* meet line: while open, the level the ask must fall to; at fill, solid */
      const meetV = trading ? auc.lastPaid : worth;
      sctx.strokeStyle = trading ? C.hi : C.ruleStrong;
      sctx.lineWidth = trading ? 2 : 1.2;
      sctx.setLineDash(trading ? [] : [5, 6]);
      sctx.beginPath();
      sctx.moveTo(padL, Y(meetV));
      sctx.lineTo(padL + plotW, Y(meetV));
      sctx.stroke();
      sctx.setLineDash([]);
      /* the two traces */
      function trace(key: 'ask' | 'worth', color: string) {
        if (hist.length < 2) return;
        sctx.strokeStyle = color;
        sctx.lineWidth = 2;
        sctx.lineJoin = 'round';
        sctx.lineCap = 'round';
        sctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const hp = hist[i];
          if (!hp) continue;
          const px = X(hp.x),
            py = Y(hp[key]);
          if (i) sctx.lineTo(px, py);
          else sctx.moveTo(px, py);
        }
        sctx.stroke();
      }
      trace('worth', C.blue);
      trace('ask', C.pink);
      /* endpoints: live dots while open; one white ring where they met */
      if (tip) {
        if (trading) {
          const mx = X(auc.meetX),
            my = Y(auc.lastPaid);
          sctx.fillStyle = C.hi;
          sctx.beginPath();
          sctx.arc(mx, my, 3, 0, Math.PI * 2);
          sctx.fill();
          sctx.strokeStyle = C.hi;
          sctx.lineWidth = 2;
          sctx.beginPath();
          sctx.arc(mx, my, 7, 0, Math.PI * 2);
          sctx.stroke();
        } else {
          sctx.fillStyle = C.blue;
          sctx.beginPath();
          sctx.arc(X(tip.x), Y(tip.worth), 3.5, 0, Math.PI * 2);
          sctx.fill();
          sctx.fillStyle = C.pink;
          sctx.beginPath();
          sctx.arc(X(tip.x), Y(tip.ask), 3.5, 0, Math.PI * 2);
          sctx.fill();
        }
      }

      /* ---- the transfer: coins over the layout while the trade happens */
      const wsz = fit(wire, wctx);
      wctx.clearRect(0, 0, wsz.w, wsz.h);
      if (trading && auc.parts.length) {
        const baseRect = acqWrap.getBoundingClientRect();
        const toTrader = anchors(el.auction, el.trader, baseRect);
        const toFundArc = anchors(el.trader, el.fund, baseRect);
        const toSigArc = anchors(el.trader, el.sig, baseRect);
        auc.parts.forEach((pt) => {
          if (pt.p < 0 || pt.p > 1) return;
          let a: [number, number, number, number], color: string;
          if (pt.kind === 'usdg') {
            a = toTrader;
            color = C.blue;
          } else if (pt.kind === 'fund') {
            a = toFundArc;
            color = C.pink;
          } else {
            a = toSigArc;
            color = C.pink;
          }
          const xy = arcAt(pt.p, a[0], a[1], a[2], a[3], 36);
          wctx.globalAlpha = 0.95;
          wctx.fillStyle = color;
          wctx.beginPath();
          wctx.arc(xy[0], xy[1], 5, 0, Math.PI * 2);
          wctx.fill();
          wctx.globalAlpha = 1;
        });
      }
    }

    function aucReset() {
      auc.lot = 420 + Math.random() * 180;
      auc.parts = [];
      el.dTrader.textContent = '';
      el.dFund.textContent = '';
      el.dSig.textContent = '';
      openAuction();
    }

    /* Paint once at wiring time so every readout carries its final shape
       before the first post-hydration frame — the JSX pre-fills carry the
       geometry; this stamps the live (randomised) opening ask over them.
       ask = initialAsk is exactly what step() computes at elapsed 0. */
    auc.ask = auc.initialAsk;
    aucPaint();

    const unregisterAcquire = registerSim({
      name: 'acquire',
      el: acqPanel,
      timeScale: TS,
      step: aucStep,
      paint: aucPaint,
      reset: aucReset,
      static: () => {
        /* a meaningful mid-auction still: one lot already settled, the next
           one open with the ask still above the worth */
        auc.epoch = 1;
        auc.fundTotal = 0.94;
        auc.sigTotal = 0.1;
        el.dTrader.innerHTML = '<span class="blue">+ $505 USDG in</span> · <span class="pink">1.04 QQQ out</span>';
        el.dFund.textContent = '+ 0.94 QQQ';
        el.dSig.textContent = '+ 0.10 QQQ';
        auc.lot = 505;
        auc.t = EPOCH * 0.35;
        auc.started = 0;
        auc.initialAsk = 2.05;
        auc.ask = auc.initialAsk * 0.65;
        auc.phase = 'open';
        /* synthesise the traces up to now so the still shows the drawn paths */
        auc.hist = [];
        const f0 = 0.35,
          steps = 48;
        for (let i = 0; i <= steps; i++) {
          const f = f0 * (i / steps);
          const lotAt = auc.lot - auc.inflow * (f0 - f) * EPOCH;
          auc.hist.push({ x: f, ask: auc.initialAsk * (1 - f), worth: lotAt / QQQ });
        }
        aucPaint();
      },
    });

    /* ====================================================== redemption ==
       Lifted from docs/deck/gumball6900-deck.html (red, lines 1848-1929).
       Nobody operates it: burns arrive on a programme of the panel's own
       accumulated time, alternating other holders' small burns with the
       reader's own 10%-of-supply burn — the headline mechanism, with the full
       receipt. The animated phase only interpolates the display; state mutates
       once, at the end — exactly like the deck. Real time. */
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
      el: HTMLElement;
      amtEl: HTMLElement;
      barEl: HTMLElement;
      sliceEl: HTMLElement;
      outEl: HTMLElement;
    }
    /* The cells are server-rendered (zero CLS) — wire them, don't rebuild. */
    const holdInit = [
      { sym: 'NVDA', amt: 1200 },
      { sym: 'QQQ', amt: 400 },
      { sym: 'WBTC', amt: 2.4 },
      { sym: 'AAPL', amt: 860 },
    ];
    const cells = Array.from(rdmVault.querySelectorAll<HTMLElement>('.hold'));
    if (cells.length !== holdInit.length) return;
    const holds: Hold[] = [];
    for (let i = 0; i < holdInit.length; i++) {
      const def = holdInit[i];
      const cell = cells[i];
      if (!def || !cell) return;
      const amtEl = cell.querySelector<HTMLElement>('.hold__amt');
      const barEl = cell.querySelector<HTMLElement>('.meter i');
      const sliceEl = cell.querySelector<HTMLElement>('.m-slice');
      const outEl = cell.querySelector<HTMLElement>('.hold__out');
      if (!amtEl || !barEl || !sliceEl || !outEl) return;
      holds.push({
        sym: def.sym,
        amt: def.amt,
        base: def.amt,
        el: cell,
        amtEl,
        barEl,
        sliceEl,
        outEl,
      });
    }

    const red = {
      t: 0,
      supply: SUPPLY0,
      next: 2.4,
      phase: 'idle' as 'idle' | 'burn',
      pt: 0,
      who: '',
      pct: 0,
      burned: 0,
      taken: [] as number[],
      parts: [] as { i: number; d: number }[],
      holds,
    };
    /* Same-shape zero-state line so the destination card wraps to its final
       height at load instead of shifting on the first burn. (The JSX carries
       the same string; re-stamping it makes a StrictMode re-run start clean.) */
    rdmTake.textContent = '→ ' + red.holds.map((h) => takenFmt(0) + ' ' + h.sym).join(' · ');

    /* indexed reads under noUncheckedIndexedAccess: taken[] always mirrors
       holds[] (built together in begin()), so a missing slot reads as 0 */
    const takenAt = (i: number) => red.taken[i] ?? 0;

    function receiptHTML() {
      return (
        '<strong>' +
        red.who +
        '</strong> received ' +
        red.holds
          .map((h, i) => {
            return '<strong>' + takenFmt(takenAt(i)) + ' ' + h.sym + '</strong>';
          })
          .join(', ') +
        ' — the same ' +
        (red.pct * 100).toFixed(2) +
        '% of every holding, in one transaction.'
      );
    }
    function takeLine(k: number) {
      return (
        '→ ' +
        red.holds
          .map((h, i) => {
            return takenFmt(takenAt(i) * k) + ' ' + h.sym;
          })
          .join(' · ')
      );
    }

    function begin(who: string, pct: number) {
      red.phase = 'burn';
      red.pt = 0;
      red.who = who;
      red.pct = pct;
      red.burned = red.supply * pct;
      red.taken = red.holds.map((h) => h.amt * pct);
      red.holds.forEach((h) => {
        h.el.classList.add('is-paying');
      });
      rdmDest.classList.add('is-receiving');
      rdmWho.textContent = who + (who === '@you' ? ' receive' : ' receives');
      /* one chip leaves EVERY holding at the same instant — the same proportion
         of all four at once is the point — then a second simultaneous wave */
      red.parts = [];
      red.holds.forEach((h, i) => {
        red.parts.push({ i, d: 0 });
        red.parts.push({ i, d: 0.28 });
      });
      rdmOut.innerHTML =
        '<strong>' +
        red.who +
        '</strong> burns <strong>' +
        Math.round(red.burned).toLocaleString('en-US') +
        ' GBX</strong> — ' +
        (red.pct * 100).toFixed(2) +
        '% of everything in existence.';
    }
    function finalize(refill: boolean) {
      red.supply -= red.burned;
      red.holds.forEach((h, i) => {
        h.amt -= takenAt(i);
        h.el.classList.remove('is-paying');
      });
      rdmDest.classList.remove('is-receiving');
      rdmTake.textContent = takeLine(1);
      red.parts = [];
      rdmOut.innerHTML = receiptHTML();
      if (refill) {
        /* no loop is running to drift the vault back (reduced motion, or the
           panel is off-screen) — apply the between-burns refill instantly */
        red.holds.forEach((h) => {
          h.amt += h.base * (0.04 + Math.random() * 0.045);
        });
        red.supply = Math.min(SUPPLY0, red.supply + red.burned * (0.8 + Math.random() * 0.4));
      }
      red.phase = 'idle';
      /* long enough to read the receipt, short enough that the next one — every
         other of which is the reader's own 10% burn — arrives while watching */
      red.next = red.t + 4.5 + Math.random() * 2;
    }

    /* The programme: the reader's own burn first, then an ambient one, and so
       on. Deterministic order, so the headline beat is guaranteed, not lucky. */
    let burnIdx = 0;
    function nextScheduledBurn() {
      const mine = burnIdx % 2 === 0;
      burnIdx++;
      if (mine) begin('@you', 0.1);
      else {
        begin(HOLDERS[Math.floor(Math.random() * HOLDERS.length)] ?? '@ava', 0.04 + Math.random() * 0.04);
      }
    }

    function redStep(rdt: number) {
      red.t += rdt;
      if (red.phase === 'idle') {
        /* between burns the panel is never still: the Strategies keep buying,
           so each holding creeps back toward its pre-burn baseline, and the
           Mine keeps issuing, so the supply ticks steadily back up. A capped
           drift, not a snap — never past the baseline. */
        const g = 1 - Math.exp(-rdt * 0.13);
        red.holds.forEach((h) => {
          h.amt = Math.min(h.base, h.amt + (h.base - h.amt) * g + h.base * 0.004 * rdt);
        });
        red.supply = Math.min(SUPPLY0, red.supply + (SUPPLY0 - red.supply) * g + 45000 * rdt);
        if (red.t >= red.next) nextScheduledBurn();
        return;
      }
      red.pt += rdt;
      if (red.pt >= 1.5) finalize(false); /* the idle drift does the refilling */
    }

    function redPaint() {
      const burning = red.phase === 'burn';
      const k = burning ? Math.min(1, red.pt / 1.1) : 0;
      red.holds.forEach((h, i) => {
        const out = burning ? takenAt(i) * k : 0;
        const shown = h.amt - out;
        const finalFrac = burning ? (h.amt - takenAt(i)) / h.base : 0;
        const shownFrac = Math.max(0, shown / h.base);
        h.amtEl.textContent = amtFmt(shown);
        h.barEl.style.width = (shownFrac * 100).toFixed(1) + '%';
        /* the departing slice: a white segment at the fill's end, consumed
           as the burn proceeds — even a small burn has a visible shape */
        if (burning) {
          h.sliceEl.style.left = (finalFrac * 100).toFixed(2) + '%';
          h.sliceEl.style.width = (Math.max(0, shownFrac - finalFrac) * 100).toFixed(2) + '%';
        } else {
          h.sliceEl.style.width = '0';
        }
        h.outEl.textContent = burning ? '→ ' + takenFmt(takenAt(i) * k) + ' out' : '';
      });
      /* GBX supply: the burned slice extinguishes off the end of the bar */
      const supShown = red.supply - (burning ? red.burned * k : 0);
      rdmSupply.textContent = Math.round(supShown).toLocaleString('en-US');
      rdmSupplyFill.style.width = (Math.max(0, supShown / SUPPLY0) * 100).toFixed(2) + '%';
      if (burning) {
        const supFinal = (red.supply - red.burned) / SUPPLY0;
        rdmSupplySlice.style.left = (supFinal * 100).toFixed(2) + '%';
        rdmSupplySlice.style.width = (Math.max(0, supShown / SUPPLY0 - supFinal) * 100).toFixed(2) + '%';
        rdmTake.textContent = takeLine(k);
      } else {
        rdmSupplySlice.style.width = '0';
      }
      /* the transfer itself: one white chip from EACH holding, simultaneously,
         to the redeemer's card. Anchors measured per frame so it survives
         breakpoints. Skipped under prefers-reduced-motion (state still lands). */
      const ws = fit(rdmWireEl, rctx);
      rctx.clearRect(0, 0, ws.w, ws.h);
      if (burning && red.parts.length && !reducedMq.matches) {
        const baseRect = rdmWrap.getBoundingClientRect();
        red.parts.forEach((pt) => {
          const pr = (red.pt - pt.d) / 0.8;
          if (pr <= 0 || pr >= 1) return;
          const from = red.holds[pt.i];
          if (!from) return;
          const a = anchors(from.el, rdmDest, baseRect);
          const xy = arcAt(pr, a[0], a[1], a[2], a[3], 26);
          rctx.globalAlpha = 0.95;
          rctx.fillStyle = C.hi;
          rctx.beginPath();
          rctx.arc(xy[0], xy[1], 4.5, 0, Math.PI * 2);
          rctx.fill();
          rctx.globalAlpha = 1;
        });
      }
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
        red.phase = 'idle';
        red.parts = [];
        red.holds.forEach((h) => {
          h.el.classList.remove('is-paying');
        });
        rdmDest.classList.remove('is-receiving');
        burnIdx = 0;
        red.next = red.t + 2.0;
        redPaint();
      },
      static: () => {
        /* a meaningful still: the headline burn already completed — 10% of
           supply, the receipt naming the same share of every holding */
        begin('@you', 0.1);
        finalize(false);
        redPaint();
      },
    });

    return () => {
      unregisterAcquire();
      unregisterRedeem();
      flashTimers.forEach((timer) => clearTimeout(timer));
      flashTimers.clear();
      [el.trader, el.fund, el.sig].forEach((n) => n.classList.remove('evt-blue', 'evt-pink'));
      el.meet.classList.remove('is-met');
      holds.forEach((h) => {
        h.el.classList.remove('is-paying');
      });
      rdmDest.classList.remove('is-receiving');
    };
  }, []);

  return (
    <section id="sec-fund" className="section section--rule" aria-labelledby="sec-fund-h">
      <div className="container">
        <header className="sec-head reveal">
          <p className="eyebrow">The fund</p>
          <h2 className="h1" id="sec-fund-h">
            A vault with no manager, and one way out
          </h2>
          <p className="lede">
            Everything the Strategies buy lands in the Fund and stays there. No one can pause it, upgrade it, or reach
            in — the only way assets leave is a holder burning GBX for their share.
          </p>
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
                  <div className="acq__box" id="acqAuction">
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
                    <div className="acq__stacks">
                      <canvas
                        id="acqStacks"
                        role="img"
                        aria-label="A chart measured in QQQ: the asking price traced falling in a straight line over the auction, and what the growing USDG lot is worth traced rising to meet it. The auction settles the moment the two lines meet."
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
                      <div className="acq__party" id="acqFund">
                        <div className="acq__label">The treasury</div>
                        <div className="acq__total num" id="acqFundT">
                          0.00 QQQ
                        </div>
                        <p className="note">≥ 80% in code · 90% by default</p>
                        <div className="acq__delta acq__delta--pink num" id="acqFundDelta" />
                      </div>
                      <div className="acq__party acq__party--sig" id="acqSig">
                        <div className="acq__label acq__label--pink">The signalers</div>
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
                <div className="rdm__vault" id="rdmVault">
                  {HOLD_DEFS.map((h) => (
                    <div className="hold" key={h.sym}>
                      <div className="hold__sym">{h.sym}</div>
                      <div className="hold__amt num">{h.amt}</div>
                      <div className="meter meter--thick">
                        <i style={{ width: '100%' }} />
                        <span className="m-slice" />
                      </div>
                      <div className="hold__out num" />
                    </div>
                  ))}
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
