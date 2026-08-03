// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IEligibilityModule } from "../interfaces/IEligibilityModule.sol";
import { IEligibilityRegistry } from "../interfaces/IEligibilityRegistry.sol";

/// @title RegistryEligibilityModule
/// @notice Immutable adapter for a counsel-approved production eligibility registry.
contract RegistryEligibilityModule is IEligibilityModule {
    error RegistryEligibilityModule__ZeroRegistry();
    error RegistryEligibilityModule__RegistryHasNoCode(address registry);

    /// @notice Immutable external compliance registry queried by every eligibility decision.
    IEligibilityRegistry public immutable ELIGIBILITY_REGISTRY;

    /// @notice Wires the production registry once at deployment.
    /// @param registry_ Counsel- and issuer-approved registry contract.
    constructor(address registry_) {
        if (registry_ == address(0)) revert RegistryEligibilityModule__ZeroRegistry();
        if (registry_.code.length == 0) revert RegistryEligibilityModule__RegistryHasNoCode(registry_);
        ELIGIBILITY_REGISTRY = IEligibilityRegistry(registry_);
    }

    /// @inheritdoc IEligibilityModule
    function canHold(address account) external view returns (bool) {
        return ELIGIBILITY_REGISTRY.canHold(account);
    }

    /// @inheritdoc IEligibilityModule
    function canTransfer(address from, address to, uint256 amount) external view returns (bool) {
        return ELIGIBILITY_REGISTRY.canTransfer(from, to, amount);
    }

    /// @inheritdoc IEligibilityModule
    function canRedeem(address account) external view returns (bool) {
        return ELIGIBILITY_REGISTRY.canRedeem(account);
    }
}
