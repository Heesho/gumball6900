'use client';

import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties, SVGProps } from 'react';
import { registerSim } from '../../lib/harness';
import './overview.css';

type PathKey = 'p1' | 'p2' | 'p3' | 'aim' | 'ret';
type NodeKey = 's1' | 's2' | 's3' | 's4' | 'you';

interface MoveEvent {
  move: PathKey;
  color: 'blue' | 'pink' | 'wht';
  t0: number;
  dur: number;
}
interface FlashEvent {
  flash: NodeKey;
  cls: string;
  at: number;
}

/* ----------------------------------------------------------- timeline --
   One pulse at a time, so the eye follows the money: USDG runs the chain
   and turns into the asset at the auction; then, EVERY cycle, you aim the
   stream (pink) and a holder burns and value walks back out (neutral) —
   a ten-second look always sees the full loop, burn included. */
const TIMELINE: (MoveEvent | FlashEvent)[] = [
  { move: 'p1', color: 'blue', t0: 0.35, dur: 1.15 },
  { flash: 's2', cls: 'evt-blue', at: 1.5 },
  { move: 'p2', color: 'blue', t0: 1.7, dur: 1.15 },
  { flash: 's3', cls: 'evt-blue', at: 2.85 },
  { move: 'p3', color: 'pink', t0: 3.05, dur: 1.15 },
  { flash: 's4', cls: 'evt-pink', at: 4.2 },
  { move: 'aim', color: 'pink', t0: 4.75, dur: 1.15 },
  { flash: 's2', cls: 'evt-pink', at: 5.9 },
  { move: 'ret', color: 'wht', t0: 6.45, dur: 1.35 },
  { flash: 'you', cls: 'evt-burn', at: 7.8 },
];
const CYCLE = 8.6;

/* React's SVG prop types omit the global `hidden` attribute, but it is valid
   on SVG elements and the model toggles it; the CSS `[hidden]` rule needs it
   present on the server-rendered markup so the dot never flashes at (0,0). */
const svgHidden = { hidden: true } as SVGProps<SVGGElement>;

