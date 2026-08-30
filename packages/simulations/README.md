# GUM BALL 6900 economic simulations

This package contains independent deterministic TypeScript and Python models. They are test oracles, not forecasts,
price promises, deployment configurations, or investment projections.

## Units and rounding

- The models use the canonical deployment assumption of a 6-decimal USDG and 18-decimal GBX and target assets. The
  contracts account only in raw units and do not read or enforce token decimals.
- GBX's constructor starts at zero supply. During the canonical atomic launch, Mine issues the fixed 1,000 GBX
  genesis-liquidity amount before all resulting LP is permanently locked. Later Mine issuance is unbounded.
- A live slot accrues `elapsedSeconds * assignedTps`; the assigned TPS remains fixed until replacement.
- Mine has exactly sixteen slots; time-based halvings affect only newly occupied or replaced slots.
- A new tenure receives `globalTps(elapsedSinceStart) / 16`; division residue is unissued.
- A nonempty-slot replacement pays `floor(price * 80%)` to the outgoing tenure miner and deposits the residue into
  ResonanceRouter. An empty slot deposits 100%. Mine stops after that deposit; a later permissionless `route()` call
  may forward Router custody into Resonance.
- Resonance uses a `1e36` revenue-per-signal index and a seven-day Synthetix-style stream. Division by the duration
  floors the rate and leaves the remainder as unallocated surplus. A live top-up qualifies when the new amount is at
  least the active scheduled revenue left; it checkpoints elapsed revenue and restarts seven days with
  `new revenue + remaining revenue`.
  ResonanceRouter also waits until its balance can sustain at least one raw unit per second. Zero-signal emission,
  direct donations, rate residue, global-index residue, and per-Strategy flooring remain unallocated surplus.
- Killing a Strategy checkpoints it against the old active denominator, preserves its stored whole-unit reward, removes
  its complete weight from the future denominator, and leaves its recorded signal available for incremental exit.
- Bribe uses a `1e36` reward-per-signal index with the same Synthetix-style leftover rollover. Reward time does not pause at
  zero virtual supply, notifications do not queue, and rate/index/account floors remain unallocated token surplus.
- Strategy payments use one global prospective automatic-Bribe rate: 10% by default, settable from 0% through 20%,
  with Fund receiving the complement directly during each purchase. Each purchase independently computes
  `floor(payment * rate / 10_000)` for BribeRouter; there is no cross-purchase split carry. Compatible direct
  BribeRouter donations join the next qualifying Bribe notification.
- A 0% rate classifies new payments entirely to Fund without disabling paired Bribes, independent rewards, signaling,
  movement, withdrawal, or existing reward settlement.
- Slot price is `initialPrice - floor(initialPrice * elapsed / 3600)` during the hour and zero afterward.
- The next initial price floors the paid-price multiplier before applying its minimum and maximum.
- All committed financial JSON values are decimal strings; neither implementation uses floating point arithmetic.

## Coverage

`fixtures/economic-scenarios.json` covers:

- zero constructor supply, fixed 1,000 GBX launch supply, unbounded later mint/burn reconciliation, time-based
  halvings, and a positive tail;
- hourly price endpoints, replacement transitions, zero-price rollover, and 80/20 payment conservation;
- staggered fixed-slot replacements where an earlier tenure keeps its old TPS and later tenures receive the halved TPS;
- a time boundary where the earlier tenure retains its rate and only the next replacement receives the lower rate;
- ordinary Strategy auctions and per-purchase settlement across 10% → 0% → 5% → 20% rate changes,
  Bribe rewards, Fund-held GBX burns, and raw-basket redemptions.

Separate TypeScript and Python conservation models cover one-raw-unit-per-second Resonance streams, qualifying
live-period resets, Router retention below the reset threshold, zero-signal and direct-donation surplus, per-Strategy
rounding surplus, irreversible Strategy death, partition-sensitive tiny-payment settlement, bounded Bribe-rate
changes, zero-rate liveness, direct Fund settlement, Router donation inclusion, and ordinary Bribe flooring across
entry and exit boundaries.
These state-machine tests are independent of Solidity.

The smaller `fixtures/reference-results.json` is the SDK formula-vector fixture. Both fixtures are checked across
TypeScript and Python, and both languages assert the fixed-tenure fairness rule independently.

## Commands

Use Python `3.11.x`; CI evidence uses the exact `3.11.9` patch in `.python-version`:

```bash
python -m pip install --requirement packages/simulations/requirements-dev.lock
python -m pip check
pnpm --filter @gumball-6900/simulations test
pnpm --filter @gumball-6900/simulations fixtures:check
pnpm --filter @gumball-6900/simulations charts:check
```

Only run `fixtures:generate` after intentionally changing a formula. It refuses to write unless the independent models
agree, then regenerates the committed SVGs.

## Traceability

| Requirement                             | Fixture path / evidence                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Zero constructor / fixed launch supply  | `assumptions.constructorSupplyGBXRaw`, `assumptions.genesisLiquiditySupplyGBXRaw` |
| Unbounded later issuance                | `assumptions.initialSupplyGBXRaw`, `mining.synchronizedSupply`                    |
| Tenure-locked fixed-slot TPS            | `mining.staggeredFixedSlots`                                                      |
| Exact time boundaries and empty aging   | `mining.timeBasedSchedule`                                                        |
| Time boundaries affect only new tenures | `mining.handoffHalving`                                                           |
| Hourly decay and 80/20 split            | `mining.priceCurve`, `mining.paymentExamples`                                     |
| Strategy and Bribe arithmetic           | `strategyAuction`, `bribeRewards`, conservation models                            |
| Resonance streaming and signal time     | TypeScript/Python `conservation-model` tests                                      |
| Raw redemptions and GBX burns           | `redemptionAndGbxBurn`                                                            |
