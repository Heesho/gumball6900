// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @notice Administrative surface for the daily mining pool.
interface IMiningPool {
    /// @notice Starts epoch zero after deployment invariants are satisfied.
    function start() external;
    /// @notice Stops new contributions without blocking settlement or claims.
    function pauseContributions() external;
    /// @notice Re-enables new contributions.
    function resumeContributions() external;
    /// @notice Updates the optional team-fee receiver.
    function setTeamAddress(address team) external;
}
