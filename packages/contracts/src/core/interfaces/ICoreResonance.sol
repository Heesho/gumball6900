// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title ICoreResonance
/// @author GUM BALL 6900
/// @notice Minimal Resonance surface used by the other core contracts.
interface ICoreResonance {
    /// @notice Pulls and indexes newly routed USDG revenue.
    /// @param amount Amount of USDG to pull from the caller.
    function notifyRevenue(uint256 amount) external;

    /// @notice Returns signal weight currently allocated by an account.
    /// @param account Account whose allocation is queried.
    /// @return signalWeight Signal weight currently assigned by `account`.
    function accountSignalWeight(address account) external view returns (uint256 signalWeight);
    /// @notice Returns the acquisition payment share streamed to signalers.
    /// @return shareBps Reward share expressed in basis points.
    function bribeBps() external view returns (uint256 shareBps);
    /// @notice Returns the reward router paired with a Strategy.
    /// @param strategy Strategy whose router is queried.
    /// @return router BribeRouter paired with `strategy`.
    function bribeRouterFor(address strategy) external view returns (address router);
}
