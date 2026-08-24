// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title GumBall6900 Multi-Token Reward Interface
/// @author heesho
/// @notice Exposes the reward-stream operations required by a Strategy's automatic Bribe funding path.
/// @dev BribeRouter uses this minimal surface to determine when its complete payment-token balance qualifies for a
///      seven-day notification. Implementations are expected to pull standard ERC-20 tokens from the caller, apply
///      whole-unit-per-second Synthetix-style leftover rollover, and reject under-threshold funding.
interface IBribe {
    /// @notice Pulls fresh funding from the caller and starts or restarts a registered token's reward stream.
    /// @dev During an active stream, the implementation combines `amount` with the scheduled reward remaining and
    ///      rounds the new whole-unit-per-second rate down over `REWARD_DURATION`. The fresh amount must meet both the
    ///      duration and remaining-reward thresholds; implementation-specific registry and lifetime-cap checks apply.
    /// @param rewardToken Registered standard ERC-20 token to pull and stream.
    /// @param amount Fresh raw token units pulled from the caller.
    function notifyReward(address rewardToken, uint256 amount) external;

    /// @notice Returns the fixed duration assigned to each reward stream.
    /// @return duration Reward duration in seconds; the production implementation returns seven days.
    function REWARD_DURATION() external view returns (uint256 duration);

    /// @notice Returns raw token units still scheduled in a token's active reward stream.
    /// @dev The value is zero after the period finishes and excludes already elapsed rewards, direct donations, and
    ///      any surplus produced when the stream rate was rounded down.
    /// @param rewardToken Reward token whose active stream is queried.
    /// @return amount Raw token units remaining at the stored whole-unit-per-second rate.
    function remainingReward(address rewardToken) external view returns (uint256 amount);
}
