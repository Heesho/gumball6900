// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

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
    event RevenueDistributed(address indexed caller, address indexed strategy, uint256 amount);
    event RevenueNotified(address indexed resonanceRouter, uint256 amount);
    event SignalAdded(address indexed account, address indexed strategy, uint256 amount);
    event SignalRemoved(address indexed account, address indexed strategy, uint256 amount);
    event StrategyKilled(address indexed strategy);
    event BribeBpsSet(uint256 previousBps, uint256 newBps);

    function setUp() external {
        _deployProtocol();
    }

    /*//////////////////////////////////////////////////////////////
                        CONSTRUCTION AND BINDING
    //////////////////////////////////////////////////////////////*/

    function test_InitialStateMatchesTheDocumentedDefaults() external view {
        assertEq(resonance.bribeBps(), 1_000);
        assertEq(resonance.DEFAULT_BRIBE_BPS(), 1_000);
        assertEq(resonance.MAX_BRIBE_BPS(), 5_000);
        assertEq(resonance.INDEX_PRECISION(), 1e18);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(resonance.revenueIndex(), 0);
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

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        unbound.setResonanceRouter(address(resonanceRouter));

        vm.expectRevert(Resonance.ZeroAddress.selector);
        unbound.setResonanceRouter(address(0));

        vm.expectRevert(Resonance.ZeroAddress.selector);
        unbound.setResonanceRouter(ALICE);

        unbound.setResonanceRouter(address(resonanceRouter));
        vm.expectRevert(abi.encodeWithSelector(Resonance.ResonanceRouterAlreadySet.selector, address(resonanceRouter)));
        unbound.setResonanceRouter(address(resonanceRouter));
    }

    /*//////////////////////////////////////////////////////////////
                          GOVERNANCE SURFACE
    //////////////////////////////////////////////////////////////*/

    function test_SetBribeBpsIsOwnerOnlyAndBoundedByFiftyPercent() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.setBribeBps(2_000);

        vm.expectRevert(abi.encodeWithSelector(Resonance.BribeBpsAboveMaximum.selector, 5_001));
        resonance.setBribeBps(5_001);

        vm.expectEmit(false, false, false, true);
        emit BribeBpsSet(1_000, 5_000);
        resonance.setBribeBps(5_000);
        assertEq(resonance.bribeBps(), 5_000);

        resonance.setBribeBps(0);
        assertEq(resonance.bribeBps(), 0);
    }

    function test_AddStrategyIsOwnerOnlyAndValidatesThePaymentToken() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.addStrategy(IERC20(address(target)), Strategy.Kind.Acquisition, defaultConfig());

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.addStrategy(IERC20(address(0)), Strategy.Kind.Acquisition, defaultConfig());

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.addStrategy(IERC20(ALICE), Strategy.Kind.Acquisition, defaultConfig());
    }

    function test_AddStrategyRegistersTheCompleteRewardGraph() external {
        (address strategyAddress, address bribeAddress, address routerAddress) =
            resonance.addStrategy(IERC20(address(secondAsset)), Strategy.Kind.Acquisition, defaultConfig());

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
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);

        uint256 indexAtCreation = resonance.revenueIndex();
        assertGt(indexAtCreation, 0);

        (address lateStrategy,,) =
            resonance.addStrategy(IERC20(address(secondAsset)), Strategy.Kind.Acquisition, defaultConfig());

        assertEq(resonance.strategyRevenueIndex(lateStrategy), indexAtCreation);
        assertEq(resonance.pendingRevenue(lateStrategy), 0);
        assertEq(resonance.distribute(lateStrategy), 0);
    }

    function test_AddBribeRewardIsOwnerOnlyAndValidated() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.addBribeReward(address(acquisitionStrategy), address(secondAsset));

        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, ALICE));
        resonance.addBribeReward(ALICE, address(secondAsset));

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.addBribeReward(address(acquisitionStrategy), address(0));

        vm.expectRevert(Resonance.ZeroAddress.selector);
        resonance.addBribeReward(address(acquisitionStrategy), BOB);

        resonance.addBribeReward(address(acquisitionStrategy), address(secondAsset));
        assertTrue(acquisitionBribe.isRewardToken(address(secondAsset)));
    }

    /*//////////////////////////////////////////////////////////////
                          SIGNAL VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_SignalBatchesRejectMismatchedArrayLengths() external {
        _stake(ALICE, 100 ether);

        address[] memory strategies = new address[](2);
        strategies[0] = address(acquisitionStrategy);
        strategies[1] = address(buybackStrategy);
        address[] memory oneStrategy = _addresses(address(acquisitionStrategy));
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
        resonance.addSignal(address(acquisitionStrategy), 0);

        vm.prank(ALICE);
        vm.expectRevert(Resonance.ZeroAmount.selector);
        resonance.removeSignal(address(acquisitionStrategy), 0);
    }

    function test_AddSignalManyTreatsRepeatedStrategiesAsSequentialDeltas() external {
        _stake(ALICE, 100 ether);

        address[] memory strategies = new address[](2);
        strategies[0] = address(acquisitionStrategy);
        strategies[1] = address(acquisitionStrategy);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 25 ether;
        amounts[1] = 15 ether;

        vm.prank(ALICE);
        resonance.addSignalMany(strategies, amounts);

        assertEq(resonance.accountSignals(ALICE, address(acquisitionStrategy)), 40 ether);
        assertEq(resonance.accountStrategies(ALICE).length, 1);
    }

    function test_AddSignalRejectsMoreThanTheUnallocatedBalance() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.InsufficientUnallocatedSignal.selector, 0, 1 ether));
        resonance.addSignal(address(acquisitionStrategy), 1 ether);
    }

    function test_AddSignalManyRejectsUnknownEntriesAtomically() external {
        _stake(ALICE, 100 ether);

        address[] memory strategies = new address[](2);
        strategies[0] = address(acquisitionStrategy);
        strategies[1] = BOB;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 50 ether;
        amounts[1] = 50 ether;

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, BOB));
        resonance.addSignalMany(strategies, amounts);

        assertEq(resonance.accountSignals(ALICE, address(acquisitionStrategy)), 0);
        assertEq(resonance.accountStrategies(ALICE).length, 0);
    }

    function test_AddSignalCannotExceedTheRemainingUnallocatedBalance() external {
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(acquisitionStrategy), 40 ether);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.InsufficientUnallocatedSignal.selector, 60 ether, 61 ether));
        resonance.addSignal(address(buybackStrategy), 61 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          SIGNAL ACCOUNTING
    //////////////////////////////////////////////////////////////*/

    function test_SignalMirrorsWeightIntoEveryBribe() external {
        _stake(ALICE, 100 ether);

        vm.expectEmit(true, true, false, true);
        emit SignalAdded(ALICE, address(acquisitionStrategy), 75 ether);
        _signalTwo(ALICE, address(acquisitionStrategy), address(buybackStrategy), 3, 1);

        assertEq(resonance.accountSignals(ALICE, address(acquisitionStrategy)), 75 ether);
        assertEq(resonance.accountSignals(ALICE, address(buybackStrategy)), 25 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 100 ether);
        assertEq(resonance.totalSignalWeight(), 100 ether);
        assertEq(resonance.strategySignalWeight(address(acquisitionStrategy)), 75 ether);
        assertEq(acquisitionBribe.balanceOf(ALICE), 75 ether);
        assertEq(acquisitionBribe.totalSupply(), 75 ether);
        assertEq(buybackBribe.balanceOf(ALICE), 25 ether);
    }

    function test_AddSignalIncreasesRatherThanReplaces() external {
        _stake(ALICE, 100 ether);
        vm.startPrank(ALICE);
        resonance.addSignal(address(acquisitionStrategy), 30 ether);
        resonance.addSignal(address(acquisitionStrategy), 20 ether);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(acquisitionStrategy)), 50 ether);
        assertEq(resonance.strategySignalWeight(address(acquisitionStrategy)), 50 ether);
        assertEq(acquisitionBribe.balanceOf(ALICE), 50 ether);
        assertEq(acquisitionBribe.totalSupply(), 50 ether);
        assertEq(resonance.totalSignalWeight(), 50 ether);
        assertEq(resonance.accountStrategies(ALICE).length, 1);
    }

    function test_RemoveSignalPreservesTheExactPartialAllocation() external {
        _stake(ALICE, 137 ether);
        vm.startPrank(ALICE);
        resonance.addSignal(address(acquisitionStrategy), 101 ether);
        resonance.removeSignal(address(acquisitionStrategy), 37 ether);
        vm.stopPrank();

        assertEq(resonance.accountSignals(ALICE, address(acquisitionStrategy)), 64 ether);
        assertEq(resonance.accountSignalWeight(ALICE), 64 ether);
        assertEq(resonance.strategySignalWeight(address(acquisitionStrategy)), 64 ether);
        assertEq(resonance.totalSignalWeight(), 64 ether);
        assertEq(acquisitionBribe.balanceOf(ALICE), 64 ether);
        assertEq(acquisitionBribe.totalSupply(), 64 ether);
        assertEq(resonance.accountStrategies(ALICE).length, 1);
        assertEq(resonance.accountStrategies(ALICE)[0], address(acquisitionStrategy));
    }

    function test_StakingMoreCreatesUnallocatedBalanceWithoutRepricingExistingSignals() external {
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(acquisitionStrategy), 60 ether);
        _stake(ALICE, 400 ether);

        assertEq(resonance.accountSignals(ALICE, address(acquisitionStrategy)), 60 ether);
        assertEq(resonance.totalSignalWeight(), 60 ether);
        assertEq(signalGBX.balanceOf(ALICE) - resonance.accountSignalWeight(ALICE), 440 ether);
    }

    function test_RemoveSignalManyClearsSelectedAllocationsAndBribeBalances() external {
        _stake(ALICE, 100 ether);
        _signalTwo(ALICE, address(acquisitionStrategy), address(buybackStrategy), 1, 1);

        vm.expectEmit(true, true, false, true);
        emit SignalRemoved(ALICE, address(acquisitionStrategy), 50 ether);
        _removeAllSignals(ALICE);

        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(resonance.accountStrategies(ALICE).length, 0);
        assertEq(acquisitionBribe.balanceOf(ALICE), 0);
        assertEq(buybackBribe.balanceOf(ALICE), 0);
    }

    function test_FullRemovalClearsThePrivateOneBasedStrategyIndex() external {
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(acquisitionStrategy), 100 ether);

        // Slot 16 is pinned by `forge inspect Resonance storage-layout`; the nested mapping entry must not linger.
        bytes32 accountMappingSlot = keccak256(abi.encode(ALICE, uint256(16)));
        bytes32 strategyIndexSlot = keccak256(abi.encode(address(acquisitionStrategy), accountMappingSlot));
        assertEq(uint256(vm.load(address(resonance), strategyIndexSlot)), 1);

        vm.prank(ALICE);
        resonance.removeSignal(address(acquisitionStrategy), 100 ether);
        assertEq(uint256(vm.load(address(resonance), strategyIndexSlot)), 0);
    }

    function test_RemoveSignalRejectsMoreThanTheAccountHolds() external {
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                Resonance.InsufficientSignal.selector, address(acquisitionStrategy), uint256(0), uint256(1)
            )
        );
        resonance.removeSignal(address(acquisitionStrategy), 1);
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

    function test_RevenueWithNoAllocationsBecomesFundBackingImmediately() external {
        _routeRevenue(100_000_000);

        assertEq(usdg.balanceOf(address(fund)), 100_000_000);
        assertEq(usdg.balanceOf(address(resonance)), 0);
        assertEq(resonance.revenueIndex(), 0);
    }

    function test_AddSignalCheckpointsRevenueBeforeIncreasingStrategyWeight() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);

        _stake(BOB, 100 ether);
        vm.prank(BOB);
        resonance.addSignal(address(acquisitionStrategy), 100 ether);

        assertEq(resonance.claimableRevenue(address(acquisitionStrategy)), 100_000_000);
        assertEq(resonance.strategyRevenueIndex(address(acquisitionStrategy)), resonance.revenueIndex());

        _routeRevenue(100_000_000);
        resonance.distribute(address(acquisitionStrategy));
        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 200_000_000);
    }

    function test_RevenueSplitsByCurrentSignalWeight() external {
        _stake(ALICE, 75 ether);
        _stake(BOB, 25 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _signalOne(BOB, address(buybackStrategy));

        usdg.mint(address(resonanceRouter), 100_000_000);
        vm.expectEmit(true, false, false, true);
        emit RevenueNotified(address(resonanceRouter), 100_000_000);
        vm.prank(KEEPER);
        resonanceRouter.route();

        assertEq(resonance.pendingRevenue(address(acquisitionStrategy)), 75_000_000);
        assertEq(resonance.pendingRevenue(address(buybackStrategy)), 25_000_000);

        assertEq(resonance.distribute(address(acquisitionStrategy)), 75_000_000);
        assertEq(resonance.distribute(address(buybackStrategy)), 25_000_000);
        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 75_000_000);
        assertEq(usdg.balanceOf(address(buybackStrategy)), 25_000_000);
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

    /// @notice Revenue too small to move the index is silently retained by Resonance forever.
    /// @dev `indexDelta = amount * 1e18 / totalSignalWeight` floors to zero whenever
    ///      `amount < totalSignalWeight / 1e18`. With eighteen-decimal signal weight and six-decimal USDG that
    ///      threshold is `staked GBX / 1e12` raw units, so at 100,000,000 GBX signaled every notification below
    ///      100 USDG is absorbed without accounting. Nothing reverts and no index advances.
    function test_RevenueBelowTheIndexResolutionIsSilentlySwallowed() external {
        _stake(ALICE, 100_000_000 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        assertEq(resonance.totalSignalWeight(), 1e26);

        uint256 threshold = 1e26 / 1e18; // 100_000_000 raw USDG units, i.e. 100 USDG
        assertEq(threshold, 100_000_000);

        _routeRevenue(threshold - 1);

        assertEq(resonance.revenueIndex(), 0, "the index never moved");
        assertEq(resonance.pendingRevenue(address(acquisitionStrategy)), 0);
        assertEq(usdg.balanceOf(address(resonance)), threshold - 1, "the revenue is stranded in Resonance");
        assertEq(resonance.distribute(address(acquisitionStrategy)), 0);

        // One unit more is the first amount that registers at all, and it registers as the minimum tick.
        _routeRevenue(threshold);
        assertEq(resonance.revenueIndex(), 1);
        assertEq(resonance.pendingRevenue(address(acquisitionStrategy)), threshold);
    }

    /// @notice Repeated sub-threshold notifications never aggregate; each one is absorbed independently.
    function test_SubThresholdRevenueNeverAccumulatesIntoAClaim() external {
        _stake(ALICE, 100_000_000 ether);
        _signalOne(ALICE, address(acquisitionStrategy));

        for (uint256 i; i < 20; ++i) {
            _routeRevenue(50_000_000); // 50 USDG, half the resolution threshold
        }

        assertEq(resonance.revenueIndex(), 0);
        assertEq(usdg.balanceOf(address(resonance)), 1_000_000_000, "1,000 USDG absorbed with no claim created");
        assertEq(resonance.pendingRevenue(address(acquisitionStrategy)), 0);
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
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);

        vm.expectEmit(true, true, false, true);
        emit RevenueDistributed(address(this), address(acquisitionStrategy), 100_000_000);
        assertEq(resonance.distribute(address(acquisitionStrategy)), 100_000_000);
        assertEq(resonance.distribute(address(acquisitionStrategy)), 0);
    }

    function test_UpdateStrategyCheckpointsWithoutMovingTokens() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);

        resonance.updateStrategy(address(acquisitionStrategy));

        assertEq(resonance.claimableRevenue(address(acquisitionStrategy)), 100_000_000);
        assertEq(resonance.pendingRevenue(address(acquisitionStrategy)), 0);
        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
    }

    function test_DistributeRangeIsBoundedAndClampsTheEndIndex() external {
        _stake(ALICE, 50 ether);
        _stake(BOB, 50 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _signalOne(BOB, address(buybackStrategy));
        _routeRevenue(100_000_000);

        resonance.distributeRange(0, 1);
        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 50_000_000);
        assertEq(usdg.balanceOf(address(buybackStrategy)), 0);

        resonance.distributeRange(1, type(uint256).max);
        assertEq(usdg.balanceOf(address(buybackStrategy)), 50_000_000);
    }

    function test_DistributeRangeWithAnInvertedWindowIsANoOp() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);

        resonance.distributeRange(5, 1);
        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 0);
    }

    function test_DistributeAllSweepsEveryStrategy() external {
        _stake(ALICE, 50 ether);
        _stake(BOB, 50 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _signalOne(BOB, address(buybackStrategy));
        _routeRevenue(100_000_000);

        vm.prank(KEEPER);
        resonance.distributeAll();

        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 50_000_000);
        assertEq(usdg.balanceOf(address(buybackStrategy)), 50_000_000);
        assertEq(usdg.balanceOf(address(resonance)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                          STRATEGY LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    function test_KillStrategyIsOwnerOnlyAndSingleUse() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.killStrategy(address(acquisitionStrategy));

        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyNotFound.selector, ALICE));
        resonance.killStrategy(ALICE);

        vm.expectEmit(true, false, false, false);
        emit StrategyKilled(address(acquisitionStrategy));
        resonance.killStrategy(address(acquisitionStrategy));

        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(acquisitionStrategy)));
        resonance.killStrategy(address(acquisitionStrategy));
    }

    function test_KillStrategyReturnsAlreadyIndexedRevenueToFund() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);

        resonance.killStrategy(address(acquisitionStrategy));

        assertFalse(resonance.isStrategyAlive(address(acquisitionStrategy)));
        assertEq(resonance.claimableRevenue(address(acquisitionStrategy)), 0);
        assertEq(usdg.balanceOf(address(fund)), 100_000_000);
        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 0);
    }

    function test_ADeadStrategyKeepsDilutingUntilItsSignalersRemoveTheirSignal() external {
        _stake(ALICE, 50 ether);
        _stake(BOB, 50 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _signalOne(BOB, address(buybackStrategy));

        resonance.killStrategy(address(acquisitionStrategy));
        assertEq(resonance.totalSignalWeight(), 100 ether, "dead weight still counts toward the denominator");

        _routeRevenue(100_000_000);
        resonance.distributeAll();

        // The dead half is rerouted to Fund; only the live half reaches its Strategy.
        assertEq(usdg.balanceOf(address(buybackStrategy)), 50_000_000);
        assertEq(usdg.balanceOf(address(fund)), 50_000_000);
        assertEq(usdg.balanceOf(address(acquisitionStrategy)), 0);

        vm.prank(ALICE);
        resonance.removeSignal(address(acquisitionStrategy), 50 ether);
        assertEq(resonance.totalSignalWeight(), 50 ether);

        _routeRevenue(100_000_000);
        resonance.distributeAll();
        assertEq(usdg.balanceOf(address(buybackStrategy)), 150_000_000, "the survivor now takes the whole flow");
    }

    function test_ADeadStrategyCannotBeSignaledAgain() external {
        _stake(ALICE, 100 ether);
        resonance.killStrategy(address(acquisitionStrategy));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(acquisitionStrategy)));
        resonance.addSignal(address(acquisitionStrategy), 1 ether);

        vm.prank(ALICE);
        resonance.addSignal(address(buybackStrategy), 100 ether);
        assertEq(resonance.accountSignals(ALICE, address(acquisitionStrategy)), 0);
        assertEq(resonance.accountSignals(ALICE, address(buybackStrategy)), 100 ether);
    }

    function test_SignalersCanStillExitADeadStrategy() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        resonance.killStrategy(address(acquisitionStrategy));

        vm.startPrank(ALICE);
        resonance.removeSignal(address(acquisitionStrategy), 100 ether);
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
        _signalOne(ALICE, address(acquisitionStrategy));
        _routeRevenue(100_000_000);
        resonance.distribute(address(acquisitionStrategy));
        _buyAcquisition(CAROL, acquisitionStrategy, target);

        vm.warp(block.timestamp + 7 days);
        vm.prank(ALICE);
        resonance.claimRewards(_addresses(address(acquisitionStrategy)));

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
        _signalTwo(ALICE, address(acquisitionStrategy), address(buybackStrategy), relativeA, relativeB);

        uint256 summed = resonance.strategySignalWeight(address(acquisitionStrategy))
            + resonance.strategySignalWeight(address(buybackStrategy));

        assertEq(summed, resonance.totalSignalWeight());
        assertEq(summed, resonance.accountSignalWeight(ALICE));
        assertLe(summed, signalGBX.balanceOf(ALICE), "rounding may only lose weight, never invent it");
        assertEq(acquisitionBribe.totalSupply(), resonance.strategySignalWeight(address(acquisitionStrategy)));
        assertEq(buybackBribe.totalSupply(), resonance.strategySignalWeight(address(buybackStrategy)));
    }

    /// @notice Distribution never pays out more USDG than Resonance actually received.
    function testFuzz_DistributionNeverExceedsNotifiedRevenue(uint256 revenue, uint256 split) external {
        uint256 amount = bound(revenue, 1, 1e15);
        uint256 share = bound(split, 1, 99);

        _stake(ALICE, 100 ether);
        _stake(BOB, 100 ether);
        _signalTwo(ALICE, address(acquisitionStrategy), address(buybackStrategy), share, 100 - share);
        _signalOne(BOB, address(acquisitionStrategy));

        _routeRevenue(amount);
        resonance.distributeAll();

        uint256 delivered = usdg.balanceOf(address(acquisitionStrategy)) + usdg.balanceOf(address(buybackStrategy));
        uint256 retained = usdg.balanceOf(address(resonance));

        assertLe(delivered, amount, "Resonance can never hand out more than it took in");
        assertEq(delivered + retained, amount, "every unit is either delivered or still held");
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
        _signalTwo(ALICE, address(acquisitionStrategy), address(buybackStrategy), relative, 1e6);
        _signalOne(BOB, address(acquisitionStrategy));

        assertEq(acquisitionBribe.balanceOf(ALICE), resonance.accountSignals(ALICE, address(acquisitionStrategy)));
        assertEq(acquisitionBribe.balanceOf(BOB), resonance.accountSignals(BOB, address(acquisitionStrategy)));
        assertEq(buybackBribe.balanceOf(ALICE), resonance.accountSignals(ALICE, address(buybackStrategy)));
        assertEq(acquisitionBribe.totalSupply(), acquisitionBribe.balanceOf(ALICE) + acquisitionBribe.balanceOf(BOB));
    }

    /// @notice Caller-bounded batch removal can always return the system to a pristine zero-weight state.
    function testFuzz_RemoveSignalManyIsAlwaysComplete(uint256 stakeAmount, uint256 first, uint256 second) external {
        uint256 amount = bound(stakeAmount, 1e18, 1e24);

        _stake(ALICE, amount);
        _signalTwo(
            ALICE, address(acquisitionStrategy), address(buybackStrategy), bound(first, 1, 1e6), bound(second, 1, 1e6)
        );

        _removeAllSignals(ALICE);

        assertEq(resonance.accountSignalWeight(ALICE), 0);
        assertEq(resonance.totalSignalWeight(), 0);
        assertEq(resonance.strategySignalWeight(address(acquisitionStrategy)), 0);
        assertEq(resonance.strategySignalWeight(address(buybackStrategy)), 0);
        assertEq(acquisitionBribe.totalSupply(), 0);
        assertEq(buybackBribe.totalSupply(), 0);
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
