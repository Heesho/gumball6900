// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IBribe
/// @author GUM BALL 6900
/// @notice Minimal reward-stream interface used by BribeRouter.
interface IBribe {
    /// @notice Starts or extends a reward stream.
    /// @param rewardToken Token to stream.
    /// @param amount Amount pulled from the caller and added to the stream.
    function notifyRewardAmount(address rewardToken, uint256 amount) external;

    /// @notice Returns total virtual signal weight.
    /// @return weight Total weight assigned to the Bribe.
    function totalSupply() external view returns (uint256 weight);
    /// @notice Returns rewards remaining in a token's active stream.
    /// @param rewardToken Token whose active stream is queried.
    /// @return amount Undistributed amount remaining in the stream.
    function left(address rewardToken) external view returns (uint256 amount);
}
