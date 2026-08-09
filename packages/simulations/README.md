# GUM BALL 6900 economic simulations

This package contains reproducible TypeScript and independent Python models for the minimal protocol mechanics. The models are deterministic test oracles, not forecasts, NAV calculations, price promises, deployment configurations, or investment projections.

## Units and rounding

- Canonical USDG uses raw 6-decimal units (`1 USDG = 1_000_000`).
- GBX and modeled target assets use raw 18-decimal units.
- The one-time constructor mint is exactly 20M GBX. There is no public genesis bootstrap or 80M miner allocation.
- The nominal mining allocation is 980M GBX. Epoch zero is independently derived as `floor(980M ether * (1 - 2^(-1/1460)))`; later epochs sequentially floor `current * 999_525_354_337_060_160 / 1e18` exactly like Solidity.
- Every non-empty mining epoch receives its complete cap-bounded schedule regardless of contribution size. Empty epochs mint zero, advance, and permanently forfeit their schedule.
- Auction payment is `initPrice - floor(initPrice * elapsed / epochPeriod)` for `elapsed <= epochPeriod`, and zero afterward. The next init price floors the quoted-payment multiplier before min/max clamping.
- Strategy reward notifications independently floor a `1e27` reward index. Unrepresented residue stays in the reward contract and is not carried into the next index update.
- All financial values in committed JSON are decimal strings. Neither model uses floating-point financial arithmetic.

## Coverage

`fixtures/economic-scenarios.json` covers:

- the exact 20M genesis / 980M mining split, four-year half-life derivation, sequential lifetime sum and residual;
- large and one-atomic-unit non-empty contributions producing identical emissions, plus sporadic and long empty periods;
- burn sweeps that change current supply without reopening cumulative mint capacity;
- deployment-script-only one-position genesis budgeting and residual burn policy;
- AuctionEngine endpoints, last-second rounding, multiplier transitions, and bounds;
- immediate floor-index supporter rewards, 98/2 acquisition routing, and zero-weight vault routing;
- strategy-budget conservation, explicit Fund-held GBX burns, and raw-basket redemptions.

The smaller `fixtures/reference-results.json` is the SDK formula-vector fixture. Both fixtures are checked across TypeScript and Python, and each language also asserts the important mechanics independently of fixture parity.

## Commands

Use Python `3.11.x` and install the exact test toolchain. CI evidence uses the exact `3.11.9` patch recorded in `.python-version`:

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

Only run `fixtures:generate` after intentionally changing a protocol formula. It refuses to write unless both language models agree, then regenerates the committed SVGs.

`liquidity:report` is an illustrative one-position v4 mechanics scenario using the pinned official Uniswap SDK, both currency orderings, and explicit tick assumptions. It is not a canonical deployment configuration. Production price, fee, spacing, and range remain explicit deployment inputs.

## Traceability

| Requirement                             | Fixture path / evidence                                                   |
| --------------------------------------- | ------------------------------------------------------------------------- |
| 20M genesis and no bootstrap            | `assumptions.genesisSupply`, `genesisLiquidity`                           |
| 980M half-life schedule                 | `assumptions.initialDailyScheduledEmission`, `emissions.scheduleLifetime` |
| Full non-empty / forfeited empty epochs | `emissions.participationScenarios`, `roundingRegressions`                 |
| Burns do not reopen emissions           | `emissions.burnSweep`                                                     |
| give.fun auction rounding               | `auctions.curve`, `auctions.transitions`, `auctions.bounds`               |
| 1e27 reward floor and residue           | `bribeRewards.rewardIndexExamples`                                        |
| Independent Bribe reward yields         | `bribeRewards.rewardYieldByStrategy`                                      |
| Uniform 100% Fund settlement            | `bribeRewards.strategySettlementConservation`                             |
| Raw redemptions and explicit GBX burns  | `redemptionAndGbxBurn`                                                    |
