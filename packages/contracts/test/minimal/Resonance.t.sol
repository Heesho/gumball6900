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
import { MockERC20, RevertingToken } from "./utils/Tokens.sol";

/// @dev Minimal contract-wallet surface used to prove claims preserve the wallet as `msg.sender` and beneficiary.
contract BribeClaimWallet {
    function claimReward(Bribe bribe, address rewardToken) external returns (uint256 amount) {
        amount = bribe.claimReward(address(this), rewardToken);
    }

    function claimBribeRewards(Resonance resonance, address[] calldata strategies) external {
        resonance.claimBribeRewards(strategies);
    }
}

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
        assertEq(resonance.REWARD_DURATION(), 7 days);
        assertEq(resonance.REWARD_PRECISION(), 1e36);
        assertEq(address(resonance.signalGBX()), address(signalGBX));
        assertEq(address(resonance.usdg()), address(usdg));
        assertEq(resonance.fund(), address(fund));
        assertEq(address(resonance.bribeFactory()), address(bribeFactory));
        assertEq(address(resonance.strategyFactory()), address(strategyFactory));
        assertEq(resonance.resonanceRouter(), address(resonanceRouter));
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(resonance.remainingRevenue(), 0);

        (uint256 finish, uint256 rate, uint256 lastUpdate, uint256 stored) = _revenueData();
        assertEq(finish, 0);
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

        assertTrue(resonance.isStrategyRegistered(strategyAddress));
        assertTrue(resonance.isStrategyLive(strategyAddress));
        assertEq(resonance.bribeFor(strategyAddress), bribeAddress);
        assertEq(resonance.bribeRouterFor(strategyAddress), routerAddress);
        assertEq(address(Strategy(strategyAddress).paymentToken()), address(secondAsset));
        assertTrue(Bribe(bribeAddress).isRewardToken(address(secondAsset)));
        assertEq(Strategy(strategyAddress).resonance(), address(resonance));
    }

    function test_USDGGBXUniV2LPUsesTheOrdinaryStrategyPath() external {
        MockERC20 lpToken = new MockERC20("USDG-GBX UniV2 LP", "USDG-GBX-LP", 18);
        (address strategyAddress,, address routerAddress) =
            resonance.addStrategy(IERC20(address(lpToken)), defaultConfig());
        Strategy lpStrategy = Strategy(strategyAddress);

        usdg.mint(strategyAddress, 1_000_000);
        uint256 payment = lpStrategy.currentPrice();
        uint256 expectedBribe = payment * resonance.bribeBps() / resonance.BPS();
        lpToken.mint(ALICE, payment);
        vm.startPrank(ALICE);
        lpToken.approve(strategyAddress, payment);
        lpStrategy.buy(ALICE, lpStrategy.epochId(), block.timestamp, payment);
        vm.stopPrank();

        assertEq(address(lpStrategy.paymentToken()), address(lpToken));
        assertEq(address(Strategy(strategyAddress).paymentToken()), address(lpToken));
        assertEq(usdg.balanceOf(ALICE), 1_000_000);
        assertEq(lpToken.balanceOf(address(fund)), payment - expectedBribe);
        assertEq(lpToken.balanceOf(routerAddress), expectedBribe);
    }

    function test_StrategyAddedAfterAccrualCannotClaimHistoricRevenue() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);
        _finishRevenueStream();

        (address lateStrategy,,) = resonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());
        assertEq(resonance.earnedRevenue(lateStrategy), 0);

        _signalDefault(BOB, 100 ether);
        _signalOne(BOB, lateStrategy);
        assertEq(resonance.earnedRevenue(lateStrategy), 0);
        assertEq(resonance.distributeRevenue(lateStrategy), 0);
    }

    function test_AddBribeRewardTokenIsOwnerOnlyAndDelegatesToThePairedBribe() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.addBribeRewardToken(address(targetStrategy), address(secondAsset));

        vm.expectRevert();
        resonance.addBribeRewardToken(ALICE, address(secondAsset));
        vm.expectRevert();
        resonance.addBribeRewardToken(address(targetStrategy), address(0));
        vm.expectRevert();
        resonance.addBribeRewardToken(address(targetStrategy), address(signalGBX));

        resonance.addBribeRewardToken(address(targetStrategy), address(secondAsset));
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
        signalGBX.addSignal(BOB, 1);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        signalGBX.removeSignal(BOB, 1);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.addSignal(address(targetStrategy), 0);
        vm.expectRevert(SignalGBX.ZeroAmount.selector);
        signalGBX.removeSignal(address(targetStrategy), 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                Resonance.InsufficientSignal.selector, address(targetStrategy), uint256(100 ether), uint256(101 ether)
            )
        );
        signalGBX.removeSignal(address(targetStrategy), 101 ether);
        vm.stopPrank();
    }

    function test_OnlySignalGBXCanAddOrRemoveAnotherAccountsSignal() external {
        vm.expectRevert(abi.encodeWithSelector(Resonance.UnauthorizedSignalSource.selector, address(this)));
        resonance.addSignalFor(ALICE, address(targetStrategy), 1);

        vm.expectRevert(abi.encodeWithSelector(Resonance.UnauthorizedSignalSource.selector, address(this)));
        resonance.removeSignalFor(ALICE, address(targetStrategy), 1);
    }

    function test_CoordinatorAddAndRemoveValidationRejectsEveryInvalidShape() external {
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
        vm.stopPrank();

        resonance.killStrategy(address(targetStrategy));
        vm.startPrank(address(signalGBX));
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        resonance.addSignalFor(ALICE, address(targetStrategy), 1);
        vm.stopPrank();

        assertEq(_accountSignalWeight(ALICE, BOB), 0);
        assertEq(_strategySignalWeight(BOB), 0);
    }

    function test_AddSignalIsIncrementalAndMirrorsTheBribe() external {
        _mintTestGBX(ALICE, 50 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 50 ether);
        signalGBX.addSignal(address(targetStrategy), 30 ether);
        signalGBX.addSignal(address(targetStrategy), 20 ether);
        vm.stopPrank();

        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 50 ether);
        assertEq(signalGBX.balanceOf(ALICE), 50 ether);
        assertEq(_strategySignalWeight(address(targetStrategy)), 50 ether);
        assertEq(resonance.totalSignalWeight(), 50 ether);
        assertEq(targetBribe.signalWeightOf(ALICE), 50 ether);
        assertEq(targetBribe.totalSignalWeight(), 50 ether);
    }

    function test_RemoveSignalPreservesTheExactPartialAllocation() external {
        _signalDefault(ALICE, 80 ether);
        vm.startPrank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 30 ether);
        vm.stopPrank();

        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 50 ether);
        assertEq(signalGBX.balanceOf(ALICE), 50 ether);
        assertEq(_strategySignalWeight(address(targetStrategy)), 50 ether);
        assertEq(resonance.totalSignalWeight(), 50 ether);
        assertEq(targetBribe.signalWeightOf(ALICE), 50 ether);
        assertEq(targetBribe.totalSignalWeight(), 50 ether);
    }

    function test_ScalarSignalsSplitAcrossStrategiesAndExitCompletely() external {
        _signalDefault(ALICE, 100 ether);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), 3, 1);

        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 75 ether);
        assertEq(_accountSignalWeight(ALICE, address(gbxStrategy)), 25 ether);
        assertEq(signalGBX.balanceOf(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
        assertEq(targetBribe.signalWeightOf(ALICE), 75 ether);
        assertEq(gbxBribe.signalWeightOf(ALICE), 25 ether);

        _removeAllSignals(ALICE);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(targetBribe.totalSignalWeight(), 0);
        assertEq(gbxBribe.totalSignalWeight(), 0);
    }

    function test_EveryAdditionalDepositIsImmediatelySignaled() external {
        _signalDefault(ALICE, 100 ether);
        _signalDefault(ALICE, 400 ether);

        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 500 ether);
        assertEq(resonance.totalSignalWeight(), 500 ether);
        assertEq(signalGBX.balanceOf(ALICE), 500 ether);
    }

    /*//////////////////////////////////////////////////////////////
                         BRIBE REWARD CLAIMS
    //////////////////////////////////////////////////////////////*/

    function test_DirectBribeClaimsAreBeneficiaryAuthorized() external {
        _signalDefault(ALICE, 1 ether);
        uint256 amount = targetBribe.REWARD_DURATION();
        target.mint(address(this), amount);
        target.approve(address(targetBribe), amount);
        targetBribe.notifyReward(address(target), amount);
        vm.warp(block.timestamp + targetBribe.REWARD_DURATION());

        vm.prank(CAROL);
        vm.expectRevert(abi.encodeWithSelector(Bribe.UnauthorizedClaimCaller.selector, CAROL, ALICE));
        targetBribe.claimReward(ALICE, address(target));
        assertEq(targetBribe.earned(ALICE, address(target)), amount);

        vm.prank(ALICE);
        assertEq(targetBribe.claimReward(ALICE, address(target)), amount);
        assertEq(target.balanceOf(ALICE), amount);
    }

    function test_BatchClaimsCanonicalLiveKilledAndDuplicateStrategyBribesForTheCaller() external {
        _signalDefault(ALICE, 2 ether);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), 1, 1);

        uint256 amount = targetBribe.REWARD_DURATION();
        target.mint(address(this), amount);
        target.approve(address(targetBribe), amount);
        targetBribe.notifyReward(address(target), amount);
        _mintTestGBX(address(this), amount);
        gbx.approve(address(gbxBribe), amount);
        gbxBribe.notifyReward(address(gbx), amount);

        vm.warp(block.timestamp + amount);
        resonance.killStrategy(address(targetStrategy));

        address[] memory strategies = new address[](3);
        strategies[0] = address(targetStrategy);
        strategies[1] = address(targetStrategy);
        strategies[2] = address(gbxStrategy);
        vm.prank(ALICE);
        resonance.claimBribeRewards(strategies);

        assertEq(target.balanceOf(ALICE), amount);
        assertEq(gbx.balanceOf(ALICE), amount);
        assertEq(targetBribe.earned(ALICE, address(target)), 0);
        assertEq(gbxBribe.earned(ALICE, address(gbx)), 0);
    }

    function test_ContractWalletCanSelfClaimDirectlyAndThroughTheBatchEntrypoint() external {
        BribeClaimWallet wallet = new BribeClaimWallet();
        _signalDefault(address(wallet), 2 ether);
        _signalTwo(address(wallet), address(targetStrategy), address(gbxStrategy), 1, 1);

        uint256 amount = targetBribe.REWARD_DURATION();
        target.mint(address(this), amount);
        target.approve(address(targetBribe), amount);
        targetBribe.notifyReward(address(target), amount);
        _mintTestGBX(address(this), amount);
        gbx.approve(address(gbxBribe), amount);
        gbxBribe.notifyReward(address(gbx), amount);
        vm.warp(block.timestamp + amount);

        assertEq(wallet.claimReward(targetBribe, address(target)), amount);
        wallet.claimBribeRewards(resonance, _addresses(address(gbxStrategy)));

        assertEq(target.balanceOf(address(wallet)), amount);
        assertEq(gbx.balanceOf(address(wallet)), amount);
    }

    function test_BatchAlwaysClaimsForTheCallerAndValidatesEveryStrategyAtomically() external {
        _signalDefault(ALICE, 1 ether);
        uint256 amount = targetBribe.REWARD_DURATION();
        target.mint(address(this), amount);
        target.approve(address(targetBribe), amount);
        targetBribe.notifyReward(address(target), amount);
        vm.warp(block.timestamp + amount);

        vm.prank(CAROL);
        resonance.claimBribeRewards(_addresses(address(targetStrategy)));
        assertEq(target.balanceOf(CAROL), 0);
        assertEq(targetBribe.earned(ALICE, address(target)), amount);

        address[] memory invalid = new address[](2);
        invalid[0] = address(targetStrategy);
        invalid[1] = CAROL;
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, CAROL));
        resonance.claimBribeRewards(invalid);
        assertEq(target.balanceOf(ALICE), 0);
        assertEq(targetBribe.earned(ALICE, address(target)), amount);

        vm.prank(ALICE);
        vm.expectRevert(Resonance.EmptyClaimBatch.selector);
        resonance.claimBribeRewards(new address[](0));
    }

    function test_BrokenTokenRevertsTheBatchWhileDirectScalarClaimsRemainAvailable() external {
        _signalDefault(ALICE, 2 ether);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), 1, 1);

        RevertingToken broken = new RevertingToken(18);
        resonance.addBribeRewardToken(address(targetStrategy), address(broken));

        uint256 amount = targetBribe.REWARD_DURATION();
        target.mint(address(this), amount);
        target.approve(address(targetBribe), amount);
        targetBribe.notifyReward(address(target), amount);
        broken.mint(address(this), amount);
        broken.approve(address(targetBribe), amount);
        targetBribe.notifyReward(address(broken), amount);
        _mintTestGBX(address(this), amount);
        gbx.approve(address(gbxBribe), amount);
        gbxBribe.notifyReward(address(gbx), amount);
        vm.warp(block.timestamp + amount);

        broken.setBlocked(ALICE, true);
        address[] memory strategies = new address[](2);
        strategies[0] = address(gbxStrategy);
        strategies[1] = address(targetStrategy);
        vm.prank(ALICE);
        vm.expectRevert("BLOCKED");
        resonance.claimBribeRewards(strategies);

        assertEq(gbx.balanceOf(ALICE), 0);
        assertEq(target.balanceOf(ALICE), 0);
        assertEq(gbxBribe.earned(ALICE, address(gbx)), amount);
        assertEq(targetBribe.earned(ALICE, address(target)), amount);

        vm.startPrank(ALICE);
        assertEq(gbxBribe.claimReward(ALICE, address(gbx)), amount);
        assertEq(targetBribe.claimReward(ALICE, address(target)), amount);
        vm.stopPrank();
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

    function test_NotificationStartsOneScalarScheduleAndKeepsTheRateFloorAsSurplus() external {
        uint256 reward = 100_000_000;
        uint256 expectedRate = reward / resonance.REWARD_DURATION();
        uint256 expectedSchedule = expectedRate * resonance.REWARD_DURATION();

        _routeRevenue(reward);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(usdg.balanceOf(address(resonance)), reward);
        assertEq(resonance.remainingRevenue(), expectedSchedule);

        (uint256 finish, uint256 rate, uint256 lastUpdate, uint256 stored) = _revenueData();
        assertEq(finish, block.timestamp + resonance.REWARD_DURATION());
        assertEq(rate, expectedRate);
        assertEq(lastUpdate, block.timestamp);
        assertEq(stored, 0);
        assertEq(reward - expectedSchedule, 208_000);
    }

    function test_RevenueDataExposesTheSingleUSDGSchedule() external {
        (uint256 finish, uint256 rate, uint256 lastUpdate, uint256 storedIndex) = _revenueData();
        assertEq(finish, 0);
        assertEq(rate, 0);
        assertEq(lastUpdate, 0);
        assertEq(storedIndex, 0);

        uint256 startedAt = block.timestamp;
        _routeRevenue(700_001);
        (finish, rate, lastUpdate, storedIndex) = _revenueData();
        assertEq(finish, startedAt + resonance.REWARD_DURATION());
        assertEq(rate * resonance.REWARD_DURATION(), 604_800);
        assertEq(lastUpdate, startedAt);
        assertEq(storedIndex, 0);

        vm.warp(startedAt + resonance.REWARD_DURATION() + 1);
        assertEq(resonance.remainingRevenue(), 0);
        resonance.distributeRevenue(address(targetStrategy));
        (,, lastUpdate,) = _revenueData();
        assertEq(lastUpdate, finish);
    }

    function test_OrdinaryRateFloorLeavesTheRawRemainderAsSurplus() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        uint256 startedAt = block.timestamp;
        _routeRevenue(700_000);
        (uint256 finish, uint256 rate,,) = _revenueData();
        assertEq(rate, 1);
        assertEq(finish, startedAt + 7 days);

        vm.warp(startedAt + 3.5 days);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 302_400);

        vm.warp(startedAt + 7 days);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 302_400);
        assertEq(usdg.balanceOf(address(targetStrategy)), 604_800);
        assertEq(usdg.balanceOf(address(resonance)), 95_200);
        assertEq(resonance.remainingRevenue(), 0);
    }

    function test_RouterBuffersUntilAtLeastOneRawUnitPerSecondCanBeScheduled() external {
        uint256 duration = resonance.REWARD_DURATION();
        usdg.mint(address(resonanceRouter), duration - 1);

        assertEq(resonanceRouter.route(), 0);
        assertEq(usdg.balanceOf(address(resonanceRouter)), duration - 1);
        assertEq(resonance.remainingRevenue(), 0);

        usdg.mint(address(resonanceRouter), 1);
        assertEq(resonanceRouter.route(), duration);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(resonance.remainingRevenue(), duration);

        vm.warp(block.timestamp + 1 days);
        uint256 remaining = resonance.remainingRevenue();
        assertEq(remaining, 518_400);
        usdg.mint(address(resonanceRouter), remaining);
        assertEq(resonanceRouter.route(), 0, "left alone is insufficient when it is below one duration");

        usdg.mint(address(resonanceRouter), duration - remaining);
        assertEq(resonanceRouter.route(), duration);
        assertEq(resonance.remainingRevenue(), duration);
    }

    function test_OneE36IndexPreservesOneRawRewardAcrossEighteenDecimalSignal() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(resonance.REWARD_DURATION());

        vm.warp(block.timestamp + 1);
        assertEq(resonance.revenuePerSignal(), 1e16);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 1);
    }

    function test_RouterBuffersUntilItsBalanceReachesTheActiveAmountLeft() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(1_209_600);
        uint256 originalFinish = _periodFinish();

        vm.warp(block.timestamp + 1 days);
        uint256 remaining = resonance.remainingRevenue();
        assertEq(remaining, 1_036_800);

        uint256 topUp = 700_000;
        usdg.mint(address(resonanceRouter), topUp);
        assertEq(resonanceRouter.route(), 0);

        assertEq(usdg.balanceOf(address(resonanceRouter)), topUp);
        assertEq(usdg.balanceOf(address(resonance)), 1_209_600);
        assertEq(resonance.remainingRevenue(), remaining);
        assertEq(_periodFinish(), originalFinish);
    }

    function test_QualifyingTopUpCheckpointsAndRestartsWithRewardPlusLeft() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(1_209_600);

        vm.warp(block.timestamp + 1 days);
        uint256 restartedAt = block.timestamp;
        uint256 remaining = resonance.remainingRevenue();
        uint256 topUp = remaining + 100;
        uint256 scheduled = remaining + topUp;

        _notifyAsRouter(topUp);

        (uint256 finish, uint256 rate,,) = _revenueData();
        assertEq(finish, restartedAt + resonance.REWARD_DURATION());
        assertEq(rate, scheduled / resonance.REWARD_DURATION());
        assertEq(resonance.remainingRevenue(), rate * resonance.REWARD_DURATION());
        assertEq(resonance.earnedRevenue(address(targetStrategy)), 172_800);
        assertEq(
            usdg.balanceOf(address(resonance)) - resonance.earnedRevenue(address(targetStrategy))
                - resonance.remainingRevenue(),
            scheduled % resonance.REWARD_DURATION()
        );
    }

    function test_DirectDonationIsNotScheduled() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        usdg.mint(address(resonance), 50_000_000);

        vm.warp(block.timestamp + resonance.REWARD_DURATION());
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 0);
        assertEq(resonance.remainingRevenue(), 0);
        assertEq(resonance.earnedRevenue(address(targetStrategy)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 50_000_000);
    }

    function test_ZeroSignalElapsedRevenueBecomesSurplusAndCannotBeCapturedLater() external {
        _routeRevenue(604_800);
        vm.warp(block.timestamp + 1 days);

        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 518_400);
        assertEq(usdg.balanceOf(address(targetStrategy)), 518_400);
        assertEq(usdg.balanceOf(address(resonance)), 86_400);
        assertEq(resonance.remainingRevenue(), 0);
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
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 345_600);
        assertEq(resonance.distributeRevenue(address(gbxStrategy)), 259_200);
    }

    function test_RemoveThenAddCheckpointsBothStrategiesBeforeChangingTheirWeights() external {
        _signalDefault(ALICE, 100 ether);
        _routeRevenue(604_800);

        vm.warp(block.timestamp + 1 days);
        _reallocateSignal(ALICE, address(targetStrategy), address(gbxStrategy), 40 ether);

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 397_440);
        assertEq(resonance.distributeRevenue(address(gbxStrategy)), 207_360);
        assertEq(usdg.balanceOf(address(targetStrategy)) + usdg.balanceOf(address(gbxStrategy)), 604_800);
    }

    function test_RevenueSplitsByCurrentStrategyWeight() external {
        _signalDefault(ALICE, 75 ether);
        _signalDefault(BOB, 25 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(60_480_000);

        vm.warp(block.timestamp + resonance.REWARD_DURATION());
        assertEq(resonance.earnedRevenue(address(targetStrategy)), 45_360_000);
        assertEq(resonance.earnedRevenue(address(gbxStrategy)), 15_120_000);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 45_360_000);
        assertEq(resonance.distributeRevenue(address(gbxStrategy)), 15_120_000);
    }

    function test_DistributionIsPermissionlessButAlwaysPaysTheStrategy() external {
        vm.expectRevert();
        resonance.distributeRevenue(ALICE);

        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);
        vm.warp(block.timestamp + 1 days);

        vm.prank(KEEPER);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 86_400);
        assertEq(usdg.balanceOf(KEEPER), 0);
        assertEq(usdg.balanceOf(address(targetStrategy)), 86_400);
    }

    function test_DistributingTwicePaysNothingTheSecondTime() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);
        vm.warp(block.timestamp + 1 days);

        assertEq(resonance.distributeRevenue(address(targetStrategy)), 86_400);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 0);
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
        assertTrue(resonance.isStrategyRegistered(address(targetStrategy)));
        assertFalse(resonance.isStrategyLive(address(targetStrategy)));

        vm.expectRevert();
        resonance.killStrategy(address(targetStrategy));

        _mintTestGBX(ALICE, 1 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        signalGBX.addSignal(address(targetStrategy), 1 ether);
        vm.stopPrank();
    }

    function test_KillPreservesPreKillRewardsAndStopsFutureAccrual() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);
        vm.warp(block.timestamp + 1 days);

        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(_strategySignalWeight(address(targetStrategy)), 100 ether);
        assertEq(resonance.earnedRevenue(address(targetStrategy)), 86_400);

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.earnedRevenue(address(targetStrategy)), 86_400);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 86_400);
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
        assertEq(_strategySignalWeight(address(targetStrategy)), 50 ether);
        assertEq(_strategySignalWeight(address(gbxStrategy)), 50 ether);

        vm.warp(block.timestamp + 6 days);
        assertEq(resonance.distributeRevenue(address(targetStrategy)), 43_200);
        assertEq(resonance.distributeRevenue(address(gbxStrategy)), 561_600);
    }

    function test_DeadStrategySignalCanExitWithoutSubtractingActiveSupplyTwice() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(targetBribe.totalSignalWeight(), 100 ether);

        vm.startPrank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 40 ether);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(targetBribe.totalSignalWeight(), 60 ether);
        signalGBX.removeSignal(address(targetStrategy), 60 ether);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(targetBribe.totalSignalWeight(), 0);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 0);
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
        uint256 revenue = bound(rawRevenue, resonance.REWARD_DURATION(), 1e15);
        uint256 elapsed = bound(rawElapsed, 0, resonance.REWARD_DURATION());
        uint256 firstWeight = bound(rawFirstWeight, 1 ether, 999 ether);
        uint256 secondWeight = 1_000 ether - firstWeight;

        _signalDefault(ALICE, firstWeight);
        _signalDefault(BOB, secondWeight);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(revenue);
        vm.warp(block.timestamp + elapsed);

        uint256 promised = resonance.earnedRevenue(address(targetStrategy))
            + resonance.earnedRevenue(address(gbxStrategy)) + resonance.remainingRevenue();
        assertLe(promised, usdg.balanceOf(address(resonance)));
    }

    function testFuzz_DistributionNeverOverpaysAndFractionalDustRemainsHeld(uint256 rawRevenue, uint256 rawSplit)
        external
    {
        uint256 revenue = bound(rawRevenue, resonance.REWARD_DURATION(), 1e15);
        uint256 split = bound(rawSplit, 1, 99);

        _signalDefault(ALICE, split * 1 ether);
        _signalDefault(BOB, (100 - split) * 1 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(revenue);
        vm.warp(block.timestamp + resonance.REWARD_DURATION());

        resonance.distributeRevenue(address(targetStrategy));
        resonance.distributeRevenue(address(gbxStrategy));

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

    function _revenueData()
        private
        view
        returns (uint256 periodFinish, uint256 revenueRate, uint256 lastUpdateTime, uint256 revenuePerSignalStored)
    {
        return resonance.revenueData();
    }

    function _periodFinish() private view returns (uint256 finish) {
        (finish,,,) = _revenueData();
    }

    function _deployBareResonance() private returns (Resonance bare) {
        BribeFactory factory = new BribeFactory(address(this));
        StrategyFactory strategies = new StrategyFactory(address(this));
        bare = new Resonance(
            IERC20(address(signalGBX)), IERC20(address(usdg)), address(fund), factory, strategies, address(this)
        );
    }
}
