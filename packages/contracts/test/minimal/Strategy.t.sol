// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { Strategy } from "../../src/core/Strategy.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken, MockERC20 } from "./utils/Tokens.sol";

/// @notice Minimal Resonance stand-in used to reach branches the wired protocol cannot produce.
contract StubResonance {
    uint256 public bribeBps;
    mapping(address strategy => address router) public bribeRouterFor;

    function setBribeBps(uint256 value) external {
        bribeBps = value;
    }

    function setBribeRouter(address strategy, address router) external {
        bribeRouterFor[strategy] = router;
    }
}

/// @title StrategyTest
/// @notice Exhaustive coverage of the reverse Dutch auction: bounds, decay, settlement splits, and price carry-over.
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
        new Strategy(address(0), IERC20(address(usdg)), IERC20(address(target)), address(fund), _acquisition(), config);
    }

    function test_ConstructorRejectsZeroTokensAndFund() external {
        Strategy.Config memory config = defaultConfig();

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(
            address(resonance), IERC20(address(0)), IERC20(address(target)), address(fund), _acquisition(), config
        );

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(
            address(resonance), IERC20(address(usdg)), IERC20(address(0)), address(fund), _acquisition(), config
        );

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(
            address(resonance), IERC20(address(usdg)), IERC20(address(target)), address(0), _acquisition(), config
        );
    }

    function test_ConstructorRejectsEOADependencies() external {
        Strategy.Config memory config = defaultConfig();

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(ALICE, IERC20(address(usdg)), IERC20(address(target)), address(fund), _acquisition(), config);

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(resonance), IERC20(ALICE), IERC20(address(target)), address(fund), _acquisition(), config);

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(resonance), IERC20(address(usdg)), IERC20(ALICE), address(fund), _acquisition(), config);

        vm.expectRevert(Strategy.ZeroAddress.selector);
        new Strategy(address(resonance), IERC20(address(usdg)), IERC20(address(target)), ALICE, _acquisition(), config);
    }

    function test_ConstructorRejectsAnInitialPriceBelowTheMinimum() external {
        Strategy.Config memory config = defaultConfig();
        config.minimumPrice = 2 ether;
        config.initialPrice = 2 ether - 1;

        vm.expectRevert(abi.encodeWithSelector(Strategy.InitialPriceOutOfRange.selector, 2 ether - 1));
        _deployStrategy(config, _acquisition(), address(target));
    }

    function test_ConstructorRejectsAnInitialPriceAboveTheAbsoluteMaximum() external {
        Strategy.Config memory config = defaultConfig();
        config.initialPrice = MAX_PRICE + 1;

        vm.expectRevert(abi.encodeWithSelector(Strategy.InitialPriceOutOfRange.selector, MAX_PRICE + 1));
        _deployStrategy(config, _acquisition(), address(target));
    }

    function test_ConstructorEnforcesTheEpochDurationWindow() external {
        Strategy.Config memory config = defaultConfig();

        config.epochDuration = 1 hours - 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.EpochDurationOutOfRange.selector, 1 hours - 1));
        _deployStrategy(config, _acquisition(), address(target));

        config.epochDuration = 365 days + 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.EpochDurationOutOfRange.selector, 365 days + 1));
        _deployStrategy(config, _acquisition(), address(target));

        config.epochDuration = 1 hours;
        assertEq(_deployStrategy(config, _acquisition(), address(target)).epochDuration(), 1 hours);

        config.epochDuration = 365 days;
        assertEq(_deployStrategy(config, _acquisition(), address(target)).epochDuration(), 365 days);
    }

    function test_ConstructorEnforcesThePriceMultiplierWindow() external {
        Strategy.Config memory config = defaultConfig();

        config.priceMultiplier = 1.1e18 - 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.PriceMultiplierOutOfRange.selector, 1.1e18 - 1));
        _deployStrategy(config, _acquisition(), address(target));

        config.priceMultiplier = 3e18 + 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.PriceMultiplierOutOfRange.selector, 3e18 + 1));
        _deployStrategy(config, _acquisition(), address(target));

        config.priceMultiplier = 1.1e18;
        assertEq(_deployStrategy(config, _acquisition(), address(target)).priceMultiplier(), 1.1e18);

        config.priceMultiplier = 3e18;
        assertEq(_deployStrategy(config, _acquisition(), address(target)).priceMultiplier(), 3e18);
    }

    function test_ConstructorEnforcesTheMinimumPriceWindow() external {
        Strategy.Config memory config = defaultConfig();

        config.minimumPrice = 1e6 - 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.MinimumPriceOutOfRange.selector, 1e6 - 1));
        _deployStrategy(config, _acquisition(), address(target));

        config.minimumPrice = MAX_PRICE + 1;
        config.initialPrice = MAX_PRICE + 1;
        vm.expectRevert(abi.encodeWithSelector(Strategy.InitialPriceOutOfRange.selector, MAX_PRICE + 1));
        _deployStrategy(config, _acquisition(), address(target));
    }

    function test_ConstructorRejectsABuybackPricedInAnythingButGBX() external {
        Strategy.Config memory config = defaultConfig();

        vm.expectRevert(abi.encodeWithSelector(Strategy.InvalidBuybackToken.selector, address(target)));
        _deployStrategy(config, Strategy.Kind.Buyback, address(target));
    }

    function test_ConstructorSeedsTheFirstEpochAtDeploymentTime() external view {
        assertEq(acquisitionStrategy.epochId(), 0);
        assertEq(acquisitionStrategy.initialPrice(), DEFAULT_INITIAL_PRICE);
        assertEq(acquisitionStrategy.epochStartedAt(), DEPLOYED_AT);
        assertEq(uint8(acquisitionStrategy.kind()), uint8(Strategy.Kind.Acquisition));
        assertEq(uint8(buybackStrategy.kind()), uint8(Strategy.Kind.Buyback));
    }

    /*//////////////////////////////////////////////////////////////
                              PRICE DECAY
    //////////////////////////////////////////////////////////////*/

    function test_PriceDecaysLinearlyToZeroAcrossTheEpoch() external {
        assertEq(acquisitionStrategy.currentPrice(), DEFAULT_INITIAL_PRICE);

        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION / 4);
        assertEq(acquisitionStrategy.currentPrice(), (DEFAULT_INITIAL_PRICE * 3) / 4);

        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION / 2);
        assertEq(acquisitionStrategy.currentPrice(), DEFAULT_INITIAL_PRICE / 2);

        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION - 1);
        assertGt(acquisitionStrategy.currentPrice(), 0);

        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);
        assertEq(acquisitionStrategy.currentPrice(), 0);
    }

    function test_PriceStaysAtZeroLongAfterTheEpochEnds() external {
        vm.warp(DEPLOYED_AT + 4_000 days);
        assertEq(acquisitionStrategy.currentPrice(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            BUY VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_BuyRejectsAZeroRevenueReceiver() external {
        _fundStrategy(acquisitionStrategy, 50_000_000);

        vm.prank(CAROL);
        vm.expectRevert(Strategy.ZeroAddress.selector);
        acquisitionStrategy.buy(address(0), 0, block.timestamp, type(uint256).max);
    }

    function test_BuyRejectsAPassedDeadline() external {
        _fundStrategy(acquisitionStrategy, 50_000_000);

        vm.prank(CAROL);
        vm.expectRevert(abi.encodeWithSelector(Strategy.DeadlinePassed.selector, block.timestamp - 1));
        acquisitionStrategy.buy(CAROL, 0, block.timestamp - 1, type(uint256).max);
    }

    function test_BuyRejectsAStaleEpochId() external {
        _fundStrategy(acquisitionStrategy, 50_000_000);

        vm.prank(CAROL);
        vm.expectRevert(abi.encodeWithSelector(Strategy.EpochIdMismatch.selector, 1, 0));
        acquisitionStrategy.buy(CAROL, 1, block.timestamp, type(uint256).max);
    }

    function test_BuyRejectsAnEmptyStrategy() external {
        vm.prank(CAROL);
        vm.expectRevert(Strategy.EmptyRevenue.selector);
        acquisitionStrategy.buy(CAROL, 0, block.timestamp, type(uint256).max);
    }

    function test_BuyRejectsAPaymentAboveTheBuyersLimit() external {
        _fundStrategy(acquisitionStrategy, 50_000_000);

        vm.prank(CAROL);
        vm.expectRevert(
            abi.encodeWithSelector(Strategy.MaximumPaymentExceeded.selector, DEFAULT_INITIAL_PRICE, 1 ether)
        );
        acquisitionStrategy.buy(CAROL, 0, block.timestamp, 1 ether);
    }

    function test_BuyRejectsAFeeOnTransferPaymentToken() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(18);
        (address strategyAddress,,) =
            resonance.addStrategy(IERC20(address(feeToken)), Strategy.Kind.Acquisition, defaultConfig());
        Strategy feeStrategy = Strategy(strategyAddress);

        usdg.mint(strategyAddress, 50_000_000);
        feeToken.mint(CAROL, DEFAULT_INITIAL_PRICE);
        feeToken.setFeeBps(100);

        vm.startPrank(CAROL);
        feeToken.approve(strategyAddress, DEFAULT_INITIAL_PRICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                Strategy.InexactPayment.selector, DEFAULT_INITIAL_PRICE, (DEFAULT_INITIAL_PRICE * 9_900) / 10_000
            )
        );
        feeStrategy.buy(CAROL, 0, block.timestamp, type(uint256).max);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                          ACQUISITION SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    function test_AcquisitionSplitsNinetyTenAndAdvancesTheEpoch() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        _fundStrategy(acquisitionStrategy, 50_000_000);

        target.mint(CAROL, DEFAULT_INITIAL_PRICE);
        vm.startPrank(CAROL);
        target.approve(address(acquisitionStrategy), DEFAULT_INITIAL_PRICE);
        vm.expectEmit(true, true, true, true);
        emit Purchased(CAROL, CAROL, 0, 50_000_000, DEFAULT_INITIAL_PRICE);
        uint256 paid = acquisitionStrategy.buy(CAROL, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(paid, DEFAULT_INITIAL_PRICE);
        assertEq(target.balanceOf(address(fund)), 9 ether);
        assertEq(target.balanceOf(address(acquisitionBribe)), 1 ether);
        assertEq(target.balanceOf(address(acquisitionStrategy)), 0, "no payment dust is retained");
        assertEq(usdg.balanceOf(CAROL), 50_000_000);
        assertEq(acquisitionStrategy.epochId(), 1);
        assertEq(acquisitionStrategy.epochStartedAt(), block.timestamp);
        assertEq(acquisitionStrategy.initialPrice(), 15 ether);
    }

    function test_AcquisitionWithZeroBribeShareSendsEverythingToFund() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        resonance.setBribeBps(0);
        _fundStrategy(acquisitionStrategy, 50_000_000);

        _buyAcquisition(CAROL, acquisitionStrategy, target);

        assertEq(target.balanceOf(address(fund)), DEFAULT_INITIAL_PRICE);
        assertEq(target.balanceOf(address(acquisitionBribe)), 0);
    }

    function test_AcquisitionAtTheGovernanceCeilingSplitsFiftyFifty() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        resonance.setBribeBps(resonance.MAX_BRIBE_BPS());
        _fundStrategy(acquisitionStrategy, 50_000_000);

        _buyAcquisition(CAROL, acquisitionStrategy, target);

        assertEq(target.balanceOf(address(fund)), DEFAULT_INITIAL_PRICE / 2);
        assertEq(target.balanceOf(address(acquisitionBribe)), DEFAULT_INITIAL_PRICE / 2);
    }

    function test_AcquisitionReturnsTheBribeShareToFundWithNoSignalers() external {
        _fundStrategy(acquisitionStrategy, 50_000_000);

        _buyAcquisition(CAROL, acquisitionStrategy, target);

        assertEq(target.balanceOf(address(fund)), DEFAULT_INITIAL_PRICE);
        assertEq(target.balanceOf(address(acquisitionBribe)), 0);
        assertEq(target.balanceOf(address(acquisitionRouter)), 0, "the router must never retain the share");
    }

    function test_ADustPaymentRoundsTheBribeShareToZeroAndSendsItAllToFund() external {
        // The cheapest legal auction, decayed to its last second, produces a one-wei payment.
        Strategy.Config memory config =
            Strategy.Config({ initialPrice: 1e6, epochDuration: 365 days, priceMultiplier: 1.1e18, minimumPrice: 1e6 });
        (address strategyAddress, address bribeAddress, address routerAddress) =
            resonance.addStrategy(IERC20(address(target)), Strategy.Kind.Acquisition, config);
        Strategy dustStrategy = Strategy(strategyAddress);

        _stake(ALICE, 100 ether);
        _signalOne(ALICE, strategyAddress);
        usdg.mint(strategyAddress, 50_000_000);

        vm.warp(DEPLOYED_AT + 365 days - 1);
        uint256 price = dustStrategy.currentPrice();
        assertEq(price, 1, "the fixture must actually reach the dust regime");

        uint256 paid = _buyAcquisition(CAROL, dustStrategy, target);

        assertEq(paid, 1);
        assertEq(target.balanceOf(address(fund)), 1, "rounding favors Fund, never the void");
        assertEq(target.balanceOf(bribeAddress), 0);
        assertEq(target.balanceOf(routerAddress), 0);
    }

    function test_AcquisitionPricedInTheRevenueTokenSettlesExactly() external {
        _stake(ALICE, 100 ether);
        (address strategyAddress,,) =
            resonance.addStrategy(IERC20(address(usdg)), Strategy.Kind.Acquisition, defaultConfig());
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
        assertEq(usdg.balanceOf(address(fund)), 9 ether);
    }

    function test_AcquisitionRevertsWhenTheBribeRouterIsUnset() external {
        StubResonance stub = new StubResonance();
        stub.setBribeBps(1_000);

        Strategy orphan = new Strategy(
            address(stub),
            IERC20(address(usdg)),
            IERC20(address(target)),
            address(fund),
            _acquisition(),
            defaultConfig()
        );

        usdg.mint(address(orphan), 50_000_000);
        target.mint(CAROL, DEFAULT_INITIAL_PRICE);

        vm.startPrank(CAROL);
        target.approve(address(orphan), DEFAULT_INITIAL_PRICE);
        vm.expectRevert(Strategy.ZeroAddress.selector);
        orphan.buy(CAROL, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                           BUYBACK SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    function test_BuybackBurnsTheEntirePaymentAndPaysNoSignalRewards() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(buybackStrategy));
        _fundStrategy(buybackStrategy, 50_000_000);
        _mintGBX(BOB, DEFAULT_INITIAL_PRICE);

        uint256 supplyBefore = gbx.totalSupply();
        uint256 burnedBefore = gbx.lifetimeBurned();

        vm.startPrank(BOB);
        gbx.approve(address(buybackStrategy), DEFAULT_INITIAL_PRICE);
        buybackStrategy.buy(BOB, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), supplyBefore - DEFAULT_INITIAL_PRICE);
        assertEq(gbx.lifetimeBurned(), burnedBefore + DEFAULT_INITIAL_PRICE);
        assertEq(gbx.balanceOf(address(fund)), 0, "the buyback must burn atomically, never accumulate");
        assertEq(gbx.balanceOf(address(buybackBribe)), 0);
        assertEq(usdg.balanceOf(BOB), 50_000_000);
    }

    function test_BuybackIgnoresTheGovernanceBribeShareEntirely() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(buybackStrategy));
        resonance.setBribeBps(resonance.MAX_BRIBE_BPS());
        _fundStrategy(buybackStrategy, 50_000_000);
        _mintGBX(BOB, DEFAULT_INITIAL_PRICE);

        uint256 supplyBefore = gbx.totalSupply();
        vm.startPrank(BOB);
        gbx.approve(address(buybackStrategy), DEFAULT_INITIAL_PRICE);
        buybackStrategy.buy(BOB, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), supplyBefore - DEFAULT_INITIAL_PRICE);
        assertEq(gbx.balanceOf(address(buybackBribe)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            PRICE CARRY-OVER
    //////////////////////////////////////////////////////////////*/

    function test_AFreeFillAtFullDecayRestartsAtTheConfiguredFloor() external {
        _fundStrategy(acquisitionStrategy, 50_000_000);
        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION);

        vm.prank(CAROL);
        uint256 paid = acquisitionStrategy.buy(CAROL, 0, block.timestamp, 0);

        assertEq(paid, 0, "a fully decayed epoch is free");
        assertEq(usdg.balanceOf(CAROL), 50_000_000);
        assertEq(acquisitionStrategy.initialPrice(), DEFAULT_MINIMUM_PRICE);
        assertEq(target.balanceOf(address(fund)), 0);
    }

    function test_TheNextStartingPriceIsFlooredAtTheConfiguredMinimum() external {
        _fundStrategy(acquisitionStrategy, 50_000_000);

        // Buying very late produces a payment whose multiplied value is still below the floor.
        vm.warp(DEPLOYED_AT + DEFAULT_EPOCH_DURATION - 1);
        _buyAcquisition(CAROL, acquisitionStrategy, target);

        assertGe(acquisitionStrategy.initialPrice(), DEFAULT_MINIMUM_PRICE);
    }

    function test_TheNextStartingPriceIsCappedAtTheAbsoluteMaximum() external {
        Strategy.Config memory config = defaultConfig();
        config.initialPrice = MAX_PRICE;
        config.priceMultiplier = 3e18;
        (address strategyAddress,,) = resonance.addStrategy(IERC20(address(target)), Strategy.Kind.Acquisition, config);
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
        _fundStrategy(acquisitionStrategy, 50_000_000);
        uint256 firstPaid = _buyAcquisition(CAROL, acquisitionStrategy, target);

        _fundStrategy(acquisitionStrategy, 50_000_000);
        uint256 secondPaid = _buyAcquisition(DAVE, acquisitionStrategy, target);

        assertEq(firstPaid, DEFAULT_INITIAL_PRICE);
        assertEq(secondPaid, (DEFAULT_INITIAL_PRICE * 3) / 2, "no decay elapses within one block");
        assertEq(acquisitionStrategy.epochId(), 2);
    }

    function test_DonatedPaymentTokensAreStrandedWithNoRescuePath() external {
        _fundStrategy(acquisitionStrategy, 50_000_000);
        target.mint(address(acquisitionStrategy), 77 ether);

        _buyAcquisition(CAROL, acquisitionStrategy, target);

        // Settlement only moves the exact payment, so an unsolicited donation stays put permanently.
        assertEq(target.balanceOf(address(acquisitionStrategy)), 77 ether);
    }

    function test_DonatedRevenueTokensAreSoldWithTheRestOfTheEpoch() external {
        _fundStrategy(acquisitionStrategy, 50_000_000);
        usdg.mint(address(acquisitionStrategy), 25_000_000);

        _buyAcquisition(CAROL, acquisitionStrategy, target);

        assertEq(usdg.balanceOf(CAROL), 75_000_000);
        assertEq(acquisitionStrategy.availableRevenue(), 0);
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
        uint256 earlyPrice = acquisitionStrategy.currentPrice();
        vm.warp(DEPLOYED_AT + later);
        uint256 latePrice = acquisitionStrategy.currentPrice();

        assertLe(latePrice, earlyPrice);
        assertLe(earlyPrice, DEFAULT_INITIAL_PRICE);
    }

    /// @notice The exact decay formula holds at every point in the epoch.
    function testFuzz_PriceMatchesTheExactLinearFormula(uint256 offset) external {
        uint256 elapsed = bound(offset, 0, DEFAULT_EPOCH_DURATION - 1);
        vm.warp(DEPLOYED_AT + elapsed);

        uint256 expected = DEFAULT_INITIAL_PRICE - Math.mulDiv(DEFAULT_INITIAL_PRICE, elapsed, DEFAULT_EPOCH_DURATION);
        assertEq(acquisitionStrategy.currentPrice(), expected);
    }

    /// @notice Every acquisition payment is split without creating or destroying a single wei.
    function testFuzz_AcquisitionSplitConservesThePaymentExactly(uint256 bribeShare, uint256 offset) external {
        uint256 shareBps = bound(bribeShare, 0, resonance.MAX_BRIBE_BPS());
        uint256 elapsed = bound(offset, 0, DEFAULT_EPOCH_DURATION - 1);

        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(acquisitionStrategy));
        resonance.setBribeBps(shareBps);
        _fundStrategy(acquisitionStrategy, 50_000_000);

        vm.warp(DEPLOYED_AT + elapsed);
        uint256 paid = _buyAcquisition(CAROL, acquisitionStrategy, target);

        uint256 fundShare = target.balanceOf(address(fund));
        uint256 bribeShareHeld =
            target.balanceOf(address(acquisitionBribe)) + target.balanceOf(address(acquisitionRouter));
        assertEq(fundShare + bribeShareHeld, paid, "the split must be exactly conservative");
        assertEq(target.balanceOf(address(acquisitionStrategy)), 0);
        assertGe(fundShare, paid - Math.mulDiv(paid, shareBps, 10_000));
    }

    /// @notice Whatever the fill price, the next starting price stays inside its immutable bounds.
    function testFuzz_NextStartingPriceStaysWithinItsBounds(uint256 offset, uint256 multiplier) external {
        Strategy.Config memory config = defaultConfig();
        config.priceMultiplier = bound(multiplier, 1.1e18, 3e18);
        (address strategyAddress,,) = resonance.addStrategy(IERC20(address(target)), Strategy.Kind.Acquisition, config);
        Strategy subject = Strategy(strategyAddress);

        usdg.mint(strategyAddress, 50_000_000);
        vm.warp(DEPLOYED_AT + bound(offset, 0, 2 * DEFAULT_EPOCH_DURATION));
        _buyAcquisition(CAROL, subject, target);

        assertGe(subject.initialPrice(), config.minimumPrice);
        assertLe(subject.initialPrice(), subject.ABSOLUTE_MAXIMUM_PRICE());
    }

    /// @notice A buyback burns exactly what the buyer paid, for any fill price.
    function testFuzz_BuybackBurnsExactlyThePayment(uint256 offset) external {
        uint256 elapsed = bound(offset, 0, DEFAULT_EPOCH_DURATION);
        _fundStrategy(buybackStrategy, 50_000_000);
        vm.warp(DEPLOYED_AT + elapsed);

        uint256 price = buybackStrategy.currentPrice();
        if (price != 0) _mintGBX(BOB, price);
        uint256 supplyBefore = gbx.totalSupply();

        vm.startPrank(BOB);
        gbx.approve(address(buybackStrategy), price);
        uint256 paid = buybackStrategy.buy(BOB, 0, block.timestamp, price);
        vm.stopPrank();

        assertEq(paid, price);
        assertEq(gbx.totalSupply(), supplyBefore - price);
        assertEq(gbx.balanceOf(address(fund)), 0);
    }

    function _acquisition() private pure returns (Strategy.Kind kind) {
        return Strategy.Kind.Acquisition;
    }

    function _deployStrategy(Strategy.Config memory config, Strategy.Kind kind, address paymentToken)
        private
        returns (Strategy strategy)
    {
        return
            new Strategy(address(resonance), IERC20(address(usdg)), IERC20(paymentToken), address(fund), kind, config);
    }

    function _fundStrategy(Strategy strategy, uint256 amount) private {
        usdg.mint(address(strategy), amount);
    }
}
