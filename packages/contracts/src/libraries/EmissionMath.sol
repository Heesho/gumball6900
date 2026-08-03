// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title EmissionMath
/// @notice Fixed-point helpers for the bounded daily GBX emission curve.
library EmissionMath {
    /// @notice Fixed-point denominator used by the decay calculation.
    uint256 internal constant WAD = 1e18;

    /// @notice Daily decay for a smooth four-year half-life over 1,460 daily epochs.
    uint256 internal constant DAILY_DECAY = 999_525_354_337_060_160;

    /// @notice Advances one scheduled emission by the authoritative sequential floor-rounded decay.
    /// @param currentEmission The current epoch's scheduled GBX emission in token wei.
    /// @return nextEmission The next epoch's floor-rounded scheduled emission in token wei.
    function decayOneEpoch(uint256 currentEmission) internal pure returns (uint256 nextEmission) {
        nextEmission = Math.mulDiv(currentEmission, DAILY_DECAY, WAD);
    }

    /// @notice Calculates the exact sequentially floor-rounded scheduled emission after a number of daily steps.
    /// @dev Stops early once the integer emission reaches zero, bounding even arbitrarily distant previews.
    /// @param initialEmission The zero-epoch scheduled emission.
    /// @param elapsedEpochs The number of daily decay steps.
    /// @return emission The decayed scheduled emission.
    function scheduledEmissionAt(uint256 initialEmission, uint256 elapsedEpochs)
        internal
        pure
        returns (uint256 emission)
    {
        emission = initialEmission;
        while (elapsedEpochs != 0 && emission != 0) {
            emission = decayOneEpoch(emission);
            --elapsedEpochs;
        }
    }
}
