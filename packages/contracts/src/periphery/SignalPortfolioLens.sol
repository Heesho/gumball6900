// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Bribe } from "../core/Bribe.sol";
import { Resonance } from "../core/Resonance.sol";
import { SignalGBX } from "../core/SignalGBX.sol";
import { Strategy } from "../core/Strategy.sol";

/// @title GumBall6900 Signal Portfolio Lens
/// @author heesho
/// @notice Batches caller-selected SignalGBX account, Strategy, and paired-Bribe reads for user interfaces.
/// @dev This optional stateless periphery has no registry, roles, storage, custody, or state-changing function. The
///      caller must supply trusted core addresses and discover Strategies from indexed `StrategyAdded` events or an
///      equivalent source. The caller-selected arrays are intentionally unbounded because this contract is meant for
///      `eth_call`; RPC gas and response-size limits still require clients to chunk large portfolios.
contract SignalPortfolioLens {
    /// @notice Aggregate SignalGBX receipt and voting state for one account.
    struct AccountView {
        uint256 totalSignal;
        address delegate;
        uint256 currentVotes;
    }

    /// @notice Current account and protocol state for one caller-selected Strategy.
    struct StrategyAccountView {
        address strategy;
        bool registered;
        bool live;
        address bribe;
        address bribeRouter;
        address paymentToken;
        uint256 currentPrice;
        uint256 epochId;
        uint256 availableRevenue;
        uint256 accountSignal;
        uint256 totalSignal;
        uint256 earnedRevenue;
        address[] rewardTokens;
        uint256[] claimableRewards;
    }

    /// @notice Raised when the supplied Resonance is not the one permanently bound to SignalGBX.
    /// @param expected Bound Resonance reported by SignalGBX.
    /// @param supplied Resonance supplied to this read.
    error InvalidSignalGraph(address expected, address supplied);

    /// @notice Returns one account summary and current views for an explicit Strategy list in a single RPC call.
    /// @dev Unknown Strategy addresses return a row with `registered == false` and otherwise zero-valued fields. A
    ///      registered row includes claimable rewards for every append-only paired-Bribe token. `availableRevenue` is
    ///      the Strategy's current USDG balance and excludes Resonance revenue that has accrued but has not yet been
    ///      distributed; `earnedRevenue` reports that separately. Duplicate Strategies produce duplicate rows.
    /// @param signalGBX Non-transferable receipt whose account state and Resonance binding are read.
    /// @param resonance Resonance whose Strategy graph is read; must match `signalGBX.resonance()`.
    /// @param account Account whose receipt, voting state, signal positions, and rewards are read.
    /// @param strategies Caller-selected Strategy addresses in the desired output order.
    /// @return accountView Aggregate SignalGBX receipt and voting state.
    /// @return strategyViews One row per supplied Strategy address.
    function portfolio(SignalGBX signalGBX, Resonance resonance, address account, address[] calldata strategies)
        external
        view
        returns (AccountView memory accountView, StrategyAccountView[] memory strategyViews)
    {
        address expectedResonance = signalGBX.resonance();
        if (expectedResonance != address(resonance)) {
            revert InvalidSignalGraph(expectedResonance, address(resonance));
        }

        accountView = AccountView({
            totalSignal: signalGBX.balanceOf(account),
            delegate: signalGBX.delegates(account),
            currentVotes: signalGBX.getVotes(account)
        });

        uint256 strategyCount = strategies.length;
        strategyViews = new StrategyAccountView[](strategyCount);
        for (uint256 i; i < strategyCount; ++i) {
            strategyViews[i] = _strategyAccountView(resonance, account, strategies[i]);
        }
    }

    /// @dev Builds one registered Strategy row, or returns the default row for an unknown address.
    function _strategyAccountView(Resonance resonance, address account, address strategy)
        private
        view
        returns (StrategyAccountView memory strategyView)
    {
        strategyView.strategy = strategy;
        strategyView.registered = resonance.isStrategyRegistered(strategy);
        strategyView.rewardTokens = new address[](0);
        strategyView.claimableRewards = new uint256[](0);
        if (!strategyView.registered) return strategyView;

        strategyView.live = resonance.isStrategyLive(strategy);
        strategyView.bribe = resonance.bribeFor(strategy);
        strategyView.bribeRouter = resonance.bribeRouterFor(strategy);

        Strategy strategyContract = Strategy(strategy);
        strategyView.paymentToken = address(strategyContract.paymentToken());
        strategyView.currentPrice = strategyContract.currentPrice();
        strategyView.epochId = strategyContract.epochId();
        strategyView.availableRevenue = strategyContract.usdg().balanceOf(strategy);
        strategyView.earnedRevenue = resonance.earnedRevenue(strategy);

        Bribe bribe = Bribe(strategyView.bribe);
        strategyView.accountSignal = bribe.signalWeightOf(account);
        strategyView.totalSignal = bribe.totalSignalWeight();
        strategyView.rewardTokens = bribe.rewardTokens();

        uint256 rewardCount = strategyView.rewardTokens.length;
        strategyView.claimableRewards = new uint256[](rewardCount);
        for (uint256 i; i < rewardCount; ++i) {
            strategyView.claimableRewards[i] = bribe.earned(account, strategyView.rewardTokens[i]);
        }
    }
}
