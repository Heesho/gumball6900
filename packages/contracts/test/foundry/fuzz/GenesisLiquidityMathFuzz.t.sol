// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { SqrtPriceMath } from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";

import { GenesisLiquidityMath } from "../../../src/libraries/GenesisLiquidityMath.sol";

contract GenesisLiquidityMathHarness {
    function amount0(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 cap)
        external
        pure
        returns (uint128 liquidity, uint256 principal)
    {
        return GenesisLiquidityMath.maxLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, cap);
    }

    function amount1(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 cap)
        external
        pure
        returns (uint128 liquidity, uint256 principal)
    {
        return GenesisLiquidityMath.maxLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, cap);
    }
}

contract GenesisLiquidityMathFuzzTest is Test {
    GenesisLiquidityMathHarness private _math;

    function setUp() external {
        _math = new GenesisLiquidityMathHarness();
    }

    function test_CanonicalRobinhoodToken0VectorUsesMaximalLiquidityAndBoundsResidual() external view {
        int24[5] memory ticks = [int24(-276_300), -272_220, -265_320, -258_360, -251_400];
        uint256[4] memory caps = [uint256(10_000_000 ether), 6_000_000 ether, 3_000_000 ether, 1_000_000 ether];
        uint128[4] memory expectedLiquidity = [
            uint128(54_257_070_326_342_296_218),
            25_248_046_767_498_476_040,
            17_696_020_544_622_061_495,
            8_353_746_315_691_223_277
        ];
        uint256 principal;

        for (uint256 index; index < 4; ++index) {
            uint160 sqrtLower = TickMath.getSqrtPriceAtTick(ticks[index]);
            uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(ticks[index + 1]);
            (uint128 liquidity, uint256 used) = _math.amount0(sqrtLower, sqrtUpper, caps[index]);
            assertEq(liquidity, expectedLiquidity[index]);
            assertEq(used, SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity, true));
            assertLe(used, caps[index]);
            assertGt(SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity + 1, true), caps[index]);
            principal += used;
        }

        assertEq(20_000_000 ether - principal, 188_254);
    }

    function test_Token1OrderingIsAlsoMaximal() external view {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(-120);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(120);
        uint256 cap = 20_000_000 ether;
        (uint128 liquidity, uint256 principal) = _math.amount1(sqrtUpper, sqrtLower, cap);

        assertEq(principal, SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity, true));
        assertLe(principal, cap);
        assertGt(SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity + 1, true), cap);
    }

    function test_ExtremeValidTickRangesRemainMaximal() external view {
        uint128 halfMaximumLiquidity = type(uint128).max / 2;
        _assertAmount1MaximalForSeed(TickMath.MIN_TICK, TickMath.MIN_TICK + 60, halfMaximumLiquidity);
        _assertAmount0MaximalForSeed(TickMath.MAX_TICK - 60, TickMath.MAX_TICK, halfMaximumLiquidity);
        _assertAmount0Maximal(-60, 0, 20_000_000 ether);
        _assertAmount1Maximal(0, 60, 20_000_000 ether);
    }

    function testFuzz_Amount0IsGreatestRepresentableLiquidity(int24 rawLower, uint24 rawWidth, uint128 rawLiquidity)
        external
        view
    {
        (int24 lower, int24 upper) = _boundedTicks(rawLower, rawWidth);
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        uint128 seed = uint128(bound(uint256(rawLiquidity), 1, uint256(type(uint128).max) / 2));
        uint256 cap = SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, seed, true);

        (uint128 liquidity, uint256 principal) = _math.amount0(sqrtUpper, sqrtLower, cap);
        assertGe(liquidity, seed);
        assertEq(principal, SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity, true));
        assertLe(principal, cap);
        if (liquidity != type(uint128).max) {
            assertGt(SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity + 1, true), cap);
        }
    }

    function testFuzz_Amount1IsGreatestRepresentableLiquidity(int24 rawLower, uint24 rawWidth, uint128 rawLiquidity)
        external
        view
    {
        (int24 lower, int24 upper) = _boundedTicks(rawLower, rawWidth);
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        uint128 seed = uint128(bound(uint256(rawLiquidity), 1, uint256(type(uint128).max) / 2));
        uint256 cap = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, seed, true);

        (uint128 liquidity, uint256 principal) = _math.amount1(sqrtUpper, sqrtLower, cap);
        assertGe(liquidity, seed);
        assertEq(principal, SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity, true));
        assertLe(principal, cap);
        if (liquidity != type(uint128).max) {
            assertGt(SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity + 1, true), cap);
        }
    }

    function _assertAmount0Maximal(int24 lower, int24 upper, uint256 cap) private view {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        (uint128 liquidity, uint256 principal) = _math.amount0(sqrtLower, sqrtUpper, cap);
        assertLe(principal, cap);
        if (liquidity != type(uint128).max) {
            assertGt(SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity + 1, true), cap);
        }
    }

    function _assertAmount1Maximal(int24 lower, int24 upper, uint256 cap) private view {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        (uint128 liquidity, uint256 principal) = _math.amount1(sqrtLower, sqrtUpper, cap);
        assertLe(principal, cap);
        if (liquidity != type(uint128).max) {
            assertGt(SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity + 1, true), cap);
        }
    }

    function _assertAmount0MaximalForSeed(int24 lower, int24 upper, uint128 seed) private view {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        _assertAmount0Maximal(lower, upper, SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, seed, true));
    }

    function _assertAmount1MaximalForSeed(int24 lower, int24 upper, uint128 seed) private view {
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        _assertAmount1Maximal(lower, upper, SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, seed, true));
    }

    function _boundedTicks(int24 rawLower, uint24 rawWidth) private pure returns (int24 lower, int24 upper) {
        lower = int24(bound(int256(rawLower), int256(TickMath.MIN_TICK), int256(TickMath.MAX_TICK - 1)));
        uint256 maximumWidth = uint256(uint24(TickMath.MAX_TICK - lower));
        uint256 width = bound(uint256(rawWidth), 1, maximumWidth);
        upper = lower + int24(int256(width));
    }
}
