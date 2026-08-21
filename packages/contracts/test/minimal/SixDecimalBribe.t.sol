// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { CommonBase } from "forge-std/Base.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { StdUtils } from "forge-std/StdUtils.sol";
import { Test } from "forge-std/Test.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { MockERC20 } from "./utils/Tokens.sol";

/// @notice Test-only Resonance stand-in that makes Bribe signal mutations available to a stateful handler.
contract SixDecimalBribeController {
    Bribe public bribe;

    function fund() external view returns (address fundAddress) {
        return address(this);
    }

    function initialize(address rewardToken) external {
        require(address(bribe) == address(0), "ALREADY_INITIALIZED");
        bribe = new Bribe(address(this));
        bribe.addRewardToken(rewardToken);
    }

    function deposit(uint256 amount, address account) external {
        bribe.deposit(amount, account);
    }

    function withdraw(uint256 amount, address account) external {
        bribe.withdraw(amount, account);
    }
}

/// @notice Revert-free random action surface for exact six-decimal reward accounting.
contract SixDecimalBribeHandler is CommonBase, StdCheats, StdUtils {
    uint256 private constant ACTOR_COUNT = 3;
    uint256 private constant MAX_SIGNAL_SUPPLY = 10_000_000 ether;
    uint256 private constant MAX_DEPOSIT = 1_000_000 ether;
    uint256 private constant MAX_NOTIFICATION = 20_000_000; // 20.000000 reward tokens.

    SixDecimalBribeController public immutable controller;
    Bribe public immutable bribe;
    MockERC20 public immutable reward;

    address[ACTOR_COUNT] public actors;
    uint256 public ghostNotified;

    constructor(SixDecimalBribeController controller_, MockERC20 reward_) {
        controller = controller_;
        bribe = controller_.bribe();
        reward = reward_;

        actors[0] = address(0xA11CE);
        actors[1] = address(0xB0B);
        actors[2] = address(0xCA401);
        reward_.approve(address(bribe), type(uint256).max);
    }

    function notify(uint256 amountSeed) external {
        uint256 amount = _bound(amountSeed, 1, MAX_NOTIFICATION);
        reward.mint(address(this), amount);
        bribe.notifyRewardAmount(address(reward), amount);
        ghostNotified += amount;
    }

    function advanceTime(uint256 elapsedSeed) external {
        vm.warp(block.timestamp + _bound(elapsedSeed, 0, 14 days));
    }

    function deposit(uint256 actorSeed, uint256 amountSeed) external {
        uint256 supply = bribe.totalSupply();
        if (supply == MAX_SIGNAL_SUPPLY) return;

        uint256 capacity = MAX_SIGNAL_SUPPLY - supply;
        uint256 maximum = capacity < MAX_DEPOSIT ? capacity : MAX_DEPOSIT;
        controller.deposit(_bound(amountSeed, 1, maximum), _actor(actorSeed));
    }

    function withdraw(uint256 actorSeed, uint256 amountSeed) external {
        address actor = _actor(actorSeed);
        uint256 balance = bribe.balanceOf(actor);
        if (balance == 0) return;
        controller.withdraw(_bound(amountSeed, 1, balance), actor);
    }

    function claim(uint256 actorSeed) external {
        bribe.claimReward(_actor(actorSeed), address(reward));
    }

    function payFund() external {
        bribe.payFundReward(address(reward));
    }

    function actorCount() external pure returns (uint256) {
        return ACTOR_COUNT;
    }

    function _actor(uint256 seed) private view returns (address) {
        return actors[seed % ACTOR_COUNT];
    }
}

