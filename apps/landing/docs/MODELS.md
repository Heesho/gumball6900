# MODELS — the five live simulations in `apps/landing`

The live component implementations are the source of truth. The old
`docs/deck/gumball6900-deck.html` is an art-direction ancestor, not a current Mine model. Every
simulation registers with `lib/harness.ts`, which provides one animation loop, visibility pausing,
reset behavior, and a meaningful reduced-motion still.

Mine-bound constants used by `components/sections/Mining.tsx`:

- `SLOTS = 16` and `DECAY = 3600` seconds.
- `MINER_BPS = 8_000`, `BPS = 10_000`.
- `MULT = 2` and `MIN_PRICE = 1` displayed USDG (`1e6` raw six-decimal USDG).
- `INITIAL_TPS = 64` GBX/s globally, `HALVING_PERIOD = 69 days`, and `TAIL_TPS = 1` GBX/s.

`globalTps(elapsedSinceStart)` mirrors `Mine._globalTps`:

```text
halvings = floor(elapsedSinceStart / 69 days)
prospectiveGlobalTps = max(64 / 2^halvings, 1) GBX/s
```

Elapsed time is measured from `Mine.startTime`. Minted supply, pending emission, occupancy, and
turnover do not select the prospective rate. The simulated prices, reservations, takers, and timing
are illustrative; the constants above are provisional source constants, not constructor choices.

---

## 1. mine — sixteen reverse Dutch auctions

State: `{ t, totalMined, routerDeposits, paidToMiners, slots[16] }`. Per slot:
`{ owner, initialPrice, startedAt, lastAccruedAt, tps, mined, reserve }`.

Init: the display opens on a reachable steady-state snapshot with **all sixteen slots occupied**.
Occupied tenures are staggered to prevent lockstep.

The never-taken state is a **deployment-only** condition and is deliberately not drawn. At
deployment every slot is empty and carries Mine's `$1` deployment auction; once a slot takes its
first fill it always has an owner, because a take replaces the outgoing tenure in the same transaction —
`it is never reopened after a first fill`. So a live board never shows a vacant slot, and the
owner's ruling (23 Aug 2026) is that the diagram opens after that transient rather than inside it.

The empty-slot branch remains in the model and in the contract — an empty-slot first fill deposits
the complete payment, where an occupied slot credits `floor(paid * 8_000 / 10_000)` to the
outgoing-tenure miner and assigns the remainder to the Router. It simply never fires in this display. Vacant slots
have zero TPS. Occupied era-zero slots have `64 / 16 = 4 GBX/s` each, or `14,400
GBX/hour`, and keep that assigned rate until replacement.

Price: `priceOf = initialPrice * (1 - elapsed/DECAY)`, returning zero once `elapsed >= DECAY`.
This is the same linear one-hour decay as `Mine._price`.

Step: accrue `dt * tps` to each occupied slot's display balance. An illustrative taker buys once
`priceOf(slot) <= slot.reserve` and the display-only four-minute dwell has elapsed. The dwell and
reservation are choreography, not Mine rules.

Buy event — the contract-shaped accounting shown by the model:

1. Settle the outgoing tenure: `accrued = (t - lastAccruedAt) * tps` is "minted" to the outgoing
   miner (`totalMined += accrued`) at replacement.
2. Allocate a nonzero payment: an empty slot deposits 100% in ResonanceRouter; an occupied slot
   credits `floor(paid * 8_000 / 10_000)` as the outgoing-tenure miner's pull claim and assigns the
   exact arithmetic remainder to ResonanceRouter. The Router tally means a nominal transfer request succeeded under
   the standard-USDG assumption, not that the balance was forwarded or streamed.
3. Start the new tenure at `max(paid * 2, $1)`. Assign
   `globalTps(t - MINE_START_TIME) / 16`, independent of `totalMined`, and lock it until replacement.
4. Show the restart leap, the pull claim, the Router deposit, and the outgoing GBX settlement for
   about one second. The first-fill state is consumed once and never fabricated again.

Mine emits `RevenueDeposited` after a successful nominal nonzero Router transfer request and stops. The model deliberately
does not feed the deposit directly into the Resonance simulation: `ResonanceRouter.route()` is a
separate permissionless action with no role, bounty, or liveness guarantee, and funds may wait in
the Router indefinitely.

Paint: all sixteen auctions are drawn as one-hour descending ramps. Four detailed DOM cells show
owner, price, a clock that fills from tenure start to the one-hour zero, pending GBX, and locked
GBX/hour. Tallies show Router deposits, outgoing-tenure claims, GBX settled so far, and the live sum
of all assigned slot rates.

