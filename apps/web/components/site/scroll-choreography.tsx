'use client';

import { useEffect } from 'react';

/**
 * Flips the opening between its two states and lets CSS animate the change.
 *
 * Scroll is a trigger here, not a scrubber: the first movement commits the whole gesture, which
 * runs to completion on its own timing. Scrubbing it against scroll position would let the film
 * park half-clipped with the headline stranded mid-recolour, and there is no state between the two
 * that is worth looking at.
 *
 * Pages without a film hold the settled state. The thresholds differ on the way in and out so a
 * scroll that rests near the boundary cannot flicker between them.
 */
const ENTER = 40;
const EXIT = 8;

export function ScrollChoreography() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let open = root.dataset.opening === 'true';
    let written = false;

    const write = () => {
      frame = 0;
      if (!document.querySelector('[data-film]')) {
        root.dataset.opening = 'true';
        return;
      }
      const y = window.scrollY;
      const next = open ? y > EXIT : y > ENTER;
      if (written && next === open) return;
      open = next;
      written = true;
      root.dataset.opening = String(open);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      delete root.dataset.opening;
    };
  }, []);

  return null;
}
