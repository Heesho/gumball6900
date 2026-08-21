'use client';

import { useLayoutEffect, useRef } from 'react';
import { registerSim } from '../../lib/harness';
import './mining.css';

/* The mine — sixteen reverse Dutch auctions, lifted from docs/deck (mine sim).
   Mirrors Mine.sol mechanics: linear decay to zero over PRICE_DECAY_PERIOD,
   80/20 vs 100% payment routing, tenure-locked tps, halving thresholds that
   themselves halve. Illustrative parameters only. */

// Contract constants the sim is bound by.
const SLOTS = 16;
const DECAY = 3600; // Mine.PRICE_DECAY_PERIOD, seconds
const MINER_BPS = 8000; // Mine.PREVIOUS_MINER_BPS
const BPS = 10000;
const MULT = 2.0; // illustrative pick inside Mine's 1.1–3.0 bound
const MIN_PRICE = 1; // Mine.MIN_INITIAL_PRICE, in dollars
const MAX_PRICE = 60; // stands in for Mine's MAX_INITIAL_PRICE cap

// Illustrative emission curve.
const INITIAL_TPS = 4000 / 3600; // GBX/s, all slots combined
const HALVING = 250000;
const TAIL = 200 / 3600;

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
const OPEN_AT_START = new Set([2, 9, 13]); // never-taken slots: the 100% route

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Deterministic initial shell for the sixteen board cells: the geometry
// (heights) is final in the server HTML; the effect's pre-run overwrites the
// text values before the first post-hydration paint (useLayoutEffect). Text
// lengths mirror what paintSim writes, so nothing changes height.
const CELL_SHELL = NAMES.map((name, i) => {
  const open = OPEN_AT_START.has(i);
  return {
    id: pad2(i + 1),
    open,
    owner: open ? 'open' : '@' + name,
    price: '$' + (4 + ((i * 397) % 2600) / 100).toFixed(2),
    width: ((i * 53) % 88) + 6 + '%',
    sub: open ? 'never taken · 0/h' : ((i * 13) % 40).toFixed(1) + ' GBX · 250/h',
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
  fx: HTMLElement;
  timer: ReturnType<typeof setTimeout> | null;
}

function globalTps(mined: number): number {
  // Mirrors Mine._rateState: thresholds halve alongside the rate.
  let halvings = 0;
  let next = HALVING;
  let tps = INITIAL_TPS;
  while (mined >= next && halvings < 64) {
    halvings++;
    tps = INITIAL_TPS / Math.pow(2, halvings);
    if (tps <= TAIL) return TAIL;
    next += HALVING / Math.pow(2, halvings);
  }
  tps = INITIAL_TPS / Math.pow(2, halvings);
  return tps <= TAIL ? TAIL : tps;
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

export function Mining() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const $ = (id: string) => document.getElementById(id);
    const board = $('mn-board');
    const clock = $('mn-clock');
    const buyline = $('mn-buyline');
    const labMiner = $('mn-lab-miner');
    const valMiner = $('mn-val-miner');
    const barMiner = $('mn-bar-miner');
    const labFund = $('mn-lab-fund');
    const valFund = $('mn-val-fund');
    const barFund = $('mn-bar-fund');
    const exitline = $('mn-exitline');
    const transfer = $('mn-transfer');
    const tFund = $('mn-t-fund');
    const tPaid = $('mn-t-paid');
    const tGbx = $('mn-t-gbx');
    const tRate = $('mn-t-rate');
    if (
      !board ||
      !clock ||
      !buyline ||
      !labMiner ||
      !valMiner ||
      !barMiner ||
      !labFund ||
      !valFund ||
      !barFund ||
      !exitline ||
      !transfer ||
      !tFund ||
      !tPaid ||
      !tGbx ||
      !tRate
    )
      return;

    // Captured post-narrowing so the closures below see non-null elements.
    const els = {
      clock,
      buyline,
      labMiner,
      valMiner,
      barMiner,
      labFund,
      valFund,
      barFund,
      exitline,
      transfer,
      tFund,
      tPaid,
      tGbx,
      tRate,
    };

    // Wire the JSX-rendered cells (do NOT rebuild them — zero layout shift).
    const cells: CellRefs[] = [];
    const cellRoots = Array.from(board.querySelectorAll<HTMLElement>('.mn-cell'));
    if (cellRoots.length !== SLOTS) return;
    for (const cellRoot of cellRoots) {
      const owner = cellRoot.querySelector<HTMLElement>('.mn-cell__owner');
      const price = cellRoot.querySelector<HTMLElement>('.mn-cell__price');
      const bar = cellRoot.querySelector<HTMLElement>('.meter i');
      const sub = cellRoot.querySelector<HTMLElement>('.mn-cell__sub');
      const fx = cellRoot.querySelector<HTMLElement>('.mn-cell__fx');
      if (!owner || !price || !bar || !sub || !fx) return;
      cells.push({ root: cellRoot, owner, price, bar, sub, fx, timer: null });
    }

    const S = { t: 0, totalMined: 0, revenue: 0, paidToMiners: 0, slots: [] as Slot[] };
    // While one of the reader's own purchases is on the transfer panel, auto
    // purchases may not overwrite it — an event's consequence must stay visible.
    let holdTransferUntil = 0;
    let transferTimer: ReturnType<typeof setTimeout> | null = null;
    // Sim time of the last purchase of any kind, so a scripted beat never lands
    // on top of an ambient one's still-lit emphasis.
    let lastEventAt = -Infinity;
    // True only while the board is being pre-run to build history off-screen.
    let warming = false;

    function seedBoard(): void {
      S.t = 0;
      S.totalMined = 0;
      S.revenue = 0;
      S.paidToMiners = 0;
      S.slots.length = 0;
      NAMES.forEach((name, i) => {
        const open = OPEN_AT_START.has(i);
        const slot: Slot = {
          // Start every slot at its own point in its own cycle, otherwise the whole
          // board reaches its reservation together and all sixteen change hands at once.
          owner: open ? null : name,
          initialPrice: 4 + Math.random() * 26,
          // A never-taken slot has only been decaying since deployment, so it is
          // early in its hour; a held slot is anywhere in its own cycle.
          startedAt: -Math.random() * DECAY * (open ? 0.14 : 0.9),
          lastAccruedAt: 0,
          tps: open ? 0 : INITIAL_TPS / SLOTS, // vacant slots emit nothing (Mine.sol)
          mined: open ? 0 : Math.random() * 40,
          // Reservation as a fraction of the slot's own price, redrawn per tenure —
          // the desync that keeps the board from churning in lockstep.
          reserve: 0,
        };
        slot.reserve = slot.initialPrice * (0.25 + Math.random() * 0.55);
        S.slots.push(slot);
      });
      // The never-taken slots start their hour on the deployment clock, so the
      // scripted first-take below still has a real price to route.
      lastEventAt = -Infinity;
    }
    seedBoard();

    function priceOf(slot: Slot): number {
      const elapsed = S.t - slot.startedAt;
      if (elapsed >= DECAY) return 0;
      return slot.initialPrice * (1 - elapsed / DECAY);
    }

    function flashTransfer(): void {
      els.transfer.classList.remove('evt-blue');
      void els.transfer.offsetWidth; // restart the animation on repeat events
      els.transfer.classList.add('evt-blue');
      if (transferTimer !== null) clearTimeout(transferTimer);
      transferTimer = setTimeout(function () {
        els.transfer.classList.remove('evt-blue');
      }, 1100);
    }

    function showTransfer(
      index: number,
      buyer: string,
      displaced: string | null,
      paid: number,
      toMiner: number,
      toFund: number,
      accrued: number,
    ): void {
      // The cell names its own consequence for ~1s… (the warm-up runs a hundred
      // purchases to build history; none of them are events the reader saw, so
      // they must not all light up at once on arrival)
      const cell = cells[index];
      if (!cell) return;
      if (!warming) {
        cell.fx.textContent = displaced ? '+' + money(toMiner) + ' → @' + displaced : '100% → fund';
        cell.root.classList.remove('evt-blue');
        void cell.root.offsetWidth;
        cell.root.classList.add('evt-blue');
        if (cell.timer !== null) clearTimeout(cell.timer);
        cell.timer = setTimeout(function () {
          cell.root.classList.remove('evt-blue');
          cell.fx.textContent = '';
        }, 1100);
      }

      // …and the transfer panel shows where the money went.
      const isUser = buyer === 'you';
      const now = performance.now();
      if (!isUser && now < holdTransferUntil) return;
      if (isUser) holdTransferUntil = now + 2500;
      const who = isUser ? 'You' : '@' + buyer;
      els.buyline.textContent =
        who + ' take' + (buyer === 'you' ? '' : 's') + ' slot ' + pad2(index + 1) + ' for ' + money(paid) + '.';
      if (displaced) {
        els.labMiner.textContent = '80% → @' + displaced + ', displaced';
        els.valMiner.textContent = money(toMiner);
        els.labFund.textContent = '20% → the fund’s buying power';
        els.valFund.textContent = money(toFund);
        els.exitline.textContent = '@' + displaced + ' exits with ' + gbx(accrued) + ' GBX, minted on the spot.';
      } else {
        els.labMiner.textContent = 'no one displaced — first-ever take';
        els.valMiner.textContent = '—';
        els.labFund.textContent = '100% → the fund’s buying power';
        els.valFund.textContent = money(toFund);
        els.exitline.textContent = 'The whole payment becomes buying power.';
      }
      // Animate the split growing from zero.
      els.barMiner.style.width = '0%';
      els.barFund.style.width = '0%';
      void els.barMiner.offsetWidth;
      els.barMiner.style.width = displaced ? '80%' : '0%';
      els.barFund.style.width = displaced ? '20%' : '100%';
      if (!warming) flashTransfer();
    }

    function buy(index: number, forcedOwner?: string): void {
      const slot = S.slots[index];
      if (!slot) return;
      const paid = priceOf(slot);
      const displaced = slot.owner;

      // Settle the outgoing tenure: its accrual mints to the displaced miner.
      let accrued = 0;
      if (displaced !== null) {
        accrued = (S.t - slot.lastAccruedAt) * slot.tps;
        S.totalMined += accrued;
      }

      // Route the payment: vacant slot → 100% revenue; occupied → 80/20.
      let toMiner = 0;
      let toFund = 0;
      if (paid > 0) {
        if (displaced === null) {
          toFund = paid;
        } else {
          toMiner = (paid * MINER_BPS) / BPS;
          toFund = paid - toMiner;
        }
        S.revenue += toFund;
        S.paidToMiners += toMiner;
      }

      // New tenure: restart price at paid × MULT with the $1 floor; the new rate
      // re-divides the current global rate by sixteen and is locked until replaced.
      slot.owner = forcedOwner || NAMES[Math.floor(Math.random() * NAMES.length)] || 'ava';
      slot.initialPrice = Math.min(Math.max(paid * MULT, MIN_PRICE), MAX_PRICE);
      slot.startedAt = S.t;
      slot.lastAccruedAt = S.t;
      slot.tps = globalTps(S.totalMined) / SLOTS;
      slot.mined = 0;
      slot.reserve = slot.initialPrice * (0.3 + Math.random() * 0.55);
      lastEventAt = S.t;

      showTransfer(index, slot.owner, displaced, paid, toMiner, toFund, accrued);
    }

    /* ---------------------------------------------------- the scripted beats
       No one operates this board. On its own clock — sim time, so a section
       that has never been on screen has not burned its cycle — the reader
       takes a slot, and the panel holds the split for 2.5s. The programme
       front-loads the two distinct routes: a never-taken slot (100% → fund)
       and an occupied one (80/20), alternating, so both are seen inside half
       a minute. Ambient miner purchases keep running underneath. */
    const BEAT = 360; // sim seconds between scripted takes — 6s at timeScale 60
    const PROGRAM = ['first', 'occ', 'first', 'occ', 'first'] as const;
    let beatIdx = 0;
    let nextBeat = 0;
    // A busy stretch of ambient purchases may push a scripted beat back, but
    // never past this — the headline beats are guaranteed, not best-effort.
    let beatDeadline = 0;

    function takeAsYou(kind: 'first' | 'occ'): void {
      let index = -1;
      if (kind === 'first') {
        // the never-taken slot still carrying the most price — the 100% route
        let bestPrice = 0;
        S.slots.forEach(function (slot, i) {
          if (slot.owner !== null) return;
          const p = priceOf(slot);
          if (p > bestPrice) {
            bestPrice = p;
            index = i;
          }
        });
      }
      if (index < 0) {
        // a mid-priced occupied slot: big enough to read the 80/20 split on
        const held: { i: number; p: number }[] = [];
        S.slots.forEach(function (slot, i) {
          if (slot.owner !== null && slot.owner !== 'you') held.push({ i, p: priceOf(slot) });
        });
        if (!held.length) return;
        held.sort(function (a, b) {
          return a.p - b.p;
        });
        index = held[Math.floor(held.length / 2)]?.i ?? held[0]!.i;
      }
      buy(index, 'you');
    }

    function runBeat(): void {
      // Never stack a scripted take on an ambient one that is still lit — but
      // never let ambient traffic push it past its deadline either.
      if (S.t - lastEventAt < 90 && S.t < beatDeadline) {
        nextBeat = S.t + 90;
        return;
      }
      const kind = PROGRAM[beatIdx] ?? 'occ';
      if (beatIdx < PROGRAM.length) beatIdx++;
      takeAsYou(kind);
      nextBeat = S.t + BEAT;
      beatDeadline = nextBeat + BEAT;
    }

    function stepSim(dt: number): void {
      S.t += dt;
      S.slots.forEach(function (slot, i) {
        if (slot.owner !== null) slot.mined += dt * slot.tps;
        // Never inside the first stretch of a tenure, so slots cannot churn in
        // lockstep. Never-taken slots are left for the scripted first-take.
        if (slot.owner !== null && S.t - slot.startedAt > 240 && priceOf(slot) <= slot.reserve) buy(i);
      });
      if (S.t >= nextBeat) runBeat();
    }

    function paintSim(): void {
      let live = 0;
      S.slots.forEach(function (slot, i) {
        const c = cells[i];
        if (!c) return;
        const frac = Math.min(1, Math.max(0, (S.t - slot.startedAt) / DECAY));
        c.owner.textContent = slot.owner === null ? 'open' : slot.owner === 'you' ? 'you' : '@' + slot.owner;
        c.owner.classList.toggle('is-you', slot.owner === 'you');
        c.owner.classList.toggle('is-open', slot.owner === null);
        c.price.textContent = '$' + priceOf(slot).toFixed(2);
        // Slot clock — empty at (re)start, full at the hour, when the price has decayed to zero.
        c.bar.style.width = (frac * 100).toFixed(1) + '%';
        c.sub.textContent =
          slot.owner === null ? 'never taken · 0/h' : gbx(slot.mined) + ' GBX · ' + Math.round(slot.tps * 3600) + '/h';
        live += slot.tps;
      });
      const d = Math.floor(S.t / 86400);
      const h = Math.floor((S.t % 86400) / 3600);
      const m = Math.floor((S.t % 3600) / 60);
      els.clock.textContent = 'day ' + d + ', ' + pad2(h) + ':' + pad2(m);
      els.tFund.textContent = money(S.revenue);
      els.tPaid.textContent = money(S.paidToMiners);
      els.tGbx.textContent = gbx(S.totalMined);
      els.tRate.textContent = Math.round(live * 3600).toLocaleString();
    }

    // Arrive mid-life: pre-run ten sim minutes so the reader lands on a board with
    // history — tallies non-zero, the transfer panel showing a real split — and
    // then watches live purchases happen on top of it. The programme starts one
    // beat after that, so the first scripted take lands ~6s into the viewing.
    function warmStart(): void {
      seedBoard();
      beatIdx = 0;
      nextBeat = Infinity; // no scripted beats during the warm-up
      warming = true;
      for (let k = 0; k < 100; k++) stepSim(6);
      warming = false;
      nextBeat = S.t + BEAT;
      beatDeadline = S.t + BEAT + BEAT;
    }
    warmStart();
    paintSim();

    const unregister = registerSim({
      name: 'mining',
      el: root,
      timeScale: 60, // one real second ≈ one sim minute
      step: stepSim,
      paint: paintSim,
      // Scrolled back after a long absence: restart the mine at genesis so the
      // programme's first-ever-take beats are there to be seen again.
      reset: function () {
        warmStart();
        paintSim();
      },
      static: function () {
        // A meaningful still: the reader's own first-ever take, so the frozen
        // panel carries the 100% → fund route and a `you` slot on the board.
        for (let k = 0; k < 60; k++) stepSim(6);
        takeAsYou('first');
        paintSim();
      },
    });

    return () => {
      unregister();
      if (transferTimer !== null) clearTimeout(transferTimer);
      els.transfer.classList.remove('evt-blue');
      for (const c of cells) {
        if (c.timer !== null) clearTimeout(c.timer);
        c.root.classList.remove('evt-blue');
        c.fx.textContent = '';
      }
    };
  }, []);

  return (
    <section id="sec-mining" className="section section--rule" aria-labelledby="sec-mining-h" ref={rootRef}>
      <div className="container">
        <header className="sec-head reveal">
          <p className="eyebrow eyebrow--blue">Mining</p>
          <h2 className="h1" id="sec-mining-h">
            Sixteen slots pay for everything
          </h2>
          <p className="lede">
            Mining is where the fund&apos;s money comes from. Miners pay USDG for one of sixteen permanent slots, and
            that USDG is the fund&apos;s buying power. There is no other source — no team allocation, no presale.
          </p>
        </header>

        <div className="sim-panel reveal" style={{ '--d': '90ms' } as React.CSSProperties}>
          <div className="sim-panel__head">
            <span className="sim-panel__title sim-panel__title--blue">Mine — live model</span>
            <span className="chip chip--warn">Illustrative parameters</span>
          </div>
          <div className="sim-panel__body">
            <div className="mn-layout">
              <div>
                <p className="note mn-cap">
                  All sixteen slots, each on its own clock. Every one is always for sale: its price falls in a straight
                  line to zero over one hour and restarts when taken.
                </p>
                <div className="mn-board" id="mn-board">
                  {CELL_SHELL.map((c) => (
                    <div className="mn-cell" key={c.id}>
                      <div className="mn-cell__top">
                        <span className="mn-cell__id num">{c.id}</span>
                        <span className={'mn-cell__owner num' + (c.open ? ' is-open' : '')}>{c.owner}</span>
                      </div>
                      <div className="mn-cell__price num">{c.price}</div>
                      <div className="meter meter--blue">
                        <i style={{ width: c.width }} />
                      </div>
                      <div className="mn-cell__sub num">{c.sub}</div>
                      <div className="mn-cell__fx num" />
                    </div>
                  ))}
                </div>
              </div>
              <aside aria-label="Where the money goes">
                <div className="mn-transfer" id="mn-transfer">
                  <p className="mn-transfer__cap">Where the money goes</p>
                  <p className="mn-transfer__line" id="mn-buyline">
                    Waiting for the first purchase…
                  </p>
                  <div className="mn-route">
                    <div className="mn-route__top">
                      <span id="mn-lab-miner">80% → the displaced miner</span>
                      <span className="mn-route__val num" id="mn-val-miner">
                        —
                      </span>
                    </div>
                    <div className="meter meter--thick mn-meter--exit">
                      <i id="mn-bar-miner" />
                    </div>
                  </div>
                  <div className="mn-route">
                    <div className="mn-route__top">
                      <span id="mn-lab-fund">20% → the fund&apos;s buying power</span>
                      <span className="mn-route__val num" id="mn-val-fund">
                        —
                      </span>
                    </div>
                    <div className="meter meter--thick meter--blue">
                      <i id="mn-bar-fund" />
                    </div>
                  </div>
                  <p className="note mn-exitline" id="mn-exitline">
                    {'\u00A0'}
                  </p>
                </div>
                <dl className="mn-tallies">
                  <div className="mn-tally">
                    <dt>USDG to the fund&apos;s buying power</dt>
                    <dd className="num blue" id="mn-t-fund">
                      $0
                    </dd>
                  </div>
                  <div className="mn-tally">
                    <dt>Paid back to displaced miners</dt>
                    <dd className="num" id="mn-t-paid">
                      $0
                    </dd>
                  </div>
                  <div className="mn-tally">
                    <dt>GBX mined so far</dt>
                    <dd className="num" id="mn-t-gbx">
                      0
                    </dd>
                  </div>
                  <div className="mn-tally">
                    <dt>GBX per hour, all slots</dt>
                    <dd className="num" id="mn-t-rate">
                      —
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>
          </div>
          <div className="sim-panel__foot">
            <div className="sim-panel__controls">
              <span className="note mn-legend">
                Purchases land on their own — other miners, and every few seconds one of them is yours.
              </span>
              <span className="sim-clock" id="mn-clock">
                day 0, 00:00
              </span>
            </div>
            <p className="sim-note">
              Sped up ~60×. Restart multiplier shown as ×2 — the contract fixes it at deployment, anywhere from 1.1× to
              3×, with a $1 floor. Production parameters are unselected; figures are illustrative.
            </p>
          </div>
        </div>

        <div className="cols cols--3 mn-facts">
          <div className="card reveal" style={{ '--d': '180ms' } as React.CSSProperties}>
            <div className="card__head">One hour to zero</div>
            <div className="card__body">
              Every slot&apos;s price falls in a straight line to zero over one hour, forever. Take one and it restarts
              at a multiple of what you paid — so a slot nobody wants gets cheap and a contested slot gets expensive,
              with no oracle and no admin.
            </div>
          </div>
          <div className="card card--blue reveal" style={{ '--d': '270ms' } as React.CSSProperties}>
            <div className="card__head">80% cash-out, 20% buying power</div>
            <div className="card__body">
              Taking an occupied slot pays 80% of the price to the miner you displace — that is how miners exit with
              cash — and 20% to the fund. A slot taken for the first time sends 100% to the fund.
            </div>
          </div>
          <div className="card reveal" style={{ '--d': '360ms' } as React.CSSProperties}>
            <div className="card__head">Your rate is locked</div>
            <div className="card__body">
              GBX issuance splits evenly across the sixteen slots. The per-second rate you get when you take a slot is
              fixed for your entire tenure, and what you mined is minted to you when your tenure ends. GBX itself begins
              as a single 20,000,000 allocation locked forever into market liquidity; every token after that is mined.
            </div>
          </div>
        </div>
        <p className="small muted measure reveal" style={{ '--d': '450ms' } as React.CSSProperties}>
          Where that USDG goes next is decided by the holders — that&rsquo;s Resonance.
        </p>
      </div>
    </section>
  );
}
