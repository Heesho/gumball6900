// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IEligibilityRegistry
/// @notice Minimal immutable production-registry boundary used by RegistryEligibilityModule.
interface IEligibilityRegistry {
    /// @notice Returns whether an account is permitted to hold regulated assets.
    /// @param account The candidate holder.
    /// @return Whether the account may hold regulated assets.
    function canHold(address account) external view returns (bool);

    /// @notice Returns whether a transfer between two accounts is permitted.
    /// @param from The token sender.
    /// @param to The token receiver.
    /// @param amount The raw token amount.
    /// @return Whether the transfer is permitted.
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);

    /// @notice Returns whether an account is permitted to receive redemption assets.
    /// @param account The proposed redemption receiver.
    /// @return Whether the account may redeem.
    function canRedeem(address account) external view returns (bool);
}