Re-implementer traps: the restart is fixed at `paid × 2` with a `$1` floor; new TPS depends on elapsed
time from Mine deployment, never cumulative emission; outgoing tenures do not reprice at a halving; the
aggregate rate may therefore exceed the prospective global rate; accrued GBX mints at replacement;
and a Router deposit does not prove that a seven-day stream began.

## 2. sig — signal and earn (lines 1591–1671; markup 856–877)

State: `sig.weekly = 42000` (USDG/week the stream releases, labeled illustrative); three actors
`{ who, stake, pick, earned{} }` — `@you` 1200 GBX → NVDA, `@rin` 2600 → QQQ, `@moss` 900 → WBTC;
three pools SYMS `{ sym, price, color, held }` (NVDA 118, QQQ 486, WBTC 94000).

Step (1639–1649), sim time ×3600: `perSec = weekly / (7*86400)`; each actor's USD share is
`perSec * dt * (stake/totalStake)`; then the 90/10 split **per actor**:
`earned[pick] += usd * 0.10 / price` (the signaler's tenth, in the asset) and
`held += usd * 0.90 / price` (the fund's ninety, same asset).

Paint (1651–1670) — pure DOM, two columns. Actor cards (`#sigActors`): name (you in blue),
`stake GBX · N% of signal`, `signalling SYM` in the asset's color, `earned X.XXX SYM` (5 decimals
if price > 1000 else 3). Pool cards (`#sigPools`): `N% of the stream`, a bar of that width in the
asset color, `fund holds X SYM`.

Trap: **stakes never move in this sim.** The slide copy says "Move yours and watch both change"
and the sim note says holders move stake "when they change their mind", but `sig.step` contains
no stake-shift logic and no input handlers — weights are constant; only accrual runs. The moving
of stake is demonstrated in the flow sim instead. Also: sig has no flash/lit event pattern at all;
it is a smooth accumulator.

## 3. flow — Resonance stream + weights (lines 1365–1589; markup 878–899)

State: four ASSETS `{ sym, price, color, stake }` — NVDA 12400, QQQ 9200, WBTC 6100, AAPL 3800
GBX — each augmented with `{ pot, held, flash, epochEnd, lastFill, delta, moved, holdUntil }`;
`flow = { t, running, pending, rate, finish, parts[], assets }`.

Step (1409–1462), sim time ×900:

- **Discrete stake moves** (1416–1436): when `t >= nextShift`, pick a random whole lot from
  `[500, 1000, 1500, 2000, 3000]` and move it from one asset to another (guard:
  `from.stake - lot > 800`; a `holdUntil` filter exists but nothing ever sets it — dead code).
  Set `delta = ±lot`, `moved = 1`; `moved` decays over 2600 sim-s and clears `delta`.
  `nextShift = t + 3200 + rand*5200`. Between moves the weights hold still — deliberate:
  "Signalers move stake in discrete decisions, not as a continuous trickle" (1412–1415).
- **Stream restart**: this isolated Resonance model begins after revenue has been forwarded from
  ResonanceRouter. It accumulates an illustrative weekly amount locally and restarts only after the
  current display stream finishes. It is deliberately not a claim that a Mine replacement forwards or
  schedules revenue synchronously.
- **Allocation and fills** (1446–1461): `released = rate*dt` while streaming; each asset's
  `pot += released * (stake/totalStake)`. When `t >= epochEnd` and `pot > 0` the auction flushes:
  `units = pot/price`; `lastFill = units * (1 - 0.10)`; `held += lastFill`; `pot = 0`;
  `flash = 1`; next `epochEnd = t + 1600 + rand*1800`; 12 stage-2 particles are staggered in
  (`p = -k*0.05`). There is **no minimum lot** — comment 1378–1380: gating on a whole unit
  "would mean WBTC never flushed at all." `flash` decays over 1500 sim-s.

Animate (1465–1478), real time: stage-1 (USDG) particles spawn while streaming (cap 150,
p≈0.55/frame), lane chosen by stake-weighted random; stage 1 moves at 0.30/s, stage 2 at 0.75/s.
"Particles move in real time so the flow reads at a human pace, whatever the sim clock does."

Paint (1480–1587) — canvas `#flowCanvas` 1600×620 plus a donut canvas `#pie` 440×440 and a DOM
legend. Left: Resonance box showing `$X left` (`rate * (finish - t)`). Middle: per-lane bezier
whose **stroke width is the stake share** (`max(2, share*46)`), then a Strategy box
"Auction: buy SYM" with `pot` in blue mono and "USDG waiting to be sold". Right: fund holding box
stroked in asset color, `held.toFixed(price>1000 ? 4 : 2) + ' in the fund'`, and while
`flash > 0` a `+lastFill` in the asset color with alpha `min(1, flash*1.4)` — flash also
brightens both boxes' fill/stroke. Column captions: "USDG, SPLIT BY SIGNAL" /
"THE ASSET, ONCE THE AUCTION FILLS". Stage-1 particles are always `#29B6F0` (USDG blue);
stage-2 use the asset color. Donut: slice per asset, **moved slices render at full radius R and
alpha 1, resting slices at R−8 and alpha 0.88**; hole cut at `R*0.58` via `destination-out`;
center text "signal / N GBX". Legend row per asset: `%`, and
`±lot GBX  →  stake GBX  ·  ~X SYM/wk` where the estimate is
`rate*STREAM*share/price*0.90`; row gets class `is-moved` while `moved > 0`.
Clock: `week N = ceil(t/STREAM)`.

Traps: weights change only in whole-lot steps, never drift; the display starts downstream of a
successful permissionless Router call; the stream restarts only after the previous seven days fully
elapse (the contract also allows an early restart when Router revenue covers what is left — see
CONTRACT FACTS); each asset flushes whatever pot it has on its own random epoch; the 10% bribe cut
is taken at fill time in asset units.

## 4. auc — one live acquisition auction (lines 1673–1846; markup 900–920)

State: `QQQ = 486` ($/unit), `EPOCH = 21600` (a six-hour epoch, "well inside Strategy's 1h–365d
bounds", 1679–1682), `auc = { running, t, phase:'open'|'trade', tradeT, lot:486, inflow:0.045,
ask, initialAsk, started, fundTotal, sigTotal, epoch, parts[], lastPaid, lastLot }`.
Everything is measured **in QQQ units, never dollars**: `fair() = lot / QQQ` (what the USDG lot
is worth in QQQ); `open()` sets `initialAsk = fair() * (1.85 + rand*0.35)`.

Step (1696–1715), sim time ×450, only while `phase === 'open'`:

- **The lot keeps growing during the auction**: `lot += inflow * dt` (0.045 USDG/sim-s — the
  stream keeps signalling USDG in), so the worth stack rises while the ask falls.
- Ask decays linearly to zero over EPOCH: `ask = initialAsk * (1 - elapsed/EPOCH)`.
- Fill condition: `ask <= fair()`. On fill: freeze `lastPaid = ask`, `lastLot = lot`;
  `fundTotal += ask * 0.90`; `sigTotal += ask * 0.10`; `epoch++`; spawn particles —
  16 'usdg' coins (`p = -i*0.04`), 9 'fund' coins and 1 'sig' coin (both starting at `p ≤ -0.5`
  so the return leg lags the outbound USDG).

Animate (1716–1721), real time, only in 'trade': particles advance 0.5/s; after **3.0 real
seconds** the trade display ends, `lot = 420 + rand*180`, and `open()` restarts.

Paint (1735–1844) — canvas `#aucCanvas` 1600×560. Top-left "THE AUCTION" box (border flips to
pink while trading): lot in USDG (blue mono) and the ask in QQQ (pink mono); while trading it
shows the frozen `lastLot`/`lastPaid`. Below it, **two bar stacks**: worth (blue, rising) and
asking (pink, falling), both scaled by `scale = max(initialAsk, worth, 0.001)` so the ask starts
at full height and **must visibly shrink** while worth grows; min bar height 4px; numeric labels
above each bar; captions "worth, rising" / "asking, falling". A horizontal meet-line sits at the
lower of the two bar tops — dashed grey "settles when they meet" while open, solid white
"THEY MET · SETTLED" while trading. Top-right "A TRADER" box ("takes the USDG, hands over the
QQQ"). Bottom-right two destination boxes: "The fund / QQQ backing GBX · 90%" (`fundTotal`)
and "The signalers / QQQ to signalers · 10%" (`sigTotal`, pink). During trade, coins fly on
quadratic arcs (helper at 1729–1733, lifted control point so they never cut across the chart):
blue USDG auction→trader, white QQQ trader→fund, pink QQQ trader→signalers, with caption
"USDG to the buyer". Footer: `N lots settled so far`. The `#aucState` clock line reads
`lot $X · asking Y.YY QQQ` or `settled: $X for Y.YY QQQ`.

Traps: both stacks are in QQQ, and the settle price is the **ask at the moment of crossing**,
not `fair()`; the lot grows during the open phase and display values must be frozen at fill;
after settling, the lot resets to a random ~420–600 USDG rather than 0 (standing in for the
stream having kept flowing); the 90/10 split is applied to the QQQ paid, at settle time.

## 5. red — redemption (lines 1848–1929; markup 924–942)

State: `red = { t, supply: 100000000, next: 2.2, phase: 'idle', pt, who, pct, holds }`;
holdings `{ NVDA 1200, QQQ 400, WBTC 2.4, AAPL 860 }`, each DOM `.hold` cell keeps `base = amt`
for its bar scale. Runs in **real time** (no sim clock).

Step (1883–1927): a two-phase self-running loop.

- idle → at `t >= next`, start a burn: random holder from six names, `pct = 0.4% + rand*2.0%`
  of supply; `burned = supply*pct`; `taken[i] = holds[i].amt * pct`; the `#redOut` line announces
  "**@who** burns **N GBX**, which is P.PP% of everything in existence."
- burn → `k = min(1, pt/1.1)` eases every number down simultaneously: supply readout, each
  holding's amount and bar width, and each cell's `→ X out` line; every cell carries class
  `is-paying` for the duration. At `pt >= 1.5` s the burn finalizes: supply and holdings are
  actually decremented, `#redOut` lists exactly what was received per asset — "the same P.PP% of
  every holding, in one transaction" — the `is-paying` class clears, and **the vault refills**:
  `amt += base * (0.010 + rand*0.02)` ("The fund keeps buying between redemptions"). Next burn
  at `t + 3.4 + rand*2.2` s.

Paint (1873–1880) — DOM. `#vault` holds four `.hold` cells: symbol, amount
(`toFixed(amt < 10 ? 4 : 1)`), a bar of width `amt/base*100%`, and the transient out line.
`#redSupply` shows `N GBX in existence`.

Traps: the same fraction leaves **every** holding — never a per-asset choice here (the markup
note at 704–708 says the real thing lets you name assets); the animated phase must not mutate
state (display interpolates with `k`; the decrement happens once at the end); refills can push
`amt` above `base`, so bar widths can exceed 100%.

---

## CONTRACT FACTS (verified against the Solidity — do not guess)

`packages/contracts/src/core/Mine.sol`:

- Exactly 16 immutable slots: `SLOT_COUNT = 16`.
- Linear decay to zero over one hour: `PRICE_DECAY_PERIOD = 1 hours`; `_price` returns zero once
  the hour elapses.
- The next starting price is hard-coded as `paid * PRICE_MULTIPLIER`, where
  `PRICE_MULTIPLIER = 2`, clamped up to `MIN_INITIAL_PRICE = 1e6` raw USDG and down to the
  `uint192` raw-price cap. These are source constants, not constructor inputs or settings.
- Payment allocation uses `PREVIOUS_MINER_BPS = 8_000`. An occupied-slot payment credits
  `floor(paid * 8_000 / 10_000)` to the outgoing-tenure miner as a pull claim; the exact arithmetic
  remainder is the nominal amount requested into the immutable ResonanceRouter. An empty-slot first fill deposits the complete
  payment. Zero-price replacements move no USDG.
- A successful paid deposit emits `Mine.RevenueDeposited(index, epochId, amount)`. Mine never calls
  `ResonanceRouter.route()`. Routing is a later permissionless action with no caller role, reward,
  or liveness guarantee, so Router revenue may wait indefinitely. Only
  `ResonanceRouter.RevenueRouted` proves a later successful forward into Resonance.
- `startTime` anchors the prospective schedule. `INITIAL_TPS = 64 ether`,
  `HALVING_PERIOD = 69 days`, and `TAIL_TPS = 1 ether`. A new tenure gets
  `max(INITIAL_TPS >> floor((now - startTime) / HALVING_PERIOD), TAIL_TPS) / 16`.
- A slot's assigned TPS is tenure-locked. A time boundary does not reprice outgoing tenures, so aggregate
  issuance may exceed the current prospective global rate until higher-rate slots turn over.
  Pending emission is kept exact in constant time but does not select the prospective rate.
- The 64/69-day/1 curve is the provisional development candidate pending independent economic
  review. It is fixed in source and cannot be reconfigured after deployment.

`packages/contracts/src/core/Resonance.sol`:

- Seven-day stream: `REWARD_DURATION = 7 days`. `notifyRevenue` can restart the period mid-stream when
  the new revenue is `>= remainingRevenue()`, the whole-unit revenue remaining at the active
  rate. It schedules `amount + remaining` at `rate = scheduled / REWARD_DURATION` and sets
  `periodFinish = now + REWARD_DURATION`. Ordinary integer division floors the rate; the remainder stays
  as unallocated Resonance surplus rather than being front-loaded. The flow sim simplifies this
  to restart-only-after-expiry.
- Signaler share: `DEFAULT_BRIBE_BPS = 1_000` (10%) and `MAX_BRIBE_BPS = 2_000`. The ceiling
  preserves at least 80% of each later Strategy payment for Fund. `setBribeBps` reverts above the
  max and never reprices an earlier purchase or active reward stream. Strategy snapshots the rate
  before token interaction, pays the per-purchase complement directly to Fund, and sends only the
  floored Bribe share to BribeRouter.
