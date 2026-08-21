# Build contract — how the page is assembled

The final deliverable is `docs/landing/index.html`, produced by `node docs/landing/src/assemble.mjs`.
The assembler concatenates, in filename order:

```
src/00-head.html          design system: doctype, meta, <title>, Google Fonts link, all base
                          CSS (tokens, type, layout primitives), and the tiny SIMS registry
                          stub (already specified below — keep it verbatim)
src/sections/10-hero.html
src/sections/20-overview.html
src/sections/30-mining.html
src/sections/40-resonance.html
src/sections/50-fund.html
src/sections/60-extras.html
src/sections/70-why.html
src/sections/80-close.html
src/90-harness.html       the shared driver (owned by the lead — do not edit)
```

## Section fragment format

One file, three blocks, all optional except the section element:

```html
<style>
  /* every rule scoped under your section id: #sec-mining ... */
</style>
<section id="sec-mining" class="section" aria-labelledby="sec-mining-h">
  ...markup...
</section>
<script>
(function () {
  'use strict';
  // build DOM refs, define the model, then:
  SIMS.register('mining', {
    el: document.getElementById('sec-mining'),   // observed for visibility
    step: function (dt) { ... },  // dt = simulated seconds this frame (already scaled/clamped)
    paint: function () { ... },
    reset: function () { ... },   // optional; called when scrolled back into view after a long absence
    static: function () { ... }   // optional; called ONCE instead of the loop under prefers-reduced-motion —
                                  // paint a meaningful still (mid-simulation state), never a blank
  });
}());
</script>
```

Rules:

- **Scope everything.** CSS selectors start with your `#sec-*` id (except styles the design
  system already provides — use those first). JS lives in an IIFE. No globals except via
  `SIMS.register`.
- **Never start your own rAF loop, setInterval, or CSS animation that runs unconditionally.**
  The harness owns time. CSS transitions triggered by the harness's class changes are fine.
  A CSS animation is acceptable only if it plays once on entry or is gated by a class the
  harness/IO toggles, and is disabled under `prefers-reduced-motion` (the design system provides
  a global reduced-motion kill switch).
- `step` receives simulated seconds (the harness applies a global time scale you can set per-sim
  via `timeScale` property on the registered object; default 1 real second = 1 simulated second).
- The harness only calls `step`/`paint` while your `el` intersects the viewport.
- Interactive controls (buttons the reader can press) are encouraged where they teach — they must
  be keyboard-reachable, with visible focus, and must also work when the sim is paused.
- The design system's `00-head.html` ends with this stub — section scripts may rely on it:

```html
<script>
  window.SIMS = { list: [], register: function (name, sim) { sim.name = name; this.list.push(sim); } };
</script>
```

## Screenshots (how to look at your own work)

From anywhere:

```
node /private/tmp/claude-501/-Users-hishamel-husseini-Documents-projects-gumball6900--claude-worktrees-gumball6900-landing-page-8c9c91/8feb288d-380d-47e1-9cef-1ef0932f282c/scratchpad/shot.mjs \
  --file docs/landing/index.html --out /path/shot.png \
  --w 1440 --h 900 [--selector "#sec-mining"] [--settle 2000] \
  [--frames 4 --interval 1500] [--reduced-motion] [--full]
```

- `--selector` scrolls that element to the viewport top before shooting.
- `--frames N --interval MS` captures N frames spaced MS apart (out-1.png, out-2.png, …) — use
  this to see your animation actually move.
- `--full` captures the full page height.
- The tool prints any console errors from the page. A build with console errors is not done.

Always assemble (`node docs/landing/src/assemble.mjs`) before shooting; the tool loads the
assembled file, not your fragment. To iterate on just your section, you may also pass your
fragment through a solo assembly: `node docs/landing/src/assemble.mjs --only 30-mining` writes
`docs/landing/preview-30-mining.html` containing head + your section + harness.
