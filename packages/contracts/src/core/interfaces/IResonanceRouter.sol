// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Revenue Router Interface
/// @author Heesho
/// @notice Minimal routing surface called after Mine and liquidity revenue reaches the router.
/// @custom:version 1.0.0
interface IResonanceRouter {
    /// @notice Routes the complete pending USDG balance once it clears Resonance's anti-grief thresholds.
    /// @return amount Amount delivered to Resonance, or zero while the router retains an insufficient balance.
    function route() external returns (uint256 amount);
}
