// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Multi-Token Reward Interface
/// @author Heesho
/// @notice Minimal Synthetix-shaped reward-stream interface used by automatic Bribe funding paths.
/// @custom:version 2.0.0
interface IBribe {
    /// @notice Returns the fixed duration required for each reward stream.
    /// @return duration Reward duration in seconds.
    function REWARD_DURATION() external view returns (uint256 duration);

    /// @notice Starts or restarts a seven-day reward stream using standard leftover rollover.
    /// @param rewardToken Token to stream.
    /// @param amount Amount pulled from the caller and added to the stream.
    function notifyRewardAmount(address rewardToken, uint256 amount) external;

    /// @notice Returns rewards remaining in a token's active stream.
    /// @param rewardToken Token whose active stream is queried.
    /// @return amount Undistributed amount remaining in the stream.
    function left(address rewardToken) external view returns (uint256 amount);
}
