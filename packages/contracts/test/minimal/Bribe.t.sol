// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { MockERC20 } from "./utils/Tokens.sol";

/// @title BribeTest
/// @notice Covers the bounded Synthetix-style reward stream over Resonance-controlled virtual balances.
contract BribeTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);
    address private constant OUTSIDER = address(0x0075);

    uint256 private constant WEEK = 7 days;

    Bribe private bribe;
    MockERC20 private reward;
    MockERC20 private secondReward;

    event RewardTokenAdded(address indexed rewardToken);
    event RewardNotified(address indexed rewardToken, uint256 amount);

    function setUp() external {
        vm.warp(365 days);
        bribe = new Bribe(address(this));
        reward = new MockERC20("Reward", "RWD", 18);
        secondReward = new MockERC20("Second Reward", "RWD2", 6);
        bribe.addRewardToken(address(reward));
    }

    function test_ConstructorRejectsZeroAndEOAResonance() external {
        vm.expectRevert(Bribe.ZeroAddress.selector);
        new Bribe(address(0));

        vm.expectRevert(Bribe.ZeroAddress.selector);
        new Bribe(ALICE);
    }

    function test_VirtualBalanceAndRegistryMutationsAreResonanceOnly() external {
        vm.startPrank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(Bribe.NotResonance.selector, OUTSIDER));
        bribe.addSignalWeight(ALICE, 1 ether);

        vm.expectRevert(abi.encodeWithSelector(Bribe.NotResonance.selector, OUTSIDER));
        bribe.removeSignalWeight(ALICE, 1 ether);

        vm.expectRevert(abi.encodeWithSelector(Bribe.NotResonance.selector, OUTSIDER));
        bribe.addRewardToken(address(secondReward));
        vm.stopPrank();
    }

    function test_VirtualBalanceMutationsRejectDegenerateArguments() external {
        vm.expectRevert(Bribe.ZeroAmount.selector);
        bribe.addSignalWeight(ALICE, 0);

        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.addSignalWeight(address(0), 1);

        vm.expectRevert(Bribe.ZeroAmount.selector);
        bribe.removeSignalWeight(ALICE, 0);

        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.removeSignalWeight(address(0), 1);
    }

    function test_RewardTokensAreAppendOnlyAndListedInInsertionOrder() external {
        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.addRewardToken(address(0));

        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.addRewardToken(ALICE);

        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardAlreadyAdded.selector, address(reward)));
        bribe.addRewardToken(address(reward));

        vm.expectEmit(true, false, false, false);
        emit RewardTokenAdded(address(secondReward));
        bribe.addRewardToken(address(secondReward));

        address[] memory tokens = bribe.rewardTokens();
        assertEq(tokens.length, 2);
        assertEq(tokens[0], address(reward));
        assertEq(tokens[1], address(secondReward));
    }

    function test_RewardTokenCountIsPermanentlyCappedAtSixteen() external {
        uint256 maximum = bribe.MAX_REWARD_TOKENS();
        assertEq(maximum, 16);

        for (uint256 i = 1; i < maximum; ++i) {
            MockERC20 extra = new MockERC20("Extra Reward", "XTRA", 18);
            bribe.addRewardToken(address(extra));
        }
        assertEq(bribe.rewardTokens().length, maximum);

        MockERC20 seventeenth = new MockERC20("Seventeenth Reward", "SEVENTEENTH", 18);
        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardTokenLimitReached.selector, maximum));
        bribe.addRewardToken(address(seventeenth));
    }

    function test_NotifyRejectsUnregisteredAndBelowDurationAmounts() external {
        vm.expectRevert(abi.encodeWithSelector(Bribe.NotRewardToken.selector, address(secondReward)));
        bribe.notifyReward(address(secondReward), WEEK);

        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardBelowDuration.selector, WEEK - 1));
        bribe.notifyReward(address(reward), WEEK - 1);
    }

    function test_SevenDayRateFloorsAndLeavesTheOrdinaryRemainderAsSurplus() external {
        bribe.addSignalWeight(ALICE, 1);
        uint256 amount = 10 * WEEK + 123;

        reward.mint(address(this), amount);
        reward.approve(address(bribe), amount);
        vm.expectEmit(true, false, false, true);
        emit RewardNotified(address(reward), amount);
        bribe.notifyReward(address(reward), amount);

        (uint256 finish, uint256 rate, uint256 updatedAt,) = bribe.rewardData(address(reward));
        assertEq(finish, block.timestamp + WEEK);
        assertEq(rate, 10);
        assertEq(updatedAt, block.timestamp);
        assertEq(bribe.remainingReward(address(reward)), 10 * WEEK);
        assertEq(bribe.lifetimeRewardNotified(address(reward)), amount);

        vm.warp(finish);
        assertEq(bribe.claimReward(ALICE, address(reward)), 10 * WEEK);
        assertEq(reward.balanceOf(address(bribe)), 123);
        assertEq(bribe.remainingReward(address(reward)), 0);
    }

    function test_ActiveTopUpBelowTheAmountLeftRevertsWithoutChangingTheStream() external {
        bribe.addSignalWeight(ALICE, 1);
        _notify(10 * WEEK);
        vm.warp(block.timestamp + 1 days);

        uint256 remaining = bribe.remainingReward(address(reward));
        uint256 requested = remaining - 1;
        (uint256 finishBefore, uint256 rateBefore, uint256 updateBefore, uint256 indexBefore) =
            bribe.rewardData(address(reward));

        reward.mint(address(this), requested);
        reward.approve(address(bribe), requested);
        uint256 callerBalanceBefore = reward.balanceOf(address(this));
        uint256 bribeBalanceBefore = reward.balanceOf(address(bribe));

        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardBelowRemaining.selector, requested, remaining));
        bribe.notifyReward(address(reward), requested);

        (uint256 finishAfter, uint256 rateAfter, uint256 updateAfter, uint256 indexAfter) =
            bribe.rewardData(address(reward));
        assertEq(finishAfter, finishBefore);
        assertEq(rateAfter, rateBefore);
        assertEq(updateAfter, updateBefore);
        assertEq(indexAfter, indexBefore);
        assertEq(reward.balanceOf(address(this)), callerBalanceBefore);
        assertEq(reward.balanceOf(address(bribe)), bribeBalanceBefore);
        assertEq(bribe.lifetimeRewardNotified(address(reward)), 10 * WEEK);
    }

    function test_ActiveTopUpEqualToTheAmountLeftIsAccepted() external {
        bribe.addSignalWeight(ALICE, 1);
        _notify(10 * WEEK);
        vm.warp(block.timestamp + 1 days);

        uint256 remaining = bribe.remainingReward(address(reward));
        _notify(remaining);

        (uint256 finish, uint256 rate, uint256 updatedAt,) = bribe.rewardData(address(reward));
        assertEq(rate, (remaining + remaining) / WEEK);
        assertEq(finish, block.timestamp + WEEK);
        assertEq(updatedAt, block.timestamp);
        assertEq(bribe.lifetimeRewardNotified(address(reward)), 10 * WEEK + remaining);
    }

    function test_ActiveTopUpUsesStandardLeftoverRolloverAndRestartsSevenDays() external {
        bribe.addSignalWeight(ALICE, 1);
        _notify(10 * WEEK);
        vm.warp(block.timestamp + 2 days);

        uint256 remaining = bribe.remainingReward(address(reward));
        uint256 topUp = remaining + 3 * WEEK;
        _notify(topUp);

        (uint256 finish, uint256 rate, uint256 updatedAt,) = bribe.rewardData(address(reward));
        assertEq(rate, (topUp + remaining) / WEEK);
        assertEq(finish, block.timestamp + WEEK);
        assertEq(updatedAt, block.timestamp);
        assertEq(bribe.remainingReward(address(reward)), rate * WEEK);
    }

    function test_ElapsedRewardsAtZeroSupplyRemainUnclaimableSurplus() external {
        uint256 rate = 10;
        _notify(rate * WEEK);

        vm.warp(block.timestamp + 3 days);
        bribe.addSignalWeight(ALICE, 1);
        assertEq(bribe.earned(ALICE, address(reward)), 0);

        vm.warp(block.timestamp + 4 days);
        assertEq(bribe.claimReward(ALICE, address(reward)), rate * 4 days);
        assertEq(reward.balanceOf(address(bribe)), rate * 3 days);
    }

    function test_VirtualBalanceChangesCheckpointPriorWeights() external {
        uint256 rate = 7;
        bribe.addSignalWeight(ALICE, 100 ether);
        _notify(rate * WEEK);

        vm.warp(block.timestamp + 2 days);
        bribe.addSignalWeight(BOB, 100 ether);
        assertEq(bribe.earned(ALICE, address(reward)), rate * 2 days);
        assertEq(bribe.earned(BOB, address(reward)), 0);

        vm.warp(block.timestamp + 1 days);
        bribe.removeSignalWeight(ALICE, 50 ether);
        assertEq(bribe.earned(ALICE, address(reward)), rate * 2 days + (rate * 1 days) / 2);
        assertEq(bribe.earned(BOB, address(reward)), (rate * 1 days) / 2);
        assertEq(bribe.signalWeightOf(ALICE), 50 ether);
        assertEq(bribe.totalSignalWeight(), 150 ether);
    }

    function test_AllTokenClaimPaysEachRegisteredRewardToTheEntitledAccount() external {
        bribe.addRewardToken(address(secondReward));
        bribe.addSignalWeight(ALICE, 1);
        _notify(3 * WEEK);

        uint256 secondAmount = 5 * WEEK;
        secondReward.mint(address(this), secondAmount);
        secondReward.approve(address(bribe), secondAmount);
        bribe.notifyReward(address(secondReward), secondAmount);

        vm.warp(block.timestamp + WEEK);
        vm.prank(OUTSIDER);
        bribe.claimRewards(ALICE);

        assertEq(reward.balanceOf(ALICE), 3 * WEEK);
        assertEq(secondReward.balanceOf(ALICE), secondAmount);
        assertEq(reward.balanceOf(OUTSIDER), 0);
        assertEq(secondReward.balanceOf(OUTSIDER), 0);
    }

    function test_ClaimValidationAndEmptyClaimAreHarmless() external {
        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.claimRewards(address(0));

        vm.expectRevert(abi.encodeWithSelector(Bribe.NotRewardToken.selector, address(secondReward)));
        bribe.claimReward(ALICE, address(secondReward));

        assertEq(bribe.claimReward(CAROL, address(reward)), 0);
    }

    function testFuzz_VirtualSupplyMatchesTheSumOfBalances(uint256 first, uint256 second, uint256 exit) external {
        uint256 aliceWeight = bound(first, 1, 1e30);
        uint256 bobWeight = bound(second, 1, 1e30);
        uint256 exitAmount = bound(exit, 1, aliceWeight);

        bribe.addSignalWeight(ALICE, aliceWeight);
        bribe.addSignalWeight(BOB, bobWeight);
        bribe.removeSignalWeight(ALICE, exitAmount);

        assertEq(bribe.signalWeightOf(ALICE), aliceWeight - exitAmount);
        assertEq(bribe.signalWeightOf(BOB), bobWeight);
        assertEq(bribe.totalSignalWeight(), bribe.signalWeightOf(ALICE) + bribe.signalWeightOf(BOB));
    }

    function testFuzz_ClaimsNeverExceedTokenCustody(uint256 amount, uint256 elapsed) external {
        uint256 notified = bound(amount, WEEK, 1e30);
        uint256 wait = bound(elapsed, 0, 2 * WEEK);
        bribe.addSignalWeight(ALICE, 3 ether);
        bribe.addSignalWeight(BOB, 2 ether);
        _notify(notified);

        vm.warp(block.timestamp + wait);
        uint256 owed = bribe.earned(ALICE, address(reward)) + bribe.earned(BOB, address(reward));
        assertLe(owed, reward.balanceOf(address(bribe)));
        assertLe(owed, notified);
    }

    function _notify(uint256 amount) private {
        reward.mint(address(this), amount);
        reward.approve(address(bribe), amount);
        bribe.notifyReward(address(reward), amount);
    }
}
