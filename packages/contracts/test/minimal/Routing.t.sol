// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { IBribe } from "../../src/core/interfaces/IBribe.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { MockERC20, RevertingToken } from "./utils/Tokens.sol";

/// @title BribeRouterTest
/// @notice Covers the minimal permissionless buffer between one Strategy and its paired Bribe.
contract BribeRouterTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant KEEPER = address(0x9EE9E5);

    Bribe private bribe;
    BribeRouter private router;
    MockERC20 private payment;

    event RewardRouted(address indexed bribe, address indexed rewardToken, uint256 amount);

    function setUp() external {
        vm.warp(365 days);
        payment = new MockERC20("Payment", "PAY", 18);

        // The test contract plays Resonance for the Bribe's virtual-balance controls.
        bribe = new Bribe(address(this));
        bribe.addRewardToken(address(payment));
        router = new BribeRouter(IBribe(address(bribe)), IERC20(address(payment)));
    }

    function test_ConstructorRejectsZeroAndEOADependencies() external {
        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(IBribe(address(0)), IERC20(address(payment)));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(IBribe(address(bribe)), IERC20(address(0)));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(IBribe(ALICE), IERC20(address(payment)));

        vm.expectRevert(BribeRouter.ZeroAddress.selector);
        new BribeRouter(IBribe(address(bribe)), IERC20(ALICE));
    }

    function test_RouteIsPermissionlessAndAnEmptyRouterIsANoOp() external {
        vm.prank(ALICE);
        assertEq(router.route(), 0);
        assertEq(payment.allowance(address(router), address(bribe)), 0);
    }

    function test_RouteAccumulatesUntilTheBalanceCanSustainANonzeroRate() external {
        uint256 duration = bribe.REWARD_DURATION();
        payment.mint(address(router), duration - 1);

        vm.prank(KEEPER);
        assertEq(router.route(), 0);
        assertEq(payment.balanceOf(address(router)), duration - 1);

        payment.mint(address(router), 1);
        vm.expectEmit(true, true, false, true);
        emit RewardRouted(address(bribe), address(payment), duration);
        assertEq(router.route(), duration);

        assertEq(payment.balanceOf(address(router)), 0);
        assertEq(payment.balanceOf(address(bribe)), duration);
        assertEq(bribe.lifetimeRewardNotified(address(payment)), duration);
        assertEq(payment.allowance(address(router), address(bribe)), 0);
    }

    function test_RouteWaitsUntilTheCompleteBalanceMeetsTheActiveStreamLeft() external {
        payment.mint(address(router), 7 ether);
        assertEq(router.route(), 7 ether);

        uint256 remaining = bribe.remainingReward(address(payment));
        payment.mint(address(router), remaining - 1);
        assertEq(router.route(), 0);
        assertEq(payment.balanceOf(address(router)), remaining - 1);

        payment.mint(address(router), 1);
        assertEq(router.route(), remaining);
        assertEq(payment.balanceOf(address(router)), 0);
        assertEq(payment.balanceOf(address(bribe)), 7 ether + remaining);
    }

    function test_RouteIncludesTheCompleteDirectlyDonatedBalance() external {
        payment.mint(address(router), 3 ether);

        vm.prank(KEEPER);
        assertEq(router.route(), 3 ether);

        assertEq(payment.balanceOf(address(router)), 0);
        assertEq(payment.balanceOf(address(bribe)), 3 ether);
    }

    function test_RouteCanRetryAfterTheBribeTokenPullFails() external {
        RevertingToken hostile = new RevertingToken(18);
        Bribe hostileBribe = new Bribe(address(this));
        hostileBribe.addRewardToken(address(hostile));
        BribeRouter hostileRouter = new BribeRouter(IBribe(address(hostileBribe)), IERC20(address(hostile)));

        hostile.mint(address(hostileRouter), 1 ether);
        hostile.setBlocked(address(hostileBribe), true);

        vm.expectRevert("BLOCKED");
        hostileRouter.route();
        assertEq(hostile.balanceOf(address(hostileRouter)), 1 ether);
        assertEq(hostile.allowance(address(hostileRouter), address(hostileBribe)), 0);

        hostile.setBlocked(address(hostileBribe), false);
        assertEq(hostileRouter.route(), 1 ether);
        assertEq(hostile.balanceOf(address(hostileRouter)), 0);
        assertEq(hostile.balanceOf(address(hostileBribe)), 1 ether);
    }
}

/// @title ResonanceRouterTest
/// @notice Covers permissionless full-balance USDG forwarding for the standard-token model.
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

        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(usdg.allowance(address(resonanceRouter), address(resonance)), 0, "no approval may survive");
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
    }

    function test_SubThresholdRevenueWaitsUntilTheRouterBalanceQualifies() external {
        uint256 duration = resonance.REWARD_DURATION();
        usdg.mint(address(resonanceRouter), duration - 1);

        vm.prank(KEEPER);
        assertEq(resonanceRouter.route(), 0);
        assertEq(usdg.balanceOf(address(resonanceRouter)), duration - 1);
        assertEq(usdg.balanceOf(address(resonance)), 0);

        usdg.mint(address(resonanceRouter), 1);
        vm.prank(DAVE);
        assertEq(resonanceRouter.route(), duration);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(resonance.remainingRevenue(), duration);

        usdg.mint(address(resonanceRouter), duration - 1);
        vm.prank(DAVE);
        assertEq(resonanceRouter.route(), 0);
        usdg.mint(address(resonanceRouter), 1);
        vm.prank(DAVE);
        assertEq(resonanceRouter.route(), duration);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
        assertEq(resonance.remainingRevenue(), 2 * duration);
    }

    function test_ZeroSignalRevenueBecomesUnallocatedResonanceSurplus() external {
        usdg.mint(address(resonanceRouter), 42_000_000);
        vm.prank(DAVE);
        resonanceRouter.route();

        vm.warp(block.timestamp + resonance.REWARD_DURATION());
        assertEq(resonance.remainingRevenue(), 0);
        assertEq(resonance.earnedRevenue(address(targetStrategy)), 0);
        assertEq(usdg.balanceOf(address(resonance)), 42_000_000);
    }

    /// @notice Standard-token routing conserves the complete balance for any signal configuration.
    function testFuzz_RoutingConservesTheCompleteBalance(uint256 amount, bool withSignals) external {
        uint256 revenue = bound(amount, 1, 1e15);
        if (withSignals) {
            _signalDefault(ALICE, 100 ether);
            _signalOne(ALICE, address(targetStrategy));
        }

        usdg.mint(address(resonanceRouter), revenue);
        vm.prank(KEEPER);
        resonanceRouter.route();

        assertEq(
            usdg.balanceOf(address(resonanceRouter)) + usdg.balanceOf(address(resonance))
                + usdg.balanceOf(address(fund)),
            revenue
        );
    }
}