/// @title Six-decimal Bribe boundary tests
/// @notice Quantifies when six-decimal rewards are claimable, pending, or classified to Fund.
contract SixDecimalBribeTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);

    uint256 private constant WEEK = 7 days;
    uint256 private constant ALICE_SIGNAL = 3_000_000 ether;
    uint256 private constant BOB_SIGNAL = 2_000_000 ether;
    uint256 private constant TOTAL_SIGNAL = ALICE_SIGNAL + BOB_SIGNAL;

    Bribe private bribe;
    MockERC20 private reward;

    function fund() external view returns (address fundAddress) {
        return address(this);
    }

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

    /// @notice One six-decimal token distributes exactly despite five million signal and multiple accounts.
    function test_TwoSignalersClaimOneTokenAgainstFiveMillionSignal() external {
        _depositTwoSignalers();
        _notify(1_000_000); // 1.000000 WBTC or USDG if the asset uses six decimals.

        vm.warp(block.timestamp + WEEK);

        assertEq(bribe.claimReward(ALICE, address(reward)), 600_000);
        assertEq(bribe.claimReward(BOB, address(reward)), 400_000);

        assertEq(bribe.scheduledRewards(address(reward)), 0);
        assertEq(bribe.pendingRewardScaled(address(reward)), 0);
        assertEq(bribe.accountedRewardBalance(address(reward)), 0);
        assertEq(reward.balanceOf(ALICE), 600_000);
        assertEq(reward.balanceOf(BOB), 400_000);
        assertEq(reward.balanceOf(address(bribe)), 0);
        assertEq(bribe.fundRewardLiability(address(reward)), 0);
        _assertExactAccounting();
    }

    /// @notice A later signal entry cannot redirect the already indexed low-decimal reward to Fund.
    function test_SupplyChangeDoesNotRedirectTheOneTokenRewardToFund() external {
        _depositTwoSignalers();
        _notify(1_000_000);

        vm.warp(block.timestamp + WEEK);
        bribe.claimReward(ALICE, address(reward));
        bribe.claimReward(BOB, address(reward));
        bribe.deposit(1 ether, CAROL);

        assertEq(reward.balanceOf(ALICE), 600_000);
        assertEq(reward.balanceOf(BOB), 400_000);
        assertEq(reward.balanceOf(address(bribe)), 0);
        assertEq(bribe.pendingRewardScaled(address(reward)), 0);
        assertEq(bribe.fundRewardLiability(address(reward)), 0);
        assertEq(bribe.fundRewardRemainder(address(reward)), 0);
        _assertExactAccounting();
    }

    /// @notice Repeated one-token streams are each independently claimable without accumulating to five tokens.
    function test_RepeatedOneTokenStreamsDistributeWithoutAResolutionThreshold() external {
        _depositTwoSignalers();
        _notify(1_000_000);

        vm.warp(block.timestamp + WEEK);
        assertEq(bribe.claimReward(ALICE, address(reward)), 600_000);
        assertEq(bribe.claimReward(BOB, address(reward)), 400_000);

        _notify(1_000_000);
        vm.warp(block.timestamp + WEEK);
        bribe.claimReward(ALICE, address(reward));
        bribe.claimReward(BOB, address(reward));

        assertEq(reward.balanceOf(ALICE), 1_200_000);
        assertEq(reward.balanceOf(BOB), 800_000);
        assertEq(reward.balanceOf(address(bribe)), 0);
        _assertExactAccounting();
    }

    /// @notice One indivisible raw unit becomes account-specific precision rather than global Fund-bound carry.
    function test_OneRawUnitIsIndexedToUsersBeforeASupplyChange() external {
        _depositTwoSignalers();
        _notify(1);

        vm.warp(block.timestamp + WEEK);
        assertEq(bribe.claimReward(ALICE, address(reward)), 0);
        assertEq(bribe.claimReward(BOB, address(reward)), 0);

        assertEq(bribe.pendingRewardScaled(address(reward)), 0);
        assertEq(bribe.userRewardRemainder(ALICE, address(reward)), 0.6e36);
        assertEq(bribe.userRewardRemainder(BOB, address(reward)), 0.4e36);

        bribe.deposit(1 ether, CAROL);

        assertEq(bribe.pendingRewardScaled(address(reward)), 0);
        assertEq(bribe.fundRewardLiability(address(reward)), 0);
        assertEq(bribe.fundRewardRemainder(address(reward)), 0);
        assertEq(reward.balanceOf(address(bribe)), 1);
        _assertExactAccounting();
    }

    /// @notice An exit during a low-decimal stream preserves elapsed rewards under the old weights.
    function test_ExitDuringTheStreamPreservesElapsedRewardsForBothIncumbents() external {
        _depositTwoSignalers();
        uint256 amount = 7_000_000;
        uint256 startedAt = block.timestamp;
        _notify(amount);

        vm.warp(startedAt + 1 days);
        uint256 emittedBeforeExit = amount - bribe.left(address(reward));

        bribe.withdraw(BOB_SIGNAL, BOB);
        assertEq(bribe.fundRewardLiability(address(reward)), 0);

        vm.warp(startedAt + WEEK);
        bribe.claimReward(ALICE, address(reward));
        bribe.claimReward(BOB, address(reward));

        uint256 bobShareBeforeExit = (emittedBeforeExit * BOB_SIGNAL) / TOTAL_SIGNAL;
        assertEq(reward.balanceOf(BOB), bobShareBeforeExit);
        assertEq(reward.balanceOf(ALICE), amount - bobShareBeforeExit);
        assertEq(bribe.payFundReward(address(reward)), 0);
        assertEq(reward.balanceOf(address(bribe)), 0);
        _assertExactAccounting();
    }

    /// @notice With one signaler, the sole-account carry path makes even one raw six-decimal unit claimable.
    function test_SoleSignalerReceivesOneRawUnitDespiteLargeSignalWeight() external {
        bribe.deposit(5_000_000 ether, ALICE);
        _notify(1);

        vm.warp(block.timestamp + WEEK);
        assertEq(bribe.claimReward(ALICE, address(reward)), 1);

        assertEq(reward.balanceOf(ALICE), 1);
        assertEq(reward.balanceOf(address(bribe)), 0);
        _assertExactAccounting();
    }

    /// @notice A zero-supply queue does not consume time or lose a low-decimal reward before signaling starts.
    function test_ZeroSupplyQueuesThenDistributesOneTokenExactly() external {
        _notify(1_000_000);
        vm.warp(block.timestamp + 30 days);

        assertEq(bribe.queuedRewards(address(reward)), 1_000_000);
        assertEq(bribe.scheduledRewards(address(reward)), 0);

        bribe.deposit(5_000_000 ether, ALICE);
        vm.warp(block.timestamp + WEEK);
        bribe.claimReward(ALICE, address(reward));

        assertEq(reward.balanceOf(ALICE), 1_000_000);
        assertEq(reward.balanceOf(address(bribe)), 0);
        _assertExactAccounting();
    }

    /// @notice High precision conserves arbitrary six-decimal rewards across two users and later signal entry.
    function testFuzz_TwoSignalerHighPrecisionAccountingIsExact(
        uint256 aliceSignalSeed,
        uint256 bobSignalSeed,
        uint256 amountSeed
    ) external {
        uint256 aliceWholeSignal = bound(aliceSignalSeed, 1, 5_000_000);
        uint256 bobWholeSignal = bound(bobSignalSeed, 1, 5_000_000);
        uint256 amount = bound(amountSeed, 1, 20_000_000);
        uint256 wholeSignalSupply = aliceWholeSignal + bobWholeSignal;

        bribe.deposit(aliceWholeSignal * 1 ether, ALICE);
        bribe.deposit(bobWholeSignal * 1 ether, BOB);
        _notify(amount);
        vm.warp(block.timestamp + WEEK);

        bribe.claimReward(ALICE, address(reward));
        bribe.claimReward(BOB, address(reward));

        uint256 precision = bribe.REWARD_PRECISION();
        uint256 signalSupply = wholeSignalSupply * 1 ether;
        uint256 expectedDelta = (amount * precision) / signalSupply;
        uint256 expectedPendingScaled = amount * precision - expectedDelta * signalSupply;
        uint256 aliceAccruedScaled = aliceWholeSignal * 1 ether * expectedDelta;
        uint256 bobAccruedScaled = bobWholeSignal * 1 ether * expectedDelta;

        assertEq(reward.balanceOf(ALICE), aliceAccruedScaled / precision);
        assertEq(reward.balanceOf(BOB), bobAccruedScaled / precision);
        assertEq(bribe.userRewardRemainder(ALICE, address(reward)), aliceAccruedScaled % precision);
        assertEq(bribe.userRewardRemainder(BOB, address(reward)), bobAccruedScaled % precision);
        assertEq(bribe.pendingRewardScaled(address(reward)), expectedPendingScaled);

        bribe.deposit(1 ether, CAROL);
        assertEq(bribe.fundRewardLiability(address(reward)), 0);
        assertEq(bribe.fundRewardRemainder(address(reward)), expectedPendingScaled);
        assertLt(bribe.fundRewardRemainder(address(reward)), precision);
        _assertExactAccounting();
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

    function _assertExactAccounting() private view {
        uint256 precision = bribe.REWARD_PRECISION();
        uint256 classifiedScaled =
            (bribe.scheduledRewards(address(reward))
                    + bribe.queuedRewards(address(reward))
                    + bribe.accruedRewardLiability(address(reward))
                    + bribe.fundRewardLiability(address(reward))) * precision
                + bribe.pendingRewardScaled(address(reward)) + bribe.indexedRewardScaled(address(reward))
                + bribe.fundRewardRemainder(address(reward)) + bribe.userRewardRemainder(ALICE, address(reward))
                + bribe.userRewardRemainder(BOB, address(reward)) + bribe.userRewardRemainder(CAROL, address(reward));

        assertEq(classifiedScaled, bribe.accountedRewardBalance(address(reward)) * precision);
        assertEq(bribe.accountedRewardBalance(address(reward)), reward.balanceOf(address(bribe)));
        assertEq(
            bribe.rewards(ALICE, address(reward)) + bribe.rewards(BOB, address(reward))
                + bribe.rewards(CAROL, address(reward)),
            bribe.accruedRewardLiability(address(reward))
        );
    }
}

