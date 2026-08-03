// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IGenesisLiquidityManager
/// @notice Atomic canonical-pool initialization boundary used only by GenesisBootstrap.
interface IGenesisLiquidityManager {
    /// @notice Initializes the canonical pool and seeds the complete 20 million GBX ladder.
    /// @param communityUSDG Raw community USDG used to derive the genesis clearing price.
    /// @param sqrtPriceX96 The official Uniswap SDK encoding of the exact raw genesis ratio.
    /// @return initializedSqrtPriceX96 The initialized Uniswap v4 square-root price.
    function initializeAndSeed(uint256 communityUSDG, uint160 sqrtPriceX96)
        external
        returns (uint160 initializedSqrtPriceX96);
}
