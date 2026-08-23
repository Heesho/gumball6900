// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { MockERC20 } from "./utils/Tokens.sol";

/// @title BribeFlooringTest
/// @notice Documents ordinary Synthetix-style flooring: rounded units remain surplus and never follow later weights.
contract BribeFlooringTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);

    uint256 private constant WEEK = 7 days;

    Bribe private bribe;
    MockERC20 private reward;

    function setUp() external {
        vm.warp(365 days);
        bribe = new Bribe(address(this));
        reward = new MockERC20("Reward", "RWD", 18);
        bribe.addRewardToken(address(reward));
    }

    function test_LaterSignalerCannotReceivePreEntryRoundedReward() external {
        bribe.deposit(50e36, ALICE);
        bribe.deposit(50e36, CAROL);
        uint256 startedAt = block.timestamp;
        _notify(WEEK);

        vm.warp(startedAt + 99);
        bribe.deposit(100e36, BOB);
        assertEq(bribe.rewardPerToken(address(reward)), 0);
        assertEq(bribe.earned(BOB, address(reward)), 0);

        vm.warp(startedAt + WEEK);
        uint256 bobPaid = bribe.claimReward(BOB, address(reward));
        uint256 alicePaid = bribe.claimReward(ALICE, address(reward));
        uint256 carolPaid = bribe.claimReward(CAROL, address(reward));

        assertLe(bobPaid, (WEEK - 99) / 2, "BOB receives only a share of post-entry emission");
        assertLe(alicePaid + bobPaid + carolPaid, WEEK - 99);
        assertGe(reward.balanceOf(address(bribe)), 99, "pre-entry rounded emission remains surplus");
    }

    function test_RemainingSignalerCannotReceivePreExitRoundedReward() external {
        bribe.deposit(50e36, ALICE);
        bribe.deposit(50e36, CAROL);
        uint256 startedAt = block.timestamp;
        _notify(WEEK);

        vm.warp(startedAt + 99);
        bribe.withdraw(50e36, ALICE);
        assertEq(bribe.rewardPerToken(address(reward)), 0);
        assertEq(bribe.earned(ALICE, address(reward)), 0);

        vm.warp(startedAt + WEEK);
        uint256 alicePaid = bribe.claimReward(ALICE, address(reward));
        uint256 carolPaid = bribe.claimReward(CAROL, address(reward));

        assertEq(alicePaid, 0);
        assertLe(carolPaid, WEEK - 99, "CAROL cannot inherit the pre-exit rounded emission");
        assertGe(reward.balanceOf(address(bribe)), 99);
    }

    function test_FullExitSubTokenFloorIsNotReallocated() external {
        bribe.deposit(3, ALICE);
        bribe.deposit(7, CAROL);
        uint256 startedAt = block.timestamp;
        _notify(WEEK);

        vm.warp(startedAt + 1);
        bribe.withdraw(3, ALICE);
        assertEq(bribe.earned(ALICE, address(reward)), 0);

        vm.warp(startedAt + WEEK);
        assertEq(bribe.claimReward(ALICE, address(reward)), 0);
        uint256 carolPaid = bribe.claimReward(CAROL, address(reward));

        assertLt(carolPaid, WEEK);
        assertEq(carolPaid + reward.balanceOf(address(bribe)), WEEK);
    }

    function _notify(uint256 amount) private {
        reward.mint(address(this), amount);
        reward.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(reward), amount);
    }
}
