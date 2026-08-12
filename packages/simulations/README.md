# GUM BALL 6900 economic simulations

This package contains independent deterministic TypeScript and Python models. They are test oracles, not forecasts,
price promises, deployment configurations, or investment projections.

## Units and rounding

- USDG uses raw 6-decimal units; GBX and modeled target assets use raw 18-decimal units.
- GBX starts with exactly 20M genesis-liquidity tokens and then has unbounded Mine issuance.
- A live slot accrues `elapsedSeconds * assignedUps`; the assigned rate remains fixed until replacement.
- Capacity increases and cumulative-mining halvings affect only newly occupied or replaced slots.
- A new slot receives `globalUps(totalMined) / capacity`; division residue is unissued.
- A nonempty-slot replacement pays `floor(price * 80%)` to the displaced miner and routes the residue to Resonance.
  An empty slot routes 100%.
- Slot price is `initialPrice - floor(initialPrice * elapsed / 3600)` during the hour and zero afterward.
- The next initial price floors the paid-price multiplier before applying its minimum and maximum.
- All committed financial JSON values are decimal strings; neither implementation uses floating point arithmetic.

## Coverage

`fixtures/economic-scenarios.json` covers:

- 20M genesis supply, unbounded mint/burn reconciliation, cumulative halvings, and a positive tail;
- hourly price endpoints, replacement transitions, zero-price rollover, and 80/20 payment conservation;
- expansion from one to three slots where the incumbent keeps its old rate and new miners receive divided rates;
- a threshold crossing where the incumbent retains its rate and only the next replacement receives the lower rate;
- genesis-position budgeting, Strategy auctions, Bribe rewards, Fund-held GBX burns, and raw-basket redemptions.

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
pnpm --filter @gumball-6900/simulations liquidity:check
pnpm --filter @gumball-6900/simulations liquidity:report
```

Only run `fixtures:generate` after intentionally changing a formula. It refuses to write unless the independent models
agree, then regenerates the committed SVGs.

## Traceability

| Requirement                        | Fixture path / evidence                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| 20M genesis and unbounded issuance | `assumptions.genesisSupply`, `mining.supplyReconciliation` |
| Tenure-locked capacity expansion   | `mining.capacityExpansion`                                 |
| Thresholds affect only handoffs    | `mining.handoffHalving`                                    |
| Hourly decay and 80/20 split       | `mining.priceCurve`, `mining.paymentExamples`              |
| Strategy and Bribe arithmetic      | `auctions`, `bribeRewards`                                 |
| Raw redemptions and GBX burns      | `redemptionAndGbxBurn`                                     |
