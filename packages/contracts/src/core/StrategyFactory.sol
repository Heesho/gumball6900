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
/// @dev Adapted from Liquid Signal Governance. Only the bound Voter can create protocol Strategies.
contract StrategyFactory is Ownable {
    /// @notice Voter exclusively authorized to create Strategy graphs.
    address public voter;

    /// @notice Emitted when Voter deploys a complete Strategy route.
    /// @param strategy Newly deployed Strategy.
    /// @param bribeRouter Router paired with the Strategy.
    /// @param paymentToken Asset accepted by the Strategy.
    /// @param kind Whether the Strategy acquires an asset or performs GBX buybacks.
    event StrategyCreated(
        address indexed strategy, address indexed bribeRouter, address indexed paymentToken, Strategy.Kind kind
    );
    /// @notice Emitted when the factory is permanently bound to Voter.
    /// @param voter Bound Voter address.
    event VoterSet(address indexed voter);

    error NotVoter(address caller);
    error VoterAlreadySet(address voter);
    error ZeroAddress();

    /// @notice Creates an unbound factory whose owner may set Voter exactly once.
    /// @param initialOwner Deployment-time owner responsible for binding Voter.
    constructor(address initialOwner) Ownable(initialOwner) { }

    /// @notice Binds the only Voter allowed to create Strategies.
    /// @param voter_ Voter address to bind permanently.
    function setVoter(address voter_) external onlyOwner {
        if (voter != address(0)) revert VoterAlreadySet(voter);
        if (voter_ == address(0) || voter_.code.length == 0) revert ZeroAddress();

        voter = voter_;

        emit VoterSet(voter_);
    }

    /// @notice Deploys a Strategy and the BribeRouter paired with it.
    /// @param revenueToken USDG token sold by the Strategy.
    /// @param paymentToken Asset buyers pay to fill the Strategy.
    /// @param fund Treasury receiving acquisition proceeds or GBX buybacks.
    /// @param bribe Bribe that streams the Strategy's voter share.
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
        address configuredVoter = voter;
        if (msg.sender != configuredVoter) revert NotVoter(msg.sender);

        strategy = new Strategy(configuredVoter, revenueToken, paymentToken, fund, kind, config);
        bribeRouter = new BribeRouter(address(strategy), bribe, paymentToken, fund);

        emit StrategyCreated(address(strategy), address(bribeRouter), address(paymentToken), kind);
    }
}
