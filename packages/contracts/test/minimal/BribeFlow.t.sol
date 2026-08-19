// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Test } from "forge-std/Test.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken, MissingReturnToken, MockERC20, ReentrantToken, RevertingToken } from "./utils/Tokens.sol";

/// @title BribeRewardFlowTest
/// @notice Adversarial reward-flow proofs isolated from Strategy and signal routing.
contract BribeRewardFlowTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);
    address private constant OUTSIDER = address(0x0075);

    uint256 private constant WEEK = 7 days;

    Bribe private bribe;
    MockERC20 private reward;

    function fund() external view returns (address fundAddress) {
        return address(this);
    }

    function setUp() external {
        vm.warp(365 days);
        bribe = new Bribe(address(this));
        reward = new MockERC20("Reward", "RWD", 18);
        bribe.addRewardToken(address(reward));
    }

    /// @notice Wall-clock pauses never alter the exact active-time ownership of any reward unit.
    function testFuzz_RepeatedZeroSupplyPausesPreserveEveryEarlyRemainderUnit(
        uint256 rawAmount,
        uint256 rawFirstCut,
        uint256 rawSecondCut,
        uint256 rawFirstPause,
        uint256 rawSecondPause
    ) external {
        uint256 amount = bound(rawAmount, 1, 4 * WEEK);
        uint256 firstCut = bound(rawFirstCut, 0, WEEK);
        uint256 secondCut = bound(rawSecondCut, firstCut, WEEK);
        uint256 firstPause = bound(rawFirstPause, 0, 365 days);
        uint256 secondPause = bound(rawSecondPause, 0, 365 days);

        bribe.deposit(1, ALICE);
        _notify(reward, amount);

        vm.warp(block.timestamp + firstCut);
        bribe.withdraw(1, ALICE);
        vm.warp(block.timestamp + firstPause);
        bribe.deposit(1, BOB);

        vm.warp(block.timestamp + secondCut - firstCut);
        bribe.withdraw(1, BOB);
        vm.warp(block.timestamp + secondPause);
        bribe.deposit(1, CAROL);

        vm.warp(block.timestamp + WEEK - secondCut);
        bribe.claimReward(ALICE, address(reward));
        bribe.claimReward(BOB, address(reward));
        bribe.claimReward(CAROL, address(reward));

        uint256 throughFirstCut = _freshEmission(amount, firstCut);
        uint256 throughSecondCut = _freshEmission(amount, secondCut);
        assertEq(reward.balanceOf(ALICE), throughFirstCut);
        assertEq(reward.balanceOf(BOB), throughSecondCut - throughFirstCut);
        assertEq(reward.balanceOf(CAROL), amount - throughSecondCut);
        assertEq(reward.balanceOf(ALICE) + reward.balanceOf(BOB) + reward.balanceOf(CAROL), amount);

        assertEq(reward.balanceOf(address(bribe)), 0);
        assertEq(bribe.accountedRewardBalance(address(reward)), 0);
        assertEq(bribe.scheduledRewards(address(reward)), 0);
        assertEq(bribe.queuedRewards(address(reward)), 0);
        assertEq(bribe.pendingRewardScaled(address(reward)), 0);
        assertEq(bribe.indexedRewardScaled(address(reward)), 0);
        assertEq(bribe.fundRewardLiability(address(reward)), 0);
        assertEq(bribe.fundRewardRemainder(address(reward)), 0);
    }

    /// @notice A token that mutates after notification cannot short-pay a signaler or consume their liability.
    function test_FeeEnabledAfterNotificationRollsBackTheClaimAndCanRetry() external {
        FeeOnTransferToken mutableReward = new FeeOnTransferToken(18);
        bribe.addRewardToken(address(mutableReward));
        bribe.deposit(1, ALICE);

        uint256 amount = 70 ether;
        mutableReward.mint(address(this), amount);
        mutableReward.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(mutableReward), amount);
        vm.warp(block.timestamp + WEEK);

        mutableReward.setFeeBps(100);
        vm.expectRevert(
            abi.encodeWithSelector(Bribe.InexactRewardPayout.selector, ALICE, amount, amount, (amount * 9_900) / 10_000)
        );
        bribe.claimReward(ALICE, address(mutableReward));

        assertEq(mutableReward.balanceOf(ALICE), 0);
        assertEq(mutableReward.balanceOf(mutableReward.FEE_SINK()), 0);
        assertEq(bribe.earned(ALICE, address(mutableReward)), amount);
        assertEq(bribe.accountedRewardBalance(address(mutableReward)), amount);

        mutableReward.setFeeBps(0);
        assertEq(bribe.claimReward(ALICE, address(mutableReward)), amount);
        assertEq(mutableReward.balanceOf(ALICE), amount);
        assertEq(bribe.accountedRewardBalance(address(mutableReward)), 0);
    }

    /// @notice A broken token in the all-token convenience claim cannot consume an earlier healthy payout.
    function test_AllTokenClaimFailureIsAtomicAndScalarClaimsRemainIndependent() external {
        RevertingToken broken = new RevertingToken(18);
        bribe.addRewardToken(address(broken));
        bribe.deposit(1, ALICE);

        uint256 healthyAmount = 700;
        uint256 brokenAmount = 350;
        _notify(reward, healthyAmount);
        broken.mint(address(this), brokenAmount);
        broken.approve(address(bribe), brokenAmount);
        bribe.notifyRewardAmount(address(broken), brokenAmount);
        vm.warp(block.timestamp + WEEK);

        broken.setBlocked(ALICE, true);
        vm.expectRevert("BLOCKED");
        bribe.claimRewards(ALICE);

        assertEq(reward.balanceOf(ALICE), 0, "the earlier healthy transfer must also roll back");
        assertEq(bribe.earned(ALICE, address(reward)), healthyAmount);
        assertEq(bribe.earned(ALICE, address(broken)), brokenAmount);

        assertEq(bribe.claimReward(ALICE, address(reward)), healthyAmount);
        broken.setBlocked(ALICE, false);
        assertEq(bribe.claimReward(ALICE, address(broken)), brokenAmount);
        assertEq(reward.balanceOf(ALICE), healthyAmount);
        assertEq(broken.balanceOf(ALICE), brokenAmount);
    }

    /// @notice Failed Fund settlement preserves the complete liability accumulated from exiting-user dust.
    function test_FrozenFundCannotConsumeRewardLiabilityAndSettlementCanRetry() external {
        RevertingToken mutableReward = new RevertingToken(18);
        bribe.addRewardToken(address(mutableReward));
        bribe.deposit(3, ALICE);
        bribe.deposit(7, CAROL);

        mutableReward.mint(address(this), 1);
        mutableReward.approve(address(bribe), 1);
        bribe.notifyRewardAmount(address(mutableReward), 1);
        vm.warp(block.timestamp + 1);

        bribe.withdraw(3, ALICE);
        bribe.withdraw(7, CAROL);
        assertEq(bribe.fundRewardLiability(address(mutableReward)), 1);

        mutableReward.setBlocked(address(this), true);
        vm.expectRevert("BLOCKED");
        bribe.payFundReward(address(mutableReward));

        assertEq(bribe.fundRewardLiability(address(mutableReward)), 1);
        assertEq(bribe.accountedRewardBalance(address(mutableReward)), 1);
        assertEq(bribe.lifetimeRewardNotified(address(mutableReward)), 1);
        assertEq(mutableReward.balanceOf(address(bribe)), 1);

        mutableReward.setBlocked(address(this), false);
        assertEq(bribe.payFundReward(address(mutableReward)), 1);
        assertEq(bribe.fundRewardLiability(address(mutableReward)), 0);
        assertEq(bribe.lifetimeRewardNotified(address(mutableReward)), 1);
        assertEq(mutableReward.balanceOf(address(this)), 1);
    }

    /// @notice An issuer wipe creates a visible deficit and cannot silently erase reward liabilities.
    function test_IssuerWipeFailsClosedUntilTheMissingRewardIsRestored() external {
        RevertingToken mutableReward = new RevertingToken(18);
        bribe.addRewardToken(address(mutableReward));
        bribe.deposit(1, ALICE);

        uint256 amount = 70 ether;
        mutableReward.mint(address(this), amount);
        mutableReward.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(mutableReward), amount);
        mutableReward.wipe(address(bribe));

        vm.expectRevert(abi.encodeWithSelector(Bribe.RewardBalanceDeficit.selector, address(mutableReward), amount, 0));
        bribe.rewardSurplus(address(mutableReward));

        vm.warp(block.timestamp + WEEK);
        vm.expectRevert();
        bribe.claimReward(ALICE, address(mutableReward));
        assertEq(bribe.accountedRewardBalance(address(mutableReward)), amount);
        assertEq(bribe.scheduledRewards(address(mutableReward)), amount, "the failed checkpoint must also roll back");

        mutableReward.mint(address(bribe), amount);
        assertEq(bribe.claimReward(ALICE, address(mutableReward)), amount);
        assertEq(mutableReward.balanceOf(ALICE), amount);
        assertEq(bribe.accountedRewardBalance(address(mutableReward)), 0);
    }

    /// @notice Any notification partition may fill the exact lifetime cap, but the first excess unit is rejected.
    function test_LifetimeRewardCapAcceptsTheExactLimitAndRejectsTheFirstExcessUnit() external {
        bribe.deposit(1, ALICE);
        uint256 maximum = bribe.MAX_LIFETIME_REWARD_AMOUNT();
        assertEq(maximum, type(uint256).max / bribe.REWARD_PRECISION());
        reward.mint(address(this), maximum + 1);
        reward.approve(address(bribe), type(uint256).max);

        bribe.notifyRewardAmount(address(reward), maximum - 1);
        bribe.notifyRewardAmount(address(reward), 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                Bribe.RewardLifetimeCapExceeded.selector, address(reward), maximum, uint256(1), maximum
            )
        );
        bribe.notifyRewardAmount(address(reward), 1);

        assertEq(reward.balanceOf(address(this)), 1);
        assertEq(reward.balanceOf(address(bribe)), maximum);
        assertEq(bribe.lifetimeRewardNotified(address(reward)), maximum);
        assertEq(bribe.accountedRewardBalance(address(reward)), maximum);
        assertEq(bribe.scheduledRewards(address(reward)), maximum - 1);
        assertEq(bribe.queuedRewards(address(reward)), 1);
    }

    /// @notice Paid rewards never reopen lifetime headroom or permit the historical two-cycle index overflow.
    function test_LifetimeRewardCapStillBlocksAfterTheMaximumWasClaimed() external {
        bribe.deposit(1, ALICE);
        uint256 maximum = bribe.MAX_LIFETIME_REWARD_AMOUNT();
        reward.mint(address(this), maximum + 1);
        reward.approve(address(bribe), type(uint256).max);

        bribe.notifyRewardAmount(address(reward), maximum);
        vm.warp(block.timestamp + WEEK);
        assertEq(bribe.claimReward(ALICE, address(reward)), maximum);
        assertEq(bribe.accountedRewardBalance(address(reward)), 0);
        assertEq(bribe.rewardPerToken(address(reward)), maximum * bribe.REWARD_PRECISION());

        bribe.withdraw(1, ALICE);
        bribe.deposit(1, BOB);

        vm.expectRevert(
            abi.encodeWithSelector(
                Bribe.RewardLifetimeCapExceeded.selector, address(reward), maximum, uint256(1), maximum
            )
        );
        bribe.notifyRewardAmount(address(reward), 1);

        assertEq(reward.balanceOf(address(this)), 1);
        assertEq(reward.balanceOf(address(bribe)), 0);
        assertEq(bribe.lifetimeRewardNotified(address(reward)), maximum);
        assertEq(bribe.accountedRewardBalance(address(reward)), 0);
        assertEq(bribe.scheduledRewards(address(reward)), 0);
        assertEq(bribe.queuedRewards(address(reward)), 0);

        bribe.withdraw(1, BOB);
        assertEq(bribe.balanceOf(BOB), 0);
    }

    /// @notice Multiple completed streams may consume the full cap without exceeding the cumulative index range.
    function test_TwoCompletedRewardCyclesMayExactlyConsumeTheLifetimeCap() external {
        bribe.deposit(1, ALICE);
        uint256 maximum = bribe.MAX_LIFETIME_REWARD_AMOUNT();
        uint256 first = maximum / 2;
        uint256 second = maximum - first;
        reward.mint(address(this), maximum);
        reward.approve(address(bribe), type(uint256).max);

        bribe.notifyRewardAmount(address(reward), first);
        vm.warp(block.timestamp + WEEK);
        assertEq(bribe.claimReward(ALICE, address(reward)), first);

        bribe.notifyRewardAmount(address(reward), second);
        vm.warp(block.timestamp + WEEK);
        assertEq(bribe.claimReward(ALICE, address(reward)), second);

        assertEq(bribe.lifetimeRewardNotified(address(reward)), maximum);
        assertEq(bribe.rewardPerToken(address(reward)), maximum * bribe.REWARD_PRECISION());
        assertEq(bribe.accountedRewardBalance(address(reward)), 0);
        bribe.withdraw(1, ALICE);
    }

    /// @notice SafeERC20 accepts a genuine no-return token across both reward ingress and payout.
    function test_MissingReturnRewardTokenCompletesTheWholeFlow() external {
        MissingReturnToken noReturn = new MissingReturnToken(6);
        bribe.addRewardToken(address(noReturn));
        bribe.deposit(1, ALICE);

        uint256 amount = 7_000_000;
        noReturn.mint(address(this), amount);
        noReturn.approve(address(bribe), amount);
        bribe.notifyRewardAmount(address(noReturn), amount);
        vm.warp(block.timestamp + WEEK);

        assertEq(bribe.claimReward(ALICE, address(noReturn)), amount);
        assertEq(noReturn.balanceOf(ALICE), amount);
        assertEq(noReturn.balanceOf(address(bribe)), 0);
    }

    /// @notice A reward callback cannot recursively consume the same claim.
    function test_ReentrantRewardPayoutCannotDoubleClaim() external {
        ReentrantToken hostile = new ReentrantToken(18);
        bribe.addRewardToken(address(hostile));
        bribe.deposit(1, ALICE);

        uint256 amount = 70 ether;
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

    function _freshEmission(uint256 amount, uint256 elapsed) private pure returns (uint256 emitted) {
        uint256 remainder = amount % WEEK;
        emitted = elapsed * (amount / WEEK) + (elapsed < remainder ? elapsed : remainder);
    }

    function _selectorOf(bytes memory data) private pure returns (bytes4 selector) {
        assembly ("memory-safe") {
            selector := mload(add(data, 0x20))
        }
    }
}

