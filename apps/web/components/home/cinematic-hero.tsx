'use client';

import { useEffect, useRef, useState } from 'react';

import { AUCTION, GOVERN, HERO, MINE, SIGNAL } from '../../lib/protocol';
import styles from './cinematic-hero.module.css';

/** Air the headline keeps between itself and the boxed film, whether it sits beside it or above it. */
const CLEARANCE = 48;

/** The floating navigation is 56px plus its top margin; nothing may lift above this. */
const NAV_SAFE_AREA = 84;

const POSTER = '/media/gumball6900-cinematic-90s-poster.jpg';
const FILM = '/media/gumball6900-cinematic-90s.mp4';

/* The constants that define the protocol, in the slot the reference gives to partner logos. */
const TICKER = [
  `${MINE.slotCount} permanent slots`,
  `${MINE.initialRate} initial rate`,
  `${MINE.halvingPeriod} halving`,
  `${MINE.tailRate} tail`,
  `${MINE.startingSupply} at genesis`,
  `${SIGNAL.ratio} escrow`,
  `${SIGNAL.rewardDuration} revenue stream`,
  `${AUCTION.fundShare} to Fund`,
  `${GOVERN.actionCount} bounded governance actions`,
  'No team fee',
  'No oracle',
];

/**
 * The opening film.
 *
 * The stage is pinned for the length of the hero. Across it the film clips from full bleed down to
 * a centred square, the ground it was covering is revealed as paper, and the headline lifts clear
 * of the box and recolours from paper to ink. One committed gesture, triggered by scroll and never
 * scrubbed against it.
 */
export function CinematicHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [stillOnly, setStillOnly] = useState(false);

  /*
   * As the film boxes, the sentence opens around it: the first half rises to sit above the picture
   * and the second half drops below it. How far each travels depends on how big the box is at this
   * viewport, which is a clip-path and a scale — neither of which the layout knows about. So both
   * distances are measured here and the stylesheet moves the halves. Guessing walks ink type onto a
   * dark picture: an earlier fixed offset put the "d" of "fund" behind the film at 1024 and painted
   * the whole heading over it on a phone at 1.1:1.
   */
  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const [lead, trail] = [...title.children] as HTMLElement[];
      if (!lead || !trail) return;

      /* Mirrors the clip-path rules in the stylesheet: a square off the height, or off the width below 900. */
      const side = window.innerWidth <= 900 ? 0.64 * window.innerWidth : 0.5035 * window.innerHeight;
      const stage = title.parentElement;
      if (!stage) return;

      /* Everything is measured from the middle of the stage, which is also the middle of the box. */
      const stageBox = stage.getBoundingClientRect();
      const middle = stageBox.top + stageBox.height / 2;
      const leadBox = lead.getBoundingClientRect();
      const trailBox = trail.getBoundingClientRect();

      /*
       * The first half ends a clearance above the top of the box, the second begins the same
       * distance below its bottom — but the first never rises under the fixed navigation, which on
       * a short screen it otherwise would. Losing a little air beats losing the line.
       */
      const rise = leadBox.bottom - middle + side / 2 + CLEARANCE;
      const headroom = leadBox.top - NAV_SAFE_AREA;
      const fall = middle - trailBox.top + side / 2 + CLEARANCE;

      title.style.setProperty('--rise', `${Math.round(Math.max(0, Math.min(rise, headroom)))}px`);
      title.style.setProperty('--fall', `${Math.round(Math.max(0, fall))}px`);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener('resize', schedule);
    if (document.fonts?.ready) void document.fonts.ready.then(schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  /*
   * Autoplay can start after the effect below has run, so the pause is also enforced on the play
   * event itself. Widening a timeout would only hide that race rather than close it.
   */
  const holdIfReduced = () => {
    const video = videoRef.current;
    if (video && !video.paused && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
    }
  };

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');

    /*
     * The stage is pinned, so it stays composited for the length of the hero. Playback is
     * suspended once the page has scrolled past it, and under reduced motion.
     */
    const apply = () => {
      const reduced = query.matches;
      setStillOnly(reduced);
      const video = videoRef.current;
      if (!video) return;
      if (reduced || window.scrollY > window.innerHeight * 1.8) {
        if (!video.paused) video.pause();
      } else if (video.paused) {
        void video.play().catch(() => undefined);
      }
    };

    apply();
    query.addEventListener('change', apply);
    window.addEventListener('scroll', apply, { passive: true });
    return () => {
      query.removeEventListener('change', apply);
      window.removeEventListener('scroll', apply);
    };
  }, []);

  return (
    <section aria-labelledby="hero-title" className={styles.hero} data-film="">
      <div className={styles.stage}>
        <div className={styles.film}>
          <video
            aria-hidden="true"
            autoPlay
            className={styles.video}
            disablePictureInPicture
            loop
            muted
            playsInline
            poster={POSTER}
            onPlay={holdIfReduced}
            preload="metadata"
            ref={videoRef}
            tabIndex={-1}
          >
            <source src={FILM} type="video/mp4" />
          </video>
          <div aria-hidden="true" className={styles.scrim} />
        </div>

        {/*
         * Two spans so the sentence can open around the picture. The space between them is a real
         * text node, so the heading's text and accessible name read "index fund built" rather than
         * "index fundbuilt" whichever way the halves are sitting.
         */}
        <h1 className={styles.title} id="hero-title" ref={titleRef}>
          <span className={styles.titleLead}>{HERO.headlineLead}</span>{' '}
          <span className={styles.titleTrail}>{HERO.headlineTrail}</span>
        </h1>

        <div className={styles.foot}>
          <a className={styles.cue} href="#mechanisms">
            <span>Scroll to explore</span>
            <svg aria-hidden="true" fill="none" viewBox="0 0 16 22">
              <path
                d="M8 1.5v18M2.6 14.4 8 19.8l5.4-5.4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </a>

          <div aria-hidden="true" className={styles.ticker} data-still={stillOnly ? 'true' : 'false'}>
            <div className={styles.tickerTrack}>
              {[0, 1].map((copy) => (
                <ul className={styles.tickerRun} key={copy}>
                  {TICKER.map((item) => (
                    <li className="mono" key={item}>
                      {item}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
