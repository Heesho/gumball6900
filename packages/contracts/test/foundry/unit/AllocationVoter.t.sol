// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { EmergencyGuardian } from "../../../src/access/EmergencyGuardian.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { IAllocationVoter } from "../../../src/interfaces/IAllocationVoter.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { IManagerRewards } from "../../../src/interfaces/IManagerRewards.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { SignalTestRevenueSource, SignalTestStrategy, SignalTestVaultCaller } from "../mocks/SignalTestMocks.sol";
import { VaultTestGBXMinter, VaultTestToken } from "../mocks/VaultTestMocks.sol";
import { ConfigurableEligibilityModuleMock } from "../mocks/ConfigurableEligibilityModuleMock.sol";
import { NoopManagerRewardsTestMock, StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

contract AllocationVoterTest is Test {
    event AllocationVoter__StrategyBudgetScaled(
        address indexed strategy, uint256 budgetAfter, uint256 scaledRemainderAfter
    );

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant GUARDIAN = address(0x6900);

    VaultTestToken private usdG;
    VaultTestToken private assetA;
    VaultTestToken private assetB;
    GBXToken private gbx;
    VaultTestGBXMinter private minter;
    EmergencyGuardian private guardian;
    AssetRegistry private registry;
    AllocationVoter private voter;
    StakedGBX private staked;
    SignalTestVaultCaller private vaultCaller;
    SignalTestStrategy private strategyA;
    SignalTestStrategy private strategyB;
    SignalTestStrategy private holdStrategy;
    NoopManagerRewardsTestMock private noopRewards;
    StrategyDeployerTestMock private strategyDeployer;
    SignalTestRevenueSource[4] private sources;

    function setUp() public {
        vm.etch(GUARDIAN, hex"00");
        usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        assetA = new VaultTestToken("Wrapped Ether", "WETH", 18);
        assetB = new VaultTestToken("Wrapped Bitcoin", "WBTC", 18);
        gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        minter = new VaultTestGBXMinter(gbx);
        gbx.initializeEmissionController(address(minter));

        guardian = new EmergencyGuardian(address(this), GUARDIAN);
        strategyDeployer = new StrategyDeployerTestMock(address(this), address(guardian), address(gbx));
        registry = new AssetRegistry(address(usdG), address(this), address(guardian), address(strategyDeployer));
        voter = new AllocationVoter(address(usdG), address(registry), address(this), address(guardian), address(this));
        guardian.initializeTargets(address(registry), address(voter));
        staked = new StakedGBX(address(gbx), address(voter));
        vaultCaller = new SignalTestVaultCaller();
        vaultCaller.setUSDG(address(usdG));
        strategyA = new SignalTestStrategy();
        strategyB = new SignalTestStrategy();
        holdStrategy = new SignalTestStrategy();
        noopRewards = new NoopManagerRewardsTestMock();

        address[4] memory sourceAddresses;
        for (uint256 index; index < 4; ++index) {
            sources[index] = new SignalTestRevenueSource();
            sourceAddresses[index] = address(sources[index]);
        }
        voter.initializeDependencies(address(vaultCaller), address(staked), sourceAddresses);
        strategyDeployer.configureGraph(address(registry), address(voter), address(vaultCaller), address(this));

        registry.configureVault(address(vaultCaller));
        registry.registerAsset(_config(address(usdG), 6, address(holdStrategy), true));
        registry.registerAsset(_config(address(assetA), 18, address(strategyA), true));
        registry.registerAsset(_config(address(assetB), 18, address(strategyB), true));

        minter.mint(ALICE, 100 ether);
        minter.mint(BOB, 100 ether);
        vm.prank(ALICE);
        gbx.approve(address(staked), type(uint256).max);
        vm.prank(BOB);
        gbx.approve(address(staked), type(uint256).max);
    }

    function test_StakeIsOneToOneAndNonTransferable() public {
        _stake(ALICE, 100 ether);
        assertEq(staked.balanceOf(ALICE), 100 ether);
        assertEq(gbx.balanceOf(address(staked)), 100 ether);

        vm.prank(ALICE);
        vm.expectRevert(StakedGBX.StakedGBX__NonTransferable.selector);
        staked.transfer(BOB, 1 ether);
    }

    function test_StakedGBXRejectsCompleteTransferSurfaceAndPreservesState() public {
        _stake(ALICE, 100 ether);
        uint256[2] memory amounts;
        amounts[1] = 1 ether;

        for (uint256 index; index < amounts.length; ++index) {
            uint256 amount = amounts[index];

            vm.prank(ALICE);
            vm.expectRevert(StakedGBX.StakedGBX__NonTransferable.selector);
            staked.approve(BOB, amount);
            _assertStakedTransferState();

            vm.prank(ALICE);
            vm.expectRevert(StakedGBX.StakedGBX__NonTransferable.selector);
            staked.transfer(BOB, amount);
            _assertStakedTransferState();

            vm.prank(BOB);
            vm.expectRevert(StakedGBX.StakedGBX__NonTransferable.selector);
            staked.transferFrom(ALICE, BOB, amount);
            _assertStakedTransferState();
        }
    }

    function test_SignalIncreaseHasNoSameBlockEffectAndActivatesAfterOneDay() public {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(strategyA));

        assertEq(voter.activeWeight(ALICE, address(strategyA)), 0);
        assertEq(voter.pendingWeightTotal(ALICE), 100 ether);
        assertEq(voter.totalLiveWeight(), 0);

        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);

        assertEq(voter.activeWeight(ALICE, address(strategyA)), 100 ether);
        assertEq(voter.pendingWeightTotal(ALICE), 0);
        assertEq(voter.strategyWeight(address(strategyA)), 100 ether);
        assertEq(voter.totalLiveWeight(), 100 ether);
    }

    function test_UnstakeImmediatelyScalesPendingWeightWithoutReset() public {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(strategyA));

        vm.prank(ALICE);
        staked.unstake(40 ether);

        assertEq(staked.balanceOf(ALICE), 60 ether);
        assertLe(voter.pendingWeightTotal(ALICE), 60 ether);
        assertEq(voter.activeWeightTotal(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 40 ether);
    }

    function test_UnstakeImmediatelyScalesActiveWeightAndAggregateTotals() public {
        _stakeAndActivate(ALICE, address(strategyA), 100 ether);

        vm.prank(ALICE);
        staked.unstake(40 ether);

        assertEq(staked.balanceOf(ALICE), 60 ether);
        assertEq(voter.activeWeight(ALICE, address(strategyA)), 60 ether);
        assertEq(voter.strategyWeight(address(strategyA)), 60 ether);
        assertEq(voter.totalLiveWeight(), 60 ether);
    }

    function test_ReductionIsImmediateWhileNewStrategyIncreaseIsPending() public {
        _stakeAndActivate(ALICE, address(strategyA), 100 ether);

        _signalOne(ALICE, address(strategyB));

        assertEq(voter.activeWeight(ALICE, address(strategyA)), 0);
        assertEq(voter.activeWeight(ALICE, address(strategyB)), 0);
        assertEq(voter.pendingWeightTotal(ALICE), 100 ether);
        assertEq(voter.totalLiveWeight(), 0);
    }

    function test_UserCanCancelPendingSignalBeforeActivation() public {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(strategyA));

        vm.prank(ALICE);
        voter.cancelPendingSignals();
        assertEq(voter.pendingWeightTotal(ALICE), 0);
        assertEq(voter.pendingActivationTime(ALICE), 0);
        assertEq(voter.pendingStrategies(ALICE).length, 0);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__NoPendingSignals.selector, ALICE));
        voter.cancelPendingSignals();
    }

    function test_SameTransactionStakeSignalAndUnstakeCannotCreateFlashWeight() public {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(strategyA));
        assertEq(voter.activeWeightTotal(ALICE), 0);
        assertEq(voter.totalLiveWeight(), 0);

        vm.prank(ALICE);
        staked.unstake(100 ether);

        assertEq(staked.balanceOf(ALICE), 0);
        assertEq(voter.pendingWeightTotal(ALICE), 0);
        assertEq(voter.activeWeightTotal(ALICE), 0);
        assertEq(voter.totalLiveWeight(), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
    }

    function test_RepeatedStakeSignalActivationAndUnstakeConservesEveryBalance() public {
        for (uint256 cycle; cycle < 5; ++cycle) {
            _stakeAndActivate(ALICE, address(strategyA), 100 ether);
            vm.prank(ALICE);
            staked.unstake(100 ether);

            assertEq(staked.balanceOf(ALICE), 0);
            assertEq(voter.activeWeightTotal(ALICE), 0);
            assertEq(voter.pendingWeightTotal(ALICE), 0);
            assertEq(voter.strategyWeight(address(strategyA)), 0);
            assertEq(voter.totalLiveWeight(), 0);
            assertEq(gbx.balanceOf(ALICE), 100 ether);
        }
    }

    function test_RevenueCreatesLazyVirtualBudgetWithoutVoterCustody() public {
        _stakeAndActivate(ALICE, address(strategyA), 100 ether);
        usdG.mint(address(vaultCaller), 1_000_000_000);

        sources[uint256(
                AllocationVoter.RevenueSource.MiningPool
            )].notify(voter, 1_000_000_000, AllocationVoter.RevenueSource.MiningPool);

        assertEq(voter.strategyBudget(address(strategyA)), 0);
        assertEq(voter.previewStrategyBudget(address(strategyA)), 1_000_000_000);
        voter.checkpointStrategyBudget(address(strategyA));

        assertEq(voter.strategyBudget(address(strategyA)), 1_000_000_000);
        assertEq(voter.previewStrategyBudget(address(strategyA)), 1_000_000_000);
        assertEq(voter.accountedVaultUSDG(), 1_000_000_000);
        assertEq(usdG.balanceOf(address(voter)), 0);
        assertEq(usdG.balanceOf(address(vaultCaller)), 1_000_000_000);
    }

    function test_ZeroWeightRevenueRemainsIdleAndIsNotAllocatedRetroactively() public {
        usdG.mint(address(vaultCaller), 1_000_000_000);
        sources[uint256(
                AllocationVoter.RevenueSource.GenesisBootstrap
            )].notify(voter, 1_000_000_000, AllocationVoter.RevenueSource.GenesisBootstrap);
        assertEq(voter.idleUSDG(), 1_000_000_000);

        _stakeAndActivate(ALICE, address(strategyA), 100 ether);
        voter.checkpointStrategyBudget(address(strategyA));
        assertEq(voter.strategyBudget(address(strategyA)), 0);
    }

    function test_RevenueIndexCarriesFractionsWithoutDoubleCountingOrDustLoss() public {
        _stake(ALICE, 3);
        address[] memory strategies = new address[](2);
        strategies[0] = address(strategyA);
        strategies[1] = address(strategyB);
        uint256[] memory weights = new uint256[](2);
        weights[0] = 1;
        weights[1] = 2;
        vm.prank(ALICE);
        voter.signal(strategies, weights);
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);

        usdG.mint(address(vaultCaller), 3);
        for (uint256 index; index < 3; ++index) {
            sources[uint256(
                    AllocationVoter.RevenueSource.MiningPool
                )].notify(voter, 1, AllocationVoter.RevenueSource.MiningPool);
            voter.checkpointStrategyBudget(address(strategyA));
            voter.checkpointStrategyBudget(address(strategyB));
        }

        assertEq(voter.strategyBudget(address(strategyA)), 1);
        assertEq(voter.strategyBudget(address(strategyB)), 2);
        assertEq(voter.strategyScaledRemainder(address(strategyA)), 0);
        assertEq(voter.strategyScaledRemainder(address(strategyB)), 0);
        assertEq(voter.allocationRemainder(), 0);
        assertEq(voter.accountedVaultUSDG(), 3);
    }

    function test_WeightChangeMovesPriorFractionToIdleBeforeFutureRevenueAllocation() public {
        _stake(ALICE, 3);
        address[] memory strategies = new address[](2);
        strategies[0] = address(strategyA);
        strategies[1] = address(strategyB);
        uint256[] memory weights = new uint256[](2);
        weights[0] = 1;
        weights[1] = 2;
        vm.prank(ALICE);
        voter.signal(strategies, weights);
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);

        usdG.mint(address(vaultCaller), 2);
        sources[uint256(
                AllocationVoter.RevenueSource.MiningPool
            )].notify(voter, 1, AllocationVoter.RevenueSource.MiningPool);
        assertEq(voter.allocationRemainder(), 1);

        address[] memory nextStrategies = new address[](1);
        nextStrategies[0] = address(strategyA);
        uint256[] memory nextWeights = new uint256[](1);
        nextWeights[0] = 1;
        vm.prank(ALICE);
        voter.signal(nextStrategies, nextWeights);

        assertEq(voter.totalLiveWeight(), 1);
        assertEq(voter.allocationRemainder(), 0);
        assertEq(voter.idleScaledRemainder(), 1);

        sources[uint256(
                AllocationVoter.RevenueSource.MiningPool
            )].notify(voter, 1, AllocationVoter.RevenueSource.MiningPool);
        assertEq(voter.allocationRemainder(), 0);
        assertEq(voter.idleScaledRemainder(), 1);
    }

    function test_GuardianCanPauseOnlyActivationsWhileResetAndUnstakeRemainLive() public {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(strategyA));

        vm.prank(GUARDIAN);
        guardian.pauseSignalActivations();
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);

        assertEq(voter.activeWeight(ALICE, address(strategyA)), 0);
        assertEq(voter.pendingWeightTotal(ALICE), 100 ether);

        vm.prank(ALICE);
        voter.resetSignals();
        assertEq(voter.pendingWeightTotal(ALICE), 0);

        vm.prank(ALICE);
        staked.unstake(100 ether);
        assertEq(staked.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
    }

    function test_OnlyTimelockCanReopenSignalActivations() public {
        vm.prank(GUARDIAN);
        guardian.pauseSignalActivations();

        vm.prank(GUARDIAN);
        vm.expectRevert(abi.encodeWithSelector(AllocationVoter.AllocationVoter__NotProtocolTimelock.selector, GUARDIAN));
        voter.unpauseSignalActivations();

        voter.unpauseSignalActivations();
        assertFalse(voter.signalActivationsPaused());
    }

    function test_VaultConsumesBudgetAndRedemptionScalesAccounting() public {
        _stakeAndActivate(ALICE, address(strategyA), 100 ether);
        usdG.mint(address(vaultCaller), 1_000_000_000);
        sources[uint256(
                AllocationVoter.RevenueSource.RevenueRouter
            )].notify(voter, 1_000_000_000, AllocationVoter.RevenueSource.RevenueRouter);
        voter.checkpointStrategyBudget(address(strategyA));

        vaultCaller.consume(voter, address(strategyA), 200_000_000);
        assertEq(voter.strategyBudget(address(strategyA)), 800_000_000);
        assertEq(voter.accountedVaultUSDG(), 800_000_000);

        vm.expectEmit(true, false, false, true, address(voter));
        emit AllocationVoter__StrategyBudgetScaled(address(strategyA), 600_000_000, 0);
        vaultCaller.scale(voter, 25 ether, 100 ether);
        assertEq(voter.strategyBudget(address(strategyA)), 600_000_000);
        assertEq(voter.accountedVaultUSDG(), 600_000_000);
    }

    function test_ActivatesMaximumSixteenStrategySignal() public {
        address[] memory strategies = _registerStrategies(16);
        minter.mint(ALICE, 60 ether);
        _stake(ALICE, 160 ether);

        uint256[] memory relativeWeights = new uint256[](strategies.length);
        for (uint256 index; index < relativeWeights.length; ++index) {
            relativeWeights[index] = 1;
        }
        vm.prank(ALICE);
        voter.signal(strategies, relativeWeights);

        assertEq(voter.pendingStrategies(ALICE).length, 16);
        assertEq(voter.pendingWeightTotal(ALICE), 160 ether);
        assertEq(voter.activeStrategies(ALICE).length, 0);
        assertEq(voter.totalLiveWeight(), 0);
        for (uint256 index; index < strategies.length; ++index) {
            assertEq(voter.pendingWeight(ALICE, strategies[index]), 10 ether);
        }

        vm.warp(voter.pendingActivationTime(ALICE));
        voter.checkpointUser(ALICE);

        assertEq(voter.pendingStrategies(ALICE).length, 0);
        assertEq(voter.activeStrategies(ALICE).length, 16);
        assertEq(voter.activeWeightTotal(ALICE), 160 ether);
        assertEq(voter.totalLiveWeight(), 160 ether);
        for (uint256 index; index < strategies.length; ++index) {
            assertEq(voter.activeWeight(ALICE, strategies[index]), 10 ether);
            assertEq(voter.strategyWeight(strategies[index]), 10 ether);
        }
    }

    function test_ScalesEveryBudgetAtMaximumSeventeenStrategies() public {
        address[] memory strategies = _registerStrategies(17);
        for (uint256 index; index < strategies.length; ++index) {
            address user = address(uint160(0x1000 + index));
            minter.mint(user, 1 ether);
            vm.prank(user);
            gbx.approve(address(staked), 1 ether);
            _stake(user, 1 ether);
            _signalOne(user, strategies[index]);
        }

        vm.warp(block.timestamp + 1 days);
        for (uint256 index; index < strategies.length; ++index) {
            voter.checkpointUser(address(uint160(0x1000 + index)));
        }
        assertEq(voter.totalLiveWeight(), 17 ether);

        usdG.mint(address(vaultCaller), 17_000_000);
        sources[uint256(
                AllocationVoter.RevenueSource.RevenueRouter
            )].notify(voter, 17_000_000, AllocationVoter.RevenueSource.RevenueRouter);
        for (uint256 index; index < strategies.length; ++index) {
            assertEq(voter.previewStrategyBudget(strategies[index]), 1_000_000);
        }

        vaultCaller.scale(voter, 25, 100);

        assertEq(voter.accountedVaultUSDG(), 12_750_000);
        for (uint256 index; index < strategies.length; ++index) {
            assertEq(voter.strategyBudget(strategies[index]), 750_000);
            assertEq(voter.strategyScaledRemainder(strategies[index]), 0);
        }
    }

    function test_GuardianAtomicallyDisablesAcquisitionAndRemovesDeadWeight() public {
        _stakeAndActivate(ALICE, address(strategyA), 100 ether);
        usdG.mint(address(vaultCaller), 1_000_000_000);
        sources[uint256(
                AllocationVoter.RevenueSource.LiquidityManager
            )].notify(voter, 1_000_000_000, AllocationVoter.RevenueSource.LiquidityManager);

        vm.prank(GUARDIAN);
        guardian.disableAssetAcquisition(address(assetA));

        assertFalse(registry.configFor(address(assetA)).acquisitionEnabled);
        assertEq(voter.strategyWeight(address(strategyA)), 0);
        assertEq(voter.totalLiveWeight(), 0);
        assertEq(voter.strategyBudget(address(strategyA)), 0);
        assertEq(voter.idleUSDG(), 1_000_000_000);
        assertEq(voter.activeWeight(ALICE, address(strategyA)), 0);
    }

    function test_GuardianDisableInvalidatesPendingWeightAndLeavesImmediateUnstake() public {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(strategyA));
        assertEq(voter.pendingWeightTotal(ALICE), 100 ether);

        vm.prank(GUARDIAN);
        guardian.disableAssetAcquisition(address(assetA));

        assertEq(voter.pendingWeightTotal(ALICE), 0);
        assertEq(voter.pendingWeight(ALICE, address(strategyA)), 0);
        vm.prank(ALICE);
        staked.unstake(100 ether);
        assertEq(staked.balanceOf(ALICE), 0);
        assertEq(voter.pendingStrategies(ALICE).length, 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
    }

    function test_RewardsCheckpointCannotStakeAfterSignalSnapshotsBalance() public {
        VaultTestToken rewardAsset = new VaultTestToken("Reward Asset", "RWD", 18);
        SignalTestStrategy rewardStrategy = new SignalTestStrategy();
        ReentrantRewardsCheckpointMock callbackRewards = new ReentrantRewardsCheckpointMock(gbx, staked);
        registry.registerAsset(
            _configWithRewards(address(rewardAsset), address(rewardStrategy), address(callbackRewards))
        );

        minter.mint(address(callbackRewards), 1 ether);
        _stakeAndActivate(ALICE, address(rewardStrategy), 100 ether);
        callbackRewards.armStake(ALICE, 1 ether);

        _signalOne(ALICE, address(rewardStrategy));

        assertTrue(callbackRewards.stakeAttempted());
        assertTrue(callbackRewards.stakeBlocked());
        assertEq(staked.balanceOf(ALICE), 100 ether);
        assertEq(gbx.balanceOf(address(callbackRewards)), 1 ether);
        assertEq(voter.activeWeight(ALICE, address(rewardStrategy)), 100 ether);
        assertEq(voter.pendingWeightTotal(ALICE), 0);
        assertEq(voter.totalLiveWeight(), 100 ether);
    }

    function test_DisableRollsBackRegistryAndVoterWhenRewardsGenerationAdvanceReverts() public {
        VaultTestToken rewardAsset = new VaultTestToken("Reward Asset", "RWD", 18);
        SignalTestStrategy rewardStrategy = new SignalTestStrategy();
        ReentrantRewardsCheckpointMock callbackRewards = new ReentrantRewardsCheckpointMock(gbx, staked);
        registry.registerAsset(
            _configWithRewards(address(rewardAsset), address(rewardStrategy), address(callbackRewards))
        );
        _stakeAndActivate(ALICE, address(rewardStrategy), 100 ether);
        callbackRewards.setRevertAdvance(true);

        vm.prank(GUARDIAN);
        vm.expectRevert(ReentrantRewardsCheckpointMock.ReentrantRewardsCheckpointMock__AdvanceBlocked.selector);
        guardian.disableAssetAcquisition(address(rewardAsset));

        assertTrue(registry.configFor(address(rewardAsset)).acquisitionEnabled);
        assertTrue(registry.isLiveStrategy(address(rewardStrategy)));
        assertFalse(voter.strategyDisabled(address(rewardStrategy)));
        assertEq(voter.strategyGeneration(address(rewardStrategy)), 0);
        assertEq(voter.activeWeight(ALICE, address(rewardStrategy)), 100 ether);
        assertEq(voter.strategyWeight(address(rewardStrategy)), 100 ether);
        assertEq(voter.totalLiveWeight(), 100 ether);
    }

    function test_RejectsDuplicateStrategies() public {
        _stake(ALICE, 100 ether);
        address[] memory strategies = new address[](2);
        strategies[0] = address(strategyA);
        strategies[1] = address(strategyA);
        uint256[] memory weights = new uint256[](2);
        weights[0] = 1;
        weights[1] = 1;

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(AllocationVoter.AllocationVoter__DuplicateStrategy.selector, address(strategyA))
        );
        voter.signal(strategies, weights);
    }

    function _registerStrategies(uint256 count) private returns (address[] memory strategies) {
        strategies = new address[](count);
        strategies[0] = address(strategyA);
        strategies[1] = address(strategyB);
        strategies[2] = address(holdStrategy);
        uint256 assetLinkedCount = count > 16 ? 16 : count;
        for (uint256 index = 3; index < assetLinkedCount; ++index) {
            SignalTestStrategy strategy = new SignalTestStrategy();
            VaultTestToken token = new VaultTestToken("Test Target", "TGT", 18);
            strategies[index] = address(strategy);
            registry.registerAsset(_config(address(token), 18, address(strategy), true));
        }
        if (count == 17) {
            SignalTestStrategy buyback = new SignalTestStrategy();
            strategies[16] = address(buyback);
            buyback.configureBuybackIdentity(usdG.decimals(), gbx.decimals());
            strategyDeployer.attestBuyback(address(buyback));
            registry.registerStandaloneStrategy(address(buyback));
        }
    }

    function _stake(address user, uint256 amount) private {
        vm.prank(user);
        staked.stake(amount);
    }

    function _stakeAndActivate(address user, address strategy, uint256 amount) private {
        _stake(user, amount);
        _signalOne(user, strategy);
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(user);
    }

    function _signalOne(address user, address strategy) private {
        address[] memory strategies = new address[](1);
        strategies[0] = strategy;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        vm.prank(user);
        voter.signal(strategies, weights);
    }

    function _assertStakedTransferState() private view {
        assertEq(staked.balanceOf(ALICE), 100 ether);
        assertEq(staked.balanceOf(BOB), 0);
        assertEq(staked.totalSupply(), 100 ether);
        assertEq(staked.allowance(ALICE, BOB), 0);
        assertEq(gbx.balanceOf(address(staked)), 100 ether);
    }

    function _config(address token, uint8 decimals, address strategy, bool acquisitionEnabled)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        string memory symbol = VaultTestToken(token).symbol();
        address rewards = strategy == address(0) || token == address(usdG) ? address(0) : address(noopRewards);
        if (strategy != address(0)) {
            if (token == address(usdG)) {
                strategyDeployer.attestHoldUSDG(strategy);
            } else {
                SignalTestStrategy(strategy).configureRegistrationIdentity(token, rewards, usdG.decimals(), decimals);
                noopRewards.configureRegistrationIdentity(token, strategy);
                strategyDeployer.attestAcquisition(strategy, token, rewards);
            }
        }
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(abi.encodePacked(token)),
            symbolHash: keccak256(bytes(symbol)),
            decimals: decimals,
            strategy: strategy,
            rewards: rewards,
            isStockToken: false,
            acquisitionEnabled: acquisitionEnabled,
            redemptionEnabled: true
        });
    }

    function _configWithRewards(address token, address strategy, address rewards)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        SignalTestStrategy(strategy).configureRegistrationIdentity(token, rewards, usdG.decimals(), 18);
        ReentrantRewardsCheckpointMock(rewards).configureRegistrationIdentity(token, strategy);
        strategyDeployer.attestAcquisition(strategy, token, rewards);
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(abi.encodePacked(token)),
            symbolHash: keccak256(bytes(VaultTestToken(token).symbol())),
            decimals: 18,
            strategy: strategy,
            rewards: rewards,
            isStockToken: false,
            acquisitionEnabled: true,
            redemptionEnabled: true
        });
    }
}

