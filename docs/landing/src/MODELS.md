# MODELS — the five live simulations in docs/deck/gumball6900-deck.html

Source of truth: `docs/deck/gumball6900-deck.html` (all line numbers below refer to that file).
WARNING: lines 621 and 1069 are ~428KB data-URI images. Never read a range containing them.

All five sims live in one IIFE, lines 1183–1975. They model contract mechanics, not canned
animation. Shared scaffolding:

- **Shared constants** (1186–1199): `SLOTS=16`, `DECAY=3600` (Mine.PRICE_DECAY_PERIOD s),
  `MINER_BPS=8000`, `BPS=10000`, `MULT=2.0` ("within Mine's 1.1–3.0 bound"), `MIN_PRICE=1` ($),
  `STREAM=7*86400` (Resonance.DURATION), `BRIBE_BPS=1000` (Resonance default).
  Illustrative emission curve: `INITIAL_TPS=4000/3600` GBX/s all slots, `HALVING=250000`,
  `TAIL=200/3600`. Names pool at 1201.
- **`globalTps(mined)`** (1203–1214): mirrors `Mine._rateState` — rate halves per threshold AND the
  interval to the next threshold also halves (`next += HALVING / 2^halvings`); clamps to `TAIL`.
- **Formatters** `money()` / `gbx()` (1216–1225).
- **Reduced motion** (1184): `prefers-reduced-motion` sets `running=false` on mine/flow/auc
  (they still paint one static frame). sig and red ignore it.
- **Visibility gating** (1931–1945): an IntersectionObserver (threshold 0.25) on each sim's
  `.slide` sets `visible[key]`; a sim only steps/paints while its slide is ≥25% on screen.
- **Frame loop** (1947–1974): rAF, `dtms` clamped to 64ms. Time scales differ per sim:
  mine `dt*60`, flow `step(dt*900)` + `animate(realDt)`, sig `dt*3600`, auc `step(dt*450)` +
  `animate(realDt)`, red runs in real time. Seed before first frame (1971): `flow.pending=46000;
  flow.step(1)` so the flow diagram is not empty on first view.

Honest-register comment worth copying (1175–1182): "Both mirror the contract mechanics rather
than replaying a canned animation … Illustrative parameters only. The production rate, halving
amount, tail, multiplier and starting price are unselected (finding M-04)."

---

## 1. mine — sixteen reverse Dutch auctions (lines 1227–1363; markup 831–854)

State: `{ t, speed:60, running, totalMined, revenue, paidToMiners, slots[16], cells[16] }`.
Per slot: `{ owner, initialPrice, startedAt, lastAccruedAt, tps, mined, reserve, flash }`.

