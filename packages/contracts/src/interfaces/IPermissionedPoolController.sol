// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IPermissionedPoolController
/// @notice Typed view and maintenance boundary recognized by ProtocolTimelock.
interface IPermissionedPoolController {
    /// @notice Returns the protocol timelock authorized for typed maintenance actions.
    /// @return protocolTimelock The immutable protocol timelock address.
    function PROTOCOL_TIMELOCK() external view returns (address);

    /// @notice Returns the guardian authorized only for stop actions.
    /// @return emergencyGuardian The immutable emergency guardian address.
    function EMERGENCY_GUARDIAN() external view returns (address);

    /// @notice Returns the canonical GBX permissions adapter owned by the controller.
    /// @return permissionsAdapter The permissions-adapter address, or zero before creation.
    function PERMISSIONS_ADAPTER() external view returns (address);

    /// @notice Returns the canonical permissioned hook bound to the successor graph.
    /// @return permissionedHook The hook address, or zero before graph initialization.
    function PERMISSIONED_HOOK() external view returns (address);

    /// @notice Returns whether the complete canonical permissioned-pool graph was initialized.
    /// @return initialized True only after the controller validated and bound the graph.
    function graphInitialized() external view returns (bool);

    /// @notice Changes permissioned swap availability through the protocol timelock.
    /// @param enabled Whether permissioned swaps should be enabled.
    function setSwappingEnabled(bool enabled) external;

    /// @notice Replaces the eligibility checker through the protocol timelock.
    /// @param newChecker New ERC-165-compatible allowlist checker.
    function updateAllowListChecker(address newChecker) external;

    /// @notice Changes authorization for one fixed official identity-reporting wrapper.
    /// @param wrapper One of the controller's immutable canonical wrappers.
    /// @param allowed Whether the wrapper should be authorized.
    function setAllowedWrapper(address wrapper, bool allowed) external;

    /// @notice Changes whether the canonical hook is approved for permissioned liquidity actions.
    /// @param allowed Whether the immutable canonical hook should be approved.
    function setCanonicalHookAllowed(bool allowed) external;
}
