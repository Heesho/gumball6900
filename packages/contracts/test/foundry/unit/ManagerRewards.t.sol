// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { ManagerRewards } from "../../../src/rewards/ManagerRewards.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { ConfigurableEligibilityModuleMock } from "../mocks/ConfigurableEligibilityModuleMock.sol";
import { RewardTestStrategy, SignalTestRevenueSource, SignalTestVaultCaller } from "../mocks/SignalTestMocks.sol";
import { AdversarialToken } from "../mocks/AdversarialTokenMocks.sol";
import { VaultTestGBXMinter, VaultTestToken } from "../mocks/VaultTestMocks.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

contract ManagerRewardsTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant GUARDIAN = address(0x6900);

    VaultTestToken private usdG;
    VaultTestToken private rewardToken;
    GBXToken private gbx;
    VaultTestGBXMinter private minter;
    AssetRegistry private registry;
    AllocationVoter private voter;
    StakedGBX private staked;
    SignalTestVaultCaller private vaultCaller;
    RewardTestStrategy private strategy;
    ManagerRewards private rewards;
    ConfigurableEligibilityModuleMock private eligibility;
    StrategyDeployerTestMock private strategyDeployer;

    function setUp() public {
        usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        rewardToken = new VaultTestToken("Wrapped Ether", "WETH", 18);
        gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        minter = new VaultTestGBXMinter(gbx);
        gbx.initializeEmissionController(address(minter));
        strategyDeployer = new StrategyDeployerTestMock(address(this), GUARDIAN, address(gbx));
        registry = new AssetRegistry(address(usdG), address(this), GUARDIAN, address(strategyDeployer));
        voter = new AllocationVoter(address(usdG), address(registry), address(this), GUARDIAN, address(this));
        staked = new StakedGBX(address(gbx), address(voter));
        vaultCaller = new SignalTestVaultCaller();
        vaultCaller.setUSDG(address(usdG));
        strategy = new RewardTestStrategy();
        eligibility = new ConfigurableEligibilityModuleMock();
        rewards = new ManagerRewards(
            address(rewardToken), address(strategy), address(voter), address(vaultCaller), address(eligibility)
        );

        address[4] memory sourceAddresses;
        for (uint256 index; index < 4; ++index) {
            sourceAddresses[index] = address(new SignalTestRevenueSource());
        }
        voter.initializeDependencies(address(vaultCaller), address(staked), sourceAddresses);
        strategyDeployer.configureGraph(address(registry), address(voter), address(vaultCaller), address(eligibility));
        registry.configureVault(address(vaultCaller));
        registry.registerAsset(
            _config(address(usdG), 6, strategyDeployer.canonicalHoldUSDGStrategy(), address(0), false)
        );
        registry.registerAsset(_config(address(rewardToken), 18, address(strategy), address(rewards), true));

        minter.mint(ALICE, 60 ether);
        minter.mint(BOB, 40 ether);
        _stakeAndSignal(ALICE, 60 ether);
        _stakeAndSignal(BOB, 40 ether);
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);
        voter.checkpointUser(BOB);
    }

    function test_DistributesExactRewardByActiveWeight() public {
        _notify(100 ether);

        rewards.claim(ALICE);
        rewards.claim(BOB);

        assertEq(rewardToken.balanceOf(ALICE), 60 ether);
        assertEq(rewardToken.balanceOf(BOB), 40 ether);
        assertEq(rewards.accountedRewards(), 0);
    }

    function test_OneWeiRewardCarriesPerUserFractionUntilItBecomesClaimable() public {
        _notify(1);
        rewards.claim(ALICE);
        rewards.claim(BOB);

        assertEq(rewardToken.balanceOf(ALICE) + rewardToken.balanceOf(BOB), 0);
        assertEq(rewards.accountedRewards(), 1);
        assertGt(rewards.userScaledRemainder(ALICE), 0);
        assertGt(rewards.userScaledRemainder(BOB), 0);

        _notify(99);
        rewards.claim(ALICE);
        rewards.claim(BOB);

        assertEq(rewardToken.balanceOf(ALICE), 60);
        assertEq(rewardToken.balanceOf(BOB), 40);
        assertEq(rewards.accountedRewards(), 0);
        assertEq(rewards.rewardRemainder(), 0);
    }

    function test_OneWeiRewardRedirectsAsTerminalDustAfterEveryManagerPermanentlyExits() public {
        _notify(1);

        vm.prank(ALICE);
        voter.resetSignals();
        assertEq(rewards.accountedRewards(), 1, "a live manager may still turn fractions into a whole token");
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);

        vm.prank(BOB);
        voter.resetSignals();

        assertEq(voter.strategyWeight(address(strategy)), 0);
        assertEq(rewards.accountedRewards(), 1);
        assertEq(rewards.totalAccruedRewards(), 0);
        assertEq(rewards.generationFinalizedTerminalDust(0), 1);
        assertEq(rewards.generationPendingTerminalDust(0), 1);
        assertEq(rewards.pendingTerminalDust(0, 0), 1);
        assertEq(rewards.generationRedirectedDust(0), 0);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);
        assertEq(rewardToken.balanceOf(address(rewards)), 1);
        assertEq(rewards.earned(ALICE), 0, "terminal fractions cannot revive after their cycle closes");
        assertEq(rewards.earned(BOB), 0, "terminal fractions cannot revive after their cycle closes");
        assertEq(rewards.claim(ALICE), 0);
        assertEq(rewards.claim(BOB), 0);

        vm.prank(address(0x5E77));
        assertEq(rewards.sweepTerminalDust(0, 0), 1);
        assertEq(rewards.accountedRewards(), 0);
        assertEq(rewards.totalPendingTerminalDust(), 0);
        assertEq(rewards.generationRedirectedDust(0), 1);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 1);
        assertEq(rewardToken.balanceOf(address(rewards)), 0);
    }

    function test_TerminalSettlementRetainsEveryWholeLiabilityAndRedirectsOnlyDust() public {
        _notify(101);

        vm.prank(ALICE);
        voter.resetSignals();
        vm.prank(BOB);
        voter.resetSignals();

        assertEq(rewards.accruedRewards(ALICE), 60);
        assertEq(rewards.accruedRewards(BOB), 40);
        assertEq(rewards.totalAccruedRewards(), 100);
        assertEq(rewards.accountedRewards(), 101);
        assertEq(rewards.totalPendingTerminalDust(), 1);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);

        assertEq(rewards.claim(ALICE), 60);
        assertEq(rewards.claim(BOB), 40);
        assertEq(rewardToken.balanceOf(ALICE), 60);
        assertEq(rewardToken.balanceOf(BOB), 40);
        assertEq(rewards.totalAccruedRewards(), 0);
        assertEq(rewards.accountedRewards(), 1, "pending vault dust remains solvent after manager claims");

        rewards.sweepTerminalDust(0, 0);
        assertEq(rewards.accountedRewards(), 0);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 1);
    }

    function test_TerminalDustTransferFailureCannotBlockLastManagersImmediateUnstake() public {
        AdversarialToken callbackToken = new AdversarialToken("Callback Token", "CBK", 18);
        RewardTestStrategy callbackStrategy = new RewardTestStrategy();
        ManagerRewards callbackRewards = new ManagerRewards(
            address(callbackToken),
            address(callbackStrategy),
            address(voter),
            address(vaultCaller),
            address(new NoopEligibilityModule())
        );
        registry.registerAsset(
            _config(address(callbackToken), 18, address(callbackStrategy), address(callbackRewards), true)
        );
        _signalExistingStake(ALICE, address(callbackStrategy));
        _signalExistingStake(BOB, address(callbackStrategy));
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);
        voter.checkpointUser(BOB);

        callbackToken.mint(address(callbackStrategy), 1);
        callbackStrategy.notify(callbackToken, callbackRewards, 1);
        callbackToken.setFalseReturn(address(callbackRewards), address(vaultCaller));

        vm.prank(ALICE);
        staked.unstake(60 ether);
        vm.prank(BOB);
        staked.unstake(40 ether);

        assertEq(voter.strategyWeight(address(callbackStrategy)), 0);
        assertEq(voter.activeWeight(BOB, address(callbackStrategy)), 0);
        assertEq(staked.balanceOf(ALICE), 0);
        assertEq(staked.balanceOf(BOB), 0);
        assertEq(gbx.balanceOf(ALICE), 60 ether);
        assertEq(gbx.balanceOf(BOB), 40 ether);
        assertEq(callbackRewards.accountedRewards(), 1);
        assertEq(callbackRewards.pendingTerminalDust(0, 0), 1);
        assertEq(callbackRewards.totalPendingTerminalDust(), 1);
        assertEq(callbackRewards.generationRedirectedDust(0), 0);
        assertEq(callbackToken.balanceOf(address(callbackRewards)), 1);
        assertEq(callbackToken.balanceOf(address(vaultCaller)), 0);

        vm.expectRevert();
        callbackRewards.sweepTerminalDust(0, 0);
        assertEq(callbackRewards.accountedRewards(), 1, "failed sweep must preserve the complete liability");
        assertEq(callbackRewards.pendingTerminalDust(0, 0), 1, "failed sweep must preserve the retry key");
        assertEq(callbackRewards.generationRedirectedDust(0), 0);

        callbackToken.clearBehavior();
        vm.prank(address(0x5E77));
        callbackRewards.sweepTerminalDust(0, 0);
        assertEq(callbackRewards.accountedRewards(), 0);
        assertEq(callbackRewards.totalPendingTerminalDust(), 0);
        assertEq(callbackRewards.generationRedirectedDust(0), 1);
        assertEq(callbackToken.balanceOf(address(vaultCaller)), 1);

        vm.expectRevert(
            abi.encodeWithSelector(ManagerRewards.ManagerRewards__NoPendingTerminalDust.selector, uint64(0), uint64(0))
        );
        callbackRewards.sweepTerminalDust(0, 0);
    }

    function test_TerminalDustSweepRejectsFeeAndSenderSurchargeWithoutLosingQueue() public {
        vm.prank(ALICE);
        voter.resetSignals();
        vm.prank(BOB);
        voter.resetSignals();

        AdversarialToken feeToken = new AdversarialToken("Fee Token", "FEE", 18);
        RewardTestStrategy feeStrategy = new RewardTestStrategy();
        ManagerRewards feeRewards = new ManagerRewards(
            address(feeToken),
            address(feeStrategy),
            address(voter),
            address(vaultCaller),
            address(new NoopEligibilityModule())
        );
        registry.registerAsset(_config(address(feeToken), 18, address(feeStrategy), address(feeRewards), true));

        address[] memory managers = new address[](16);
        for (uint256 index; index < managers.length; ++index) {
            address manager = address(uint160(0x1000 + index));
            managers[index] = manager;
            minter.mint(manager, 1);
            vm.startPrank(manager);
            gbx.approve(address(staked), 1);
            staked.stake(1);
            vm.stopPrank();
            _signalExistingStake(manager, address(feeStrategy));
        }
        vm.warp(block.timestamp + 1 days);
        for (uint256 index; index < managers.length; ++index) {
            voter.checkpointUser(managers[index]);
        }

        feeToken.mint(address(feeStrategy), 15);
        feeStrategy.notify(feeToken, feeRewards, 15);
        for (uint256 index; index < managers.length; ++index) {
            vm.prank(managers[index]);
            voter.resetSignals();
        }
        assertEq(feeRewards.pendingTerminalDust(0, 0), 15);

        feeToken.setFeeBps(1_000);
        vm.expectRevert(
            abi.encodeWithSelector(
                ManagerRewards.ManagerRewards__ObservedReceiptMismatch.selector, address(vaultCaller), 15, 14
            )
        );
        feeRewards.sweepTerminalDust(0, 0);
        assertEq(feeRewards.pendingTerminalDust(0, 0), 15);

        feeToken.setFeeBps(0);
        feeToken.mint(address(feeRewards), 1);
        feeToken.setSenderSurchargeBps(1_000);
        vm.expectRevert(abi.encodeWithSelector(ManagerRewards.ManagerRewards__ObservedDebitMismatch.selector, 15, 16));
        feeRewards.sweepTerminalDust(0, 0);
        assertEq(feeRewards.pendingTerminalDust(0, 0), 15);
        assertEq(feeRewards.accountedRewards(), 15);

        feeToken.setSenderSurchargeBps(0);
        feeToken.configureCallback(
            address(feeRewards),
            address(vaultCaller),
            address(feeRewards),
            abi.encodeCall(feeRewards.sweepTerminalDust, (uint64(0), uint64(0))),
            address(0)
        );
        assertEq(feeRewards.sweepTerminalDust(0, 0), 15);
        assertEq(feeToken.callbackCount(), 1);
        assertFalse(feeToken.lastCallbackSucceeded(), "the nested sweep must be rejected by nonReentrant");
        assertEq(feeRewards.accountedRewards(), 0);
        assertEq(feeRewards.totalPendingTerminalDust(), 0);
        assertEq(feeToken.balanceOf(address(vaultCaller)), 15);
    }

    function test_ReactivationAfterNaturalTerminalCannotReuseSweptFraction() public {
        _notify(1);
        vm.prank(ALICE);
        voter.resetSignals();
        vm.prank(BOB);
        voter.resetSignals();
        assertEq(rewards.pendingTerminalDust(0, 0), 1);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);

        _signalExistingStake(ALICE, address(strategy));
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);
        _notify(1);

        assertEq(rewards.claim(ALICE), 0, "the prior cycle's 0.6-token fraction must not create an overpayment");
        vm.prank(ALICE);
        voter.resetSignals();
        assertEq(rewardToken.balanceOf(ALICE), 0);
        assertEq(rewards.accountedRewards(), 2);
        assertEq(rewards.pendingTerminalDust(0, 0), 1);
        assertEq(rewards.pendingTerminalDust(0, 1), 1);
        assertEq(rewards.generationPendingTerminalDust(0), 2);
        assertEq(rewards.generationFinalizedTerminalDust(0), 2);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);

        rewards.sweepTerminalDust(0, 1);
        assertEq(rewards.pendingTerminalDust(0, 0), 1, "each natural terminal cycle remains independent");
        rewards.sweepTerminalDust(0, 0);
        assertEq(rewards.accountedRewards(), 0);
        assertEq(rewards.totalPendingTerminalDust(), 0);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 2);
    }

    function test_AdministrativeClosureDefersDustUntilEveryDormantWeightIsCheckpointed() public {
        _notify(1);
        _disableAndReactivateStrategy();

        assertEq(rewards.generationUnsettledWeight(0), 100 ether);
        assertEq(rewards.accountedRewards(), 1);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);

        assertEq(rewards.claim(ALICE), 0);
        assertEq(rewards.generationUnsettledWeight(0), 40 ether);
        assertEq(rewards.accountedRewards(), 1);
        assertEq(rewards.claim(BOB), 0);

        assertEq(rewards.generationUnsettledWeight(0), 0);
        assertEq(rewards.generationPendingTerminalDust(0), 1);
        assertEq(rewards.generationRedirectedDust(0), 0);
        assertEq(rewards.accountedRewards(), 1);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);

        rewards.sweepTerminalDust(0, 0);
        assertEq(rewards.generationRedirectedDust(0), 1);
        assertEq(rewards.accountedRewards(), 0);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 1);
    }

    function test_AdministrativeClosurePreservesLatentWholeClaimsBeforeRedirectingDust() public {
        _notify(101);
        _disableAndReactivateStrategy();

        assertEq(rewards.claim(ALICE), 60);
        assertEq(rewardToken.balanceOf(ALICE), 60);
        assertEq(rewards.accountedRewards(), 41);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);

        assertEq(rewards.claim(BOB), 40);
        assertEq(rewardToken.balanceOf(BOB), 40);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);
        assertEq(rewards.generationWholeEntitlements(0), 100);
        assertEq(rewards.generationPendingTerminalDust(0), 1);
        assertEq(rewards.generationRedirectedDust(0), 0);
        assertEq(rewards.totalAccruedRewards(), 0);
        assertEq(rewards.accountedRewards(), 1);

        rewards.sweepTerminalDust(0, 0);
        assertEq(rewards.generationRedirectedDust(0), 1);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 1);
        assertEq(rewards.accountedRewards(), 0);
    }

    function test_OldGenerationDustCoexistsWithNewRewardsAndSweepsOutOfOrder() public {
        _notify(101);
        _disableAndReactivateStrategy();

        // Fresh signals checkpoint both stale generation-zero weights. The final
        // checkpoint queues generation-zero dust without blocking reactivation.
        _signalExistingStake(ALICE, address(strategy));
        _signalExistingStake(BOB, address(strategy));
        assertEq(rewards.pendingTerminalDust(0, 0), 1);
        assertEq(rewards.totalAccruedRewards(), 100);
        assertEq(rewards.accountedRewards(), 101);

        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);
        voter.checkpointUser(BOB);
        assertEq(voter.strategyWeight(address(strategy)), 100 ether);

        _notify(203);
        assertEq(rewards.accountedRewards(), 304);

        // Alice can claim old- and new-generation rewards while the older vault
        // liability remains queued.
        assertEq(rewards.claim(ALICE), 181);
        assertEq(rewards.pendingTerminalDust(0, 0), 1);
        assertEq(rewards.accountedRewards(), 123);

        vm.prank(ALICE);
        voter.resetSignals();
        vm.prank(BOB);
        voter.resetSignals();

        assertEq(rewards.pendingTerminalDust(0, 0), 1);
        assertEq(rewards.pendingTerminalDust(1, 1), 1);
        assertEq(rewards.totalPendingTerminalDust(), 2);
        assertEq(rewards.totalAccruedRewards(), 121);
        assertEq(rewards.accountedRewards(), 123);

        // Settle the newer cycle first, then a manager claim, then the older
        // cycle. Every order preserves the same fixed liabilities.
        assertEq(rewards.sweepTerminalDust(1, 1), 1);
        assertEq(rewards.accountedRewards(), 122);
        assertEq(rewards.claim(BOB), 121);
        assertEq(rewards.accountedRewards(), 1);
        assertEq(rewards.sweepTerminalDust(0, 0), 1);

        assertEq(rewards.accountedRewards(), 0);
        assertEq(rewards.totalAccruedRewards(), 0);
        assertEq(rewards.totalPendingTerminalDust(), 0);
        assertEq(rewards.generationRedirectedDust(0), 1);
        assertEq(rewards.generationRedirectedDust(1), 1);
        assertEq(rewards.generationWholeEntitlements(0) + rewards.generationFinalizedTerminalDust(0), 101);
        assertEq(rewards.generationWholeEntitlements(1) + rewards.generationFinalizedTerminalDust(1), 203);
        assertEq(rewardToken.balanceOf(ALICE), 181);
        assertEq(rewardToken.balanceOf(BOB), 121);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 2);
        assertEq(
            rewardToken.balanceOf(ALICE) + rewardToken.balanceOf(BOB) + rewardToken.balanceOf(address(vaultCaller)), 304
        );
        assertEq(rewardToken.balanceOf(address(rewards)), 0);
    }

    function testFuzz_TerminalSettlementConservesNotificationAcrossWholeClaimsAndVaultDust(uint128 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, type(uint96).max);
        _notify(amount);

        vm.prank(ALICE);
        voter.resetSignals();
        vm.prank(BOB);
        voter.resetSignals();

        uint256 aliceExpected = Math.mulDiv(amount, 60, 100);
        uint256 bobExpected = Math.mulDiv(amount, 40, 100);
        uint256 dustExpected = amount - aliceExpected - bobExpected;
        assertEq(rewards.accountedRewards(), amount);
        assertEq(rewards.totalAccruedRewards(), aliceExpected + bobExpected);
        assertEq(rewards.totalPendingTerminalDust(), dustExpected);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), 0);

        assertEq(rewards.claim(ALICE), aliceExpected);
        assertEq(rewards.claim(BOB), bobExpected);
        if (dustExpected != 0) rewards.sweepTerminalDust(0, 0);
        assertEq(rewardToken.balanceOf(ALICE) + rewardToken.balanceOf(BOB), aliceExpected + bobExpected);
        assertEq(rewardToken.balanceOf(address(vaultCaller)), dustExpected);
        assertEq(rewardToken.balanceOf(address(rewards)), 0);
        assertEq(aliceExpected + bobExpected + dustExpected, amount);
    }

    function test_GlobalRewardIndexRemainderCannotDoubleCountTinyNotifications() public {
        vm.prank(ALICE);
        voter.resetSignals();
        vm.prank(BOB);
        voter.resetSignals();
        vm.prank(ALICE);
        staked.unstake(60 ether);
        vm.prank(BOB);
        staked.unstake(40 ether);

        _stakeAndSignal(ALICE, 1);
        _stakeAndSignal(BOB, 2);
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);
        voter.checkpointUser(BOB);

        for (uint256 index; index < 3; ++index) {
            _notify(1);
            rewards.claim(ALICE);
            rewards.claim(BOB);
        }

        assertEq(rewardToken.balanceOf(ALICE), 1);
        assertEq(rewardToken.balanceOf(BOB), 2);
        assertEq(rewardToken.balanceOf(ALICE) + rewardToken.balanceOf(BOB), 3);
        assertEq(rewards.accountedRewards(), 0);
        assertEq(rewards.rewardRemainder(), 0);
    }

    function test_AccruedRewardSurvivesImmediateUnstake() public {
        _notify(100 ether);
        vm.prank(ALICE);
        staked.unstake(60 ether);

        rewards.claim(ALICE);
        assertEq(rewardToken.balanceOf(ALICE), 60 ether);
    }

    function test_RewardsRemainExactAcrossVoteReallocationBetweenStrategies() public {
        VaultTestToken secondRewardToken = new VaultTestToken("Wrapped Bitcoin", "WBTC", 18);
        RewardTestStrategy secondStrategy = new RewardTestStrategy();
        ManagerRewards secondRewards = new ManagerRewards(
            address(secondRewardToken),
            address(secondStrategy),
            address(voter),
            address(vaultCaller),
            address(new NoopEligibilityModule())
        );
        registry.registerAsset(
            _config(address(secondRewardToken), 18, address(secondStrategy), address(secondRewards), true)
        );

        _notify(100 ether);

        address[] memory strategies = new address[](1);
        strategies[0] = address(secondStrategy);
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        vm.prank(ALICE);
        voter.signal(strategies, weights);

        _notify(40 ether);
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);

        secondRewardToken.mint(address(secondStrategy), 60 ether);
        secondStrategy.notify(secondRewardToken, secondRewards, 60 ether);

        rewards.claim(ALICE);
        rewards.claim(BOB);
        secondRewards.claim(ALICE);
        secondRewards.claim(BOB);

        assertEq(rewardToken.balanceOf(ALICE), 60 ether);
        assertEq(rewardToken.balanceOf(BOB), 80 ether);
        assertEq(secondRewardToken.balanceOf(ALICE), 60 ether);
        assertEq(secondRewardToken.balanceOf(BOB), 0);
        assertEq(rewards.accountedRewards(), 0);
        assertEq(secondRewards.accountedRewards(), 0);
    }

    function test_StrategyReactivationIsolatesRewardGenerations() public {
        vm.prank(BOB);
        voter.resetSignals();
        _notify(60 ether);

        _disableAndReactivateStrategy();

        assertEq(rewards.earned(ALICE), 60 ether, "pre-disable accrual must remain visible");

        _signalExistingStake(BOB, address(strategy));
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(BOB);
        _notify(40 ether);

        rewards.claim(ALICE);
        rewards.claim(BOB);

        assertEq(rewardToken.balanceOf(ALICE), 60 ether, "stale weight must not earn after reactivation");
        assertEq(rewardToken.balanceOf(BOB), 40 ether, "new generation owns its reward");
        assertEq(rewards.accountedRewards(), 0);
    }

    function test_UncheckpointedWeightSettlesAtItsOwnBoundaryAcrossMultipleGenerations() public {
        vm.prank(BOB);
        voter.resetSignals();
        _notify(60 ether);
        _disableAndReactivateStrategy();

        _signalExistingStake(BOB, address(strategy));
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(BOB);
        _notify(40 ether);
        _disableAndReactivateStrategy();

        vm.prank(BOB);
        voter.resetSignals();
        _signalExistingStake(BOB, address(strategy));
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(BOB);
        _notify(20 ether);

        assertEq(rewards.earned(ALICE), 60 ether);
        assertEq(rewards.earned(BOB), 60 ether);
        rewards.claim(ALICE);
        rewards.claim(BOB);
        assertEq(rewardToken.balanceOf(ALICE), 60 ether);
        assertEq(rewardToken.balanceOf(BOB), 60 ether);
        assertEq(rewards.accountedRewards(), 0);
    }

    function test_AnyoneCanClaimButCannotRedirectUserFunds() public {
        _notify(100 ether);
        vm.prank(address(0xCA11));
        rewards.claim(ALICE);
        assertEq(rewardToken.balanceOf(ALICE), 60 ether);
        assertEq(rewardToken.balanceOf(address(0xCA11)), 0);
    }

    function test_ZeroWeightNotificationRedirectsToVault() public {
        vm.prank(ALICE);
        voter.resetSignals();
        vm.prank(BOB);
        voter.resetSignals();
        assertEq(voter.strategyWeight(address(strategy)), 0);

        _notify(5 ether);

        assertEq(rewardToken.balanceOf(address(vaultCaller)), 5 ether);
        assertEq(rewards.accountedRewards(), 0);
    }

    function test_ZeroWeightRedirectRevertsIfVaultReceivesLessThanNotified() public {
        AdversarialToken feeToken = new AdversarialToken("Fee Token", "FEE", 18);
        RewardTestStrategy feeStrategy = new RewardTestStrategy();
        ManagerRewards feeRewards = new ManagerRewards(
            address(feeToken),
            address(feeStrategy),
            address(voter),
            address(vaultCaller),
            address(new NoopEligibilityModule())
        );
        uint256 amount = 10 ether;
        feeToken.mint(address(feeRewards), amount);
        feeToken.setFeeBps(200);

        vm.expectRevert(
            abi.encodeWithSelector(
                ManagerRewards.ManagerRewards__ObservedReceiptMismatch.selector, address(vaultCaller), amount, 9.8 ether
            )
        );
        vm.prank(address(feeStrategy));
        feeRewards.notifyReward(amount);

        assertEq(feeToken.balanceOf(address(feeRewards)), amount, "failed redirect must roll back");
        assertEq(feeToken.balanceOf(address(vaultCaller)), 0);
        assertEq(feeRewards.accountedRewards(), 0);
    }

    function test_ClaimRevertsWithoutReducingLiabilityIfReceiverIsUnderpaid() public {
        AdversarialToken feeToken = new AdversarialToken("Fee Token", "FEE", 18);
        RewardTestStrategy feeStrategy = new RewardTestStrategy();
        ManagerRewards feeRewards = new ManagerRewards(
            address(feeToken),
            address(feeStrategy),
            address(voter),
            address(vaultCaller),
            address(new NoopEligibilityModule())
        );
        registry.registerAsset(_config(address(feeToken), 18, address(feeStrategy), address(feeRewards), true));

        _signalExistingStake(ALICE, address(feeStrategy));
        _signalExistingStake(BOB, address(feeStrategy));
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);
        voter.checkpointUser(BOB);

        uint256 amount = 100 ether;
        feeToken.mint(address(feeStrategy), amount);
        feeStrategy.notify(feeToken, feeRewards, amount);
        feeToken.setFeeBps(200);

        vm.expectRevert(
            abi.encodeWithSelector(
                ManagerRewards.ManagerRewards__ObservedReceiptMismatch.selector, ALICE, 60 ether, 58.8 ether
            )
        );
        feeRewards.claim(ALICE);

        assertEq(feeRewards.accountedRewards(), amount, "failed claim must preserve liabilities");
        assertEq(feeRewards.accruedRewards(ALICE), 0, "claim checkpoint must roll back atomically");
        assertEq(feeToken.balanceOf(ALICE), 0);

        feeToken.setFeeBps(0);
        feeRewards.claim(ALICE);
        assertEq(feeToken.balanceOf(ALICE), 60 ether);
        assertEq(feeRewards.accountedRewards(), 40 ether);
    }

    function test_ClaimCannotLeaveLiabilitiesInsolventWhenSenderPaysSurcharge() public {
        AdversarialToken feeToken = new AdversarialToken("Surcharge Token", "SUR", 18);
        RewardTestStrategy feeStrategy = new RewardTestStrategy();
        ManagerRewards feeRewards = new ManagerRewards(
            address(feeToken),
            address(feeStrategy),
            address(voter),
            address(vaultCaller),
            address(new NoopEligibilityModule())
        );
        registry.registerAsset(_config(address(feeToken), 18, address(feeStrategy), address(feeRewards), true));

        _signalExistingStake(ALICE, address(feeStrategy));
        _signalExistingStake(BOB, address(feeStrategy));
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(ALICE);
        voter.checkpointUser(BOB);

        uint256 amount = 100 ether;
        feeToken.mint(address(feeStrategy), amount);
        feeStrategy.notify(feeToken, feeRewards, amount);
        feeToken.setSenderSurchargeBps(200);

        vm.expectRevert(
            abi.encodeWithSelector(ManagerRewards.ManagerRewards__ObservedDebitMismatch.selector, 60 ether, 61.2 ether)
        );
        feeRewards.claim(ALICE);

        assertEq(feeToken.balanceOf(address(feeRewards)), amount, "failed claim must roll back sender debit");
        assertEq(feeRewards.accountedRewards(), amount, "failed claim must preserve liabilities");
        assertEq(feeRewards.accruedRewards(ALICE), 0, "failed claim checkpoint must roll back");
        assertEq(feeToken.balanceOf(ALICE), 0);

        feeToken.setSenderSurchargeBps(0);
        feeRewards.claim(ALICE);
        assertEq(feeToken.balanceOf(ALICE), 60 ether);
        assertEq(feeRewards.accountedRewards(), 40 ether);
    }

    function test_UnauthorizedAccountCannotNotifyReward() public {
        rewardToken.mint(address(rewards), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(ManagerRewards.ManagerRewards__NotStrategy.selector, address(this)));
        rewards.notifyReward(1 ether);
    }

    function test_IneligibleRewardReceiverCannotConsumeAccruedLiability() public {
        _notify(100 ether);
        eligibility.setHoldAllowed(false);

        vm.expectRevert(abi.encodeWithSelector(ManagerRewards.ManagerRewards__IneligibleReceiver.selector, ALICE));
        rewards.claim(ALICE);

        assertEq(rewardToken.balanceOf(ALICE), 0);
        assertEq(rewardToken.balanceOf(address(rewards)), 100 ether);
        assertEq(rewards.accountedRewards(), 100 ether);
        assertEq(rewards.accruedRewards(ALICE), 0, "failed eligibility must roll back the checkpoint");
        assertEq(rewards.earned(ALICE), 60 ether);

        vm.expectRevert(abi.encodeWithSelector(ManagerRewards.ManagerRewards__IneligibleReceiver.selector, BOB));
        vm.prank(ALICE);
        rewards.setRewardReceiver(BOB);
        assertEq(rewards.rewardReceiver(ALICE), address(0));

        eligibility.setHoldAllowed(true);
        rewards.claim(ALICE);
        assertEq(rewardToken.balanceOf(ALICE), 60 ether);
        assertEq(rewards.accountedRewards(), 40 ether);
    }

    function test_RewardEligibilityInfrastructureFailureClosesWithoutLiabilityChange() public {
        _notify(100 ether);
        eligibility.setChecksRevert(true);

        vm.expectRevert("ELIGIBILITY_CHECK_REVERTED");
        rewards.claim(ALICE);

        assertEq(rewardToken.balanceOf(ALICE), 0);
        assertEq(rewardToken.balanceOf(address(rewards)), 100 ether);
        assertEq(rewards.accountedRewards(), 100 ether);
        assertEq(rewards.accruedRewards(ALICE), 0);
        assertEq(rewards.earned(ALICE), 60 ether);
    }

    function test_OnlyVoterCanAdvanceRewardGenerationConsecutively() public {
        vm.expectRevert(
            abi.encodeWithSelector(ManagerRewards.ManagerRewards__NotAllocationVoter.selector, address(this))
        );
        rewards.settleTerminalDust();

        vm.prank(address(voter));
        vm.expectRevert(
            abi.encodeWithSelector(ManagerRewards.ManagerRewards__NonZeroStrategyWeight.selector, 100 ether)
        );
        rewards.settleTerminalDust();

        vm.expectRevert(
            abi.encodeWithSelector(ManagerRewards.ManagerRewards__NotAllocationVoter.selector, address(this))
        );
        rewards.advanceGeneration(1);

        vm.prank(address(voter));
        vm.expectRevert(
            abi.encodeWithSelector(ManagerRewards.ManagerRewards__InvalidGeneration.selector, uint64(1), uint64(2))
        );
        rewards.advanceGeneration(2);

        vm.prank(address(voter));
        rewards.advanceGeneration(1);
        assertEq(rewards.currentGeneration(), 1);
        assertTrue(rewards.generationClosed(0));
    }

    function _notify(uint256 amount) private {
        rewardToken.mint(address(strategy), amount);
        strategy.notify(rewardToken, rewards, amount);
    }

    function _stakeAndSignal(address user, uint256 amount) private {
        vm.startPrank(user);
        gbx.approve(address(staked), amount);
        staked.stake(amount);
        vm.stopPrank();
        _signalExistingStake(user, address(strategy));
    }

    function _signalExistingStake(address user, address targetStrategy) private {
        address[] memory strategies = new address[](1);
        strategies[0] = targetStrategy;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        vm.prank(user);
        voter.signal(strategies, weights);
    }

    function _disableAndReactivateStrategy() private {
        registry.disableAcquisition(address(rewardToken));
        voter.disableStrategy(address(strategy));
        registry.enableAcquisition(address(rewardToken));
        voter.reactivateStrategy(address(strategy));
    }

    function _config(address token, uint8 decimals, address strategy_, address rewards_, bool acquisitionEnabled)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        if (strategy_ != address(0) && token != address(usdG)) {
            RewardTestStrategy(strategy_).configureRegistrationIdentity(token, rewards_, usdG.decimals(), decimals);
            strategyDeployer.attestAcquisition(strategy_, token, rewards_);
        }
        return IAssetRegistry.AssetConfig({
            token: token,
            assetId: keccak256(abi.encodePacked(token)),
            symbolHash: keccak256(bytes(VaultTestToken(token).symbol())),
            decimals: decimals,
            strategy: strategy_,
            rewards: rewards_,
            isStockToken: false,
            acquisitionEnabled: acquisitionEnabled,
            redemptionEnabled: true
        });
    }
}
