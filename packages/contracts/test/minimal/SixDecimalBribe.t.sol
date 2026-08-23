// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { MockERC20 } from "./utils/Tokens.sol";

/// @title SixDecimalBribeTest
/// @notice Demonstrates that the 1e36 index keeps six-decimal rewards useful over large 18-decimal signal weights.
contract SixDecimalBribeTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    uint256 private constant WEEK = 7 days;
    uint256 private constant ALICE_SIGNAL = 3_000_000 ether;
    uint256 private constant BOB_SIGNAL = 2_000_000 ether;
    uint256 private constant TOTAL_SIGNAL = ALICE_SIGNAL + BOB_SIGNAL;

    Bribe private bribe;
    MockERC20 private reward;

    function setUp() external {
        vm.warp(365 days);
        bribe = new Bribe(address(this));
        reward = new MockERC20("Six Decimal Reward", "6RWD", 6);
        bribe.addRewardToken(address(reward));
    }

    function test_PrecisionAndLifetimeCapRemainCoupled() external view {
        assertEq(bribe.REWARD_PRECISION(), 1e36);
        assertEq(bribe.MAX_LIFETIME_REWARD_AMOUNT(), type(uint256).max / 1e36);
    }

    function test_OneSixDecimalTokenRemainsUsefulAcrossFiveMillionSignal() external {
        _depositTwoSignalers();
        _notify(1_000_000);

        vm.warp(block.timestamp + WEEK);
        assertEq(bribe.claimReward(ALICE, address(reward)), 362_880);
        assertEq(bribe.claimReward(BOB, address(reward)), 241_920);

        assertEq(reward.balanceOf(ALICE), 362_880);
        assertEq(reward.balanceOf(BOB), 241_920);
        assertEq(reward.balanceOf(address(bribe)), 395_200);
        assertGt(bribe.rewardPerToken(address(reward)), 0);
    }

    function test_DivisibleSixDecimalStreamDistributesProportionally() external {
        _depositTwoSignalers();
        uint256 amount = 10 * WEEK;
        _notify(amount);

        vm.warp(block.timestamp + WEEK);
        assertEq(bribe.claimReward(ALICE, address(reward)), (amount * 3) / 5);
        assertEq(bribe.claimReward(BOB, address(reward)), (amount * 2) / 5);
        assertEq(reward.balanceOf(address(bribe)), 0);
    }

    function test_LowDecimalSignalEntryCheckpointsThePriorWeight() external {
        bribe.deposit(ALICE_SIGNAL, ALICE);
        uint256 amount = 10 * WEEK;
        _notify(amount);

        vm.warp(block.timestamp + 1 days);
        bribe.deposit(BOB_SIGNAL, BOB);
        assertEq(bribe.earned(ALICE, address(reward)), 10 * 1 days);
        assertEq(bribe.earned(BOB, address(reward)), 0);

        vm.warp(block.timestamp + 6 days);
        assertEq(bribe.claimReward(ALICE, address(reward)), 3_974_400);
        assertEq(bribe.claimReward(BOB, address(reward)), 2_073_600);
        assertEq(reward.balanceOf(ALICE) + reward.balanceOf(BOB), amount);
    }

    function testFuzz_HighPrecisionFloorsWithoutCreatingRewards(
        uint256 aliceSignalSeed,
        uint256 bobSignalSeed,
        uint256 amountSeed
    ) external {
        uint256 aliceSignal = bound(aliceSignalSeed, 1, 5_000_000) * 1 ether;
        uint256 bobSignal = bound(bobSignalSeed, 1, 5_000_000) * 1 ether;
        uint256 amount = bound(amountSeed, WEEK, 20_000_000);

        bribe.deposit(aliceSignal, ALICE);
        bribe.deposit(bobSignal, BOB);
        _notify(amount);
        vm.warp(block.timestamp + WEEK);

        uint256 emitted = amount - (amount % WEEK);
        uint256 delta = Math.mulDiv(emitted, bribe.REWARD_PRECISION(), aliceSignal + bobSignal);
        uint256 expectedAlice = Math.mulDiv(aliceSignal, delta, bribe.REWARD_PRECISION());
        uint256 expectedBob = Math.mulDiv(bobSignal, delta, bribe.REWARD_PRECISION());

        assertEq(bribe.claimReward(ALICE, address(reward)), expectedAlice);
        assertEq(bribe.claimReward(BOB, address(reward)), expectedBob);
        assertLe(expectedAlice + expectedBob, emitted);
        assertEq(
            reward.balanceOf(ALICE) + reward.balanceOf(BOB) + reward.balanceOf(address(bribe)),
            amount,
            "floors remain token surplus"
        );
    }

    function _depositTwoSignalers() private {
        bribe.deposit(ALICE_SIGNAL, ALICE);
        bribe.deposit(BOB_SIGNAL, BOB);
        assertEq(bribe.totalSupply(), TOTAL_SIGNAL);
    }

    function _notify(uint256 amount) private {
        reward.mint(address(this), amount);
        reward.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(reward), amount);
    }
}
