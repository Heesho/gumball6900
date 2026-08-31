'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { AUCTION, CHAPTERS, MINE, SIGNAL, type ChapterSlug } from '../../lib/protocol';
import { FigureNote, SpecList, SpecRow } from '../ui/primitives';
import { Reveal } from '../ui/reveal';
import { FlowBoard, FundBoard, LiveBoardsProvider, MineBoard, type LiveBoardProps } from './live-boards';
import {
  EffectiveSupplyFigure,
  ExitsFigure,
  HalvingLadderFigure,
  RewardCapFigure,
  StreamFigure,
} from './mechanism-figures';
import styles from './mechanism-dashboard.module.css';

interface Panel {
  label: string;
  value: string;
  note?: string;
  figure?: ReactNode;
  detail?: ReactNode;
  /** States what the figure fixes and what it merely illustrates. */
  figureNote?: string;
}

/**
 * The stage's live board: the component, the two lines it heads itself with, and the note that says
 * what in it is a rule and what is illustration. It is a component rather than an element because
 * the pinned frame keeps all three mounted and has to tell each one whether it is the open stage.
 */
interface LivePanel {
  Board: (props: LiveBoardProps) => ReactNode;
  label: string;
  title: string;
  note: string;
}

interface Board {
  slug: ChapterSlug;
  specs: [string, ReactNode][];
  primary: LivePanel;
  /** One or two. A stage takes a second supporting panel only when it has a second thing to say. */
  secondary: readonly Panel[];
}

const BOARDS: Record<ChapterSlug, Omit<Board, 'slug'>> = {
  mine: {
    specs: [
      ['Slots', `${MINE.slotCount}, permanent and independent`],
      ['Taken by', 'Paying the slot’s current asking price in USDG'],
      ['Price', 'Falls in a straight line to zero over one hour'],
      ['Emission', `${MINE.initialRate}, halving every ${MINE.halvingPeriod} to a ${MINE.tailRate} tail`],
      ['Of each payment', `${MINE.outgoingMinerShare} to the outgoing miner, ${MINE.routerShare} onward`],
      [
        'Supply',
        `Constructor: ${MINE.constructorSupply}. No team or discretionary premint; canonical launch adds ` +
          `${MINE.genesisLiquidityIssuance} solely to permanently locked liquidity`,
      ],
    ],
    primary: {
      Board: MineBoard,
      label: 'The mine, simulated',
      title: 'Sixteen slots, sixteen clocks.',
      note:
        'A simulation of the rule, not a record of activity: nothing is deployed, so none of this happened. ' +
        'Exact here are the fall to zero, the 80/20 split, the next ask at twice what was paid, and the ' +
        'rate a tenure locks. Every price and total is invented.',
    },
    /*
     * One panel, the full width of the row. The sixteen slots were drawn twice — a static grid of
     * squares directly under a live grid of sixteen — and the halving is the one thing the board
     * cannot show, because a period is 69 days and the simulation runs an hour a minute.
     */
    secondary: [
      {
        label: 'Prospective global rate',
        value: MINE.initialRate,
        note:
          `Halves at every completed ${MINE.halvingPeriod} — ${MINE.halvingLadder.join(' → ')} GBX/s — reaching ` +
          `the tail on day ${MINE.tailBoundaryDay}. A tenure keeps the rate it was assigned, so a halving ` +
          'never reprices a live one.',
        figure: <HalvingLadderFigure />,
      },
    ],
  },
  resonance: {
    specs: [
      ['Escrow', `GBX locks ${SIGNAL.ratio} as non-transferable ${SIGNAL.receipt}`],
      ['Weight', 'Allocated to a live Strategy in the same call'],
      ['Stream', `${SIGNAL.rewardDuration}, split by weight, moment to moment`],
      ['Each Strategy', 'Sells its USDG for the asset it is mandated to acquire'],
      ['Paid in', 'The target asset itself, never dollars'],
      ['Price oracle', 'None anywhere in the protocol'],
    ],
    primary: {
      Board: FlowBoard,
      label: 'Resonance, simulated',
      title: 'Signal decides the split. Move it and the money follows.',
      note:
        'A simulation of the rule, not a record of activity: no Strategy exists, so these four are ' +
        'placeholders. Exact here are the seven-day stream, its split by signal weight, and the default ' +
        '10% Bribe share. Every amount on the board is invented.',
    },
    secondary: [
      {
        label: 'Revenue stream',
        value: SIGNAL.rewardDuration,
        note: 'One global stream, released moment to moment rather than on a claim schedule.',
        figure: <StreamFigure />,
      },
      {
        label: 'Bribe reward tokens',
        value: String(AUCTION.maxRewardTokens),
        note: 'A fixed ceiling on what a Strategy’s paired Bribe can stream back to signalers.',
        figure: <RewardCapFigure />,
      },
    ],
  },
  fund: {
    specs: [
      ['Holds', 'Raw ERC-20 backing assets'],
      ['Asset registry', 'None. Fund keeps no list of approved assets'],
      ['Ownership', 'None. No roles, no upgrade path, no sweep, no rescue'],
      ['Redeeming', 'Burn GBX and name the assets you want out'],
      ['Payout', 'Pro rata, by the effective GBX supply'],
      ['Valuation', 'None. No NAV, no price, no guarantee'],
    ],
    primary: {
      Board: FundBoard,
      label: 'Redemption, simulated',
      title: 'Burn a slice. Take that slice of everything.',
      note:
        'A simulation of the rule, not a record of holdings: nothing is deployed and Fund holds nothing. ' +
        'Exact here is the payout — floor(balance × gbxAmount ÷ effectiveSupply) — one share of every asset ' +
        'named, and none of any left out. The assets are placeholders and the balances invented.',
    },
    secondary: [
      {
        label: 'The denominator',
        value: 'Effective supply',
        note: 'GBX.totalSupply() plus Mine.pendingEmission(), read before the burn, so emission already earned is never ignored.',
        figure: <EffectiveSupplyFigure />,
      },
      {
        label: 'Ways value leaves Fund',
        value: '2',
        note: 'redeem, and a permissionless burnGBX that burns only Fund’s own balance. There is no third.',
        figure: <ExitsFigure />,
      },
    ],
  },
};

