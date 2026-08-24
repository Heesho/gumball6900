// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { Strategy } from "../../src/core/Strategy.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { MockERC20, ZeroApprovalRevertingToken } from "./utils/Tokens.sol";

interface IStrategyBribeBpsSetter {
    function setBribeBps(uint256 newBribeBps) external;
}

/// @notice Test token that changes Strategy policy when Resonance transfers self-priced revenue.
contract SelfPricedCallbackToken is MockERC20 {
    IStrategyBribeBpsSetter public callbackTarget;
    address public callbackReceiver;
    uint256 public callbackBps;
    bool public callbackArmed;

    constructor() MockERC20("Self-Priced Callback", "SPC", 18) { }

    function armCallback(IStrategyBribeBpsSetter target, address receiver, uint256 newBribeBps) external {
        callbackTarget = target;
        callbackReceiver = receiver;
        callbackBps = newBribeBps;
        callbackArmed = true;
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (callbackArmed && from != address(0) && to == callbackReceiver) {
            callbackArmed = false;
            callbackTarget.setBribeBps(callbackBps);
        }
        super._update(from, to, amount);
    }
}

/// @notice Minimal Resonance stand-in used to reach branches the wired protocol cannot produce.
contract StubResonance {
    mapping(address strategy => address router) public bribeRouterFor;
    uint256 public bribeBps = 1_000;
    IERC20 public distributionToken;
    uint256 public distributionAmount;

    function distributeRevenue(address strategy) external returns (uint256 amount) {
        amount = distributionAmount;
        if (amount == 0) return 0;

        distributionAmount = 0;
        require(distributionToken.transfer(strategy, amount), "DISTRIBUTION_FAILED");
    }

    function setBribeRouter(address strategy, address router) external {
        bribeRouterFor[strategy] = router;
    }

    function setBribeBps(uint256 newBribeBps) external {
        bribeBps = newBribeBps;
    }

    function setDistribution(IERC20 token, uint256 amount) external {
        distributionToken = token;
        distributionAmount = amount;
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

    function test_BuyDoesNotRequireStrategyToApproveTheRouter() external {
        ZeroApprovalRevertingToken payment = new ZeroApprovalRevertingToken(18);
        (address strategyAddress,, address routerAddress) =
            resonance.addStrategy(IERC20(address(payment)), defaultConfig());
        Strategy strategy = Strategy(strategyAddress);
        usdg.mint(strategyAddress, 50_000_000);

        uint256 paid = _buyTarget(CAROL, strategy, payment);

        assertEq(paid, DEFAULT_INITIAL_PRICE);
        assertEq(payment.allowance(strategyAddress, routerAddress), 0);
        assertEq(payment.balanceOf(address(fund)), 9 ether);
        assertEq(payment.balanceOf(routerAddress), 1 ether);
        assertEq(usdg.balanceOf(CAROL), 50_000_000);
    }

    function test_RevenueReceiverEqualToStrategyLeavesTheRevenueForTheNextEpoch() external {
        _fundStrategy(targetStrategy, 50_000_000);
        target.mint(CAROL, DEFAULT_INITIAL_PRICE);

        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), DEFAULT_INITIAL_PRICE);
        targetStrategy.buy(address(targetStrategy), 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(targetStrategy.epochId(), 1);
        assertEq(target.balanceOf(address(fund)), 9 ether);
        assertEq(target.balanceOf(address(targetRouter)), 1 ether);
        assertEq(target.balanceOf(CAROL), 0);
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

    function test_RevenueReceiverEqualToResonanceCreatesUnscheduledSurplus() external {
        _fundStrategy(targetStrategy, 50_000_000);
        uint256 price = targetStrategy.currentPrice();
        target.mint(CAROL, price);

        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), price);
        targetStrategy.buy(address(resonance), 0, block.timestamp, price);
        vm.stopPrank();

        assertEq(usdg.balanceOf(address(resonance)), 50_000_000);
        assertEq(resonance.remainingRevenue(), 0, "direct donations do not enter the reward schedule");
    }

    function test_BuyAtomicallyIncludesRevenueReleasedThroughTheCurrentTimestamp() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _routeRevenue(604_800);

        vm.warp(block.timestamp + 1 days);
        vm.prank(CAROL);
        targetStrategy.buy(CAROL, 0, block.timestamp, type(uint256).max);

        assertEq(usdg.balanceOf(CAROL), 86_400);
        assertEq(resonance.remainingRevenue(), 518_400);
        assertEq(targetStrategy.epochId(), 1);
    }

    /*//////////////////////////////////////////////////////////////
                          ACQUISITION SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    function test_CompletePaymentSplitsInlineAndAdvancesTheEpoch() external {
        _signalDefault(ALICE, 100 ether);
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
        assertEq(target.balanceOf(address(fund)), 9 ether);
        assertEq(target.balanceOf(address(targetRouter)), 1 ether);
        assertEq(target.balanceOf(address(targetBribe)), 0, "auction proceeds never fund Bribe");
        assertEq(target.balanceOf(address(targetStrategy)), 0, "no payment dust is retained");
        assertEq(usdg.balanceOf(CAROL), 50_000_000);
        assertEq(targetStrategy.epochId(), 1);
        assertEq(targetStrategy.epochStartedAt(), block.timestamp);
        assertEq(targetStrategy.initialPrice(), 15 ether);
    }

    function test_CompletePaymentIsClassifiedRegardlessOfSignalSupply() external {
        _fundStrategy(targetStrategy, 50_000_000);

        _buyTarget(CAROL, targetStrategy, target);

        assertEq(target.balanceOf(address(fund)), 9 ether);
        assertEq(target.balanceOf(address(targetRouter)), 1 ether);
        assertEq(target.balanceOf(address(targetBribe)), 0);
    }

    function test_ADustPaymentFloorsTheBribeShareAndGoesDirectlyToFund() external {
        // The cheapest legal auction, decayed to its last second, produces a one-wei payment.
        Strategy.Config memory config =
            Strategy.Config({ initialPrice: 1e6, epochDuration: 365 days, priceMultiplier: 1.1e18, minimumPrice: 1e6 });
        (address strategyAddress, address bribeAddress, address routerAddress) =
            resonance.addStrategy(IERC20(address(target)), config);
        Strategy dustStrategy = Strategy(strategyAddress);

        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, strategyAddress);
        usdg.mint(strategyAddress, 50_000_000);

        vm.warp(DEPLOYED_AT + 365 days - 1);
        uint256 price = dustStrategy.currentPrice();
        assertEq(price, 1, "the fixture must actually reach the dust regime");

        uint256 paid = _buyTarget(CAROL, dustStrategy, target);

        assertEq(paid, 1);
        assertEq(target.balanceOf(address(fund)), 1);
        assertEq(target.balanceOf(bribeAddress), 0);
        assertEq(target.balanceOf(routerAddress), 0);
    }

    function test_AcquisitionPricedInTheRevenueTokenSettlesExactly() external {
        _signalDefault(ALICE, 100 ether);
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
        assertEq(usdg.balanceOf(address(fund)), 9 ether);
        assertEq(usdg.balanceOf(routerAddress), 1 ether);
        assertEq(usdg.balanceOf(bribeAddress), 0);
    }

    function test_SelfPricedRevenueCallbackCannotChangeTheCurrentPaymentSnapshot() external {
        StubResonance stub = new StubResonance();
        SelfPricedCallbackToken token = new SelfPricedCallbackToken();
        Strategy selfPriced =
            new Strategy(address(stub), IERC20(address(token)), IERC20(address(token)), address(fund), defaultConfig());
        address bribeBuffer = address(0xB41BE);
        stub.setBribeRouter(address(selfPriced), bribeBuffer);

        uint256 revenueAmount = 50 ether;
        token.mint(address(stub), revenueAmount);
        stub.setDistribution(IERC20(address(token)), revenueAmount);
        token.armCallback(IStrategyBribeBpsSetter(address(stub)), address(selfPriced), 2_000);
        token.mint(CAROL, DEFAULT_INITIAL_PRICE);

        vm.startPrank(CAROL);
        token.approve(address(selfPriced), DEFAULT_INITIAL_PRICE);
        selfPriced.buy(CAROL, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(stub.bribeBps(), 2_000, "the revenue callback changes policy for later purchases");
        assertEq(token.balanceOf(address(fund)), 9 ether, "the in-flight purchase retains the entry snapshot");
        assertEq(token.balanceOf(bribeBuffer), 1 ether);
        assertEq(token.balanceOf(CAROL), revenueAmount);
        assertEq(token.balanceOf(address(selfPriced)), 0);
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

    function test_GBXPaymentReachesFundInlineAndRemainsPermissionlesslyBurnable() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(gbxStrategy));
        _fundStrategy(gbxStrategy, 50_000_000);
        _mintTestGBX(BOB, DEFAULT_INITIAL_PRICE);

        uint256 supplyBefore = gbx.totalSupply();
        uint256 burnedBefore = gbx.lifetimeBurned();

        vm.startPrank(BOB);
        gbx.approve(address(gbxStrategy), DEFAULT_INITIAL_PRICE);
        gbxStrategy.buy(BOB, 0, block.timestamp, DEFAULT_INITIAL_PRICE);
        vm.stopPrank();

        assertEq(gbx.totalSupply(), supplyBefore, "Strategy settlement does not burn GBX");
        assertEq(gbx.lifetimeBurned(), burnedBefore);
        assertEq(gbx.balanceOf(address(gbxRouter)), 1 ether);
        assertEq(gbx.balanceOf(address(fund)), 9 ether);
        assertEq(gbx.balanceOf(address(gbxBribe)), 0);
        assertEq(usdg.balanceOf(BOB), 50_000_000);

        fund.burnGBX(9 ether);
        assertEq(gbx.totalSupply(), supplyBefore - 9 ether);
        assertEq(gbx.lifetimeBurned(), burnedBefore + 9 ether);
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
        assertEq(usdg.balanceOf(address(targetStrategy)), 0);
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

    /// @notice Every payment is conserved by its inline Fund transfer and floored per-purchase Bribe share.
    function testFuzz_CompletePaymentIsConservedByTheInlineSplit(uint256 offset) external {
        uint256 elapsed = bound(offset, 0, DEFAULT_EPOCH_DURATION - 1);

        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        _fundStrategy(targetStrategy, 50_000_000);

        vm.warp(DEPLOYED_AT + elapsed);
        uint256 paid = _buyTarget(CAROL, targetStrategy, target);

        uint256 expectedBribe = paid / 10;
        assertEq(target.balanceOf(address(fund)), paid - expectedBribe);
        assertEq(target.balanceOf(address(targetRouter)), expectedBribe);
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

    /// @notice A GBX payment leaves supply unchanged until its inline Fund share is burned permissionlessly.
    function testFuzz_GBXPaymentCanBeBurnedPermissionlesslyAfterInlineFundDelivery(uint256 offset) external {
        uint256 elapsed = bound(offset, 0, DEFAULT_EPOCH_DURATION);
        _fundStrategy(gbxStrategy, 50_000_000);
        vm.warp(DEPLOYED_AT + elapsed);

        uint256 price = gbxStrategy.currentPrice();
        if (price != 0) _mintTestGBX(BOB, price);
        uint256 supplyBefore = gbx.totalSupply();

        vm.startPrank(BOB);
        gbx.approve(address(gbxStrategy), price);
        uint256 paid = gbxStrategy.buy(BOB, 0, block.timestamp, price);
        vm.stopPrank();

        assertEq(paid, price);
        assertEq(gbx.totalSupply(), supplyBefore);
        uint256 expectedBribe = price / 10;
        uint256 expectedFund = price - expectedBribe;
        assertEq(gbx.balanceOf(address(fund)), expectedFund);
        assertEq(gbx.balanceOf(address(gbxRouter)), expectedBribe);

        if (expectedFund != 0) {
            fund.burnGBX(expectedFund);
            assertEq(gbx.totalSupply(), supplyBefore - expectedFund);
        }
    }

    function _deployStrategy(Strategy.Config memory config, address paymentToken) private returns (Strategy strategy) {
        return new Strategy(address(resonance), IERC20(address(usdg)), IERC20(paymentToken), address(fund), config);
    }

    function _fundStrategy(Strategy strategy, uint256 amount) private {
        usdg.mint(address(strategy), amount);
    }
}
