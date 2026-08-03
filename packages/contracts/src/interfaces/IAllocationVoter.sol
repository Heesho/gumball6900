// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @notice Virtual USDG allocation and signal-accounting surface.
interface IAllocationVoter {
    /// @notice Returns the user's total active signal weight.
    function usedWeight(address user) external view returns (uint256);
    /// @notice Returns the aggregate active signal weight.
    function totalActiveWeight() external view returns (uint256);
    /// @notice Returns the active signal weight assigned to a strategy.
    function strategyWeight(address strategy) external view returns (uint256);
    /// @notice Previews the strategy's currently accrued USDG budget.
    function previewStrategyBudget(address strategy) external view returns (uint256);
    /// @notice Accounts newly deposited USDG revenue for signal allocation.
    function notifyRevenue(uint256 amount) external;
    /// @notice Consumes USDG budget assigned to a live strategy.
    function consumeStrategyBudget(address strategy, uint256 amount) external;
    /// @notice Scales all accounted budgets after an in-kind GBX redemption.
    function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external;
    /// @notice Terminally removes a registry-disabled strategy from allocation.
    function disableStrategy(address strategy) external;
    /// @notice Stops signal-weight increases while preserving reductions and exits.
    function pauseSignalIncreases() external;
    /// @notice Re-enables signal-weight increases.
    function resumeSignalIncreases() external;
}
