import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

import styles from './primitives.module.css';

export function ArrowIcon({ direction = 'right' }: { direction?: 'right' | 'up-right' | 'down' }) {
  const paths = {
    right: 'M3.5 10h13M12 5.2 16.8 10 12 14.8',
    'up-right': 'M6 14 14 6M6.6 6H14v7.4',
    down: 'M10 3.5v13M5.2 12 10 16.8 14.8 12',
  } as const;

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d={paths[direction]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

/** The small monospace kicker that opens a section, matching the editorial reference grammar. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

interface SectionHeadProps {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: 'start' | 'center';
  level?: 'h2' | 'h3';
  actions?: ReactNode;
  /** Lets the surrounding section name itself with aria-labelledby instead of a duplicate label. */
  titleId?: string;
}

export function SectionHead({
  eyebrow,
  title,
  lede,
  align = 'start',
  level = 'h2',
  actions,
  titleId,
}: SectionHeadProps) {
  const Heading = level as ElementType;

  return (
    <header className={styles.head} data-align={align} data-split={lede && align === 'start' ? 'true' : undefined}>
      <div className={styles.headTitle}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading className="h2" id={titleId}>
          {title}
        </Heading>
      </div>
      {lede || actions ? (
        <div className={styles.headAside}>
          {lede ? <p className="lede">{lede}</p> : null}
          {actions ? <div className={styles.headActions}>{actions}</div> : null}
        </div>
      ) : null}
    </header>
  );
}

/**
 * A metric is a label plus a figure. It never carries a unit of live protocol activity —
 * only constants that exist in the contracts.
 */
export function Metric({
  label,
  value,
  note,
  size = 'md',
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className={styles.metric} data-size={size}>
      <span className="label">{label}</span>
      <span className={styles.metricValue}>{value}</span>
      {note ? <span className={styles.metricNote}>{note}</span> : null}
    </div>
  );
}

/** A definition row: the compact key/value line used inside dense specification cards. */
export function SpecRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={styles.specRow}>
      <dt className="label">{term}</dt>
      <dd className={styles.specValue}>{children}</dd>
    </div>
  );
}

export function SpecList({ children }: { children: ReactNode }) {
  return <dl className={styles.specList}>{children}</dl>;
}

export function StatusChip({ tone = 'pink' }: { tone?: 'pink' | 'invert' }) {
  return (
    <span className="chip" data-tone={tone}>
      <i aria-hidden="true" className="chip-dot" />
      Development protocol
    </span>
  );
}

type CardProps = ComponentPropsWithoutRef<'div'> & { as?: ElementType };

export function Card({ as: Tag = 'div', className, ...rest }: CardProps) {
  return <Tag className={['card', className].filter(Boolean).join(' ')} {...rest} />;
}

type FrameProps = ComponentPropsWithoutRef<'div'> & { as?: ElementType };

export function Frame({ as: Tag = 'div', className, ...rest }: FrameProps) {
  return <Tag className={['frame', className].filter(Boolean).join(' ')} {...rest} />;
}

/** A footnote that keeps an illustrative figure honestly labelled. */
export function FigureNote({ children }: { children: ReactNode }) {
  return <p className={styles.figureNote}>{children}</p>;
}
