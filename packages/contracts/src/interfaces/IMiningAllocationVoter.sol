// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IMiningAllocationVoter
/// @notice Revenue-notification boundary used by genesis and recurring mining.
interface IMiningAllocationVoter {
    /// @notice Fixed event metadata values shared with AllocationVoter.
    enum RevenueSource {
        GenesisBootstrap,
        MiningPool,
        RevenueRouter,
        LiquidityManager
    }

    /// @notice Accounts newly deposited physical vault USDG against active strategy weights.
    /// @param amount The observed raw USDG deposit.
    /// @param source The fixed revenue-source metadata value.
    function notifyRevenue(uint256 amount, RevenueSource source) external;
}
