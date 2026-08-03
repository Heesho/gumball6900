// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IEligibilityModule
/// @notice Read-only boundary for deployment-specific holding, transfer, and redemption eligibility.
interface IEligibilityModule {
    /// @notice Returns whether an account may hold GBX and basket assets.
    /// @param account The candidate holder.
    /// @return Whether the account may hold protocol assets.
    function canHold(address account) external view returns (bool);

    /// @notice Returns whether a GBX transfer is permitted.
    /// @param from The token sender.
    /// @param to The token receiver.
    /// @param amount The raw token amount.
    /// @return Whether the transfer is permitted.
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);

    /// @notice Returns whether an account may receive an in-kind basket redemption.
    /// @param account The proposed redemption receiver.
    /// @return Whether the account may redeem.
    function canRedeem(address account) external view returns (bool);
}
