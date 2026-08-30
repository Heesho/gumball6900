// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { GBX } from "../core/GBX.sol";
import { Mine } from "../core/Mine.sol";
import { ResonanceRouter } from "../core/ResonanceRouter.sol";

/// @title Stateless ResonanceRouter and Mine Component Deployer
/// @author heesho
/// @notice Deploys the revenue Router and non-upgradeable Mine for an already deployed Resonance graph.
/// @dev Stores no state. The direct caller becomes Mine's temporary owner and narrow genesis-liquidity authority; the
///      canonical launcher consumes the genesis authority and begins the two-step governance handoff during launch.
contract GBXRouterMineDeployer {
    bytes32 private constant RESONANCE_ROUTER_SALT_DOMAIN = keccak256("gumball6900.launch.ResonanceRouter");
    bytes32 private constant MINE_SALT_DOMAIN = keccak256("gumball6900.launch.Mine");

    /// @notice Emitted after one caller receives a new ResonanceRouter/Mine pair.
    /// @param caller Temporary Mine owner and fixed-genesis authority.
    /// @param resonanceRouter Newly deployed USDG Router.
    /// @param mine Newly deployed Mine temporarily owned by `caller`.
    event ComponentsDeployed(address indexed caller, address indexed resonanceRouter, address indexed mine);

    /// @notice Deploys ResonanceRouter and Mine for one existing graph.
    /// @dev Caller-scoped CREATE2 salts keep another public caller from consuming or shifting this caller's outputs.
    /// @param gbx Canonical GBX token that Mine will permanently issue.
    /// @param usdg Canonical USDG payment and revenue token.
    /// @param fund Ownerless canonical Fund every later replacement Resonance must retain.
    /// @param resonance Existing Resonance receiver.
    /// @return resonanceRouter Newly deployed USDG Router.
    /// @return mine Newly deployed Mine with `msg.sender` as its temporary owner and consumable genesis authority.
    function deploy(GBX gbx, IERC20 usdg, address fund, address resonance)
        external
        returns (ResonanceRouter resonanceRouter, Mine mine)
    {
        resonanceRouter = new ResonanceRouter{ salt: _salt(msg.sender, RESONANCE_ROUTER_SALT_DOMAIN) }(usdg, resonance);
        mine = new Mine{ salt: _salt(msg.sender, MINE_SALT_DOMAIN) }(
            gbx, usdg, fund, address(resonanceRouter), msg.sender, msg.sender
        );

        emit ComponentsDeployed(msg.sender, address(resonanceRouter), address(mine));
    }

    function _salt(address caller, bytes32 domain) private pure returns (bytes32) {
        return keccak256(abi.encode(caller, domain));
    }
}
