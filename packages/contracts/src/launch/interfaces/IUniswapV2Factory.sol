// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title Minimal Uniswap V2 Factory Interface
/// @author heesho
/// @notice Exposes only the canonical pair lookup and creation operations needed during GBX launch.
interface IUniswapV2Factory {
    /// @notice Creates the unique pair for two distinct tokens.
    /// @param tokenA One pair token in arbitrary order.
    /// @param tokenB The other pair token in arbitrary order.
    /// @return pair Newly deployed canonical pair.
    function createPair(address tokenA, address tokenB) external returns (address pair);

    /// @notice Returns the canonical pair registered for two tokens, or zero when none exists.
    /// @param tokenA One pair token in arbitrary order.
    /// @param tokenB The other pair token in arbitrary order.
    /// @return pair Registered pair address or zero.
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}
