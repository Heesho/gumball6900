// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken, MockERC20 } from "./utils/Tokens.sol";

/// @notice Resonance stand-in that can under-consume the router's approval, reaching the retained-revenue guard.
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
}

/// @title BribeRouterTest
/// @notice Covers the queue-or-forward decision between a Strategy, its Bribe, and Fund.
contract BribeRouterTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant KEEPER = address(0x9EE9E5);
    address private constant FUND = address(0xF0D);

    uint256 private constant WEEK = 7 days;

    Bribe private bribe;
    BribeRouter private router;
    MockERC20 private reward;
    MockERC20 private fundStandIn;

    event RewardsDistributed(address indexed bribe, address indexed rewardToken, uint256 amount);
    event RewardsQueued(address indexed strategy, uint256 amount);
    event RewardsReturnedToFund(address indexed fund, address indexed rewardToken, uint256 amount);

    function setUp() external {
        vm.warp(365 days);
        reward = new MockERC20("Reward", "RWD", 18);
        fundStandIn = new MockERC20("Fund Stand In", "FSI", 18);

        // The test contract plays both Resonance (for the Bribe) and Strategy (for the router).
        bribe = new Bribe(address(this));
        bribe.addRewardToken(address(reward));
        router = new BribeRouter(address(this), bribe, IERC20(address(reward)), address(fundStandIn));
    }

    function test_ConstructorRejectsZeroAndEOADependencies() external {
        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(0), bribe, IERC20(address(reward)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), Bribe(address(0)), IERC20(address(reward)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), bribe, IERC20(address(0)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), bribe, IERC20(address(reward)), address(0));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(ALICE, bribe, IERC20(address(reward)), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), bribe, IERC20(ALICE), address(fundStandIn));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(address(this), bribe, IERC20(address(reward)), ALICE);
    }

    function test_RouteRewardsIsStrategyOnly() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(BribeRouter.NotStrategy.selector, ALICE));
        router.routeRewards(1 ether);
    }

    function test_RouteRewardsRejectsZero() external {
        vm.expectRevert(BribeRouter.ZeroAmount.selector);
        router.routeRewards(0);
    }

    function test_RouteRewardsRejectsAFeeOnTransferToken() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(18);
        BribeRouter feeRouter = new BribeRouter(address(this), bribe, IERC20(address(feeToken)), address(fundStandIn));

        feeToken.mint(address(this), 10 ether);
        feeToken.approve(address(feeRouter), 10 ether);
        feeToken.setFeeBps(100);

        vm.expectRevert(
            abi.encodeWithSelector(BribeRouter.InexactTransfer.selector, 10 ether, (10 ether * 9_900) / 10_000)
        );
        feeRouter.routeRewards(10 ether);
    }

    function test_RewardsGoToFundWhenTheBribeHasNoSignalWeight() external {
        reward.mint(address(this), 10 ether);
        reward.approve(address(router), 10 ether);

        vm.expectEmit(true, true, false, true);
        emit RewardsReturnedToFund(address(fundStandIn), address(reward), 10 ether);
        assertEq(router.routeRewards(10 ether), 0);

        assertEq(reward.balanceOf(address(fundStandIn)), 10 ether);
        assertEq(router.pendingRewards(), 0);
    }

    function test_RewardsAreQueuedWhenTooSmallToSustainANonZeroRate() external {
        bribe.deposit(100 ether, ALICE);
        reward.mint(address(this), WEEK - 1);
        reward.approve(address(router), WEEK - 1);

        assertEq(router.routeRewards(WEEK - 1), 0);
        assertEq(router.pendingRewards(), WEEK - 1, "the amount waits in the router");
        assertEq(reward.balanceOf(address(bribe)), 0);
    }

    function test_QueuedRewardsFlushOnceTheThresholdIsCrossed() external {
        bribe.deposit(100 ether, ALICE);
        reward.mint(address(this), WEEK - 1);
        reward.approve(address(router), WEEK - 1);
        router.routeRewards(WEEK - 1);

        // A direct top-up plus a permissionless nudge is enough to start the stream.
        reward.mint(address(router), 10 ether);
        vm.prank(KEEPER);
        uint256 distributed = router.distribute();

        assertEq(distributed, 10 ether + WEEK - 1);
        assertEq(router.pendingRewards(), 0);
        assertEq(reward.balanceOf(address(bribe)), 10 ether + WEEK - 1);
    }

    function test_RewardsAreQueuedRatherThanShrinkingALiveStream() external {
        bribe.deposit(100 ether, ALICE);
        reward.mint(address(this), 70 ether);
        reward.approve(address(router), 70 ether);
        router.routeRewards(70 ether);

        reward.mint(address(this), 1 ether);
        reward.approve(address(router), 1 ether);
        assertEq(router.routeRewards(1 ether), 0, "a smaller amount must not reset the stream");
        assertEq(router.pendingRewards(), 1 ether);
    }

    function test_RouteRewardsStartsTheStreamAndClearsItsApproval() external {
        bribe.deposit(100 ether, ALICE);
        reward.mint(address(this), 70 ether);
        reward.approve(address(router), 70 ether);

        vm.expectEmit(true, false, false, true);
        emit RewardsQueued(address(this), 70 ether);
        assertEq(router.routeRewards(70 ether), 70 ether);

        assertEq(reward.balanceOf(address(bribe)), 70 ether);
        assertEq(reward.allowance(address(router), address(bribe)), 0, "no standing approval may remain");
        assertEq(router.pendingRewards(), 0);
    }

    function test_DistributeOnAnEmptyRouterIsAHarmlessNoOp() external {
        vm.prank(KEEPER);
        assertEq(router.distribute(), 0);
    }

    function test_DistributeIsPermissionless() external {
        bribe.deposit(100 ether, ALICE);
        reward.mint(address(router), 70 ether);

        vm.prank(KEEPER);
        vm.expectEmit(true, true, false, true);
        emit RewardsDistributed(address(bribe), address(reward), 70 ether);
        assertEq(router.distribute(), 70 ether);
    }

    /// @notice Whatever the routing decision, the reward token is never created or destroyed.
    function testFuzz_RoutingConservesEveryUnit(uint256 amount, uint256 weight) external {
        uint256 routed = bound(amount, 1, 1e30);
        uint256 signalWeight = bound(weight, 0, 1e24);
        if (signalWeight != 0) bribe.deposit(signalWeight, ALICE);

        reward.mint(address(this), routed);
        reward.approve(address(router), routed);
        router.routeRewards(routed);

        uint256 total = reward.balanceOf(address(bribe)) + reward.balanceOf(address(router))
            + reward.balanceOf(address(fundStandIn));
        assertEq(total, routed);
        if (signalWeight == 0) assertEq(reward.balanceOf(address(fundStandIn)), routed);
    }
}

