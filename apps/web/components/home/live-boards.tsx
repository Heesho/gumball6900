'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { SIGNAL } from '../../lib/protocol';
import {
  BURN_SHARES,
  animateFlow,
  burn,
  clock,
  createFlow,
  createFund,
  createMine,
  gbx,
  gbxTight,
  mineHourlyRate,
  slotPrice,
  slotRemaining,
  stepFlow,
  stepFund,
  stepMine,
  streamLeft,
  totalWeight,
  units,
  usd,
  type FlowModel,
  type FundModel,
  type MineModel,
} from './live-sim';
import styles from './live-boards.module.css';

/**
 * The three live boards on the homepage dashboard.
 *
 * Each board runs a rule from the contracts fast enough to watch: sixteen independent descending
 * auctions, one seven-day stream split by signal weight, one pro-rata burn. None of it is protocol
 * activity — nothing is deployed — and each board carries a note underneath saying exactly that.
 *
 * One requestAnimationFrame loop drives all three. Boards register with it and report their own
 * visibility, so only the stage on screen advances and the loop cancels itself when none is. A
 * frame writes text and SVG attributes through cached nodes: no frame sets React state, and no
 * frame reads layout, because geometry is measured on mount and again only on resize.
 */

/* ------------------------------------------------------------------ the loop */

interface BoardHandle {
  visible: boolean;
  step: (realDt: number) => void;
  paint: () => void;
}

interface Models {
  mine: MineModel;
  flow: FlowModel;
  fund: FundModel;
}

interface LiveValue {
  models: Models;
  /** False when the reader asked for reduced motion: boards compose one still frame and hold it. */
  motion: () => boolean;
  register: (handle: BoardHandle) => () => void;
  wake: () => void;
}

interface Loop {
  frame: number;
  last: number;
  motion: boolean;
  handles: Set<BoardHandle>;
}

/** The one frame every board on the section shares. */
function runFrame(loop: Loop, now: number): void {
  // One clamped delta for every board, so a backgrounded tab never lurches the simulation.
  const delta = loop.last ? Math.min(0.064, (now - loop.last) / 1000) : 0.016;
  loop.last = now;
  let live = false;
  for (const handle of loop.handles) {
    if (!handle.visible) continue;
    handle.step(delta);
    handle.paint();
    live = true;
  }
  if (live && loop.motion) {
    loop.frame = requestAnimationFrame((next) => runFrame(loop, next));
    return;
  }
  // Nothing on screen, or no motion wanted: stop entirely rather than idle at sixty frames a second.
  loop.frame = 0;
  loop.last = 0;
}

function startLoop(loop: Loop): void {
  if (loop.frame || !loop.motion) return;
  for (const handle of loop.handles) {
    if (handle.visible) {
      loop.frame = requestAnimationFrame((now) => runFrame(loop, now));
      return;
    }
  }
}

function stopLoop(loop: Loop): void {
  if (loop.frame) cancelAnimationFrame(loop.frame);
  loop.frame = 0;
  loop.last = 0;
}

/** Reduced motion stops the loop where it stands: every board keeps the frame it last composed. */
function setMotion(loop: Loop, allowed: boolean): void {
  loop.motion = allowed;
  if (allowed) startLoop(loop);
  else stopLoop(loop);
}

const createModels = (): Models => ({ mine: createMine(), flow: createFlow(), fund: createFund() });
const createLoop = (): Loop => ({ frame: 0, last: 0, motion: false, handles: new Set() });

const LiveContext = createContext<LiveValue | null>(null);

export function LiveBoardsProvider({ children }: { children: ReactNode }) {
  // Lazy state rather than a ref: the models outlive every remount, and reading one is not a render
  // side effect. A pinned stage change unmounts two boards, and their clocks must survive it.
  const [models] = useState(createModels);
  const [loop] = useState(createLoop);

  const wake = useCallback(() => startLoop(loop), [loop]);
  const motion = useCallback(() => loop.motion, [loop]);

  const register = useCallback(
    (handle: BoardHandle) => {
      loop.handles.add(handle);
      return () => {
        loop.handles.delete(handle);
      };
    },
    [loop],
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMotion(loop, !query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => {
      query.removeEventListener('change', apply);
      stopLoop(loop);
    };
  }, [loop]);

  const value = useMemo<LiveValue>(() => ({ models, motion, register, wake }), [models, motion, register, wake]);

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

function useLive(): LiveValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error('a live board must be rendered inside LiveBoardsProvider');
  return value;
}

