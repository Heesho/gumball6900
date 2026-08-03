// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IAssetRegistry } from "./IAssetRegistry.sol";

/// @title Emergency asset-registry controls
/// @notice Registry surface required for atomic acquisition and allocation shutdown.
interface IEmergencyAssetRegistry {
    /// @notice Returns the registry's immutable protocol timelock.
    /// @return The protocol timelock address.
    function PROTOCOL_TIMELOCK() external view returns (address);

    /// @notice Returns the registry's immutable emergency guardian.
    /// @return The emergency guardian address.
    function EMERGENCY_GUARDIAN() external view returns (address);

    /// @notice Disables new acquisition for a registered token.
    /// @param token The registered token whose acquisition strategy is disabled.
    function disableAcquisition(address token) external;

    /// @notice Disables a registered standalone strategy.
    /// @param strategy The standalone strategy address.
    function disableStandaloneStrategy(address strategy) external;

    /// @notice Returns the immutable registry metadata for a token.
    /// @param token The registered token address.
    /// @return The asset configuration.
    function configFor(address token) external view returns (IAssetRegistry.AssetConfig memory);
}
