// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IEmergencyPermissionedPoolController
/// @notice Stop-only boundary exposed to EmergencyGuardian by the canonical permissioned-pool controller.
interface IEmergencyPermissionedPoolController {
    /// @notice Returns the guardian contract authorized for stop-only actions.
    function EMERGENCY_GUARDIAN() external view returns (address);

    /// @notice Disables permissioned swaps without changing custody or eligibility.
    function emergencyDisableSwapping() external;

    /// @notice Disables future liquidity additions through the canonical permissioned hook.
    function emergencyDisableLiquidity() external;
}
