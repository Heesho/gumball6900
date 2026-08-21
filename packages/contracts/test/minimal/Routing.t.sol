// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import {
    FeeOnTransferToken,
    MockERC20,
    ReentrantToken,
    RevertingToken,
    StickyAllowanceToken,
    ZeroApprovalRevertingToken
} from "./utils/Tokens.sol";

/// @notice Resonance stand-in that can under-consume the router's approval, reaching the exact-pull guard.
contract PartialPullResonance {
    IERC20 public immutable usdg;
    uint256 public pullBps = 10_000;

    constructor(IERC20 usdg_) {
        usdg = usdg_;
    }

    function setPullBps(uint256 value) external {
        pullBps = value;
    }

    function notifyRevenue(uint256 amount) external {
        uint256 pulled = (amount * pullBps) / 10_000;
        if (pulled != 0) usdg.transferFrom(msg.sender, address(this), pulled);
    }

    function left(address) external pure returns (uint256) {
        return 0;
    }
}

/// @title BribeRouterTest
/// @notice Covers cumulative classification, dynamic-rate guards, and isolated permissionless settlement.
contract BribeRouterTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant KEEPER = address(0x9EE9E5);
    address private constant FUND = address(0xF0D);

    Bribe private bribe;
    BribeRouter private router;
    MockERC20 private payment;
    MockERC20 private fundStandIn;
    uint256 private currentBribeBps = 1_000;

    event PaymentRouted(address indexed strategy, uint256 amount, uint256 bribeBps);
    event FundPaymentAccrued(
        address indexed fund, address indexed paymentToken, uint256 amount, uint256 totalLiability
    );
    event BribePaymentAccrued(
        address indexed bribe, address indexed paymentToken, uint256 amount, uint256 totalLiability, uint256 remainder
    );

    function fund() external view returns (address fundAddress) {
        return address(fundStandIn);
    }

    function bribeBps() external view returns (uint256 basisPoints) {
        return currentBribeBps;
    }

    function setUp() external {
        vm.warp(365 days);
        payment = new MockERC20("Payment", "PAY", 18);
        fundStandIn = new MockERC20("Fund Stand In", "FSI", 18);

        // The test contract plays both Resonance (for the Bribe) and Strategy (for the router).
        bribe = new Bribe(address(this));
        bribe.addRewardToken(address(payment));
        router = new BribeRouter(address(this), address(this), bribe, IERC20(address(payment)), address(fundStandIn));
    }

    function test_ConstructorRejectsZeroAndEOADependencies() external {
        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(0), address(this), bribe, IERC20(address(payment)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), address(0), bribe, IERC20(address(payment)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), address(this), Bribe(address(0)), IERC20(address(payment)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), address(this), bribe, IERC20(address(0)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), address(this), bribe, IERC20(address(payment)), address(0));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(ALICE, address(this), bribe, IERC20(address(payment)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), ALICE, bribe, IERC20(address(payment)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), address(this), bribe, IERC20(ALICE), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), address(this), bribe, IERC20(address(payment)), ALICE);
    }

    function test_RoutePaymentIsStrategyOnly() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(BribeRouter.NotStrategy.selector, ALICE));
        router.routePayment(1 ether);
    }

    function test_RoutePaymentRejectsZero() external {
        vm.expectRevert(BribeRouter.ZeroAmount.selector);
        router.routePayment(0);
    }

    function test_RoutePaymentRejectsAMalformedRateBeforePaymentTokenInteraction() external {
        currentBribeBps = router.BPS() + 1;
        payment.mint(address(this), 10 ether);
        payment.approve(address(router), 10 ether);

        vm.expectRevert(abi.encodeWithSelector(BribeRouter.BribeBpsAboveBasis.selector, uint256(10_001)));
        router.routePayment(10 ether);

        assertEq(payment.balanceOf(address(this)), 10 ether);
        assertEq(payment.balanceOf(address(router)), 0);
        assertEq(payment.allowance(address(this), address(router)), 10 ether);
        assertEq(router.accountedPaymentBalance(), 0);
    }

    function test_RoutePaymentRejectsAFeeOnTransferToken() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(18);
        BribeRouter feeRouter =
            new BribeRouter(address(this), address(this), bribe, IERC20(address(feeToken)), address(fundStandIn));

        feeToken.mint(address(this), 10 ether);
        feeToken.approve(address(feeRouter), 10 ether);
        feeToken.setFeeBps(100);

        vm.expectRevert(
            abi.encodeWithSelector(
                BribeRouter.InexactTransfer.selector, 10 ether, 10 ether, (10 ether * 9_900) / 10_000
            )
        );
        feeRouter.routePayment(10 ether);
    }

    function test_CompletePaymentIsClassifiedNinetyTenEvenWithLiveSignalWeight() external {
        assertEq(router.BPS(), 10_000);
        assertEq(currentBribeBps, 1_000);

        bribe.deposit(100 ether, ALICE);
        payment.mint(address(this), 70 ether);
        payment.approve(address(router), 70 ether);

        vm.expectEmit(true, false, false, true);
        emit PaymentRouted(address(this), 70 ether, 1_000);
        vm.expectEmit(true, true, false, true);
        emit FundPaymentAccrued(address(fundStandIn), address(payment), 63 ether, 63 ether);
        vm.expectEmit(true, true, false, true);
        emit BribePaymentAccrued(address(bribe), address(payment), 7 ether, 7 ether, 0);
        router.routePayment(70 ether);

        assertEq(router.fundPaymentLiability(), 63 ether);
        assertEq(router.bribePaymentLiability(), 7 ether);
        assertEq(router.accountedPaymentBalance(), 70 ether);
        assertEq(payment.balanceOf(address(bribe)), 0, "Bribe settlement remains pull-based");
    }

    function test_PayingFundIsPermissionlessAndClearsTheLiability() external {
        payment.mint(address(this), 10 ether);
        payment.approve(address(router), 10 ether);
        router.routePayment(10 ether);

        vm.prank(KEEPER);
        assertEq(router.payFundPayment(), 9 ether);

        assertEq(payment.balanceOf(address(fundStandIn)), 9 ether);
        assertEq(router.fundPaymentLiability(), 0);
        assertEq(router.bribePaymentLiability(), 1 ether);
        assertEq(router.accountedPaymentBalance(), 1 ether);
    }

    function test_NotifyingBribeIsPermissionlessExactAndClearsOnlyItsLeg() external {
        bribe.deposit(100 ether, ALICE);
        payment.mint(address(this), 10 ether);
        payment.approve(address(router), 10 ether);
        router.routePayment(10 ether);

        vm.prank(KEEPER);
        assertEq(router.notifyBribeReward(), 1 ether);

        assertEq(router.fundPaymentLiability(), 9 ether);
        assertEq(router.bribePaymentLiability(), 0);
        assertEq(router.accountedPaymentBalance(), 9 ether);
        assertEq(payment.balanceOf(address(bribe)), 1 ether);
        assertEq(bribe.accountedRewardBalance(address(payment)), 1 ether);
        assertEq(payment.allowance(address(router), address(bribe)), 0);
    }

    /// @notice A lifetime-cap rejection rolls back the Bribe leg while leaving the Fund leg independently payable.
    function test_LifetimeRewardCapFailurePreservesRouterStateAndFundSettlement() external {
        uint256 maximum = bribe.MAX_LIFETIME_REWARD_AMOUNT();
        payment.mint(address(this), maximum);
        payment.approve(address(bribe), maximum);
        bribe.notifyRewardAmount(address(payment), maximum);

        payment.mint(address(this), 10 ether);
        payment.approve(address(router), 10 ether);
        router.routePayment(10 ether);

        vm.prank(KEEPER);
        vm.expectRevert(
            abi.encodeWithSelector(
                Bribe.RewardLifetimeCapExceeded.selector, address(payment), maximum, uint256(1 ether), maximum
            )
        );
        router.notifyBribeReward();

        assertEq(router.fundPaymentLiability(), 9 ether);
        assertEq(router.bribePaymentLiability(), 1 ether);
        assertEq(router.accountedPaymentBalance(), 10 ether);
        assertEq(payment.balanceOf(address(router)), 10 ether);
        assertEq(payment.allowance(address(router), address(bribe)), 0);
        assertEq(bribe.lifetimeRewardNotified(address(payment)), maximum);

        vm.prank(KEEPER);
        assertEq(router.payFundPayment(), 9 ether);
        assertEq(payment.balanceOf(address(fundStandIn)), 9 ether);
        assertEq(router.fundPaymentLiability(), 0);
        assertEq(router.bribePaymentLiability(), 1 ether);
        assertEq(router.accountedPaymentBalance(), 1 ether);
        assertEq(payment.balanceOf(address(router)), 1 ether);
        assertEq(payment.allowance(address(router), address(bribe)), 0);
    }

    function test_DirectRouterDonationsRemainUnaccountedSurplus() external {
        payment.mint(address(router), 10 ether);

        assertEq(router.paymentSurplus(), 10 ether);
        assertEq(router.fundPaymentLiability(), 0);
        assertEq(router.bribePaymentLiability(), 0);
        assertEq(router.accountedPaymentBalance(), 0);
    }

    function test_TenOneUnitPaymentsDoNotStarveTheBribe() external {
        payment.mint(address(this), 10);
        payment.approve(address(router), 10);
        for (uint256 i; i < 10; ++i) {
            router.routePayment(1);
        }

        assertEq(router.fundPaymentLiability(), 9);
        assertEq(router.bribePaymentLiability(), 1);
        assertEq(router.splitRemainder(), 0);
        assertEq(router.accountedPaymentBalance(), 10);
    }

    function test_MaxUintPaymentUsesFullPrecisionAtTheMaximumRate() external {
        currentBribeBps = 2_000;
        uint256 amount = type(uint256).max;
        payment.mint(address(this), amount);
        payment.approve(address(router), amount);

        router.routePayment(amount);

        uint256 expectedBribe = amount / 5;
        assertEq(router.bribePaymentLiability(), expectedBribe);
        assertEq(router.fundPaymentLiability(), amount - expectedBribe);
        assertEq(router.splitRemainder(), mulmod(amount, 2_000, 10_000));
        assertEq(router.accountedPaymentBalance(), amount);
    }

    function test_AFailureOnEitherSettlementLegDoesNotBlockOrCorruptTheOther() external {
        RevertingToken hostile = new RevertingToken(18);
        Bribe hostileBribe = new Bribe(address(this));
        hostileBribe.addRewardToken(address(hostile));
        BribeRouter hostileRouter = new BribeRouter(
            address(this), address(this), hostileBribe, IERC20(address(hostile)), address(fundStandIn)
        );

        hostile.mint(address(this), 20 ether);
        hostile.approve(address(hostileRouter), 20 ether);
        hostileRouter.routePayment(10 ether);

        hostile.setBlocked(address(fundStandIn), true);
        vm.expectRevert("BLOCKED");
        hostileRouter.payFundPayment();
        assertEq(hostileRouter.notifyBribeReward(), 1 ether);
        assertEq(hostileRouter.fundPaymentLiability(), 9 ether);
        assertEq(hostileRouter.bribePaymentLiability(), 0);

        hostile.setBlocked(address(fundStandIn), false);
        hostileRouter.routePayment(10 ether);
        hostile.setBlocked(address(hostileBribe), true);
        assertEq(hostileRouter.payFundPayment(), 18 ether);
        vm.expectRevert("BLOCKED");
        hostileRouter.notifyBribeReward();
        assertEq(hostileRouter.fundPaymentLiability(), 0);
        assertEq(hostileRouter.bribePaymentLiability(), 1 ether);
        assertEq(hostileRouter.accountedPaymentBalance(), 1 ether);

        hostile.setBlocked(address(hostileBribe), false);
        assertEq(hostileRouter.notifyBribeReward(), 1 ether);
        assertEq(hostileRouter.accountedPaymentBalance(), 0);
    }

    function test_BribeNotificationClearsAStickyResidualAllowance() external {
        StickyAllowanceToken sticky = new StickyAllowanceToken(18);
        Bribe stickyBribe = new Bribe(address(this));
        stickyBribe.addRewardToken(address(sticky));
        BribeRouter stickyRouter =
            new BribeRouter(address(this), address(this), stickyBribe, IERC20(address(sticky)), address(fundStandIn));

        sticky.mint(address(this), 10 ether);
        sticky.approve(address(stickyRouter), 10 ether);
        stickyRouter.routePayment(10 ether);
        stickyRouter.notifyBribeReward();

        assertEq(sticky.allowance(address(stickyRouter), address(stickyBribe)), 0);
        assertEq(sticky.balanceOf(address(stickyBribe)), 1 ether);
    }

    /// @notice A payment-token callback cannot recursively consume or corrupt the Bribe liability.
    function test_BribeNotificationRejectsReentrancyAndStillVerifiesExactDeltas() external {
        ReentrantToken hostile = new ReentrantToken(18);
        Bribe hostileBribe = new Bribe(address(this));
        hostileBribe.addRewardToken(address(hostile));
        BribeRouter hostileRouter = new BribeRouter(
            address(this), address(this), hostileBribe, IERC20(address(hostile)), address(fundStandIn)
        );

        hostileBribe.deposit(100 ether, ALICE);
        hostile.mint(address(this), 10 ether);
        hostile.approve(address(hostileRouter), 10 ether);
        hostileRouter.routePayment(10 ether);
        hostile.arm(address(hostileRouter), abi.encodeCall(BribeRouter.notifyBribeReward, ()));

        assertEq(hostileRouter.notifyBribeReward(), 1 ether);

        assertEq(hostile.callCount(), 1);
        assertFalse(hostile.lastCallSucceeded());
        assertEq(_selectorOf(hostile.lastReturnData()), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(hostileRouter.bribePaymentLiability(), 0);
        assertEq(hostileRouter.fundPaymentLiability(), 9 ether);
        assertEq(hostileRouter.accountedPaymentBalance(), 9 ether);
        assertEq(hostile.balanceOf(address(hostileBribe)), 1 ether);
    }

    /// @notice Every routed payment is exactly conserved through independently settled 90/10 liabilities.
    function testFuzz_RoutingConservesEveryUnit(uint256 amount, bool payFundNow, bool notifyBribeNow) external {
        uint256 routed = bound(amount, 1, 1e30);

        payment.mint(address(this), routed);
        payment.approve(address(router), routed);
        router.routePayment(routed);
        if (payFundNow) router.payFundPayment();
        if (notifyBribeNow && router.bribePaymentLiability() != 0) router.notifyBribeReward();

        uint256 total = payment.balanceOf(address(router)) + payment.balanceOf(address(fundStandIn));
        total += payment.balanceOf(address(bribe));
        assertEq(total, routed);
        assertEq(router.accountedPaymentBalance(), router.fundPaymentLiability() + router.bribePaymentLiability());
        assertEq(router.fundPaymentLiability() + router.bribePaymentLiability(), payment.balanceOf(address(router)));
        assertLt(router.splitRemainder(), router.BPS());
    }

    /// @notice Classification depends only on cumulative payment, never on how an adversary chunks fills.
    function testFuzz_ClassificationIsFrequencyIndependent(uint256 amount, uint8 chunkSeed) external {
        uint256 routed = bound(amount, 1, 1e24);
        uint256 chunks = bound(uint256(chunkSeed), 1, 64);
        if (chunks > routed) chunks = routed;

        payment.mint(address(this), routed);
        payment.approve(address(router), routed);
        uint256 share = routed / chunks;
        uint256 remainder = routed % chunks;
        for (uint256 i; i < chunks; ++i) {
            router.routePayment(share + (i < remainder ? 1 : 0));
        }

        uint256 expectedBribe = routed / 10;
        assertEq(router.bribePaymentLiability(), expectedBribe);
        assertEq(router.fundPaymentLiability(), routed - expectedBribe);
        assertEq(router.splitRemainder(), (routed % 10) * 1_000);
    }

    function _selectorOf(bytes memory revertData) private pure returns (bytes4 selector) {
        if (revertData.length < 4) return bytes4(0);
        assembly ("memory-safe") {
            selector := mload(add(revertData, 0x20))
        }
    }
}

