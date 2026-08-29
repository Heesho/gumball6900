import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowIcon, StatusChip } from '../../components/ui/primitives';
import { MECHANISMS } from '../../lib/protocol';
import styles from './page.module.css';

/*
 * Auction is an interaction surface, not an explanation. How the mechanism works is told once, on
 * the landing page; this route exists only to say plainly that the surface is not built yet.
 */
const mechanism = MECHANISMS.find((item) => item.slug === 'auction')!;

export const metadata: Metadata = { title: mechanism.name, description: mechanism.summary };

export default function Page() {
  return (
    <div className={`page-head section ${styles.page}`}>
      <div className={`container ${styles.inner}`}>
        <header className={styles.head}>
          <span className="eyebrow">{mechanism.index} · Mechanism</span>
          <h1 className="h1">{mechanism.name}</h1>
          <p className="lede">
            Watching a Strategy&rsquo;s price fall and paying in the asset it acquires will happen here.
          </p>
        </header>

        <div className={`frame ${styles.frame}`}>
          <div className={`card ${styles.card}`}>
            <StatusChip />
            <p className={styles.status}>
              The {mechanism.name} interaction surface is not built yet, and the protocol is not deployed on any
              network, so there is nothing here to connect to.
            </p>
          </div>
        </div>

        <Link className="btn btn-primary" href="/#mechanisms">
          How {mechanism.name} works
          <ArrowIcon />
        </Link>
      </div>
    </div>
  );
}