contract ReentrantRewardsCheckpointMock is IManagerRewards {
    error ReentrantRewardsCheckpointMock__AdvanceBlocked();

    StakedGBX private immutable _staked;

    address private _stakeBeneficiary;
    uint256 private _stakeAmount;
    bool private _stakeArmed;
    bool public stakeAttempted;
    bool public stakeBlocked;
    bool public revertAdvance;
    address public REWARD_TOKEN;
    address public STRATEGY;

    constructor(GBXToken gbx_, StakedGBX staked_) {
        _staked = staked_;
        gbx_.approve(address(staked_), type(uint256).max);
    }

    function configureRegistrationIdentity(address rewardToken, address strategy) external {
        REWARD_TOKEN = rewardToken;
        STRATEGY = strategy;
    }

    function armStake(address beneficiary, uint256 amount) external {
        _stakeBeneficiary = beneficiary;
        _stakeAmount = amount;
        _stakeArmed = true;
        stakeAttempted = false;
        stakeBlocked = false;
    }

    function setRevertAdvance(bool shouldRevert) external {
        revertAdvance = shouldRevert;
    }

    function notifyReward(uint256) external pure { }

    function checkpointUser(address, uint256, uint64) external {
        if (!_stakeArmed) return;
        _stakeArmed = false;
        stakeAttempted = true;
        try _staked.stakeFor(_stakeBeneficiary, _stakeAmount) { }
        catch {
            stakeBlocked = true;
        }
    }

    function settleTerminalDust() external pure { }

    function sweepTerminalDust(uint64, uint64) external pure returns (uint256 amount) {
        return 0;
    }

    function advanceGeneration(uint64) external view {
        if (revertAdvance) revert ReentrantRewardsCheckpointMock__AdvanceBlocked();
    }
}

