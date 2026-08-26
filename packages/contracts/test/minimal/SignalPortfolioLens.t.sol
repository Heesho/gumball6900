// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { SignalPortfolioLens } from "../../src/periphery/SignalPortfolioLens.sol";

import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

/// @title SignalPortfolioLensTest
/// @notice Focused regressions for the stateless, caller-selected signal read periphery.
contract SignalPortfolioLensTest is ProtocolFixture {
    SignalPortfolioLens internal lens;

    function setUp() external {
        _deployProtocol();
        lens = new SignalPortfolioLens();
        _mintTestGBX(ALICE, 100 ether);
    }

    function test_PortfolioBatchesAccountStrategyAndBribeReads() external {
        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](2);
        allocations[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 40 ether });
        allocations[1] = SignalGBX.Allocation({ strategy: address(gbxStrategy), amount: 60 ether });

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        signalGBX.addSignalMany(allocations);
        vm.stopPrank();

        usdg.mint(address(targetStrategy), 7e6);

        address[] memory strategies = new address[](3);
        strategies[0] = address(targetStrategy);
        strategies[1] = address(gbxStrategy);
        strategies[2] = address(0xDEAD);

        (SignalPortfolioLens.AccountView memory accountView, SignalPortfolioLens.StrategyAccountView[] memory views) =
            lens.portfolio(signalGBX, resonance, ALICE, strategies);

        assertEq(accountView.totalSignal, 100 ether);
        assertEq(accountView.delegate, ALICE);
        assertEq(accountView.currentVotes, 100 ether);

        assertEq(views.length, 3);
        assertEq(views[0].strategy, address(targetStrategy));
        assertTrue(views[0].registered);
        assertTrue(views[0].live);
        assertEq(views[0].bribe, address(targetBribe));
        assertEq(views[0].bribeRouter, address(targetRouter));
        assertEq(views[0].paymentToken, address(target));
        assertEq(views[0].currentPrice, targetStrategy.currentPrice());
        assertEq(views[0].epochId, targetStrategy.epochId());
        assertEq(views[0].availableRevenue, 7e6);
        assertEq(views[0].accountSignal, 40 ether);
        assertEq(views[0].totalSignal, 40 ether);
        assertEq(views[0].earnedRevenue, 0);
        assertEq(views[0].rewardTokens.length, 1);
        assertEq(views[0].rewardTokens[0], address(target));
        assertEq(views[0].claimableRewards.length, 1);
        assertEq(views[0].claimableRewards[0], 0);

        assertEq(views[1].accountSignal, 60 ether);
        assertEq(views[1].totalSignal, 60 ether);

        assertEq(views[2].strategy, address(0xDEAD));
        assertFalse(views[2].registered);
        assertEq(views[2].bribe, address(0));
        assertEq(views[2].rewardTokens.length, 0);
    }

    function test_PortfolioRejectsMismatchedSignalGraph() external {
        SignalGBX unboundSignalGBX = new SignalGBX(IERC20(address(gbx)), address(this));
        address[] memory strategies = new address[](0);

        vm.expectRevert(
            abi.encodeWithSelector(SignalPortfolioLens.InvalidSignalGraph.selector, address(0), address(resonance))
        );
        lens.portfolio(unboundSignalGBX, resonance, ALICE, strategies);
    }

    function test_PortfolioReflectsKilledStrategyWithoutBlockingPositionReads() external {
        _signalDefault(ALICE, 10 ether);
        resonance.killStrategy(address(targetStrategy));

        address[] memory strategies = new address[](1);
        strategies[0] = address(targetStrategy);

        (, SignalPortfolioLens.StrategyAccountView[] memory views) =
            lens.portfolio(signalGBX, resonance, ALICE, strategies);

        assertTrue(views[0].registered);
        assertFalse(views[0].live);
        assertEq(views[0].accountSignal, 10 ether);
        assertEq(views[0].totalSignal, 10 ether);
    }
}
