/**
 * Shared simulation driver — the React port of the page's single-rAF harness.
 *
 * One requestAnimationFrame loop for the whole page; an IntersectionObserver
 * pauses off-screen sims; prefers-reduced-motion swaps the loop for a single
 * meaningful static pass. Sections register their sim from a layout effect and
 * unregister on cleanup, which keeps registration idempotent under React
 * StrictMode's double-invoked effects.
 */

export interface Sim {
  name: string;
  /** Observed for visibility; step/paint only run while it intersects. */
  el: HTMLElement;
  /** dt is simulated seconds this frame (real dt × timeScale, clamped). */
  step?: (dt: number) => void;
  paint?: () => void;
  /** Called when scrolled back into view after a long absence. */
  reset?: () => void;
  /** Under prefers-reduced-motion: paint a meaningful mid-simulation still. */
  static?: () => void;
  timeScale?: number;
}

interface TrackedSim extends Sim {
  visible: boolean;
  lastSeen: number;
  /**
   * Latched the first time this sim is genuinely on screen — at least one
   * pixel inside the real viewport, not the 80px pre-warm band below. Until
   * then its clock is held at zero.
   *
   * Sections pass their panel rather than their <section> (see Fund.tsx), so
   * on a normal desktop the panel is hundreds of pixels below the fold and
   * this never comes up. But that clearance is a layout accident: the hero
   * stops growing past ~1024px, so from about 1500px of viewport height the
   * overview panel slides up into the warm band with zero pixels showing. At
   * 1440x1540 and 2560x1540 — an ordinary maximised window on a tall display —
   * an ungated harness drew 645k canvas ops in 20s while the reader was still
   * on the hero, and then greeted them on beat 03, the burn, or beat 02
   * depending how long they had read. Numbered beats that have already run are
   * not an explanation. This makes "nothing runs before it is seen" a property
   * of the driver instead of a property of this month's spacing.
   */
  seen: boolean;
}

const sims: TrackedSim[] = [];
const simByEl = new WeakMap<Element, TrackedSim>();

let io: IntersectionObserver | null = null;
let seenIo: IntersectionObserver | null = null;
let revealIo: IntersectionObserver | null = null;
let rafId = 0;
let running = false;
let reducedMql: MediaQueryList | null = null;

function reduced(): boolean {
  if (!reducedMql) reducedMql = window.matchMedia('(prefers-reduced-motion: reduce)');
  return reducedMql.matches;
}

function staticPass(sim: TrackedSim): void {
  try {
    if (sim.static) sim.static();
    else {
      if (sim.step) sim.step(0);
      if (sim.paint) sim.paint();
    }
  } catch (err) {
    console.error(`sim ${sim.name} static failed`, err);
  }
}

/**
 * Register a sim. Call from a layout effect; call the returned function on
 * cleanup. Safe to call before or after the harness starts.
 */
export function registerSim(sim: Sim): () => void {
  const tracked: TrackedSim = { ...sim, visible: false, lastSeen: 0, seen: false };
  sims.push(tracked);
  simByEl.set(tracked.el, tracked);
  if (running) {
    if (reduced()) staticPass(tracked);
    else {
      io?.observe(tracked.el);
      seenIo?.observe(tracked.el);
    }
  }
  return () => {
    const i = sims.indexOf(tracked);
    if (i !== -1) sims.splice(i, 1);
    simByEl.delete(tracked.el);
    io?.unobserve(tracked.el);
    seenIo?.unobserve(tracked.el);
  };
}

/**
 * Start the page-wide driver (sims + .reveal entrances). Returns a teardown.
 * Idempotent enough for StrictMode: teardown fully cancels the loop and
 * observers, and a restart re-observes everything currently registered.
 */
export function startHarness(): () => void {
  running = true;

  // --- entrances: one-time observer that adds .is-in and unobserves --------
  const revealEls = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
  if (reduced() || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    revealIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            revealIo?.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    revealEls.forEach((el) => {
      if (!el.classList.contains('is-in')) revealIo?.observe(el);
    });
  }

  // --- sims ----------------------------------------------------------------
  const onReducedChange = (event: MediaQueryListEvent) => {
    if (event.matches) {
      sims.forEach((sim) => {
        sim.visible = false;
        staticPass(sim);
      });
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
    }
  };

  if (reduced()) {
    sims.forEach(staticPass);
    reducedMql?.addEventListener('change', onReducedChange);
    return () => {
      running = false;
      revealIo?.disconnect();
      revealIo = null;
      reducedMql?.removeEventListener('change', onReducedChange);
    };
  }

  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const sim = simByEl.get(entry.target);
        if (!sim) return;
        if (entry.isIntersecting) {
          if (sim.reset && sim.lastSeen && performance.now() - sim.lastSeen > 30000) {
            try {
              sim.reset();
            } catch (err) {
              console.error(`sim ${sim.name} reset failed`, err);
            }
          }
          sim.visible = true;
        } else {
          sim.visible = false;
          sim.lastSeen = performance.now();
        }
      });
    },
    { rootMargin: '80px 0px' },
  );

  /* The 80px band above is a warm *resume*: it lets a sim already known to the
     reader be running by the time it scrolls back in. It must not be what
     starts a sim's clock, or a section sitting flush against the fold runs
     unwatched. This second observer answers the stricter question — has this
     sim ever actually been on screen? — against the real viewport, shrunk by
     1px at the bottom so an element merely touching the fold does not count.
     It latches once and unobserves, so it costs nothing after first sight. */
  seenIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const sim = simByEl.get(entry.target);
        if (sim) sim.seen = true;
        seenIo?.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -1px 0px' },
  );

  sims.forEach((sim) => {
    io?.observe(sim.el);
    if (!sim.seen) seenIo?.observe(sim.el);
  });

  let last = 0;
  const frame = (ts: number) => {
    const dt = last ? Math.min((ts - last) / 1000, 0.1) : 0;
    last = ts;
    sims.forEach((sim) => {
      if (!sim.visible || !sim.seen) return;
      try {
        if (sim.step) sim.step(dt * (sim.timeScale ?? 1));
        if (sim.paint) sim.paint();
      } catch (err) {
        console.error(`sim ${sim.name} failed`, err);
        sim.visible = false; // quarantine a throwing sim instead of spamming
      }
    });
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);
  reducedMql?.addEventListener('change', onReducedChange);

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    io?.disconnect();
    io = null;
    seenIo?.disconnect();
    seenIo = null;
    revealIo?.disconnect();
    revealIo = null;
    reducedMql?.removeEventListener('change', onReducedChange);
    sims.forEach((sim) => {
      sim.visible = false;
    });
  };
}

/** Resolve a font token (e.g. '--font-mono') to a canvas-usable family list. */
export function fontFamily(token: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}