/// @title ResonanceRouterTest
/// @notice Covers permissionless exact USDG forwarding.
contract ResonanceRouterTest is ProtocolFixture {
    event RevenueRouted(address indexed caller, uint256 amount);

    function setUp() external {
        _deployProtocol();
    }

    function test_ConstructorRejectsZeroAndEOADependencies() external {
        vm.expectRevert(ResonanceRouter.ZeroAddress.selector);
        new ResonanceRouter(IERC20(address(0)), address(resonance));

        vm.expectRevert(ResonanceRouter.ZeroAddress.selector);
        new ResonanceRouter(IERC20(address(usdg)), address(0));

        vm.expectRevert(ResonanceRouter.ZeroAddress.selector);
        new ResonanceRouter(IERC20(ALICE), address(resonance));

        vm.expectRevert(ResonanceRouter.ZeroAddress.selector);
        new ResonanceRouter(IERC20(address(usdg)), ALICE);
    }

    function test_RouteRejectsAnEmptyRouter() external {
        vm.prank(KEEPER);
        vm.expectRevert(ResonanceRouter.NoRevenue.selector);
        resonanceRouter.route();
    }

    function test_RouteIsPermissionlessAndForwardsTheCompleteBalance() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));
        usdg.mint(address(resonanceRouter), 100_000_000);

        vm.prank(KEEPER);
        vm.expectEmit(true, false, false, true);
        emit RevenueRouted(KEEPER, 100_000_000);
        assertEq(resonanceRouter.route(), 100_000_000);

        assertEq(resonanceRouter.pendingRevenue(), 0);
        assertEq(usdg.allowance(address(resonanceRouter), address(resonance)), 0, "no approval may survive");
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
    }

    function test_RouteSupportsARevenueTokenThatRejectsZeroApprovals() external {
        ZeroApprovalRevertingToken revenue = new ZeroApprovalRevertingToken(6);
        PartialPullResonance receiver = new PartialPullResonance(IERC20(address(revenue)));
        ResonanceRouter router = new ResonanceRouter(IERC20(address(revenue)), address(receiver));
        revenue.mint(address(router), 100_000_000);

        assertEq(router.route(), 100_000_000);

        assertEq(revenue.allowance(address(router), address(receiver)), 0);
        assertEq(revenue.balanceOf(address(receiver)), 100_000_000);
    }

    function test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies() external {
        usdg.mint(address(resonanceRouter), 100_000); // 0.10 USDG

        vm.prank(KEEPER);
        assertEq(resonanceRouter.route(), 100_000);
        assertEq(resonanceRouter.pendingRevenue(), 0);
        assertEq(usdg.balanceOf(address(resonance)), 100_000);

        usdg.mint(address(resonanceRouter), 1);
        vm.prank(DAVE);
        assertEq(resonanceRouter.route(), 0);
        assertEq(resonanceRouter.pendingRevenue(), 1);

        usdg.mint(address(resonanceRouter), 99_999);
        vm.prank(DAVE);
        assertEq(resonanceRouter.route(), 100_000);
        assertEq(resonanceRouter.pendingRevenue(), 0);
        assertEq(resonance.left(address(usdg)), 200_000);
    }

    function test_ZeroSignalRevenueBecomesUnallocatedResonanceSurplus() external {
        usdg.mint(address(resonanceRouter), 42_000_000);
        vm.prank(DAVE);
        resonanceRouter.route();

        vm.warp(block.timestamp + resonance.DURATION());
        assertEq(resonance.left(address(usdg)), 0);
        assertEq(resonance.earned(address(targetStrategy), address(usdg)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 42_000_000);
    }

    function test_RouteRevertsIfResonanceLeavesRevenueBehind() external {
        PartialPullResonance underPuller = new PartialPullResonance(IERC20(address(usdg)));
        ResonanceRouter partialRouter = new ResonanceRouter(IERC20(address(usdg)), address(underPuller));
        underPuller.setPullBps(5_000);

        usdg.mint(address(partialRouter), 100_000_000);

        vm.expectRevert(abi.encodeWithSelector(ResonanceRouter.RevenueRetained.selector, 50_000_000));
        partialRouter.route();
    }

    /// @notice Routing is exactly conservative for any balance and any signal configuration.
    function testFuzz_RoutingIsExactlyConservative(uint256 amount, bool withSignals) external {
        uint256 revenue = bound(amount, 1, 1e15);
        if (withSignals) {
            _signalDefault(ALICE, 100 ether);
            _signalOne(ALICE, address(targetStrategy));
        }

        usdg.mint(address(resonanceRouter), revenue);
        vm.prank(KEEPER);
        resonanceRouter.route();

        assertEq(
            resonanceRouter.pendingRevenue() + usdg.balanceOf(address(resonance)) + usdg.balanceOf(address(fund)),
            revenue
        );
    }
}
