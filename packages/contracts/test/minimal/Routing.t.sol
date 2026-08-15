// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken, MockERC20, ZeroApprovalRevertingToken } from "./utils/Tokens.sol";

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
/// @notice Covers the fixed Fund-only payment route paired with every Strategy.
contract BribeRouterTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant KEEPER = address(0x9EE9E5);
    address private constant FUND = address(0xF0D);

    Bribe private bribe;
    BribeRouter private router;
    MockERC20 private payment;
    MockERC20 private fundStandIn;

    event PaymentRouted(address indexed strategy, uint256 amount);
    event FundPaymentAccrued(
        address indexed fund, address indexed paymentToken, uint256 amount, uint256 totalLiability
    );

    function fund() external view returns (address fundAddress) {
        return address(fundStandIn);
    }

    function setUp() external {
        vm.warp(365 days);
        payment = new MockERC20("Payment", "PAY", 18);
        fundStandIn = new MockERC20("Fund Stand In", "FSI", 18);

        // The test contract plays both Resonance (for the Bribe) and Strategy (for the router).
        bribe = new Bribe(address(this));
        bribe.addRewardToken(address(payment));
        router = new BribeRouter(address(this), bribe, IERC20(address(payment)), address(fundStandIn));
    }

    function test_ConstructorRejectsZeroAndEOADependencies() external {
        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(0), bribe, IERC20(address(payment)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), Bribe(address(0)), IERC20(address(payment)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), bribe, IERC20(address(0)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), bribe, IERC20(address(payment)), address(0));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(ALICE, bribe, IERC20(address(payment)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), bribe, IERC20(ALICE), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), bribe, IERC20(address(payment)), ALICE);
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

    function test_RoutePaymentRejectsAFeeOnTransferToken() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(18);
        BribeRouter feeRouter = new BribeRouter(address(this), bribe, IERC20(address(feeToken)), address(fundStandIn));

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

    function test_CompletePaymentBecomesFundLiabilityEvenWithLiveSignalWeight() external {
        bribe.deposit(100 ether, ALICE);
        payment.mint(address(this), 70 ether);
        payment.approve(address(router), 70 ether);

        vm.expectEmit(true, false, false, true);
        emit PaymentRouted(address(this), 70 ether);
        vm.expectEmit(true, true, false, true);
        emit FundPaymentAccrued(address(fundStandIn), address(payment), 70 ether, 70 ether);
        router.routePayment(70 ether);

        assertEq(router.fundPaymentLiability(), 70 ether);
        assertEq(router.accountedPaymentBalance(), 70 ether);
        assertEq(payment.balanceOf(address(bribe)), 0, "auction payments never fund Bribe");
    }

    function test_PayingFundIsPermissionlessAndClearsTheLiability() external {
        payment.mint(address(this), 10 ether);
        payment.approve(address(router), 10 ether);
        router.routePayment(10 ether);

        vm.prank(KEEPER);
        assertEq(router.payFundPayment(), 10 ether);

        assertEq(payment.balanceOf(address(fundStandIn)), 10 ether);
        assertEq(router.fundPaymentLiability(), 0);
        assertEq(router.accountedPaymentBalance(), 0);
    }

    function test_DirectRouterDonationsRemainUnaccountedSurplus() external {
        payment.mint(address(router), 10 ether);

        assertEq(router.paymentSurplus(), 10 ether);
        assertEq(router.fundPaymentLiability(), 0);
    }

    /// @notice Every routed payment is conserved and remains entirely Fund-bound.
    function testFuzz_RoutingConservesEveryUnit(uint256 amount, bool payNow) external {
        uint256 routed = bound(amount, 1, 1e30);

        payment.mint(address(this), routed);
        payment.approve(address(router), routed);
        router.routePayment(routed);
        if (payNow) router.payFundPayment();

        uint256 total = payment.balanceOf(address(router)) + payment.balanceOf(address(fundStandIn));
        assertEq(total, routed);
        assertEq(payment.balanceOf(address(bribe)), 0);
        assertEq(router.accountedPaymentBalance(), router.fundPaymentLiability());
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
        _stake(ALICE, 100 ether);
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
            _stake(ALICE, 100 ether);
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
