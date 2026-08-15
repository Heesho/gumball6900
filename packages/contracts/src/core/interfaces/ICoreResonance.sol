// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Core Resonance Interface
/// @author Heesho
/// @notice Minimal Resonance surface used by the other core contracts.
/// @custom:version 1.0.0
interface ICoreResonance {
    /// @notice Adds signal on behalf of an account through the permanently bound SignalGBX coordinator.
    /// @param account Account whose allocation increases.
    /// @param strategy Live Strategy receiving signal.
    /// @param amount Absolute SignalGBX delta added.
    function addSignalFor(address account, address strategy, uint256 amount) external;

    /// @notice Removes signal on behalf of an account through the permanently bound SignalGBX coordinator.
    /// @param account Account whose allocation decreases.
    /// @param strategy Strategy losing signal; exits remain available after kill.
    /// @param amount Absolute SignalGBX delta removed.
    function removeSignalFor(address account, address strategy, uint256 amount) external;

    /// @notice Atomically moves signal between Strategies through the permanently bound SignalGBX coordinator.
    /// @param account Account whose allocation moves.
    /// @param fromStrategy Strategy losing signal.
    /// @param toStrategy Live Strategy receiving signal.
    /// @param amount Absolute SignalGBX delta moved.
    function moveSignalFor(address account, address fromStrategy, address toStrategy, uint256 amount) external;

    /// @notice Pulls and schedules newly routed USDG revenue.
    /// @param amount Amount of USDG to pull from the caller.
    function notifyRevenue(uint256 amount) external;

    /// @notice Checkpoints and transfers one Strategy's currently released USDG.
    /// @param strategy Strategy whose allocation should be transferred.
    /// @return amount Amount transferred.
    function distribute(address strategy) external returns (uint256 amount);

    /// @notice Returns exact raw reward units left in one active reward period.
    /// @param rewardToken Token whose active period is queried.
    /// @return amount Reward units not yet emitted by the active period.
    function left(address rewardToken) external view returns (uint256 amount);

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