/// @title Six-decimal automatic Bribe integration test
/// @notice Reproduces the precision boundary through a real Strategy auction, Router, Bribe, and SignalGBX graph.
contract SixDecimalAutomaticBribeIntegrationTest is ProtocolFixture {
    Strategy private sixDecimalStrategy;
    Bribe private sixDecimalBribe;
    BribeRouter private sixDecimalRouter;

    function setUp() external {
        _deployProtocol();

        Strategy.Config memory config = defaultConfig();
        config.initialPrice = 10_000_000; // 10.000000 USDG.
        (address strategyAddress, address bribeAddress, address routerAddress) =
            resonance.addStrategy(IERC20(address(usdg)), config);
        sixDecimalStrategy = Strategy(strategyAddress);
        sixDecimalBribe = Bribe(bribeAddress);
        sixDecimalRouter = BribeRouter(routerAddress);
    }

    function test_OneUSDGAutomaticRewardPaysSignalersAndNeverBecomesFundBound() external {
        _signalDefault(ALICE, 3_000_000 ether);
        _signalOne(ALICE, address(sixDecimalStrategy));
        _signalDefault(BOB, 2_000_000 ether);
        _signalOne(BOB, address(sixDecimalStrategy));

        usdg.mint(address(sixDecimalStrategy), 1); // Make the acquisition auction fillable.
        assertEq(_buyTarget(DAVE, sixDecimalStrategy, usdg), 10_000_000);
        assertEq(sixDecimalRouter.bribePaymentLiability(), 1_000_000);
        assertEq(sixDecimalRouter.fundPaymentLiability(), 9_000_000);
        assertEq(sixDecimalRouter.notifyBribeReward(), 1_000_000);

        vm.warp(block.timestamp + sixDecimalBribe.REWARD_DURATION());
        assertEq(sixDecimalBribe.claimReward(ALICE, address(usdg)), 600_000);
        assertEq(sixDecimalBribe.claimReward(BOB, address(usdg)), 400_000);
        assertEq(sixDecimalBribe.pendingRewardScaled(address(usdg)), 0);

        _signalDefault(CAROL, 1 ether);
        _signalOne(CAROL, address(sixDecimalStrategy));
        assertEq(sixDecimalBribe.pendingRewardScaled(address(usdg)), 0);
        assertEq(sixDecimalBribe.fundRewardLiability(address(usdg)), 0);

        assertEq(usdg.balanceOf(ALICE), 600_000);
        assertEq(usdg.balanceOf(BOB), 400_000);
        assertEq(sixDecimalBribe.payFundReward(address(usdg)), 0);
        assertEq(usdg.balanceOf(address(sixDecimalBribe)), 0);
    }
}

