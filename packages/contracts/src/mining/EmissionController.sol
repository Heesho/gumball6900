// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IEmissionController } from "../interfaces/IEmissionController.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { EmissionMath } from "../libraries/EmissionMath.sol";

/// @title EmissionController
/// @notice Mining-only sequential scheduler for the 980M post-genesis allocation.
/// @dev A replacement controller is deliberately trusted to choose a faster schedule, but GBX always enforces 1B.
contract EmissionController is IEmissionController {
    /// @notice Canonical first scheduled daily emission for the 980M post-genesis allocation.
    /// @dev floor(980M ether * (1 - 2^(-1/1460))) at full token-wei precision.
    uint256 public constant override INITIAL_DAILY_SCHEDULED_EMISSION = 465_152_749_681_042_811_702_004;

    /// @notice Canonical GBX token whose current controller may mint.
    IGBXToken public immutable override gbx;
    /// @notice Mining pool exclusively authorized to settle epochs.
    address public immutable override miningPool;

    /// @notice Next sequential epoch identifier accepted for settlement.
    uint256 public override nextMiningEpochId;
    /// @notice Scheduled emission for the next epoch.
    uint256 public override currentScheduledEmission;

    error EmissionController__ControllerMismatch(address configuredController);
    error EmissionController__InvalidConfiguration();
    error EmissionController__UnexpectedEpoch(uint256 expected, uint256 provided);
    error EmissionController__Unauthorized(address caller);
    error EmissionController__ZeroReceiver();

    event EmissionController__MiningEpochSettled(
        uint256 indexed epochId,
        address indexed claimsReceiver,
        bool nonEmpty,
        uint256 emission,
        uint256 scheduledEmission,
        uint256 nextScheduledEmission
    );

    /// @notice Configures a sequential scheduler at an explicit epoch and emission checkpoint.
    /// @param gbx_ Canonical token whose currently authorized controller may mint.
    /// @param miningPool_ Only caller allowed to settle an epoch.
    /// @param nextEpochId_ Next epoch expected by this controller (zero for the initial controller).
    /// @param scheduledEmission_ Scheduled amount for nextEpochId_ (canonical initial amount for initial deployment).
    constructor(IGBXToken gbx_, address miningPool_, uint256 nextEpochId_, uint256 scheduledEmission_) {
        if (
            address(gbx_) == address(0) || address(gbx_).code.length == 0 || miningPool_ == address(0)
                || miningPool_.code.length == 0 || scheduledEmission_ > gbx_.MAX_CUMULATIVE_MINT()
        ) revert EmissionController__InvalidConfiguration();

        gbx = gbx_;
        miningPool = miningPool_;
        nextMiningEpochId = nextEpochId_;
        currentScheduledEmission = scheduledEmission_;
    }

    /// @notice Advances exactly one daily schedule step and mints the complete available amount iff nonempty.
    function settleMiningEpoch(uint256 epochId, address claimsReceiver, bool nonEmpty)
        external
        override
        returns (uint256 emission)
    {
        if (msg.sender != miningPool) revert EmissionController__Unauthorized(msg.sender);
        address configured = gbx.emissionController();
        if (configured != address(this)) revert EmissionController__ControllerMismatch(configured);
        if (claimsReceiver == address(0)) revert EmissionController__ZeroReceiver();
        if (epochId != nextMiningEpochId) revert EmissionController__UnexpectedEpoch(nextMiningEpochId, epochId);

        uint256 scheduled = currentScheduledEmission;
        nextMiningEpochId = epochId + 1;
        currentScheduledEmission = EmissionMath.decayOneEpoch(scheduled);

        if (nonEmpty) {
            emission = Math.min(scheduled, gbx.remainingMintCapacity());
            if (emission != 0) gbx.mintMiningEmission(claimsReceiver, emission);
        }

        emit EmissionController__MiningEpochSettled(
            epochId, claimsReceiver, nonEmpty, emission, scheduled, currentScheduledEmission
        );
    }

    /// @notice Returns the canonical floor-rounded scheduled emission for an epoch index.
    function scheduledEmission(uint256 epochId) external pure override returns (uint256) {
        return EmissionMath.scheduledEmissionAt(INITIAL_DAILY_SCHEDULED_EMISSION, epochId);
    }

    /// @notice Returns GBX's remaining lifetime mint capacity.
    function remainingMintCapacity() external view override returns (uint256) {
        return gbx.remainingMintCapacity();
    }
}