/// @title ResonanceRouterTest
/// @notice Covers permissionless USDG forwarding and the retained-revenue guard.
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
        _signalOne(ALICE, address(acquisitionStrategy));
        usdg.mint(address(resonanceRouter), 100_000_000);

        vm.prank(KEEPER);
        vm.expectEmit(true, false, false, true);
        emit RevenueRouted(KEEPER, 100_000_000);
        assertEq(resonanceRouter.route(), 100_000_000);

        assertEq(resonanceRouter.pendingRevenue(), 0);
        assertEq(usdg.allowance(address(resonanceRouter), address(resonance)), 0, "no approval may survive");
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
    }

    function test_DirectlyTransferredRevenueIsNeverStuck() external {
        // Anyone can donate USDG to the router and anyone can flush it, with no keeper role involved.
        usdg.mint(address(resonanceRouter), 42_000_000);
        vm.prank(DAVE);
        resonanceRouter.route();

        assertEq(usdg.balanceOf(address(fund)), 42_000_000, "with no signals it becomes Fund backing");
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
            _signalOne(ALICE, address(acquisitionStrategy));
        }

        usdg.mint(address(resonanceRouter), revenue);
        vm.prank(KEEPER);
        resonanceRouter.route();

        assertEq(resonanceRouter.pendingRevenue(), 0);
        assertEq(usdg.balanceOf(address(resonance)) + usdg.balanceOf(address(fund)), revenue);
    }
}
