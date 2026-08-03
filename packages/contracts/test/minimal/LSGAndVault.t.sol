// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { EmergencyGuardian } from "../../src/access/EmergencyGuardian.sol";
import { ProtocolTimelock } from "../../src/access/ProtocolTimelock.sol";
import { IAllocationVoter } from "../../src/interfaces/IAllocationVoter.sol";
import { IAssetRegistry } from "../../src/interfaces/IAssetRegistry.sol";
import { StrategyRewards } from "../../src/rewards/StrategyRewards.sol";
import { AllocationVoter } from "../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../src/signal/StakedGBX.sol";
import { GBXToken } from "../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../src/vault/GumBallVault.sol";
import {
    LSGAccessStrategyMock,
    LSGAcquisitionIdentity,
    LSGFeeToken,
    LSGGasBurningRewardsIdentityMock,
    LSGLiquiditySource,
    LSGMiningSource,
    LSGReentrantRewardsIdentityMock,
    LSGRevertingRewardsIdentityMock,
    LSGRewardsIdentityMock,
    LSGStandaloneIdentity,
    LSGTestToken
} from "./LSGVaultAccessMocks.sol";

abstract contract MinimalLSGFixture is Test {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA201);
    address internal constant OUTSIDER = address(0xBAD);
    address internal constant GUARDIAN_OPERATOR = address(0x6900);

    ProtocolTimelock internal timelock;
    EmergencyGuardian internal guardian;
    LSGTestToken internal usdG;
    LSGTestToken internal assetA;
    LSGTestToken internal assetB;
    AssetRegistry internal registry;
    AllocationVoter internal voter;
    GBXToken internal gbx;
    StakedGBX internal staked;
    GumBallVault internal vault;
    LSGMiningSource internal miningSource;
    LSGLiquiditySource internal liquiditySource;
    LSGAcquisitionIdentity internal strategyA;
    LSGAcquisitionIdentity internal strategyB;
    StrategyRewards internal rewardsA;
    StrategyRewards internal rewardsB;

    function setUp() public virtual {
        timelock = new ProtocolTimelock(address(this));
        guardian = new EmergencyGuardian(GUARDIAN_OPERATOR, address(this));
        usdG = new LSGTestToken("Global Dollar", "USDG", 6);
        assetA = new LSGTestToken("Asset A", "ASSETA", 18);
        assetB = new LSGTestToken("Asset B", "ASSETB", 18);
        registry = new AssetRegistry(address(usdG), address(timelock), address(guardian));
        voter = new AllocationVoter(
            address(usdG), IAssetRegistry(address(registry)), address(timelock), address(guardian), address(this)
        );
        gbx = new GBXToken(address(this), address(this), address(timelock));
        staked = new StakedGBX(gbx, voter);
        miningSource = new LSGMiningSource();
        liquiditySource = new LSGLiquiditySource();
        vault = new GumBallVault(gbx, address(usdG), registry, voter);

        voter.initializeDependencies(address(vault), address(staked), address(miningSource), address(liquiditySource));
        guardian.initializeTargets(miningSource, voter, registry);

        strategyA = new LSGAcquisitionIdentity(address(assetA), registry);
        rewardsA = new StrategyRewards(address(assetA), address(voter), address(this));
        strategyA.bindRewards(address(rewardsA));
        rewardsA.initializeStrategy(address(strategyA));

        strategyB = new LSGAcquisitionIdentity(address(assetB), registry);
        rewardsB = new StrategyRewards(address(assetB), address(voter), address(this));
        strategyB.bindRewards(address(rewardsB));
        rewardsB.initializeStrategy(address(strategyB));

        vm.startPrank(address(timelock));
        registry.registerAsset(address(assetA), address(strategyA), address(rewardsA));
        registry.registerAsset(address(assetB), address(strategyB), address(rewardsB));
        vm.stopPrank();

        gbx.transfer(ALICE, 5_000_000 ether);
        gbx.transfer(BOB, 1_000_000 ether);
    }

    function _stake(address user, uint256 amount) internal {
        vm.startPrank(user);
        gbx.approve(address(staked), type(uint256).max);
        staked.stake(amount);
        vm.stopPrank();
    }

    function _signal(address user, address strategy, uint256 weight) internal {
        address[] memory strategies = new address[](1);
        strategies[0] = strategy;
        uint256[] memory weights = new uint256[](1);
        weights[0] = weight;
        vm.prank(user);
        voter.signal(strategies, weights);
    }

    function _signalTwo(address user, uint256 weightA, uint256 weightB) internal {
        address[] memory strategies = new address[](2);
        strategies[0] = address(strategyA);
        strategies[1] = address(strategyB);
        uint256[] memory weights = new uint256[](2);
        weights[0] = weightA;
        weights[1] = weightB;
        vm.prank(user);
        voter.signal(strategies, weights);
    }
}

