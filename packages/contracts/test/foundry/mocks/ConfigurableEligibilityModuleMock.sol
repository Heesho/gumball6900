// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";

/// @title ConfigurableEligibilityModuleMock
/// @notice Test-only eligibility module with configurable allow and failure modes.
contract ConfigurableEligibilityModuleMock is IEligibilityModule {
    bool public holdAllowed = true;
    bool public transferAllowed = true;
    bool public redeemAllowed = true;
    bool public checksRevert;

    /// @notice Configures holder eligibility.
    function setHoldAllowed(bool allowed) external {
        holdAllowed = allowed;
    }

    /// @notice Configures transfer eligibility.
    function setTransferAllowed(bool allowed) external {
        transferAllowed = allowed;
    }

    /// @notice Configures redemption-receiver eligibility.
    function setRedeemAllowed(bool allowed) external {
        redeemAllowed = allowed;
    }

    /// @notice Configures every eligibility check to revert.
    function setChecksRevert(bool shouldRevert) external {
        checksRevert = shouldRevert;
    }

    /// @inheritdoc IEligibilityModule
    function canHold(address) external view returns (bool) {
        if (checksRevert) revert("ELIGIBILITY_CHECK_REVERTED");
        return holdAllowed;
    }

    /// @inheritdoc IEligibilityModule
    function canTransfer(address, address, uint256) external view returns (bool) {
        if (checksRevert) revert("ELIGIBILITY_CHECK_REVERTED");
        return transferAllowed;
    }

    /// @inheritdoc IEligibilityModule
    function canRedeem(address) external view returns (bool) {
        if (checksRevert) revert("ELIGIBILITY_CHECK_REVERTED");
        return redeemAllowed;
    }
}
