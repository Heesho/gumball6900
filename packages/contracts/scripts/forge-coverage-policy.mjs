/**
 * Source-only Forge coverage policy for the current direct core.
 *
 * Percentages are integer basis points so policy evaluation never depends on
 * floating-point rounding. `minimumTotal` pins the smallest acceptable
 * instrumentation denominator and catches empty, stale, or truncated records.
 */
export const FORGE_COVERAGE_POLICY = Object.freeze([
  policy('src/core/Bribe.sol', [90_00, 34], [70_00, 60], [90_00, 288]),
  policy('src/core/BribeFactory.sol', [95_00, 2], [95_00, 3], [95_00, 10]),
  policy('src/core/BribeRouter.sol', [95_00, 5], [70_00, 7], [95_00, 43]),
  policy('src/core/Fund.sol', [95_00, 8], [95_00, 9], [95_00, 46]),
  // Mine is the new distribution boundary. Final thresholds remain a release gate until the current report is recorded.
  policy('src/core/Mine.sol', [85_00, 12], [75_00, 25], [90_00, 120]),
  policy('src/core/GBX.sol', [95_00, 4], [95_00, 14], [95_00, 34]),
  // Genuine PositionManager integration is measured separately; this floor covers the default mock/deep suite.
  policy('src/core/LiquidityPosition.sol', [50_00, 8], [50_00, 24], [55_00, 102]),
  policy('src/core/Resonance.sol', [95_00, 27], [80_00, 51], [95_00, 197]),
  policy('src/core/ResonanceRouter.sol', [95_00, 3], [95_00, 3], [95_00, 17]),
  policy('src/core/SignalGBX.sol', [95_00, 11], [95_00, 13], [95_00, 63]),
  policy('src/core/Strategy.sol', [95_00, 7], [95_00, 17], [95_00, 69]),
  policy('src/core/StrategyFactory.sol', [95_00, 2], [95_00, 3], [95_00, 11]),
]);

function policy(path, functions, branches, lines) {
  return Object.freeze({
    path,
    functions: floor(...functions),
    branches: floor(...branches),
    lines: floor(...lines),
  });
}

function floor(minimumBasisPoints, minimumTotal) {
  return Object.freeze({ minimumBasisPoints, minimumTotal });
}
