// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

/// @title CarryReallocationTest
/// @notice Minimal proofs that conserved sub-index carry can cross a later signal-supply boundary.
/// @dev These tests intentionally reproduce an unresolved economic-allocation risk. They are not assertions that the
///      behavior is desirable. Any remediation must replace their expected allocations with the accepted policy.
contract CarryReallocationTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
    }

    /// @notice Revenue received under the old weights can be partially assigned to a Strategy signaled only later.
    function test_KnownRisk_NewStrategySignalCanReceivePreEntryRevenueCarry() external {
        _stake(ALICE, 500_000 ether);
        _stake(CAROL, 500_000 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(CAROL, address(targetStrategy));

        // At 1,000,000 ether of total weight, the minimum routable notification cannot advance the scaled index.
        _routeRevenue(604_800);
        _finishRevenueStream();
        assertEq(resonance.revenueIndex(), 0);
        assertEq(resonance.pendingRevenueScaled(), 604_800 ether);

        // BOB enters a different Strategy only after those 604,800 units were received.
        _stake(BOB, 1_000_000 ether);
        _signalOne(BOB, address(gbxStrategy));

        // Another 1,395,200 units crosses the index threshold under the new 2,000,000 ether denominator.
        _routeRevenue(1_395_200);
        _finishRevenueStream();
        assertEq(resonance.revenueIndex(), 1);

        resonance.distribute(address(targetStrategy));
        resonance.distribute(address(gbxStrategy));

        assertEq(usdg.balanceOf(address(targetStrategy)), 1_000_000);
        assertEq(usdg.balanceOf(address(gbxStrategy)), 1_000_000);
        assertGt(
            usdg.balanceOf(address(gbxStrategy)),
            697_600,
            "the late Strategy receives more than its maximum pro-rata share of post-entry revenue"
        );
    }

    /// @notice A late signaler can receive Bribe reward carry emitted before that account entered.
    function test_KnownRisk_NewSignalerCanReceivePreEntryRewardCarry() external {
        _stake(ALICE, 50 ether);
        _stake(CAROL, 50 ether);
        _signalOne(ALICE, address(targetStrategy));
        _signalOne(CAROL, address(targetStrategy));

        // The exact 200-unit stream emits one base unit per second for its first 200 seconds.
        target.mint(DAVE, 200);
        vm.startPrank(DAVE);
        target.approve(address(targetBribe), 200);
        targetBribe.notifyRewardAmount(address(target), 200);
        vm.stopPrank();

        // Ninety-nine units are emitted under the two incumbent accounts but remain below index resolution.
        vm.warp(DEPLOYED_AT + 99);
        _stake(BOB, 100 ether);
        _signalOne(BOB, address(targetStrategy));
        assertEq(targetBribe.rewardPerToken(address(target)), 0);

        // The next 101 emitted units cross the threshold under a denominator that now includes BOB.
        vm.warp(DEPLOYED_AT + 200);
        targetBribe.claimReward(BOB, address(target));

        assertEq(target.balanceOf(BOB), 100);
        assertGt(
            target.balanceOf(BOB),
            51,
            "the late signaler receives more than its maximum pro-rata share of post-entry emission"
        );
    }
}
