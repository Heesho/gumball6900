// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { BribeFactory } from "../core/BribeFactory.sol";
import { Resonance } from "../core/Resonance.sol";
import { StrategyFactory } from "../core/StrategyFactory.sol";

/// @title Stateless StrategyFactory and Resonance Component Deployer
/// @author heesho
/// @notice Deploys StrategyFactory and Resonance under the direct caller's temporary setup authority.
/// @dev Stores no state. Resonance receives the newly deployed StrategyFactory as an immutable dependency, while the
///      remaining already deployed identities are supplied by the canonical launcher.
contract GBXStrategyResonanceDeployer {
    bytes32 private constant STRATEGY_FACTORY_SALT_DOMAIN = keccak256("gumball6900.launch.StrategyFactory");
    bytes32 private constant RESONANCE_SALT_DOMAIN = keccak256("gumball6900.launch.Resonance");

    /// @notice Emitted after one caller receives a new StrategyFactory/Resonance setup pair.
    /// @param caller Temporary setup owner assigned to both deployed contracts.
    /// @param strategyFactory Newly deployed unbound StrategyFactory.
    /// @param resonance Newly deployed Resonance allocator.
    event ComponentsDeployed(address indexed caller, address indexed strategyFactory, address indexed resonance);

    /// @notice Deploys StrategyFactory and Resonance for one partially assembled core graph.
    /// @dev Caller-scoped CREATE2 salts keep another public caller from consuming or shifting this caller's outputs.
    /// @param signalGBX Canonical non-transferable signal receipt.
    /// @param usdg Canonical six-decimal USDG revenue token.
    /// @param fund Ownerless Fund receiving Strategy payment complements.
    /// @param bribeFactory Already deployed BribeFactory that Resonance will bind and use.
    /// @return strategyFactory Newly deployed unbound StrategyFactory.
    /// @return resonance Newly deployed Resonance allocator.
    function deploy(IERC20 signalGBX, IERC20 usdg, address fund, BribeFactory bribeFactory)
        external
        returns (StrategyFactory strategyFactory, Resonance resonance)
    {
        strategyFactory = new StrategyFactory{ salt: _salt(msg.sender, STRATEGY_FACTORY_SALT_DOMAIN) }(msg.sender);
        resonance = new Resonance{ salt: _salt(msg.sender, RESONANCE_SALT_DOMAIN) }(
            signalGBX, usdg, fund, bribeFactory, strategyFactory, msg.sender
        );

        emit ComponentsDeployed(msg.sender, address(strategyFactory), address(resonance));
    }

    function _salt(address caller, bytes32 domain) private pure returns (bytes32) {
        return keccak256(abi.encode(caller, domain));
    }
}