/**
 * Join the section's loop, and step only while this board is both on screen and the open stage.
 *
 * The pinned frame keeps all three stages mounted so it can crossfade between them, so being
 * mounted means nothing: `active` is what decides which one advances, and the observer decides
 * whether anything advances at all. The first paint runs on mount whatever the motion preference
 * is, so a board that never animates still shows a composed frame rather than a seed.
 */
function useBoard(
  rootRef: RefObject<HTMLElement | null>,
  step: (realDt: number) => void,
  paint: () => void,
  active: boolean,
  measure?: () => void,
): void {
  const { register, wake } = useLive();
  const handleRef = useRef<BoardHandle | null>(null);
  const onScreen = useRef(false);
  const activeRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handle: BoardHandle = { visible: false, step, paint };
    handleRef.current = handle;
    const unregister = register(handle);

    measure?.();
    paint();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) onScreen.current = entry.isIntersecting;
        handle.visible = onScreen.current && activeRef.current;
        wake();
      },
      { threshold: 0.12 },
    );
    observer.observe(root);

    let resize: ResizeObserver | null = null;
    if (measure) {
      resize = new ResizeObserver(() => {
        measure();
        paint();
      });
      resize.observe(root);
    }

    return () => {
      observer.disconnect();
      resize?.disconnect();
      unregister();
      handleRef.current = null;
    };
  }, [measure, paint, register, rootRef, step, wake]);

  // Opening a stage is what starts it; closing one stops it on the frame it had reached.
  useEffect(() => {
    activeRef.current = active;
    const handle = handleRef.current;
    if (handle) handle.visible = onScreen.current && active;
    wake();
  }, [active, wake]);
}

/**
 * Every board takes the same three: the eyebrow and heading it carries at the top of its card, and
 * whether it is the stage currently open in the frame.
 */
export interface LiveBoardProps {
  label: string;
  title: string;
  active: boolean;
}

/* ------------------------------------------------------------------ shared bits */

function write(node: Element | null | undefined, text: string): void {
  if (node && node.textContent !== text) node.textContent = text;
}

function flag(node: HTMLElement | null | undefined, name: string, on: boolean): void {
  if (!node) return;
  if (on) {
    if (node.dataset[name] !== 'true') node.dataset[name] = 'true';
  } else if (node.dataset[name]) {
    delete node.dataset[name];
  }
}

function attr(node: Element | null | undefined, name: string, value: string): void {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
}

const all = <T extends Element>(root: ParentNode, selector: string): T[] => [...root.querySelectorAll<T>(selector)];

function BoardHead({ label, title, status }: { label: string; title: string; status: string }) {
  return (
    <header className={styles.head}>
      <div className={styles.headText}>
        <span className="label">{label}</span>
        <p className={styles.title}>{title}</p>
      </div>
      <span className={`mono ${styles.status}`} data-status>
        {status}
      </span>
    </header>
  );
}

/* ------------------------------------------------------------------ mine board */

/** Both clocks say how fast they are running, because neither is a clock on anything real. */
const SIM_LABEL = { mine: 'sped up 60×', flow: 'sped up 900×' } as const;

interface MineNodes {
  status: Element | null;
  cells: HTMLElement[];
  rates: Element[];
  prices: Element[];
  accrued: Element[];
  meters: SVGRectElement[];
  minted: Element | null;
  miners: Element | null;
  onward: Element | null;
  hourly: Element | null;
}

