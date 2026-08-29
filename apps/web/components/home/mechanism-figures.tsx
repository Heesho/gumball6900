import type { ReactNode } from 'react';

import { MINE } from '../../lib/protocol';
import styles from './mechanism-figures.module.css';

/**
 * The still figures on the homepage dashboard's supporting panels.
 *
 * Each one draws a rule that exists in the contracts — a fixed count, a halving ladder, a bounded
 * ceiling. None of them plot activity, balances, prices, or returns, because none of that exists.
 * The three stage boards that run are simulations and live in `live-boards.tsx`.
 *
 * All type is HTML. SVG carries shapes only, so nothing scales with the viewBox and nothing has to
 * wrap inside a <text> element.
 */

const WIDE = { width: 720, height: 132 };
/* A full-row plot is stretched to the panel's width, so its box is the shape it is drawn at. */
const ROW = { width: 720, height: 110 };
const COMPACT = { width: 240, height: 84 };
const BAND_HEIGHT = 56;

const PLOT_CLASS = { wide: 'plotWide', compact: 'plotCompact', row: 'plotRow' } as const;

function Plot({
  children,
  label,
  variant = 'wide',
  band = false,
}: {
  children: ReactNode;
  label: string;
  /** `row` is a wide plot on a panel that spans its whole row, so it is allowed to be taller. */
  variant?: 'wide' | 'compact' | 'row';
  /** A band plot is a single short strip rather than a full-height chart. */
  band?: boolean;
}) {
  const box = variant === 'compact' ? COMPACT : variant === 'row' ? ROW : WIDE;
  const boxHeight = band ? BAND_HEIGHT : box.height;
  return (
    <svg
      aria-label={label}
      className={styles[PLOT_CLASS[variant]]}
      data-band={band ? 'true' : undefined}
      // A bar chart is the one plot that should stretch: the bars keep their heights at any width.
      preserveAspectRatio={variant === 'row' ? 'none' : undefined}
      role="img"
      viewBox={`0 0 ${box.width} ${boxHeight}`}
    >
      {children}
    </svg>
  );
}

function Scale({ from, to }: { from: string; to: string }) {
  return (
    <div className={styles.scale}>
      <span className="mono">{from}</span>
      <span className="mono">{to}</span>
    </div>
  );
}

/** Mine — the prospective global rate stepping down through each halving. */
export function HalvingLadderFigure() {
  const ladder = MINE.halvingLadder;
  const { width: w, height: h } = ROW;
  const step = w / ladder.length;

  return (
    <figure className={styles.figure}>
      <Plot label="The prospective global rate halves from 64 GBX per second to a 1 GBX per second tail." variant="row">
        {ladder.map((rate, index) => {
          const barHeight = Math.max(6, (Math.log2(rate) + 1) * (h / 7.4));
          return (
            <rect
              className={index === ladder.length - 1 ? styles.barTail : styles.barBlue}
              height={barHeight}
              key={rate}
              rx="2"
              width={step - 40}
              x={index * step}
              y={h - barHeight}
            />
          );
        })}
      </Plot>
      <Scale from="64 GBX/s" to="tail 1" />
    </figure>
  );
}

/** Signal — one GBX in, one non-transferable receipt out, allocated on the same call. */
export function EscrowFigure() {
  return (
    <figure className={styles.figure}>
      <div className={styles.flowHead}>
        <span className="mono">GBX</span>
        <span className="mono">sGBX</span>
        <span className="mono">Strategy weight</span>
      </div>
      <Plot
        band
        label="GBX enters escrow one for one as non-transferable sGBX, which is allocated to a live Strategy in the same call."
      >
        <rect className={styles.trackNeutral} height="40" rx="5" width="196" x="0" y="8" />
        <path className={styles.connector} d="M204 28h56" vectorEffect="non-scaling-stroke" />
        <rect className={styles.trackBlue} height="40" rx="5" width="196" x="266" y="8" />
        <path className={styles.connector} d="M470 28h56" vectorEffect="non-scaling-stroke" />
        {(
          [
            [86, 532],
            [62, 626],
            [42, 696],
          ] as const
        ).map(([barWidth, x]) => (
          <rect className={styles.trackBlueSoft} height="40" key={x} rx="5" width={barWidth} x={x} y="8" />
        ))}
      </Plot>
      <figcaption className={styles.legend}>
        <span className={styles.swatchBlue} />
        One-for-one, non-transferable, allocated in the same transaction
      </figcaption>
    </figure>
  );
}

/** Signal — the single seven-day stream, released moment to moment rather than in daily drops. */
export function StreamFigure() {
  const w = COMPACT.width;
  const band = { y: 12, height: 26 };

  return (
    <figure className={styles.figure} data-compact="true">
      <Plot
        band
        label="One continuous seven-day revenue stream, released moment to moment rather than in daily instalments."
        variant="compact"
      >
        <rect className={styles.barBlue} height={band.height} rx="4" width={w} x="0" y={band.y} />
        <g className={styles.dayTicks}>
          {[1, 2, 3, 4, 5, 6].map((day) => (
            <line
              key={day}
              vectorEffect="non-scaling-stroke"
              x1={(w / 7) * day}
              x2={(w / 7) * day}
              y1={band.y + band.height + 3}
              y2={band.y + band.height + 8}
            />
          ))}
        </g>
      </Plot>
      <Scale from="day 1" to="day 7" />
    </figure>
  );
}

