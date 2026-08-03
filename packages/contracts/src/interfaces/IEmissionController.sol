// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IGBXToken } from "./IGBXToken.sol";

/// @notice Mining-only emission-controller compatibility surface.
interface IEmissionController {
    /// @notice Returns the canonical first daily scheduled emission.
    function INITIAL_DAILY_SCHEDULED_EMISSION() external view returns (uint256);
    /// @notice Returns the GBX token controlled by this scheduler.
    function gbx() external view returns (IGBXToken);
    /// @notice Returns the mining pool authorized to settle epochs.
    function miningPool() external view returns (address);
    /// @notice Returns the next epoch identifier accepted for settlement.
    function nextMiningEpochId() external view returns (uint256);
    /// @notice Returns the scheduled emission for the next epoch.
    function currentScheduledEmission() external view returns (uint256);
    /// @notice Returns the canonical scheduled emission at an epoch index.
    function scheduledEmission(uint256 epochId) external view returns (uint256);
    /// @notice Returns GBX's remaining lifetime mint capacity.
    function remainingMintCapacity() external view returns (uint256);

    /// @notice Settles one sequential mining epoch and mints only when it is nonempty.
    function settleMiningEpoch(uint256 epochId, address claimsReceiver, bool nonEmpty)
        external
        returns (uint256 emission);
}