contract MinimalStakingAndAllocationVoterTest is MinimalLSGFixture {
    function test_ConstructorAndDependencyBindingRejectZeroCodeLessUnauthorizedAndRepeatInputs() public {
        vm.expectRevert(AllocationVoter.AllocationVoter__ZeroAddress.selector);
        new AllocationVoter(address(0), registry, address(timelock), address(guardian), address(this));
        vm.expectRevert(AllocationVoter.AllocationVoter__ZeroAddress.selector);
        new AllocationVoter(OUTSIDER, registry, address(timelock), address(guardian), address(this));
        vm.expectRevert(StakedGBX.StakedGBX__ZeroAddress.selector);
        new StakedGBX(gbx, IAllocationVoter(address(0)));
        vm.expectRevert(StakedGBX.StakedGBX__ZeroAddress.selector);
        new StakedGBX(gbx, IAllocationVoter(OUTSIDER));

        AllocationVoter fresh =
            new AllocationVoter(address(usdG), registry, address(timelock), address(guardian), address(this));
        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__Unauthorized.selector, OUTSIDER));
        fresh.initializeDependencies(address(vault), address(staked), address(miningSource), address(liquiditySource));

        vm.expectRevert(AllocationVoter.AllocationVoter__ZeroAddress.selector);
        fresh.initializeDependencies(address(0), address(staked), address(miningSource), address(liquiditySource));
        vm.expectRevert(AllocationVoter.AllocationVoter__ZeroAddress.selector);
        fresh.initializeDependencies(OUTSIDER, address(staked), address(miningSource), address(liquiditySource));

        fresh.initializeDependencies(address(vault), address(staked), address(miningSource), address(liquiditySource));
        vm.expectRevert(AllocationVoter.AllocationVoter__AlreadyInitialized.selector);
        fresh.initializeDependencies(address(vault), address(staked), address(miningSource), address(liquiditySource));
    }

    function test_AllStatefulVoterEntrypointsRejectCallsBeforeDependencyBinding() public {
        AllocationVoter fresh =
            new AllocationVoter(address(usdG), registry, address(timelock), address(guardian), address(this));
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategyA);
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;

        vm.expectRevert(AllocationVoter.AllocationVoter__NotInitialized.selector);
        fresh.signal(strategies, weights);
        vm.expectRevert(AllocationVoter.AllocationVoter__NotInitialized.selector);
        fresh.resetSignals();
        vm.expectRevert(AllocationVoter.AllocationVoter__NotInitialized.selector);
        fresh.notifyRevenue(1);
        vm.expectRevert(AllocationVoter.AllocationVoter__NotInitialized.selector);
        fresh.consumeStrategyBudget(address(strategyA), 1);
        vm.expectRevert(AllocationVoter.AllocationVoter__NotInitialized.selector);
        fresh.scaleBudgetsAfterRedemption(1, 2);
        vm.expectRevert(AllocationVoter.AllocationVoter__NotInitialized.selector);
        fresh.disableStrategy(address(strategyA));
        vm.expectRevert(AllocationVoter.AllocationVoter__NotInitialized.selector);
        fresh.checkpointStrategyBudget(address(strategyA));
    }

    function test_VoterAuthorizationSolvencyAndAmountBoundariesFailClosed() public {
        _stake(ALICE, 10 ether);
        address[] memory emptyStrategies = new address[](0);
        uint256[] memory emptyWeights = new uint256[](0);
        vm.prank(ALICE);
        vm.expectRevert(AllocationVoter.AllocationVoter__InvalidArrayLength.selector);
        voter.signal(emptyStrategies, emptyWeights);

        address[] memory strategies = new address[](1);
        strategies[0] = address(strategyA);
        uint256[] memory noWeights = new uint256[](0);
        vm.prank(ALICE);
        vm.expectRevert(AllocationVoter.AllocationVoter__InvalidArrayLength.selector);
        voter.signal(strategies, noWeights);
        uint256[] memory weights = new uint256[](1);
        vm.prank(ALICE);
        vm.expectRevert(AllocationVoter.AllocationVoter__ZeroAmount.selector);
        voter.signal(strategies, weights);

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__Unauthorized.selector, OUTSIDER));
        voter.notifyRevenue(1);
        vm.expectRevert(AllocationVoter.AllocationVoter__ZeroAmount.selector);
        miningSource.notify(voter, 0);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__InsolventNotification.selector, 1, 0));
        miningSource.notify(voter, 1);

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__Unauthorized.selector, OUTSIDER));
        voter.consumeStrategyBudget(address(strategyA), 1);
        vm.prank(address(vault));
        vm.expectRevert(AllocationVoter.AllocationVoter__ZeroAmount.selector);
        voter.consumeStrategyBudget(address(strategyA), 0);
        vm.prank(address(vault));
        vm.expectRevert(
            abi.encodeWithSelector(
                AllocationVoter.AllocationVoter__StrategyBudgetTooLow.selector, address(strategyA), 1, 0
            )
        );
        voter.consumeStrategyBudget(address(strategyA), 1);

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__Unauthorized.selector, OUTSIDER));
        voter.scaleBudgetsAfterRedemption(1, 2);
        vm.prank(address(vault));
        vm.expectRevert(AllocationVoter.AllocationVoter__ZeroAmount.selector);
        voter.scaleBudgetsAfterRedemption(0, 2);
        vm.prank(address(vault));
        vm.expectRevert(AllocationVoter.AllocationVoter__ZeroAmount.selector);
        voter.scaleBudgetsAfterRedemption(3, 2);

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__Unauthorized.selector, OUTSIDER));
        voter.disableStrategy(address(strategyA));
        vm.prank(address(guardian));
        vm.expectRevert(
            abi.encodeWithSelector(AllocationVoter.AllocationVoter__StrategyStillLive.selector, address(strategyA))
        );
        voter.disableStrategy(address(strategyA));

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__Unauthorized.selector, OUTSIDER));
        voter.pauseSignalIncreases();
    }

    function test_StakeAndUnstakeRejectZeroAmounts() public {
        vm.expectRevert(StakedGBX.StakedGBX__ZeroAmount.selector);
        staked.stake(0);
        vm.expectRevert(StakedGBX.StakedGBX__ZeroAmount.selector);
        staked.unstake(0);
    }

    function test_StakeIsOneToOneNontransferableAndRequiresResetBeforeImmediateUnstake() public {
        uint256 timestampBefore = block.timestamp;
        _stake(ALICE, 100 ether);

        assertEq(staked.balanceOf(ALICE), 100 ether);
        assertEq(gbx.balanceOf(address(staked)), 100 ether);

        vm.prank(ALICE);
        vm.expectRevert(StakedGBX.StakedGBX__NonTransferable.selector);
        staked.transfer(BOB, 1 ether);

        vm.prank(ALICE);
        staked.approve(BOB, 1 ether);
        vm.prank(BOB);
        vm.expectRevert(StakedGBX.StakedGBX__NonTransferable.selector);
        staked.transferFrom(ALICE, BOB, 1 ether);
        assertEq(staked.allowance(ALICE, BOB), 1 ether);

        _signal(ALICE, address(strategyA), 100 ether);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(StakedGBX.StakedGBX__SignalsNotReset.selector, 100 ether));
        staked.unstake(100 ether);

        vm.startPrank(ALICE);
        voter.resetSignals();
        staked.unstake(100 ether);
        vm.stopPrank();

        assertEq(block.timestamp, timestampBefore);
        assertEq(staked.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(address(staked)), 0);
        assertEq(gbx.balanceOf(ALICE), 5_000_000 ether);
    }

    function test_SignalsAreImmediateBoundedUniqueLiveAndPauseAllowsReductionsAndReset() public {
        _stake(ALICE, 100 ether);

        address[] memory oneStrategy = new address[](1);
        oneStrategy[0] = address(strategyA);
        uint256[] memory excessive = new uint256[](1);
        excessive[0] = 101 ether;
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(AllocationVoter.AllocationVoter__WeightExceedsStake.selector, 101 ether, 100 ether)
        );
        voter.signal(oneStrategy, excessive);

        address[] memory duplicates = new address[](2);
        duplicates[0] = address(strategyA);
        duplicates[1] = address(strategyA);
        uint256[] memory duplicateWeights = new uint256[](2);
        duplicateWeights[0] = 1 ether;
        duplicateWeights[1] = 1 ether;
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(AllocationVoter.AllocationVoter__DuplicateStrategy.selector, address(strategyA))
        );
        voter.signal(duplicates, duplicateWeights);

        address unregisteredStrategy = address(new LSGAccessStrategyMock());
        oneStrategy[0] = unregisteredStrategy;
        excessive[0] = 1 ether;
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(AllocationVoter.AllocationVoter__UnregisteredStrategy.selector, unregisteredStrategy)
        );
        voter.signal(oneStrategy, excessive);

        address[] memory tooMany = new address[](17);
        uint256[] memory tooManyWeights = new uint256[](17);
        vm.prank(ALICE);
        vm.expectRevert(AllocationVoter.AllocationVoter__InvalidArrayLength.selector);
        voter.signal(tooMany, tooManyWeights);

        _signalTwo(ALICE, 60 ether, 40 ether);
        assertEq(voter.usedWeight(ALICE), 100 ether);
        assertEq(voter.totalActiveWeight(), 100 ether);
        assertEq(voter.strategyWeight(address(strategyA)), 60 ether);
        assertEq(voter.strategyWeight(address(strategyB)), 40 ether);
        assertEq(rewardsA.weightOf(ALICE), 60 ether);
        assertEq(rewardsB.weightOf(ALICE), 40 ether);

        vm.prank(GUARDIAN_OPERATOR);
        guardian.pauseSignalIncreases();

        oneStrategy[0] = address(strategyA);
        excessive[0] = 61 ether;
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(AllocationVoter.AllocationVoter__SignalIncreasePaused.selector, address(strategyA))
        );
        voter.signal(oneStrategy, excessive);

        excessive[0] = 30 ether;
        vm.prank(ALICE);
        voter.signal(oneStrategy, excessive);
        assertEq(voter.usedWeight(ALICE), 30 ether);
        assertEq(voter.totalActiveWeight(), 30 ether);
        assertEq(voter.strategyWeight(address(strategyA)), 30 ether);
        assertEq(voter.strategyWeight(address(strategyB)), 0);
        assertEq(rewardsA.weightOf(ALICE), 30 ether);
        assertEq(rewardsB.weightOf(ALICE), 0);

        vm.prank(ALICE);
        voter.resetSignals();
        assertEq(voter.usedWeight(ALICE), 0);
        assertEq(voter.totalActiveWeight(), 0);
        assertEq(rewardsA.weightOf(ALICE), 0);

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__Unauthorized.selector, OUTSIDER));
        voter.resumeSignalIncreases();
        vm.prank(address(timelock));
        voter.resumeSignalIncreases();
        assertFalse(voter.signalIncreasesPaused());

        _signal(ALICE, address(strategyA), 100 ether);
        assertEq(voter.usedWeight(ALICE), 100 ether);
    }

    function test_IndexedRevenueKeepsZeroWeightIdleAndExcludesNewWeightsFromPastRevenue() public {
        usdG.mint(address(vault), 2_100);
        miningSource.notify(voter, 100);
        assertEq(voter.idleUSDG(), 100);

        _stake(ALICE, 100 ether);
        _signal(ALICE, address(strategyA), 100 ether);
        voter.checkpointStrategyBudget(address(strategyA));
        assertEq(voter.strategyBudget(address(strategyA)), 0);

        miningSource.notify(voter, 1_000);

        _stake(BOB, 100 ether);
        _signal(BOB, address(strategyB), 100 ether);
        liquiditySource.notify(voter, 1_000);

        assertEq(voter.previewStrategyBudget(address(strategyA)), 1_500);
        assertEq(voter.previewStrategyBudget(address(strategyB)), 500);
        assertEq(voter.idleUSDG(), 100);
        assertEq(voter.accountedVaultUSDG(), 2_100);
        assertEq(usdG.balanceOf(address(voter)), 0);
        assertEq(usdG.balanceOf(address(vault)), 2_100);
    }

    function test_BudgetConsumptionAndTerminalDisablementLeavePhysicalBackingIdle() public {
        _stake(ALICE, 100 ether);
        _signal(ALICE, address(strategyA), 100 ether);
        usdG.mint(address(vault), 1_000);
        miningSource.notify(voter, 1_000);

        strategyA.releaseUSDG(vault, CAROL, 300);
        assertEq(usdG.balanceOf(CAROL), 300);
        assertEq(usdG.balanceOf(address(vault)), 700);
        assertEq(voter.previewStrategyBudget(address(strategyA)), 700);
        assertEq(voter.accountedVaultUSDG(), 700);

        vm.prank(GUARDIAN_OPERATOR);
        guardian.disableStrategy(address(strategyA));

        assertFalse(registry.isLiveStrategy(address(strategyA)));
        assertTrue(voter.strategyDisabled(address(strategyA)));
        assertEq(voter.strategyBudget(address(strategyA)), 0);
        assertEq(voter.idleUSDG(), 700);
        assertEq(voter.totalActiveWeight(), 0);
        assertEq(usdG.balanceOf(address(vault)), 700);

        usdG.mint(address(vault), 100);
        liquiditySource.notify(voter, 100);
        assertEq(voter.idleUSDG(), 800);
        assertEq(voter.previewStrategyBudget(address(strategyA)), 0);

        vm.prank(ALICE);
        voter.resetSignals();
        assertEq(voter.usedWeight(ALICE), 0);
        assertEq(voter.strategyWeight(address(strategyA)), 0);
    }

    function test_TerminalDisablementRestoresResetAndUnstakeWhenAdmittedRewardsCodeReverts() public {
        LSGTestToken target = new LSGTestToken("Adversarial rewards target", "ART", 18);
        LSGAcquisitionIdentity strategy = new LSGAcquisitionIdentity(address(target), registry);
        LSGRevertingRewardsIdentityMock rewards =
            new LSGRevertingRewardsIdentityMock(address(strategy), address(target));
        strategy.bindRewards(address(rewards));
        vm.prank(address(timelock));
        registry.registerAsset(address(target), address(strategy), address(rewards));

        _stake(BOB, 100 ether);
        _signal(BOB, address(strategy), 100 ether);
        rewards.setRevertWeightUpdate(true);

        vm.prank(GUARDIAN_OPERATOR);
        guardian.disableStrategy(address(strategy));

        vm.startPrank(BOB);
        voter.resetSignals();
        staked.unstake(100 ether);
        vm.stopPrank();

        assertEq(voter.usedWeight(BOB), 0);
        assertEq(staked.balanceOf(BOB), 0);
        assertEq(gbx.balanceOf(BOB), 1_000_000 ether);
        assertEq(rewards.weightOf(BOB), 100 ether);
    }

    function test_AdmittedRewardsCallbackCannotReenterTheVoterStateMachine() public {
        LSGTestToken target = new LSGTestToken("Reentrant rewards target", "RRT", 18);
        LSGAcquisitionIdentity strategy = new LSGAcquisitionIdentity(address(target), registry);
        LSGReentrantRewardsIdentityMock rewards =
            new LSGReentrantRewardsIdentityMock(address(strategy), address(target), voter);
        strategy.bindRewards(address(rewards));
        vm.prank(address(timelock));
        registry.registerAsset(address(target), address(strategy), address(rewards));

        _stake(BOB, 100 ether);
        rewards.setAttemptReentry(true);
        _signal(BOB, address(strategy), 100 ether);

        assertFalse(rewards.lastReentrySucceeded());
        assertEq(voter.usedWeight(BOB), 100 ether);
        assertEq(voter.userWeight(BOB, address(strategy)), 100 ether);
        assertEq(voter.strategyWeight(address(strategy)), 100 ether);
        assertEq(rewards.weightOf(BOB), 100 ether);
    }

    function test_TerminalDisablementSkipsHonestRewardsCleanupAndPreservesIndexedClaims() public {
        _stake(ALICE, 100 ether);
        _signal(ALICE, address(strategyA), 100 ether);
        assetA.mint(address(rewardsA), 20 ether);
        strategyA.notifyRewards(rewardsA, 20 ether);

        vm.prank(GUARDIAN_OPERATOR);
        guardian.disableStrategy(address(strategyA));

        vm.startPrank(ALICE);
        voter.resetSignals();
        staked.unstake(100 ether);
        vm.stopPrank();

        assertEq(voter.usedWeight(ALICE), 0);
        assertEq(rewardsA.weightOf(ALICE), 100 ether);
        assertEq(rewardsA.totalWeight(), 100 ether);
        assertEq(rewardsA.earned(ALICE), 20 ether);
        assertEq(rewardsA.claim(ALICE), 20 ether);
        assertEq(assetA.balanceOf(ALICE), 20 ether);
    }

    function test_MaximumUserStrategyResetAndImmediateUnstakeIgnoreDisabledGasBurningRewards() public {
        uint256 maliciousCount = 13;
        LSGGasBurningRewardsIdentityMock[] memory maliciousRewards =
            new LSGGasBurningRewardsIdentityMock[](maliciousCount);
        address[] memory strategies = new address[](voter.MAX_USER_STRATEGIES());
        uint256[] memory weights = new uint256[](voter.MAX_USER_STRATEGIES());
        strategies[0] = address(strategyA);
        strategies[1] = address(strategyB);
        weights[0] = 1 ether;
        weights[1] = 1 ether;

        for (uint256 index; index < maliciousCount; ++index) {
            (strategies[index + 2], maliciousRewards[index]) = _registerGasBurningStrategy();
            weights[index + 2] = 1 ether;
        }

        LSGStandaloneIdentity standalone = new LSGStandaloneIdentity(registry);
        vm.prank(address(timelock));
        registry.registerStandaloneStrategy(address(standalone));
        strategies[15] = address(standalone);
        weights[15] = 1 ether;

        _stake(BOB, 16 ether);
        vm.prank(BOB);
        voter.signal(strategies, weights);
        for (uint256 index; index < maliciousCount; ++index) {
            maliciousRewards[index].setBurnWeightUpdateGas(true);
        }

        vm.startPrank(GUARDIAN_OPERATOR);
        for (uint256 index; index < strategies.length; ++index) {
            guardian.disableStrategy(strategies[index]);
        }
        vm.stopPrank();

        assertEq(voter.totalActiveWeight(), 0);
        assertEq(voter.usedWeight(BOB), 16 ether);

        vm.prank(BOB);
        voter.resetSignals{ gas: 1_000_000 }();
        vm.prank(BOB);
        staked.unstake{ gas: 250_000 }(16 ether);

        assertEq(voter.activeStrategies(BOB).length, 0);
        assertEq(voter.usedWeight(BOB), 0);
        assertEq(staked.balanceOf(BOB), 0);
        assertEq(gbx.balanceOf(BOB), 1_000_000 ether);
        assertEq(rewardsA.weightOf(BOB), 1 ether);
        assertEq(rewardsB.weightOf(BOB), 1 ether);
        for (uint256 index; index < maliciousCount; ++index) {
            assertEq(maliciousRewards[index].weightOf(BOB), 1 ether);
        }
    }

    function test_StrategyRewardsUsesHighPrecisionFloorRoundingAndVoterWeightHooks() public {
        _stake(ALICE, 1);
        _stake(BOB, 2);
        _signal(ALICE, address(strategyA), 1);
        _signal(BOB, address(strategyA), 2);

        assertEq(rewardsA.REWARD_PRECISION(), 1e27);
        assertEq(rewardsA.totalWeight(), 3);
        assertEq(rewardsA.weightOf(ALICE), 1);
        assertEq(rewardsA.weightOf(BOB), 2);

        assetA.mint(address(rewardsA), 2);
        strategyA.notifyRewards(rewardsA, 2);

        assertEq(rewardsA.earned(ALICE), 0);
        assertEq(rewardsA.earned(BOB), 1);
        vm.prank(OUTSIDER);
        assertEq(rewardsA.claim(BOB), 1);
        assertEq(assetA.balanceOf(BOB), 1);
        assertEq(assetA.balanceOf(address(rewardsA)), 1);
        assertEq(rewardsA.accountedRewards(), 1);

        vm.prank(BOB);
        voter.resetSignals();
        assertEq(rewardsA.totalWeight(), 1);
        assertEq(rewardsA.weightOf(BOB), 0);
    }

    function _registerGasBurningStrategy()
        private
        returns (address strategyAddress, LSGGasBurningRewardsIdentityMock rewards)
    {
        LSGTestToken target = new LSGTestToken("Gas-burning rewards target", "GBRT", 18);
        LSGAcquisitionIdentity strategy = new LSGAcquisitionIdentity(address(target), registry);
        rewards = new LSGGasBurningRewardsIdentityMock(address(strategy), address(target));
        strategy.bindRewards(address(rewards));
        vm.prank(address(timelock));
        registry.registerAsset(address(target), address(strategy), address(rewards));
        return (address(strategy), rewards);
    }
}

