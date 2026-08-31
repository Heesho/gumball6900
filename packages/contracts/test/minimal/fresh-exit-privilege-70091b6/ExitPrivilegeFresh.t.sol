// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Resonance } from "../../../src/core/Resonance.sol";

import { ProtocolFixture } from "../utils/ProtocolFixture.sol";

/// @notice Audit-only reproductions pinned by directory name to HEAD 70091b6.
contract ExitPrivilegeFresh70091b6Test is ProtocolFixture {
    function setUp() public {
        _deployProtocol();
    }

    /// @dev Proves the exact precision-coupled cap cannot turn a rejected route into a partial custody/state change,
    ///      and that the killed-Strategy scalar exit remains independent of future revenue admission.
    function test_ExactResonanceCapRejectsAtomicallyAndKilledSignalStillExits() external {
        _signalDefault(ALICE, 1);

        uint256 maximum = resonance.MAX_LIFETIME_REVENUE_AMOUNT();
        _routeRevenue(maximum);
        assertEq(resonance.lifetimeRevenueNotified(), maximum);

        vm.warp(block.timestamp + resonance.REWARD_DURATION());
        resonance.killStrategy(address(targetStrategy));
        assertFalse(resonance.isStrategyLive(address(targetStrategy)));

        uint256 rejectedAmount = resonance.REWARD_DURATION();
        usdg.mint(address(resonanceRouter), rejectedAmount);
        uint256 resonanceBalanceBefore = usdg.balanceOf(address(resonance));
        uint256 routerBalanceBefore = usdg.balanceOf(address(resonanceRouter));
        uint256 allowanceBefore = usdg.allowance(address(resonanceRouter), address(resonance));

        vm.expectRevert(
            abi.encodeWithSelector(Resonance.RevenueLifetimeCapExceeded.selector, maximum, rejectedAmount, maximum)
        );
        vm.prank(KEEPER);
        resonanceRouter.route();

        assertEq(resonance.lifetimeRevenueNotified(), maximum);
        assertEq(usdg.balanceOf(address(resonance)), resonanceBalanceBefore);
        assertEq(usdg.balanceOf(address(resonanceRouter)), routerBalanceBefore);
        assertEq(usdg.allowance(address(resonanceRouter), address(resonance)), allowanceBefore);

        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 1);

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(targetBribe.signalWeightOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1);
    }
}