function Panel({ panel, size }: { panel: Panel; size: 'primary' | 'secondary' }) {
  return (
    <article className={`card ${styles.panel}`} data-size={size}>
      <div className={styles.panelHead}>
        <span className="label">{panel.label}</span>
        <span className={styles.panelValue}>{panel.value}</span>
      </div>
      {panel.note ? <p className={styles.panelNote}>{panel.note}</p> : null}
      {(panel.figure ?? panel.detail) ? <div className={styles.panelFigure}>{panel.figure ?? panel.detail}</div> : null}
      {panel.figureNote ? <FigureNote>{panel.figureNote}</FigureNote> : null}
    </article>
  );
}

/**
 * The live board carries its own label, heading and clock, so the panel around it is the card and
 * the note underneath — anything else would be a second header over the top of the instrument.
 */
function BoardPanel({ panel, active }: { panel: LivePanel; active: boolean }) {
  return (
    <article className={`card ${styles.panel}`} data-live="true" data-size="primary">
      <panel.Board active={active} label={panel.label} title={panel.title} />
      <FigureNote>{panel.note}</FigureNote>
    </article>
  );
}

/**
 * The identity column: the active mechanism opens, the rest stay as title rows.
 *
 * This section explains the rules and does nothing else, so it holds no route into the app shells.
 */
function IdentityCard({ slug }: { slug: ChapterSlug }) {
  const mechanism = CHAPTERS.find((item) => item.slug === slug)!;
  const board = BOARDS[slug];

  return (
    <div className={`card ${styles.identityCard}`}>
      <p className={styles.identityLede}>{mechanism.summary}</p>
      <div className={styles.identitySpecs}>
        <SpecList>
          {board.specs.map(([term, value]) => (
            <SpecRow key={term} term={term}>
              {value}
            </SpecRow>
          ))}
        </SpecList>
      </div>
    </div>
  );
}