/// @title BribeRetirementRiskTest
/// @notice Reproduces the dead-Strategy transition that can permanently strand active and queued rewards.
contract BribeRetirementRiskTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
    }

    function test_KnownRisk_DeadStrategyBribeCanPauseAndQueueRewardsForever() external {
        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        uint256 streamed = 7 days;
        target.mint(DAVE, streamed);
        vm.startPrank(DAVE);
        target.approve(address(targetBribe), streamed);
        targetBribe.notifyRewardAmount(address(target), streamed);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        resonance.killStrategy(address(targetStrategy));

        vm.startPrank(ALICE);
        signalGBX.withdrawSignal(address(targetStrategy), 100 ether);
        vm.stopPrank();
        targetBribe.claimReward(ALICE, address(target));

        uint256 earnedBeforeExit = 1 days;
        uint256 permanentlyPaused = streamed - earnedBeforeExit;
        assertEq(target.balanceOf(ALICE), earnedBeforeExit);
        assertEq(targetBribe.totalSupply(), 0);
        assertEq(targetBribe.scheduledRewards(address(target)), permanentlyPaused);

        uint256 postRetirementReward = 123;
        target.mint(DAVE, postRetirementReward);
        vm.startPrank(DAVE);
        target.approve(address(targetBribe), postRetirementReward);
        targetBribe.notifyRewardAmount(address(target), postRetirementReward);
        vm.stopPrank();
        assertEq(targetBribe.queuedRewards(address(target)), postRetirementReward);

        _mintTestGBX(BOB, 1 ether);
        vm.startPrank(BOB);
        gbx.approve(address(signalGBX), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(Resonance.StrategyAlreadyDead.selector, address(targetStrategy)));
        signalGBX.signal(address(targetStrategy), 1 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        assertEq(targetBribe.claimReward(ALICE, address(target)), 0);
        assertEq(target.balanceOf(address(targetBribe)), permanentlyPaused + postRetirementReward);
        assertEq(
            targetBribe.accountedRewardBalance(address(target)),
            permanentlyPaused + postRetirementReward,
            "all remaining value is accounted but has no reachable destination"
        );
        assertEq(targetBribe.fundRewardLiability(address(target)), 0);
    }
}
