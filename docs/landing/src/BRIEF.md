# GumBall6900 landing page — shared brief

Every builder and critic reads this first. It is the ground truth. If you need a figure that is
not here, read the Solidity in `packages/contracts/src/core` — never guess.

## The goal

A single-page marketing site for **GumBall6900**: an onchain index fund that holds real tokenized
assets, where the people holding the token decide what it buys, and any holder can burn their
tokens to withdraw their share of the actual holdings.

The page must be **beautiful, on-brand, and genuinely explanatory**. A smart person who knows
nothing about the protocol should finish it understanding how mining, Resonance, and the Fund
actually work — because they **watched each mechanism run**, not because they read a description.

One self-contained HTML file, inline CSS and JS. No build step, no framework, no external
requests except Google Fonts.

## The bar (what "good" means)

1. **ciechanow.ski** — the bar for explaining a mechanism with animation. Every animation is the
   argument, not decoration; each isolates exactly one idea; prose stops when the animation takes
   over; nothing loops decoratively in the background competing for attention.
2. **stripe.com** — the bar for typographic craft and restraint in a financial context. Type
   hierarchy does the work, whitespace is generous, colour is sparse and always means something.
3. **linear.app** — the bar for dark-theme polish and motion feel. Fast, purposeful easing;
   restrained palette.
4. **`docs/deck/gumball6900-deck.html`** — the internal bar. Five working, contract-accurate
   simulations live in its `<script>` (roughly lines 1180–1960). **Do not rewrite the models from
   scratch — lift them and improve the presentation.** The models are correct; the deck's layout
   is merely adequate.

The bar is a standard of craft, not content to copy. Do not reproduce anyone's copy, layout,
illustrations, or branding.

## Brand

From `docs/whitepaper/src/theme.mjs`:

```
pink    #F92B92     primary accent
blue    #29B6F0     secondary accent
black   #0C0C0C     ground
white   #FFFFFF
```

Dark theme. Neutrals must be biased a few degrees toward blue so they read as chosen, not
default grey. Wordmark face is **Modak** (Google Fonts). Body/UI face: the design system picks it
— but not Inter and not Space Grotesk. The brand logo (a gumball machine) is available at
`src/assets/logo320.png` / `logo512.png`; usage is the hero builder's call.

Colour meaning (from the whitepaper's diagram grammar — keep it): **blue = USDG capital arriving**,
**pink = signal and what it buys**, neutral/white = GBX supply and burns.

## The protocol — ground truth, never invent

- **GBX** is the token. It exists exactly two ways: a single **20,000,000** allocation at
  deployment into permanently locked market liquidity, and issuance to miners after that. No team
  allocation, no presale, no discretionary mint. Mint authority passes to the Mine once and locks.
- **Mining.** **Sixteen** permanent slots. Every slot is always for sale; its price falls in a
  straight line to zero over **one hour** and restarts when taken. Taking an occupied slot pays
  **80%** to the displaced miner and **20%** to the fund's buying power; an untaken slot routes
  **100%**. Your issuance rate is fixed for your whole tenure. Mining is where the fund's money
  comes from — miners pay USDG, and that USDG is what gets spent.
- **Signalling.** Deposit GBX, receive a non-transferable receipt, point it at one Strategy, all
  in one transaction. No idle state. Withdraw any time; no lock-up.
- **Resonance.** Revenue is released as a rolling **seven-day** stream and split by live signal
  weights, moment to moment. It goes to each **Strategy** as USDG — not straight to assets.
- **Acquisition.** Each Strategy pools its USDG and sells the whole lot in a falling-price
  auction, asking to be paid **in the target asset itself, never in dollars**. The lot keeps
  growing during the auction. A trader fills when the ask drops to what the lot is worth.
  **No oracle exists anywhere in the protocol.**
- **The split.** The signaler share defaults to **10%**, bounded in code to a **20% maximum**, so
  the treasury always receives **at least 80%**. It is the only economic parameter anyone can
  change, applies to later purchases only, and where each share goes cannot be changed at all.
- **The Fund.** Ownerless. No registry, no roles, no upgrade path, no rescue. Assets leave one
  way: a holder burns GBX and takes their share.
- **Redemption.** Burn any amount at any time and receive that same proportion of every holding,
  in the tokens themselves, in one transaction.
- **Authority.** Ten contracts have no owner. One — Resonance — has four powers: add a Strategy,
  retire a Strategy, register a reward token, set the signaler share within its bound. It can
  never retire the last Strategy. **Who holds that address has not been decided.**
- **What it can hold.** Any ERC-20: blue-chip crypto (WBTC, WETH), tokenized equities (AAPL,
  NVDA, TSLA, QQQ, SPCX), long-tail ecosystem tokens, LP positions that are themselves ERC-20s.

## Honesty — non-negotiable; a critic must fail the page for breaking it

- **Not deployed on any network. Not independently audited.** Must appear in the hero AND the
  close, not buried.
- Production mining and pricing parameters are **unselected**. Any figure shown in an animation
  is illustrative and must be labelled as such in the section where it appears.
- The external governance owner is **unselected**. Do not imply a DAO exists.
- **Robinhood Chain is the intended target, not a commitment.** Never state it as settled.
- Never call it an ETF or a regulated fund product. "Index fund" is the brand's own language and
  is fine. Legal treatment is unresolved.
- No price predictions, no yield figures, no "returns." The NAV-plus-signal-power argument may be
  presented as design intent, explicitly not a forecast.

## Traps already paid for — do not rediscover

- **Modak ships one weight (400).** In headings it inherits bold and the browser synthesises a
  smeared fake bold. Set `font-weight: 400` and `font-synthesis: none` on every Modak element.
- **SVG text does not wrap.** Words go in HTML; SVG is for shapes.
- **A falling price must shrink.** A bar that fills as a price decays reads backwards.
- **Events need duration.** Give a purchase or a fill ~1s of visible consequence, and remove the
  class afterwards — otherwise lit states accumulate until everything is lit.
- **Show the transfer, not just the result.** Animate value moving between parties; a number that
  merely changes teaches nothing.
- **Auto-driven agents synchronise.** Give each simulated actor its own reservation, expressed as
  a fraction of its own price, plus a minimum dwell time.
- **Declare `<meta charset="utf-8">`** or `·` and `—` mojibake.
- **One rAF loop for the whole page**, IntersectionObserver pauses off-screen work, and every
  simulation is defined **before** the observer runs. (The shared harness in this directory
  handles this — register your sim, never start your own loop. See CONTRACT.md.)

## Copy standard

Write from the reader's side. Name things by what a person recognises. Cut implementation detail
that changes nothing for them: they do not care that a split is hard-coded, they care that the
treasury always gets at least 80%. Prefer the outcome to the mechanism in every headline, then
let the animation carry the mechanism. Sections 3–5 (Mining, Resonance, Fund) each follow the
same two-beat shape: **what it does** in plain language first, then **how**, carried by the
animation. Never lead with the mechanism.

A sentence that could only have been written about this protocol is good. A sentence that could
appear on any crypto site is filler — cut it.

## Definition of done

- Every section reads correctly at 1440×900, 1280×720 and 390×844, no horizontal scroll.
- Every animation is contract-accurate, labelled illustrative where parameters are unselected,
  and pauses when off-screen.
- `prefers-reduced-motion` honoured everywhere.
- Text contrast passes AA; every interactive element has a visible focus state.
- The honesty block survives in the hero and the close.
- A fresh critic, shown only the bar and the rendered page, cannot say the bar wins.
