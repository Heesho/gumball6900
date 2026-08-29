import Link from 'next/link';

import { MECHANISMS } from '../lib/protocol';
import styles from './status-page.module.css';

export default function NotFound() {
  return (
    <div className={`page-head section ${styles.page}`}>
      <div className={`container ${styles.inner}`}>
        <span className="eyebrow">404</span>
        <h1 className="h1">There is no page here.</h1>
        <p className="lede">The protocol has four mechanisms, and each one has a page. Nothing else exists yet.</p>
        <ul className={styles.routes}>
          {MECHANISMS.map((mechanism) => (
            <li key={mechanism.href}>
              <Link className="btn btn-quiet" href={mechanism.href}>
                <span className="mono">{mechanism.index}</span>
                {mechanism.name}
              </Link>
            </li>
          ))}
        </ul>
        <Link className="btn btn-primary" href="/">
          Back to the start
        </Link>
      </div>
    </div>
  );
}
