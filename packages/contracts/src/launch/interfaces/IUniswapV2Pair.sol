// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Minimal Uniswap V2 Pair Interface
/// @author heesho
/// @notice Exposes the immutable identities, reserves, and direct-liquidity mint used during GBX launch.
interface IUniswapV2Pair is IERC20 {
    /// @notice Mints LP units for token balances deposited since the last reserve update.
    /// @param to Account receiving the provider liquidity.
    /// @return liquidity Raw LP units minted for the deposited amounts.
    function mint(address to) external returns (uint256 liquidity);

    /// @notice Returns the Factory that deployed this pair.
    function factory() external view returns (address);

    /// @notice Returns the last synchronized reserves in token order and their timestamp accumulator input.
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);

    /// @notice Returns the lower-address pair token.
    function token0() external view returns (address);

    /// @notice Returns the higher-address pair token.
    function token1() external view returns (address);
}
