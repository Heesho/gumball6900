// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { RateMath } from "../../../src/libraries/RateMath.sol";

contract RateMathHarness {
    function quote(uint256 usdGAmount, uint256 rateWad, uint8 usdGDecimals, uint8 assetDecimals)
        external
        pure
        returns (uint256)
    {
        return RateMath.quoteAssetAmount(usdGAmount, rateWad, usdGDecimals, assetDecimals);
    }

    function clearing(uint256 assetAmount, uint256 usdGAmount, uint8 usdGDecimals, uint8 assetDecimals)
        external
        pure
        returns (uint256)
    {
        return RateMath.clearingRateWad(assetAmount, usdGAmount, usdGDecimals, assetDecimals);
    }
}

contract RateMathFuzzTest is Test {
    RateMathHarness private _math;

    function setUp() external {
        _math = new RateMathHarness();
    }

    function test_QuotesSixDecimalUSDGIntoEighteenDecimalAsset() external view {
        assertEq(_math.quote(1e6, 1e18, 6, 18), 1e18);
        assertEq(_math.clearing(1e18, 1e6, 6, 18), 1e18);
    }

    function test_QuotesEighteenDecimalUSDGIntoSixDecimalAsset() external view {
        assertEq(_math.quote(1e18, 1e18, 18, 6), 1e6);
        assertEq(_math.clearing(1e6, 1e18, 18, 6), 1e18);
    }

    function test_QuotesEqualDecimalTokensWithoutChangingRawScale() external view {
        assertEq(_math.quote(1e8, 1e18, 8, 8), 1e8);
        assertEq(_math.clearing(1e8, 1e8, 8, 8), 1e18);
    }

    function test_QuoteRoundsDustUpAndClearingRateRoundsDown() external view {
        assertEq(_math.quote(1, 1, 6, 18), 1);
        assertEq(_math.clearing(1, 1, 6, 18), 1e6);
        assertEq(_math.clearing(0, 1, 6, 18), 0);
    }

    function test_MulDivHandlesOverflowingIntermediateProduct() external view {
        uint256 usdGAmount = uint256(1) << 200;
        assertEq(_math.quote(usdGAmount, 1e18, 18, 18), usdGAmount);
        assertEq(_math.clearing(usdGAmount, usdGAmount, 18, 18), 1e18);
    }

    function testFuzz_QuoteIsTheMinimumRawPaymentAtOrAboveRate(
        uint128 rawUSDG,
        uint128 rateWad,
        uint8 usdGDecimals,
        uint8 assetDecimals
    ) external view {
        uint256 usdGAmount = bound(uint256(rawUSDG), 1, type(uint128).max);
        uint256 rate = bound(uint256(rateWad), 1, type(uint128).max);
        uint8 quoteDecimals = uint8(bound(uint256(usdGDecimals), 0, 18));
        uint8 receivedDecimals = uint8(bound(uint256(assetDecimals), 0, 18));

        uint256 quoted = _math.quote(usdGAmount, rate, quoteDecimals, receivedDecimals);
        assertGt(quoted, 0);
        assertGe(_math.clearing(quoted, usdGAmount, quoteDecimals, receivedDecimals), rate);
        assertLt(_math.clearing(quoted - 1, usdGAmount, quoteDecimals, receivedDecimals), rate);
    }

    function testFuzz_OverflowSafeForWideUSDGAmounts(uint200 rawUSDG, uint64 rateWad) external view {
        uint256 usdGAmount = bound(uint256(rawUSDG), 1, type(uint200).max);
        uint256 rate = bound(uint256(rateWad), 1, 1e18);
        uint256 quoted = _math.quote(usdGAmount, rate, 18, 18);
        assertGe(_math.clearing(quoted, usdGAmount, 18, 18), rate);
    }
}
