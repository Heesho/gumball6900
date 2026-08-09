// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken, MockERC20 } from "./utils/Tokens.sol";

/// @notice Minimal Resonance stand-in used to reach branches the wired protocol cannot produce.
contract StubResonance {
    mapping(address strategy => address router) public bribeRouterFor;

    function setBribeRouter(address strategy, address router) external {
        bribeRouterFor[strategy] = router;
    }
}

/// @title StrategyTest
/// @notice Exhaustive coverage of the reverse Dutch auction: bounds, decay, Fund settlement, and price carry-over.
contract StrategyTest is ProtocolFixture {
    uint256 private constant MAX_PRICE = type(uint192).max;

    event Purchased(
        address indexed buyer,
        address indexed revenueReceiver,
        uint256 indexed epochId,
        uint256 revenueAmount,
        uint256 paymentAmount
    );

    function setUp() external {
        _deployProtocol();
    }

    /*//////////////////////////////////////////////////////////////
                       CONSTRUCTOR BOUND CHECKS
    //////////////////////////////////////////////////////////////*/

    function test_ConstructorRejectsZeroResonance() external {
        Strategy.Config memory config = defaultConfig();
        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(0), IERC20(address(usdg)), IERC20(address(target)), address(fund), config);
    }

    function test_ConstructorRejectsZeroTokensAndFund() external {
        Strategy.Config memory config = defaultConfig();

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(resonance), IERC20(address(0)), IERC20(address(target)), address(fund), config);

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(resonance), IERC20(address(usdg)), IERC20(address(0)), address(fund), config);

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(resonance), IERC20(address(usdg)), IERC20(address(target)), address(0), config);
    }

    function test_ConstructorRejectsEOADependencies() external {
        Strategy.Config memory config = defaultConfig();

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(ALICE, IERC20(address(usdg)), IERC20(address(target)), address(fund), config);

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(resonance), IERC20(ALICE), IERC20(address(target)), address(fund), config);

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(resonance), IERC20(address(usdg)), IERC20(ALICE), address(fund), config);

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(resonance), IERC20(address(usdg)), IERC20(address(target)), ALICE, config);
    }

    function test_ConstructorRejectsAnInitialPriceBelowTheMinimum() external {
        Strategy.Config memory config = defaultConfig();
        config.minimumPrice = 2 ether;
        config.initialPrice = 2 ether - 1;

        vm.expectRevert(abi.encodeWithSelector(Strategy.InitialPriceOutOfRange.selector, 2 ether - 1));
        _deployStrategy(config, address(target));
    }

    function test_ConstructorRejectsAnInitialPriceAboveTheAbsoluteMaximum() external {
        Strategy.Config memory config = defaultConfig();
        config.initialPrice = MAX_PRICE + 1;

        vm.expectRevert(abi.encodeWithSelector(Strategy.InitialPriceOutOfRange.selector, MAX_PRICE + 1));
        _deployStrategy(config, address(target));
    }

    function test_ConstructorEnforcesTheEpochDurationWindow() external {
        Strategy.Config memory config = defaultConfig();

        config.epochDuration = 1 hours - 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.EpochDurationOutOfRange.selector, 1 hours - 1));
        _deployStrategy(config, address(target));

        config.epochDuration = 365 days + 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.EpochDurationOutOfRange.selector, 365 days + 1));
        _deployStrategy(config, address(target));

        config.epochDuration = 1 hours;
        assertEq(_deployStrategy(config, address(target)).epochDuration(), 1 hours);

        config.epochDuration = 365 days;
        assertEq(_deployStrategy(config, address(target)).epochDuration(), 365 days);
    }

    function test_ConstructorEnforcesThePriceMultiplierWindow() external {
        Strategy.Config memory config = defaultConfig();

        config.priceMultiplier = 1.1e18 - 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.PriceMultiplierOutOfRange.selector, 1.1e18 - 1));
        _deployStrategy(config, address(target));

        config.priceMultiplier = 3e18 + 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.PriceMultiplierOutOfRange.selector, 3e18 + 1));
        _deployStrategy(config, address(target));

        config.priceMultiplier = 1.1e18;
        assertEq(_deployStrategy(config, address(target)).priceMultiplier(), 1.1e18);

        config.priceMultiplier = 3e18;
        assertEq(_deployStrategy(config, address(target)).priceMultiplier(), 3e18);
    }

    function test_ConstructorEnforcesTheMinimumPriceWindow() external {
        Strategy.Config memory config = defaultConfig();

        config.minimumPrice = 1e6 - 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.MinimumPriceOutOfRange.selector, 1e6 - 1));
        _deployStrategy(config, address(target));

        config.minimumPrice = MAX_PRICE + 1;
        config.initialPrice = MAX_PRICE + 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.InitialPriceOutOfRange.selector, MAX_PRICE + 1));
        _deployStrategy(config, address(target));
    }

    function test_ConstructorSeedsTheFirstEpochAtDeploymentTime() external view {
        assertEq(targetStrategy.epochId(), 0);
        assertEq(targetStrategy.initialPrice(), DEFAULT_INITIAL_PRICE);
        assertEq(targetStrategy.epochStartedAt(), DEPLOYED_AT);
        assertEq(gbxStrategy.epochId(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                              PRICE DECAY
    //////////////////////////////////////////////////////////////*/

    function test_PriceDecaysLinearlyToZeroAcrossTheEpoch() external {
        assertEq(targetStrategy.currentPrice(), DEFAULT_INITIAL_PRICE);

        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION / 4);
        assertEq(targetStrategy.currentPrice(), (DEFAULT_INITIAL_PRICE * 3) / 4);

        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION / 2);
        assertEq(targetStrategy.currentPrice(), DEFAULT_INITIAL_PRICE / 2);

        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION - 1);
        assertGt(targetStrategy.currentPrice(), 0);

        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);
        assertEq(targetStrategy.currentPrice(), 0);
    }

    function test_PriceStaysAtZeroLongAfterTheEpochEnds() external {
        vm.warp(DEPLOYED_AT + 4_000 days);
        assertEq(targetStrategy.currentPrice(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            BUY VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_BuyRejectsAZeroRevenueReceiver() external {
        _fundStrategy(targetStrategy, 50_000_000);

        vm.prank(CAROL);
        vm.expectRevert(Strategy.ZeroAddress.selector);
        targetStrategy.buy(address(0), 0, block.timestamp, type(uint256).max);
    }

    function test_BuyRejectsAPassedDeadline() external {
        _fundStrategy(targetStrategy, 50_000_000);

        vm.prank(CAROL);
        vm.expectRevert(abi.encodeWithSelector(Strategy.DeadlinePassed.selector, block.timestamp - 1));
        targetStrategy.buy(CAROL, 0, block.timestamp - 1, type(uint256).max);
    }

    function test_BuyRejectsAStaleEpochId() external {
        _fundStrategy(targetStrategy, 50_000_000);

        vm.prank(CAROL);
        vm.expectRevert(abi.encodeWithSelector(Strategy.EpochIdMismatch.selector, 1, 0));
        targetStrategy.buy(CAROL, 1, block.timestamp, type(uint256).max);
    }

    function test_BuyRejectsAnEmptyStrategy() external {
        vm.prank(CAROL);
        vm.expectRevert(Strategy.EmptyRevenue.selector);
        targetStrategy.buy(CAROL, 0, block.timestamp, type(uint256).max);
    }

    function test_BuyRejectsAPaymentAboveTheBuyersLimit() external {
        _fundStrategy(targetStrategy, 50_000_000);

        vm.prank(CAROL);
        vm.expectRevert(
            abi.encodeWithSelector(Strategy.MaximumPaymentExceeded.selector, DEFAULT_INITIAL_PRICE, 1 ether)
        );
        targetStrategy.buy(CAROL, 0, block.timestamp, 1 ether);
    }

    function test_BuyRejectsAFeeOnTransferPaymentToken() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(18);
        (address strategyAddress,,) = resonance.addStrategy(IERC20(address(feeToken)), defaultConfig());
        Strategy feeStrategy = Strategy(strategyAddress);

        usdg.mint(strategyAddress, 50_000_000);
        feeToken.mint(CAROL, DEFAULT_INITIAL_PRICE);
        feeToken.setFeeBps(100);

        vm.startPrank(CAROL);
        feeToken.approve(strategyAddress, DEFAULT_INITIAL_PRICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                Strategy.InexactPayment.selector,
                DEFAULT_INITIAL_PRICE,
                DEFAULT_INITIAL_PRICE,
                (DEFAULT_INITIAL_PRICE * 9_900) / 10_000
            )
        );
        feeStrategy.buy(CAROL, 0, block.timestamp, type(uint256).max);
        vm.stopPrank();
    }

    function test_RevenueReceiverEqualToStrategyFailsAtomically() external {
        _fundStrategy(targetStrategy, 50_000_000);
        target.mint(CAROL, DEFAULT_INITIAL_PRICE);

        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), DEFAULT_INITIAL_PRICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                Strategy.InexactPayout.selector, address(targetStrategy), 50_000_000, uint256(0), uint256(0)
            )
        );
        targetStrategy.buy(address(targetStrategy), 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(targetStrategy.epochId(), 0);
        assertEq(targetRouter.fundPaymentLiability(), 0);
        assertEq(target.balanceOf(CAROL), DEFAULT_INITIAL_PRICE);
        assertEq(usdg.balanceOf(address(targetStrategy)), 50_000_000);
    }

    function test_RevenueReceiverEqualToFundSettlesExactly() external {
        _fundStrategy(targetStrategy, 50_000_000);
        uint256 price = targetStrategy.currentPrice();
        target.mint(CAROL, price);

        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), price);
        targetStrategy.buy(address(fund), 0, block.timestamp, price);
        vm.stopPrank();

        assertEq(usdg.balanceOf(address(fund)), 50_000_000);
    }

    function test_RevenueReceiverEqualToResonanceCreatesSynchronizableDonation() external {
        _fundStrategy(targetStrategy, 50_000_000);
        uint256 price = targetStrategy.currentPrice();
        target.mint(CAROL, price);

        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), price);
        targetStrategy.buy(address(resonance), 0, block.timestamp, price);
        vm.stopPrank();

        assertEq(resonance.unaccountedRevenue(), 50_000_000);
        resonance.syncRevenue();
        assertEq(resonance.unaccountedRevenue(), 0);
        assertEq(resonance.fundRevenueLiability(), 50_000_000);
    }

    /*//////////////////////////////////////////////////////////////
                          ACQUISITION SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    function test_CompletePaymentBecomesFundLiabilityAndAdvancesTheEpoch() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _fundStrategy(targetStrategy, 50_000_000);

        target.mint(CAROL, DEFAULT_INITIAL_PRICE);
        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), DEFAULT_INITIAL_PRICE);
        vm.expectEmit(true, true, true, true);
        emit Purchased(CAROL, CAROL, 0, 50_000_000, DEFAULT_INITIAL_PRICE);
        uint256 paid = targetStrategy.buy(CAROL, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(paid, DEFAULT_INITIAL_PRICE);
        assertEq(targetRouter.fundPaymentLiability(), DEFAULT_INITIAL_PRICE);
        assertEq(target.balanceOf(address(targetRouter)), DEFAULT_INITIAL_PRICE);
        assertEq(target.balanceOf(address(targetBribe)), 0, "auction proceeds never fund Bribe");
        assertEq(target.balanceOf(address(targetStrategy)), 0, "no payment dust is retained");
        assertEq(usdg.balanceOf(CAROL), 50_000_000);
        assertEq(targetStrategy.epochId(), 1);
        assertEq(targetStrategy.epochStartedAt(), block.timestamp);
        assertEq(targetStrategy.initialPrice(), 15 ether);
    }

    function test_CompletePaymentGoesToFundRegardlessOfSignalSupply() external {
        _fundStrategy(targetStrategy, 50_000_000);

        _buyTarget(CAROL, targetStrategy, target);

        assertEq(targetRouter.fundPaymentLiability(), DEFAULT_INITIAL_PRICE);
        assertEq(target.balanceOf(address(targetBribe)), 0);
        assertEq(target.balanceOf(address(targetRouter)), DEFAULT_INITIAL_PRICE);
    }

    function test_ADustPaymentStillBecomesFundLiability() external {
        // The cheapest legal auction, decayed to its last second, produces a one-wei payment.
        Strategy.Config memory config =
            Strategy.Config({ initialPrice: 1e6, epochDuration: 365 days, priceMultiplier: 1.1e18, minimumPrice: 1e6 });
        (address strategyAddress, address bribeAddress, address routerAddress) =
            resonance.addStrategy(IERC20(address(target)), config);
        Strategy dustStrategy = Strategy(strategyAddress);

        _stake(ALICE, 100 ether);
        _signalOne(ALICE, strategyAddress);
        usdg.mint(strategyAddress, 50_000_000);

        vm.warp(DEPLOYED_AT + 365 days - 1);
        uint256 price = dustStrategy.currentPrice();
        assertEq(price, 1, "the fixture must actually reach the dust regime");

        uint256 paid = _buyTarget(CAROL, dustStrategy, target);

        assertEq(paid, 1);
        assertEq(BribeRouter(routerAddress).fundPaymentLiability(), 1);
        assertEq(target.balanceOf(bribeAddress), 0);
        assertEq(target.balanceOf(routerAddress), 1);
    }

    function test_AcquisitionPricedInTheRevenueTokenSettlesExactly() external {
        _stake(ALICE, 100 ether);
        (address strategyAddress, address bribeAddress, address routerAddress) =
            resonance.addStrategy(IERC20(address(usdg)), defaultConfig());
        Strategy selfPriced = Strategy(strategyAddress);
        _signalOne(ALICE, strategyAddress);

        usdg.mint(strategyAddress, 50_000_000);
        usdg.mint(CAROL, DEFAULT_INITIAL_PRICE);

        vm.startPrank(CAROL);
        usdg.approve(strategyAddress, DEFAULT_INITIAL_PRICE);
        selfPriced.buy(CAROL, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(usdg.balanceOf(strategyAddress), 0, "revenue and payment must not co-mingle");
        assertEq(usdg.balanceOf(CAROL), 50_000_000);
        assertEq(BribeRouter(routerAddress).fundPaymentLiability(), DEFAULT_INITIAL_PRICE);
        assertEq(usdg.balanceOf(bribeAddress), 0);
    }

    function test_AcquisitionRevertsWhenTheBribeRouterIsUnset() external {
        StubResonance stub = new StubResonance();

        Strategy orphan =
            new Strategy(address(stub), IERC20(address(usdg)), IERC20(address(target)), address(fund), defaultConfig());

        usdg.mint(address(orphan), 50_000_000);
        target.mint(CAROL, DEFAULT_INITIAL_PRICE);

        vm.startPrank(CAROL);
        target.approve(address(orphan), DEFAULT_INITIAL_PRICE);
        vm.expectRevert(Strategy.ZeroAddress.selector);
        orphan.buy(CAROL, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                            GBX SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    function test_GBXPaymentWaitsInRouterUntilFundDeliveryAndPermissionlessBurn() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(gbxStrategy));
        _fundStrategy(gbxStrategy, 50_000_000);
        _mintGBX(BOB, DEFAULT_INITIAL_PRICE);

        uint256 supplyBefore = gbx.totalSupply();
        uint256 burnedBefore = gbx.lifetimeBurned();

        vm.startPrank(BOB);
        gbx.approve(address(gbxStrategy), DEFAULT_INITIAL_PRICE);
        gbxStrategy.buy(BOB, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), supplyBefore, "Strategy settlement does not burn GBX");
        assertEq(gbx.lifetimeBurned(), burnedBefore);
        assertEq(gbxRouter.fundPaymentLiability(), DEFAULT_INITIAL_PRICE);
        assertEq(gbx.balanceOf(address(gbxRouter)), DEFAULT_INITIAL_PRICE);
        assertEq(gbx.balanceOf(address(fund)), 0);
        assertEq(gbx.balanceOf(address(gbxBribe)), 0);
        assertEq(usdg.balanceOf(BOB), 50_000_000);

        gbxRouter.payFundPayment();
        assertEq(gbx.balanceOf(address(fund)), DEFAULT_INITIAL_PRICE);
        assertEq(gbx.totalSupply(), supplyBefore, "Fund receipt does not burn GBX");

        fund.burnGBX(DEFAULT_INITIAL_PRICE);
        assertEq(gbx.totalSupply(), supplyBefore - DEFAULT_INITIAL_PRICE);
        assertEq(gbx.lifetimeBurned(), burnedBefore + DEFAULT_INITIAL_PRICE);
        assertEq(gbx.balanceOf(address(fund)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            PRICE CARRY-OVER
    //////////////////////////////////////////////////////////////*/

    function test_AFreeFillAtFullDecayRestartsAtTheConfiguredFloor() external {
        _fundStrategy(targetStrategy, 50_000_000);
        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);

        vm.prank(CAROL);
        uint256 paid = targetStrategy.buy(CAROL, 0, block.timestamp, 0);

        assertEq(paid, 0, "a fully decayed epoch is free");
        assertEq(usdg.balanceOf(CAROL), 50_000_000);
        assertEq(targetStrategy.initialPrice(), DEFAULT_MINIMUM_PRICE);
        assertEq(target.balanceOf(address(fund)), 0);
    }

    function test_TheNextStartingPriceIsFlooredAtTheConfiguredMinimum() external {
        _fundStrategy(targetStrategy, 50_000_000);

        // Buying very late produces a payment whose multiplied value is still below the floor.
        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION - 1);
        _buyTarget(CAROL, targetStrategy, target);

        assertGe(targetStrategy.initialPrice(), DEFAULT_MINIMUM_PRICE);
    }

    function test_TheNextStartingPriceIsCappedAtTheAbsoluteMaximum() external {
        Strategy.Config memory config = defaultConfig();
        config.initialPrice = MAX_PRICE;
        config.priceMultiplier = 3e18;
        (address strategyAddress,,) = resonance.addStrategy(IERC20(address(target)), config);
        Strategy extreme = Strategy(strategyAddress);

        usdg.mint(strategyAddress, 50_000_000);
        target.mint(CAROL, MAX_PRICE);

        vm.startPrank(CAROL);
        target.approve(strategyAddress, MAX_PRICE);
        extreme.buy(CAROL, 0, block.timestamp, MAX_PRICE);
        vm.stopPrank();

        assertEq(extreme.initialPrice(), MAX_PRICE, "three times the maximum must clamp, not overflow");
    }

    function test_ConsecutiveFillsInTheSameBlockPayTheFullEscalatedPrice() external {
        _fundStrategy(targetStrategy, 50_000_000);
        uint256 firstPaid = _buyTarget(CAROL, targetStrategy, target);

        _fundStrategy(targetStrategy, 50_000_000);
        uint256 secondPaid = _buyTarget(DAVE, targetStrategy, target);

        assertEq(firstPaid, DEFAULT_INITIAL_PRICE);
        assertEq(secondPaid, (DEFAULT_INITIAL_PRICE * 3) / 2, "no decay elapses within one block");
        assertEq(targetStrategy.epochId(), 2);
    }

    function test_DonatedPaymentTokensAreStrandedWithNoRescuePath() external {
        _fundStrategy(targetStrategy, 50_000_000);
        target.mint(address(targetStrategy), 77 ether);

        _buyTarget(CAROL, targetStrategy, target);

        // Settlement only moves the exact payment, so an unsolicited donation stays put permanently.
        assertEq(target.balanceOf(address(targetStrategy)), 77 ether);
    }

    function test_DonatedRevenueTokensAreSoldWithTheRestOfTheEpoch() external {
        _fundStrategy(targetStrategy, 50_000_000);
        usdg.mint(address(targetStrategy), 25_000_000);

        _buyTarget(CAROL, targetStrategy, target);

        assertEq(usdg.balanceOf(CAROL), 75_000_000);
        assertEq(targetStrategy.availableRevenue(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @notice The price is exactly linear and never rises inside an epoch.
    function testFuzz_PriceIsMonotonicallyNonIncreasingWithinAnEpoch(uint256 firstOffset, uint256 secondOffset)
        external
    {
        uint256 earlier = bound(firstOffset, 0, 2 * DEFAULT_EPOCH_DURATION);
        uint256 later = bound(secondOffset, earlier, 2 * DEFAULT_EPOCH_DURATION);

        vm.warp(DEPLOYED_AT + earlier);
        uint256 earlyPrice = targetStrategy.currentPrice();
        vm.warp(DEPLOYED_AT + later);
        uint256 latePrice = targetStrategy.currentPrice();

        assertLe(latePrice, earlyPrice);
        assertLe(earlyPrice, DEFAULT_INITIAL_PRICE);
    }

    /// @notice The exact decay formula holds at every point in the epoch.
    function testFuzz_PriceMatchesTheExactLinearFormula(uint256 offset) external {
        uint256 elapsed = bound(offset, 0, DEFAULT_EPOCH_DURATION - 1);
        vm.warp(DEPLOYED_AT + elapsed);

        uint256 expected = DEFAULT_INITIAL_PRICE - Math.mulDiv(DEFAULT_INITIAL_PRICE, elapsed, DEFAULT_EPOCH_DURATION);
        assertEq(targetStrategy.currentPrice(), expected);
    }

    /// @notice Every payment becomes an exactly conserved Fund liability.
    function testFuzz_CompletePaymentIsConservedAsFundLiability(uint256 offset) external {
        uint256 elapsed = bound(offset, 0, DEFAULT_EPOCH_DURATION - 1);

        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _fundStrategy(targetStrategy, 50_000_000);

        vm.warp(DEPLOYED_AT + elapsed);
        uint256 paid = _buyTarget(CAROL, targetStrategy, target);

        assertEq(targetRouter.fundPaymentLiability(), paid);
        assertEq(target.balanceOf(address(targetRouter)), paid);
        assertEq(target.balanceOf(address(targetBribe)), 0);
        assertEq(target.balanceOf(address(targetStrategy)), 0);
    }

    /// @notice Whatever the fill price, the next starting price stays inside its immutable bounds.
    function testFuzz_NextStartingPriceStaysWithinItsBounds(uint256 offset, uint256 multiplier) external {
        Strategy.Config memory config = defaultConfig();
        config.priceMultiplier = bound(multiplier, 1.1e18, 3e18);
        (address strategyAddress,,) = resonance.addStrategy(IERC20(address(target)), config);
        Strategy subject = Strategy(strategyAddress);

        usdg.mint(strategyAddress, 50_000_000);
        vm.warp(DEPLOYED_AT + bound(offset, 0, 2 * DEFAULT_EPOCH_DURATION));
        _buyTarget(CAROL, subject, target);

        assertGe(subject.initialPrice(), config.minimumPrice);
        assertLe(subject.initialPrice(), subject.ABSOLUTE_MAXIMUM_PRICE());
    }

    /// @notice A GBX payment leaves supply unchanged until Fund delivery and a separate permissionless burn.
    function testFuzz_GBXPaymentCanBeBurnedPermissionlesslyAfterFundDelivery(uint256 offset) external {
        uint256 elapsed = bound(offset, 0, DEFAULT_EPOCH_DURATION);
        _fundStrategy(gbxStrategy, 50_000_000);
        vm.warp(DEPLOYED_AT + elapsed);

        uint256 price = gbxStrategy.currentPrice();
        if (price != 0) _mintGBX(BOB, price);
        uint256 supplyBefore = gbx.totalSupply();

        vm.startPrank(BOB);
        gbx.approve(address(gbxStrategy), price);
        uint256 paid = gbxStrategy.buy(BOB, 0, block.timestamp, price);
        vm.stopPrank();

        assertEq(paid, price);
        assertEq(gbx.totalSupply(), supplyBefore);
        assertEq(gbxRouter.fundPaymentLiability(), price);

        if (price != 0) {
            gbxRouter.payFundPayment();
            assertEq(gbx.balanceOf(address(fund)), price);
            fund.burnGBX(price);
            assertEq(gbx.totalSupply(), supplyBefore - price);
        }
    }

    function _deployStrategy(Strategy.Config memory config, address paymentToken) private returns (Strategy strategy) {
        return new Strategy(address(resonance), IERC20(address(usdg)), IERC20(paymentToken), address(fund), config);
    }

    function _fundStrategy(Strategy strategy, uint256 amount) private {
        usdg.mint(address(strategy), amount);
    }
}
