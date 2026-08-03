// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { RateMath } from "../../../src/libraries/RateMath.sol";
import { ManagerRewards } from "../../../src/rewards/ManagerRewards.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../../src/signal/StakedGBX.sol";
import { AcquisitionStrategy } from "../../../src/strategies/AcquisitionStrategy.sol";
import { BuybackBurnStrategy } from "../../../src/strategies/BuybackBurnStrategy.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../../src/vault/GumBallVault.sol";
import { SignalTestRevenueSource } from "../mocks/SignalTestMocks.sol";
import { VaultTestGBXMinter, VaultTestToken } from "../mocks/VaultTestMocks.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

contract StrategyIntegrationTest is Test {
    address private constant MANAGER = address(0xA11CE);
    address private constant TAKER = address(0xB0B);
    address private constant GUARDIAN = address(0x6900);
    uint256 private constant REFERENCE_RATE = 1e18;

    VaultTestToken private usdG;
    VaultTestToken private target;
    GBXToken private gbx;
    VaultTestGBXMinter private minter;
    AssetRegistry private registry;
    AllocationVoter private voter;
    StakedGBX private staked;
    GumBallVault private vault;
    AcquisitionStrategy private strategy;
    ManagerRewards private rewards;
    SignalTestRevenueSource[4] private sources;
    StrategyDeployerTestMock private strategyDeployer;

    struct BuybackSnapshot {
        uint256 takerGBX;
        uint256 strategyGBX;
        uint256 totalSupply;
        uint256 cumulativeBurned;
        uint256 receiverUSDG;
        uint256 vaultUSDG;
        uint256 storedBudget;
        uint256 previewBudget;
        uint64 auctionId;
        uint64 auctionStartTime;
        uint256 referenceRate;
        uint256 startRate;
        uint256 floorRate;
        bool fillsPaused;
    }

    function setUp() public {
        usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        target = new VaultTestToken("Wrapped Ether", "WETH", 18);
        gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        minter = new VaultTestGBXMinter(gbx);
        gbx.initializeEmissionController(address(minter));
        strategyDeployer = new StrategyDeployerTestMock(address(this), GUARDIAN, address(gbx));
        registry = new AssetRegistry(address(usdG), address(this), GUARDIAN, address(strategyDeployer));
        voter = new AllocationVoter(address(usdG), address(registry), address(this), GUARDIAN, address(this));
        staked = new StakedGBX(address(gbx), address(voter));
        NoopEligibilityModule eligibility = new NoopEligibilityModule();
        vault = new GumBallVault(address(usdG), address(gbx), address(registry), address(voter), address(eligibility));
        strategy = new AcquisitionStrategy(
            address(target),
            address(vault),
            address(voter),
            address(registry),
            address(this),
            GUARDIAN,
            address(this),
            10_000_000,
            500_000_000,
            REFERENCE_RATE
        );
        rewards = new ManagerRewards(
            address(target), address(strategy), address(voter), address(vault), address(eligibility)
        );
        strategy.initializeManagerRewards(address(rewards));

        address[4] memory sourceAddresses;
        for (uint256 index; index < 4; ++index) {
            sources[index] = new SignalTestRevenueSource();
            sourceAddresses[index] = address(sources[index]);
        }
        voter.initializeDependencies(address(vault), address(staked), sourceAddresses);
        strategyDeployer.configureGraph(address(registry), address(voter), address(vault), address(eligibility));
        registry.configureVault(address(vault));
        registry.registerAsset(
            _config(address(usdG), 6, strategyDeployer.canonicalHoldUSDGStrategy(), address(0), false)
        );
        registry.registerAsset(_config(address(target), 18, address(strategy), address(rewards), true));

        minter.mint(MANAGER, 100 ether);
        minter.mint(TAKER, 100 ether);
        vm.startPrank(MANAGER);
        gbx.approve(address(staked), 100 ether);
        staked.stake(100 ether);
        vm.stopPrank();
    }

    function test_AcquisitionFillDeliversTargetBeforeUSDGAndSplitsNinetyEightTwo() public {
        _activateSignal(address(strategy));
        _notifyMiningRevenue(1_000_000_000);
        target.mint(TAKER, 200 ether);
        vm.prank(TAKER);
        target.approve(address(strategy), type(uint256).max);

        vm.prank(TAKER);
        uint256 received = strategy.fill(2, 100_000_000, 125 ether, TAKER, block.timestamp);

        assertEq(received, 125 ether);
        assertEq(target.balanceOf(address(vault)), 122.5 ether);
        assertEq(target.balanceOf(address(rewards)), 2.5 ether);
        assertEq(usdG.balanceOf(TAKER), 100_000_000);
        assertEq(voter.strategyBudget(address(strategy)), 900_000_000);
        assertEq(strategy.auctionId(), 3);

        rewards.claim(MANAGER);
        assertEq(target.balanceOf(MANAGER), 2.5 ether);
    }

    function test_RateDecaysLinearlyToANonzeroFloorAndExpiredAuctionMustRestart() public {
        assertEq(strategy.currentRate(), 1.25e18);
        vm.warp(block.timestamp + 12 hours);
        assertEq(strategy.currentRate(), 1.025e18);
        vm.warp(block.timestamp + 12 hours);
        assertEq(strategy.currentRate(), 0.8e18);

        vm.expectRevert(abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__AuctionExpired.selector, 1));
        strategy.fill(1, 100_000_000, type(uint256).max, TAKER, block.timestamp);

        strategy.restartExpiredAuction();
        assertEq(strategy.auctionId(), 2);
        assertEq(strategy.currentRate(), 1.25e18);
    }

    function test_BuybackBurnsEveryReceivedGBXAndPaysNoManagerReward() public {
        BuybackBurnStrategy buyback = _deployBuyback();
        _activateSignal(address(buyback));
        _notifyMiningRevenue(40_000_000);

        vm.prank(TAKER);
        gbx.approve(address(buyback), 50 ether);
        uint256 supplyBefore = gbx.totalSupply();
        uint256 cumulativeMintedBefore = gbx.cumulativeMinted();

        vm.prank(TAKER);
        uint256 burned = buyback.fill(2, 40_000_000, 50 ether, TAKER, block.timestamp);

        assertEq(burned, 50 ether);
        assertEq(gbx.totalSupply(), supplyBefore - 50 ether);
        assertEq(gbx.cumulativeBurned(), 50 ether);
        assertEq(gbx.cumulativeMinted(), cumulativeMintedBefore);
        assertEq(gbx.balanceOf(address(buyback)), 0);
        assertEq(usdG.balanceOf(TAKER), 40_000_000);
    }

    function test_BuybackRejectsEveryFillValidationFailureWithoutStateDrift() public {
        BuybackBurnStrategy buyback = _fundBuyback(100_000_000);
        uint64 activeAuctionId = buyback.auctionId();
        BuybackSnapshot memory before = _snapshot(buyback, TAKER);

        vm.prank(TAKER);
        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackBurnStrategy.BuybackBurnStrategy__StaleAuctionId.selector, activeAuctionId + 1, activeAuctionId
            )
        );
        buyback.fill(activeAuctionId + 1, 10_000_000, type(uint256).max, TAKER, block.timestamp);

        uint256 expiredDeadline = block.timestamp - 1;
        vm.prank(TAKER);
        vm.expectRevert(
            abi.encodeWithSelector(BuybackBurnStrategy.BuybackBurnStrategy__DeadlineExpired.selector, expiredDeadline)
        );
        buyback.fill(activeAuctionId, 10_000_000, type(uint256).max, TAKER, expiredDeadline);

        vm.prank(TAKER);
        vm.expectRevert(BuybackBurnStrategy.BuybackBurnStrategy__ZeroReceiver.selector);
        buyback.fill(activeAuctionId, 10_000_000, type(uint256).max, address(0), block.timestamp);

        vm.prank(TAKER);
        vm.expectRevert(BuybackBurnStrategy.BuybackBurnStrategy__InvalidLotBounds.selector);
        buyback.fill(activeAuctionId, 9_999_999, type(uint256).max, TAKER, block.timestamp);

        vm.prank(TAKER);
        vm.expectRevert(BuybackBurnStrategy.BuybackBurnStrategy__InvalidLotBounds.selector);
        buyback.fill(activeAuctionId, 500_000_001, type(uint256).max, TAKER, block.timestamp);

        vm.prank(TAKER);
        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackBurnStrategy.BuybackBurnStrategy__InsufficientBudget.selector, 100_000_001, 100_000_000
            )
        );
        buyback.fill(activeAuctionId, 100_000_001, type(uint256).max, TAKER, block.timestamp);

        uint256 requiredGBX = RateMath.quoteAssetAmount(10_000_000, buyback.currentRate(), 6, 18);
        vm.prank(TAKER);
        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackBurnStrategy.BuybackBurnStrategy__MaxGBXExceeded.selector, requiredGBX, requiredGBX - 1
            )
        );
        buyback.fill(activeAuctionId, 10_000_000, requiredGBX - 1, TAKER, block.timestamp);

        vm.mockCall(
            address(gbx),
            abi.encodeWithSelector(IERC20.transferFrom.selector, TAKER, address(buyback), requiredGBX),
            abi.encode(true)
        );
        vm.prank(TAKER);
        vm.expectRevert(
            abi.encodeWithSelector(BuybackBurnStrategy.BuybackBurnStrategy__UnderpaidGBX.selector, requiredGBX, 0)
        );
        buyback.fill(activeAuctionId, 10_000_000, requiredGBX, TAKER, block.timestamp);
        vm.clearMockedCalls();

        _assertSnapshot(buyback, TAKER, before);
    }

    function test_BuybackPauseAndInactiveGatesAreLeastPrivilegeAndRollbackSafe() public {
        BuybackBurnStrategy buyback = _fundBuyback(100_000_000);

        vm.prank(TAKER);
        vm.expectRevert(
            abi.encodeWithSelector(BuybackBurnStrategy.BuybackBurnStrategy__NotEmergencyGuardian.selector, TAKER)
        );
        buyback.pauseFills();

        vm.prank(GUARDIAN);
        buyback.pauseFills();
        BuybackSnapshot memory paused = _snapshot(buyback, TAKER);
        uint64 pausedAuctionId = buyback.auctionId();
        vm.prank(TAKER);
        vm.expectRevert(BuybackBurnStrategy.BuybackBurnStrategy__FillsPaused.selector);
        buyback.fill(pausedAuctionId, 10_000_000, type(uint256).max, TAKER, block.timestamp);
        _assertSnapshot(buyback, TAKER, paused);

        vm.prank(TAKER);
        vm.expectRevert(
            abi.encodeWithSelector(BuybackBurnStrategy.BuybackBurnStrategy__NotProtocolTimelock.selector, TAKER)
        );
        buyback.unpauseFills();
        buyback.unpauseFills();
        assertFalse(buyback.fillsPaused());

        vm.prank(GUARDIAN);
        registry.disableStandaloneStrategy(address(buyback));
        BuybackSnapshot memory inactive = _snapshot(buyback, TAKER);
        uint64 inactiveAuctionId = buyback.auctionId();
        vm.prank(TAKER);
        vm.expectRevert(BuybackBurnStrategy.BuybackBurnStrategy__InactiveStrategy.selector);
        buyback.fill(inactiveAuctionId, 10_000_000, type(uint256).max, TAKER, block.timestamp);
        _assertSnapshot(buyback, TAKER, inactive);
    }

    function test_BuybackRestartUsesExactExpiryBoundary() public {
        BuybackBurnStrategy buyback = _deployBuyback();
        uint64 initialAuctionId = buyback.auctionId();
        uint256 expiry = uint256(buyback.auctionStartTime()) + buyback.AUCTION_DURATION();

        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackBurnStrategy.BuybackBurnStrategy__AuctionNotExpired.selector, initialAuctionId
            )
        );
        buyback.restartExpiredAuction();

        vm.warp(expiry);
        assertEq(buyback.currentRate(), buyback.floorRate());
        vm.expectRevert(
            abi.encodeWithSelector(BuybackBurnStrategy.BuybackBurnStrategy__AuctionExpired.selector, initialAuctionId)
        );
        buyback.fill(initialAuctionId, 10_000_000, type(uint256).max, TAKER, block.timestamp);

        buyback.restartExpiredAuction();
        assertEq(buyback.auctionId(), initialAuctionId + 1);
        assertEq(buyback.currentRate(), buyback.startRate());
    }

    function test_BuybackReferenceResetEnforcesAuthorityAndReviewedBaselineBoundsWithoutExpiryGate() public {
        BuybackBurnStrategy buyback = _deployBuyback();
        uint64 initialAuctionId = buyback.auctionId();

        vm.prank(TAKER);
        vm.expectRevert(
            abi.encodeWithSelector(BuybackBurnStrategy.BuybackBurnStrategy__NotProtocolTimelock.selector, TAKER)
        );
        buyback.resetReferenceRate(REFERENCE_RATE, REFERENCE_RATE);

        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackBurnStrategy.BuybackBurnStrategy__ReferenceResetOutOfBounds.selector, 0.5e18 - 1, 0.5e18, 2e18
            )
        );
        buyback.resetReferenceRate(REFERENCE_RATE, 0.5e18 - 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackBurnStrategy.BuybackBurnStrategy__ReferenceResetOutOfBounds.selector, 2e18 + 1, 0.5e18, 2e18
            )
        );
        buyback.resetReferenceRate(REFERENCE_RATE, 2e18 + 1);

        // A valid reset is executable immediately; a restart/fill cannot impose a new expiry wait.
        buyback.resetReferenceRate(REFERENCE_RATE, 0.5e18);
        assertEq(buyback.referenceRate(), 0.5e18);
        assertEq(buyback.auctionId(), initialAuctionId + 1);

        // Bounds remain tied to the reviewed baseline, not a live rate changed after scheduling.
        buyback.resetReferenceRate(REFERENCE_RATE, 2e18);
        assertEq(buyback.referenceRate(), 2e18);
        assertEq(buyback.auctionId(), initialAuctionId + 2);

        // The 50% floor rounds up, so integer truncation can never authorize a larger cut.
        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackBurnStrategy.BuybackBurnStrategy__ReferenceResetOutOfBounds.selector, 2, 3, 10
            )
        );
        buyback.resetReferenceRate(5, 2);
        buyback.resetReferenceRate(5, 3);
        assertEq(buyback.referenceRate(), 3);

        // The live-rate cap makes the 200% bound total for every reachable reference rate.
        uint256 maximumReferenceRate = buyback.MAX_REFERENCE_RATE();
        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackBurnStrategy.BuybackBurnStrategy__ReferenceResetOutOfBounds.selector,
                maximumReferenceRate + 1,
                (maximumReferenceRate + 1) / 2,
                maximumReferenceRate
            )
        );
        buyback.resetReferenceRate(maximumReferenceRate, maximumReferenceRate + 1);
        buyback.resetReferenceRate(maximumReferenceRate, maximumReferenceRate);
        assertEq(buyback.referenceRate(), maximumReferenceRate);
    }

    function test_BuybackAcceptsExactLotBoundsAndBurnsAllObservedGBX() public {
        BuybackBurnStrategy buyback = _fundBuyback(510_000_000);
        minter.mint(TAKER, 1_000 ether);
        uint256 supplyBefore = gbx.totalSupply();
        uint256 burnedBefore = gbx.cumulativeBurned();
        uint256 takerUSDGBefore = usdG.balanceOf(TAKER);

        uint256 minimumGBX = RateMath.quoteAssetAmount(10_000_000, buyback.currentRate(), 6, 18);
        uint64 minimumAuctionId = buyback.auctionId();
        vm.prank(TAKER);
        buyback.fill(minimumAuctionId, 10_000_000, minimumGBX, TAKER, block.timestamp);
        uint256 maximumGBX = RateMath.quoteAssetAmount(500_000_000, buyback.currentRate(), 6, 18);
        uint64 maximumAuctionId = buyback.auctionId();
        vm.prank(TAKER);
        buyback.fill(maximumAuctionId, 500_000_000, maximumGBX, TAKER, block.timestamp);

        uint256 totalBurned = minimumGBX + maximumGBX;
        assertEq(gbx.totalSupply(), supplyBefore - totalBurned);
        assertEq(gbx.cumulativeBurned(), burnedBefore + totalBurned);
        assertEq(gbx.balanceOf(address(buyback)), 0);
        assertEq(usdG.balanceOf(TAKER), takerUSDGBefore + 510_000_000);
        assertEq(voter.strategyBudget(address(buyback)), 0);
    }

    function test_FillRejectsStaleAuctionIdAndLotAboveBudget() public {
        _activateSignal(address(strategy));
        _notifyMiningRevenue(50_000_000);

        vm.expectRevert(abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__StaleAuctionId.selector, 3, 2));
        strategy.fill(3, 10_000_000, type(uint256).max, TAKER, block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__InsufficientBudget.selector, 100_000_000, 50_000_000
            )
        );
        strategy.fill(2, 100_000_000, type(uint256).max, TAKER, block.timestamp);
    }

    function test_AcquisitionAcceptsExactMinimumAndMaximumLots() public {
        _activateSignal(address(strategy));
        _notifyMiningRevenue(1_000_000_000);
        target.mint(TAKER, 1_000 ether);
        vm.prank(TAKER);
        target.approve(address(strategy), type(uint256).max);

        vm.prank(TAKER);
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__InvalidLotBounds.selector);
        strategy.fill(2, 9_999_999, type(uint256).max, TAKER, block.timestamp);

        vm.prank(TAKER);
        strategy.fill(2, 10_000_000, type(uint256).max, TAKER, block.timestamp);
        vm.prank(TAKER);
        strategy.fill(3, 500_000_000, type(uint256).max, TAKER, block.timestamp);

        vm.prank(TAKER);
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__InvalidLotBounds.selector);
        strategy.fill(4, 500_000_001, type(uint256).max, TAKER, block.timestamp);

        assertEq(voter.strategyBudget(address(strategy)), 490_000_000);
        assertEq(strategy.auctionId(), 4);
    }

    function test_AcquisitionEnforcesDeadlineSlippageAndReceiverBounds() public {
        _activateSignal(address(strategy));
        _notifyMiningRevenue(100_000_000);

        uint256 expiredDeadline = block.timestamp - 1;
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__DeadlineExpired.selector, expiredDeadline)
        );
        strategy.fill(2, 10_000_000, type(uint256).max, TAKER, expiredDeadline);

        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__MaxTargetExceeded.selector, 12.5 ether, 1)
        );
        strategy.fill(2, 10_000_000, 1, TAKER, block.timestamp);

        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__ZeroReceiver.selector);
        strategy.fill(2, 10_000_000, type(uint256).max, address(0), block.timestamp);
    }

    function test_PauseAndRegistryDisableBothStopFills() public {
        _activateSignal(address(strategy));
        _notifyMiningRevenue(100_000_000);

        vm.prank(GUARDIAN);
        strategy.pauseFills();
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__FillsPaused.selector);
        strategy.fill(2, 10_000_000, type(uint256).max, TAKER, block.timestamp);

        strategy.unpauseFills();
        vm.prank(GUARDIAN);
        registry.disableAcquisition(address(target));
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__InactiveStrategy.selector);
        strategy.fill(2, 10_000_000, type(uint256).max, TAKER, block.timestamp);
    }

    function test_ReferenceResetRequiresTimelockAndUsesReviewedBaselineWithoutExpiryGate() public {
        vm.prank(TAKER);
        vm.expectRevert(
            abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__NotProtocolTimelock.selector, TAKER)
        );
        strategy.resetReferenceRate(REFERENCE_RATE, REFERENCE_RATE);

        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__ReferenceResetOutOfBounds.selector, 0.5e18 - 1, 0.5e18, 2e18
            )
        );
        strategy.resetReferenceRate(REFERENCE_RATE, 0.5e18 - 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__ReferenceResetOutOfBounds.selector, 2e18 + 1, 0.5e18, 2e18
            )
        );
        strategy.resetReferenceRate(REFERENCE_RATE, 2e18 + 1);

        // No expiry is required, so a permissionless restart/fill cannot postpone a mature reset.
        strategy.resetReferenceRate(REFERENCE_RATE, 0.5e18);
        assertEq(strategy.referenceRate(), 0.5e18);

        // The supplied reviewed baseline controls bounds even after the live reference has changed.
        strategy.resetReferenceRate(REFERENCE_RATE, 2e18);
        assertEq(strategy.referenceRate(), 2e18);

        // The 50% floor rounds up, so integer truncation can never authorize a larger cut.
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__ReferenceResetOutOfBounds.selector, 2, 3, 10
            )
        );
        strategy.resetReferenceRate(5, 2);
        strategy.resetReferenceRate(5, 3);
        assertEq(strategy.referenceRate(), 3);

        // The live-rate cap makes the 200% bound total for every reachable reference rate.
        uint256 maximumReferenceRate = strategy.MAX_REFERENCE_RATE();
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__ReferenceResetOutOfBounds.selector,
                maximumReferenceRate + 1,
                (maximumReferenceRate + 1) / 2,
                maximumReferenceRate
            )
        );
        strategy.resetReferenceRate(maximumReferenceRate, maximumReferenceRate + 1);
        strategy.resetReferenceRate(maximumReferenceRate, maximumReferenceRate);
        assertEq(strategy.referenceRate(), maximumReferenceRate);
    }

    function test_ReferenceRateCeilingRejectsUnreachableInitialAuctions() public {
        uint256 excessiveRate = strategy.MAX_REFERENCE_RATE() + 1;
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__InvalidRate.selector);
        new AcquisitionStrategy(
            address(target),
            address(vault),
            address(voter),
            address(registry),
            address(this),
            GUARDIAN,
            address(this),
            10_000_000,
            500_000_000,
            excessiveRate
        );

        vm.expectRevert(BuybackBurnStrategy.BuybackBurnStrategy__InvalidRate.selector);
        new BuybackBurnStrategy(
            address(gbx),
            address(vault),
            address(voter),
            address(registry),
            address(this),
            GUARDIAN,
            10_000_000,
            500_000_000,
            excessiveRate
        );
    }

    function test_ZeroManagerWeightRedirectsEntireAcquisitionToVault() public {
        _activateSignal(address(strategy));
        _notifyMiningRevenue(100_000_000);
        vm.prank(MANAGER);
        staked.unstake(100 ether);
        assertEq(voter.strategyWeight(address(strategy)), 0);

        target.mint(TAKER, 125 ether);
        vm.prank(TAKER);
        target.approve(address(strategy), type(uint256).max);
        vm.prank(TAKER);
        strategy.fill(2, 100_000_000, 125 ether, TAKER, block.timestamp);

        assertEq(target.balanceOf(address(vault)), 125 ether);
        assertEq(target.balanceOf(address(rewards)), 0);
        assertEq(rewards.accountedRewards(), 0);
        assertEq(rewards.rewardPerWeightStored(), 0);
    }

    function test_CompletedFillInvalidatesBackRunAndSubsequentFillUsesNewAuction() public {
        _activateSignal(address(strategy));
        _notifyMiningRevenue(100_000_000);
        target.mint(TAKER, 100 ether);
        vm.prank(TAKER);
        target.approve(address(strategy), type(uint256).max);

        vm.prank(TAKER);
        strategy.fill(2, 10_000_000, type(uint256).max, TAKER, block.timestamp);

        vm.prank(TAKER);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__StaleAuctionId.selector, 2, 3));
        strategy.fill(2, 10_000_000, type(uint256).max, TAKER, block.timestamp);

        vm.prank(TAKER);
        strategy.fill(3, 10_000_000, type(uint256).max, TAKER, block.timestamp);
        assertEq(strategy.auctionId(), 4);
        assertEq(voter.strategyBudget(address(strategy)), 80_000_000);
    }

    function _activateSignal(address signalStrategy) private {
        address[] memory strategies = new address[](1);
        strategies[0] = signalStrategy;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1;
        vm.prank(MANAGER);
        voter.signal(strategies, weights);
        vm.warp(block.timestamp + 1 days);
        voter.checkpointUser(MANAGER);
        (bool restarted,) = signalStrategy.call(abi.encodeWithSignature("restartExpiredAuction()"));
        assertTrue(restarted);
    }

    function _deployBuyback() private returns (BuybackBurnStrategy buyback) {
        buyback = new BuybackBurnStrategy(
            address(gbx),
            address(vault),
            address(voter),
            address(registry),
            address(this),
            GUARDIAN,
            10_000_000,
            500_000_000,
            REFERENCE_RATE
        );
        strategyDeployer.attestBuyback(address(buyback));
        registry.registerStandaloneStrategy(address(buyback));
    }

    function _fundBuyback(uint256 budget) private returns (BuybackBurnStrategy buyback) {
        buyback = _deployBuyback();
        _activateSignal(address(buyback));
        _notifyMiningRevenue(budget);
        vm.prank(TAKER);
        gbx.approve(address(buyback), type(uint256).max);
    }

    function _snapshot(BuybackBurnStrategy buyback, address receiver)
        private
        view
        returns (BuybackSnapshot memory state)
    {
        state = BuybackSnapshot({
            takerGBX: gbx.balanceOf(TAKER),
            strategyGBX: gbx.balanceOf(address(buyback)),
            totalSupply: gbx.totalSupply(),
            cumulativeBurned: gbx.cumulativeBurned(),
            receiverUSDG: usdG.balanceOf(receiver),
            vaultUSDG: usdG.balanceOf(address(vault)),
            storedBudget: voter.strategyBudget(address(buyback)),
            previewBudget: voter.previewStrategyBudget(address(buyback)),
            auctionId: buyback.auctionId(),
            auctionStartTime: buyback.auctionStartTime(),
            referenceRate: buyback.referenceRate(),
            startRate: buyback.startRate(),
            floorRate: buyback.floorRate(),
            fillsPaused: buyback.fillsPaused()
        });
    }

    function _assertSnapshot(BuybackBurnStrategy buyback, address receiver, BuybackSnapshot memory expected)
        private
        view
    {
        BuybackSnapshot memory actual = _snapshot(buyback, receiver);
        assertEq(actual.takerGBX, expected.takerGBX);
        assertEq(actual.strategyGBX, expected.strategyGBX);
        assertEq(actual.totalSupply, expected.totalSupply);
        assertEq(actual.cumulativeBurned, expected.cumulativeBurned);
        assertEq(actual.receiverUSDG, expected.receiverUSDG);
        assertEq(actual.vaultUSDG, expected.vaultUSDG);
        assertEq(actual.storedBudget, expected.storedBudget);
        assertEq(actual.previewBudget, expected.previewBudget);
        assertEq(actual.auctionId, expected.auctionId);
        assertEq(actual.auctionStartTime, expected.auctionStartTime);
        assertEq(actual.referenceRate, expected.referenceRate);
        assertEq(actual.startRate, expected.startRate);
        assertEq(actual.floorRate, expected.floorRate);
        assertEq(actual.fillsPaused, expected.fillsPaused);
    }

    function _notifyMiningRevenue(uint256 amount) private {
        usdG.mint(address(vault), amount);
        sources[uint256(
                AllocationVoter.RevenueSource.MiningPool
            )].notify(voter, amount, AllocationVoter.RevenueSource.MiningPool);
    }

    function _config(address token, uint8 decimals, address strategy_, address rewards_, bool acquisitionEnabled)
        private
        returns (IAssetRegistry.AssetConfig memory)
    {
        if (strategy_ != address(0) && token != address(usdG)) {
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
