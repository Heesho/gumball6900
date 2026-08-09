// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Core Resonance Interface
/// @author Heesho
/// @notice Minimal Resonance surface used by the other core contracts.
/// @custom:version 1.0.0
interface ICoreResonance {
    /// @notice Pulls and indexes newly routed USDG revenue.
    /// @param amount Amount of USDG to pull from the caller.
    function notifyRevenue(uint256 amount) external;

    /// @notice Returns signal weight currently allocated by an account.
    /// @param account Account whose allocation is queried.
    /// @return signalWeight Signal weight currently assigned by `account`.
    function accountSignalWeight(address account) external view returns (uint256 signalWeight);
    /// @notice Returns the reward router paired with a Strategy.
    /// @param strategy Strategy whose router is queried.
    /// @return router BribeRouter paired with `strategy`.
    function bribeRouterFor(address strategy) external view returns (address router);

    /// @notice Returns the immutable Fund used by Resonance and its reward graph.
    /// @return fundAddress Fixed Fund destination.
    function fund() external view returns (address fundAddress);
}
