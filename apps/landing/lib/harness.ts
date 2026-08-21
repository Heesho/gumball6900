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
}

const sims: TrackedSim[] = [];
const simByEl = new WeakMap<Element, TrackedSim>();

let io: IntersectionObserver | null = null;
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
  const tracked: TrackedSim = { ...sim, visible: false, lastSeen: 0 };
  sims.push(tracked);
  simByEl.set(tracked.el, tracked);
  if (running) {
    if (reduced()) staticPass(tracked);
    else io?.observe(tracked.el);
  }
  return () => {
    const i = sims.indexOf(tracked);
    if (i !== -1) sims.splice(i, 1);
    simByEl.delete(tracked.el);
    io?.unobserve(tracked.el);
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
  sims.forEach((sim) => io?.observe(sim.el));

  let last = 0;
  const frame = (ts: number) => {
    const dt = last ? Math.min((ts - last) / 1000, 0.1) : 0;
    last = ts;
    sims.forEach((sim) => {
      if (!sim.visible) return;
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
