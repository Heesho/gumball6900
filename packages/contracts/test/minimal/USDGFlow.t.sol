// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { RevertingToken } from "./utils/Tokens.sol";

/// @title USDGFlowTest
/// @notice End-to-end and failure-isolation proofs for every USDG custody boundary.
contract USDGFlowTest is ProtocolFixture {
    struct HostileRevenueGraph {
        RevertingToken revenue;
        SignalGBX receipts;
        Resonance resonance;
        ResonanceRouter router;
        Strategy firstStrategy;
        Strategy secondStrategy;
    }

    function setUp() external {
        _deployProtocol();
    }

    /// @notice Mine revenue waiting below the active stream's remainder can be routed after that stream finishes.
    function testFuzz_MineRevenueAndHandoffClaimsReachFinalDestinationsWithScheduleSurplus(uint256 rawElapsed)
        external
    {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        uint256 firstPayment = _occupyMineSlot(BOB);
        resonanceRouter.route();
        uint256 elapsed = bound(rawElapsed, 0, 1 hours);
        vm.warp(block.timestamp + elapsed);
        uint256 replacementPayment = _occupyMineSlot(DAVE);

        uint256 displacedMinerShare = (replacementPayment * mine.PREVIOUS_MINER_BPS()) / mine.BPS();
        uint256 streamedRevenue = firstPayment + replacementPayment - displacedMinerShare;

        vm.warp(block.timestamp + resonance.REWARD_DURATION());
        if (usdg.balanceOf(address(resonanceRouter)) != 0) resonanceRouter.route();
        vm.warp(block.timestamp + resonance.REWARD_DURATION());
        vm.prank(CAROL);
        targetStrategy.buy(CAROL, 0, block.timestamp, 0);

        if (displacedMinerShare != 0) mine.claimMinerPayment(BOB);

        uint256 streamSurplus = usdg.balanceOf(address(resonance)) + usdg.balanceOf(address(resonanceRouter));
        assertEq(
            usdg.balanceOf(CAROL) + streamSurplus,
            streamedRevenue,
            "ordinary schedule and index floors remain protocol surplus"
        );
        assertEq(usdg.balanceOf(BOB), displacedMinerShare, "the displaced miner receives the exact 80% claim");
        assertEq(usdg.balanceOf(CAROL) + usdg.balanceOf(BOB) + streamSurplus, firstPayment + replacementPayment);

        assertEq(usdg.balanceOf(address(mine)), 0);
        assertEq(usdg.balanceOf(address(targetStrategy)), 0);
        assertEq(mine.totalClaimableMinerPayments(), 0);
        assertEq(resonance.remainingRevenue(), 0);
    }

    /// @notice A blocked Resonance ingress cannot block Mine deposits, and a later permissionless route can retry.
    function test_BlockedRevenueIngressDoesNotBlockMineAndRemainsPermissionlesslyRetryable() external {
        HostileRevenueGraph memory graph = _deployHostileRevenueGraph();
        GBX isolatedGBX = new GBX(address(this));
        Fund isolatedFund = new Fund(isolatedGBX);
        Mine isolatedMine = new Mine(
            isolatedGBX,
            IERC20(address(graph.revenue)),
            address(isolatedFund),
            address(graph.router),
            address(0),
            address(this)
        );
        isolatedGBX.setMinter(address(isolatedMine));

        Mine.Slot memory initialSlot = isolatedMine.slot(0);
        uint256 payment = isolatedMine.currentPrice(0);
        graph.revenue.mint(DAVE, payment);
        graph.revenue.setBlocked(address(graph.resonance), true);

        vm.startPrank(DAVE);
        graph.revenue.approve(address(isolatedMine), payment);
        isolatedMine.mine(DAVE, 0, initialSlot.epochId, block.timestamp, payment, "");
        vm.stopPrank();

        Mine.Slot memory occupiedSlot = isolatedMine.slot(0);
        assertEq(occupiedSlot.epochId, initialSlot.epochId + 1);
        assertEq(occupiedSlot.miner, DAVE);
        assertEq(graph.revenue.balanceOf(DAVE), 0);
        assertEq(graph.revenue.balanceOf(address(isolatedMine)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.router)), payment);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), 0);
        assertEq(graph.resonance.remainingRevenue(), 0);

        vm.prank(KEEPER);
        vm.expectRevert("BLOCKED");
        graph.router.route();

        assertEq(graph.revenue.balanceOf(address(graph.router)), payment);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), 0);

        graph.revenue.setBlocked(address(graph.resonance), false);
        vm.prank(CAROL);
        graph.router.route();

        assertEq(graph.revenue.balanceOf(address(graph.router)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), payment);
        uint256 rewardRate = payment / graph.resonance.REWARD_DURATION();
        assertEq(graph.resonance.remainingRevenue(), rewardRate * graph.resonance.REWARD_DURATION());
    }

    /// @notice A blocked buyer payout restores distribution, payment settlement, and auction state for a clean retry.
    function test_BlockedBuyerPayoutRollsBackTheWholePurchaseAndCanRetry() external {
        HostileRevenueGraph memory graph = _deployHostileRevenueGraph();
        _signalFixture(graph, ALICE, address(graph.firstStrategy), 100 ether);

        graph.revenue.mint(address(graph.router), 604_800);
        graph.router.route();
        vm.warp(block.timestamp + 1 hours);

        uint256 price = graph.firstStrategy.currentPrice();
        target.mint(CAROL, price);
        graph.revenue.setBlocked(CAROL, true);

        vm.startPrank(CAROL);
        target.approve(address(graph.firstStrategy), price);
        vm.expectRevert("BLOCKED");
        graph.firstStrategy.buy(CAROL, 0, block.timestamp, price);
        vm.stopPrank();

        BribeRouter paymentRouter = BribeRouter(graph.resonance.bribeRouterFor(address(graph.firstStrategy)));
        assertEq(graph.firstStrategy.epochId(), 0);
        assertEq(graph.revenue.balanceOf(CAROL), 0);
        assertEq(graph.revenue.balanceOf(address(graph.firstStrategy)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), 604_800);
        assertEq(graph.resonance.remainingRevenue(), 601_200);
        assertEq(target.balanceOf(address(fund)), 0);
        assertEq(target.balanceOf(address(paymentRouter)), 0);
        assertEq(target.balanceOf(CAROL), price);

        graph.revenue.setBlocked(CAROL, false);
        vm.prank(CAROL);
        graph.firstStrategy.buy(CAROL, 0, block.timestamp, price);

        assertEq(graph.revenue.balanceOf(CAROL), 3_600, "one hour of one-unit-per-second revenue is acquired");
        assertEq(graph.firstStrategy.epochId(), 1);
        assertEq(target.balanceOf(address(fund)), price - (price / 10));
        assertEq(target.balanceOf(address(paymentRouter)), price / 10);
        assertEq(target.balanceOf(CAROL), 0);
    }

    /// @notice One USDG-blocked Strategy does not prevent a separate single-Strategy distribution.
    function test_BlockedStrategyDoesNotBrickUnrelatedDistributionOrItsOwnLaterRetry() external {
        HostileRevenueGraph memory graph = _deployHostileRevenueGraph();
        _signalFixture(graph, ALICE, address(graph.firstStrategy), 50 ether);
        _signalFixture(graph, BOB, address(graph.secondStrategy), 50 ether);

        uint256 routed = 60_480_000;
        uint256 strategyShare = routed / 2;
        graph.revenue.mint(address(graph.router), routed);
        graph.router.route();
        vm.warp(block.timestamp + graph.resonance.REWARD_DURATION());
        graph.revenue.setBlocked(address(graph.firstStrategy), true);

        vm.expectRevert("BLOCKED");
        graph.resonance.distributeRevenue(address(graph.firstStrategy));

        assertEq(graph.revenue.balanceOf(address(graph.firstStrategy)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.secondStrategy)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), routed);

        // Permissionless single-Strategy distribution isolates the bad destination.
        graph.resonance.distributeRevenue(address(graph.secondStrategy));
        assertEq(graph.revenue.balanceOf(address(graph.secondStrategy)), strategyShare);

        // Killing preserves the Strategy's already accrued pull claim while excluding it from future allocation.
        graph.resonance.killStrategy(address(graph.firstStrategy));
        assertEq(graph.resonance.earnedRevenue(address(graph.firstStrategy)), strategyShare);

        graph.revenue.setBlocked(address(graph.firstStrategy), false);
        graph.resonance.distributeRevenue(address(graph.firstStrategy));

        assertEq(graph.revenue.balanceOf(address(graph.firstStrategy)), strategyShare);
        assertEq(graph.revenue.balanceOf(address(graph.secondStrategy)), strategyShare);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), 0);
    }

    /// @notice An issuer wipe is detected as a deficit and cannot silently corrupt USDG accounting.
    function test_IssuerWipeFailsClosedUntilTheMissingUSDGIsRestored() external {
        HostileRevenueGraph memory graph = _deployHostileRevenueGraph();
        _signalFixture(graph, ALICE, address(graph.firstStrategy), 100 ether);

        uint256 routed = 604_800;
        graph.revenue.mint(address(graph.router), routed);
        graph.router.route();
        vm.warp(block.timestamp + 1 hours);

        graph.revenue.wipe(address(graph.resonance));
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), 0);

        vm.expectRevert();
        graph.resonance.distributeRevenue(address(graph.firstStrategy));

        assertEq(graph.resonance.earnedRevenue(address(graph.firstStrategy)), 3_600);
        assertEq(graph.revenue.balanceOf(address(graph.firstStrategy)), 0);

        // Only replenishing the externally removed USDG can make the accounting solvent again.
        graph.revenue.mint(address(graph.resonance), routed);
        graph.resonance.distributeRevenue(address(graph.firstStrategy));

        assertEq(graph.revenue.balanceOf(address(graph.firstStrategy)), 3_600);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), routed - 3_600);
    }

    function _occupyMineSlot(address minerAccount) private returns (uint256 payment) {
        Mine.Slot memory slot = mine.slot(0);
        payment = mine.currentPrice(0);
        if (payment != 0) usdg.mint(minerAccount, payment);

        vm.startPrank(minerAccount);
        if (payment != 0) usdg.approve(address(mine), payment);
        mine.mine(minerAccount, 0, slot.epochId, block.timestamp, payment, "");
        vm.stopPrank();
    }

    function _signalFixture(HostileRevenueGraph memory graph, address account, address strategy, uint256 amount)
        private
    {
        _mintTestGBX(account, amount);
        vm.startPrank(account);
        gbx.approve(address(graph.receipts), amount);
        graph.receipts.addSignal(strategy, amount);
        vm.stopPrank();
    }

    function _deployHostileRevenueGraph() private returns (HostileRevenueGraph memory graph) {
        graph.revenue = new RevertingToken(6);
        graph.receipts = new SignalGBX(IERC20(address(gbx)), address(this));
        BribeFactory factory = new BribeFactory(address(this));
        StrategyFactory strategies = new StrategyFactory(address(this));
        graph.resonance = new Resonance(
            IERC20(address(graph.receipts)),
            IERC20(address(graph.revenue)),
            address(fund),
            factory,
            strategies,
            address(this)
        );

        factory.setResonance(address(graph.resonance));
        strategies.setResonance(address(graph.resonance));
        graph.receipts.setResonance(address(graph.resonance));
        graph.router = new ResonanceRouter(IERC20(address(graph.revenue)), address(graph.resonance));
        graph.resonance.setResonanceRouter(address(graph.router));

        (address first,,) = graph.resonance.addStrategy(IERC20(address(target)), defaultConfig());
        (address second,,) = graph.resonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());
        graph.firstStrategy = Strategy(first);
        graph.secondStrategy = Strategy(second);
    }
}