/**
 * Sixteen slots, sixteen clocks. Every cell is one independent descending auction: the ask falls in
 * a straight line to zero across the decay period, and when it is taken the outgoing tenure's GBX
 * mints, 80% of the payment becomes that miner's claim, and the next auction opens at twice what
 * was paid — never under the one-USDG floor.
 */
export function MineBoard({ label, title, active }: LiveBoardProps) {
  const { models } = useLive();
  const mine = models.mine;
  const rootRef = useRef<HTMLDivElement>(null);
  const nodes = useRef<MineNodes | null>(null);

  const collect = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    nodes.current = {
      status: root.querySelector('[data-status]'),
      cells: all<HTMLElement>(root, '[data-cell]'),
      rates: all(root, '[data-rate]'),
      prices: all(root, '[data-price]'),
      accrued: all(root, '[data-accrued]'),
      meters: all<SVGRectElement>(root, '[data-meter]'),
      minted: root.querySelector('[data-minted]'),
      miners: root.querySelector('[data-miners]'),
      onward: root.querySelector('[data-onward]'),
      hourly: root.querySelector('[data-hourly]'),
    };
  }, []);

  const paint = useCallback(() => {
    if (!nodes.current) collect();
    const map = nodes.current;
    if (!map) return;

    mine.slots.forEach((slot, index) => {
      const taken = slot.flash > 0;
      write(map.prices[index], usd(slotPrice(mine, slot)));
      write(map.rates[index], `${slot.tps.toFixed(2)} GBX/s`);
      attr(map.meters[index], 'width', (slotRemaining(mine, slot) * 100).toFixed(2));
      flag(map.cells[index], 'taken', taken);
      write(
        map.accrued[index],
        taken ? `${usd(slot.paidToMiner)} · ${gbxTight(slot.mintedToMiner)} GBX` : `${gbxTight(slot.accrued)} GBX`,
      );
    });

    write(map.status, `${clock(mine.t)} · ${SIM_LABEL.mine}`);
    write(map.minted, gbx(mine.minted));
    write(map.miners, usd(mine.toMiners));
    write(map.onward, usd(mine.toResonance));
    write(map.hourly, gbx(mineHourlyRate(mine)));
  }, [collect, mine]);

  const step = useCallback((delta: number) => stepMine(mine, delta), [mine]);
  useBoard(rootRef, step, paint, active, collect);

  return (
    <div className={styles.board} ref={rootRef}>
      <BoardHead label={label} status={`${clock(mine.t)} · ${SIM_LABEL.mine}`} title={title} />

      <div className={styles.mineGrid}>
        {mine.slots.map((slot, index) => (
          <div className={styles.cell} data-cell key={index}>
            <div className={styles.cellRow}>
              <span className={`mono ${styles.cellId}`}>
                <span className={styles.cellWord}>SLOT </span>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={`mono ${styles.cellAccrued}`} data-accrued>
                {gbxTight(slot.accrued)} GBX
              </span>
            </div>
            <div className={styles.cellRow}>
              <span className={`mono ${styles.cellPrice}`} data-price>
                {usd(slotPrice(mine, slot))}
              </span>
              <span className={`mono ${styles.cellRate}`} data-rate>
                {slot.tps.toFixed(2)} GBX/s
              </span>
            </div>
            <svg aria-hidden="true" className={styles.meter} preserveAspectRatio="none" viewBox="0 0 100 3">
              <rect className={styles.meterTrack} height="3" width="100" x="0" y="0" />
              <rect
                className={styles.meterFill}
                data-meter
                height="3"
                width={(slotRemaining(mine, slot) * 100).toFixed(2)}
                x="0"
                y="0"
              />
            </svg>
          </div>
        ))}
      </div>

      <dl className={styles.tally}>
        <div>
          <dt>GBX minted</dt>
          <dd className="mono" data-minted>
            {gbx(mine.minted)}
          </dd>
        </div>
        <div>
          <dt>Claimable, outgoing miners</dt>
          <dd className="mono" data-miners>
            {usd(mine.toMiners)}
          </dd>
        </div>
        <div>
          <dt>Onward to ResonanceRouter</dt>
          <dd className="mono" data-onward>
            {usd(mine.toResonance)}
          </dd>
        </div>
        <div>
          <dt>GBX per hour, all slots</dt>
          <dd className="mono" data-hourly>
            {gbx(mineHourlyRate(mine))}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ flow board */

interface FlowNodes {
  status: Element | null;
  total: Element | null;
  left: Element | null;
  fan: SVGSVGElement | null;
  arcs: SVGCircleElement[];
  rows: HTMLElement[];
  pcts: Element[];
  weights: Element[];
  curves: SVGPathElement[];
  laneRows: HTMLElement[];
  pots: Element[];
  helds: Element[];
  fills: Element[];
  holds: HTMLElement[];
  dots: SVGCircleElement[];
  hops: SVGCircleElement[][];
}

interface FlowGeometry {
  width: number;
  /** Where each lane meets the auction column, in the fan's own pixel coordinates. */
  laneY: number[];
  sourceY: number;
}

const PARTICLE_POOL = 48;
const HOP_POOL = 4;
/** r = 15.915 makes the ring's circumference exactly 100, so a dash length is a percentage. */
const RING = 100;

/**
 * Resonance streaming USDG out along one lane per Strategy, each lane as thick as that Strategy's
 * share of the signal, into its own auction and then into what Fund holds. Move the weight and the
 * lanes rebalance, because weight is the only thing that decides the split.
 */
export function FlowBoard({ label, title, active }: LiveBoardProps) {
  const { models } = useLive();
  const flow = models.flow;
  const rootRef = useRef<HTMLDivElement>(null);
  const nodes = useRef<FlowNodes | null>(null);
  const geometry = useRef<FlowGeometry>({ width: 60, laneY: [25, 75, 125, 175], sourceY: 100 });

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    nodes.current = {
      status: root.querySelector('[data-status]'),
      total: root.querySelector('[data-total]'),
      left: root.querySelector('[data-left]'),
      fan: root.querySelector<SVGSVGElement>('[data-fan]'),
      arcs: all<SVGCircleElement>(root, '[data-arc]'),
      rows: all<HTMLElement>(root, '[data-row]'),
      pcts: all(root, '[data-pct]'),
      weights: all(root, '[data-weight]'),
      curves: all<SVGPathElement>(root, '[data-curve]'),
      laneRows: all<HTMLElement>(root, '[data-lane]'),
      pots: all(root, '[data-pot]'),
      helds: all(root, '[data-held]'),
      fills: all(root, '[data-fill]'),
      holds: all<HTMLElement>(root, '[data-hold]'),
      dots: all<SVGCircleElement>(root, '[data-dot]'),
      hops: flow.strategies.map((_, lane) => all<SVGCircleElement>(root, `[data-hop="${lane}"]`)),
    };

    const map = nodes.current;
    if (!map.fan || map.laneRows.length === 0) return;

    // One read pass — the fan's box and each lane's box — and then nothing else touches layout.
    const fanBox = map.fan.getBoundingClientRect();
    const rowBoxes = map.laneRows.map((row) => row.getBoundingClientRect());
    const width = Math.max(1, Math.round(fanBox.width));
    const height = Math.max(1, Math.round(fanBox.height));
    geometry.current = {
      width,
      laneY: rowBoxes.map((box) => box.top - fanBox.top + box.height / 2),
      sourceY: height / 2,
    };
    attr(map.fan, 'viewBox', `0 0 ${width} ${height}`);
  }, [flow]);

  const paint = useCallback(() => {
    if (!nodes.current) measure();
    const map = nodes.current;
    if (!map) return;
    const { width, laneY, sourceY } = geometry.current;
    const total = totalWeight(flow);

    // The donut: four shares of one whole, drawn as arcs of a single ring.
    let offset = 0;
    flow.strategies.forEach((strategy, index) => {
      const share = (strategy.weight / total) * RING;
      const arc = map.arcs[index];
      attr(arc, 'stroke-dasharray', `${Math.max(0, share - 1).toFixed(2)} ${(RING - share + 1).toFixed(2)}`);
      attr(arc, 'stroke-dashoffset', (-offset).toFixed(2));
      offset += share;
    });
    write(map.total, `signal · ${gbx(total)} sGBX`);

    flow.strategies.forEach((strategy, index) => {
      const share = strategy.weight / total;
      write(map.pcts[index], `${Math.round(share * 100)}%`);
      write(
        map.weights[index],
        strategy.delta
          ? `${strategy.delta > 0 ? '+' : '−'}${gbx(Math.abs(strategy.delta))} → ${gbx(strategy.weight)} sGBX`
          : `${gbx(strategy.weight)} sGBX`,
      );
      flag(map.rows[index], 'moved', strategy.moved > 0);
      write(map.pots[index], usd(strategy.pot));
      write(map.helds[index], units(strategy.held));
      write(map.fills[index], strategy.flash > 0 ? `+${units(strategy.lastFill)}` : '');
      flag(map.holds[index], 'filled', strategy.flash > 0);

      // A lane is as thick as its share of the stream, which is its share of the signal.
      const y = laneY[index] ?? 0;
      const mid = (width / 2).toFixed(1);
      attr(
        map.curves[index],
        'd',
        `M0 ${sourceY.toFixed(1)} C${mid} ${sourceY.toFixed(1)}, ${mid} ${y.toFixed(1)}, ${width} ${y.toFixed(1)}`,
      );
      attr(map.curves[index], 'stroke-width', (1.5 + share * 14).toFixed(2));
    });

    write(map.left, usd(streamLeft(flow)));
    write(map.status, `week ${Math.max(1, Math.ceil(flow.t / SIGNAL.rewardDurationSeconds))} · ${SIM_LABEL.flow}`);

    // Particles: one pool, repositioned each frame and parked outside the viewBox when unused.
    let slot = 0;
    for (const particle of flow.particles) {
      if (particle.stage !== 1 || slot >= PARTICLE_POOL) continue;
      const dot = map.dots[slot];
      slot += 1;
      const t = Math.max(0, Math.min(1, particle.p));
      const inverse = 1 - t;
      const mid = width / 2;
      const y = laneY[particle.lane] ?? 0;
      attr(dot, 'cx', (3 * inverse * inverse * t * mid + 3 * inverse * t * t * mid + t * t * t * width).toFixed(1));
      attr(dot, 'cy', (inverse * inverse * (inverse + 3 * t) * sourceY + (3 * inverse + t) * t * t * y).toFixed(1));
    }
    for (let index = slot; index < map.dots.length; index += 1) attr(map.dots[index], 'cx', '-20');

    map.hops.forEach((lane, index) => {
      const moving = flow.particles.filter((particle) => particle.stage === 2 && particle.lane === index);
      lane.forEach((dot, position) => {
        const particle = moving[position];
        attr(dot, 'cx', particle ? (Math.max(0, Math.min(1, particle.p)) * 24).toFixed(1) : '-20');
      });
    });
  }, [flow, measure]);

  const step = useCallback(
    (delta: number) => {
      stepFlow(flow, delta);
      animateFlow(flow, delta);
    },
    [flow],
  );

  useBoard(rootRef, step, paint, active, measure);

  const total = totalWeight(flow);
  // The opening frame's ring, laid out here so the arcs are already in place before the first paint.
  const shares = flow.strategies.map((strategy) => (strategy.weight / total) * RING);
  const offsets = shares.map((_, index) => shares.slice(0, index).reduce((sum, share) => sum + share, 0));

  return (
    <div className={styles.board} ref={rootRef}>
      <BoardHead
        label={label}
        status={`week ${Math.max(1, Math.ceil(flow.t / SIGNAL.rewardDurationSeconds))} · ${SIM_LABEL.flow}`}
        title={title}
      />

      <div className={styles.flow}>
        <div className={styles.weights}>
          <div className={styles.donutBlock}>
            <svg
              aria-label="Signal weight, split across four Strategies."
              className={styles.donutRing}
              role="img"
              viewBox="0 0 42 42"
            >
              <circle className={styles.donutTrack} cx="21" cy="21" fill="none" r="15.915" strokeWidth="5" />
              {flow.strategies.map((strategy, index) => {
                const share = shares[index] ?? 0;
                return (
                  <circle
                    className={styles.donutArc}
                    cx="21"
                    cy="21"
                    data-arc={index}
                    data-series={index}
                    fill="none"
                    key={strategy.id}
                    r="15.915"
                    strokeDasharray={`${Math.max(0, share - 1).toFixed(2)} ${(RING - share + 1).toFixed(2)}`}
                    strokeDashoffset={(-(offsets[index] ?? 0)).toFixed(2)}
                    strokeWidth="5"
                    transform="rotate(-90 21 21)"
                  />
                );
              })}
            </svg>
            <span className={`mono ${styles.donutCaption}`} data-total>
              signal · {gbx(total)} sGBX
            </span>
          </div>

          <ul className={styles.weightRows}>
            {flow.strategies.map((strategy, index) => (
              <li className={styles.weightRow} data-row={index} data-series={index} key={strategy.id}>
                <span className={styles.seriesDot} />
                <span className={styles.weightName}>{strategy.name}</span>
                <span className={`mono ${styles.weightPct}`} data-pct={index}>
                  {Math.round((strategy.weight / total) * 100)}%
                </span>
                <span className={`mono ${styles.weightAmount}`} data-weight={index}>
                  {gbx(strategy.weight)} sGBX
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.lanes}>
          <div className={styles.source}>
            <span className={styles.sourceName}>Resonance</span>
            <span className={`mono ${styles.sourceLeft}`} data-left>
              {usd(streamLeft(flow))}
            </span>
            <span className={styles.sourceNote}>left of a {SIGNAL.rewardDurationDays}-day stream</span>
          </div>

          <svg aria-hidden="true" className={styles.fan} data-fan preserveAspectRatio="none" viewBox="0 0 60 200">
            {flow.strategies.map((strategy, index) => (
              <path className={styles.curve} data-curve={index} data-series={index} fill="none" key={strategy.id} />
            ))}
            {Array.from({ length: PARTICLE_POOL }, (_, index) => (
              <circle className={styles.dot} cx="-20" cy="0" data-dot={index} key={index} r="2.1" />
            ))}
          </svg>

          <ul className={styles.laneList}>
            {flow.strategies.map((strategy, index) => (
              <li className={styles.lane} data-lane={index} data-series={index} key={strategy.id}>
                <div className={styles.auction}>
                  <span className={styles.auctionName}>{strategy.name} auction</span>
                  <span className={`mono ${styles.auctionPot}`} data-pot={index}>
                    {usd(strategy.pot)}
                  </span>
                  <span className={styles.auctionNote}>USDG waiting</span>
                </div>

                <svg aria-hidden="true" className={styles.hop} preserveAspectRatio="none" viewBox="0 0 24 8">
                  <line className={styles.hopLine} x1="0" x2="24" y1="4" y2="4" />
                  {Array.from({ length: HOP_POOL }, (_, dot) => (
                    <circle className={styles.hopDot} cx="-20" cy="4" data-hop={index} key={dot} r="1.7" />
                  ))}
                </svg>

                <div className={styles.hold} data-hold={index}>
                  <span className={styles.holdName}>{strategy.name}</span>
                  <span className={`mono ${styles.holdAmount}`} data-held={index}>
                    {units(strategy.held)}
                  </span>
                  <span className={styles.holdNote}>units in Fund</span>
                  <span className={`mono ${styles.holdFill}`} data-fill={index} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ fund board */

interface FundNodes {
  status: Element | null;
  amounts: Element[];
  bars: SVGRectElement[];
  outs: Element[];
  cards: HTMLElement[];
  shares: HTMLElement[];
  receipt: Element | null;
}

const IDLE_RECEIPT =
  'Choose a slice. A redeemer burns GBX, names the assets they want out, and takes that share of each.';

/**
 * What Fund holds, and what a burn takes out of it. Choose a slice of the effective supply and
 * exactly that slice of every holding leaves with it: one ratio, applied to each balance, and
 * nothing anywhere is priced or valued.
 */
export function FundBoard({ label, title, active }: LiveBoardProps) {
  const { models, motion, wake } = useLive();
  const fund = models.fund;
  const rootRef = useRef<HTMLDivElement>(null);
  const nodes = useRef<FundNodes | null>(null);

  const collect = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    nodes.current = {
      status: root.querySelector('[data-status]'),
      amounts: all(root, '[data-amount]'),
      bars: all<SVGRectElement>(root, '[data-bar]'),
      outs: all(root, '[data-out]'),
      cards: all<HTMLElement>(root, '[data-holding]'),
      shares: all<HTMLElement>(root, '[data-share]'),
      receipt: root.querySelector('[data-receipt]'),
    };
  }, []);

  const paint = useCallback(() => {
    if (!nodes.current) collect();
    const map = nodes.current;
    if (!map) return;

    fund.holdings.forEach((holding, index) => {
      write(map.amounts[index], units(holding.amount));
      attr(map.bars[index], 'width', Math.max(0, Math.min(100, (holding.amount / holding.base) * 100)).toFixed(2));
      write(map.outs[index], fund.playing ? `− ${units(holding.leaving * (1 - fund.progress))} leaving` : '');
      flag(map.cards[index], 'paying', fund.playing);
    });

    BURN_SHARES.forEach((share, index) => {
      flag(map.shares[index], 'chosen', Boolean(fund.receipt) && share === fund.share);
    });

    const receipt = fund.receipt;
    write(
      map.receipt,
      receipt
        ? `${(receipt.share * 100).toFixed(2)}% of the effective supply burned returns ${fund.holdings
            .map((holding, index) => `${units(receipt.taken[index] ?? 0)} ${holding.name}`)
            .join(', ')} — the same share of every holding, in one transaction.`
        : IDLE_RECEIPT,
    );
    write(map.status, fund.playing ? 'paying out' : 'holding · waiting for a burn');
  }, [collect, fund]);

  const step = useCallback((delta: number) => stepFund(fund, delta), [fund]);
  useBoard(rootRef, step, paint, active);

  const onBurn = useCallback(
    (share: number) => {
      burn(fund, share, motion());
      paint();
      wake();
    },
    [fund, motion, paint, wake],
  );

  return (
    <div className={styles.board} ref={rootRef}>
      <BoardHead label={label} status="holding · waiting for a burn" title={title} />

      <ul className={styles.vault}>
        {fund.holdings.map((holding, index) => (
          <li className={styles.vaultCard} data-holding={index} key={holding.id}>
            <span className={`mono ${styles.vaultName}`}>{holding.name}</span>
            <span className={`mono ${styles.vaultAmount}`} data-amount={index}>
              {units(holding.amount)}
            </span>
            <span className={styles.vaultNote}>units held</span>
            <svg aria-hidden="true" className={styles.vaultBar} preserveAspectRatio="none" viewBox="0 0 100 4">
              <rect className={styles.vaultTrack} height="4" width="100" x="0" y="0" />
              <rect
                className={styles.vaultFill}
                data-bar={index}
                height="4"
                width={((holding.amount / holding.base) * 100).toFixed(2)}
                x="0"
                y="0"
              />
            </svg>
            <span className={`mono ${styles.vaultOut}`} data-out={index} />
          </li>
        ))}
      </ul>

      <div className={styles.burnRow}>
        <span className="label">Burn a slice of the effective supply</span>
        <div className={styles.burnButtons}>
          {BURN_SHARES.map((share, index) => (
            <button
              className={styles.burnButton}
              data-share={index}
              key={share}
              onClick={() => onBurn(share)}
              type="button"
            >
              {(share * 100).toFixed(2)}%
            </button>
          ))}
        </div>
      </div>

      <p className={`mono ${styles.receipt}`} aria-live="polite" data-receipt>
        {IDLE_RECEIPT}
      </p>
    </div>
  );
}
