// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { FullMath } from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title GenesisPriceMath
/// @notice Validates the official-SDK encoding of the endogenous genesis ratio in Uniswap v4 raw-token orientation.
library GenesisPriceMath {
    uint256 private constant Q192 = 1 << 192;

    error GenesisPriceMath__IdenticalTokens();
    error GenesisPriceMath__InvalidTickSpacing();
    error GenesisPriceMath__PriceDoesNotMatchAmounts(uint160 sqrtPriceX96);
    error GenesisPriceMath__PriceOutsideTickBounds(uint256 sqrtPriceX96);
    error GenesisPriceMath__ZeroAmount();

    /// @notice Validates an SDK-encoded token1-per-token0 price against the exact raw genesis ratio.
    /// @dev The caller must calculate `candidate` with Uniswap SDK `encodeSqrtRatioX96`. Validation proves that the
    ///      candidate is the unique floor square root of `(token1Amount << 192) / token0Amount` without constructing
    ///      that potentially wider-than-256-bit intermediate onchain.
    /// @param gbx The GBX token address used to determine canonical currency ordering.
    /// @param usdG The USDG token address used to determine canonical currency ordering.
    /// @param communityUSDG The raw community USDG accepted at genesis.
    /// @param genesisMinerGBX The raw GBX amount allocated to genesis community claims.
    /// @param candidate The official-SDK square-root price candidate encoded as Q64.96.
    function validateSqrtPriceX96(
        address gbx,
        address usdG,
        uint256 communityUSDG,
        uint256 genesisMinerGBX,
        uint160 candidate
    ) internal pure {
        if (gbx == usdG) revert GenesisPriceMath__IdenticalTokens();
        if (communityUSDG == 0 || genesisMinerGBX == 0) revert GenesisPriceMath__ZeroAmount();
        if (candidate < TickMath.MIN_SQRT_PRICE || candidate >= TickMath.MAX_SQRT_PRICE) {
            revert GenesisPriceMath__PriceOutsideTickBounds(candidate);
        }

        uint256 token1Amount = gbx < usdG ? communityUSDG : genesisMinerGBX;
        uint256 token0Amount = gbx < usdG ? genesisMinerGBX : communityUSDG;
        if (
            !_squarePriceAtMostRatio(candidate, token1Amount, token0Amount)
                || _squarePriceAtMostRatio(candidate + 1, token1Amount, token0Amount)
        ) {
            revert GenesisPriceMath__PriceDoesNotMatchAmounts(candidate);
        }
    }

    function _squarePriceAtMostRatio(uint160 candidate, uint256 amount1, uint256 amount0) private pure returns (bool) {
        uint256 price = uint256(candidate);
        uint256 candidateWhole = FullMath.mulDiv(price, price, Q192);
        uint256 ratioWhole = amount1 / amount0;
        if (candidateWhole != ratioWhole) return candidateWhole < ratioWhole;

        uint256 candidateRemainder = mulmod(price, price, Q192);
        uint256 ratioRemainder = amount1 % amount0;
        uint256 scaledCandidateWhole = FullMath.mulDiv(candidateRemainder, amount0, Q192);
        if (scaledCandidateWhole != ratioRemainder) return scaledCandidateWhole < ratioRemainder;
        return mulmod(candidateRemainder, amount0, Q192) == 0;
    }

    /// @notice Floors a tick to its signed spacing multiple.
    /// @param tick The signed tick to align.
    /// @param tickSpacing The strictly positive canonical pool tick spacing.
    /// @return alignedTick The greatest spacing multiple less than or equal to `tick`.
    function alignTickDown(int24 tick, int24 tickSpacing) internal pure returns (int24 alignedTick) {
        if (tickSpacing <= 0) revert GenesisPriceMath__InvalidTickSpacing();
        int24 quotient = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) quotient -= 1;
        alignedTick = quotient * tickSpacing;
    }

    /// @notice Ceils a tick to its signed spacing multiple.
    /// @param tick The signed tick to align.
    /// @param tickSpacing The strictly positive canonical pool tick spacing.
    /// @return alignedTick The least spacing multiple greater than or equal to `tick`.
    function alignTickUp(int24 tick, int24 tickSpacing) internal pure returns (int24 alignedTick) {
        int24 down = alignTickDown(tick, tickSpacing);
        alignedTick = down == tick ? down : down + tickSpacing;
    }

    /// @notice Finds the nearest aligned boundary that keeps a one-sided position on the GBX side of the price.
    /// @dev Uniswap v4 ranges are half-open: `tick == tickLower` enters the active range while
    ///      `tick == tickUpper` is above it. A token0 boundary therefore advances when the actual square-root price
    ///      is inside an otherwise aligned current tick. Exact equality is safe because it requires zero token1.
    /// @param currentSqrtPriceX96 The actual initialized square-root price in Q64.96 form.
    /// @param tick The tick returned for `sqrtPriceX96`.
    /// @param tickSpacing The strictly positive canonical pool tick spacing.
    /// @param gbxIsToken0 Whether GBX is the pool's token0 currency.
    /// @return boundary The aligned lower boundary for token0 GBX or upper boundary for token1 GBX.
    function oneSidedGBXBoundary(uint160 currentSqrtPriceX96, int24 tick, int24 tickSpacing, bool gbxIsToken0)
        internal
        pure
        returns (int24 boundary)
    {
        if (!gbxIsToken0) return alignTickDown(tick, tickSpacing);

        boundary = alignTickUp(tick, tickSpacing);
        if (TickMath.getSqrtPriceAtTick(boundary) < currentSqrtPriceX96) boundary += tickSpacing;
    }
}
