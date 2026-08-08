// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IResonanceRouter
/// @author GUM BALL 6900
/// @notice Minimal routing surface called by Fundraiser after a contribution.
interface IResonanceRouter {
    /// @notice Routes the complete pending USDG balance to Resonance.
    /// @return amount Amount of USDG delivered to Resonance.
    function route() external returns (uint256 amount);
}
