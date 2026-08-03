/**
 * Source-only Forge coverage policy.
 *
 * Percentages are integer basis points so policy evaluation never depends on
 * floating-point rounding. `minimumTotal` pins the smallest acceptable
 * instrumentation denominator and catches empty or truncated source records.
 */
export const FORGE_COVERAGE_POLICY = Object.freeze([
  // Foundry 1.7.1 instruments the contract's eleven explicit control-flow guards as eleven branches.
  policy('src/access/EmergencyGuardian.sol', [90_00, 13], [30_00, 11], [90_00, 70]),
  policy('src/access/ProtocolTimelock.sol', [95_00, 15], [60_00, 43], [90_00, 135]),
  policy('src/access/RegistryEligibilityModule.sol', [95_00, 4], [90_00, 2], [95_00, 10]),
  policy('src/libraries/EmissionMath.sol', [95_00, 2], [0, 0], [95_00, 7]),
  policy('src/libraries/GenesisLiquidityMath.sol', [95_00, 4], [15_00, 8], [80_00, 34]),
  policy('src/libraries/GenesisPriceMath.sol', [95_00, 4], [20_00, 6], [90_00, 22]),
  policy('src/libraries/MiningMath.sol', [95_00, 6], [0, 0], [95_00, 16]),
  policy('src/libraries/RateMath.sol', [95_00, 4], [0, 4], [95_00, 16]),
  policy('src/liquidity/GenesisLiquidityCalculator.sol', [95_00, 2], [0, 0], [95_00, 4]),
  policy('src/liquidity/AdapterVerificationEscrow.sol', [95_00, 4], [45_00, 14], [90_00, 51]),
  policy('src/liquidity/EligibilityAllowlistChecker.sol', [95_00, 3], [75_00, 4], [95_00, 13]),
  policy('src/liquidity/GumBallPermissionedHook.sol', [95_00, 11], [75_00, 16], [95_00, 70]),
  policy('src/liquidity/LaunchGuardHook.sol', [95_00, 4], [50_00, 8], [85_00, 27]),
  policy('src/liquidity/LiquidityManager.sol', [85_00, 18], [45_00, 36], [90_00, 254]),
  policy('src/liquidity/PermissionedLiquidityManager.sol', [95_00, 3], [20_00, 14], [75_00, 62]),
  policy('src/liquidity/PermissionedPoolController.sol', [95_00, 16], [75_00, 22], [95_00, 142]),
  policy('src/mining/ClaimsBase.sol', [95_00, 6], [10_00, 18], [85_00, 47]),
  policy('src/mining/EmissionController.sol', [95_00, 7], [65_00, 22], [90_00, 62]),
  policy('src/mining/GenesisBootstrap.sol', [95_00, 15], [15_00, 43], [85_00, 175]),
  policy('src/mining/GenesisClaims.sol', [70_00, 4], [0, 0], [70_00, 9]),
  policy('src/mining/MiningClaims.sol', [95_00, 5], [0, 1], [95_00, 15]),
  policy('src/mining/MiningPool.sol', [95_00, 16], [20_00, 35], [85_00, 171]),
  policy('src/rewards/ManagerRewards.sol', [95_00, 11], [50_00, 15], [90_00, 97]),
  policy('src/router/GumBallRouter.sol', [95_00, 9], [20_00, 10], [90_00, 48]),
  policy('src/signal/AllocationVoter.sol', [95_00, 44], [35_00, 60], [90_00, 377]),
  policy('src/signal/StakedGBX.sol', [75_00, 11], [25_00, 10], [85_00, 46]),
  policy('src/strategies/AcquisitionStrategy.sol', [95_00, 11], [45_00, 32], [90_00, 128]),
  policy('src/strategies/BuybackBurnStrategy.sol', [95_00, 8], [55_00, 23], [90_00, 88]),
  policy('src/strategies/RevenueRouter.sol', [95_00, 2], [50_00, 8], [90_00, 26]),
  policy('src/token/GBXToken.sol', [95_00, 10], [75_00, 22], [90_00, 55]),
  policy('src/vault/AssetRegistry.sol', [95_00, 19], [40_00, 31], [90_00, 102]),
  policy('src/vault/GumBallVault.sol', [60_00, 6], [70_00, 12], [85_00, 55]),
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
