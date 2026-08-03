// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IEligibilityModule } from "../interfaces/IEligibilityModule.sol";
import { IUniswapAllowlistChecker, PermissionFlag, PermissionFlags } from "../interfaces/IUniswapPermissionedPools.sol";

/// @title EligibilityAllowlistChecker
/// @notice Adapts the canonical GBX eligibility module to Uniswap permissioned-pool flags.
/// @dev A failing or reverting eligibility module fails closed. This checker cannot mutate eligibility state.
contract EligibilityAllowlistChecker is IUniswapAllowlistChecker {
    /// @notice Both permissions granted by this checker when canonical holding eligibility passes.
    PermissionFlag public constant ALL_PERMISSIONS = PermissionFlag.wrap(
        PermissionFlag.unwrap(PermissionFlags.SWAP_ALLOWED) | PermissionFlag.unwrap(PermissionFlags.LIQUIDITY_ALLOWED)
    );

    /// @notice Canonical GBX token for which this checker returns permissions.
    address public immutable GBX;
    /// @notice Read-only protocol eligibility module shared with GBX, mining, staking, and redemption.
    IEligibilityModule public immutable ELIGIBILITY_MODULE;

    error EligibilityAllowlistChecker__AddressHasNoCode(address account);
    error EligibilityAllowlistChecker__ZeroAddress();

    /// @notice Constructs the read-only bridge from canonical GBX eligibility to Uniswap permission flags.
    /// @param gbx_ Canonical GBX token queried by the permissioned adapter.
    /// @param eligibilityModule_ Canonical holding-eligibility module shared by the protocol.
    constructor(address gbx_, IEligibilityModule eligibilityModule_) {
        if (gbx_ == address(0) || address(eligibilityModule_) == address(0)) {
            revert EligibilityAllowlistChecker__ZeroAddress();
        }
        if (gbx_.code.length == 0) revert EligibilityAllowlistChecker__AddressHasNoCode(gbx_);
        if (address(eligibilityModule_).code.length == 0) {
            revert EligibilityAllowlistChecker__AddressHasNoCode(address(eligibilityModule_));
        }
        GBX = gbx_;
        ELIGIBILITY_MODULE = eligibilityModule_;
    }

    /// @inheritdoc IUniswapAllowlistChecker
    function checkAllowlist(address account, address tokenAddress) external view returns (PermissionFlag) {
        if (tokenAddress != GBX || !ELIGIBILITY_MODULE.canHold(account)) return PermissionFlags.NONE;
        return ALL_PERMISSIONS;
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IUniswapAllowlistChecker).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
