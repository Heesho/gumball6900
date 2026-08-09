// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { FeeOnTransferToken, MockERC20 } from "./utils/Tokens.sol";

/// @title BribeTest
/// @notice Drives the reward stream directly, with the test contract acting as Resonance.
/// @dev Deposits and withdrawals are virtual, so this suite isolates streaming maths from signal accounting.
contract BribeTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);
    address private constant OUTSIDER = address(0x0075);

    uint256 private constant WEEK = 7 days;

    Bribe private bribe;
    MockERC20 private reward;
    MockERC20 private secondReward;

    event RewardAdded(address indexed rewardToken);
    event RewardNotified(address indexed rewardToken, uint256 amount);
    event RewardPaid(address indexed account, address indexed rewardToken, uint256 amount);
    event SignalWeightDeposited(address indexed account, uint256 amount);
    event SignalWeightWithdrawn(address indexed account, uint256 amount);

    function setUp() external {
        vm.warp(365 days);
        bribe = new Bribe(address(this));
        reward = new MockERC20("Reward", "RWD", 18);
        secondReward = new MockERC20("Second Reward", "RWD2", 6);
        bribe.addRewardToken(address(reward));
    }

    /*//////////////////////////////////////////////////////////////
                         ACCESS AND VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_ConstructorRejectsZeroAndEOAResonance() external {
        vm.expectRevert(Bribe.ZeroAddress.selector);
        new Bribe(address(0));

        vm.expectRevert(Bribe.ZeroAddress.selector);
        new Bribe(ALICE);
    }

    function test_VirtualBalanceMutationIsResonanceOnly() external {
        vm.startPrank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(Bribe.NotResonance.selector, OUTSIDER));
        bribe.deposit(1 ether, ALICE);

        vm.expectRevert(abi.encodeWithSelector(Bribe.NotResonance.selector, OUTSIDER));
        bribe.withdraw(1 ether, ALICE);

        vm.expectRevert(abi.encodeWithSelector(Bribe.NotResonance.selector, OUTSIDER));
        bribe.addRewardToken(address(secondReward));
        vm.stopPrank();
    }

    function test_DepositAndWithdrawRejectDegenerateArguments() external {
        vm.expectRevert(Bribe.ZeroAmount.selector);
        bribe.deposit(0, ALICE);

        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.deposit(1 ether, address(0));

        vm.expectRevert(Bribe.ZeroAmount.selector);
        bribe.withdraw(0, ALICE);

        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.withdraw(1 ether, address(0));
    }

    function test_WithdrawingMoreThanTheVirtualBalanceUnderflows() external {
        bribe.deposit(1 ether, ALICE);

        vm.expectRevert();
        bribe.withdraw(1 ether + 1, ALICE);
    }

    function test_AddRewardTokenRejectsZeroEOAAndDuplicates() external {
        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.addRewardToken(address(0));

        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.addRewardToken(ALICE);

        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardAlreadyAdded.selector, address(reward)));
        bribe.addRewardToken(address(reward));
    }

    function test_RewardTokensAreListedInInsertionOrder() external {
        vm.expectEmit(true, false, false, false);
        emit RewardAdded(address(secondReward));
        bribe.addRewardToken(address(secondReward));

        address[] memory tokens = bribe.rewardTokens();
        assertEq(tokens.length, 2);
        assertEq(tokens[0], address(reward));
        assertEq(tokens[1], address(secondReward));
        assertTrue(bribe.isRewardToken(address(reward)));
        assertTrue(bribe.isRewardToken(address(secondReward)));
        assertFalse(bribe.isRewardToken(CAROL));
    }

    function test_RewardTokenCountIsPermanentlyCappedAtEight() external {
        for (uint256 i = 1; i < bribe.MAX_REWARD_TOKENS(); ++i) {
            MockERC20 extra = new MockERC20("Extra Reward", "XTRA", 18);
            bribe.addRewardToken(address(extra));
        }
        assertEq(bribe.rewardTokens().length, 8);

        MockERC20 ninth = new MockERC20("Ninth Reward", "NINTH", 18);
        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardTokenLimitReached.selector, uint256(8)));
        bribe.addRewardToken(address(ninth));
    }

    /*//////////////////////////////////////////////////////////////
                            NOTIFY VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_NotifyRejectsAnUnregisteredToken() external {
        vm.expectRevert(abi.encodeWithSelector(Bribe.NotRewardToken.selector, address(secondReward)));
        bribe.notifyRewardAmount(address(secondReward), 10 ether);
    }

    function test_NotifyRejectsAnAmountThatCannotSustainANonZeroRate() external {
        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardBelowDuration.selector, WEEK - 1));
        bribe.notifyRewardAmount(address(reward), WEEK - 1);
    }

    function test_NotifyRejectsAnAmountThatWouldShrinkALiveStream() external {
        _notify(70 ether);
        vm.warp(block.timestamp + 1 days);

        uint256 remaining = bribe.left(address(reward));
        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardBelowRemaining.selector, remaining, remaining));
        bribe.notifyRewardAmount(address(reward), remaining);
    }

    function test_NotifyRejectsAFeeOnTransferRewardToken() external {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(18);
        bribe.addRewardToken(address(feeToken));
        feeToken.mint(address(this), 70 ether);
        feeToken.approve(address(bribe), 70 ether);
        feeToken.setFeeBps(100);

        vm.expectRevert(
            abi.encodeWithSelector(Bribe.InexactRewardTransfer.selector, 70 ether, (70 ether * 9_900) / 10_000)
        );
        bribe.notifyRewardAmount(address(feeToken), 70 ether);
    }

    /*//////////////////////////////////////////////////////////////
                            STREAM MECHANICS
    //////////////////////////////////////////////////////////////*/

    function test_NotifyStartsASevenDayStreamAtTheFlooredRate() external {
        bribe.deposit(100 ether, ALICE);
        reward.mint(address(this), 70 ether);
        reward.approve(address(bribe), 70 ether);

        vm.expectEmit(true, false, false, true);
        emit RewardNotified(address(reward), 70 ether);
        bribe.notifyRewardAmount(address(reward), 70 ether);

        (uint256 periodFinish, uint256 rewardRate, uint256 lastUpdateTime,) = bribe.rewardData(address(reward));
        assertEq(rewardRate, 70 ether / WEEK);
        assertEq(periodFinish, block.timestamp + WEEK);
        assertEq(lastUpdateTime, block.timestamp);
        assertEq(bribe.left(address(reward)), (70 ether / WEEK) * WEEK);
    }

    function test_LeftAndApplicableTimeCollapseAfterThePeriodEnds() external {
        bribe.deposit(100 ether, ALICE);
        _notify(70 ether);
        uint256 finish = block.timestamp + WEEK;

        vm.warp(finish - 1);
        assertEq(bribe.lastTimeRewardApplicable(address(reward)), finish - 1);
        assertGt(bribe.left(address(reward)), 0);

        vm.warp(finish + 1 days);
        assertEq(bribe.lastTimeRewardApplicable(address(reward)), finish);
        assertEq(bribe.left(address(reward)), 0);
    }

    function test_ATopUpRollsTheUndistributedRemainderIntoTheNewStream() external {
        bribe.deposit(100 ether, ALICE);
        _notify(70 ether);
        uint256 firstRate = 70 ether / WEEK;

        vm.warp(block.timestamp + 3 days);
        uint256 remaining = bribe.left(address(reward));
        assertEq(remaining, firstRate * 4 days);

        _notify(140 ether);
        (, uint256 rewardRate,,) = bribe.rewardData(address(reward));
        assertEq(rewardRate, (140 ether + remaining) / WEEK);
    }

    function test_AccrualIsProportionalToVirtualWeight() external {
        bribe.deposit(75 ether, ALICE);
        bribe.deposit(25 ether, BOB);
        _notify(70 ether);

        vm.warp(block.timestamp + WEEK);

        uint256 aliceEarned = bribe.earned(ALICE, address(reward));
        uint256 bobEarned = bribe.earned(BOB, address(reward));

        assertApproxEqRel(aliceEarned, (70 ether * 3) / 4, 1e12);
        assertApproxEqRel(bobEarned, 70 ether / 4, 1e12);
        assertLe(aliceEarned + bobEarned, 70 ether, "the stream can never over-distribute");
    }

    function test_ALateArrivalEarnsNothingForTheElapsedPortion() external {
        bribe.deposit(100 ether, ALICE);
        _notify(70 ether);

        vm.warp(block.timestamp + 3 days);
        bribe.deposit(100 ether, BOB);

        assertEq(bribe.earned(BOB, address(reward)), 0);
        assertApproxEqRel(bribe.earned(ALICE, address(reward)), (70 ether * 3) / 7, 1e12);

        vm.warp(block.timestamp + 4 days);
        assertApproxEqRel(bribe.earned(BOB, address(reward)), (70 ether * 2) / 7, 1e12);
    }

    /*//////////////////////////////////////////////////////////////
                                CLAIMING
    //////////////////////////////////////////////////////////////*/

    function test_ClaimRejectsTheZeroAccount() external {
        vm.expectRevert(Bribe.ZeroAddress.selector);
        bribe.claimRewards(address(0));
    }

    function test_ClaimAlwaysPaysTheAccountEvenWhenATtriggeredByAThirdParty() external {
        bribe.deposit(100 ether, ALICE);
        _notify(70 ether);
        vm.warp(block.timestamp + WEEK);

        uint256 expected = bribe.earned(ALICE, address(reward));
        vm.prank(OUTSIDER);
        vm.expectEmit(true, true, false, true);
        emit RewardPaid(ALICE, address(reward), expected);
        bribe.claimRewards(ALICE);

        assertEq(reward.balanceOf(ALICE), expected);
        assertEq(reward.balanceOf(OUTSIDER), 0);
        assertEq(bribe.earned(ALICE, address(reward)), 0);
    }

    function test_ClaimingTwiceInARowPaysNothingTheSecondTime() external {
        bribe.deposit(100 ether, ALICE);
        _notify(70 ether);
        vm.warp(block.timestamp + WEEK);

        bribe.claimRewards(ALICE);
        uint256 balanceAfterFirst = reward.balanceOf(ALICE);
        bribe.claimRewards(ALICE);

        assertEq(reward.balanceOf(ALICE), balanceAfterFirst);
    }

    function test_ClaimingWithNoAccrualIsAHarmlessNoOp() external {
        bribe.claimRewards(CAROL);
        assertEq(reward.balanceOf(CAROL), 0);
    }

    function test_MultipleRewardTokensAccrueIndependently() external {
        bribe.addRewardToken(address(secondReward));
        bribe.deposit(100 ether, ALICE);

        _notify(70 ether);

        // An exact multiple of the duration avoids rate flooring, isolating the multi-token behavior.
        uint256 secondAmount = WEEK * 10;
        secondReward.mint(address(this), secondAmount);
        secondReward.approve(address(bribe), secondAmount);
        bribe.notifyRewardAmount(address(secondReward), secondAmount);

        vm.warp(block.timestamp + WEEK);
        bribe.claimRewards(ALICE);

        assertApproxEqRel(reward.balanceOf(ALICE), 70 ether, 1e12);
        assertEq(secondReward.balanceOf(ALICE), secondAmount);
    }

    /// @notice A low-decimal reward token loses the whole rate remainder, which can be a large share of a small stream.
    /// @dev `rewardRate = amount / 604800` floors, so for six-decimal USDG the loss is material at realistic sizes.
    ///      A stream of 7.0 USDG strands 4.96% of itself; a stream of 1.209599 USDG strands 50%.
    function test_LowDecimalRewardTokensLoseTheEntireRateRemainder() external {
        bribe.addRewardToken(address(secondReward));
        bribe.deposit(100 ether, ALICE);

        uint256 amount = 7_000_000; // 7.00 USDG at six decimals
        secondReward.mint(address(this), amount);
        secondReward.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(secondReward), amount);

        vm.warp(block.timestamp + WEEK);
        bribe.claimRewards(ALICE);

        uint256 distributed = (amount / WEEK) * WEEK;
        uint256 stranded = amount - distributed;

        assertEq(secondReward.balanceOf(ALICE), distributed);
        assertEq(secondReward.balanceOf(address(bribe)), stranded);
        assertEq(stranded, 347_200);
        assertGt((stranded * 10_000) / amount, 400, "over four percent of a seven dollar stream is lost");
    }

    /// @notice At the smallest amount the router will forward, half of a two-unit-per-second stream is lost.
    function test_TheWorstCaseRateFlooringLossIsAlmostHalfOfTheStream() external {
        bribe.addRewardToken(address(secondReward));
        bribe.deposit(100 ether, ALICE);

        uint256 amount = 2 * WEEK - 1; // rate floors from 1.999... down to 1
        secondReward.mint(address(this), amount);
        secondReward.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(secondReward), amount);

        vm.warp(block.timestamp + WEEK);
        bribe.claimRewards(ALICE);

        assertEq(secondReward.balanceOf(ALICE), WEEK);
        assertEq(secondReward.balanceOf(address(bribe)), WEEK - 1);
    }

    /*//////////////////////////////////////////////////////////////
                       STRANDED VALUE (DOCUMENTED)
    //////////////////////////////////////////////////////////////*/

    /// @notice Rewards that elapse while no signal weight exists are permanently unreachable.
    /// @dev `rewardPerToken` cannot advance with a zero total supply, but `updateReward` still moves
    ///      `lastUpdateTime` forward, so that slice of the stream is skipped and never re-enters accounting.
    function test_RewardsElapsingWithZeroSignalWeightAreStrandedForever() external {
        bribe.deposit(100 ether, ALICE);
        _notify(70 ether);
        uint256 rate = 70 ether / WEEK;

        vm.warp(block.timestamp + 1 days);
        bribe.withdraw(100 ether, ALICE);
        assertEq(bribe.totalSupply(), 0);

        // Three days pass with nobody signaling for this Strategy.
        vm.warp(block.timestamp + 3 days);
        bribe.deposit(100 ether, BOB);

        vm.warp(block.timestamp + 3 days);
        bribe.claimRewards(ALICE);
        bribe.claimRewards(BOB);

        uint256 paidOut = reward.balanceOf(ALICE) + reward.balanceOf(BOB);
        uint256 stranded = reward.balanceOf(address(bribe));

        assertApproxEqAbs(reward.balanceOf(ALICE), rate * 1 days, 1e6);
        assertApproxEqAbs(reward.balanceOf(BOB), rate * 3 days, 1e6);
        assertApproxEqRel(stranded, (70 ether * 3) / 7, 1e12, "three of seven days are lost");
        assertEq(paidOut + stranded, 70 ether);

        // A later stream cannot recover the stranded balance: only freshly transferred amounts are scheduled.
        _notify(70 ether);
        (, uint256 rewardRate,,) = bribe.rewardData(address(reward));
        assertEq(rewardRate, 70 ether / WEEK, "the stranded balance is not rescheduled");
    }

    /// @notice The floored reward rate leaves a permanent remainder of up to one week minus one wei.
    function test_TheFlooredRewardRateStrandsTheRemainder() external {
        bribe.deposit(100 ether, ALICE);
        uint256 amount = WEEK + WEEK - 1; // rate floors to 1, remainder is WEEK - 1
        _notify(amount);

        vm.warp(block.timestamp + WEEK);
        bribe.claimRewards(ALICE);

        assertEq(reward.balanceOf(ALICE), WEEK);
        assertEq(reward.balanceOf(address(bribe)), WEEK - 1, "the division remainder is unreachable");
    }

    /// @notice Anyone may extend a live stream, which delays payout but can never reduce the total.
    function test_AnOutsiderCanExtendTheStreamAsADonationOnly() external {
        bribe.deposit(100 ether, ALICE);
        _notify(70 ether);

        vm.warp(block.timestamp + 6 days);
        uint256 remainingBefore = bribe.left(address(reward));

        reward.mint(OUTSIDER, 700 ether);
        vm.startPrank(OUTSIDER);
        reward.approve(address(bribe), 700 ether);
        bribe.notifyRewardAmount(address(reward), 700 ether);
        vm.stopPrank();

        assertEq(bribe.left(address(reward)), ((700 ether + remainingBefore) / WEEK) * WEEK);

        vm.warp(block.timestamp + WEEK);
        bribe.claimRewards(ALICE);
        assertApproxEqRel(reward.balanceOf(ALICE), 770 ether, 1e12, "the extension only adds value");
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @notice The Bribe always holds enough of the reward token to cover every account's accrual.
    function testFuzz_BribeIsAlwaysSolventAgainstAccruedRewards(
        uint256 aliceWeight,
        uint256 bobWeight,
        uint256 amount,
        uint256 elapsed
    ) external {
        uint256 first = bound(aliceWeight, 1, 1e24);
        uint256 second = bound(bobWeight, 1, 1e24);
        uint256 notified = bound(amount, WEEK, 1e30);
        uint256 wait = bound(elapsed, 0, 3 * WEEK);

        bribe.deposit(first, ALICE);
        bribe.deposit(second, BOB);
        _notify(notified);

        vm.warp(block.timestamp + wait);

        uint256 owed = bribe.earned(ALICE, address(reward)) + bribe.earned(BOB, address(reward));
        assertLe(owed, reward.balanceOf(address(bribe)), "accrual must never exceed the held balance");
        assertLe(owed, notified);
    }

    /// @notice Claimed totals across all participants never exceed what was streamed in.
    function testFuzz_TotalPaidNeverExceedsTotalNotified(uint256 amount, uint256 splitBps, uint256 elapsed) external {
        uint256 notified = bound(amount, WEEK, 1e30);
        uint256 share = bound(splitBps, 1, 9_999);
        uint256 wait = bound(elapsed, 0, 4 * WEEK);

        uint256 total = 1e21;
        bribe.deposit((total * share) / 10_000, ALICE);
        bribe.deposit(total - (total * share) / 10_000, BOB);
        _notify(notified);

        vm.warp(block.timestamp + wait);
        bribe.claimRewards(ALICE);
        bribe.claimRewards(BOB);

        assertLe(reward.balanceOf(ALICE) + reward.balanceOf(BOB), notified);
        assertEq(
            reward.balanceOf(ALICE) + reward.balanceOf(BOB) + reward.balanceOf(address(bribe)),
            notified,
            "every notified wei is either paid or still held"
        );
    }

    /// @notice Virtual balances track deposits and withdrawals exactly.
    function testFuzz_VirtualSupplyMatchesTheSumOfBalances(uint256 first, uint256 second, uint256 exit) external {
        uint256 aliceWeight = bound(first, 1, 1e30);
        uint256 bobWeight = bound(second, 1, 1e30);
        uint256 exitAmount = bound(exit, 1, aliceWeight);

        bribe.deposit(aliceWeight, ALICE);
        bribe.deposit(bobWeight, BOB);
        bribe.withdraw(exitAmount, ALICE);

        assertEq(bribe.balanceOf(ALICE), aliceWeight - exitAmount);
        assertEq(bribe.balanceOf(BOB), bobWeight);
        assertEq(bribe.totalSupply(), bribe.balanceOf(ALICE) + bribe.balanceOf(BOB));
    }

    function _notify(uint256 amount) private {
        reward.mint(address(this), amount);
        reward.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(reward), amount);
    }
}
