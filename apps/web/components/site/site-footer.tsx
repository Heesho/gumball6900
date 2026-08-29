import Image from 'next/image';
import Link from 'next/link';

import { DEVELOPMENT_STATUS, MECHANISMS } from '../../lib/protocol';
import { ArrowIcon } from '../ui/primitives';
import styles from './site-footer.module.css';

const DISCLOSURE = [
  DEVELOPMENT_STATUS.body,
  DEVELOPMENT_STATUS.governance,
  'Mine\u2019s emission constants are a provisional development candidate pending independent economic review.',
  'Every figure on this site is a source constant or a labelled illustration, never live protocol activity.',
].join(' ');

const CONTRACTS = [
  { name: 'Mine', note: 'Sixteen tenure-locked issuance slots' },
  { name: 'SignalGBX', note: 'Non-transferable one-for-one escrow' },
  { name: 'Resonance', note: 'Seven-day USDG revenue stream' },
  { name: 'Strategy', note: 'Bounded descending-price acquisition' },
  { name: 'Bribe', note: 'Per-Strategy reward streams, sixteen tokens' },
  { name: 'Fund', note: 'Ownerless raw-token treasury' },
];

export function SiteFooter() {
  return (
    <footer className={styles.footer} data-surface="dark">
      <div className={`container ${styles.inner}`}>
        <div className={styles.top}>
          <div className={styles.identity}>
            <Image
              alt=""
              aria-hidden="true"
              className={styles.mark}
              height={52}
              src="/brand/gumball6900-mark.png"
              width={52}
            />
            <p className={styles.identityCopy}>
              An onchain index fund built by its holders. Mine GBX, signal what the Fund should acquire, and redeem the
              assets it holds.
            </p>
          </div>

          <nav aria-label="Footer" className={styles.column}>
            <h2 className="eyebrow">Mechanisms</h2>
            <ul>
              {MECHANISMS.map((mechanism) => (
                <li key={mechanism.href}>
                  <Link className={styles.link} href={mechanism.href}>
                    {mechanism.name}
                    <ArrowIcon direction="up-right" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.column}>
            <h2 className="eyebrow">Core contracts</h2>
            <ul>
              {CONTRACTS.map((contract) => (
                <li className={styles.contract} key={contract.name}>
                  <span className={styles.contractName}>{contract.name}</span>
                  <span className={styles.contractNote}>{contract.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.disclosure}>
          <h2 className={styles.disclosureTitle}>{DEVELOPMENT_STATUS.headline}</h2>
          {/* One expression: JSX trims whitespace at line breaks, which silently welds sentences together. */}
          <p className={styles.disclosureBody}>{DISCLOSURE}</p>
        </div>

        <div className={styles.baseline}>
          <span className="mono">GumBall6900 — development protocol</span>
          <span className="mono">Not deployed on any network</span>
        </div>
      </div>

      <p aria-hidden="true" className={styles.wordmark}>
        GumBall6900
      </p>
    </footer>
  );
}