contract StakedEligibilityVoterMock is IAllocationVoter {
    address public lastStaker;

    function onStake(address user) external {
        lastStaker = user;
    }

    function onUnstake(address, uint256) external pure { }

    function consumeStrategyBudget(address, uint256) external pure { }

    function scaleBudgetsAfterRedemption(uint256, uint256) external pure { }
}

contract StakedGBXEligibilityTest is Test {
    address private constant ALICE = address(0xA11CE);

    ConfigurableEligibilityModuleMock private eligibility;
    GBXToken private gbx;
    VaultTestGBXMinter private minter;
    StakedEligibilityVoterMock private voter;
    StakedGBX private staked;

    function setUp() public {
        eligibility = new ConfigurableEligibilityModuleMock();
        gbx = new GBXToken(address(this), eligibility);
        minter = new VaultTestGBXMinter(gbx);
        gbx.initializeEmissionController(address(minter));
        voter = new StakedEligibilityVoterMock();
        staked = new StakedGBX(address(gbx), address(voter));
        minter.mint(ALICE, 10 ether);
        vm.prank(ALICE);
        gbx.approve(address(staked), type(uint256).max);
    }

    function test_PermissionedStakeChecksUserBeforeMovingGBX() external {
        eligibility.setHoldAllowed(false);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(StakedGBX.StakedGBX__IneligibleStaker.selector, ALICE));
        staked.stake(1 ether);

        assertEq(gbx.balanceOf(ALICE), 10 ether);
        assertEq(gbx.balanceOf(address(staked)), 0);
        assertEq(staked.balanceOf(ALICE), 0);
        assertEq(voter.lastStaker(), address(0));
    }

    function test_PermissionedStakeFailsClosedWhenEligibilityCheckReverts() external {
        eligibility.setChecksRevert(true);

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(StakedGBX.StakedGBX__EligibilityCheckFailed.selector, address(eligibility))
        );
        staked.stake(1 ether);
    }

    function test_EligibleStakeStillMintsOneToOne() external {
        vm.prank(ALICE);
        uint256 received = staked.stake(4 ether);

        assertEq(received, 4 ether);
        assertEq(staked.balanceOf(ALICE), 4 ether);
        assertEq(gbx.balanceOf(address(staked)), 4 ether);
        assertEq(voter.lastStaker(), ALICE);
    }
}