function TitleCard({ slug, muted, onSelect }: { slug: ChapterSlug; muted?: boolean; onSelect?: () => void }) {
  const mechanism = CHAPTERS.find((item) => item.slug === slug)!;
  return (
    <header className={`card ${styles.titleCard}`} data-muted={muted ? 'true' : undefined}>
      <span className={`mono ${styles.index}`}>{mechanism.index}</span>
      <h3 className={`h3 ${styles.name}`} id={`mechanism-${slug}`}>
        {/* Pinned, the closed stages are the way back to a stage already scrolled past. */}
        {onSelect ? (
          <button
            aria-controls={`mechanism-body-${slug}`}
            aria-expanded={!muted}
            className={styles.nameButton}
            onClick={onSelect}
            type="button"
          >
            {mechanism.name}
          </button>
        ) : (
          mechanism.name
        )}
      </h3>
    </header>
  );
}

/**
 * A stage's panels. `active` reaches the live board rather than the markup: pinned, all three of
 * these are mounted so the frame can crossfade, and only the open one is allowed to run.
 */
function PanelColumn({ slug, active = true }: { slug: ChapterSlug; active?: boolean }) {
  const board = BOARDS[slug];
  return (
    <div className={styles.panelColumn}>
      <BoardPanel active={active} panel={board.primary} />
      {/* auto-fit, so a stage with one supporting panel gets the full width rather than half. */}
      <div className={styles.panelRow}>
        {board.secondary.map((panel) => (
          <Panel key={panel.label} panel={panel} size="secondary" />
        ))}
      </div>
    </div>
  );
}

function accentOf(slug: ChapterSlug) {
  return CHAPTERS.find((item) => item.slug === slug)!.accent === 'pink' ? 'accent-pink' : 'accent-blue';
}

/** One mechanism, laid out on its own. Used when the frame is not pinned. */
function Dashboard({ slug }: { slug: ChapterSlug }) {
  return (
    <Reveal as="section" className={styles.board}>
      <div className={`frame ${styles.frame} ${accentOf(slug)}`}>
        <div className={styles.grid}>
          <div className={styles.identityColumn}>
            <TitleCard slug={slug} />
            <IdentityCard slug={slug} />
          </div>
          <PanelColumn slug={slug} />
        </div>
      </div>
    </Reveal>
  );
}

/**
 * The pinned frame. The frame holds still while the scroll advances the stage inside it, and both
 * halves of that change move together: the identity accordion opens the stage's card while the
 * panel column beside it crossfades to the same stage.
 *
 * Nothing is mounted or unmounted to do it. All three columns are stacked in one grid cell and
 * opacity moves between them, and all three identity cards stay in the tree with the closed ones
 * collapsed to a zero-height row. Anything closed is `inert` and `aria-hidden`, so it is neither
 * tabbable nor announced, and only the open stage is allowed to run its simulation.
 */
