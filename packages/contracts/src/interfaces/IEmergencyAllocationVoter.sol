// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title Emergency allocation-voter controls
/// @notice Voter surface required for target validation, activation pause, and dead-weight cleanup.
interface IEmergencyAllocationVoter {
    /// @notice Returns the voter's immutable asset registry.
    /// @return The asset registry address.
    function ASSET_REGISTRY() external view returns (address);

    /// @notice Returns the voter's immutable protocol timelock.
    /// @return The protocol timelock address.
    function PROTOCOL_TIMELOCK() external view returns (address);

    /// @notice Returns the voter's immutable emergency guardian.
    /// @return The emergency guardian address.
    function EMERGENCY_GUARDIAN() external view returns (address);

    /// @notice Pauses maturation of pending signal increases.
    function pauseSignalActivations() external;

    /// @notice Removes a registry-disabled strategy from live allocation accounting.
    /// @param strategy The disabled strategy address.
    function disableStrategy(address strategy) external;
}