contract MinimalGumBallVaultTest is MinimalLSGFixture {
    function test_ConstructorRedemptionAndReleaseBoundariesRejectInvalidInputs() public {
        vm.expectRevert(GumBallVault.GumBallVault__ZeroAddress.selector);
        new GumBallVault(gbx, address(0), registry, voter);
        vm.expectRevert(GumBallVault.GumBallVault__ZeroAddress.selector);
        new GumBallVault(gbx, OUTSIDER, registry, voter);

        vm.prank(ALICE);
        vm.expectRevert(GumBallVault.GumBallVault__ZeroAmount.selector);
        vault.redeem(0, CAROL);
        vm.prank(ALICE);
        vm.expectRevert(GumBallVault.GumBallVault__ZeroAddress.selector);
        vault.redeem(1, address(0));
        vm.prank(ALICE);
        vm.expectRevert(GumBallVault.GumBallVault__ZeroAddress.selector);
        vault.redeem(1, address(vault));
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                GumBallVault.GumBallVault__InsufficientShares.selector, 5_000_000 ether + 1, 5_000_000 ether
            )
        );
        vault.redeem(5_000_000 ether + 1, CAROL);

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(GumBallVault.GumBallVault__StrategyNotLive.selector, OUTSIDER));
        vault.releaseUSDG(CAROL, 1);
        vm.expectRevert(GumBallVault.GumBallVault__ZeroAddress.selector);
        strategyA.releaseUSDG(vault, address(0), 1);
        vm.expectRevert(GumBallVault.GumBallVault__ZeroAmount.selector);
        strategyA.releaseUSDG(vault, CAROL, 0);
    }

    function test_MaximumSixteenAssetRedemptionCompletesWithinABoundedGasEnvelope() public {
        LSGTestToken[] memory extraAssets = new LSGTestToken[](13);
        for (uint256 index; index < extraAssets.length; ++index) {
            LSGTestToken target = new LSGTestToken("Boundary Asset", "BOUND", 18);
            LSGAcquisitionIdentity strategy = new LSGAcquisitionIdentity(address(target), registry);
            LSGRewardsIdentityMock rewards = new LSGRewardsIdentityMock(address(strategy), address(target));
            strategy.bindRewards(address(rewards));
            vm.prank(address(timelock));
            registry.registerAsset(address(target), address(strategy), address(rewards));
            target.mint(address(vault), 1_000 + index);
            extraAssets[index] = target;
        }
        assertEq(registry.assetCount(), registry.MAX_ASSETS());

        usdG.mint(address(vault), 4_000);
        assetA.mint(address(vault), 8_000);
        assetB.mint(address(vault), 12_000);
        uint256 shares = 5_000_000 ether;
        vm.prank(ALICE);
        gbx.approve(address(vault), shares);

        uint256 gasBefore = gasleft();
        vm.prank(ALICE);
        uint256[] memory amounts = vault.redeem(shares, CAROL);
        uint256 gasUsed = gasBefore - gasleft();

        assertEq(amounts.length, 16);
        assertEq(usdG.balanceOf(CAROL), 1_000);
        assertEq(assetA.balanceOf(CAROL), 2_000);
        assertEq(assetB.balanceOf(CAROL), 3_000);
        for (uint256 index; index < extraAssets.length; ++index) {
            assertEq(extraAssets[index].balanceOf(CAROL), (1_000 + index) / 4);
        }
        assertLt(gasUsed, 4_000_000, "bounded registry loops must remain practically executable");
    }

    function testFuzz_RedemptionMatchesAnIndependentRawBalanceFractionModel(
        uint128 usdGBalance,
        uint128 assetABalance,
        uint128 assetBBalance,
        uint96 shareSeed
    ) public {
        uint256 shares = bound(uint256(shareSeed), 1, gbx.balanceOf(ALICE));
        usdG.mint(address(vault), uint256(usdGBalance));
        assetA.mint(address(vault), uint256(assetABalance));
        assetB.mint(address(vault), uint256(assetBBalance));
        uint256 supplyBefore = gbx.totalSupply();
        uint256 expectedUSDG = uint256(usdGBalance) * shares / supplyBefore;
        uint256 expectedA = uint256(assetABalance) * shares / supplyBefore;
        uint256 expectedB = uint256(assetBBalance) * shares / supplyBefore;

        vm.startPrank(ALICE);
        gbx.approve(address(vault), shares);
        uint256[] memory amounts = vault.redeem(shares, CAROL);
        vm.stopPrank();

        assertEq(amounts[0], expectedUSDG);
        assertEq(amounts[1], expectedA);
        assertEq(amounts[2], expectedB);
        assertEq(usdG.balanceOf(CAROL), expectedUSDG);
        assertEq(assetA.balanceOf(CAROL), expectedA);
        assertEq(assetB.balanceOf(CAROL), expectedB);
        assertEq(gbx.totalSupply(), supplyBefore - shares);
    }

    function test_RedeemUsesPreBurnSupplyEveryRawBalanceAndScalesBudgetsWhileExposureIsPaused() public {
        _stake(BOB, 100 ether);
        _signal(BOB, address(strategyA), 100 ether);
        usdG.mint(address(vault), 1_000);
        assetA.mint(address(vault), 400);
        assetB.mint(address(vault), 800);
        miningSource.notify(voter, 1_000);
        assertEq(voter.previewStrategyBudget(address(strategyA)), 1_000);

        vm.startPrank(GUARDIAN_OPERATOR);
        guardian.pauseMiningContributions();
        guardian.pauseSignalIncreases();
        guardian.pauseStrategyFills(address(strategyA));
        vm.stopPrank();
        assertTrue(miningSource.paused());
        assertTrue(voter.signalIncreasesPaused());
        assertTrue(strategyA.fillsPaused());

        uint256 shares = 5_000_000 ether;
        vm.prank(ALICE);
        gbx.approve(address(vault), shares);
        vm.prank(ALICE);
        uint256[] memory amounts = vault.redeem(shares, CAROL);

        assertEq(amounts.length, 3);
        assertEq(amounts[0], 250);
        assertEq(amounts[1], 100);
        assertEq(amounts[2], 200);
        assertEq(usdG.balanceOf(CAROL), 250);
        assertEq(assetA.balanceOf(CAROL), 100);
        assertEq(assetB.balanceOf(CAROL), 200);
        assertEq(gbx.totalSupply(), 15_000_000 ether);
        assertEq(gbx.cumulativeBurned(), shares);
        assertEq(voter.strategyBudget(address(strategyA)), 750);
        assertEq(voter.accountedVaultUSDG(), 750);
        assertEq(usdG.balanceOf(address(vault)), 750);
    }

    function test_InexactBasketTransferRevertsTheEntireRedemptionAtomically() public {
        LSGFeeToken feeToken = new LSGFeeToken();
        LSGAcquisitionIdentity feeStrategy = new LSGAcquisitionIdentity(address(feeToken), registry);
        StrategyRewards feeRewards = new StrategyRewards(address(feeToken), address(voter), address(this));
        feeStrategy.bindRewards(address(feeRewards));
        feeRewards.initializeStrategy(address(feeStrategy));
        vm.prank(address(timelock));
        registry.registerAsset(address(feeToken), address(feeStrategy), address(feeRewards));

        feeToken.mint(address(vault), 1_000);
        uint256 shares = 5_000_000 ether;
        vm.prank(ALICE);
        gbx.approve(address(vault), shares);

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                GumBallVault.GumBallVault__InexactTransfer.selector, address(feeToken), 250, 250, 225
            )
        );
        vault.redeem(shares, CAROL);

        assertEq(gbx.balanceOf(ALICE), shares);
        assertEq(gbx.totalSupply(), 20_000_000 ether);
        assertEq(gbx.cumulativeBurned(), 0);
        assertEq(feeToken.balanceOf(address(vault)), 1_000);
        assertEq(feeToken.balanceOf(CAROL), 0);
        assertEq(voter.accountedVaultUSDG(), 0);
    }
}