export function Overview() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mapQ = root.querySelector<HTMLElement>('#ovMap');
    const dotQ = root.querySelector<SVGGElement>('#ovDot');
    const s1 = root.querySelector<HTMLElement>('#ovS1');
    const s2 = root.querySelector<HTMLElement>('#ovS2');
    const s3 = root.querySelector<HTMLElement>('#ovS3');
    const s4 = root.querySelector<HTMLElement>('#ovS4');
    const you = root.querySelector<HTMLElement>('#ovYou');
    const p1 = root.querySelector<SVGPathElement>('#ovP1');
    const p2 = root.querySelector<SVGPathElement>('#ovP2');
    const p3 = root.querySelector<SVGPathElement>('#ovP3');
    const pAim = root.querySelector<SVGPathElement>('#ovAim');
    const pRet = root.querySelector<SVGPathElement>('#ovRet');
    const l1 = root.querySelector<HTMLElement>('#ovL1');
    const l2 = root.querySelector<HTMLElement>('#ovL2');
    const l3 = root.querySelector<HTMLElement>('#ovL3');
    const lAim = root.querySelector<HTMLElement>('#ovLAim');
    const lRet = root.querySelector<HTMLElement>('#ovLRet');
    if (
      !mapQ || !dotQ || !s1 || !s2 || !s3 || !s4 || !you ||
      !p1 || !p2 || !p3 || !pAim || !pRet ||
      !l1 || !l2 || !l3 || !lAim || !lRet
    ) return;

    /* narrowed aliases — TS doesn't carry the guard above into the closures */
    const map = mapQ;
    const dotG = dotQ;
    const els: Record<NodeKey, HTMLElement> = { s1, s2, s3, s4, you };
    const paths: Record<PathKey, SVGPathElement> = { p1, p2, p3, aim: pAim, ret: pRet };
    const labels: Record<PathKey, HTMLElement> = { p1: l1, p2: l2, p3: l3, aim: lAim, ret: lRet };

    /* ------------------------------------------------------------ layout -- */
    let sizeKey = '';
    let column = false;

    function rectOf(el: HTMLElement) {
      const m = map.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: r.left - m.left, y: r.top - m.top, w: r.width, h: r.height };
    }
    function bezH(x1: number, y1: number, x2: number, y2: number) { // left-to-right S-curve
      const c = Math.max(24, (x2 - x1) * 0.45);
      return 'M' + x1 + ' ' + y1 + ' C ' + (x1 + c) + ' ' + y1 + ', ' + (x2 - c) + ' ' + y2 + ', ' + x2 + ' ' + y2;
    }
    function bezV(x1: number, y1: number, x2: number, y2: number) { // top-to-bottom S-curve
      const c = Math.max(18, (y2 - y1) * 0.45);
      return 'M' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + (y1 + c) + ', ' + x2 + ' ' + (y2 - c) + ', ' + x2 + ' ' + y2;
    }

    function relayout() {
      /* Full-page screenshot capture bounces the viewport through a transient
         degenerate size (1×1) before restoring it; recomputing from that frame
         paints garbage that the capture then renders. Keep the last good
         layout — the restore pass re-measures identically and early-returns. */
      if (map.offsetWidth < 200) return;
      const key = map.offsetWidth + 'x' + map.offsetHeight;
      if (key === sizeKey) return;
      sizeKey = key;

      const r1 = rectOf(els.s1), r2 = rectOf(els.s2), r3 = rectOf(els.s3),
        r4 = rectOf(els.s4), ry = rectOf(els.you);
      column = r2.y > r1.y + r1.h - 4; // stacked?

      if (!column) {
        paths.p1.setAttribute('d', bezH(r1.x + r1.w, r1.y + r1.h / 2, r2.x - 3, r2.y + r2.h / 2));
        paths.p2.setAttribute('d', bezH(r2.x + r2.w, r2.y + r2.h / 2, r3.x - 3, r3.y + r3.h / 2));
        paths.p3.setAttribute('d', bezH(r3.x + r3.w, r3.y + r3.h / 2, r4.x - 3, r4.y + r4.h / 2));
        /* you → stage 2 (aim), stage 4 → you (burn) */
        const ax = ry.x + ry.w * 0.2, ay = ry.y;
        const tx = r2.x + r2.w / 2, ty = r2.y + r2.h;
        paths.aim.setAttribute('d', 'M' + ax + ' ' + ay + ' C ' + ax + ' ' + (ay - 44) + ', ' + tx + ' ' + (ty + 52) + ', ' + tx + ' ' + (ty + 3));
        const bx = r4.x + r4.w / 2, by = r4.y + r4.h;
        const ux = ry.x + ry.w, uy = ry.y + ry.h * 0.5;
        paths.ret.setAttribute('d', 'M' + bx + ' ' + by + ' C ' + bx + ' ' + (by + 64) + ', ' + (ux + 72) + ' ' + uy + ', ' + (ux + 3) + ' ' + uy);
      } else {
        paths.p1.setAttribute('d', bezV(r1.x + r1.w / 2, r1.y + r1.h, r2.x + r2.w / 2, r2.y - 3));
        paths.p2.setAttribute('d', bezV(r2.x + r2.w / 2, r2.y + r2.h, r3.x + r3.w / 2, r3.y - 3));
        paths.p3.setAttribute('d', bezV(r3.x + r3.w / 2, r3.y + r3.h, r4.x + r4.w / 2, r4.y - 3));
        /* burn: fund straight down into the you strip */
        paths.ret.setAttribute('d', bezV(r4.x + r4.w / 2, r4.y + r4.h, ry.x + ry.w / 2, ry.y - 3));
        /* aim: back up the left rail from you to stage 2 */
        const y1 = ry.y + ry.h * 0.5, y2 = r2.y + r2.h * 0.5;
        const ctrl = Math.max(6, r2.x - 30);
        paths.aim.setAttribute('d', 'M' + ry.x + ' ' + y1 + ' C ' + ctrl + ' ' + y1 + ', ' + ctrl + ' ' + y2 + ', ' + (r2.x - 3) + ' ' + y2);
      }

      /* labels sit at each path's midpoint, offset off the line so the pulse
         never crosses the text: chain labels ride just ABOVE the line in row
         mode; the near-vertical aim leg (and the column burn leg) carry their
         labels BESIDE the line instead */
      (Object.keys(labels) as PathKey[]).forEach((k) => {
        const el = labels[k], p = paths[k];
        if (k === 'aim' && column) { el.hidden = true; return; } /* rail is too tight; the strip carries the words */
        el.hidden = false;
        const pt = p.getPointAtLength(p.getTotalLength() * 0.5);
        const chain = (k === 'p1' || k === 'p2' || k === 'p3');
        el.style.left = pt.x + 'px';
        el.style.top = (chain && !column ? pt.y - 17 : pt.y) + 'px';
        el.style.translate = (k === 'aim') ? '18px -50%'
          : (k === 'ret' && column) ? '16px -50%' : '';
      });
    }

    /* --------------------------------------------------------------- dots -- */
    function setDot(g: SVGGElement, pathKey: PathKey, prog: number, color: string) {
      const p = paths[pathKey];
      const pt = p.getPointAtLength(p.getTotalLength() * Math.min(1, Math.max(0, prog)));
      g.setAttribute('transform', 'translate(' + pt.x + ' ' + pt.y + ')');
      g.setAttribute('class', 'ov-dot ov-dot--' + color);
      g.removeAttribute('hidden');
    }

    const flashTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    function flash(el: HTMLElement, cls: string) {
      el.classList.remove('evt-blue', 'evt-pink', 'evt-burn');
      void el.offsetWidth; /* restart the animation on repeat events */
      el.classList.add(cls);
      const prev = flashTimers.get(el);
      if (prev !== undefined) clearTimeout(prev);
      flashTimers.set(el, setTimeout(() => {
        el.classList.remove(cls);
        flashTimers.delete(el);
      }, 1100));
    }

    let t = 0;
    let fired: Record<number, boolean> = {};
    let active: { path: PathKey; color: string; prog: number } | null = null;

    function step(dt: number) {
      t += dt;
      if (t >= CYCLE) { t -= CYCLE; fired = {}; }
      active = null;
      for (let i = 0; i < TIMELINE.length; i++) {
        const ev = TIMELINE[i];
        if (ev === undefined) continue;
        if ('move' in ev) {
          if (t >= ev.t0 && t < ev.t0 + ev.dur) {
            active = { path: ev.move, color: ev.color, prog: (t - ev.t0) / ev.dur };
          }
        } else if (dt > 0 && !fired[i] && t >= ev.at && t - ev.at < 0.5) {
          fired[i] = true;
          flash(els[ev.flash], ev.cls);
        }
      }
    }

    function paint() {
      relayout();
      if (active) setDot(dotG, active.path, active.prog, active.color);
      else dotG.setAttribute('hidden', '');
    }

    /* Reduced motion: the still carries the whole loop — a pulse mid-flight on
       every leg, colored by what it is at that point. */
    let staticDots: SVGGElement[] | null = null;
    let staticMode = false;
    function paintStatic() {
      staticMode = true;
      relayout();
      dotG.setAttribute('hidden', '');
      if (!staticDots) {
        staticDots = ['aim', 'ret'].map(() => {
          const g = dotG.cloneNode(true) as SVGGElement;
          g.removeAttribute('id');
          dotG.parentNode?.appendChild(g);
          return g;
        });
      }
      /* the two long legs have room for a frozen pulse; the chain legs are
         carried by their colored, labeled arrows. Freeze the aim dot mid-leg,
         right beside its offset label; the burn dot rests mid-leg in column
         mode (clear of label and arrowhead) and at 0.74 in row mode, past the
         on-line label. */
      const spec: [PathKey, number, string][] = [
        ['aim', 0.5, 'pink'],
        ['ret', column ? 0.5 : 0.74, 'wht'],
      ];
      spec.forEach((s, i) => {
        const g = staticDots ? staticDots[i] : undefined;
        if (g) setDot(g, s[0], s[1], s[2]);
      });
    }

    /* Font swap and viewport changes reflow the cards after first paint. Live
       mode re-measures every frame; static mode must be re-driven by events.
       relayout()'s own size guard stays the gate: any reflow that moves the
       cards also changes the map's offset size, while full-page screenshot
       capture rescales the visual viewport — DOM rects read scaled garbage
       mid-capture — without touching offset size. Never force the guard open. */
    let disposed = false;
    function remeasure() {
      if (staticMode) paintStatic();
    }
    window.addEventListener('load', remeasure);
    window.addEventListener('resize', remeasure);
    if (document.fonts && document.fonts.ready) {
      void document.fonts.ready.then(() => { if (!disposed) remeasure(); });
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(remeasure) : null;
    ro?.observe(map);

    const unregister = registerSim({
      name: 'overview',
      el: root,
      step,
      paint,
      reset: () => { t = 0; fired = {}; active = null; },
      static: paintStatic,
    });

    return () => {
      disposed = true;
      unregister();
      window.removeEventListener('load', remeasure);
      window.removeEventListener('resize', remeasure);
      ro?.disconnect();
      flashTimers.forEach((timer) => clearTimeout(timer));
      flashTimers.clear();
      Object.values(els).forEach((el) => el.classList.remove('evt-blue', 'evt-pink', 'evt-burn'));
      staticDots?.forEach((g) => g.remove());
      staticDots = null;
      dotG.setAttribute('hidden', ''); /* restore the SSR state for a re-run */
    };
  }, []);

  return (
    <section id="sec-overview" className="section section--rule" aria-labelledby="sec-overview-h" ref={rootRef}>
      <div className="container">
        <header className="sec-head reveal">
          <p className="eyebrow">How it works</p>
          <h2 className="h1" id="sec-overview-h">Money in, aimed by holders, out as assets you can claim</h2>
          <p className="lede">Miners pay USDG for mining slots — the only money in. Holders point that
            stream at assets, falling-price auctions convert it, and burning GBX takes your share
            out at any time.</p>
        </header>

        <div className="reveal" style={{ '--d': '90ms' } as CSSProperties}>
          <div className="ov-map" id="ovMap">
            <svg className="ov-links" aria-hidden="true">
              <defs>
                <marker id="ovMkBlue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" className="ov-mkfill--blue" />
                </marker>
                <marker id="ovMkPink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" className="ov-mkfill--pink" />
                </marker>
                <marker id="ovMkWht" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" className="ov-mkfill--wht" />
                </marker>
              </defs>
              <path id="ovP1" className="ov-link ov-link--blue" markerEnd="url(#ovMkBlue)" />
              <path id="ovP2" className="ov-link ov-link--blue" markerEnd="url(#ovMkBlue)" />
              <path id="ovP3" className="ov-link ov-link--pink" markerEnd="url(#ovMkPink)" />
              <path id="ovAim" className="ov-link ov-link--pink ov-link--dash" markerEnd="url(#ovMkPink)" />
              <path id="ovRet" className="ov-link ov-link--wht ov-link--dash" markerEnd="url(#ovMkWht)" />
            </svg>

            <ol className="ov-stages">
              <li className="card ov-stage ov-stage--blue" id="ovS1">
                <span className="ov-stage__tag num">01 · Money in</span>
                <h3 className="card__head">Miners pay in</h3>
                <p className="card__body">Sixteen mining slots, every one always for sale. The USDG
                  miners pay is the fund&#39;s only buying power.</p>
              </li>
              <li className="card ov-stage ov-stage--pink" id="ovS2">
                <span className="ov-stage__tag num">02 · Aimed</span>
                <h3 className="card__head">Holders aim it</h3>
                <p className="card__body">Revenue releases as a rolling seven-day stream, split moment
                  to moment by where holders point their GBX.</p>
              </li>
              <li className="card ov-stage ov-stage--pink" id="ovS3">
                <span className="ov-stage__tag num">03 · Converted</span>
                <h3 className="card__head">Auctions convert it</h3>
                <p className="card__body">Each Strategy sells its USDG at a falling price — paid in
                  the target asset itself, never in dollars. No oracle anywhere.</p>
              </li>
              <li className="card ov-stage" id="ovS4">
                <span className="ov-stage__tag num">04 · Yours</span>
                <h3 className="card__head">The fund holds it</h3>
                <p className="card__body">At least 80% of every purchase, in code. Ownerless — assets
                  leave only when a holder burns GBX for their share.</p>
              </li>
            </ol>

            <div className="ov-you" id="ovYou">
              <span className="ov-you__dot" aria-hidden="true"></span>
              <div>
                <p className="ov-you__title">You hold GBX</p>
                <p className="note">Aim the stream any time · burn to claim your share of everything</p>
              </div>
            </div>

            <div className="ov-labels" aria-hidden="true">
              <span className="ov-lab ov-lab--blue" id="ovL1">USDG</span>
              <span className="ov-lab ov-lab--blue" id="ovL2">USDG</span>
              <span className="ov-lab ov-lab--pink" id="ovL3">Asset</span>
              <span className="ov-lab ov-lab--pink" id="ovLAim">You aim it</span>
              <span className="ov-lab" id="ovLRet">Burn GBX · your share</span>
            </div>

            <svg className="ov-dotlayer" aria-hidden="true">
              <g id="ovDot" className="ov-dot" {...svgHidden}>
                <circle r="9" className="ov-dot__glow" />
                <circle r="6.5" className="ov-dot__ring" />
                <circle r="4.5" className="ov-dot__core" />
              </g>
            </svg>
          </div>

          <p className="note ov-note">Every arrow is a contract call anyone can make — no step waits on
            a person. The sections below zoom in: the money, the aim, the assets.</p>
        </div>
      </div>
    </section>
  );
}