/** Auction — the sixteen-token ceiling on any Bribe. */
export function RewardCapFigure() {
  return (
    <figure className={styles.figure} data-compact="true">
      <Plot
        label="A Bribe supports at most sixteen reward tokens; the Strategy's own payment token occupies the first."
        variant="compact"
      >
        {Array.from({ length: 16 }, (_, index) => (
          <circle
            className={index === 0 ? styles.dotFilled : styles.dot}
            cx={11 + (index % 8) * 31}
            cy={index < 8 ? 26 : 62}
            key={index}
            r="9"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </Plot>
      <Scale from="payment token" to="15 open" />
    </figure>
  );
}

/** Govern — the whole continuing authority surface, drawn against what is absent. */
export function AuthorityFigure() {
  const present = ['Add Strategy', 'Kill Strategy', 'Add Bribe token', 'Set Bribe rate'];
  const absent = ['proxy', 'pause', 'upgrade', 'rescue', 'executor', 'emission setter'];

  return (
    <figure className={styles.figure}>
      <div className={styles.authority}>
        <div>
          <p className={styles.authorityHead}>
            <span className={styles.swatchPink} />4 bounded actions
          </p>
          <ul className={styles.authorityList}>
            {present.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className={styles.authorityHead}>
            <span className={styles.swatchVoid} />
            Absent from the core
          </p>
          <ul className={styles.authorityList} data-void="true">
            {absent.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  );
}

/** Govern — how many core contracts carry no owner at all. */
export function OwnershipFigure() {
  const { width: w, height: h } = COMPACT;
  const step = w / 8;

  return (
    <figure className={styles.figure} data-compact="true">
      <Plot
        label="Seven core contracts are ownerless; Resonance is the only one with continuing owner authority."
        variant="compact"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <rect
            className={index === 7 ? styles.blockOwned : styles.blockFree}
            height={h - 16}
            key={index}
            rx="4"
            vectorEffect="non-scaling-stroke"
            width={step - 8}
            x={1 + index * step}
            y="9"
          />
        ))}
        <line className={styles.baseline} vectorEffect="non-scaling-stroke" x1="0" x2={w} y1={h} y2={h} />
      </Plot>
      <Scale from="7 ownerless" to="1 owner" />
    </figure>
  );
}

/** Govern — the four bounded calls, and the empty place where an executor is not yet chosen. */
export function UnresolvedExecutorFigure() {
  const w = COMPACT.width;

  return (
    <figure className={styles.figure} data-compact="true">
      <Plot
        band
        label="Four bounded calls exist; the executor that would sit in front of them has not been selected."
        variant="compact"
      >
        {[0, 1, 2, 3].map((index) => (
          <rect
            className={styles.callBlock}
            height="26"
            key={index}
            rx="3"
            vectorEffect="non-scaling-stroke"
            width="18"
            x={1 + index * 24}
            y="12"
          />
        ))}
        <path className={styles.connector} d="M96 25h18" vectorEffect="non-scaling-stroke" />
        <rect
          className={styles.vacancy}
          height="26"
          rx="4"
          vectorEffect="non-scaling-stroke"
          width={w - 122}
          x="120"
          y="12"
        />
      </Plot>
      <Scale from="4 calls" to="no executor" />
    </figure>
  );
}

/** Fund — the denominator includes emission that has been earned but not yet minted. */
export function EffectiveSupplyFigure() {
  const { width: w } = COMPACT;

  return (
    <figure className={styles.figure} data-compact="true">
      <Plot
        band
        label="The redemption denominator is minted supply plus emission already earned by miners."
        variant="compact"
      >
        <rect className={styles.trackNeutral} height="26" rx="4" width={w * 0.74} x="0" y="12" />
        <rect className={styles.trackAccent} height="26" rx="4" width={w * 0.26 - 3} x={w * 0.74 + 3} y="12" />
      </Plot>
      <Scale from="minted" to="earned, unminted" />
    </figure>
  );
}

/** Fund — the only two ways value leaves. */
export function ExitsFigure() {
  const { width: w } = COMPACT;

  return (
    <figure className={styles.figure} data-compact="true">
      <Plot band label="Value leaves Fund through exactly two functions and no third." variant="compact">
        {[0, 1].map((index) => (
          <rect
            className={styles.callBlock}
            height="26"
            key={index}
            rx="4"
            vectorEffect="non-scaling-stroke"
            width={w * 0.36}
            x={index * (w * 0.4)}
            y="12"
          />
        ))}
        <rect
          className={styles.vacancy}
          height="26"
          rx="4"
          vectorEffect="non-scaling-stroke"
          width={w * 0.18}
          x={w * 0.8}
          y="12"
        />
      </Plot>
      <Scale from="redeem · burnGBX" to="no third" />
    </figure>
  );
}
