// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title Emergency liquidity controls
/// @notice Minimal break-glass surface exposed by LiquidityManager.
interface IEmergencyLiquidityManager {
    /// @notice Pauses new timelocked liquidity migrations.
    function pauseMigrations() external;
}
