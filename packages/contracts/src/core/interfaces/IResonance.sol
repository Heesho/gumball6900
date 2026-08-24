// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Resonance Interface
/// @notice Minimal Resonance surface used by the other core contracts.
interface IResonance {
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

    /// @notice Pulls and schedules newly routed USDG revenue.
    /// @param amount Amount of USDG to pull from the caller.
    function notifyRevenue(uint256 amount) external;

    /// @notice Checkpoints and transfers one Strategy's currently released USDG.
    /// @param strategy Strategy whose allocation should be transferred.
    /// @return amount Amount transferred.
    function distributeRevenue(address strategy) external returns (uint256 amount);

    /// @notice Returns the fixed duration of each Resonance reward period.
    /// @return duration Reward duration in seconds.
    function REWARD_DURATION() external view returns (uint256 duration);

    /// @notice Returns the governance-selected share of new Strategy payments assigned to paired Bribes.
    /// @return basisPoints Current share in basis points.
    function bribeBps() external view returns (uint256 basisPoints);

    /// @notice Returns whole raw USDG units remaining at the active period's stored rate.
    /// @return amount USDG units not yet emitted by the active period.
    function remainingRevenue() external view returns (uint256 amount);

    /// @notice Returns the reward router paired with a Strategy.
    /// @param strategy Strategy whose router is queried.
    /// @return router BribeRouter paired with `strategy`.
    function bribeRouterFor(address strategy) external view returns (address router);
}
