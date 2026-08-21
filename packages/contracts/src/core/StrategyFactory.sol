// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Bribe } from "./Bribe.sol";
import { BribeRouter } from "./BribeRouter.sol";
import { Strategy } from "./Strategy.sol";
import { IResonanceIdentity } from "./interfaces/IResonanceIdentity.sol";

/// @title GumBall6900 Resonance-Bound Strategy Factory
/// @author Heesho
/// @notice Deploys each Strategy together with its dedicated BribeRouter.
/// @dev Adapted from Liquid Signal Governance. Only the bound Resonance can create protocol Strategies.
/// @custom:version 1.0.0
contract StrategyFactory is Ownable {
    /// @notice Resonance exclusively authorized to create Strategy graphs.
    address public resonance;

    /// @notice Emitted when Resonance deploys a complete Strategy route.
    /// @param strategy Newly deployed Strategy.
    /// @param bribeRouter Router paired with the Strategy.
    /// @param paymentToken Asset accepted by the Strategy.
    event StrategyCreated(address indexed strategy, address indexed bribeRouter, address indexed paymentToken);
    /// @notice Emitted when the factory is permanently bound to Resonance.
    /// @param resonance Bound Resonance address.
    event ResonanceSet(address indexed resonance);

    /// @notice A caller other than the permanently bound Resonance requested deployment.
    error NotResonance(address caller);
    /// @notice A candidate Resonance does not point back to this factory.
    error InvalidResonance(address resonance);
    /// @notice The one-time Resonance binding has already completed.
    error ResonanceAlreadySet(address resonance);
    /// @notice A required deployment or binding address is zero.
    error ZeroAddress();

    /// @notice Creates an unbound factory whose owner may set Resonance exactly once.
    /// @param initialOwner Deployment-time owner responsible for binding Resonance.
    constructor(address initialOwner) Ownable(initialOwner) { }

    /// @notice Binds the only Resonance allowed to create Strategies after reciprocal factory validation.
    /// @param resonance_ Resonance address to bind permanently.
    function setResonance(address resonance_) external onlyOwner {
        if (resonance != address(0)) revert ResonanceAlreadySet(resonance);
        if (resonance_ == address(0) || resonance_.code.length == 0) revert ZeroAddress();
        try IResonanceIdentity(resonance_).strategyFactory() returns (address configuredFactory) {
            if (configuredFactory != address(this)) revert InvalidResonance(resonance_);
        } catch {
            revert InvalidResonance(resonance_);
        }

        resonance = resonance_;

        emit ResonanceSet(resonance_);
    }

    /// @notice Deploys a Strategy and the BribeRouter paired with it.
    /// @param revenueToken USDG token sold by the Strategy.
    /// @param paymentToken Asset buyers pay to fill the Strategy.
    /// @param fund Treasury that ultimately receives the complete payment.
    /// @param bribe Independently fundable Bribe paired with the Strategy.
    /// @param config Immutable auction configuration.
    /// @return strategy Newly deployed Strategy.
    /// @return bribeRouter Newly deployed BribeRouter paired with `strategy`.
    function createStrategy(
        IERC20 revenueToken,
        IERC20 paymentToken,
        address fund,
        Bribe bribe,
        Strategy.Config calldata config
    ) external returns (Strategy strategy, BribeRouter bribeRouter) {
        address configuredResonance = resonance;
        if (msg.sender != configuredResonance) revert NotResonance(msg.sender);

        strategy = new Strategy(configuredResonance, revenueToken, paymentToken, fund, config);
        bribeRouter = new BribeRouter(configuredResonance, address(strategy), bribe, paymentToken, fund);

        emit StrategyCreated(address(strategy), address(bribeRouter), address(paymentToken));
    }
}
