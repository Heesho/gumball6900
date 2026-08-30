// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ProtocolFixture } from "../utils/ProtocolFixture.sol";

/// @title CEX01CrossVersionRegressionTest
/// @notice One source-compatible property that fails on f991253 and passes after the ADR 0052 admission cap.
/// @dev This file deliberately avoids calling the new cap getters or error so it can be copied unchanged to the
///      baseline worktree. On the baseline, the second schedule succeeds and the final removal panics on index overflow.
///      On the patched tree, the second route rolls back into the Router and the exact same principal removal succeeds.
contract CEX01CrossVersionRegressionTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
        _mintTestGBX(ALICE, 1);
    }

    function test_OriginalOverflowSequenceMustLeaveSignalPrincipalRemovable() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 1);
        signalGBX.addSignal(address(targetStrategy), 1);
        vm.stopPrank();

        uint256 precisionBound = type(uint256).max / 1e36;
        uint256 completedSchedule = precisionBound - (precisionBound % resonance.REWARD_DURATION());

        usdg.mint(address(resonanceRouter), completedSchedule);
        vm.prank(KEEPER);
        resonanceRouter.route();
        vm.warp(block.timestamp + resonance.REWARD_DURATION());

        usdg.mint(address(resonanceRouter), completedSchedule);
        vm.prank(KEEPER);
        (bool secondScheduleAccepted,) = address(resonanceRouter).call(abi.encodeWithSignature("route()"));
        if (secondScheduleAccepted) vm.warp(block.timestamp + 1);

        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 1);

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(targetBribe.signalWeightOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1);
    }
}
