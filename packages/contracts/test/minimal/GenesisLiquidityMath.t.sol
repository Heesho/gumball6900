// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { SqrtPriceMath } from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";

import { GenesisLiquidityMath } from "../../src/libraries/GenesisLiquidityMath.sol";

contract GenesisLiquidityMathHarness {
    function amount0(uint160 sqrtA, uint160 sqrtB, uint256 cap)
        external
        pure
        returns (uint128 liquidity, uint256 principal)
    {
        return GenesisLiquidityMath.maxLiquidityForAmount0(sqrtA, sqrtB, cap);
    }

    function amount1(uint160 sqrtA, uint160 sqrtB, uint256 cap)
        external
        pure
        returns (uint128 liquidity, uint256 principal)
    {
        return GenesisLiquidityMath.maxLiquidityForAmount1(sqrtA, sqrtB, cap);
    }
}

contract MinimalGenesisLiquidityMathTest is Test {
    uint256 private constant GENESIS_CAP = 20_000_000 ether;

    GenesisLiquidityMathHarness private harness;

    function setUp() external {
        harness = new GenesisLiquidityMathHarness();
    }

    function test_Amount0ReturnsGreatestLiquidityWithinTwentyMillionCap() external view {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(60);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(120);

        (uint128 liquidity, uint256 principal) = harness.amount0(sqrtLower, sqrtUpper, GENESIS_CAP);

        assertLt(liquidity, type(uint128).max);
        assertLe(principal, GENESIS_CAP);
        assertGt(SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity + 1, true), GENESIS_CAP);
    }

    function test_Amount1ReturnsGreatestLiquidityWithinTwentyMillionCap() external view {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(-120);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(-60);

        (uint128 liquidity, uint256 principal) = harness.amount1(sqrtLower, sqrtUpper, GENESIS_CAP);

        assertLt(liquidity, type(uint128).max);
        assertLe(principal, GENESIS_CAP);
        assertGt(SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity + 1, true), GENESIS_CAP);
    }

    function test_Amount0SaturatesAtUint128InsteadOfReverting() external view {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(0);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(1);
        uint256 saturationPrincipal = SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, type(uint128).max, true);

        (uint128 liquidity, uint256 principal) = harness.amount0(sqrtLower, sqrtUpper, saturationPrincipal);

        assertEq(liquidity, type(uint128).max);
        assertEq(principal, saturationPrincipal);
    }

    function test_Amount1SaturatesAtUint128InsteadOfReverting() external view {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(0);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(1);
        uint256 saturationPrincipal = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, type(uint128).max, true);

        (uint128 liquidity, uint256 principal) = harness.amount1(sqrtLower, sqrtUpper, saturationPrincipal);

        assertEq(liquidity, type(uint128).max);
        assertEq(principal, saturationPrincipal);
    }

    function test_ZeroOrIdenticalPriceBoundsAreRejectedForBothAssets() external {
        vm.expectRevert(abi.encodeWithSelector(GenesisLiquidityMath.GenesisLiquidityMath__InvalidRange.selector, 0, 1));
        harness.amount0(0, 1, GENESIS_CAP);
        vm.expectRevert(abi.encodeWithSelector(GenesisLiquidityMath.GenesisLiquidityMath__InvalidRange.selector, 1, 0));
        harness.amount1(1, 0, GENESIS_CAP);
        vm.expectRevert(abi.encodeWithSelector(GenesisLiquidityMath.GenesisLiquidityMath__InvalidRange.selector, 1, 1));
        harness.amount0(1, 1, GENESIS_CAP);
    }

    function testFuzz_BothSearchesReturnTheGreatestAffordableLiquidity(
        int32 lowerSeed,
        uint16 widthSeed,
        uint64 capSeed
    ) external view {
        int24 lowerTick = int24(bound(int256(lowerSeed), -500_000, 500_000));
        int24 upperTick = lowerTick + int24(int256(bound(uint256(widthSeed), 1, 10_000)));
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lowerTick);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upperTick);
        uint256 cap = uint256(capSeed);

        (uint128 liquidity0, uint256 principal0) = harness.amount0(sqrtUpper, sqrtLower, cap);
        assertLe(principal0, cap);
        if (liquidity0 != type(uint128).max) {
            assertGt(SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity0 + 1, true), cap);
        }

        (uint128 liquidity1, uint256 principal1) = harness.amount1(sqrtUpper, sqrtLower, cap);
        assertLe(principal1, cap);
        if (liquidity1 != type(uint128).max) {
            assertGt(SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity1 + 1, true), cap);
        }
    }
}
