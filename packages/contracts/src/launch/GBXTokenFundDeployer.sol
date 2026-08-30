// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Fund } from "../core/Fund.sol";
import { GBX } from "../core/GBX.sol";

/// @title Stateless GBX and Fund Component Deployer
/// @author heesho
/// @notice Deploys the GBX token and its ownerless Fund for an atomic GBX launch orchestrator.
/// @dev Stores no state and grants GBX's one-time Mine-binding authority to the direct caller. It is deployment
///      infrastructure rather than a continuing protocol factory; the canonical launcher is its intended caller.
contract GBXTokenFundDeployer {
    bytes32 private constant GBX_SALT_DOMAIN = keccak256("gumball6900.launch.GBX");
    bytes32 private constant FUND_SALT_DOMAIN = keccak256("gumball6900.launch.Fund");

    /// @notice Emitted after one caller receives a newly deployed GBX/Fund pair.
    /// @param caller Caller holding GBX's temporary Mine-binding authority.
    /// @param gbx Newly deployed GBX token.
    /// @param fund Newly deployed ownerless Fund bound to `gbx`.
    event ComponentsDeployed(address indexed caller, address indexed gbx, address indexed fund);

    /// @notice Deploys one GBX token and its ownerless Fund.
    /// @dev GBX starts with zero supply. `msg.sender` may only complete GBX's one-time Mine handoff; it cannot mint.
    ///      Caller-scoped CREATE2 salts keep another public caller from consuming or shifting this caller's outputs.
    /// @return gbx Newly deployed GBX token.
    /// @return fund Newly deployed ownerless Fund.
    function deploy() external returns (GBX gbx, Fund fund) {
        gbx = new GBX{ salt: _salt(msg.sender, GBX_SALT_DOMAIN) }(msg.sender);
        fund = new Fund{ salt: _salt(msg.sender, FUND_SALT_DOMAIN) }(gbx);

        emit ComponentsDeployed(msg.sender, address(gbx), address(fund));
    }

    function _salt(address caller, bytes32 domain) private pure returns (bytes32) {
        return keccak256(abi.encode(caller, domain));
    }
}
