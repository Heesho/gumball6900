// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title Emergency strategy controls
/// @notice Minimal fill-pause surface shared by acquisition and buyback strategies.
interface IEmergencyStrategy {
    /// @notice Pauses new auction fills.
    function pauseFills() external;
}
