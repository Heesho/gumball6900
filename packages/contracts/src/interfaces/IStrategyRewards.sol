// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @notice Weight and funding surface for a single strategy rewards index.
interface IStrategyRewards {
    /// @notice Returns the strategy authorized to notify rewards.
    function STRATEGY() external view returns (address);
    /// @notice Returns the token distributed as rewards.
    function REWARD_TOKEN() external view returns (address);
    /// @notice Returns the aggregate active reward weight.
    function totalWeight() external view returns (uint256);
    /// @notice Replaces one user's reward weight.
    function setWeight(address user, uint256 newWeight) external;
    /// @notice Accounts rewards already transferred into the rewards contract.
    function notifyReward(uint256 amount) external;
}
