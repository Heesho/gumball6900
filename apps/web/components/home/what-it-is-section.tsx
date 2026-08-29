import { SectionHead } from '../ui/primitives';
import { Reveal } from '../ui/reveal';
import styles from './what-it-is-section.module.css';

/**
 * The opening beat of the argument, and the first thing a reader meets after the film.
 *
 * It is written for somebody who has never used a blockchain: the plainest available statement of
 * what the thing is, then four claims. Two of them carry an accent because they are the two a
 * sceptic actually tests — who decides what it buys, and whether they can get their money out.
 */

interface Claim {
  index: string;
  title: string;
  body: string;
  accent?: 'pink' | 'blue';
}

const CLAIMS: readonly Claim[] = [
  {
    index: '01',
    title: 'It is a fund',
    body: 'One pot of real assets. Hold a hundredth of the tokens and you own a hundredth of the pot.',
  },
  {
    index: '02',
    title: 'Holders decide what it buys',
    body: 'Anyone in charge can only add a candidate to the list, or strike one off. How much each one gets is settled by the holders who back it.',
    accent: 'blue',
  },
  {
    index: '03',
    title: 'It only ever adds',
    body: 'Income is turned into assets through open auctions. Nothing is ever sold, and nobody reshuffles the pot.',
  },
  {
    index: '04',
    title: 'You can always leave',
    body: 'Burn your tokens and your share arrives in the same instant. No queue, no approval, nothing to apply for.',
    accent: 'pink',
  },
];

export function WhatItIsSection() {
  return (
    <section aria-labelledby="what-it-is-title" className={`section ${styles.section}`} id="what-it-is">
      <div className="container">
        <Reveal>
          <div className={styles.headWrap}>
            <SectionHead
              eyebrow="What it is"
              lede="One pot of assets. One token, GBX, that is a share of it. The fund earns money, spends it on whatever its holders point it at, and never sells."
              title={
                <>
                  A fund of real assets, <span className="quiet">chosen by the people who own it.</span>
                </>
              }
              titleId="what-it-is-title"
            />
          </div>
        </Reveal>

        <Reveal>
          <div className={`frame ${styles.frame}`}>
            <ul className={styles.cards}>
              {CLAIMS.map((claim) => (
                <li
                  className={`card ${styles.card} ${claim.accent ? `accent-${claim.accent}` : ''}`.trim()}
                  data-accent={claim.accent ?? undefined}
                  key={claim.index}
                >
                  <span aria-hidden="true" className={`mono ${styles.index}`}>
                    {claim.index}
                  </span>

                  <h3 className={`h4 ${styles.cardTitle}`}>{claim.title}</h3>
                  <p className={styles.cardBody}>{claim.body}</p>
                </li>
              ))}
            </ul>

            {/* The first section cannot be read as describing something already running. */}
            <p className={styles.note}>For now this is a design. The code is written; it has not been deployed.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
