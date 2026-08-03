// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title Emergency guardian target initializer
/// @notice One-shot target-binding surface invoked during ProtocolTimelock initialization.
interface IEmergencyGuardianTargetInitializer {
    /// @notice Binds the guardian's canonical registry and voter.
    /// @param registry The canonical AssetRegistry contract.
    /// @param allocationVoter The canonical AllocationVoter contract.
    function initializeTargets(address registry, address allocationVoter) external;

    /// @notice Permanently binds the permissioned-pool stop target, or records that this deployment has none.
    /// @param controller Canonical PermissionedPoolController, or zero for unrestricted test mode.
    function finalizePermissionedPoolController(address controller) external;
}