Init (1242–1274): each slot starts owned by a fixed name, `initialPrice = 4 + rand*26` dollars,
and — critically — `startedAt = -rand * DECAY * 0.9` so every slot is at its own point in its own
cycle ("otherwise the whole board reaches its reservation together and sixteen slots change hands
in one frame", 1244–1245). `tps = INITIAL_TPS/16`, `mined = rand*40`,
`reserve = MIN_PRICE * (0.2 + rand*0.55)`.

Price (1276–1280): `priceOf = initialPrice * (1 - elapsed/DECAY)`, 0 once `elapsed >= DECAY`.
Pure linear decay to zero over one (sim) hour — matches `Mine._price`.

Step (1327–1339): accrue `dt*tps` to each occupied slot's `mined`; a slot is bought when
`priceOf(slot) <= slot.reserve` **and** tenure age `> 240` sim-seconds (the dwell that stops
lockstep churn, 1335–1336).

Buy event (1282–1325) — the exact contract-shaped order:
1. Settle the outgoing tenure: `accrued = (t - lastAccruedAt) * tps` is "minted" to the displaced
   miner (`totalMined += accrued`) — issuance is realized only at replacement, as in the contract.
2. Route the payment: **vacant slot → 100% to `revenue`; occupied → 80% to `paidToMiners`,
   20% to `revenue`** (1294–1302).
3. New tenure: random new owner; **`initialPrice = max(paid * MULT, MIN_PRICE)`** (1305) — the
   restart rule, including the $1 floor after a zero-price take; `tps = globalTps(totalMined)/16`
   (new tenure re-divides the current global rate by sixteen, 1308); `mined = 0`; new random
   reservation `initialPrice * (0.18 + rand*0.6)` (1310).
4. Emphasis: cell `.fx` text names the transfer — `'@name  +$X  +Y GBX'` or
   `'first fill  ·  100% to the fund'` — class `is-bought` is removed, forced reflow
   (`void cell.root.offsetWidth`, 1319) to restart the CSS flash on repeat purchase, re-added,
   and cleared by `setTimeout` after **1100ms** (1322).
5. Cross-sim feed (1324): the fund's share of the payment is pushed into `flow.pending`.
   (Note: at this point `slot.owner` was already reassigned, so the vacant-slot branch of that
   ternary is dead — it always adds the 20% share. Harmless, since revenue was computed above.)

Paint (1341–1361) — DOM cells, not canvas. Grid `#mineBoard` of 16 `.cell` divs, each with owner
(`@name` or `open`), price `$X.XX`, a decay bar whose width is the **fraction of time remaining**
(`1 - elapsed/DECAY` — identical to price fraction because decay is linear; the bar must shrink
as the slot gets cheaper), GBX-mined line, and the fx line. Tallies: total GBX mined, USDG to the
fund (`tRev`, pink), USDG paid back to displaced miners (`tPaid`, blue), and live GBX/hour
(`sum(slot.tps)*3600`). Clock `day D, HH:MM` from sim time.

Re-implementer traps: price restarts at `paid × MULT` with a **floor**, never a fixed number;
new tps is locked for the whole tenure (drift only happens at handoffs); accrued GBX mints at
replacement, not continuously; the 240s dwell and per-tenure random reserve are what keep the
board from synchronising.

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
- **Stream restart** (1439–1444): only when the current stream is finished (`t >= finish`) and
  `pending > 0`: `rate = pending/STREAM; finish = t + STREAM; pending = 0`. While expired,
  fresh mining revenue trickles in: `pending += 5200 * dt / STREAM`. `pending` is also fed live
  by `mine.buy` (1324) and seeded with 46000 at 1971.
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

Traps: weights change only in whole-lot steps, never drift; the stream restarts only after the
previous seven days fully elapse (the contract also allows an early restart when the new reward
covers what's left — see CONTRACT FACTS); each asset flushes whatever pot it has on its own
random epoch; the 10% bribe cut is taken at fill time in asset units.

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
"THEY MET  ·  SETTLED" while trading. Top-right "A TRADER" box ("takes the USDG, hands over the
QQQ"). Bottom-right two destination boxes: "The fund / QQQ backing GBX  ·  90%" (`fundTotal`)
and "The signalers / QQQ to signalers  ·  10%" (`sigTotal`, pink). During trade, coins fly on
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
- 16 slots, permanent: `SLOT_COUNT = 16` (Mine.sol:32).
- Linear decay to zero over one hour: `PRICE_DECAY_PERIOD = 1 hours` (Mine.sol:30);
  `_price` returns 0 when `elapsed >= PRICE_DECAY_PERIOD`, else
  `initialPrice - initialPrice*elapsed/PRICE_DECAY_PERIOD` (Mine.sol:348–352).
- **Restart price when a slot is taken is NOT hard-coded "double"**:
  `_nextInitialPrice = paid * priceMultiplier / 1e18`, clamped up to `minimumInitialPrice` and
  down to `MAX_INITIAL_PRICE` (Mine.sol:210–214). `priceMultiplier` is an immutable deployment
  choice bounded `MIN_PRICE_MULTIPLIER = 1.1e18` … `MAX_PRICE_MULTIPLIER = 3e18`
  (Mine.sol:34–36, validated at 137–139). The deck's MULT=2.0 is an illustrative pick inside
  that bound (deck 1191); the slide prose "the price restarts at double" (deck 837) states the
  illustrative value as if fixed. Floor: `MIN_INITIAL_PRICE = 1e6` raw USDG = $1 (Mine.sol:38).
- 80/20 vs 100% routing: `PREVIOUS_MINER_BPS = 8_000` (Mine.sol:26). `_allocatePayment`
  (Mine.sol:216–228): vacant slot (`previousMiner == address(0)`) → the **entire** payment is
  revenue; occupied → 80% accrued to the displaced miner as a **pull-based claim**
  (`claimable[previousMiner] +=`, withdrawn via `claim()`, Mine.sol:253–269 — not pushed), and
  the 20% remainder is transferred to the ResonanceRouter and `route()` is called
  (Mine.sol:230–249).
- Fixed issuance per tenure: at replacement the new slot's rate is
  `_globalTps(totalMined + storedPendingEmission) / SLOT_COUNT` and is **tenure-locked** — "Each
  occupied slot keeps its assigned tokens-per-second rate until replacement" (Mine.sol:16,
  191–203). The outgoing tenure's accrual `(now - lastAccruedAt) * slot.tps` is minted to the
  displaced miner only at settlement (`_settleSlot`, Mine.sol:313–325). Vacant slots have
  `tps = 0` (Mine.sol:354–363).
- Halvings: `_rateState` (Mine.sol:331–346) — rate `initialTps >> halvings`, and the interval to
  the next threshold also halves (`nextThreshold += halvingAmount >> halvings`); floor `tailTps`.
  `initialTps`, `halvingAmount`, `tailTps`, `priceMultiplier`, `minimumInitialPrice` are all
  unset deployment parameters (Config, Mine.sol:83–89) — hence the deck's "illustrative" labels.

`packages/contracts/src/core/Resonance.sol`:
- Seven-day stream: `DURATION = 7 days` (Resonance.sol:28). `notifyRevenue` restarts the period:
  new reward must be `>= left()` (the exact reward remaining in an active period,
  Resonance.sol:230–241, 398–402); `_restartRewardPeriod` schedules `reward + remainder` at
  `rate = scheduled / DURATION`, `periodFinish = now + DURATION`, with the integer-division
  remainder emitted at 1 extra unit/s during the first seconds (Resonance.sol:455–466, 469–479).
  So the contract CAN restart mid-period (topping up), which the flow sim simplifies to
  restart-only-after-expiry.
- Signaler share: `DEFAULT_BRIBE_BPS = 1_000` (10%, Resonance.sol:34); governance ceiling
  `MAX_BRIBE_BPS = 2_000` — "Hard governance ceiling preserving at least 80% of cumulative
  classified payments for Fund" (Resonance.sol:35–36); `setBribeBps` reverts above the max
  (Resonance.sol:279–285) and never reprices existing liabilities (Resonance.sol:276–277).

## Deck disclaimer / honesty copy (markup 609–1095), verbatim

- Cover chip (635): `Not deployed · not audited`
- Assets note (704–708): `Redemption is always in kind: you receive the tokens themselves, in the proportion you are owed, and you choose which ones. The equity symbols above are reviewed candidates, not holdings. Robinhood Chain is the intended venue and is not finalised; nothing has been deployed or bought.`
- Mine sim bar (842): `Illustrative parameters; the real ones are not chosen yet.`
- Sig sim bar (868): `Three holders, each moving their stake when they change their mind.`
- Flow sim bar (890): `Each Strategy sells its USDG in a falling-price auction, then 90% of the asset backs GBX.`
- Auction sim bar (914): `Both stacks are measured in QQQ. They settle when the asking stack drops to the worth stack.`
- Listing note (1007–1010): `Nothing here is a promise about anyone's token price. It is a description of where the protocol's revenue mechanically goes, and who decides.`
- Thesis note (1055–1060): `Stated as design intent, not as a forecast. Nothing guarantees GBX trades at or above its redemption value: that argument depends on the acquired assets being liquid enough to arbitrage, and on there being real demand for signal. Supply also grows continuously, so a holder who neither signals nor mines is diluted over time. This is the mechanism, not a promise about price.`
- Close card 1 (1076–1081): `Before you pass this on` / `Not deployed on any network. Not independently audited. The real mining and pricing numbers have not been chosen, and neither has the governance owner. Nothing here is an offer, a solicitation, or investment advice, and it is not a regulated fund product.`
- Close card 2 (1083–1089): `Where it actually stands` / `The contracts are written and heavily tested in-house: 347 automated tests pass with zero failures. Immutability cuts both ways — a bug cannot be patched and a deployment mistake cannot be corrected.`
