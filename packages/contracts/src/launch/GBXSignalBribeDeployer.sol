// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { BribeFactory } from "../core/BribeFactory.sol";
import { SignalGBX } from "../core/SignalGBX.sol";

/// @title Stateless SignalGBX and BribeFactory Component Deployer
/// @author heesho
/// @notice Deploys the signaling receipt and Bribe factory under one caller's temporary setup authority.
/// @dev Stores no state. The canonical launcher binds both components to Resonance and renounces their inherited
///      ownership in the same atomic launch transaction.
contract GBXSignalBribeDeployer {
    bytes32 private constant SIGNAL_GBX_SALT_DOMAIN = keccak256("gumball6900.launch.SignalGBX");
    bytes32 private constant BRIBE_FACTORY_SALT_DOMAIN = keccak256("gumball6900.launch.BribeFactory");

    /// @notice Emitted after one caller receives a new SignalGBX/BribeFactory setup pair.
    /// @param caller Temporary setup owner assigned to both deployed contracts.
    /// @param signalGBX Newly deployed SignalGBX receipt.
    /// @param bribeFactory Newly deployed Resonance-bound Bribe factory.
    event ComponentsDeployed(address indexed caller, address indexed signalGBX, address indexed bribeFactory);

    /// @notice Deploys SignalGBX and BribeFactory for one existing GBX token.
    /// @dev Caller-scoped CREATE2 salts keep another public caller from consuming or shifting this caller's outputs.
    /// @param gbx Canonical GBX token escrowed by the new SignalGBX receipt.
    /// @return signalGBX Newly deployed SignalGBX receipt.
    /// @return bribeFactory Newly deployed unbound BribeFactory.
    function deploy(IERC20 gbx) external returns (SignalGBX signalGBX, BribeFactory bribeFactory) {
        signalGBX = new SignalGBX{ salt: _salt(msg.sender, SIGNAL_GBX_SALT_DOMAIN) }(gbx, msg.sender);
        bribeFactory = new BribeFactory{ salt: _salt(msg.sender, BRIBE_FACTORY_SALT_DOMAIN) }(msg.sender);

        emit ComponentsDeployed(msg.sender, address(signalGBX), address(bribeFactory));
    }

    function _salt(address caller, bytes32 domain) private pure returns (bytes32) {
        return keccak256(abi.encode(caller, domain));
    }
}
