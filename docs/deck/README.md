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
- **Simulations mirror the contracts, not a canned animation.** The exactly sixteen slots, one-hour decay,
  80/20 occupied-slot replacement split (100% deposited on first occupation), Mine/Router failure isolation, Router restart
  threshold, seven-day stream,
  old-weight checkpointing, and bounded global signaler share all come from the real contract behavior.
  Mine's 2x reset, 1 USDG floor, 64 GBX/s initial rate, 69-day eras, and 1 GBX/s tail are fixed
  development constants pending independent economic review. Simulated asset prices and revenue sizes are illustrative.
  The flow animation models an optional unprivileged cron caller; the protocol itself assigns no routing role or bounty,
  and Mine never calls `route()`.
- **Define a sim before the visibility observer runs.** The observer only animates on-screen slides;
  a sim declared after it is hoisted as `undefined`, silently never observed, and never paints.
- **No controls.** Every simulation runs itself. The deck is watched, not operated, so there are no
  buttons or sliders to discover, and nothing is hidden behind an interaction a reader may not make.
- **Modak is a single-weight face.** It must be set at `font-weight: 400` with `font-synthesis: none`.
  Left to inherit a bold weight, the browser synthesises one, which closes the counters and merges
  the letters into an illegible blob.

## Status claims

The deck states that the protocol is not deployed or independently audited, that Mine's fixed development economics
still need independent review, and that the external governance executor is unselected. It also preserves the
production obligation to transfer Resonance and renounce the three consumed setup-only Ownable shells. Those
are release facts, not modesty: keep them accurate against
`packages/contracts/audit/FINDINGS.md` when the deck is updated.
