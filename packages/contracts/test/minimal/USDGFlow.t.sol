// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
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
    function testFuzz_MineRevenueAndHandoffClaimsReachFinalDestinationsWithoutDust(uint256 rawElapsed) external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        uint256 firstPayment = _occupyMineSlot(BOB);
        uint256 elapsed = bound(rawElapsed, 0, 1 hours);
        vm.warp(block.timestamp + elapsed);
        uint256 replacementPayment = _occupyMineSlot(DAVE);

        uint256 displacedMinerShare = (replacementPayment * mine.PREVIOUS_MINER_BPS()) / mine.BPS();
        uint256 streamedRevenue = firstPayment + replacementPayment - displacedMinerShare;

        vm.warp(block.timestamp + resonance.DURATION());
        if (resonanceRouter.pendingRevenue() != 0) resonanceRouter.route();
        vm.warp(block.timestamp + resonance.DURATION());
        vm.prank(CAROL);
        targetStrategy.buy(CAROL, 0, block.timestamp, 0);

        if (displacedMinerShare != 0) mine.claim(BOB);

        assertEq(usdg.balanceOf(CAROL), streamedRevenue, "the Strategy buyer receives every protocol-revenue unit");
        assertEq(usdg.balanceOf(BOB), displacedMinerShare, "the displaced miner receives the exact 80% claim");
        assertEq(usdg.balanceOf(CAROL) + usdg.balanceOf(BOB), firstPayment + replacementPayment);

        assertEq(usdg.balanceOf(address(mine)), 0);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 0);
        assertEq(usdg.balanceOf(address(targetStrategy)), 0);
        assertEq(mine.totalClaimable(), 0);
        assertEq(resonance.left(address(usdg)), 0);
    }

    /// @notice A temporary USDG block at Resonance rolls the complete Mine replacement back and remains retryable.
    function test_BlockedRevenueIngressCannotPartiallyAdvanceAMineSlot() external {
        HostileRevenueGraph memory graph = _deployHostileRevenueGraph();
        GBX isolatedGBX = new GBX(GENESIS, address(this));
        Mine isolatedMine =
            new Mine(isolatedGBX, IERC20(address(graph.revenue)), address(graph.router), defaultMineConfig());
        isolatedGBX.setMinter(address(isolatedMine));

        Mine.Slot memory initialSlot = isolatedMine.getSlot(0);
        uint256 payment = isolatedMine.price(0);
        graph.revenue.mint(DAVE, payment);
        graph.revenue.setBlocked(address(graph.resonance), true);

        vm.startPrank(DAVE);
        graph.revenue.approve(address(isolatedMine), payment);
        vm.expectRevert("BLOCKED");
        isolatedMine.mine(DAVE, 0, initialSlot.epochId, block.timestamp, payment);
        vm.stopPrank();

        Mine.Slot memory rolledBackSlot = isolatedMine.getSlot(0);
        assertEq(rolledBackSlot.epochId, initialSlot.epochId);
        assertEq(rolledBackSlot.miner, address(0));
        assertEq(graph.revenue.balanceOf(DAVE), payment);
        assertEq(graph.revenue.balanceOf(address(isolatedMine)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.router)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), 0);
        assertEq(graph.resonance.left(address(graph.revenue)), 0);

        graph.revenue.setBlocked(address(graph.resonance), false);
        vm.prank(DAVE);
        isolatedMine.mine(DAVE, 0, initialSlot.epochId, block.timestamp, payment);

        assertEq(isolatedMine.getSlot(0).miner, DAVE);
        assertEq(graph.revenue.balanceOf(DAVE), 0);
        assertEq(graph.revenue.balanceOf(address(graph.router)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), payment);
        assertEq(graph.resonance.left(address(graph.revenue)), payment);
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
        assertEq(graph.resonance.left(address(graph.revenue)), 601_200);
        assertEq(paymentRouter.fundPaymentLiability(), 0);
        assertEq(target.balanceOf(CAROL), price);

        graph.revenue.setBlocked(CAROL, false);
        vm.prank(CAROL);
        graph.firstStrategy.buy(CAROL, 0, block.timestamp, price);

        assertEq(graph.revenue.balanceOf(CAROL), 3_600, "one hour of one-unit-per-second revenue is acquired");
        assertEq(graph.firstStrategy.epochId(), 1);
        assertEq(paymentRouter.fundPaymentLiability(), price - (price / 10));
        assertEq(paymentRouter.bribePaymentLiability(), price / 10);
        assertEq(target.balanceOf(CAROL), 0);
    }

    /// @notice One USDG-blocked Strategy does not prevent a separate single-Strategy distribution.
    function test_BlockedStrategyDoesNotBrickUnrelatedDistributionOrItsOwnLaterRetry() external {
        HostileRevenueGraph memory graph = _deployHostileRevenueGraph();
        _signalFixture(graph, ALICE, address(graph.firstStrategy), 50 ether);
        _signalFixture(graph, BOB, address(graph.secondStrategy), 50 ether);

        graph.revenue.mint(address(graph.router), 100_000_000);
        graph.router.route();
        vm.warp(block.timestamp + graph.resonance.DURATION());
        graph.revenue.setBlocked(address(graph.firstStrategy), true);

        vm.expectRevert("BLOCKED");
        graph.resonance.distribute(address(graph.firstStrategy));

        assertEq(graph.revenue.balanceOf(address(graph.firstStrategy)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.secondStrategy)), 0);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), 100_000_000);

        // Permissionless single-Strategy distribution isolates the bad destination.
        graph.resonance.distribute(address(graph.secondStrategy));
        assertEq(graph.revenue.balanceOf(address(graph.secondStrategy)), 50_000_000);

        // Killing preserves the Strategy's already accrued pull claim while excluding it from future allocation.
        graph.resonance.killStrategy(address(graph.firstStrategy));
        assertEq(graph.resonance.earned(address(graph.firstStrategy), address(graph.revenue)), 50_000_000);

        graph.revenue.setBlocked(address(graph.firstStrategy), false);
        graph.resonance.distribute(address(graph.firstStrategy));

        assertEq(graph.revenue.balanceOf(address(graph.firstStrategy)), 50_000_000);
        assertEq(graph.revenue.balanceOf(address(graph.secondStrategy)), 50_000_000);
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
        graph.resonance.distribute(address(graph.firstStrategy));

        assertEq(graph.resonance.earned(address(graph.firstStrategy), address(graph.revenue)), 3_600);
        assertEq(graph.revenue.balanceOf(address(graph.firstStrategy)), 0);

        // Only replenishing the externally removed USDG can make the accounting solvent again.
        graph.revenue.mint(address(graph.resonance), routed);
        graph.resonance.distribute(address(graph.firstStrategy));

        assertEq(graph.revenue.balanceOf(address(graph.firstStrategy)), 3_600);
        assertEq(graph.revenue.balanceOf(address(graph.resonance)), routed - 3_600);
    }

    function _occupyMineSlot(address minerAccount) private returns (uint256 payment) {
        Mine.Slot memory slot = mine.getSlot(0);
        payment = mine.price(0);
        if (payment != 0) usdg.mint(minerAccount, payment);

        vm.startPrank(minerAccount);
        if (payment != 0) usdg.approve(address(mine), payment);
        mine.mine(minerAccount, 0, slot.epochId, block.timestamp, payment);
        vm.stopPrank();
    }

    function _signalFixture(HostileRevenueGraph memory graph, address account, address strategy, uint256 amount)
        private
    {
        _mintTestGBX(account, amount);
        vm.startPrank(account);
        gbx.approve(address(graph.receipts), amount);
        graph.receipts.signal(strategy, amount);
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
