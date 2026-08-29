import { DEVELOPMENT_STATUS } from '../../lib/protocol';
import { Reveal } from '../ui/reveal';
import styles from './closing-section.module.css';

/**
 * The resolve: the development status, and nothing else.
 *
 * It is designed as a plaque because it is the single most important thing a reader can take away
 * from this site. It used to be preceded by a restated thesis and a row of route cards; both were
 * the page repeating itself, and the routes are in the navigation already.
 */

/** The four release blockers named in DEVELOPMENT_STATUS.body, enumerated so none can be skimmed past. */
const BLOCKERS = [
  'Independent review',
  'Legal and provenance clearance',
  'Final economic parameters',
  'Signed deployment evidence',
] as const;

export function ClosingSection() {
  return (
    <section aria-labelledby="status-title" className={`section ${styles.section}`}>
      <div className="container">
        <Reveal>
          <aside className={styles.status} data-surface="dark">
            <div className={styles.statusMain}>
              <h2 className="eyebrow" id="status-title">
                Development status
              </h2>
              <p className={styles.statusHeadline}>{DEVELOPMENT_STATUS.headline}</p>
              <p className={styles.statusBody}>
                Every number on this site is a constant read from the contract source or a figure labelled as an
                illustration. None of it is live protocol activity, and none of it is an offer, a solicitation, or an
                invitation to commit funds.
              </p>
              <ul className={styles.statusChips}>
                <li className="chip" data-tone="invert">
                  <i aria-hidden="true" className="chip-dot" />
                  Development protocol
                </li>
                <li className="chip" data-tone="invert">
                  Not deployed on any network
                </li>
                <li className="chip" data-tone="invert">
                  No production addresses configured
                </li>
              </ul>
            </div>

            <div className={styles.statusSide}>
              <h3 className="eyebrow">Release blockers</h3>
              <ol className={styles.blockers}>
                {BLOCKERS.map((blocker, position) => (
                  <li key={blocker}>
                    <span className={`mono ${styles.blockerIndex}`}>{String(position + 1).padStart(2, '0')}</span>
                    {blocker}
                  </li>
                ))}
              </ol>
              <p className={styles.statusNote}>
                {DEVELOPMENT_STATUS.governance}{' '}
                <span className={styles.statusNoteEmphasis}>
                  Mine&rsquo;s emission constants are a provisional development candidate pending independent economic
                  review.
                </span>
              </p>
            </div>
          </aside>
        </Reveal>
      </div>
    </section>
  );
}
