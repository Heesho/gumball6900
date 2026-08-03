// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { SqrtPriceMath } from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";

/// @title GenesisLiquidityMath
/// @notice Finds the greatest integer v4 liquidity that cannot spend more than a one-sided token cap.
/// @dev A full uint128 binary search avoids periphery helper casts that revert instead of saturating on narrow ranges.
///      Every candidate is validated with v4 core's canonical rounded-up amount-delta math.
library GenesisLiquidityMath {
    error GenesisLiquidityMath__InvalidRange(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96);
    error GenesisLiquidityMath__InvariantViolation(uint256 amountCap, uint256 principal);

    /// @notice Returns maximal liquidity and actual token0 principal for a range entirely above the current price.
    /// @param sqrtPriceAX96 One Q64.96 square-root price boundary.
    /// @param sqrtPriceBX96 The other Q64.96 square-root price boundary.
    /// @param amount0Cap The maximum raw token0 amount that may be committed.
    /// @return liquidity The greatest representable v4 liquidity whose rounded-up principal does not exceed the cap.
    /// @return principal The exact rounded-up raw token0 amount required for `liquidity`.
    function maxLiquidityForAmount0(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount0Cap)
        internal
        pure
        returns (uint128 liquidity, uint256 principal)
    {
        (uint160 sqrtLower, uint160 sqrtUpper) = _orderedRange(sqrtPriceAX96, sqrtPriceBX96);

        uint128 lower;
        uint128 upper = type(uint128).max;
        while (lower < upper) {
            uint128 middle = lower + uint128((uint256(upper) - lower + 1) / 2);
            if (SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, middle, true) <= amount0Cap) {
                lower = middle;
            } else {
                upper = middle - 1;
            }
        }

        liquidity = lower;
        principal = SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity, true);
        _assertMaximalAmount0(sqrtLower, sqrtUpper, liquidity, amount0Cap, principal);
    }

    /// @notice Returns maximal liquidity and actual token1 principal for a range entirely below the current price.
    /// @param sqrtPriceAX96 One Q64.96 square-root price boundary.
    /// @param sqrtPriceBX96 The other Q64.96 square-root price boundary.
    /// @param amount1Cap The maximum raw token1 amount that may be committed.
    /// @return liquidity The greatest representable v4 liquidity whose rounded-up principal does not exceed the cap.
    /// @return principal The exact rounded-up raw token1 amount required for `liquidity`.
    function maxLiquidityForAmount1(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount1Cap)
        internal
        pure
        returns (uint128 liquidity, uint256 principal)
    {
        (uint160 sqrtLower, uint160 sqrtUpper) = _orderedRange(sqrtPriceAX96, sqrtPriceBX96);
        uint128 lower;
        uint128 upper = type(uint128).max;
        while (lower < upper) {
            uint128 middle = lower + uint128((uint256(upper) - lower + 1) / 2);
            if (SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, middle, true) <= amount1Cap) {
                lower = middle;
            } else {
                upper = middle - 1;
            }
        }
        liquidity = lower;
        principal = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity, true);
        if (principal > amount1Cap) revert GenesisLiquidityMath__InvariantViolation(amount1Cap, principal);
        if (
            liquidity != type(uint128).max
                && SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity + 1, true) <= amount1Cap
        ) {
            revert GenesisLiquidityMath__InvariantViolation(amount1Cap, principal);
        }
    }

    function _assertMaximalAmount0(
        uint160 sqrtLower,
        uint160 sqrtUpper,
        uint128 liquidity,
        uint256 amountCap,
        uint256 principal
    ) private pure {
        if (principal > amountCap) {
            revert GenesisLiquidityMath__InvariantViolation(amountCap, principal);
        }
        if (
            liquidity != type(uint128).max
                && SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity + 1, true) <= amountCap
        ) {
            revert GenesisLiquidityMath__InvariantViolation(amountCap, principal);
        }
    }

    function _orderedRange(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96)
        private
        pure
        returns (uint160 sqrtLower, uint160 sqrtUpper)
    {
        if (sqrtPriceAX96 == 0 || sqrtPriceBX96 == 0 || sqrtPriceAX96 == sqrtPriceBX96) {
            revert GenesisLiquidityMath__InvalidRange(sqrtPriceAX96, sqrtPriceBX96);
        }
        (sqrtLower, sqrtUpper) =
            sqrtPriceAX96 < sqrtPriceBX96 ? (sqrtPriceAX96, sqrtPriceBX96) : (sqrtPriceBX96, sqrtPriceAX96);
    }
}
