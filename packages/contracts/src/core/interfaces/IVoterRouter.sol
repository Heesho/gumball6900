// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IVoterRouter
/// @author GUM BALL 6900
/// @notice Minimal routing surface called by Fundraiser after a contribution.
interface IVoterRouter {
    /// @notice Routes the complete pending USDG balance to Voter.
    /// @return amount Amount of USDG delivered to Voter.
    function route() external returns (uint256 amount);
}
