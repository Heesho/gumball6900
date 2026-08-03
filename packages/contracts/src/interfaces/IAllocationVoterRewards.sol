// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IAllocationVoterRewards
/// @notice ManagerRewards-facing voter views and permissionless user checkpoint.
interface IAllocationVoterRewards {
    /// @notice Returns the current effective aggregate signal weight for a strategy.
    /// @param strategy The directly deployed strategy address.
    /// @return The aggregate active sGBX weight.
    function strategyWeight(address strategy) external view returns (uint256);

    /// @notice Activates matured pending signals and checkpoints every associated reward accumulator for a user.
    /// @param user The signal account to checkpoint.
    function checkpointUser(address user) external;

    /// @notice Returns the user's current effective active signal weight for one strategy.
    /// @param user The signal account.
    /// @param strategy The directly deployed strategy address.
    /// @return The user's effective active weight.
    function activeWeight(address user, address strategy) external view returns (uint256);

    /// @notice Returns the stored weight and generation still entitled to an uncheckpointed reward index.
    /// @dev Unlike `activeWeight`, this view deliberately exposes stale pre-disable weight until it is checkpointed.
    /// @param user The signal account.
    /// @param strategy The directly deployed strategy address.
    /// @return weight The stored current- or prior-generation weight used for reward settlement.
    /// @return generation The generation in which that weight was active.
    function rewardWeight(address user, address strategy) external view returns (uint256 weight, uint64 generation);
}