function PinnedBoards({ active, onSelect }: { active: number; onSelect: (index: number) => void }) {
  const activeSlug = CHAPTERS[active]!.slug;

  return (
    <div className={`frame ${styles.frame} ${accentOf(activeSlug)}`}>
      <div className={styles.grid}>
        <div className={styles.identityColumn}>
          {CHAPTERS.map((mechanism, index) => {
            const open = index === active;
            return (
              <div className={styles.entry} data-active={open ? 'true' : undefined} key={mechanism.slug}>
                <TitleCard muted={!open} onSelect={() => onSelect(index)} slug={mechanism.slug} />
                <div className={styles.entryBody} data-open={open ? 'true' : undefined}>
                  <div
                    aria-hidden={!open}
                    className={styles.entryBodyInner}
                    id={`mechanism-body-${mechanism.slug}`}
                    inert={!open}
                  >
                    <IdentityCard slug={mechanism.slug} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.panelStack}>
          {CHAPTERS.map((mechanism, index) => (
            <div
              aria-hidden={index !== active}
              className={styles.panelLayer}
              data-active={index === active ? 'true' : undefined}
              inert={index !== active}
              key={mechanism.slug}
            >
              <PanelColumn active={index === active} slug={mechanism.slug} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MechanismDashboard() {
  const [pinned, setPinned] = useState(false);
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Pinning only where the whole frame fits one viewport; everywhere else the four lay out.
    const query = window.matchMedia(
      '(min-width: 1025px) and (min-height: 860px) and (prefers-reduced-motion: no-preference)',
    );
    const apply = () => setPinned(query.matches);
    const frame = requestAnimationFrame(apply);
    query.addEventListener('change', apply);
    return () => {
      cancelAnimationFrame(frame);
      query.removeEventListener('change', apply);
    };
  }, []);

  useEffect(() => {
    if (!pinned) return;
    let frame = 0;

    const read = () => {
      frame = 0;
      const rail = railRef.current;
      if (!rail) return;
      const span = rail.offsetHeight - window.innerHeight;
      if (span <= 0) return;
      const progress = Math.min(1, Math.max(0, -rail.getBoundingClientRect().top / span));
      setActive(Math.min(CHAPTERS.length - 1, Math.floor(progress * CHAPTERS.length)));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [pinned]);

  /*
   * Scrolling is the only thing that moves the frame, so selecting a stage moves the scroll rather
   * than setting state directly. That keeps the rail position and the open stage from disagreeing.
   */
  const select = (index: number) => {
    const rail = railRef.current;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rail) {
      const span = rail.offsetHeight - window.innerHeight;
      const railTop = rail.getBoundingClientRect().top + window.scrollY;
      // Land mid-band so the frame settles on the stage instead of on a boundary between two.
      const target = railTop + (span * (index + 0.5)) / CHAPTERS.length;
      window.scrollTo({ top: Math.round(target), behavior: smooth ? 'smooth' : 'instant' });
      return;
    }
    const heading = document.getElementById(`mechanism-${CHAPTERS[index]!.slug}`);
    heading?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' });
  };

  return (
    <LiveBoardsProvider>
      <section aria-labelledby="mechanisms-title" className={`section ${styles.section}`} id="mechanisms">
        <div className="container">
          <Reveal as="header" className={styles.sectionHead}>
            <div className={styles.sectionHeadTitle}>
              <span className="eyebrow">How it runs</span>
              <h2 className="h2" id="mechanisms-title">
                The three things it does, <span className="quiet">drawn as they would happen.</span>
              </h2>
            </div>
            <div className={styles.sectionHeadAside}>
              <p className="lede">
                Money in, spent on what holders point it at, and out again when you burn. Each board runs that rule sped
                up so you can watch it — none of it is real, because nothing has been deployed.
              </p>
              <ol className={styles.sequence}>
                {CHAPTERS.map((step, index) => (
                  <li
                    className={step.accent === 'pink' ? 'accent-pink' : 'accent-blue'}
                    data-active={pinned && index === active ? 'true' : undefined}
                    key={step.slug}
                  >
                    <button className={styles.sequenceButton} onClick={() => select(index)} type="button">
                      <span className={`mono ${styles.sequenceIndex}`}>{step.index}</span>
                      {step.name}
                      <span className="visually-hidden">— go to this stage</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>

        {pinned ? (
          <div className={styles.rail} ref={railRef}>
            <div className={styles.pinned}>
              <div className="container">
                <PinnedBoards active={active} onSelect={select} />
              </div>
            </div>
          </div>
        ) : (
          <div className="container">
            <div className={styles.boards}>
              {CHAPTERS.map((mechanism) => (
                <Dashboard key={mechanism.slug} slug={mechanism.slug} />
              ))}
            </div>
          </div>
        )}
      </section>
    </LiveBoardsProvider>
  );
}
