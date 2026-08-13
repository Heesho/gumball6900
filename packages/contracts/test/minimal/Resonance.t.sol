// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken, MockERC20 } from "./utils/Tokens.sol";

/// @title ResonanceTest
/// @notice Exhaustive coverage of signal allocation, revenue indexing, distribution, and Strategy lifecycle.
contract ResonanceTest is ProtocolFixture {
    event FundRevenueAccrued(uint256 amount, uint256 totalLiability);
    event RevenueCarryFunded(uint256 amountScaled, uint256 remainderScaled);
    event RevenueDistributed(address indexed caller, address indexed strategy, uint256 amount);
    event RevenueNotified(address indexed resonanceRouter, uint256 amount);
    event RevenueQueued(uint256 amount, uint256 totalQueued);
    event RevenueStreamCheckpointed(uint256 releasedScaled, uint256 remainingScaled);
    event RevenueStreamScheduled(
        uint256 amount,
        uint256 amountScaled,
        uint256 startedAt,
        uint256 finish,
        uint256 rateScaled,
        uint256 rateRemainder
    );
    event SignalAdded(address indexed account, address indexed strategy, uint256 amount);
    event SignalRemoved(address indexed account, address indexed strategy, uint256 amount);
    event StrategyKilled(address indexed strategy);

    function setUp() external {
        _deployProtocol();
    }

    /*//////////////////////////////////////////////////////////////
                        CONSTRUCTION AND BINDING
    //////////////////////////////////////////////////////////////*/

    function test_InitialStateMatchesTheDocumentedDefaults() external view {
        assertEq(resonance.INDEX_PRECISION(), 1e36);
        assertEq(resonance.REVENUE_STREAM_DURATION(), 7 days);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(resonance.revenueIndex(), 0);
        assertEq(resonance.revenueStreamRemainingScaled(), 0);
        assertEq(resonance.revenueStreamRateScaled(), 0);
        assertEq(resonance.revenueStreamLastUpdate(), 0);
        assertEq(resonance.revenueStreamFinish(), 0);
        assertEq(resonance.revenueStreamRemainderFinish(), 0);
        assertEq(resonance.queuedRevenue(), 0);
        assertEq(resonance.fundRevenueRemainderScaled(), 0);
        assertEq(resonance.strategies().length, 2);
    }

    function test_ConstructorRejectsEveryZeroDependency() external {
        for (uint256 i; i < 5; ++i) {
            vm.expectRevert(Resonance.ZeroAddress.selector);
            new Resonance(
                IERC20(i == 0 ? address(0) : address(signalGBX)),
                IERC20(i == 1 ? address(0) : address(usdg)),
                i == 2 ? address(0) : address(fund),
                BribeFactory(i == 3 ? address(0) : address(bribeFactory)),
                StrategyFactory(i == 4 ? address(0) : address(strategyFactory)),
                address(this)
            );
        }
    }

    function test_ConstructorRejectsEveryEOADependency() external {
        for (uint256 i; i < 5; ++i) {
            vm.expectRevert(Resonance.ZeroAddress.selector);
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

    function test_SetResonanceRouterIsOwnerOnlyValidatedAndSingleUse() external {
        Resonance unbound = _deployBareResonance();
        ResonanceRouter validRouter = new ResonanceRouter(IERC20(address(usdg)), address(unbound));
        ResonanceRouter wrongTokenRouter = new ResonanceRouter(IERC20(address(target)), address(unbound));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        unbound.setResonanceRouter(address(resonanceRouter));

        vm.expectRevert(Resonance.ZeroAddress.selector);
        unbound.setResonanceRouter(address(0));

        vm.expectRevert(Resonance.ZeroAddress.selector);
        unbound.setResonanceRouter(ALICE);

        vm.expectRevert(abi.encodeWithSelector(Resonance.InvalidResonanceRouter.selector, address(resonanceRouter)));
        unbound.setResonanceRouter(address(resonanceRouter));

        vm.expectRevert(abi.encodeWithSelector(Resonance.InvalidResonanceRouter.selector, address(wrongTokenRouter)));
        unbound.setResonanceRouter(address(wrongTokenRouter));

        unbound.setResonanceRouter(address(validRouter));
        vm.expectRevert(abi.encodeWithSelector(Resonance.ResonanceRouterAlreadySet.selector, address(validRouter)));
        unbound.setResonanceRouter(address(validRouter));
    }

    /*//////////////////////////////////////////////////////////////
                          GOVERNANCE SURFACE
    //////////////////////////////////////////////////////////////*/

    function test_AddStrategyIsOwnerOnlyAndValidatesThePaymentToken() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.addStrategy(IERC20(address(target)), defaultConfig());

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.addStrategy(IERC20(address(0)), defaultConfig());

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.addStrategy(IERC20(ALICE), defaultConfig());
    }

    function test_AddStrategyRegistersTheCompleteRewardGraph() external {
        (address strategyAddress, address bribeAddress, address routerAddress) =
            resonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());

        assertTrue(resonance.isStrategy(strategyAddress));
        assertTrue(resonance.isStrategyAlive(strategyAddress));
        assertEq(resonance.bribeFor(strategyAddress), bribeAddress);
        assertEq(resonance.bribeRouterFor(strategyAddress), routerAddress);
        assertEq(resonance.paymentTokenFor(strategyAddress), address(secondAsset));
        assertEq(resonance.strategies().length, 3);
        assertTrue(Bribe(bribeAddress).isRewardToken(address(secondAsset)));
        assertEq(Strategy(strategyAddress).resonance(), address(resonance));
    }

    function test_AStrategyAddedLaterCannotClaimHistoricRevenue() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(100_000_000);
        _finishRevenueStream();

        uint256 indexAtCreation = resonance.revenueIndex();
        assertGt(indexAtCreation, 0);

        (address lateStrategy,,) = resonance.addStrategy(IERC20(address(secondAsset)), defaultConfig());

        assertEq(resonance.strategyRevenueIndex(lateStrategy), indexAtCreation);
        assertEq(resonance.pendingRevenue(lateStrategy), 0);
        assertEq(resonance.distribute(lateStrategy), 0);
    }

    function test_AddBribeRewardIsOwnerOnlyAndValidated() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.addBribeReward(address(targetStrategy), address(secondAsset));

        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, ALICE));
        resonance.addBribeReward(ALICE, address(secondAsset));

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.addBribeReward(address(targetStrategy), address(0));

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.addBribeReward(address(targetStrategy), BOB);

        vm.expectRevert(abi.encodeWithSelector(Resonance.ForbiddenRewardToken.selector, address(signalGBX)));
        resonance.addBribeReward(address(targetStrategy), address(signalGBX));

        resonance.addBribeReward(address(targetStrategy), address(secondAsset));
        assertTrue(targetBribe.isRewardToken(address(secondAsset)));
    }

    /*//////////////////////////////////////////////////////////////
                          SIGNAL VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_SignalBatchesRejectMismatchedArrayLengths() external {
        _stake(ALICE, 100 ether);

        address[] memory strategies = new address[](2);
        strategies[0] = address(targetStrategy);
        strategies[1] = address(gbxStrategy);
        address[] memory oneStrategy = _addresses(address(targetStrategy));
        uint256[] memory twoAmounts = new uint256[](2);
        twoAmounts[0] = 1;
        twoAmounts[1] = 1;

        vm.prank(ALICE);
        vm.expectRevert(Resonance.LengthMismatch.selector);
        resonance.addSignalMany(strategies, _uints(1));

        vm.prank(ALICE);
        vm.expectRevert(Resonance.LengthMismatch.selector);
        resonance.addSignalMany(oneStrategy, twoAmounts);

        vm.prank(ALICE);
        vm.expectRevert(Resonance.LengthMismatch.selector);
        resonance.removeSignalMany(strategies, _uints(1));

        vm.prank(ALICE);
        vm.expectRevert(Resonance.LengthMismatch.selector);
        resonance.removeSignalMany(oneStrategy, twoAmounts);
    }

    function test_EmptySignalBatchesAreHarmlessNoOps() external {
        _stake(ALICE, 100 ether);

        vm.prank(ALICE);
        resonance.addSignalMany(new address[](0), new uint256[](0));
        vm.prank(ALICE);
        resonance.removeSignalMany(new address[](0), new uint256[](0));

        assertEq(resonance.accountSignalWeight(ALICE), 0);
    }

    function test_AddSignalRejectsAnUnknownStrategy() external {
        _stake(ALICE, 100 ether);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        resonance.addSignal(BOB, 1 ether);
    }

    function test_RemoveSignalRejectsAnUnknownStrategyWithCanonicalError() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        resonance.removeSignal(BOB, 1 ether);
    }

    function test_AddAndRemoveSignalRejectZeroAmounts() external {
        _stake(ALICE, 100 ether);

        vm.prank(ALICE);
        vm.expectRevert(Resonance.ZeroAmount.selector);
        resonance.addSignal(address(targetStrategy), 0);

        vm.prank(ALICE);
        vm.expectRevert(Resonance.ZeroAmount.selector);
        resonance.removeSignal(address(targetStrategy), 0);
    }

    function test_AddSignalManyTreatsRepeatedStrategiesAsSequentialDeltas() external {
        _stake(ALICE, 100 ether);

        address[] memory strategies = new address[](2);
        strategies[0] = address(targetStrategy);
        strategies[1] = address(targetStrategy);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 25 ether;
        amounts[1] = 15 ether;

        vm.prank(ALICE);
        resonance.addSignalMany(strategies, amounts);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 40 ether);
        assertEq(resonance.accountStrategies(ALICE).length, 1);
    }

    function test_AddSignalRejectsMoreThanTheUnallocatedBalance() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.InsufficientUnallocatedSignal.selector, 0, 1 ether));
        resonance.addSignal(address(targetStrategy), 1 ether);
    }

    function test_AddSignalManyRejectsUnknownEntriesAtomically() external {
        _stake(ALICE, 100 ether);

        address[] memory strategies = new address[](2);
        strategies[0] = address(targetStrategy);
        strategies[1] = BOB;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 50 ether;
        amounts[1] = 50 ether;

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        resonance.addSignalMany(strategies, amounts);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 0);
        assertEq(resonance.accountStrategies(ALICE).length, 0);
    }

    function test_AddSignalCannotExceedTheRemainingUnallocatedBalance() external {
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(targetStrategy), 40 ether);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.InsufficientUnallocatedSignal.selector, 60 ether, 61 ether));
        resonance.addSignal(address(gbxStrategy), 61 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          SIGNAL ACCOUNTING
    //////////////////////////////////////////////////////////////*/

    function test_SignalMirrorsWeightIntoEveryBribe() external {
        _stake(ALICE, 100 ether);

        vm.expectEmit(true, true, false, true);
        emit SignalAdded(ALICE, address(targetStrategy), 75 ether);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), 3, 1);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 75 ether);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 25 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
        assertEq(resonance.strategySignalWeight(address(targetStrategy)), 75 ether);
        assertEq(targetBribe.balanceOf(ALICE), 75 ether);
        assertEq(targetBribe.totalSupply(), 75 ether);
        assertEq(gbxBribe.balanceOf(ALICE), 25 ether);
    }

    function test_AddSignalIncreasesRatherThanReplaces() external {
        _stake(ALICE, 100 ether);
        vm.startPrank(ALICE);
        resonance.addSignal(address(targetStrategy), 30 ether);
        resonance.addSignal(address(targetStrategy), 20 ether);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 50 ether);
        assertEq(resonance.strategySignalWeight(address(targetStrategy)), 50 ether);
        assertEq(targetBribe.balanceOf(ALICE), 50 ether);
        assertEq(targetBribe.totalSupply(), 50 ether);
        assertEq(resonance.totalSignalWeight(), 50 ether);
        assertEq(resonance.accountStrategies(ALICE).length, 1);
    }

    function test_RemoveSignalPreservesTheExactPartialAllocation() external {
        _stake(ALICE, 137 ether);
        vm.startPrank(ALICE);
        resonance.addSignal(address(targetStrategy), 101 ether);
        resonance.removeSignal(address(targetStrategy), 37 ether);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 64 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 64 ether);
        assertEq(resonance.strategySignalWeight(address(targetStrategy)), 64 ether);
        assertEq(resonance.totalSignalWeight(), 64 ether);
        assertEq(targetBribe.balanceOf(ALICE), 64 ether);
        assertEq(targetBribe.totalSupply(), 64 ether);
        assertEq(resonance.accountStrategies(ALICE).length, 1);
        assertEq(resonance.accountStrategies(ALICE)[0], address(targetStrategy));
    }

    function test_StakingMoreCreatesUnallocatedBalanceWithoutRepricingExistingSignals() external {
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(targetStrategy), 60 ether);
        _stake(ALICE, 400 ether);

        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 60 ether);
        assertEq(resonance.totalSignalWeight(), 60 ether);
        assertEq(signalGBX.balanceOf(ALICE) - resonance.accountSignalWeight(ALICE), 440 ether);
    }

    function test_RemoveSignalManyClearsSelectedAllocationsAndBribeBalances() external {
        _stake(ALICE, 100 ether);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), 1, 1);

        vm.expectEmit(true, true, false, true);
        emit SignalRemoved(ALICE, address(targetStrategy), 50 ether);
        _removeAllSignals(ALICE);

        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(resonance.accountStrategies(ALICE).length, 0);
        assertEq(targetBribe.balanceOf(ALICE), 0);
        assertEq(gbxBribe.balanceOf(ALICE), 0);
    }

    function test_FullRemovalClearsThePrivateOneBasedStrategyIndex() external {
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(targetStrategy), 100 ether);

        // Slot 21 is pinned by `forge inspect Resonance storage-layout`; the nested mapping entry must not linger.
        bytes32 accountMappingSlot = keccak256(abi.encode(ALICE, uint256(21)));
        bytes32 strategyIndexSlot = keccak256(abi.encode(address(targetStrategy), accountMappingSlot));
        assertEq(uint256(vm.load(address(resonance), strategyIndexSlot)), 1);

        vm.prank(ALICE);
        resonance.removeSignal(address(targetStrategy), 100 ether);
        assertEq(uint256(vm.load(address(resonance), strategyIndexSlot)), 0);
    }

    function test_RemoveSignalRejectsMoreThanTheAccountHolds() external {
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                Resonance.InsufficientSignal.selector, address(targetStrategy), uint256(0), uint256(1)
            )
        );
        resonance.removeSignal(address(targetStrategy), 1);
    }

    /*//////////////////////////////////////////////////////////////
                            REVENUE INDEXING
    //////////////////////////////////////////////////////////////*/

    function test_NotifyRevenueRejectsAnyCallerButTheBoundRouter() external {
        usdg.mint(ALICE, 1_000);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.UnauthorizedRevenueSource.selector, ALICE));
        resonance.notifyRevenue(1_000);
    }

    function test_NotifyRevenueRejectsZero() external {
        vm.prank(address(resonanceRouter));
        vm.expectRevert(Resonance.ZeroAmount.selector);
        resonance.notifyRevenue(0);
    }

    function test_DirectDonationOfAnyNonzeroAmountStartsAStream() external {
        usdg.mint(address(resonance), 100_000);
        assertEq(resonance.syncRevenue(), 100_000);
        assertEq(resonance.unaccountedRevenue(), 0);
        assertEq(resonance.revenueStreamRemainingScaled(), 100_000 * resonance.INDEX_PRECISION());
    }

    function test_SixDecimalRevenueStreamsSmoothlyAndExactly() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        _routeRevenue(700_000);
        assertEq(resonance.pendingRevenue(address(targetStrategy)), 0);
        assertEq(resonance.revenueStreamRemainingScaled(), 700_000 * resonance.INDEX_PRECISION());

        vm.warp(block.timestamp + 3.5 days);
        assertEq(resonance.distribute(address(targetStrategy)), 350_000);

        vm.warp(block.timestamp + 3.5 days);
        assertEq(resonance.distribute(address(targetStrategy)), 350_000);
        assertEq(usdg.balanceOf(address(targetStrategy)), 700_000);
        assertEq(resonance.revenueStreamRemainingScaled(), 0);
        assertEq(resonance.revenueStreamRateScaled(), 0);
        assertEq(resonance.revenueStreamLastUpdate(), 0);
        assertEq(resonance.accountedRevenueBalance(), 0);
    }

    function test_SignalMutationOnlyRedirectsRevenueReleasedAfterTheMutation() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        // An exact one-base-unit-per-second stream makes the interval split unambiguous.
        _routeRevenue(604_800);
        vm.warp(block.timestamp + 1 days);

        _stake(BOB, 100 ether);
        _signalOne(BOB, address(gbxStrategy));

        vm.warp(block.timestamp + 6 days);
        resonance.distributeAll();

        assertEq(usdg.balanceOf(address(targetStrategy)), 345_600, "one day alone plus half of six days");
        assertEq(usdg.balanceOf(address(gbxStrategy)), 259_200, "only half of the post-entry flow");
    }

    function test_LiveTopUpQueuesWithoutChangingTheActiveRateOrFinish() external {
        _stake(ALICE, 1 ether);
        _signalOne(ALICE, address(targetStrategy));

        _routeRevenue(1_209_600); // Exactly two raw USDG units per second.
        assertEq(resonance.revenueStreamRateScaled(), 2 * resonance.INDEX_PRECISION());
        uint256 firstFinish = resonance.revenueStreamFinish();

        vm.warp(block.timestamp + 1 days);
        usdg.mint(address(resonanceRouter), 700_000);
        vm.expectEmit(false, false, false, true, address(resonance));
        emit RevenueStreamCheckpointed(172_800 * resonance.INDEX_PRECISION(), 1_036_800 * resonance.INDEX_PRECISION());
        vm.expectEmit(false, false, false, true, address(resonance));
        emit RevenueQueued(700_000, 700_000);
        assertEq(resonanceRouter.route(), 700_000);
        assertEq(resonanceRouter.pendingRevenue(), 0);
        assertEq(resonance.queuedRevenue(), 700_000);
        assertEq(resonance.revenueStreamFinish(), firstFinish);
        assertEq(resonance.revenueStreamRateScaled(), 2 * resonance.INDEX_PRECISION());

        vm.warp(firstFinish);
        resonance.indexPendingRevenue();

        assertEq(resonance.queuedRevenue(), 0);
        assertEq(resonance.revenueStreamRemainingScaled(), 700_000 * resonance.INDEX_PRECISION());
        assertEq(resonance.revenueStreamFinish(), firstFinish + resonance.REVENUE_STREAM_DURATION());
        assertEq(resonance.revenueStreamRateScaled(), 700_000 * resonance.INDEX_PRECISION() / 7 days);
    }

    function test_OneRawUnitStreamsExactlyAndBecomesClaimable() external {
        _stake(ALICE, 1 ether);
        _signalOne(ALICE, address(targetStrategy));

        uint256 startedAt = block.timestamp;
        uint256 amountScaled = resonance.INDEX_PRECISION();
        usdg.mint(address(resonanceRouter), 1);
        vm.expectEmit(false, false, false, true, address(resonance));
        emit RevenueStreamScheduled(
            1, amountScaled, startedAt, startedAt + 7 days, amountScaled / 7 days, amountScaled % 7 days
        );
        assertEq(resonanceRouter.route(), 1);
        uint256 finish = resonance.revenueStreamFinish();
        assertGt(resonance.revenueStreamRateScaled(), 0, "high precision keeps the smallest stream live");

        vm.warp(finish);
        assertEq(resonance.distribute(address(targetStrategy)), 1);
        assertEq(usdg.balanceOf(address(targetStrategy)), 1);
        assertEq(resonance.accountedRevenueBalance(), 0);
    }

    function test_RevenueWhoseScaledBalanceWouldOverflowRevertsAtomically() external {
        uint256 amount = type(uint256).max / resonance.INDEX_PRECISION() + 1;
        usdg.mint(address(resonanceRouter), amount);

        vm.expectRevert(abi.encodeWithSelector(Resonance.RevenueScaleOverflow.selector, amount));
        resonanceRouter.route();

        assertEq(usdg.balanceOf(address(resonanceRouter)), amount);
        assertEq(usdg.balanceOf(address(resonance)), 0);
        assertEq(resonance.accountedRevenueBalance(), 0);
    }

    function test_RepeatedOneRawTopUpsOnlyAggregateTheSuccessor() external {
        _routeRevenue(100_000_000);
        uint256 activeFinish = resonance.revenueStreamFinish();
        uint256 activeRate = resonance.revenueStreamRateScaled();
        uint256 activeRemainderFinish = resonance.revenueStreamRemainderFinish();

        for (uint256 i; i < 32; ++i) {
            _routeRevenue(1);
        }

        assertEq(resonance.queuedRevenue(), 32);
        assertEq(resonance.revenueStreamFinish(), activeFinish);
        assertEq(resonance.revenueStreamRateScaled(), activeRate);
        assertEq(resonance.revenueStreamRemainderFinish(), activeRemainderFinish);
        assertEq(resonanceRouter.pendingRevenue(), 0);
    }

    function test_OneCheckpointCatchesUpTheActiveStreamAndOneSuccessor() external {
        _stake(ALICE, 1 ether);
        _signalOne(ALICE, address(targetStrategy));

        _routeRevenue(1);
        _routeRevenue(2);
        vm.warp(block.timestamp + 15 days);

        assertEq(resonance.distribute(address(targetStrategy)), 3);
        assertEq(resonance.revenueStreamRemainingScaled(), 0);
        assertEq(resonance.queuedRevenue(), 0);
    }

    function test_ArrivalAfterTheSuccessorEndedStartsANewStreamAtTheCurrentTimestamp() external {
        _routeRevenue(1);
        _routeRevenue(2);
        vm.warp(block.timestamp + 15 days);

        uint256 arrivedAt = block.timestamp;
        _routeRevenue(3);

        assertEq(resonance.revenueStreamRemainingScaled(), 3 * resonance.INDEX_PRECISION());
        assertEq(resonance.revenueStreamLastUpdate(), arrivedAt);
        assertEq(resonance.revenueStreamFinish(), arrivedAt + 7 days);
        assertEq(resonance.queuedRevenue(), 0);
    }

    function test_SameTransactionSignalAndPurchaseCannotCaptureNewlyNotifiedRevenue() external {
        _stake(ALICE, 1 ether);
        _signalOne(ALICE, address(gbxStrategy));
        usdg.mint(address(targetStrategy), 100_000); // The pre-existing cheap-auction inventory.

        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);
        assertEq(targetStrategy.currentPrice(), 0);

        // Models the atomic attack: redirect signal, route a Mine payment, then fill the stale cheap auction.
        _stake(BOB, 1_000_000 ether);
        _signalOne(BOB, address(targetStrategy));
        _routeRevenue(604_800);

        vm.prank(BOB);
        targetStrategy.buy(BOB, 0, block.timestamp, 0);

        assertEq(usdg.balanceOf(BOB), 100_000, "the buyer receives only inventory held before the attack");
        assertEq(resonance.revenueStreamRemainingScaled(), 604_800 * resonance.INDEX_PRECISION());
        assertEq(usdg.balanceOf(address(resonance)), 604_800, "all newly routed revenue remains scheduled");
    }

    function testFuzz_LiveNotificationOnlyIncreasesTheAggregateSuccessor(
        uint256 firstAmount,
        uint256 topUp,
        uint256 elapsed
    ) external {
        uint256 first = bound(firstAmount, 1, 1e12);

        _routeRevenue(first);
        uint256 secondsElapsed = bound(elapsed, 1, resonance.REVENUE_STREAM_DURATION() - 1);
        vm.warp(block.timestamp + secondsElapsed);

        uint256 added = bound(topUp, 1, 1e15);
        uint256 firstFinish = resonance.revenueStreamFinish();
        uint256 firstRate = resonance.revenueStreamRateScaled();
        _routeRevenue(added);

        assertEq(resonance.queuedRevenue(), added);
        assertEq(resonance.revenueStreamFinish(), firstFinish);
        assertEq(resonance.revenueStreamRateScaled(), firstRate);
    }

    function test_RevenueWithNoAllocationsBecomesAPullBasedFundLiability() external {
        _routeRevenue(100_000_000);
        _finishRevenueStream();

        assertEq(usdg.balanceOf(address(fund)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
        assertEq(resonance.fundRevenueLiability(), 100_000_000);
        assertEq(resonance.revenueIndex(), 0);

        vm.prank(KEEPER);
        assertEq(resonance.payFundRevenue(), 100_000_000);
        assertEq(usdg.balanceOf(address(fund)), 100_000_000);
        assertEq(resonance.fundRevenueLiability(), 0);
    }

    function test_AddSignalCheckpointsRevenueBeforeIncreasingStrategyWeight() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(100_000_000);
        _finishRevenueStream();

        _stake(BOB, 100 ether);
        vm.prank(BOB);
        resonance.addSignal(address(targetStrategy), 100 ether);

        assertEq(resonance.claimableRevenue(address(targetStrategy)), 100_000_000);
        assertEq(resonance.strategyRevenueIndex(address(targetStrategy)), resonance.revenueIndex());

        _routeRevenue(100_000_000);
        _finishRevenueStream();
        resonance.distribute(address(targetStrategy));
        assertEq(usdg.balanceOf(address(targetStrategy)), 200_000_000);
    }

    function test_RevenueSplitsByCurrentSignalWeight() external {
        _stake(ALICE, 75 ether);
        _stake(BOB, 25 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));

        usdg.mint(address(resonanceRouter), 100_000_000);
        vm.expectEmit(true, false, false, true);
        emit RevenueNotified(address(resonanceRouter), 100_000_000);
        vm.prank(KEEPER);
        resonanceRouter.route();
        _finishRevenueStream();

        assertEq(resonance.pendingRevenue(address(targetStrategy)), 75_000_000);
        assertEq(resonance.pendingRevenue(address(gbxStrategy)), 25_000_000);

        assertEq(resonance.distribute(address(targetStrategy)), 75_000_000);
        assertEq(resonance.distribute(address(gbxStrategy)), 25_000_000);
        assertEq(usdg.balanceOf(address(targetStrategy)), 75_000_000);
        assertEq(usdg.balanceOf(address(gbxStrategy)), 25_000_000);
    }

    function test_NotifyRevenueRejectsAFeeOnTransferRevenueToken() external {
        FeeOnTransferToken feeUsdg = new FeeOnTransferToken(6);
        (Resonance feeResonance, ResonanceRouter feeRouter) = _deployResonanceFor(feeUsdg);

        feeUsdg.mint(address(feeRouter), 100_000_000);
        feeUsdg.setFeeBps(100);

        vm.expectRevert(abi.encodeWithSelector(Resonance.InexactRevenueTransfer.selector, 100_000_000, 99_000_000));
        feeRouter.route();
        assertEq(feeResonance.revenueIndex(), 0);
    }

    function test_UnindexableRevenueCarryMovesToFundBeforeAWeightChange() external {
        _stake(ALICE, 2e36);
        _signalOne(ALICE, address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 2e36);

        _routeRevenue(1);
        _finishRevenueStream();

        assertEq(resonance.revenueIndex(), 0, "the index never moved");
        assertEq(resonance.pendingRevenue(address(targetStrategy)), 0);
        assertEq(resonance.pendingRevenueScaled(), resonance.INDEX_PRECISION());

        _stake(BOB, 1 ether);
        vm.expectEmit(false, false, false, true, address(resonance));
        emit FundRevenueAccrued(1, 1);
        vm.expectEmit(false, false, false, true, address(resonance));
        emit RevenueCarryFunded(resonance.INDEX_PRECISION(), 0);
        _signalOne(BOB, address(gbxStrategy));

        assertEq(resonance.pendingRevenueScaled(), 0, "old-weight carry cannot cross the signal boundary");
        assertEq(resonance.fundRevenueLiability(), 1);
        assertEq(resonance.fundRevenueRemainderScaled(), 0);
        assertEq(usdg.balanceOf(address(resonance)), 1, "the Fund liability remains pull based");
        assertEq(resonance.distribute(address(targetStrategy)), 0);
    }

    function test_RepeatedSubThresholdRevenueAggregatesIntoAClaim() external {
        _stake(ALICE, 100_000_000 ether);
        _signalOne(ALICE, address(targetStrategy));

        for (uint256 i; i < 20; ++i) {
            _routeRevenue(50_000_000); // 50 USDG, half the resolution threshold
            _finishRevenueStream();
        }

        assertEq(resonance.revenueIndex(), 10 ether);
        assertEq(resonance.pendingRevenue(address(targetStrategy)), 1_000_000_000);
        assertEq(resonance.distribute(address(targetStrategy)), 1_000_000_000);
        assertEq(usdg.balanceOf(address(targetStrategy)), 1_000_000_000);
        assertEq(usdg.balanceOf(address(resonance)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                             DISTRIBUTION
    //////////////////////////////////////////////////////////////*/

    function test_DistributeRejectsAnUnknownStrategy() external {
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, ALICE));
        resonance.distribute(ALICE);

        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, ALICE));
        resonance.updateStrategy(ALICE);

        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, ALICE));
        resonance.claimRewards(_addresses(ALICE));
    }

    function test_DistributingTwiceYieldsNothingTheSecondTime() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(100_000_000);
        _finishRevenueStream();

        vm.expectEmit(true, true, false, true);
        emit RevenueDistributed(address(this), address(targetStrategy), 100_000_000);
        assertEq(resonance.distribute(address(targetStrategy)), 100_000_000);
        assertEq(resonance.distribute(address(targetStrategy)), 0);
    }

    function test_UpdateStrategyCheckpointsWithoutMovingTokens() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(100_000_000);
        _finishRevenueStream();

        resonance.updateStrategy(address(targetStrategy));

        assertEq(resonance.claimableRevenue(address(targetStrategy)), 100_000_000);
        assertEq(resonance.pendingRevenue(address(targetStrategy)), 0);
        assertEq(usdg.balanceOf(address(targetStrategy)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
    }

    function test_DistributeRangeIsBoundedAndClampsTheEndIndex() external {
        _stake(ALICE, 50 ether);
        _stake(BOB, 50 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(100_000_000);
        _finishRevenueStream();

        resonance.distributeRange(0, 1);
        assertEq(usdg.balanceOf(address(targetStrategy)), 50_000_000);
        assertEq(usdg.balanceOf(address(gbxStrategy)), 0);

        resonance.distributeRange(1, type(uint256).max);
        assertEq(usdg.balanceOf(address(gbxStrategy)), 50_000_000);
    }

    function test_DistributeRangeWithAnInvertedWindowIsANoOp() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(100_000_000);

        resonance.distributeRange(5, 1);
        assertEq(usdg.balanceOf(address(targetStrategy)), 0);
    }

    function test_DistributeAllSweepsEveryStrategy() external {
        _stake(ALICE, 50 ether);
        _stake(BOB, 50 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));
        _routeRevenue(100_000_000);
        _finishRevenueStream();

        vm.prank(KEEPER);
        resonance.distributeAll();

        assertEq(usdg.balanceOf(address(targetStrategy)), 50_000_000);
        assertEq(usdg.balanceOf(address(gbxStrategy)), 50_000_000);
        assertEq(usdg.balanceOf(address(resonance)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                          STRATEGY LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    function test_KillStrategyIsOwnerOnlyAndSingleUse() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.killStrategy(address(targetStrategy));

        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, ALICE));
        resonance.killStrategy(ALICE);

        vm.expectEmit(true, false, false, false);
        emit StrategyKilled(address(targetStrategy));
        resonance.killStrategy(address(targetStrategy));

        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        resonance.killStrategy(address(targetStrategy));
    }

    function test_KillStrategyAccruesAlreadyIndexedRevenueToFundWithoutTransfer() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(100_000_000);
        _finishRevenueStream();

        resonance.killStrategy(address(targetStrategy));

        assertFalse(resonance.isStrategyAlive(address(targetStrategy)));
        assertEq(resonance.claimableRevenue(address(targetStrategy)), 0);
        assertEq(usdg.balanceOf(address(fund)), 0);
        assertEq(resonance.fundRevenueLiability(), 100_000_000);
        assertEq(usdg.balanceOf(address(targetStrategy)), 0);

        resonance.payFundRevenue();
        assertEq(usdg.balanceOf(address(fund)), 100_000_000);
    }

    function test_ADeadStrategyKeepsDilutingUntilItsSignalersRemoveTheirSignal() external {
        _stake(ALICE, 50 ether);
        _stake(BOB, 50 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(BOB, address(gbxStrategy));

        resonance.killStrategy(address(targetStrategy));
        assertEq(resonance.totalSignalWeight(), 100 ether, "dead weight still counts toward the denominator");

        _routeRevenue(100_000_000);
        _finishRevenueStream();
        resonance.distributeAll();

        // The dead half becomes a fixed Fund liability; only the live half reaches its Strategy.
        assertEq(usdg.balanceOf(address(gbxStrategy)), 50_000_000);
        assertEq(resonance.fundRevenueLiability(), 50_000_000);
        assertEq(usdg.balanceOf(address(targetStrategy)), 0);

        vm.prank(ALICE);
        resonance.removeSignal(address(targetStrategy), 50 ether);
        assertEq(resonance.totalSignalWeight(), 50 ether);

        _routeRevenue(100_000_000);
        _finishRevenueStream();
        resonance.distributeAll();
        assertEq(usdg.balanceOf(address(gbxStrategy)), 150_000_000, "the survivor now takes the whole flow");
    }

    function test_ADeadStrategyCannotBeSignaledAgain() external {
        _stake(ALICE, 100 ether);
        resonance.killStrategy(address(targetStrategy));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        resonance.addSignal(address(targetStrategy), 1 ether);

        vm.prank(ALICE);
        resonance.addSignal(address(gbxStrategy), 100 ether);
        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 0);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 100 ether);
    }

    function test_SignalersCanStillExitADeadStrategy() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        resonance.killStrategy(address(targetStrategy));

        vm.startPrank(ALICE);
        resonance.removeSignal(address(targetStrategy), 100 ether);
        signalGBX.unstake(100 ether);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                             REWARD CLAIMS
    //////////////////////////////////////////////////////////////*/

    function test_ClaimRewardsPullsFromEveryRequestedBribe() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        target.mint(CAROL, 1 ether);
        vm.startPrank(CAROL);
        target.approve(address(targetBribe), 1 ether);
        targetBribe.notifyRewardAmount(address(target), 1 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days);
        vm.prank(ALICE);
        resonance.claimRewards(_addresses(address(targetStrategy)));

        assertApproxEqRel(target.balanceOf(ALICE), 1 ether, 1e12);
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @notice Per-Strategy weights always sum to the global total, whatever the split.
    function testFuzz_StrategyWeightsAlwaysSumToTheGlobalTotal(uint256 stakeAmount, uint256 first, uint256 second)
        external
    {
        uint256 amount = bound(stakeAmount, 1e18, 1e24);
        uint256 relativeA = bound(first, 1, 1e6);
        uint256 relativeB = bound(second, 1, 1e6);

        _stake(ALICE, amount);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), relativeA, relativeB);

        uint256 summed = resonance.strategySignalWeight(address(targetStrategy))
            + resonance.strategySignalWeight(address(gbxStrategy));

        assertEq(summed, resonance.totalSignalWeight());
        assertEq(summed, resonance.accountSignalWeight(ALICE));
        assertLe(summed, signalGBX.balanceOf(ALICE), "rounding may only lose weight, never invent it");
        assertEq(targetBribe.totalSupply(), resonance.strategySignalWeight(address(targetStrategy)));
        assertEq(gbxBribe.totalSupply(), resonance.strategySignalWeight(address(gbxStrategy)));
    }

    /// @notice Distribution never pays out more USDG than Resonance actually received.
    function testFuzz_DistributionNeverExceedsNotifiedRevenue(uint256 revenue, uint256 split) external {
        uint256 amount = bound(revenue, 1, 1e15);
        uint256 share = bound(split, 1, 99);

        _stake(ALICE, 100 ether);
        _stake(BOB, 100 ether);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), share, 100 - share);
        _signalOne(BOB, address(targetStrategy));

        _routeRevenue(amount);
        _finishRevenueStream();
        resonance.distributeAll();

        uint256 delivered = usdg.balanceOf(address(targetStrategy)) + usdg.balanceOf(address(gbxStrategy));
        uint256 retained = usdg.balanceOf(address(resonance)) + usdg.balanceOf(address(resonanceRouter));

        assertLe(delivered, amount, "Resonance can never hand out more than it took in");
        assertEq(delivered + retained, amount, "every unit is either delivered or still held by the stream router");
    }

    /// @notice Whatever the allocation, an account's mirrored Bribe balance matches its recorded signal.
    function testFuzz_BribeBalancesMirrorRecordedSignals(uint256 aliceStake, uint256 bobStake, uint256 weight)
        external
    {
        uint256 first = bound(aliceStake, 1e18, 1e24);
        uint256 second = bound(bobStake, 1e18, 1e24);
        uint256 relative = bound(weight, 1, 1e6);

        _stake(ALICE, first);
        _stake(BOB, second);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), relative, 1e6);
        _signalOne(BOB, address(targetStrategy));

        assertEq(targetBribe.balanceOf(ALICE), resonance.accountSignals(ALICE, address(targetStrategy)));
        assertEq(targetBribe.balanceOf(BOB), resonance.accountSignals(BOB, address(targetStrategy)));
        assertEq(gbxBribe.balanceOf(ALICE), resonance.accountSignals(ALICE, address(gbxStrategy)));
        assertEq(targetBribe.totalSupply(), targetBribe.balanceOf(ALICE) + targetBribe.balanceOf(BOB));
    }

    /// @notice Caller-bounded batch removal can always return the system to a pristine zero-weight state.
    function testFuzz_RemoveSignalManyIsAlwaysComplete(uint256 stakeAmount, uint256 first, uint256 second) external {
        uint256 amount = bound(stakeAmount, 1e18, 1e24);

        _stake(ALICE, amount);
        _signalTwo(ALICE, address(targetStrategy), address(gbxStrategy), bound(first, 1, 1e6), bound(second, 1, 1e6));

        _removeAllSignals(ALICE);

        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(resonance.strategySignalWeight(address(targetStrategy)), 0);
        assertEq(resonance.strategySignalWeight(address(gbxStrategy)), 0);
        assertEq(targetBribe.totalSupply(), 0);
        assertEq(gbxBribe.totalSupply(), 0);
        assertEq(resonance.accountStrategies(ALICE).length, 0);
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
        returns (Resonance deployed, ResonanceRouter deployedRouter)
    {
        BribeFactory factory = new BribeFactory(address(this));
        StrategyFactory strategies = new StrategyFactory(address(this));
        deployed = new Resonance(
            IERC20(address(signalGBX)), IERC20(address(revenueToken)), address(fund), factory, strategies, address(this)
        );
        factory.setResonance(address(deployed));
        strategies.setResonance(address(deployed));
        deployedRouter = new ResonanceRouter(IERC20(address(revenueToken)), address(deployed));
        deployed.setResonanceRouter(address(deployedRouter));
    }
}
