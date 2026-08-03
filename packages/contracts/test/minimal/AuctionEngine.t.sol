// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { StdStorage, stdStorage } from "forge-std/StdStorage.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { AuctionEngine } from "../../src/strategies/AuctionEngine.sol";
import { MinimalAuctionHarness } from "./mocks/StrategyTestMocks.sol";

/// @dev Executable test-only reference for give.fun Auction.sol at
/// ef6ee14a454432210d13e312d0ef825f670bd79d (pinned file SHA-256 in NOTICE).
/// It expresses the same transitions independently with Math.mulDiv and a ternary clamp.
library PinnedGiveFunAuctionReference {
    function price(uint256 initPrice, uint256 elapsed, uint256 epochPeriod) internal pure returns (uint256) {
        if (elapsed > epochPeriod) return 0;
        return initPrice - Math.mulDiv(initPrice, elapsed, epochPeriod);
    }

    function nextPrice(uint256 paymentAmount, uint256 multiplier, uint256 minimum, uint256 maximum)
        internal
        pure
        returns (uint256)
    {
        uint256 multiplied = Math.mulDiv(paymentAmount, multiplier, 1e18);
        return multiplied < minimum ? minimum : multiplied > maximum ? maximum : multiplied;
    }
}

contract MinimalAuctionEngineTest is Test {
    using stdStorage for StdStorage;

    uint256 private constant MIN_PRICE = 1_000_000;
    uint256 private constant MAX_PRICE = type(uint192).max;
    uint256 private constant MIN_MULTIPLIER = 1.1e18;
    uint256 private constant MAX_MULTIPLIER = 3e18;
    uint256 private constant EPOCH = 1 hours;

    function setUp() public {
        vm.warp(1_000_000);
    }

    function test_ConstructorAcceptsEveryExactBoundary() external {
        MinimalAuctionHarness minimum = new MinimalAuctionHarness(MIN_PRICE, 1 hours, MIN_MULTIPLIER, MIN_PRICE);
        assertEq(minimum.initPrice(), MIN_PRICE);
        assertEq(minimum.epochPeriod(), 1 hours);
        assertEq(minimum.priceMultiplier(), MIN_MULTIPLIER);
        assertEq(minimum.minInitPrice(), MIN_PRICE);

        MinimalAuctionHarness maximum = new MinimalAuctionHarness(MAX_PRICE, 365 days, MAX_MULTIPLIER, MAX_PRICE);
        assertEq(maximum.initPrice(), MAX_PRICE);
        assertEq(maximum.epochPeriod(), 365 days);
        assertEq(maximum.priceMultiplier(), MAX_MULTIPLIER);
        assertEq(maximum.minInitPrice(), MAX_PRICE);
    }

    function test_ConstructorRejectsValuesImmediatelyOutsideBounds() external {
        vm.expectRevert(AuctionEngine.AuctionEngine__InitPriceOutOfRange.selector);
        new MinimalAuctionHarness(MIN_PRICE - 1, EPOCH, MIN_MULTIPLIER, MIN_PRICE);

        vm.expectRevert(AuctionEngine.AuctionEngine__InitPriceOutOfRange.selector);
        new MinimalAuctionHarness(MAX_PRICE + 1, EPOCH, MIN_MULTIPLIER, MIN_PRICE);

        vm.expectRevert(AuctionEngine.AuctionEngine__EpochPeriodOutOfRange.selector);
        new MinimalAuctionHarness(MIN_PRICE, 1 hours - 1, MIN_MULTIPLIER, MIN_PRICE);

        vm.expectRevert(AuctionEngine.AuctionEngine__EpochPeriodOutOfRange.selector);
        new MinimalAuctionHarness(MIN_PRICE, 365 days + 1, MIN_MULTIPLIER, MIN_PRICE);

        vm.expectRevert(AuctionEngine.AuctionEngine__PriceMultiplierOutOfRange.selector);
        new MinimalAuctionHarness(MIN_PRICE, EPOCH, MIN_MULTIPLIER - 1, MIN_PRICE);

        vm.expectRevert(AuctionEngine.AuctionEngine__PriceMultiplierOutOfRange.selector);
        new MinimalAuctionHarness(MIN_PRICE, EPOCH, MAX_MULTIPLIER + 1, MIN_PRICE);

        vm.expectRevert(AuctionEngine.AuctionEngine__MinInitPriceOutOfRange.selector);
        new MinimalAuctionHarness(MIN_PRICE, EPOCH, MIN_MULTIPLIER, MIN_PRICE - 1);

        // The authoritative validation order rejects an above-maximum minimum through the init-price check first.
        vm.expectRevert(AuctionEngine.AuctionEngine__InitPriceOutOfRange.selector);
        new MinimalAuctionHarness(MAX_PRICE, EPOCH, MIN_MULTIPLIER, MAX_PRICE + 1);
    }

    function test_PriceUsesExactPinnedBoundaryAndRoundingVectors() external {
        MinimalAuctionHarness auction = new MinimalAuctionHarness(3_600_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);
        auction.activate();
        uint256 startedAt = auction.startTime();

        assertEq(auction.getPrice(), 3_600_000);
        vm.warp(startedAt + EPOCH - 1);
        assertEq(auction.getPrice(), 1_000);
        vm.warp(startedAt + EPOCH);
        assertEq(auction.getPrice(), 0);
        vm.warp(startedAt + EPOCH + 1);
        assertEq(auction.getPrice(), 0);
    }

    function testFuzz_DifferentialPriceMatchesPinnedGiveFun(
        uint192 rawInitPrice,
        uint32 rawEpochPeriod,
        uint32 rawElapsed
    ) external {
        uint256 initPrice = bound(uint256(rawInitPrice), MIN_PRICE, MAX_PRICE);
        uint256 epochPeriod = bound(uint256(rawEpochPeriod), 1 hours, 365 days);
        uint256 elapsed = bound(uint256(rawElapsed), 0, epochPeriod + 1);
        MinimalAuctionHarness auction = new MinimalAuctionHarness(initPrice, epochPeriod, MIN_MULTIPLIER, MIN_PRICE);
        auction.activate();
        uint256 startedAt = auction.startTime();

        vm.warp(startedAt + elapsed);
        assertEq(auction.getPrice(), PinnedGiveFunAuctionReference.price(initPrice, elapsed, epochPeriod));
    }

    function testFuzz_DifferentialAdvanceMatchesPinnedGiveFun(
        uint192 rawPayment,
        uint64 rawMultiplier,
        uint192 rawMinimum
    ) external {
        uint256 payment = bound(uint256(rawPayment), 0, MAX_PRICE);
        uint256 multiplier = bound(uint256(rawMultiplier), MIN_MULTIPLIER, MAX_MULTIPLIER);
        uint256 minimum = bound(uint256(rawMinimum), MIN_PRICE, MAX_PRICE);
        MinimalAuctionHarness auction = new MinimalAuctionHarness(MAX_PRICE, EPOCH, multiplier, minimum);
        auction.activate();

        auction.advance(payment);
        assertEq(auction.initPrice(), PinnedGiveFunAuctionReference.nextPrice(payment, multiplier, minimum, MAX_PRICE));
        assertEq(auction.epochId(), 1);
        assertEq(auction.startTime(), block.timestamp);
    }

    function test_QuoteAcceptsDeadlineAndMaximumEquality() external {
        MinimalAuctionHarness auction = new MinimalAuctionHarness(3_600_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);
        auction.activate();
        uint256 payment = auction.getPrice();

        assertEq(auction.quote(0, block.timestamp, payment), payment);

        vm.expectRevert(AuctionEngine.AuctionEngine__MaxPaymentAmountExceeded.selector);
        auction.quote(0, block.timestamp, payment - 1);
    }

    function test_QuoteRejectsDeadlineOneSecondPastAndEpochMismatch() external {
        MinimalAuctionHarness auction = new MinimalAuctionHarness(3_600_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);
        auction.activate();

        vm.expectRevert(AuctionEngine.AuctionEngine__DeadlinePassed.selector);
        auction.quote(0, block.timestamp - 1, type(uint256).max);

        vm.expectRevert(AuctionEngine.AuctionEngine__EpochIdMismatch.selector);
        auction.quote(1, block.timestamp, type(uint256).max);
    }

    function test_NextPriceFloorsMultiplicationAndClampsAtBothBounds() external {
        MinimalAuctionHarness rounded = new MinimalAuctionHarness(2_000_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);
        rounded.activate();
        rounded.advance(1_000_001);
        assertEq(rounded.initPrice(), 1_100_001);

        MinimalAuctionHarness minimum = new MinimalAuctionHarness(2_000_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);
        minimum.activate();
        minimum.advance(0);
        assertEq(minimum.initPrice(), MIN_PRICE);

        MinimalAuctionHarness maximum = new MinimalAuctionHarness(MAX_PRICE, EPOCH, MAX_MULTIPLIER, MIN_PRICE);
        maximum.activate();
        maximum.advance(MAX_PRICE);
        assertEq(maximum.initPrice(), MAX_PRICE);
    }

    function test_ZeroPriceFillIsAllowedAndOnlyOneFillCanConsumeAnEpoch() external {
        MinimalAuctionHarness auction = new MinimalAuctionHarness(3_600_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);
        auction.activate();
        vm.warp(auction.startTime() + EPOCH);

        assertEq(auction.fill(0, block.timestamp, 0), 0);
        assertEq(auction.epochId(), 1);
        assertEq(auction.initPrice(), MIN_PRICE);
        assertEq(auction.startTime(), block.timestamp);

        vm.expectRevert(AuctionEngine.AuctionEngine__EpochIdMismatch.selector);
        auction.fill(0, block.timestamp, type(uint256).max);
    }

    function test_ConstructionDoesNotStartAuctionAndActivationIsOneTime() external {
        MinimalAuctionHarness auction = new MinimalAuctionHarness(3_600_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);

        assertEq(auction.startTime(), 0);
        vm.expectRevert(AuctionEngine.AuctionEngine__NotActivated.selector);
        auction.getPrice();
        vm.expectRevert(AuctionEngine.AuctionEngine__NotActivated.selector);
        auction.fill(0, block.timestamp, type(uint256).max);

        auction.activate();
        assertEq(auction.startTime(), block.timestamp);
        assertEq(auction.getPrice(), 3_600_000);

        vm.expectRevert(AuctionEngine.AuctionEngine__AlreadyActivated.selector);
        auction.activate();
    }

    function test_AdvanceBeforeActivationAndActivationAtTimestampZeroBothFailClosed() external {
        MinimalAuctionHarness auction = new MinimalAuctionHarness(3_600_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);
        vm.expectRevert(AuctionEngine.AuctionEngine__NotActivated.selector);
        auction.advance(1);

        vm.warp(0);
        MinimalAuctionHarness genesisTimestamp = new MinimalAuctionHarness(3_600_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);
        vm.expectRevert(AuctionEngine.AuctionEngine__NotActivated.selector);
        genesisTimestamp.activate();
        assertEq(genesisTimestamp.startTime(), 0);
    }

    function test_AuditProof_UncheckedEpochCounterWrapsOnlyAtTheUint256Horizon() external {
        MinimalAuctionHarness auction = new MinimalAuctionHarness(3_600_000, EPOCH, MIN_MULTIPLIER, MIN_PRICE);
        auction.activate();
        stdstore.target(address(auction)).sig(auction.epochId.selector).checked_write(type(uint256).max);

        auction.advance(1);

        assertEq(auction.epochId(), 0);
        assertEq(auction.startTime(), block.timestamp);
    }
}
