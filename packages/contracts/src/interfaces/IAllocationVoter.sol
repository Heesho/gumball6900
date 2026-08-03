// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IAllocationVoter
/// @notice Vault-facing boundary for virtual USDG budget accounting.
interface IAllocationVoter {
    /// @notice Checkpoints a user's matured signals and rewards immediately before sGBX is minted.
    /// @dev Must only be called by the immutable StakedGBX contract.
    /// @param user The account receiving newly staked sGBX.
    function onStake(address user) external;

    /// @notice Removes enough pending and active signal weight before sGBX is burned.
    /// @dev Must only be called by StakedGBX and must leave assigned weight within the post-unstake balance.
    /// @param user The account unstaking sGBX.
    /// @param amount The amount of sGBX being burned.
    function onUnstake(address user, uint256 amount) external;

    /// @notice Consumes a strategy's virtual USDG budget before the vault releases physical USDG.
    /// @dev Must only be callable by the immutable GumBallVault.
    /// @param strategy The live strategy spending its budget.
    /// @param amount The raw USDG budget amount consumed.
    function consumeStrategyBudget(address strategy, uint256 amount) external;

    /// @notice Scales every virtual budget by (supplyBefore - shares) / supplyBefore before a redemption burn.
    /// @dev The strategy universe is bounded, so the implementation may checkpoint and iterate over all live strategies.
    /// @param shares The GBX shares being redeemed.
    /// @param supplyBefore The total GBX supply before the redemption burn.
    function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external;
}
