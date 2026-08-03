# GUM BALL 6900 economic simulations

This package contains reproducible TypeScript and independent Python models for the protocol mechanics in master-spec §33. The models are deterministic test oracles, not forecasts, NAV calculations, price promises, or investment projections. Exogenous market prices used in buyback examples are labeled assumptions and are never protocol inputs.

## Units and rounding

- Canonical USDG uses raw 6-decimal units (`1 USDG = 1_000_000`).
- GBX and modeled target assets use raw 18-decimal units.
- Mining prices and strategy reference rates are human-normalized WAD values (`1e18`). An auction quote first normalizes raw USDG to 18 decimals, applies the human-WAD target-per-USDG rate, and returns target-token raw units.
- Solidity-compatible floor division is the default. Sponsor requirements, mining funding inputs, and auction target requirements round up where underpayment would otherwise be possible.
- The mining EMA floors its 80% and 20% terms separately. Empty-epoch decay clamps to one atomic WAD price unit.
- All financial values in committed JSON are decimal strings. Neither model uses floating-point financial arithmetic.

## Coverage

`fixtures/economic-scenarios.json` covers:

- emissions under fully funded, 50% funded, weekly sporadic, and 2,000-day empty-tail demand at 1/4/8/16/32 years; large price shocks; reference lag; and burns from 0% through 150% of recurring issuance;
- four bootstrap sizes, sponsor backing, genesis prices and redemption, the fully backed 20M GBX one-sided position, and range-ladder USDG depth;
- the 125%-to-80% reverse Dutch curve, price drift, fill timing, lots, absent market makers, trading halts, and retained strategy budgets;
- strategy reward yield, vote concentration, switching, immediate unstaking, 24-hour activation, and zero-weight reward redirection;
- below/above-backing buybacks, mining-funded versus LP-fee-funded burns, simultaneous mint/burn, sequential basket redemptions, and LP inventory conversion.

The smaller `fixtures/reference-results.json` remains the SDK formula-vector fixture. Both are checked across TypeScript and Python. The language-specific economic tests also assert scenario semantics independently of fixture parity: accounting conservation, monotonic response, cap and activation boundaries, reward routing, and LP inventory conservation.

## Commands

Use Python `3.11.x` and install the exact test toolchain before running the cross-language suite. Local tests reject
other Python minor versions and any dependency drift. CI and release evidence use the exact `3.11.9` patch recorded in
the repository `.python-version`:

```bash
python -m pip install --requirement packages/simulations/requirements-dev.lock
python -m pip check
```

```bash
pnpm --filter @gumball-6900/simulations test
pnpm --filter @gumball-6900/simulations fixtures:check
pnpm --filter @gumball-6900/simulations charts:check
pnpm --filter @gumball-6900/simulations liquidity:check
pnpm --filter @gumball-6900/simulations liquidity:report
```

Only run `fixtures:generate` after intentionally changing an assumption or protocol formula. It refuses to write unless both language models agree, then regenerates the committed SVGs. CI and the nightly workflow fail on fixture or chart drift.

The SVGs in `charts/` are dependency-free renderings of committed scenarios. They are explanatory protocol-mechanics charts and repeat the non-projection disclaimer in the artifact itself.

`liquidity:report` is the execution-oriented v4 ladder model; `liquidity:check` executes the same complete report path
without printing JSON and is part of the package test gate. The model uses the pinned official Uniswap v3 TickMath and v4
Pool/Position swap engine, the canonical 0.30% fee, exact six-decimal USDG and 18-decimal GBX raw units, the configured
tick-aligned 50/30/15/5 ranges, and both currency orderings. Its deterministic JSON reports position token amounts,
USDG accumulated, remaining GBX and active liquidity, mid-price output, execution output, price impact, and post-trade
state for buys and subsequent sells. The cross-language §33 fixtures remain independent analytical economic models;
they are not substituted for this canonical-v4 mechanics evidence.

## §33 traceability

| Master-spec requirement                                | Fixture path / evidence                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| §33.1 fully funded, 50%, sporadic, long empty          | `emissions.demandScenarios`; 1/4/8/16/32-year checkpoints                                     |
| §33.1 large up/down, lag, burn sweep                   | `emissions.priceShockTraces`, `roundingRegressions`, and `burnSweep` (0%–150%)                |
| §33.2 raise sizes, sponsor, price, backing, redemption | `bootstrap.raises` including raw-USDG genesis redemption                                      |
| §33.2 one-sided 20M LP and range depth                 | `liquidity:report`, `bootstrap.lpInventory`, `ladderRanges`, `charts/bootstrap-liquidity.svg` |
| §33.3 drift, timing, bounds, lots                      | `auctions.curve`, `driftAndAvailability`, `lotSizesAtMidpoint`                                |
| §33.3 missing makers, halts, budget accumulation       | null-fill cases plus `auctions.budgetAccumulation`                                            |
| §33.4 yield, concentration, switching                  | `managerRewards.rewardYieldByStrategy`, `voteConcentration`, `frequentSwitching`              |
| §33.4 no-lock churn, 24h delay, leakage                | `noLockStakeChurn`, `activationDelay`, `rewardLeakageVsVaultGrowth`                           |
| §33.5 below/above backing and funding source           | `redemptionAndBuyback.marketRelativeToBacking`, `revenueSourceComparison`                     |
| §33.5 mint/burn, large redemptions, LP inventory       | `simultaneousEmissionAndBurn`, `sequentialLargeRedemptions`, `lpInventorySoldOverTime`        |
