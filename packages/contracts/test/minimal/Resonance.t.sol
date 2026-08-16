// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken, MockERC20 } from "./utils/Tokens.sol";

/// @title ResonanceTest
/// @notice Focused coverage of the Bribe-shaped USDG stream, scalar signals, and irreversible Strategy death.
contract ResonanceTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
    }

    /*//////////////////////////////////////////////////////////////
                        CONSTRUCTION AND BINDING
    //////////////////////////////////////////////////////////////*/

    function test_InitialStateAndImmutableIdentities() external view {
        assertEq(resonance.DURATION(), 7 days);
        assertEq(resonance.REWARD_PRECISION(), 1e36);
        assertEq(address(resonance.signalGBX()), address(signalGBX));
        assertEq(address(resonance.usdg()), address(usdg));
        assertEq(resonance.fund(), address(fund));
        assertEq(address(resonance.bribeFactory()), address(bribeFactory));
        assertEq(address(resonance.strategyFactory()), address(strategyFactory));
        assertEq(resonance.resonanceRouter(), address(resonanceRouter));
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(resonance.left(address(usdg)), 0);

        (uint256 finish, uint256 remainderFinish, uint256 rate, uint256 lastUpdate, uint256 stored) = _rewardData();
        assertEq(finish, 0);
        assertEq(remainderFinish, 0);
        assertEq(rate, 0);
        assertEq(lastUpdate, 0);
        assertEq(stored, 0);
    }

    function test_ConstructorRejectsZeroAndCodelessDependencies() external {
        for (uint256 i; i < 5; ++i) {
            vm.expectRevert();
            new Resonance(
                IERC20(i == 0 ? address(0) : address(signalGBX)),
                IERC20(i == 1 ? address(0) : address(usdg)),
                i == 2 ? address(0) : address(fund),
                BribeFactory(i == 3 ? address(0) : address(bribeFactory)),
                StrategyFactory(i == 4 ? address(0) : address(strategyFactory)),
                address(this)
            );

            vm.expectRevert();
            new Resonance(
                IERC20(i == 0 ? ALICE : address(signalGBX)),
                IERC20(i == 1 ? ALICE : address(usdg)),
                i == 2 ? ALICE : address(fund),
                BribeFactory(i == 3 ? ALICE : address(bribeFactory)),
                StrategyFactory(i == 4 ? ALICE : address(strategyFactory)),
                address(this)
            );
        }
    }

    function test_ResonanceRouterBindingIsOwnerOnlyValidatedAndSingleUse() external {
        Resonance bare = _deployBareResonance();
        ResonanceRouter valid = new ResonanceRouter(IERC20(address(usdg)), address(bare));
        ResonanceRouter wrongToken = new ResonanceRouter(IERC20(address(target)), address(bare));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        bare.setResonanceRouter(address(valid));

        vm.expectRevert();
        bare.setResonanceRouter(address(0));
        vm.expectRevert();
        bare.setResonanceRouter(ALICE);
        vm.expectRevert();
        bare.setResonanceRouter(address(wrongToken));

        bare.setResonanceRouter(address(valid));
        assertEq(bare.resonanceRouter(), address(valid));
        vm.expectRevert();
        bare.setResonanceRouter(address(valid));
    }

    /*//////////////////////////////////////////////////////////////
                         FACTORY-CONTROLLED GRAPH
    //////////////////////////////////////////////////////////////*/

    function test_AddStrategyIsOwnerOnlyAndCreatesTheCompleteGraph() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());

        vm.expectRevert();
        resonance.addStrategy(IERC20(address(0)), defaultConfig());

        (address strategyAddress, address bribeAddress, address routerAddress) =
            resonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());

        assertTrue(resonance.isStrategy(strategyAddress));
        assertTrue(resonance.isStrategyAlive(strategyAddress));
        assertEq(resonance.bribeFor(strategyAddress), bribeAddress);
        assertEq(resonance.bribeRouterFor(strategyAddress), routerAddress);
        assertEq(resonance.paymentTokenFor(strategyAddress), address(secondAsset));
        assertTrue(Bribe(bribeAddress).isRewardToken(address(secondAsset)));
        assertEq(Strategy(strategyAddress).resonance(), address(resonance));
    }

    function test_StrategyAddedAfterAccrualCannotClaimHistoricRevenue() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);
        _finishRevenueStream();

        (address lateStrategy,,) = resonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());
        assertEq(resonance.earned(lateStrategy, address(usdg)), 0);

        _signalDefault(BOB, 100 ether);
        _signalOne(BOB, lateStrategy);
        assertEq(resonance.earned(lateStrategy, address(usdg)), 0);
        assertEq(resonance.distribute(lateStrategy), 0);
    }

    function test_AddBribeRewardIsOwnerOnlyAndDelegatesToThePairedBribe() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.addBribeReward(address(targetStrategy), address(secondAsset));

        vm.expectRevert();
        resonance.addBribeReward(ALICE, address(secondAsset));
        vm.expectRevert();
        resonance.addBribeReward(address(targetStrategy), address(0));
        vm.expectRevert();
        resonance.addBribeReward(address(targetStrategy), address(signalGBX));

        resonance.addBribeReward(address(targetStrategy), address(secondAsset));
        assertTrue(targetBribe.isRewardToken(address(secondAsset)));
    }

    /*//////////////////////////////////////////////////////////////
                           SCALAR SIGNALS
    //////////////////////////////////////////////////////////////*/

    function test_SignalValidationRejectsUnknownZeroAndExcessAmounts() external {
        _signalDefault(ALICE, 100 ether);
        _mintTestGBX(ALICE, 1);

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        signalGBX.signal(BOB, 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        signalGBX.withdrawSignal(BOB, 1);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.signal(address(targetStrategy), 0);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.withdrawSignal(address(targetStrategy), 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                Resonance.InsufficientSignal.selector, address(targetStrategy), uint256(100 ether), uint256(101 ether)
            )
        );
        signalGBX.withdrawSignal(address(targetStrategy), 101 ether);
        vm.stopPrank();
    }

    function test_OnlySignalGBXCanMutateAnotherAccountsSignal() external {
        vm.expectRevert(abi.encodeWithSelector(Resonance.UnauthorizedSignalSource.selector, address(this)));
        resonance.addSignalFor(ALICE, address(targetStrategy), 1);

        vm.expectRevert(abi.encodeWithSelector(Resonance.UnauthorizedSignalSource.selector, address(this)));
        resonance.removeSignalFor(ALICE, address(targetStrategy), 1);

        vm.expectRevert(abi.encodeWithSelector(Resonance.UnauthorizedSignalSource.selector, address(this)));
        resonance.moveSignalFor(ALICE, address(targetStrategy), address(gbxStrategy), 1);
    }

    function test_CoordinatorMutationValidationRejectsEveryInvalidShape() external {
        vm.startPrank(address(signalGBX));

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.addSignalFor(address(0), address(targetStrategy), 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        resonance.addSignalFor(ALICE, BOB, 1);
        vm.expectRevert(Resonance.ZeroAmount.selector);
        resonance.addSignalFor(ALICE, address(targetStrategy), 0);

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.removeSignalFor(address(0), address(targetStrategy), 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        resonance.removeSignalFor(ALICE, BOB, 1);
        vm.expectRevert(Resonance.ZeroAmount.selector);
        resonance.removeSignalFor(ALICE, address(targetStrategy), 0);
        vm.expectRevert(abi.encodeWithSelector(Resonance.InsufficientSignal.selector, address(targetStrategy), 0, 1));
        resonance.removeSignalFor(ALICE, address(targetStrategy), 1);

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.moveSignalFor(address(0), address(targetStrategy), address(gbxStrategy), 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        resonance.moveSignalFor(ALICE, BOB, address(gbxStrategy), 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        resonance.moveSignalFor(ALICE, address(targetStrategy), BOB, 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.SameStrategy.selector, address(targetStrategy)));
        resonance.moveSignalFor(ALICE, address(targetStrategy), address(targetStrategy), 1);
        vm.expectRevert(Resonance.ZeroAmount.selector);
        resonance.moveSignalFor(ALICE, address(targetStrategy), address(gbxStrategy), 0);
        vm.expectRevert(abi.encodeWithSelector(Resonance.InsufficientSignal.selector, address(targetStrategy), 0, 1));
        resonance.moveSignalFor(ALICE, address(targetStrategy), address(gbxStrategy), 1);
        vm.stopPrank();

        resonance.killStrategy(address(targetStrategy));
        vm.startPrank(address(signalGBX));
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        resonance.addSignalFor(ALICE, address(targetStrategy), 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        resonance.moveSignalFor(ALICE, address(gbxStrategy), address(targetStrategy), 1);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, BOB), 0);
        assertEq(resonance.strategySignalWeight(BOB), 0);
    }

    function test_AddSignalIsIncrementalAndMirrorsTheBribe() external {
        _mintTestGBX(ALICE, 50 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 50 ether);
        signalGBX.signal(address(targetStrategy), 30 ether);
        signalGBX.signal(address(targetStrategy), 20 ether);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 50 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 50 ether);
        assertEq(resonance.strategySignalWeight(address(targetStrategy)), 50 ether);
        assertEq(resonance.totalSignalWeight(), 50 ether);
        assertEq(targetBribe.balanceOf(ALICE), 50 ether);
        assertEq(targetBribe.totalSupply(), 50 ether);
    }

    function test_RemoveSignalPreservesTheExactPartialAllocation() external {
        _signalDefault(ALICE, 80 ether);
        vm.startPrank(ALICE);
        signalGBX.withdrawSignal(address(targetStrategy), 30 ether);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 50 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 50 ether);
        assertEq(resonance.strategySignalWeight(address(targetStrategy)), 50 ether);
        assertEq(resonance.totalSignalWeight(), 50 ether);
        assertEq(targetBribe.balanceOf(ALICE), 50 ether);
        assertEq(targetBribe.totalSupply(), 50 ether);
    }

    function test_ScalarSignalsSplitAcrossStrategiesAndExitCompletely() external {
        _signalDefault(ALICE, 100 ether);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), 3, 1);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 75 ether);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 25 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
        assertEq(targetBribe.balanceOf(ALICE), 75 ether);
        assertEq(gbxBribe.balanceOf(ALICE), 25 ether);

        _removeAllSignals(ALICE);
        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(targetBribe.totalSupply(), 0);
        assertEq(gbxBribe.totalSupply(), 0);
    }

    function test_EveryAdditionalDepositIsImmediatelySignaled() external {
        _signalDefault(ALICE, 100 ether);
        _signalDefault(ALICE, 400 ether);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 500 ether);
        assertEq(resonance.totalSignalWeight(), 500 ether);
        assertEq(signalGBX.balanceOf(ALICE), resonance.accountSignalWeight(ALICE));
    }

    /*//////////////////////////////////////////////////////////////
                          REVENUE NOTIFICATION
    //////////////////////////////////////////////////////////////*/

    function test_NotifyRevenueIsRouterOnlyAndRejectsZero() external {
        usdg.mint(ALICE, 1_000);
        vm.startPrank(ALICE);
        usdg.approve(address(resonance), 1_000);
        vm.expectRevert();
        resonance.notifyRevenue(1_000);
        vm.stopPrank();

        vm.prank(address(resonanceRouter));
        vm.expectRevert();
        resonance.notifyRevenue(0);
    }

    function test_NotificationPullsTheExactIncomingAmount() external {
        _routeRevenue(100_000_000);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
        assertEq(resonance.left(address(usdg)), 100_000_000);
    }

    function test_RewardViewsExposeOnlyTheSingleCurrentSchedule() external {
        assertEq(resonance.lastTimeRewardApplicable(address(usdg)), 0);
        assertEq(resonance.getRewardForDuration(address(usdg)), 0);

        address[] memory rewardTokens = resonance.getRewardTokens();
        assertEq(rewardTokens.length, 1);
        assertEq(rewardTokens[0], address(usdg));

        uint256 startedAt = block.timestamp;
        _routeRevenue(700_001);
        assertEq(resonance.lastTimeRewardApplicable(address(usdg)), startedAt);
        assertEq(resonance.getRewardForDuration(address(usdg)), 700_001);

        vm.warp(startedAt + resonance.DURATION() + 1);
        assertEq(resonance.lastTimeRewardApplicable(address(usdg)), startedAt + resonance.DURATION());
    }

    function test_NotificationRejectsFeeOnTransferRevenue() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(6);
        (Resonance feeResonance, ResonanceRouter feeRouter,) = _deployResonanceFor(feeToken);
        feeToken.mint(address(feeRouter), 100_000_000);
        feeToken.setFeeBps(100);

        vm.expectRevert();
        feeRouter.route();
        assertEq(feeToken.balanceOf(address(feeRouter)), 100_000_000);
        assertEq(feeToken.balanceOf(address(feeResonance)), 0);
        assertEq(feeResonance.left(address(feeToken)), 0);
    }

    function test_RawRemainderIsFrontLoadedAndTheCompleteAmountIsScheduled() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        uint256 startedAt = block.timestamp;
        _routeRevenue(700_000);
        (uint256 finish, uint256 remainderFinish, uint256 rate,,) = _rewardData();
        assertEq(rate, 1);
        assertEq(remainderFinish, startedAt + 95_200);
        assertEq(finish, startedAt + 7 days);

        vm.warp(startedAt + 3.5 days);
        assertEq(resonance.distribute(address(targetStrategy)), 397_600);

        vm.warp(startedAt + 7 days);
        assertEq(resonance.distribute(address(targetStrategy)), 302_400);
        assertEq(usdg.balanceOf(address(targetStrategy)), 700_000);
        assertEq(resonance.left(address(usdg)), 0);
    }

    function test_OneRawUnitEmitsDuringTheFirstActiveSecond() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(1);

        assertEq(resonance.left(address(usdg)), 1);
        vm.warp(block.timestamp + 1);
        assertEq(resonance.distribute(address(targetStrategy)), 1);
        assertEq(resonance.left(address(usdg)), 0);
        assertEq(resonance.distribute(address(targetStrategy)), 0);
    }

    function test_TopUpBelowLeftRevertsAtomicallyAtResonance() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(1_209_600);
        uint256 originalFinish = _periodFinish();

        vm.warp(block.timestamp + 1 days);
        uint256 remaining = resonance.left(address(usdg));
        assertEq(remaining, 1_036_800);

        uint256 topUp = 700_000;
        usdg.mint(address(resonanceRouter), topUp);
        vm.startPrank(address(resonanceRouter));
        usdg.approve(address(resonance), topUp);
        vm.expectRevert();
        resonance.notifyRevenue(topUp);
        vm.stopPrank();

        assertEq(usdg.balanceOf(address(resonanceRouter)), topUp);
        assertEq(usdg.balanceOf(address(resonance)), 1_209_600);
        assertEq(resonance.left(address(usdg)), remaining);
        assertEq(_periodFinish(), originalFinish);
    }

    function test_QualifyingTopUpCheckpointsAndRestartsWithRewardPlusLeft() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(1_209_600);

        vm.warp(block.timestamp + 1 days);
        uint256 restartedAt = block.timestamp;
        uint256 remaining = resonance.left(address(usdg));
        uint256 topUp = remaining + 100;
        uint256 scheduled = remaining + topUp;

        _notifyAsRouter(topUp);

        (uint256 finish, uint256 remainderFinish, uint256 rate,,) = _rewardData();
        assertEq(finish, restartedAt + resonance.DURATION());
        assertEq(rate, scheduled / resonance.DURATION());
        assertEq(remainderFinish, restartedAt + (scheduled % resonance.DURATION()));
        assertEq(resonance.left(address(usdg)), scheduled);
        assertEq(resonance.earned(address(targetStrategy), address(usdg)), 172_800);
    }

    function test_DirectDonationIsNotScheduled() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        usdg.mint(address(resonance), 50_000_000);

        vm.warp(block.timestamp + resonance.DURATION());
        assertEq(resonance.distribute(address(targetStrategy)), 0);
        assertEq(resonance.left(address(usdg)), 0);
        assertEq(resonance.earned(address(targetStrategy), address(usdg)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 50_000_000);
    }

    function test_ZeroSignalElapsedRevenueBecomesSurplusAndCannotBeCapturedLater() external {
        _routeRevenue(604_800);
        vm.warp(block.timestamp + 1 days);

        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.distribute(address(targetStrategy)), 518_400);
        assertEq(usdg.balanceOf(address(targetStrategy)), 518_400);
        assertEq(usdg.balanceOf(address(resonance)), 86_400);
        assertEq(resonance.left(address(usdg)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                         CHECKPOINTS AND PAYOUTS
    //////////////////////////////////////////////////////////////*/

    function test_NewStrategyWeightReceivesOnlyPostEntryRevenue() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);

        vm.warp(block.timestamp + 1 days);
        _signalDefault(BOB, 100 ether);
        _signalOne(BOB, address(gbxStrategy));

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.distribute(address(targetStrategy)), 345_600);
        assertEq(resonance.distribute(address(gbxStrategy)), 259_200);
    }

    function test_MoveCheckpointsBothStrategiesBeforeChangingTheirWeights() external {
        _signalDefault(ALICE, 100 ether);
        _routeRevenue(604_800);

        vm.warp(block.timestamp + 1 days);
        vm.prank(ALICE);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 40 ether);

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.distribute(address(targetStrategy)), 397_440);
        assertEq(resonance.distribute(address(gbxStrategy)), 207_360);
        assertEq(usdg.balanceOf(address(targetStrategy)) + usdg.balanceOf(address(gbxStrategy)), 604_800);
    }

    function test_RevenueSplitsByCurrentStrategyWeight() external {
        _signalDefault(ALICE, 75 ether);
        _signalDefault(BOB, 25 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(100_000_000);

        vm.warp(block.timestamp + resonance.DURATION());
        assertEq(resonance.earned(address(targetStrategy), address(usdg)), 75_000_000);
        assertEq(resonance.earned(address(gbxStrategy), address(usdg)), 25_000_000);
        assertEq(resonance.distribute(address(targetStrategy)), 75_000_000);
        assertEq(resonance.distribute(address(gbxStrategy)), 25_000_000);
    }

    function test_DistributionIsPermissionlessButAlwaysPaysTheStrategy() external {
        vm.expectRevert();
        resonance.distribute(ALICE);

        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);
        vm.warp(block.timestamp + 1 days);

        vm.prank(KEEPER);
        assertEq(resonance.distribute(address(targetStrategy)), 86_400);
        assertEq(usdg.balanceOf(KEEPER), 0);
        assertEq(usdg.balanceOf(address(targetStrategy)), 86_400);
    }

    function test_InexactDistributionRevertsWithoutConsumingLiabilityAndCanRetry() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(6);
        (Resonance feeResonance, ResonanceRouter feeRouter, SignalGBX feeSignalGBX) = _deployResonanceFor(feeToken);
        (address strategy,,) = feeResonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());

        _mintTestGBX(ALICE, 100 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(feeSignalGBX), 100 ether);
        feeSignalGBX.signal(strategy, 100 ether);
        vm.stopPrank();

        uint256 revenue = 604_800;
        feeToken.mint(address(feeRouter), revenue);
        feeRouter.route();
        vm.warp(block.timestamp + feeResonance.DURATION());

        vm.prank(ALICE);
        feeSignalGBX.withdrawSignal(strategy, 1 ether);
        assertEq(feeResonance.account_Token_Rewards(strategy, address(feeToken)), revenue);

        feeToken.setFeeBps(100);
        uint256 receiverCredit = 598_752;
        vm.expectRevert(
            abi.encodeWithSelector(Resonance.InexactRevenuePayout.selector, strategy, revenue, revenue, receiverCredit)
        );
        feeResonance.distribute(strategy);

        assertEq(feeResonance.account_Token_Rewards(strategy, address(feeToken)), revenue);
        assertEq(feeToken.balanceOf(address(feeResonance)), revenue);
        assertEq(feeToken.balanceOf(strategy), 0);
        assertEq(feeToken.balanceOf(feeToken.FEE_SINK()), 0);

        feeToken.setFeeBps(0);
        assertEq(feeResonance.distribute(strategy), revenue);
        assertEq(feeResonance.account_Token_Rewards(strategy, address(feeToken)), 0);
        assertEq(feeToken.balanceOf(address(feeResonance)), 0);
        assertEq(feeToken.balanceOf(strategy), revenue);
    }

    function test_DistributingTwicePaysNothingTheSecondTime() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);
        vm.warp(block.timestamp + 1 days);

        assertEq(resonance.distribute(address(targetStrategy)), 86_400);
        assertEq(resonance.distribute(address(targetStrategy)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                          STRATEGY LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    function test_KillStrategyIsOwnerOnlyPermanentAndBlocksNewSignal() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.killStrategy(address(targetStrategy));

        vm.expectRevert();
        resonance.killStrategy(ALICE);

        resonance.killStrategy(address(targetStrategy));
        assertTrue(resonance.isStrategy(address(targetStrategy)));
        assertFalse(resonance.isStrategyAlive(address(targetStrategy)));

        vm.expectRevert();
        resonance.killStrategy(address(targetStrategy));

        _mintTestGBX(ALICE, 1 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        signalGBX.signal(address(targetStrategy), 1 ether);
        vm.stopPrank();
    }

    function test_KillPreservesPreKillRewardsAndStopsFutureAccrual() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);
        vm.warp(block.timestamp + 1 days);

        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(resonance.strategySignalWeight(address(targetStrategy)), 100 ether);
        assertEq(resonance.earned(address(targetStrategy), address(usdg)), 86_400);

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.earned(address(targetStrategy), address(usdg)), 86_400);
        assertEq(resonance.distribute(address(targetStrategy)), 86_400);
        assertEq(usdg.balanceOf(address(targetStrategy)), 86_400);
    }

    function test_KillRemovesDeadWeightAndFutureRevenueFlowsOnlyToSurvivor() external {
        _signalDefault(ALICE, 50 ether);
        _signalDefault(BOB, 50 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(604_800);

        vm.warp(block.timestamp + 1 days);
        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 50 ether);
        assertEq(resonance.strategySignalWeight(address(targetStrategy)), 50 ether);
        assertEq(resonance.strategySignalWeight(address(gbxStrategy)), 50 ether);

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.distribute(address(targetStrategy)), 43_200);
        assertEq(resonance.distribute(address(gbxStrategy)), 561_600);
    }

    function test_DeadStrategySignalCanExitWithoutSubtractingActiveSupplyTwice() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(targetBribe.totalSupply(), 100 ether);

        vm.startPrank(ALICE);
        signalGBX.withdrawSignal(address(targetStrategy), 40 ether);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(targetBribe.totalSupply(), 60 ether);
        signalGBX.withdrawSignal(address(targetStrategy), 60 ether);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(targetBribe.totalSupply(), 0);
        vm.stopPrank();

        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                              SOLVENCY
    //////////////////////////////////////////////////////////////*/

    function testFuzz_AccruedAndScheduledRevenueNeverExceedsTheHeldBalance(
        uint256 rawRevenue,
        uint256 rawElapsed,
        uint256 rawFirstWeight
    ) external {
        uint256 revenue = bound(rawRevenue, 1, 1e15);
        uint256 elapsed = bound(rawElapsed, 0, resonance.DURATION());
        uint256 firstWeight = bound(rawFirstWeight, 1 ether, 999 ether);
        uint256 secondWeight = 1_000 ether - firstWeight;

        _signalDefault(ALICE, firstWeight);
        _signalDefault(BOB, secondWeight);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(revenue);
        vm.warp(block.timestamp + elapsed);

        uint256 promised = resonance.earned(address(targetStrategy), address(usdg))
            + resonance.earned(address(gbxStrategy), address(usdg)) + resonance.left(address(usdg));
        assertLe(promised, usdg.balanceOf(address(resonance)));
    }

    function testFuzz_DistributionNeverOverpaysAndFractionalDustRemainsHeld(uint256 rawRevenue, uint256 rawSplit)
        external
    {
        uint256 revenue = bound(rawRevenue, 1, 1e15);
        uint256 split = bound(rawSplit, 1, 99);

        _signalDefault(ALICE, split * 1 ether);
        _signalDefault(BOB, (100 - split) * 1 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(revenue);
        vm.warp(block.timestamp + resonance.DURATION());

        resonance.distribute(address(targetStrategy));
        resonance.distribute(address(gbxStrategy));

        uint256 delivered = usdg.balanceOf(address(targetStrategy)) + usdg.balanceOf(address(gbxStrategy));
        uint256 retained = usdg.balanceOf(address(resonance));
        assertLe(delivered, revenue);
        assertEq(delivered + retained, revenue);
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    function _notifyAsRouter(uint256 amount) private {
        usdg.mint(address(resonanceRouter), amount);
        vm.startPrank(address(resonanceRouter));
        usdg.approve(address(resonance), amount);
        resonance.notifyRevenue(amount);
        vm.stopPrank();
    }

    function _rewardData()
        private
        view
        returns (
            uint256 periodFinish,
            uint256 remainderFinish,
            uint256 rewardRate,
            uint256 lastUpdateTime,
            uint256 rewardPerTokenStored
        )
    {
        return resonance.token_RewardData(address(usdg));
    }

    function _periodFinish() private view returns (uint256 finish) {
        (finish,,,,) = _rewardData();
    }

    function _deployBareResonance() private returns (Resonance bare) {
        BribeFactory factory = new BribeFactory(address(this));
        StrategyFactory strategies = new StrategyFactory(address(this));
        bare = new Resonance(
            IERC20(address(signalGBX)), IERC20(address(usdg)), address(fund), factory, strategies, address(this)
        );
    }

    function _deployResonanceFor(MockERC20 revenueToken)
        private
        returns (Resonance deployed, ResonanceRouter deployedRouter, SignalGBX deployedSignalGBX)
    {
        BribeFactory factory = new BribeFactory(address(this));
        StrategyFactory strategies = new StrategyFactory(address(this));
        deployedSignalGBX = new SignalGBX(IERC20(address(gbx)), address(this));
        deployed = new Resonance(
            IERC20(address(deployedSignalGBX)),
            IERC20(address(revenueToken)),
            address(fund),
            factory,
            strategies,
            address(this)
        );
        factory.setResonance(address(deployed));
        strategies.setResonance(address(deployed));
        deployedSignalGBX.setResonance(address(deployed));
        deployedRouter = new ResonanceRouter(IERC20(address(revenueToken)), address(deployed));
        deployed.setResonanceRouter(address(deployedRouter));
    }
}
