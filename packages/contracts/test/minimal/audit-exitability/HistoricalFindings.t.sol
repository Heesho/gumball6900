// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../../src/core/Bribe.sol";
import { Fund } from "../../../src/core/Fund.sol";
import { GBX } from "../../../src/core/GBX.sol";
import { Mine } from "../../../src/core/Mine.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { SignalGBX } from "../../../src/core/SignalGBX.sol";
import { SignalPortfolioLens } from "../../../src/periphery/SignalPortfolioLens.sol";
import { ProtocolFixture } from "../utils/ProtocolFixture.sol";
import { MockERC20 } from "../utils/Tokens.sol";

/// @title HistoricalExitabilityFindingsTest
/// @notice Permanent public-function reproductions and regressions retained by the exitability audit.
contract HistoricalExitabilityFindingsTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
    }

    /// @notice CEX-01 regression: the precision-coupled cap rejects excess revenue before state/custody changes.
    /// @dev The exact original f991253 reproduction is retained in `reproductions/` with a noncompiled extension.
    function test_Regression_LifetimeCapPreservesSignalExitAndBuffersRejectedRevenue() external {
        _obtainGBXThroughPublicMining(ALICE);
        _flushMiningRevenueWhileNoSignalIsActive();

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 1);
        signalGBX.addSignal(address(targetStrategy), 1);
        vm.stopPrank();

        uint256 maximum = resonance.MAX_LIFETIME_REVENUE_AMOUNT();
        uint256 headroom = maximum - resonance.lifetimeRevenueNotified();

        usdg.mint(address(resonanceRouter), headroom);
        vm.prank(KEEPER);
        assertEq(resonanceRouter.route(), headroom);
        assertEq(resonance.lifetimeRevenueNotified(), maximum);

        vm.warp(block.timestamp + resonance.REWARD_DURATION());

        (uint256 finishBefore, uint256 rateBefore, uint256 lastUpdateBefore, uint256 storedBefore) =
            resonance.revenueData();
        uint256 rejected = resonance.REWARD_DURATION();
        usdg.mint(address(resonanceRouter), rejected);

        vm.prank(KEEPER);
        vm.expectRevert(
            abi.encodeWithSelector(Resonance.RevenueLifetimeCapExceeded.selector, maximum, rejected, maximum)
        );
        resonanceRouter.route();

        assertEq(resonance.lifetimeRevenueNotified(), maximum);
        assertEq(usdg.balanceOf(address(resonanceRouter)), rejected);
        (uint256 finishAfter, uint256 rateAfter, uint256 lastUpdateAfter, uint256 storedAfter) = resonance.revenueData();
        assertEq(finishAfter, finishBefore);
        assertEq(rateAfter, rateBefore);
        assertEq(lastUpdateAfter, lastUpdateBefore);
        assertEq(storedAfter, storedBefore);

        // The permanent cap means this balance cannot be admitted, but failed routes keep custody in the Router.
        vm.prank(CAROL);
        vm.expectRevert(
            abi.encodeWithSelector(Resonance.RevenueLifetimeCapExceeded.selector, maximum, rejected, maximum)
        );
        resonanceRouter.route();
        assertEq(usdg.balanceOf(address(resonanceRouter)), rejected);

        uint256 gbxBefore = gbx.balanceOf(ALICE);
        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 1);

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(targetBribe.signalWeightOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), gbxBefore + 1);
        assertLe(resonance.revenuePerSignal(), maximum * resonance.REWARD_PRECISION());
    }

    /// @notice The active-remainder threshold, like the lifetime cap, rejects before checkpointing or custody changes.
    function test_Regression_BelowRemainingRejectsBeforeCheckpointOrTransfer() external {
        _signalDefault(ALICE, 1 ether);
        _routeRevenue(2 * resonance.REWARD_DURATION());
        vm.warp(block.timestamp + 1 days);

        uint256 remaining = resonance.remainingRevenue();
        uint256 rejected = remaining - 1;
        uint256 notifiedBefore = resonance.lifetimeRevenueNotified();
        (uint256 finishBefore, uint256 rateBefore, uint256 lastUpdateBefore, uint256 storedBefore) =
            resonance.revenueData();

        usdg.mint(address(resonanceRouter), rejected);
        vm.startPrank(address(resonanceRouter));
        usdg.approve(address(resonance), rejected);
        vm.expectRevert(abi.encodeWithSelector(Resonance.RevenueBelowRemaining.selector, rejected, remaining));
        resonance.notifyRevenue(rejected);
        vm.stopPrank();

        assertEq(resonance.lifetimeRevenueNotified(), notifiedBefore);
        assertEq(usdg.balanceOf(address(resonanceRouter)), rejected);
        (uint256 finishAfter, uint256 rateAfter, uint256 lastUpdateAfter, uint256 storedAfter) = resonance.revenueData();
        assertEq(finishAfter, finishBefore);
        assertEq(rateAfter, rateBefore);
        assertEq(lastUpdateAfter, lastUpdateBefore);
        assertEq(storedAfter, storedBefore);
    }

    /// @notice CEX-02 / V12-249705: unrelated callers cannot advance a beneficiary's Bribe reward checkpoint.
    function test_Regression_ThirdPartyClaimsCannotForceFractionalAccountCheckpoints() external {
        MockERC20 reward = new MockERC20("Six Decimal Reward", "RWD", 6);
        Bribe bribe = new Bribe(address(this));
        bribe.addRewardToken(address(reward));
        bribe.addSignalWeight(ALICE, 1);
        bribe.addSignalWeight(BOB, 1);

        uint256 duration = bribe.REWARD_DURATION();
        reward.mint(address(this), duration);
        reward.approve(address(bribe), duration);
        bribe.notifyReward(address(reward), duration);

        vm.warp(block.timestamp + 1);
        vm.prank(CAROL);
        vm.expectRevert(abi.encodeWithSelector(Bribe.UnauthorizedClaimCaller.selector, CAROL, ALICE));
        bribe.claimReward(ALICE, address(reward));

        vm.warp(block.timestamp + 1);
        vm.prank(CAROL);
        vm.expectRevert(abi.encodeWithSelector(Bribe.UnauthorizedClaimCaller.selector, CAROL, ALICE));
        bribe.claimReward(ALICE, address(reward));

        vm.prank(ALICE);
        assertEq(bribe.claimReward(ALICE, address(reward)), 1);
        vm.prank(BOB);
        assertEq(bribe.claimReward(BOB, address(reward)), 1);
        assertEq(reward.balanceOf(ALICE), 1);
        assertEq(reward.balanceOf(BOB), 1);
    }

    /// @notice CEX-08 / GPT-L-02: an unrelated caller can maximize accepted per-Strategy USDG flooring.
    function test_Repro_ThirdPartyDistributionForcesFractionalStrategyCheckpoints() external {
        _signalDefault(ALICE, 1);
        _signalDefault(BOB, 1);
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(resonance.REWARD_DURATION());

        vm.warp(block.timestamp + 1);
        vm.prank(CAROL);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 0);

        vm.warp(block.timestamp + 1);
        vm.prank(CAROL);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 0);

        assertEq(resonance.distributeRevenue(address(gbxStrategy)), 1);
        assertEq(usdg.balanceOf(address(targetStrategy)), 0);
        assertEq(usdg.balanceOf(address(gbxStrategy)), 1);
        assertEq(usdg.balanceOf(address(resonance)), resonance.REWARD_DURATION() - 1);
    }

    /// @notice GPT-L-03: one excess donated unit makes the complete Router balance exceed remaining headroom.
    function test_Repro_BribeRouterCompleteBalanceCannotRouteBeyondLifetimeHeadroom() external {
        _signalDefault(ALICE, 1);

        uint256 maximum = targetBribe.MAX_LIFETIME_REWARD_AMOUNT();
        uint256 duration = targetBribe.REWARD_DURATION();
        uint256 notified = maximum - duration;
        target.mint(address(this), notified);
        target.approve(address(targetBribe), notified);
        targetBribe.notifyReward(address(target), notified);

        vm.warp(block.timestamp + duration);
        vm.prank(ALICE);
        assertEq(targetBribe.claimReward(ALICE, address(target)), notified - (notified % duration));

        uint256 poisonedBalance = duration + 1;
        vm.prank(ALICE);
        target.transfer(address(targetRouter), poisonedBalance);

        vm.prank(CAROL);
        vm.expectRevert(
            abi.encodeWithSelector(
                Bribe.RewardLifetimeCapExceeded.selector, address(target), notified, poisonedBalance, maximum
            )
        );
        targetRouter.route();

        assertEq(target.balanceOf(address(targetRouter)), poisonedBalance);
        assertEq(target.allowance(address(targetRouter), address(targetBribe)), 0);
        assertEq(targetBribe.lifetimeRewardNotified(address(target)), notified);

        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 1);
        assertEq(gbx.balanceOf(ALICE), 1);
    }

    /// @notice CEX-03: aggregate signal does not let the stateless Lens discover an omitted Strategy position.
    function test_Repro_LensCannotDiscoverSignalWithoutCallerStrategyKey() external {
        _signalDefault(ALICE, 100 ether);
        SignalPortfolioLens lens = new SignalPortfolioLens();
        address[] memory noKnownStrategies = new address[](0);

        (SignalPortfolioLens.AccountView memory accountView, SignalPortfolioLens.StrategyAccountView[] memory views) =
            lens.portfolio(signalGBX, resonance, ALICE, noKnownStrategies);

        assertEq(accountView.totalSignal, 100 ether, "aggregate receipt proves a position exists");
        assertEq(views.length, 0, "the Lens cannot return a position whose Strategy key was omitted");
        assertEq(targetBribe.signalWeightOf(ALICE), 100 ether, "canonical Bribe weight remains live onchain");
    }

    /// @notice CEX-04 / V12-249702: an empty Mine slot can be captured before the irreversible minter handoff.
    function test_Repro_PreBindingMineSlotCaptureSettlesAfterHandoff() external {
        MockERC20 localUSDG = new MockERC20("Global Dollar", "USDG", 6);
        MockERC20 routerSink = new MockERC20("Router Sink", "SINK", 18);
        GBX localGBX = new GBX(address(this));
        Fund localFund = new Fund(localGBX);
        Mine localMine = new Mine(
            localGBX, IERC20(address(localUSDG)), address(localFund), address(routerSink), address(0), address(this)
        );

        Mine.Slot memory slotState = localMine.slot(0);
        uint256 price = localMine.currentPrice(0);
        localUSDG.mint(ALICE, price);

        vm.startPrank(ALICE);
        localUSDG.approve(address(localMine), price);
        localMine.mine(ALICE, 0, slotState.epochId, block.timestamp, price, "pre-bind");
        vm.stopPrank();

        vm.warp(block.timestamp + 10);
        localGBX.setMinter(address(localMine));

        slotState = localMine.slot(0);
        price = localMine.currentPrice(0);
        localUSDG.mint(BOB, price);
        vm.startPrank(BOB);
        localUSDG.approve(address(localMine), price);
        localMine.mine(BOB, 0, slotState.epochId, block.timestamp, price, "settle");
        vm.stopPrank();

        assertEq(localGBX.balanceOf(ALICE), 40 ether);
    }

    /// @notice CEX-04: an occupied pre-binding Mine cannot settle while unbound and is abandoned forever if GBX binds
    ///         another otherwise-valid Mine.
    function test_Repro_PreBindingOccupiedMineCannotSettleAfterGBXBindsDifferentMine() external {
        MockERC20 localUSDG = new MockERC20("Global Dollar", "USDG", 6);
        MockERC20 routerSink = new MockERC20("Router Sink", "SINK", 18);
        GBX localGBX = new GBX(address(this));
        Fund localFund = new Fund(localGBX);
        Mine abandonedMine = new Mine(
            localGBX, IERC20(address(localUSDG)), address(localFund), address(routerSink), address(0), address(this)
        );
        Mine selectedMine = new Mine(
            localGBX, IERC20(address(localUSDG)), address(localFund), address(routerSink), address(0), address(this)
        );

        Mine.Slot memory empty = abandonedMine.slot(0);
        uint256 openingPrice = abandonedMine.currentPrice(0);
        localUSDG.mint(ALICE, openingPrice);
        vm.startPrank(ALICE);
        localUSDG.approve(address(abandonedMine), openingPrice);
        abandonedMine.mine(ALICE, 0, empty.epochId, block.timestamp, openingPrice, "captured before binding");
        vm.stopPrank();

        vm.warp(block.timestamp + 1);
        Mine.Slot memory occupied = abandonedMine.slot(0);
        uint256 pending = abandonedMine.pendingSlotEmission(0);
        assertGt(pending, 0);

        vm.prank(BOB);
        vm.expectRevert(abi.encodeWithSelector(GBX.NotMinter.selector, address(abandonedMine)));
        abandonedMine.mine(BOB, 0, occupied.epochId, block.timestamp, type(uint256).max, "unbound settlement");
        assertEq(abandonedMine.pendingSlotEmission(0), pending, "the failed settlement must roll back");
        assertEq(abandonedMine.slot(0).miner, ALICE);

        localGBX.setMinter(address(selectedMine));
        assertEq(localGBX.minter(), address(selectedMine));
        assertTrue(localGBX.minterLocked());

        vm.prank(BOB);
        vm.expectRevert(abi.encodeWithSelector(GBX.NotMinter.selector, address(abandonedMine)));
        abandonedMine.mine(BOB, 0, occupied.epochId, block.timestamp, type(uint256).max, "wrong binding");
        assertEq(abandonedMine.pendingSlotEmission(0), pending);
        assertEq(abandonedMine.slot(0).miner, ALICE);
        assertEq(localGBX.totalSupply(), 0);

        vm.prank(address(selectedMine));
        vm.expectRevert(GBX.MinterAlreadyLocked.selector);
        localGBX.setMinter(address(abandonedMine));
    }

    function _obtainGBXThroughPublicMining(address miner) private {
        Mine.Slot memory slotState = mine.slot(0);
        uint256 price = mine.currentPrice(0);
        usdg.mint(miner, price);

        vm.startPrank(miner);
        usdg.approve(address(mine), price);
        mine.mine(miner, 0, slotState.epochId, block.timestamp, price, "seed");
        vm.stopPrank();

        vm.warp(block.timestamp + 1);

        slotState = mine.slot(0);
        price = mine.currentPrice(0);
        usdg.mint(BOB, price);
        vm.startPrank(BOB);
        usdg.approve(address(mine), price);
        mine.mine(BOB, 0, slotState.epochId, block.timestamp, price, "settle");
        vm.stopPrank();

        assertGt(gbx.balanceOf(miner), 1);
    }

    function _flushMiningRevenueWhileNoSignalIsActive() private {
        uint256 pending = usdg.balanceOf(address(resonanceRouter));
        assertGe(pending, resonance.REWARD_DURATION());

        vm.prank(KEEPER);
        resonanceRouter.route();
        vm.warp(block.timestamp + resonance.REWARD_DURATION());
        assertEq(resonance.totalSignalWeight(), 0);
    }
}

/// @title HistoricalFindingArithmeticTest
/// @notice Pure bounds used by the permanent findings report.
contract HistoricalFindingArithmeticTest is Test {
    function test_ResonanceMinimumDenominatorLifetimeBoundIsPrecisionCoupled() external pure {
        uint256 precision = 1e36;
        uint256 maximumFreshRevenue = type(uint256).max / precision;
        assertLe(maximumFreshRevenue * precision, type(uint256).max);
        assertLt(type(uint256).max - maximumFreshRevenue * precision, precision);
    }
}
