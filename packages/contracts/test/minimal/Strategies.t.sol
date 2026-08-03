// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IAssetRegistry } from "../../src/interfaces/IAssetRegistry.sol";
import { IGBXToken } from "../../src/interfaces/IGBXToken.sol";
import { IGumBallVault } from "../../src/interfaces/IGumBallVault.sol";
import { IStrategyRewards } from "../../src/interfaces/IStrategyRewards.sol";
import { AcquisitionStrategy } from "../../src/strategies/AcquisitionStrategy.sol";
import { AuctionEngine } from "../../src/strategies/AuctionEngine.sol";
import { BuybackStrategy } from "../../src/strategies/BuybackStrategy.sol";
import {
    MinimalBehaviorToken,
    MinimalBurnableToken,
    MinimalRegistryMock,
    MinimalStrategyRewardsMock,
    MinimalVaultMock
} from "./mocks/StrategyTestMocks.sol";

contract MinimalStrategiesTest is Test {
    address private constant FILLER = address(0xB0B);
    address private constant GUARDIAN = address(0x6900);
    address private constant TIMELOCK = address(0x71E10C);

    uint256 private constant LOT = 10_000_000;
    uint256 private constant PRICE = 100 ether;
    uint256 private constant EPOCH = 1 hours;
    uint256 private constant MULTIPLIER = 1.5e18;
    uint256 private constant MIN_PRICE = 1_000_000;

    MinimalBehaviorToken private usdG;
    MinimalBehaviorToken private target;
    MinimalBurnableToken private gbx;
    MinimalRegistryMock private registry;
    MinimalVaultMock private vault;
    MinimalStrategyRewardsMock private rewards;
    AcquisitionStrategy private acquisition;
    BuybackStrategy private buyback;

    function setUp() public {
        vm.warp(1_000_000);
        usdG = new MinimalBehaviorToken("Global Dollar", "USDG", 6);
        target = new MinimalBehaviorToken("Target", "TGT", 18);
        gbx = new MinimalBurnableToken();
        registry = new MinimalRegistryMock();
        vault = new MinimalVaultMock(usdG);
        rewards = new MinimalStrategyRewardsMock(address(target));

        acquisition = new AcquisitionStrategy(
            address(usdG),
            address(target),
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            IStrategyRewards(address(rewards)),
            GUARDIAN,
            TIMELOCK,
            LOT,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );
        buyback = new BuybackStrategy(
            IGBXToken(address(gbx)),
            address(usdG),
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            GUARDIAN,
            TIMELOCK,
            LOT,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );

        vm.prank(address(registry));
        acquisition.activateAuction();
        vm.prank(address(registry));
        buyback.activateAuction();
        rewards.setStrategy(address(acquisition));
        registry.setLive(address(acquisition), true);
        registry.setLive(address(buyback), true);
        vault.setBudget(address(acquisition), 3 * LOT);
        vault.setBudget(address(buyback), 3 * LOT);
        usdG.mint(address(vault), 6 * LOT);

        target.mint(FILLER, 1_000 ether);
        gbx.mint(FILLER, 1_000 ether);
        vm.startPrank(FILLER);
        target.approve(address(acquisition), type(uint256).max);
        gbx.approve(address(buyback), type(uint256).max);
        vm.stopPrank();
    }

    function test_AcquisitionPaysTargetFirstSplitsNinetyEightTwoAndReleasesFixedLot() external {
        rewards.setTotalWeight(1);
        vault.expectAcquisitionOrder(address(target), address(rewards), 98 ether, 2 ether);

        vm.prank(FILLER);
        (uint256 quoted, uint256 observed) = acquisition.fill(0, block.timestamp, PRICE);

        assertEq(quoted, PRICE);
        assertEq(observed, PRICE);
        assertTrue(vault.acquisitionOrderChecked());
        assertEq(target.balanceOf(address(vault)), 98 ether);
        assertEq(target.balanceOf(address(rewards)), 2 ether);
        assertEq(rewards.notified(), 2 ether);
        assertEq(rewards.notificationCount(), 1);
        assertEq(usdG.balanceOf(FILLER), LOT);
        assertEq(vault.strategyBudget(address(acquisition)), 2 * LOT);
        assertEq(vault.lastReceiver(), FILLER);
        assertEq(vault.lastReleaseAmount(), LOT);
        assertEq(acquisition.epochId(), 1);
    }

    function test_ConstructionCannotAgeAuctionAndOnlyRegistryCanActivate() external {
        AcquisitionStrategy unactivated = new AcquisitionStrategy(
            address(usdG),
            address(target),
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            IStrategyRewards(address(rewards)),
            GUARDIAN,
            TIMELOCK,
            LOT,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );

        vm.warp(block.timestamp + 8 days);
        assertEq(unactivated.startTime(), 0);
        vm.expectRevert(AuctionEngine.AuctionEngine__NotActivated.selector);
        unactivated.getPrice();

        registry.setLive(address(unactivated), true);
        vm.prank(FILLER);
        vm.expectRevert(AuctionEngine.AuctionEngine__NotActivated.selector);
        unactivated.fill(0, block.timestamp, PRICE);

        vm.prank(FILLER);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__Unauthorized.selector, FILLER));
        unactivated.activateAuction();

        vm.prank(address(registry));
        unactivated.activateAuction();
        assertEq(unactivated.startTime(), block.timestamp);
        assertEq(unactivated.getPrice(), PRICE);
    }

    function test_StrategyConstructorsRejectZeroCodeLessAndZeroLotConfigurations() external {
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__ZeroAddress.selector);
        new AcquisitionStrategy(
            address(0),
            address(target),
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            IStrategyRewards(address(rewards)),
            GUARDIAN,
            TIMELOCK,
            LOT,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__InvalidConfiguration.selector);
        new AcquisitionStrategy(
            address(usdG),
            FILLER,
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            IStrategyRewards(address(rewards)),
            GUARDIAN,
            TIMELOCK,
            LOT,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__ZeroAmount.selector);
        new AcquisitionStrategy(
            address(usdG),
            address(target),
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            IStrategyRewards(address(rewards)),
            GUARDIAN,
            TIMELOCK,
            0,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );

        vm.expectRevert(BuybackStrategy.BuybackStrategy__ZeroAddress.selector);
        new BuybackStrategy(
            IGBXToken(address(0)),
            address(usdG),
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            GUARDIAN,
            TIMELOCK,
            LOT,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );
        vm.expectRevert(BuybackStrategy.BuybackStrategy__InvalidConfiguration.selector);
        new BuybackStrategy(
            IGBXToken(address(gbx)),
            FILLER,
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            GUARDIAN,
            TIMELOCK,
            LOT,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );
        vm.expectRevert(BuybackStrategy.BuybackStrategy__ZeroAmount.selector);
        new BuybackStrategy(
            IGBXToken(address(gbx)),
            address(usdG),
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            GUARDIAN,
            TIMELOCK,
            0,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );
    }

    function test_BuybackActivationIsRegistryOnly() external {
        BuybackStrategy unactivated = new BuybackStrategy(
            IGBXToken(address(gbx)),
            address(usdG),
            IGumBallVault(address(vault)),
            IAssetRegistry(address(registry)),
            GUARDIAN,
            TIMELOCK,
            LOT,
            PRICE,
            EPOCH,
            MULTIPLIER,
            MIN_PRICE
        );
        vm.prank(FILLER);
        vm.expectRevert(abi.encodeWithSelector(BuybackStrategy.BuybackStrategy__Unauthorized.selector, FILLER));
        unactivated.activateAuction();
    }

    function test_AcquisitionWithZeroWeightSendsCompleteObservedReceiptToVault() external {
        rewards.setTotalWeight(0);
        vault.expectAcquisitionOrder(address(target), address(rewards), PRICE, 0);

        vm.prank(FILLER);
        acquisition.fill(0, block.timestamp, PRICE);

        assertTrue(vault.acquisitionOrderChecked());
        assertEq(target.balanceOf(address(vault)), PRICE);
        assertEq(target.balanceOf(address(rewards)), 0);
        assertEq(rewards.notificationCount(), 0);
    }

    function testFuzz_AcquisitionSplitMatchesIndependentBasisPointModelAtEveryAuctionTime(uint32 elapsedSeed)
        external
    {
        uint256 elapsed = bound(uint256(elapsedSeed), 0, EPOCH);
        vm.warp(acquisition.startTime() + elapsed);
        uint256 quote = acquisition.getPrice();
        uint256 expectedReward = quote * acquisition.REWARD_BPS() / acquisition.BPS_DENOMINATOR();
        uint256 expectedVault = quote - expectedReward;
        rewards.setTotalWeight(1);
        vault.expectAcquisitionOrder(address(target), address(rewards), expectedVault, expectedReward);

        vm.prank(FILLER);
        (uint256 payment, uint256 observed) = acquisition.fill(0, block.timestamp, quote);

        assertEq(payment, quote);
        assertEq(observed, quote);
        assertEq(target.balanceOf(address(vault)), expectedVault);
        assertEq(target.balanceOf(address(rewards)), expectedReward);
        assertEq(rewards.notified(), expectedReward);
        assertEq(expectedVault + expectedReward, quote);
    }

    function test_AcquisitionRejectsFeeOnTransferReceiptAtomically() external {
        target.setFee(1_000, FILLER, address(acquisition));

        vm.prank(FILLER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__InexactTransfer.selector,
                address(target),
                PRICE,
                PRICE,
                90 ether
            )
        );
        acquisition.fill(0, block.timestamp, PRICE);

        assertEq(target.balanceOf(FILLER), 1_000 ether);
        assertEq(target.balanceOf(address(acquisition)), 0);
        assertEq(target.balanceOf(address(vault)), 0);
        assertEq(vault.strategyBudget(address(acquisition)), 3 * LOT);
        assertEq(acquisition.epochId(), 0);
    }

    function test_AcquisitionAllowsZeroPriceFillAndStillReleasesExactlyOneLot() external {
        vm.warp(acquisition.startTime() + EPOCH);
        uint256 targetBefore = target.balanceOf(FILLER);

        vm.prank(FILLER);
        (uint256 quoted, uint256 observed) = acquisition.fill(0, block.timestamp, 0);

        assertEq(quoted, 0);
        assertEq(observed, 0);
        assertEq(target.balanceOf(FILLER), targetBefore);
        assertEq(usdG.balanceOf(FILLER), LOT);
        assertEq(vault.strategyBudget(address(acquisition)), 2 * LOT);
        assertEq(acquisition.epochId(), 1);
        assertEq(acquisition.initPrice(), MIN_PRICE);
    }

    function test_AcquisitionPauseResumeAndLiveGatesUseNarrowAuthorities() external {
        uint256 activationTime = acquisition.startTime();
        vm.prank(FILLER);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__Unauthorized.selector, FILLER));
        acquisition.pauseFills();

        vm.prank(GUARDIAN);
        acquisition.pauseFills();
        vm.prank(FILLER);
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__FillsPaused.selector);
        acquisition.fill(0, block.timestamp, PRICE);

        vm.prank(FILLER);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionStrategy.AcquisitionStrategy__Unauthorized.selector, FILLER));
        acquisition.resumeFills();
        vm.prank(TIMELOCK);
        acquisition.resumeFills();
        assertEq(acquisition.startTime(), activationTime, "pause/resume must not restart the auction");

        registry.setLive(address(acquisition), false);
        vm.prank(FILLER);
        vm.expectRevert(AcquisitionStrategy.AcquisitionStrategy__StrategyNotLive.selector);
        acquisition.fill(0, block.timestamp, PRICE);
    }

    function test_AcquisitionRejectsPullSurchargeAboveQuoteWithoutStateDrift() external {
        target.setSurcharge(1_000, FILLER, address(acquisition));

        vm.prank(FILLER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__InexactTransfer.selector,
                address(target),
                PRICE,
                110 ether,
                PRICE
            )
        );
        acquisition.fill(0, block.timestamp, PRICE);

        assertEq(target.balanceOf(FILLER), 1_000 ether);
        assertEq(target.balanceOf(address(acquisition)), 0);
        assertEq(vault.strategyBudget(address(acquisition)), 3 * LOT);
        assertEq(acquisition.epochId(), 0);
    }

    function test_AcquisitionRejectsInexactOutgoingTransferAtomically() external {
        target.setFee(100, address(acquisition), address(vault));

        vm.prank(FILLER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcquisitionStrategy.AcquisitionStrategy__InexactTransfer.selector,
                address(target),
                PRICE,
                PRICE,
                99 ether
            )
        );
        acquisition.fill(0, block.timestamp, PRICE);

        assertEq(target.balanceOf(FILLER), 1_000 ether);
        assertEq(target.balanceOf(address(vault)), 0);
        assertEq(vault.strategyBudget(address(acquisition)), 3 * LOT);
        assertEq(acquisition.epochId(), 0);
    }

    function test_TargetCallbackCannotReenterAcquisitionFill() external {
        target.setCallback(
            FILLER,
            address(acquisition),
            address(acquisition),
            abi.encodeCall(AcquisitionStrategy.fill, (0, block.timestamp, PRICE))
        );

        vm.prank(FILLER);
        acquisition.fill(0, block.timestamp, PRICE);

        assertEq(target.callbackCount(), 1);
        assertFalse(target.lastCallbackSucceeded());
        assertEq(acquisition.epochId(), 1);
        assertEq(vault.releaseCount(), 1);
    }

    function test_BuybackRejectsFeeOnTransferReceiptBeforeBurnOrRelease() external {
        gbx.setFee(1_000, FILLER, address(buyback));
        uint256 supplyBefore = gbx.totalSupply();

        vm.prank(FILLER);
        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackStrategy.BuybackStrategy__InexactTransfer.selector, address(gbx), PRICE, PRICE, 90 ether
            )
        );
        buyback.fill(0, block.timestamp, PRICE);

        assertEq(gbx.totalBurned(), 0);
        assertEq(gbx.balanceOf(address(buyback)), 0);
        assertEq(gbx.balanceOf(FILLER), 1_000 ether);
        assertEq(gbx.totalSupply(), supplyBefore);
        assertEq(usdG.balanceOf(FILLER), 0);
        assertEq(vault.strategyBudget(address(buyback)), 3 * LOT);
        assertEq(buyback.epochId(), 0);
    }

    function test_BuybackBurnsExactStandardTokenReceiptBeforeFixedLotRelease() external {
        vault.expectBurnOrder(address(gbx), PRICE);
        uint256 supplyBefore = gbx.totalSupply();

        vm.prank(FILLER);
        (uint256 quoted, uint256 burned) = buyback.fill(0, block.timestamp, PRICE);

        assertEq(quoted, PRICE);
        assertEq(burned, PRICE);
        assertTrue(vault.burnOrderChecked());
        assertEq(gbx.totalBurned(), PRICE);
        assertEq(gbx.balanceOf(address(buyback)), 0);
        assertEq(gbx.totalSupply(), supplyBefore - PRICE);
        assertEq(usdG.balanceOf(FILLER), LOT);
        assertEq(vault.strategyBudget(address(buyback)), 2 * LOT);
        assertEq(buyback.epochId(), 1);
        assertEq(buyback.initPrice(), 150 ether);
    }

    function testFuzz_BuybackBurnMatchesEveryTimeVaryingQuote(uint32 elapsedSeed) external {
        uint256 elapsed = bound(uint256(elapsedSeed), 0, EPOCH);
        vm.warp(buyback.startTime() + elapsed);
        uint256 quote = buyback.getPrice();
        uint256 supplyBefore = gbx.totalSupply();

        vm.prank(FILLER);
        (uint256 payment, uint256 burned) = buyback.fill(0, block.timestamp, quote);

        assertEq(payment, quote);
        assertEq(burned, quote);
        assertEq(gbx.totalBurned(), quote);
        assertEq(gbx.totalSupply(), supplyBefore - quote);
        assertEq(gbx.balanceOf(address(buyback)), 0);
        assertEq(usdG.balanceOf(FILLER), LOT);
    }

    function test_BuybackAllowsZeroPriceFillWithoutBurnAndReleasesFixedLot() external {
        vm.warp(buyback.startTime() + EPOCH + 1);
        uint256 gbxBefore = gbx.balanceOf(FILLER);

        vm.prank(FILLER);
        (uint256 quoted, uint256 burned) = buyback.fill(0, block.timestamp, 0);

        assertEq(quoted, 0);
        assertEq(burned, 0);
        assertEq(gbx.balanceOf(FILLER), gbxBefore);
        assertEq(gbx.totalBurned(), 0);
        assertEq(usdG.balanceOf(FILLER), LOT);
        assertEq(vault.strategyBudget(address(buyback)), 2 * LOT);
        assertEq(buyback.initPrice(), MIN_PRICE);
    }

    function test_BuybackPauseResumeAndLiveGatesUseNarrowAuthorities() external {
        uint256 activationTime = buyback.startTime();
        vm.prank(FILLER);
        vm.expectRevert(abi.encodeWithSelector(BuybackStrategy.BuybackStrategy__Unauthorized.selector, FILLER));
        buyback.pauseFills();

        vm.prank(GUARDIAN);
        buyback.pauseFills();
        vm.prank(FILLER);
        vm.expectRevert(BuybackStrategy.BuybackStrategy__FillsPaused.selector);
        buyback.fill(0, block.timestamp, PRICE);

        vm.prank(FILLER);
        vm.expectRevert(abi.encodeWithSelector(BuybackStrategy.BuybackStrategy__Unauthorized.selector, FILLER));
        buyback.resumeFills();
        vm.prank(TIMELOCK);
        buyback.resumeFills();
        assertEq(buyback.startTime(), activationTime, "pause/resume must not restart the auction");

        registry.setLive(address(buyback), false);
        vm.prank(FILLER);
        vm.expectRevert(BuybackStrategy.BuybackStrategy__StrategyNotLive.selector);
        buyback.fill(0, block.timestamp, PRICE);
    }

    function test_BuybackRejectsPullSurchargeAboveQuoteWithoutBurnOrBudgetUse() external {
        gbx.setSurcharge(1_000, FILLER, address(buyback));

        vm.prank(FILLER);
        vm.expectRevert(
            abi.encodeWithSelector(
                BuybackStrategy.BuybackStrategy__InexactTransfer.selector, address(gbx), PRICE, 110 ether, PRICE
            )
        );
        buyback.fill(0, block.timestamp, PRICE);

        assertEq(gbx.balanceOf(FILLER), 1_000 ether);
        assertEq(gbx.totalBurned(), 0);
        assertEq(vault.strategyBudget(address(buyback)), 3 * LOT);
        assertEq(buyback.epochId(), 0);
    }

    function test_GBXCallbackCannotReenterBuybackFill() external {
        gbx.setCallback(
            FILLER,
            address(buyback),
            address(buyback),
            abi.encodeCall(BuybackStrategy.fill, (0, block.timestamp, PRICE))
        );

        vm.prank(FILLER);
        buyback.fill(0, block.timestamp, PRICE);

        assertEq(gbx.callbackCount(), 1);
        assertFalse(gbx.lastCallbackSucceeded());
        assertEq(gbx.totalBurned(), PRICE);
        assertEq(buyback.epochId(), 1);
        assertEq(vault.releaseCount(), 1);
    }

    function test_StrategyFillRejectsStaleEpochAndMaximumBelowQuote() external {
        vm.prank(FILLER);
        vm.expectRevert(AuctionEngine.AuctionEngine__EpochIdMismatch.selector);
        acquisition.fill(1, block.timestamp, PRICE);

        vm.prank(FILLER);
        vm.expectRevert(AuctionEngine.AuctionEngine__MaxPaymentAmountExceeded.selector);
        buyback.fill(0, block.timestamp, PRICE - 1);
    }
}
