# Pitch deck

`gumball6900-deck.html` is a 14-slide deck explaining the protocol end to end, for readers who are
not going to open the whitepaper. **Every mechanism slide is a live simulation** rather than a
diagram: the mine runs sixteen independent reverse Dutch auctions with tenure-locked emission and
halvings, signal weights route a seven-day stream, Strategy auctions fill against a simulated
trader, and redemption pays out against a live supply.

It is a single self-contained file. The brandmark travels as a base64 data URI, so the only external
dependency is Google Fonts. Open it in a browser, host it on any static host, or publish it as a
shareable page.

```bash
open docs/deck/gumball6900-deck.html
```

## How it differs from the other editions

| Edition              | Source                           | Audience                                      |
| -------------------- | -------------------------------- | --------------------------------------------- |
| One-page sheet       | `docs/one-pager/gumball6900/`    | Two minutes, printed or attached              |
| **Deck**             | **`docs/deck/`**                 | **Talked through, or read alone on a screen** |
| Explainer article    | `docs/articles/`                 | Plain-English walkthrough, no Solidity        |
| Technical whitepaper | `docs/whitepapers/gumball-6900/` | Exact mathematics, invariants, threat model   |

## Editing

The deck is hand-written HTML with inline SVG diagrams rather than a build target, because it is
prose and pictures rather than derived figures. Two constraints are worth keeping if you edit it:

- **Slides must fit one viewport.** Nothing is clipped at 1366x640 or wider. The vertical budget is
  tight; check any slide you add.
- **Simulations mirror the contracts, not a canned animation.** The sixteen slots, one-hour decay,
  80/20 handoff, seven-day stream and bounded signaler share all come from the real constants.
  Parameters that production has not selected are labelled illustrative on the slide itself.
- **Define a sim before the visibility observer runs.** The observer only animates on-screen slides;
  a sim declared after it is hoisted as `undefined`, silently never observed, and never paints.
- **Modak is a single-weight face.** It must be set at `font-weight: 400` with `font-synthesis: none`.
  Left to inherit a bold weight, the browser synthesises one, which closes the counters and merges
  the letters into an illegible blob.

## Status claims

The deck states that the protocol is not deployed, not independently audited, that production mining
and pricing parameters are unselected, and that the external governance owner is unselected. Those
are release facts, not modesty: keep them accurate against
`packages/contracts/audit/FINDINGS.md` when the deck is updated.
