// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title ICoreVoter
/// @author GUM BALL 6900
/// @notice Minimal Voter surface used by the other core contracts.
interface ICoreVoter {
    /// @notice Pulls and indexes newly routed USDG revenue.
    /// @param amount Amount of USDG to pull from the caller.
    function notifyRevenue(uint256 amount) external;

    /// @notice Returns voting weight currently allocated by an account.
    /// @param account Account whose allocation is queried.
    /// @return usedWeight Voting weight currently assigned by `account`.
    function accountUsedWeight(address account) external view returns (uint256 usedWeight);
    /// @notice Returns the acquisition payment share streamed to voters.
    /// @return shareBps Reward share expressed in basis points.
    function bribeBps() external view returns (uint256 shareBps);
    /// @notice Returns the reward router paired with a Strategy.
    /// @param strategy Strategy whose router is queried.
    /// @return router BribeRouter paired with `strategy`.
    function bribeRouterFor(address strategy) external view returns (address router);
}
