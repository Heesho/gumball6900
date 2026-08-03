// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";

/// @title SupplyCampaignMinter
/// @notice Minimal external controller used only by the Echidna and Medusa supply campaign.
contract SupplyCampaignMinter {
    /// @notice Mints campaign shares through the token's real controller boundary.
    function mint(GBXToken token, address receiver, uint256 amount) external {
        token.mint(receiver, amount);
    }
}

/// @title SupplyCampaign
/// @notice Stateful external-fuzzer harness for lifetime mint and real-burn identities.
contract SupplyCampaign {
    GBXToken public immutable token;
    SupplyCampaignMinter public immutable minter;

    /// @notice Deploys the real GBX token and assigns its one-time controller.
    constructor() {
        token = new GBXToken(address(this), IEligibilityModule(address(0)));
        minter = new SupplyCampaignMinter();
        token.initializeEmissionController(address(minter));
    }

    /// @notice Mints a bounded nonzero amount while lifetime capacity remains.
    function actMint(uint256 rawAmount) external {
        uint256 remaining = token.MAX_CUMULATIVE_MINT() - token.cumulativeMinted();
        if (remaining == 0) return;
        uint256 amount = 1 + (rawAmount % remaining);
        minter.mint(token, address(this), amount);
    }

    /// @notice Burns a bounded nonzero amount from the campaign's live balance.
    function actBurn(uint256 rawAmount) external {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) return;
        token.burn(1 + (rawAmount % balance));
    }

    /// @notice Proves burns never reopen the one-billion lifetime capacity.
    function echidna_cumulative_mint_never_exceeds_cap() external view returns (bool) {
        return token.cumulativeMinted() <= token.MAX_CUMULATIVE_MINT();
    }

    /// @notice Proves every burn was preceded by a real mint.
    function echidna_cumulative_burn_never_exceeds_mint() external view returns (bool) {
        return token.cumulativeBurned() <= token.cumulativeMinted();
    }

    /// @notice Proves the lifetime supply identity after arbitrary campaign sequences.
    function echidna_total_supply_matches_lifetime_identity() external view returns (bool) {
        return token.totalSupply() == token.cumulativeMinted() - token.cumulativeBurned();
    }

    /// @notice Proves campaign custody equals supply because this harness never transfers GBX elsewhere.
    function echidna_campaign_balance_matches_supply() external view returns (bool) {
        return token.balanceOf(address(this)) == token.totalSupply();
    }
}
