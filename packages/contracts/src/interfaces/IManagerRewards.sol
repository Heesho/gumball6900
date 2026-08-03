// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IManagerRewards
/// @notice Voter-facing checkpoint boundary for one strategy's reward accumulator.
interface IManagerRewards {
    /// @notice Accounts an observed reward-token deposit from the immutable associated strategy.
    /// @param amount The observed reward-token amount deposited.
    function notifyReward(uint256 amount) external;

    /// @notice Accrues rewards using the user's generation-bound weight immediately before a voter transition.
    /// @dev Must only be called by the immutable AllocationVoter.
    /// @param user The signal account being checkpointed.
    /// @param activeWeight The user's effective strategy weight before the transition.
    /// @param weightGeneration The strategy generation in which `activeWeight` earned rewards.
    function checkpointUser(address user, uint256 activeWeight, uint64 weightGeneration) external;

    /// @notice Finalizes fractional accounting after the voter has individually checkpointed the last live weight.
    /// @dev Must only be called by the immutable AllocationVoter after the strategy weight reaches zero naturally.
    ///      Finalization queues terminal dust without calling the reward token.
    function settleTerminalDust() external;

    /// @notice Retries delivery of one finalized terminal-dust cycle to GumBallVault.
    /// @dev Permissionless and exact: failed token delivery leaves every pending liability unchanged.
    /// @param generation The reward generation containing the finalized cycle.
    /// @param remainderCycle The finalized fractional-remainder cycle to sweep.
    /// @return amount The raw reward-token dust delivered to GumBallVault.
    function sweepTerminalDust(uint64 generation, uint64 remainderCycle) external returns (uint256 amount);

    /// @notice Closes the prior reward generation before a disabled strategy can later be reactivated.
    /// @dev Must only be called by the immutable AllocationVoter as it increments the strategy generation.
    /// @param nextGeneration The consecutive generation that follows the just-closed reward index.
    function advanceGeneration(uint64 nextGeneration) external;
}
