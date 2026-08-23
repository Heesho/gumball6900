// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { MissingReturnToken, MockERC20, ReentrantToken, RevertingToken } from "./utils/Tokens.sol";

/// @title BribeRewardFlowTest
/// @notice Covers bounded accounting and failure isolation without extending the core reward model.
contract BribeRewardFlowTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant OUTSIDER = address(0x0075);

    uint256 private constant WEEK = 7 days;

    Bribe private bribe;
    MockERC20 private reward;

    function setUp() external {
        vm.warp(365 days);
        bribe = new Bribe(address(this));
        reward = new MockERC20("Reward", "RWD", 18);
        bribe.addRewardToken(address(reward));
    }

    function test_AllTokenFailureIsAtomicAndScalarClaimsIsolateABrokenToken() external {
        RevertingToken broken = new RevertingToken(18);
        bribe.addRewardToken(address(broken));
        bribe.deposit(1, ALICE);

        uint256 healthyAmount = 10 * WEEK;
        uint256 brokenAmount = 5 * WEEK;
        _notify(reward, healthyAmount);
        broken.mint(address(this), brokenAmount);
        broken.approve(address(bribe), brokenAmount);
        bribe.notifyRewardAmount(address(broken), brokenAmount);
        vm.warp(block.timestamp + WEEK);

        broken.setBlocked(ALICE, true);
        vm.expectRevert("BLOCKED");
        bribe.claimRewards(ALICE);

        assertEq(reward.balanceOf(ALICE), 0, "the healthy transfer must roll back with the convenience claim");
        assertEq(bribe.earned(ALICE, address(reward)), healthyAmount);
        assertEq(bribe.earned(ALICE, address(broken)), brokenAmount);

        vm.prank(OUTSIDER);
        assertEq(bribe.claimReward(ALICE, address(reward)), healthyAmount);
        assertEq(reward.balanceOf(ALICE), healthyAmount);

        vm.expectRevert("BLOCKED");
        bribe.claimReward(ALICE, address(broken));
        assertEq(bribe.earned(ALICE, address(broken)), brokenAmount);

        broken.setBlocked(ALICE, false);
        assertEq(bribe.claimReward(ALICE, address(broken)), brokenAmount);
        assertEq(broken.balanceOf(ALICE), brokenAmount);
    }

    function test_LifetimeCapIsCheckedBeforeCheckpointOrTokenTransfer() external {
        RevertingToken capped = new RevertingToken(18);
        bribe.addRewardToken(address(capped));
        bribe.deposit(1, ALICE);

        uint256 maximum = bribe.MAX_LIFETIME_REWARD_AMOUNT();
        capped.mint(address(this), maximum + WEEK);
        capped.approve(address(bribe), maximum + WEEK);
        bribe.notifyRewardAmount(address(capped), maximum);

        vm.warp(block.timestamp + 1 days);
        (uint256 finishBefore, uint256 rateBefore, uint256 updateBefore, uint256 indexBefore) =
            bribe.rewardData(address(capped));
        uint256 callerBalanceBefore = capped.balanceOf(address(this));
        uint256 bribeBalanceBefore = capped.balanceOf(address(bribe));
        uint256 allowanceBefore = capped.allowance(address(this), address(bribe));

        capped.setTransfersRevert(true);
        vm.expectRevert(
            abi.encodeWithSelector(
                Bribe.RewardLifetimeCapExceeded.selector, address(capped), maximum, uint256(WEEK), maximum
            )
        );
        bribe.notifyRewardAmount(address(capped), WEEK);

        (uint256 finishAfter, uint256 rateAfter, uint256 updateAfter, uint256 indexAfter) =
            bribe.rewardData(address(capped));
        assertEq(finishAfter, finishBefore);
        assertEq(rateAfter, rateBefore);
        assertEq(updateAfter, updateBefore);
        assertEq(indexAfter, indexBefore);
        assertEq(capped.balanceOf(address(this)), callerBalanceBefore);
        assertEq(capped.balanceOf(address(bribe)), bribeBalanceBefore);
        assertEq(capped.allowance(address(this), address(bribe)), allowanceBefore);
        assertEq(bribe.lifetimeRewardNotified(address(capped)), maximum);
    }

    function test_TwoCompletedStreamsMayConsumeTheLifetimeCapWithoutReopeningIt() external {
        bribe.deposit(1, ALICE);
        uint256 maximum = bribe.MAX_LIFETIME_REWARD_AMOUNT();
        uint256 first = maximum / 2;
        uint256 second = maximum - first;
        reward.mint(address(this), maximum + WEEK);
        reward.approve(address(bribe), maximum + WEEK);

        bribe.notifyRewardAmount(address(reward), first);
        vm.warp(block.timestamp + WEEK);
        uint256 firstPaid = bribe.claimReward(ALICE, address(reward));
        assertEq(firstPaid, first - (first % WEEK));

        bribe.notifyRewardAmount(address(reward), second);
        vm.warp(block.timestamp + WEEK);
        uint256 secondPaid = bribe.claimReward(ALICE, address(reward));
        assertEq(secondPaid, second - (second % WEEK));
        assertEq(bribe.lifetimeRewardNotified(address(reward)), maximum);
        assertLe(firstPaid + secondPaid, maximum);

        vm.expectRevert(
            abi.encodeWithSelector(
                Bribe.RewardLifetimeCapExceeded.selector, address(reward), maximum, uint256(WEEK), maximum
            )
        );
        bribe.notifyRewardAmount(address(reward), WEEK);
    }

    function test_MissingReturnRewardTokenCompletesIngressAndPayout() external {
        MissingReturnToken noReturn = new MissingReturnToken(6);
        bribe.addRewardToken(address(noReturn));
        bribe.deposit(1, ALICE);

        uint256 amount = 10 * WEEK;
        noReturn.mint(address(this), amount);
        noReturn.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(noReturn), amount);
        vm.warp(block.timestamp + WEEK);

        assertEq(bribe.claimReward(ALICE, address(noReturn)), amount);
        assertEq(noReturn.balanceOf(ALICE), amount);
        assertEq(noReturn.balanceOf(address(bribe)), 0);
    }

    function test_ReentrantRewardPayoutCannotDoubleClaim() external {
        ReentrantToken hostile = new ReentrantToken(18);
        bribe.addRewardToken(address(hostile));
        bribe.deposit(1, ALICE);

        uint256 amount = 10 * WEEK;
        hostile.mint(address(this), amount);
        hostile.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(hostile), amount);
        vm.warp(block.timestamp + WEEK);

        hostile.arm(address(bribe), abi.encodeCall(Bribe.claimReward, (ALICE, address(hostile))));
        vm.prank(OUTSIDER);
        assertEq(bribe.claimReward(ALICE, address(hostile)), amount);

        assertEq(hostile.callCount(), 1);
        assertFalse(hostile.lastCallSucceeded());
        assertEq(_selectorOf(hostile.lastReturnData()), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(hostile.balanceOf(ALICE), amount);
        assertEq(bribe.earned(ALICE, address(hostile)), 0);
    }

    function _notify(MockERC20 token, uint256 amount) private {
        token.mint(address(this), amount);
        token.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(token), amount);
    }

    function _selectorOf(bytes memory data) private pure returns (bytes4 selector) {
        assembly ("memory-safe") {
            selector := mload(add(data, 0x20))
        }
    }
}

