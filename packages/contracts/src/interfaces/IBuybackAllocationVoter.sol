// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title Buyback strategy allocation-voter controls
/// @notice Budget-checkpoint surface consumed by BuybackBurnStrategy.
interface IBuybackAllocationVoter {
    /// @notice Materializes and returns one strategy's current virtual USDG budget.
    /// @param strategy The strategy whose budget is checkpointed.
    /// @return budget The raw USDG virtual budget after checkpointing.
    function checkpointStrategyBudget(address strategy) external returns (uint256 budget);

    /// @notice Returns one strategy's last materialized virtual USDG budget.
    /// @param strategy The strategy whose stored budget is queried.
    /// @return budget The raw stored USDG virtual budget.
    function strategyBudget(address strategy) external view returns (uint256 budget);
}
