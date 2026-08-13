// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Core Resonance Interface
/// @author Heesho
/// @notice Minimal Resonance surface used by the other core contracts.
/// @custom:version 1.0.0
interface ICoreResonance {
    /// @notice Returns whether a pending router balance may currently reset the revenue stream.
    /// @param amount Pending raw USDG amount.
    /// @return ready Whether the amount clears the minimum and remaining-revenue thresholds.
    function canNotifyRevenue(uint256 amount) external view returns (bool ready);

    /// @notice Returns whole USDG still unreleased by the current stream.
    /// @return amount Remaining raw USDG units.
    function leftRevenue() external view returns (uint256 amount);

    /// @notice Pulls and schedules newly routed USDG revenue.
    /// @param amount Amount of USDG to pull from the caller.
    function notifyRevenue(uint256 amount) external;

    /// @notice Checkpoints and transfers one Strategy's currently released USDG.
    /// @param strategy Strategy whose allocation should be transferred.
    /// @return amount Amount transferred.
    function distribute(address strategy) external returns (uint256 amount);

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