/// @title Stateful six-decimal Bribe conservation campaign
/// @notice Randomly interleaves rewards, time, signal churn, claims, and Fund settlement.
contract SixDecimalBribeInvariantTest is Test {
    SixDecimalBribeController private controller;
    SixDecimalBribeHandler private handler;
    Bribe private bribe;
    MockERC20 private reward;

    function setUp() external {
        vm.warp(365 days);
        reward = new MockERC20("Six Decimal Reward", "6RWD", 6);
        controller = new SixDecimalBribeController();
        controller.initialize(address(reward));
        bribe = controller.bribe();
        handler = new SixDecimalBribeHandler(controller, reward);

        targetContract(address(handler));
        excludeSender(address(0));
    }

    /// @notice No random sequence can create an unaccounted or undercollateralized six-decimal reward unit.
    function invariant_EveryNotifiedUnitHasOneExactAccountingClassification() external view {
        uint256 precision = bribe.REWARD_PRECISION();
        uint256 classifiedScaled =
            (bribe.scheduledRewards(address(reward))
                    + bribe.queuedRewards(address(reward))
                    + bribe.accruedRewardLiability(address(reward))
                    + bribe.fundRewardLiability(address(reward))) * precision
                + bribe.pendingRewardScaled(address(reward)) + bribe.indexedRewardScaled(address(reward))
                + bribe.fundRewardRemainder(address(reward));

        uint256 summedRewards;
        uint256 actorCount = handler.actorCount();
        for (uint256 i; i < actorCount; ++i) {
            address actor = handler.actors(i);
            classifiedScaled += bribe.userRewardRemainder(actor, address(reward));
            summedRewards += bribe.rewards(actor, address(reward));
        }

        assertEq(summedRewards, bribe.accruedRewardLiability(address(reward)));
        assertEq(classifiedScaled, bribe.accountedRewardBalance(address(reward)) * precision);
        assertEq(bribe.accountedRewardBalance(address(reward)), reward.balanceOf(address(bribe)));
        assertEq(bribe.rewardSurplus(address(reward)), 0);
    }

    /// @notice Token custody is conserved exactly across notifier, Bribe, signalers, and Fund.
    function invariant_SixDecimalTokenCustodyIsExactlyConserved() external view {
        uint256 observed = reward.balanceOf(address(bribe)) + reward.balanceOf(address(handler))
            + reward.balanceOf(address(controller));
        uint256 actorCount = handler.actorCount();
        for (uint256 i; i < actorCount; ++i) {
            observed += reward.balanceOf(handler.actors(i));
        }

        assertEq(observed, handler.ghostNotified());
        assertEq(reward.totalSupply(), handler.ghostNotified());
        assertEq(bribe.lifetimeRewardNotified(address(reward)), handler.ghostNotified());
    }

    /// @notice Random signal mutations preserve the Bribe's complete virtual-supply ledger.
    function invariant_VirtualSupplyEqualsAllKnownSignalerBalances() external view {
        uint256 summed;
        uint256 actorCount = handler.actorCount();
        for (uint256 i; i < actorCount; ++i) {
            summed += bribe.balanceOf(handler.actors(i));
        }
        assertEq(summed, bribe.totalSupply());
    }
}
