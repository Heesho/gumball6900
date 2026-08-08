// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Bribe } from "./Bribe.sol";
import { BribeRouter } from "./BribeRouter.sol";
import { Strategy } from "./Strategy.sol";

/// @title StrategyFactory
/// @author GUM BALL 6900
/// @notice Deploys each Strategy together with its dedicated BribeRouter.
/// @dev Adapted from Liquid Signal Governance. Only the bound Resonance can create protocol Strategies.
contract StrategyFactory is Ownable {
    /// @notice Resonance exclusively authorized to create Strategy graphs.
    address public resonance;

    /// @notice Emitted when Resonance deploys a complete Strategy route.
    /// @param strategy Newly deployed Strategy.
    /// @param bribeRouter Router paired with the Strategy.
    /// @param paymentToken Asset accepted by the Strategy.
    /// @param kind Whether the Strategy acquires an asset or performs GBX buybacks.
    event StrategyCreated(
        address indexed strategy, address indexed bribeRouter, address indexed paymentToken, Strategy.Kind kind
    );
    /// @notice Emitted when the factory is permanently bound to Resonance.
    /// @param resonance Bound Resonance address.
    event ResonanceSet(address indexed resonance);

    error NotResonance(address caller);
    error ResonanceAlreadySet(address resonance);
    error ZeroAddress();

    /// @notice Creates an unbound factory whose owner may set Resonance exactly once.
    /// @param initialOwner Deployment-time owner responsible for binding Resonance.
    constructor(address initialOwner) Ownable(initialOwner) { }

    /// @notice Binds the only Resonance allowed to create Strategies.
    /// @param resonance_ Resonance address to bind permanently.
    function setResonance(address resonance_) external onlyOwner {
        if (resonance != address(0)) revert ResonanceAlreadySet(resonance);
        if (resonance_ == address(0) || resonance_.code.length == 0) revert ZeroAddress();

        resonance = resonance_;

        emit ResonanceSet(resonance_);
    }

    /// @notice Deploys a Strategy and the BribeRouter paired with it.
    /// @param revenueToken USDG token sold by the Strategy.
    /// @param paymentToken Asset buyers pay to fill the Strategy.
    /// @param fund Treasury receiving acquisition proceeds or GBX buybacks.
    /// @param bribe Bribe that streams the Strategy's signal-reward share.
    /// @param kind Whether the Strategy acquires an asset or performs GBX buybacks.
    /// @param config Immutable auction configuration.
    /// @return strategy Newly deployed Strategy.
    /// @return bribeRouter Newly deployed BribeRouter paired with `strategy`.
    function createStrategy(
        IERC20 revenueToken,
        IERC20 paymentToken,
        address fund,
        Bribe bribe,
        Strategy.Kind kind,
        Strategy.Config calldata config
    ) external returns (Strategy strategy, BribeRouter bribeRouter) {
        address configuredResonance = resonance;
        if (msg.sender != configuredResonance) revert NotResonance(msg.sender);

        strategy = new Strategy(configuredResonance, revenueToken, paymentToken, fund, kind, config);
        bribeRouter = new BribeRouter(address(strategy), bribe, paymentToken, fund);

        emit StrategyCreated(address(strategy), address(bribeRouter), address(paymentToken), kind);
    }
}
