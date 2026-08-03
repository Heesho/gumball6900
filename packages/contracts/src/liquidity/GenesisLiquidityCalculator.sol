// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { GenesisLiquidityMath } from "../libraries/GenesisLiquidityMath.sol";
import { GenesisPriceMath } from "../libraries/GenesisPriceMath.sol";

/// @title GenesisLiquidityCalculator
/// @notice Stateless, non-upgradeable adapter around the audited v4 maximal-liquidity calculation.
/// @dev Separating pure launch math keeps LiquidityManager below EIP-170 without giving this contract custody,
///      approvals, storage, callbacks, or any privileged operation.
contract GenesisLiquidityCalculator {
    /// @notice Validates an official Uniswap SDK square-root price witness against the finalized genesis ratio.
    /// @param gbx The canonical GBX address used to determine token ordering.
    /// @param usdG The canonical USDG address used to determine token ordering.
    /// @param communityUSDG The raw community USDG accepted at genesis.
    /// @param genesisMinerGBX The fixed raw GBX allocation issued to genesis miners.
    /// @param sqrtPriceX96 The official SDK square-root price witness encoded as Q64.96.
    function validateGenesisSqrtPriceX96(
        address gbx,
        address usdG,
        uint256 communityUSDG,
        uint256 genesisMinerGBX,
        uint160 sqrtPriceX96
    ) external pure {
        GenesisPriceMath.validateSqrtPriceX96(gbx, usdG, communityUSDG, genesisMinerGBX, sqrtPriceX96);
    }

    /// @notice Computes the greatest v4 liquidity whose amount0 principal does not exceed a fixed cap.
    /// @param sqrtPriceAX96 The first range-bound square-root price in Q64.96 form.
    /// @param sqrtPriceBX96 The second range-bound square-root price in Q64.96 form.
    /// @param amount0Cap The maximum amount0 principal.
    /// @return liquidity The greatest representable liquidity within the cap.
    /// @return principal The exact amount0 principal consumed by that liquidity.
    function maxLiquidityForAmount0(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount0Cap)
        external
        pure
        returns (uint128 liquidity, uint256 principal)
    {
        return GenesisLiquidityMath.maxLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, amount0Cap);
    }

    /// @notice Computes the greatest v4 liquidity whose amount1 principal does not exceed a fixed cap.
    /// @param sqrtPriceAX96 The first range-bound square-root price in Q64.96 form.
    /// @param sqrtPriceBX96 The second range-bound square-root price in Q64.96 form.
    /// @param amount1Cap The maximum amount1 principal.
    /// @return liquidity The greatest representable liquidity within the cap.
    /// @return principal The exact amount1 principal consumed by that liquidity.
    function maxLiquidityForAmount1(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount1Cap)
        external
        pure
        returns (uint128 liquidity, uint256 principal)
    {
        return GenesisLiquidityMath.maxLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, amount1Cap);
    }
}