contract MinimalAssetRegistryTest is Test {
    address private constant GUARDIAN = address(0x6900);
    address private constant OUTSIDER = address(0xBAD);

    LSGTestToken private usdG;
    AssetRegistry private registry;

    function setUp() public {
        usdG = new LSGTestToken("Global Dollar", "USDG", 6);
        registry = new AssetRegistry(address(usdG), address(this), GUARDIAN);
    }

    function test_RegistrationValidatesIdentityAndDisablementIsTerminal() public {
        LSGTestToken token = new LSGTestToken("Target", "TGT", 18);
        LSGTestToken wrongToken = new LSGTestToken("Wrong", "WRONG", 18);
        LSGAcquisitionIdentity invalidStrategy = new LSGAcquisitionIdentity(address(wrongToken), registry);
        LSGRewardsIdentityMock invalidRewards = new LSGRewardsIdentityMock(address(invalidStrategy), address(token));
        invalidStrategy.bindRewards(address(invalidRewards));

        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__InvalidStrategyGraph.selector, address(invalidStrategy))
        );
        registry.registerAsset(address(token), address(invalidStrategy), address(invalidRewards));

        (LSGTestToken validToken, LSGAcquisitionIdentity strategy, LSGRewardsIdentityMock rewards) = _newGraph(registry);
        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__Unauthorized.selector, OUTSIDER));
        registry.registerAsset(address(validToken), address(strategy), address(rewards));

        registry.registerAsset(address(validToken), address(strategy), address(rewards));
        assertEq(registry.assetCount(), 2);
        assertEq(registry.strategyCount(), 1);
        assertTrue(registry.isRegisteredAsset(address(validToken)));
        assertTrue(registry.isLiveStrategy(address(strategy)));
        assertEq(strategy.startTime(), block.timestamp);
        IAssetRegistry.AssetConfig memory config = registry.configFor(address(validToken));
        assertEq(config.token, address(validToken));
        assertEq(config.strategy, address(strategy));
        assertEq(config.rewards, address(rewards));
        assertTrue(config.live);

        vm.prank(GUARDIAN);
        registry.disableStrategy(address(strategy));
        assertFalse(registry.isLiveStrategy(address(strategy)));
        assertFalse(registry.configFor(address(validToken)).live);

        vm.prank(GUARDIAN);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__UnknownStrategy.selector, address(strategy))
        );
        registry.disableStrategy(address(strategy));
    }

    function test_ConstructorRegistrationAndQueryInputMatrixFailsClosed() public {
        vm.expectRevert(AssetRegistry.AssetRegistry__ZeroAddress.selector);
        new AssetRegistry(address(0), address(this), GUARDIAN);
        vm.expectRevert(AssetRegistry.AssetRegistry__ZeroAddress.selector);
        new AssetRegistry(OUTSIDER, address(this), GUARDIAN);
        vm.expectRevert(AssetRegistry.AssetRegistry__ZeroAddress.selector);
        new AssetRegistry(address(usdG), address(0), GUARDIAN);
        vm.expectRevert(AssetRegistry.AssetRegistry__ZeroAddress.selector);
        new AssetRegistry(address(usdG), address(this), address(0));

        vm.expectRevert(AssetRegistry.AssetRegistry__ZeroAddress.selector);
        registry.registerAsset(address(0), address(0), address(0));
        LSGTestToken token = new LSGTestToken("Target", "TGT", 18);
        LSGAcquisitionIdentity strategy = new LSGAcquisitionIdentity(address(token), registry);
        LSGRewardsIdentityMock rewards = new LSGRewardsIdentityMock(address(strategy), address(token));
        strategy.bindRewards(address(rewards));
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__InvalidStrategyGraph.selector, OUTSIDER));
        registry.registerAsset(OUTSIDER, OUTSIDER, OUTSIDER);

        registry.registerAsset(address(token), address(strategy), address(rewards));
        LSGAcquisitionIdentity sameTokenStrategy = new LSGAcquisitionIdentity(address(token), registry);
        LSGRewardsIdentityMock sameTokenRewards = new LSGRewardsIdentityMock(address(sameTokenStrategy), address(token));
        sameTokenStrategy.bindRewards(address(sameTokenRewards));
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__AlreadyRegistered.selector, address(token)));
        registry.registerAsset(address(token), address(sameTokenStrategy), address(sameTokenRewards));

        LSGTestToken secondToken = new LSGTestToken("Second", "SECOND", 18);
        LSGRewardsIdentityMock duplicateStrategyRewards =
            new LSGRewardsIdentityMock(address(strategy), address(secondToken));
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__AlreadyRegistered.selector, address(strategy))
        );
        registry.registerAsset(address(secondToken), address(strategy), address(duplicateStrategyRewards));

        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__Unauthorized.selector, OUTSIDER));
        registry.disableStrategy(address(strategy));
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__UnknownStrategy.selector, OUTSIDER));
        registry.disableStrategy(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__UnknownAsset.selector, OUTSIDER));
        registry.configFor(OUTSIDER);
    }

    function test_StandaloneRegistrationRejectsZeroCodeLessWrongRegistryDuplicateAndUnauthorized() public {
        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__Unauthorized.selector, OUTSIDER));
        registry.registerStandaloneStrategy(OUTSIDER);
        vm.expectRevert(AssetRegistry.AssetRegistry__ZeroAddress.selector);
        registry.registerStandaloneStrategy(address(0));
        vm.expectRevert(AssetRegistry.AssetRegistry__ZeroAddress.selector);
        registry.registerStandaloneStrategy(OUTSIDER);

        AssetRegistry other = new AssetRegistry(address(usdG), address(this), GUARDIAN);
        LSGStandaloneIdentity wrongRegistry = new LSGStandaloneIdentity(other);
        vm.expectRevert(
            abi.encodeWithSelector(AssetRegistry.AssetRegistry__InvalidStrategyGraph.selector, address(wrongRegistry))
        );
        registry.registerStandaloneStrategy(address(wrongRegistry));

        LSGStandaloneIdentity valid = new LSGStandaloneIdentity(registry);
        registry.registerStandaloneStrategy(address(valid));
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.AssetRegistry__AlreadyRegistered.selector, address(valid)));
        registry.registerStandaloneStrategy(address(valid));
    }

    function test_AssetAndStrategySetsAreCappedAtSixteen() public {
        for (uint256 index; index < 15; ++index) {
            (LSGTestToken token, LSGAcquisitionIdentity strategy, LSGRewardsIdentityMock rewards) = _newGraph(registry);
            registry.registerAsset(address(token), address(strategy), address(rewards));
        }
        assertEq(registry.assetCount(), 16);
        assertEq(registry.strategyCount(), 15);

        (LSGTestToken extraToken, LSGAcquisitionIdentity extraStrategy, LSGRewardsIdentityMock extraRewards) =
            _newGraph(registry);
        vm.expectRevert(AssetRegistry.AssetRegistry__AssetLimitReached.selector);
        registry.registerAsset(address(extraToken), address(extraStrategy), address(extraRewards));

        LSGStandaloneIdentity standalone = new LSGStandaloneIdentity(registry);
        registry.registerStandaloneStrategy(address(standalone));
        assertEq(registry.strategyCount(), 16);
        assertEq(standalone.startTime(), block.timestamp);

        LSGStandaloneIdentity extraStandalone = new LSGStandaloneIdentity(registry);
        vm.expectRevert(AssetRegistry.AssetRegistry__StrategyLimitReached.selector);
        registry.registerStandaloneStrategy(address(extraStandalone));
    }

    function _newGraph(AssetRegistry targetRegistry)
        private
        returns (LSGTestToken token, LSGAcquisitionIdentity strategy, LSGRewardsIdentityMock rewards)
    {
        token = new LSGTestToken("Target", "TGT", 18);
        strategy = new LSGAcquisitionIdentity(address(token), targetRegistry);
        rewards = new LSGRewardsIdentityMock(address(strategy), address(token));
        strategy.bindRewards(address(rewards));
    }
}
