'use client';

import { useEffect, useRef, useState } from 'react';

import { ArrowIcon } from '../ui/primitives';
import styles from './finale-section.module.css';

const POSTER = '/media/gumball6900-cinematic-90s-poster.jpg';
const FILM = '/media/gumball6900-cinematic-90s.mp4';
const REPOSITORY = 'https://github.com/Heesho/gumball6900';

/**
 * The bookend.
 *
 * The reference closes on a full-bleed photographic band before the footer. Ours brings the opening
 * film back for the last beat, boxed this time rather than full screen, so the page ends where it
 * began. There is no mailing list to join, so the band asks the reader to go and read instead.
 */
export function FinaleSection() {
  const bandRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;

    /* A second copy of the film is only worth decoding while it is actually on screen. */
    const apply = () => {
      const reduced = query.matches;
      setStill(reduced);
      const video = videoRef.current;
      if (!video) return;
      if (reduced || !visible) {
        if (!video.paused) video.pause();
      } else if (video.paused) {
        void video.play().catch(() => undefined);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible = entry.isIntersecting;
        apply();
      },
      { rootMargin: '120px 0px' },
    );
    observer.observe(band);
    query.addEventListener('change', apply);
    return () => {
      observer.disconnect();
      query.removeEventListener('change', apply);
    };
  }, []);

  return (
    <section aria-labelledby="finale-title" className={`section ${styles.section}`}>
      <div className="container">
        <div className={styles.band} data-still={still ? 'true' : 'false'} data-surface="dark" ref={bandRef}>
          {/* No autoplay attribute: the observer starts it, so `preload="none"` is actually honoured. */}
          <video
            aria-hidden="true"
            className={styles.video}
            disablePictureInPicture
            loop
            muted
            playsInline
            poster={POSTER}
            preload="none"
            ref={videoRef}
            tabIndex={-1}
          >
            <source src={FILM} type="video/mp4" />
          </video>
          <div aria-hidden="true" className={styles.scrim} />

          <div className={styles.copy}>
            <span className="eyebrow">Read it yourself</span>
            <h2 className={`h2 ${styles.title}`} id="finale-title">
              Everything it will ever do <span className="quiet">is already written down.</span>
            </h2>
            <p className={styles.lede}>
              The constants are compiled into the bytecode and the four remaining governance calls are bounded in the
              source. Nothing above needs to be taken on trust.
            </p>
            <div className={styles.actions}>
              <a
                className="btn btn-invert"
                href={`${REPOSITORY}/blob/main/docs/WHITEPAPER.md`}
                rel="noreferrer"
                target="_blank"
              >
                Read the whitepaper
                <ArrowIcon direction="up-right" />
                <span className="visually-hidden">(opens in a new tab)</span>
              </a>
              <a className="btn btn-quiet" href={REPOSITORY} rel="noreferrer" target="_blank">
                Browse the repository
                <ArrowIcon direction="up-right" />
                <span className="visually-hidden">(opens in a new tab)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
