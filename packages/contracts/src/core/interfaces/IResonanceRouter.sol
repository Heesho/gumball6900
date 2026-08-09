// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Revenue Router Interface
/// @author Heesho
/// @notice Minimal routing surface called by Fundraiser after a contribution.
/// @custom:version 1.0.0
interface IResonanceRouter {
    /// @notice Routes the complete pending USDG balance to Resonance.
    /// @return amount Amount of USDG delivered to Resonance.
    function route() external returns (uint256 amount);
}
