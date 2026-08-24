// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Bribe } from "./Bribe.sol";
import { BribeRouter } from "./BribeRouter.sol";
import { Strategy } from "./Strategy.sol";
import { IBribe } from "./interfaces/IBribe.sol";
import { IResonanceIdentity } from "./interfaces/IResonanceIdentity.sol";

/// @title GumBall6900 Resonance-Bound Strategy Factory
/// @author heesho
/// @notice Deploys each protocol Strategy together with its dedicated BribeRouter.
/// @dev The temporary owner may permanently bind exactly one reciprocally configured Resonance. Only that Resonance can
///      create Strategy graphs; there is no generic public deployment path. The one-time binding is adapted from Liquid
///      Signal Governance. After binding, inherited ownership remains but controls no further custom factory action.
contract StrategyFactory is Ownable {
    /// @notice Permanently bound Resonance exclusively authorized to create Strategy graphs; zero before setup.
    address public resonance;

    /// @notice Emitted when the bound Resonance deploys a Strategy and its dedicated BribeRouter.
    /// @param strategy Newly deployed Strategy contract.
    /// @param bribeRouter Newly deployed Router buffering the automatic Bribe share.
    /// @param paymentToken ERC-20 asset accepted by the Strategy and forwarded by the BribeRouter.
    event StrategyCreated(address indexed strategy, address indexed bribeRouter, address indexed paymentToken);
    /// @notice Emitted when the factory is permanently bound to one Resonance.
    /// @param resonance Resonance whose reciprocal `strategyFactory` identity was validated.
    event ResonanceSet(address indexed resonance);

    /// @notice Thrown when a caller other than the permanently bound Resonance requests graph deployment.
    /// @param caller Unauthorized caller.
    error NotResonance(address caller);
    /// @notice Thrown when a candidate Resonance cannot prove this contract as its immutable StrategyFactory.
    /// @param resonance Invalid Resonance candidate.
    error InvalidResonance(address resonance);
    /// @notice Thrown when the one-time Resonance binding has already completed.
    /// @param resonance Permanently bound Resonance.
    error ResonanceAlreadySet(address resonance);
    /// @notice Thrown when a Resonance binding candidate is zero or has no deployed code.
    error ZeroAddress();

    /// @notice Creates an unbound factory whose temporary owner may bind Resonance exactly once.
    /// @dev OpenZeppelin `Ownable` rejects a zero `initialOwner`.
    /// @param initialOwner Deployment-time owner responsible for the one-time Resonance binding.
    constructor(address initialOwner) Ownable(initialOwner) { }

    /// @notice Permanently binds the only Resonance allowed to create Strategy graphs.
    /// @dev Callable only by the current owner and only while unbound. The candidate must be a deployed contract whose
    ///      `strategyFactory()` identity getter returns this factory; a missing or reverting getter fails validation.
    ///      Emits `ResonanceSet` after the binding is stored.
    /// @param resonance_ Resonance candidate to validate and bind.
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

    /// @notice Deploys a Strategy and its dedicated BribeRouter for the bound Resonance.
    /// @dev Callable only by `resonance`; an unbound factory therefore rejects every caller. Deployment is atomic and
    ///      relies on the Strategy and BribeRouter constructors to validate code-bearing dependencies and auction
    ///      configuration. The supplied Bribe becomes the Router's immutable destination, and `paymentToken` becomes
    ///      both the Strategy's purchase asset and the Router's buffered reward asset. Emits `StrategyCreated` after
    ///      both contracts are deployed.
    /// @param usdg USDG revenue token sold by the new Strategy.
    /// @param paymentToken ERC-20 asset buyers pay and the BribeRouter buffers.
    /// @param fund Treasury receiving the non-Bribe share of each purchase payment.
    /// @param bribe Existing Bribe to pair with the new Strategy and Router.
    /// @param config Immutable reverse-Dutch-auction configuration for the new Strategy.
    /// @return strategy Newly deployed Strategy contract.
    /// @return bribeRouter Newly deployed BribeRouter paired with `strategy` and `bribe`.
    function createStrategy(
        IERC20 usdg,
        IERC20 paymentToken,
        address fund,
        Bribe bribe,
        Strategy.Config calldata config
    ) external returns (Strategy strategy, BribeRouter bribeRouter) {
        address configuredResonance = resonance;
        if (msg.sender != configuredResonance) revert NotResonance(msg.sender);

        strategy = new Strategy(configuredResonance, usdg, paymentToken, fund, config);
        bribeRouter = new BribeRouter(IBribe(address(bribe)), paymentToken);

        emit StrategyCreated(address(strategy), address(bribeRouter), address(paymentToken));
    }
}