/// @title BribeRetirementCompatibilityTest
/// @notice Proves a killed Strategy remains exitable while its zero-supply interval simply becomes surplus.
contract BribeRetirementCompatibilityTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
    }

    function test_KilledStrategySignalCanExitAndCannotEarnAfterExit() external {
        _signalDefault(ALICE, 100 ether);

        uint256 streamed = 7 days;
        target.mint(DAVE, streamed);
        vm.startPrank(DAVE);
        target.approve(address(targetBribe), streamed);
        targetBribe.notifyRewardAmount(address(target), streamed);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        resonance.killStrategy(address(targetStrategy));

        vm.prank(ALICE);
        signalGBX.withdrawSignal(address(targetStrategy), 100 ether);
        assertEq(targetBribe.claimReward(ALICE, address(target)), 1 days);
        assertEq(target.balanceOf(ALICE), 1 days);
        assertEq(targetBribe.totalSupply(), 0);

        _mintTestGBX(BOB, 1 ether);
        vm.startPrank(BOB);
        gbx.approve(address(signalGBX), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        signalGBX.signal(address(targetStrategy), 1 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 6 days);
        assertEq(targetBribe.claimReward(ALICE, address(target)), 0);
        assertEq(target.balanceOf(address(targetBribe)), streamed - 1 days);
    }
}
