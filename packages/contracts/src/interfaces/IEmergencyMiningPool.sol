// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title Emergency mining controls
/// @notice Minimal break-glass surface exposed by MiningPool.
interface IEmergencyMiningPool {
    /// @notice Pauses new contributions while preserving settlement, claims, and refunds.
    function pauseContributions() external;

    /// @notice Invalidates the current unsettled epoch so contributors can refund.
    function invalidateCurrentEpoch() external;
}
