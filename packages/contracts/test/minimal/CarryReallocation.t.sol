// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

/// @title CarryReallocationTest
/// @notice Minimal proofs that conserved sub-index carry cannot cross a later signal-supply boundary.
contract CarryReallocationTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
    }

    /// @notice Revenue received under old weights is assigned to Fund before a later Strategy enters.
    function test_NewStrategySignalCannotReceivePreEntryRevenueCarry() external {
        _stake(ALICE, 1e36);
        _stake(CAROL, 1e36);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(CAROL, address(targetStrategy));

        // The total weight is deliberately larger than one raw USDG expressed at index precision.
        _routeRevenue(1);
        _finishRevenueStream();
        assertEq(resonance.revenueIndex(), 0);
        assertEq(resonance.pendingRevenueScaled(), resonance.INDEX_PRECISION());

        _stake(BOB, 2e36);
        _signalOne(BOB, address(gbxStrategy));

        assertEq(resonance.pendingRevenueScaled(), 0);
        assertEq(resonance.fundRevenueLiability(), 1);

        _routeRevenue(4);
        _finishRevenueStream();

        resonance.distribute(address(targetStrategy));
        resonance.distribute(address(gbxStrategy));

        assertEq(usdg.balanceOf(address(targetStrategy)), 2);
        assertEq(usdg.balanceOf(address(gbxStrategy)), 2);
    }

    /// @notice Bribe carry emitted under old weights is fixed to Fund before a later signaler enters.
    function test_NewSignalerCannotReceivePreEntryRewardCarry() external {
        _stake(ALICE, 50 ether);
        _stake(CAROL, 50 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(CAROL, address(targetStrategy));

        // The exact 300-unit stream emits one base unit per second for its first 300 seconds.
        target.mint(DAVE, 300);
        vm.startPrank(DAVE);
        target.approve(address(targetBribe), 300);
        targetBribe.notifyRewardAmount(address(target), 300);
        vm.stopPrank();

        // Ninety-nine units are emitted under the two incumbent accounts but remain below index resolution.
        vm.warp(DEPLOYED_AT + 99);
        _stake(BOB, 100 ether);
        _signalOne(BOB, address(targetStrategy));
        assertEq(targetBribe.rewardPerToken(address(target)), 0);
        assertEq(targetBribe.fundRewardLiability(address(target)), 99);

        // Only the next 201 units use the denominator that includes BOB.
        vm.warp(DEPLOYED_AT + 300);
        targetBribe.claimReward(BOB, address(target));

        assertEq(target.balanceOf(BOB), 100);
        assertEq(targetBribe.fundRewardLiability(address(target)), 99);
    }

    /// @notice Old-denominator Bribe carry cannot be reallocated to signalers who remain after an exit.
    function test_RemainingSignalerCannotReceivePreExitRewardCarry() external {
        _stake(ALICE, 50 ether);
        _stake(CAROL, 50 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(CAROL, address(targetStrategy));

        target.mint(DAVE, 300);
        vm.startPrank(DAVE);
        target.approve(address(targetBribe), 300);
        targetBribe.notifyRewardAmount(address(target), 300);
        vm.stopPrank();

        vm.warp(DEPLOYED_AT + 99);
        vm.prank(ALICE);
        resonance.removeSignal(address(targetStrategy), 50 ether);
        assertEq(targetBribe.fundRewardLiability(address(target)), 99);

        vm.warp(DEPLOYED_AT + 300);
        targetBribe.claimReward(CAROL, address(target));

        assertEq(target.balanceOf(CAROL), 201);
        assertEq(targetBribe.fundRewardLiability(address(target)), 99);
    }

    /// @notice A fully exiting account's sub-token reward remainder becomes a fixed Fund remainder.
    function test_FullExitCannotReallocateUserRewardRemainder() external {
        _stake(ALICE, 3);
        _stake(CAROL, 7);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(CAROL, address(targetStrategy));

        target.mint(DAVE, 1);
        vm.startPrank(DAVE);
        target.approve(address(targetBribe), 1);
        targetBribe.notifyRewardAmount(address(target), 1);
        vm.stopPrank();

        vm.warp(DEPLOYED_AT + 1);
        vm.prank(ALICE);
        resonance.removeSignal(address(targetStrategy), 3);

        assertEq(targetBribe.userRewardRemainder(ALICE, address(target)), 0);
        assertEq(targetBribe.fundRewardRemainder(address(target)), 3e17);
        assertEq(targetBribe.earned(CAROL, address(target)), 0);
    }
}
