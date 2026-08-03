// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IEligibilityModule } from "../interfaces/IEligibilityModule.sol";

/// @title NoopEligibilityModule
/// @notice Unrestricted eligibility policy for local development and explicitly approved test deployments.
/// @dev This module must not be used for mainnet unless the production legal and issuer gate permits it.
contract NoopEligibilityModule is IEligibilityModule {
    /// @inheritdoc IEligibilityModule
    function canHold(address) external pure returns (bool) {
        return true;
    }

    /// @inheritdoc IEligibilityModule
    function canTransfer(address, address, uint256) external pure returns (bool) {
        return true;
    }

    /// @inheritdoc IEligibilityModule
    function canRedeem(address) external pure returns (bool) {
        return true;
    }
}
