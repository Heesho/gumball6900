// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { stdError } from "forge-std/StdError.sol";

import { Bribe } from "../../../src/core/Bribe.sol";
import { Fund } from "../../../src/core/Fund.sol";
import { GBX } from "../../../src/core/GBX.sol";
import { Mine } from "../../../src/core/Mine.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { SignalGBX } from "../../../src/core/SignalGBX.sol";
import { ProtocolFixture } from "../utils/ProtocolFixture.sol";
import { MockERC20, ReentrantToken, RevertingToken } from "../utils/Tokens.sol";
import {
    AuditCallbackReceiver,
    BehaviorChangingToken,
    ERC777LikeCallbackToken,
    PausableTransferToken,
    RebasingBalanceToken,
    RevertingBalanceOfToken
} from "./AuditTokens.sol";

/// @notice Code-bearing sink used by isolated Mine graphs.
contract AuditRouterSink { }

/// @notice Reads a Mine claim during its USDG callback and attempts one nested claim without bubbling failure.
contract MineClaimCallbackObserver {
    Mine public mine;
    address public account;
    uint256 public observedAccountClaim;
    uint256 public observedTotalClaims;
    bool public reentrantClaimSucceeded;
    bytes public reentrantClaimReturnData;

    function configure(Mine mine_, address account_) external {
        mine = mine_;
        account = account_;
    }

    function observeAndReenter() external {
        observedAccountClaim = mine.claimableMinerPayment(account);
        observedTotalClaims = mine.totalClaimableMinerPayments();
        (reentrantClaimSucceeded, reentrantClaimReturnData) =
            address(mine).call(abi.encodeCall(Mine.claimMinerPayment, (account)));
    }
}

/// @notice Catches one failed redemption and retries the same token later in the same outer transaction.
contract RedemptionRetryHarness {
    bytes public firstFailure;

    function execute(GBX gbx, Fund fund, BehaviorChangingToken token, uint256 amount, address receiver) external {
        gbx.transferFrom(msg.sender, address(this), amount);
        gbx.approve(address(fund), amount);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        token.setMode(BehaviorChangingToken.Mode.RevertTransfer);
        (bool firstSucceeded, bytes memory failure) =
            address(fund).call(abi.encodeCall(Fund.redeem, (amount, receiver, tokens)));
        require(!firstSucceeded, "FIRST_REDEMPTION_SUCCEEDED");
        firstFailure = failure;

        token.setMode(BehaviorChangingToken.Mode.Standard);
        fund.redeem(amount, receiver, tokens);
    }
}

/// @title ExitabilityBlastRadiusTest
/// @notice Public-path liveness and fault-containment checks for every mandatory exit family.
contract ExitabilityBlastRadiusTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
        _mintTestGBX(ALICE, 1_000 ether);
        _mintTestGBX(BOB, 1_000 ether);
    }

    function test_FailedFundRedemptionCanRetrySameTokenInsideOneOuterTransaction() external {
        BehaviorChangingToken morph = new BehaviorChangingToken(18);
        RedemptionRetryHarness retry = new RedemptionRetryHarness();
        morph.mint(address(fund), 2_000 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(retry), 100 ether);
        retry.execute(gbx, fund, morph, 100 ether, ALICE);
        vm.stopPrank();

        assertGt(retry.firstFailure().length, 0, "the first selected-token transfer must fail");
        assertGt(morph.balanceOf(ALICE), 0, "the same token must be redeemable after the caught revert");
        assertEq(gbx.balanceOf(address(retry)), 0);
    }

    function test_FundOmissionKeepsHealthyExitIndependentOfRevertingBalanceView() external {
        RevertingBalanceOfToken broken = new RevertingBalanceOfToken(18);
        broken.mint(address(fund), 2_000 ether);
        target.mint(address(fund), 2_000 ether);
        broken.setBalanceReadsRevert(true);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 200 ether);
        vm.expectRevert("BALANCE_OF_REVERTED");
        fund.redeem(100 ether, ALICE, _addresses(address(broken)));
        fund.redeem(100 ether, ALICE, _addresses(address(target)));
        vm.stopPrank();

        assertGt(target.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 900 ether);
    }

    function test_FundExactDeltaGuardRejectsRebasingBalanceSemantics() external {
        RebasingBalanceToken rebasing = new RebasingBalanceToken(18);
        rebasing.mint(address(fund), 2_000 ether);
        rebasing.setScale(2e18);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        vm.expectRevert();
        fund.redeem(100 ether, ALICE, _addresses(address(rebasing)));
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertEq(rebasing.balanceOf(ALICE), 0);
    }

    function test_ContractReceiverCallbackCannotReenterFund() external {
        ERC777LikeCallbackToken callbackToken = new ERC777LikeCallbackToken(18);
        AuditCallbackReceiver receiver = new AuditCallbackReceiver();
        callbackToken.mint(address(fund), 2_000 ether);

        address[] memory selected = _addresses(address(callbackToken));
        receiver.arm(address(fund), abi.encodeCall(Fund.redeem, (1 ether, address(receiver), selected)));

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 100 ether);
        fund.redeem(100 ether, address(receiver), selected);
        vm.stopPrank();

        assertEq(receiver.callbackCount(), 1);
        assertFalse(receiver.lastCallSucceeded());
        assertEq(_selector(receiver.lastReturnData()), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertGt(callbackToken.balanceOf(address(receiver)), 0);
    }

    function test_ZeroPriceMineReplacementSettlesWhileUSDGTransfersAreDisabled() external {
        (GBX localGBX, RevertingToken localUSDG, Mine localMine) = _deployIsolatedMine();
        _occupy(localMine, localUSDG, ALICE, ALICE, 0);

        vm.warp(block.timestamp + localMine.PRICE_DECAY_PERIOD());
        localUSDG.setTransfersRevert(true);
        Mine.Slot memory oldSlot = localMine.slot(0);

        vm.prank(BOB);
        assertEq(localMine.mine(BOB, 0, oldSlot.epochId, block.timestamp, 0, "free exit"), 0);

        assertGt(localGBX.balanceOf(ALICE), 0, "outgoing emission must settle without touching USDG");
        assertEq(localMine.slot(0).miner, BOB);
    }

    function test_MineUSDGCallbackCannotReenterOrDuplicateTheSlotTransition() external {
        (GBX localGBX, ReentrantToken localUSDG, Mine localMine) = _deployReentrantMine();
        Mine.Slot memory empty = localMine.slot(0);
        uint256 price = localMine.currentPrice(0);
        localUSDG.mint(ALICE, price);
        localUSDG.arm(
            address(localMine),
            abi.encodeCall(Mine.mine, (BOB, 0, empty.epochId, block.timestamp, price, "recursive replacement"))
        );

        vm.startPrank(ALICE);
        localUSDG.approve(address(localMine), price);
        assertEq(localMine.mine(ALICE, 0, empty.epochId, block.timestamp, price, "outer replacement"), price);
        vm.stopPrank();

        Mine.Slot memory occupied = localMine.slot(0);
        assertEq(localUSDG.callCount(), 1, "the USDG transfer callback must execute");
        assertFalse(localUSDG.lastCallSucceeded(), "the recursive replacement must fail");
        assertEq(_selector(localUSDG.lastReturnData()), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(occupied.epochId, empty.epochId + 1, "exactly one epoch transition may persist");
        assertEq(occupied.miner, ALICE);
        assertEq(localMine.aggregateTps(), localMine.INITIAL_TPS() / localMine.SLOT_COUNT());
        assertEq(localGBX.totalSupply(), 0);
        assertEq(localUSDG.balanceOf(address(localMine)), 0);
        assertEq(localUSDG.balanceOf(localMine.resonanceRouter()), price);
    }

    function test_MinerClaimClearsLiabilityBeforeCallbackAndRejectsReentrancy() external {
        (, ReentrantToken localUSDG, Mine localMine) = _deployReentrantMine();
        _occupy(localMine, localUSDG, ALICE, ALICE, 0);
        vm.warp(block.timestamp + localMine.PRICE_DECAY_PERIOD() / 2);
        _occupy(localMine, localUSDG, BOB, BOB, 0);

        uint256 claim = localMine.claimableMinerPayment(ALICE);
        MineClaimCallbackObserver observer = new MineClaimCallbackObserver();
        observer.configure(localMine, ALICE);
        localUSDG.arm(address(observer), abi.encodeCall(MineClaimCallbackObserver.observeAndReenter, ()));

        localMine.claimMinerPayment(ALICE);

        assertEq(localUSDG.callCount(), 1, "the claim transfer callback must execute");
        assertTrue(localUSDG.lastCallSucceeded(), "the observer must catch, not bubble, the nested failure");
        assertEq(observer.observedAccountClaim(), 0, "CEI must clear the account claim before token interaction");
        assertEq(observer.observedTotalClaims(), 0, "CEI must clear the aggregate liability before token interaction");
        assertFalse(observer.reentrantClaimSucceeded());
        assertEq(_selector(observer.reentrantClaimReturnData()), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(localMine.claimableMinerPayment(ALICE), 0);
        assertEq(localMine.totalClaimableMinerPayments(), 0);
        assertEq(localUSDG.balanceOf(ALICE), claim, "the outer claim pays exactly once");
    }

    function test_OneBlockedMinerCannotBlockAnotherMinerClaim() external {
        (, RevertingToken localUSDG, Mine localMine) = _deployIsolatedMine();
        _occupy(localMine, localUSDG, ALICE, ALICE, 0);
        _occupy(localMine, localUSDG, BOB, BOB, 1);
        _occupy(localMine, localUSDG, CAROL, CAROL, 0);
        _occupy(localMine, localUSDG, DAVE, DAVE, 1);

        uint256 aliceClaim = localMine.claimableMinerPayment(ALICE);
        uint256 bobClaim = localMine.claimableMinerPayment(BOB);
        assertGt(aliceClaim, 0);
        assertGt(bobClaim, 0);

        localUSDG.setBlocked(ALICE, true);
        vm.expectRevert("BLOCKED");
        localMine.claimMinerPayment(ALICE);

        localMine.claimMinerPayment(BOB);
        assertEq(localMine.claimableMinerPayment(ALICE), aliceClaim);
        assertEq(localMine.claimableMinerPayment(BOB), 0);
        assertEq(localUSDG.balanceOf(BOB), bobClaim);
    }

    function test_EmptyRewardRegistryWeightRemovalIsConstantAndTokenFree() external {
        Bribe emptyBribe = new Bribe(address(this));
        emptyBribe.addSignalWeight(ALICE, 123);
        emptyBribe.removeSignalWeight(ALICE, 123);
        assertEq(emptyBribe.totalSignalWeight(), 0);
        assertEq(emptyBribe.signalWeightOf(ALICE), 0);
        assertEq(emptyBribe.rewardTokens().length, 0);
    }

    /// @dev A canonical Strategy always registers its payment token during creation, so zero registered rewards is
    ///      unreachable. This one-token/no-notification case is the canonical zero-active-reward-stream boundary.
    function test_LiveOneRewardStrategyReturnsAllSignalPrincipal() external {
        _signalDefault(ALICE, 100 ether);
        assertEq(targetBribe.rewardTokens().length, 1);

        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 100 ether);

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
    }

    function test_KilledOneRewardStrategyReturnsAllSignalPrincipal() external {
        _signalDefault(ALICE, 100 ether);
        assertEq(targetBribe.rewardTokens().length, 1);
        resonance.killStrategy(address(targetStrategy));

        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 100 ether);

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
    }

    function test_LiveSixteenRewardStrategyReturnsPrincipalWithBrokenRewardToken() external {
        _exerciseSixteenRewardExit(false);
    }

    function test_KilledSixteenRewardStrategyReturnsPrincipalWithBrokenRewardToken() external {
        _exerciseSixteenRewardExit(true);
    }

    function test_LiveOneRewardStrategyExitsAtSaturatedLifetimeCaps() external {
        _exerciseSaturatedLifetimeCapExit(false, false);
    }

    function test_KilledOneRewardStrategyExitsAtSaturatedLifetimeCaps() external {
        _exerciseSaturatedLifetimeCapExit(true, false);
    }

    function test_LiveSixteenRewardStrategyExitsAtSaturatedLifetimeCapsWithBrokenReward() external {
        _exerciseSaturatedLifetimeCapExit(false, true);
    }

    function test_KilledSixteenRewardStrategyExitsAtSaturatedLifetimeCapsWithBrokenReward() external {
        _exerciseSaturatedLifetimeCapExit(true, true);
    }

    function test_PausedRewardClaimDoesNotBlockHealthyClaimOrWeightExit() external {
        Bribe bribe = new Bribe(address(this));
        PausableTransferToken paused = new PausableTransferToken(18);
        MockERC20 healthy = new MockERC20("Healthy", "OK", 18);
        bribe.addRewardToken(address(paused));
        bribe.addRewardToken(address(healthy));
        bribe.addSignalWeight(ALICE, 1);

        uint256 amount = 1 ether;
        paused.mint(address(this), amount);
        healthy.mint(address(this), amount);
        paused.approve(address(bribe), amount);
        healthy.approve(address(bribe), amount);
        bribe.notifyReward(address(paused), amount);
        bribe.notifyReward(address(healthy), amount);
        vm.warp(block.timestamp + 1 days);

        paused.setPaused(true);
        vm.expectRevert();
        bribe.claimReward(ALICE, address(paused));
        assertGt(bribe.claimReward(ALICE, address(healthy)), 0);
        bribe.removeSignalWeight(ALICE, 1);

        assertEq(bribe.signalWeightOf(ALICE), 0);
        assertGt(bribe.rewards(ALICE, address(paused)), 0);
    }

    function test_RegisteredRewardCanChangeBehaviorWithoutBlockingSignalAccounting() external {
        Bribe bribe = new Bribe(address(this));
        BehaviorChangingToken morph = new BehaviorChangingToken(18);
        bribe.addRewardToken(address(morph));
        bribe.addSignalWeight(ALICE, 1);
        morph.mint(address(this), 1 ether);
        morph.approve(address(bribe), 1 ether);
        bribe.notifyReward(address(morph), 1 ether);
        vm.warp(block.timestamp + 1 days);

        morph.setMode(BehaviorChangingToken.Mode.RevertTransfer);
        vm.expectRevert();
        bribe.claimReward(ALICE, address(morph));
        bribe.removeSignalWeight(ALICE, 1);
        assertEq(bribe.signalWeightOf(ALICE), 0);
    }

    function test_ResonanceLifetimeCapAcceptsExactMaximumAndRejectsFurtherSchedule() external {
        uint256 maximum = resonance.MAX_LIFETIME_REVENUE_AMOUNT();
        usdg.mint(address(resonanceRouter), maximum);
        assertEq(resonanceRouter.route(), maximum);
        assertEq(resonance.lifetimeRevenueNotified(), maximum);

        vm.warp(block.timestamp + resonance.REWARD_DURATION());
        uint256 attempted = resonance.REWARD_DURATION();
        usdg.mint(address(resonanceRouter), attempted);
        vm.expectRevert(
            abi.encodeWithSelector(Resonance.RevenueLifetimeCapExceeded.selector, maximum, attempted, maximum)
        );
        resonanceRouter.route();

        assertEq(resonance.lifetimeRevenueNotified(), maximum);
        assertEq(usdg.balanceOf(address(resonanceRouter)), attempted, "rejected revenue stays buffered in Router");
        assertEq(usdg.allowance(address(resonanceRouter), address(resonance)), 0);

        _signalDefault(ALICE, 1);
        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 1);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
    }

    function test_ResonanceLifetimeCapRejectsOneAboveMaximumBeforeCustody() external {
        uint256 maximum = resonance.MAX_LIFETIME_REVENUE_AMOUNT();
        uint256 attempted = maximum + 1;
        usdg.mint(address(resonanceRouter), attempted);

        vm.expectRevert(abi.encodeWithSelector(Resonance.RevenueLifetimeCapExceeded.selector, 0, attempted, maximum));
        resonanceRouter.route();

        assertEq(resonance.lifetimeRevenueNotified(), 0);
        assertEq(usdg.balanceOf(address(resonanceRouter)), attempted);
        assertEq(usdg.balanceOf(address(resonance)), 0);
    }

    function test_ResonanceActiveRolloverCountsOnlyFreshRevenueAndExcludesDonations() external {
        uint256 duration = resonance.REWARD_DURATION();
        uint256 first = 2 * duration;
        _routeRevenue(first);
        vm.warp(block.timestamp + 1 days);

        uint256 directDonation = 123;
        usdg.mint(address(resonance), directDonation);
        assertEq(resonance.lifetimeRevenueNotified(), first);

        uint256 fresh = resonance.remainingRevenue();
        assertGt(fresh, duration);
        usdg.mint(address(resonanceRouter), fresh);
        vm.prank(KEEPER);
        assertEq(resonanceRouter.route(), fresh);

        assertEq(resonance.lifetimeRevenueNotified(), first + fresh);
        assertEq(usdg.balanceOf(address(resonance)), directDonation + first + fresh);
    }

    /// @notice Defensive host-model boundary: the uint256 overflow needs a timestamp beyond target uint64 headers.
    function test_DefensiveModel_MineAndFundUint256OverflowRequiresTimestampBeyondTargetUint64() external {
        usdg.mint(ALICE, mine.SLOT_COUNT() * mine.MIN_INITIAL_PRICE());
        vm.startPrank(ALICE);
        usdg.approve(address(mine), type(uint256).max);
        for (uint256 i; i < mine.SLOT_COUNT(); ++i) {
            Mine.Slot memory empty = mine.slot(i);
            mine.mine(ALICE, i, empty.epochId, block.timestamp, mine.MIN_INITIAL_PRICE(), "horizon");
        }
        vm.stopPrank();

        uint256 aggregate = mine.aggregateTps();
        assertEq(aggregate, mine.INITIAL_TPS());
        uint256 checkpoint = mine.pendingUpdatedAt();
        uint256 supply = gbx.totalSupply();

        uint256 lastEffectiveSupplySecond = (type(uint256).max - supply) / aggregate;
        uint256 targetMaximumElapsed = type(uint64).max - checkpoint;
        assertLt(
            targetMaximumElapsed, lastEffectiveSupplySecond, "target uint64 time cannot reach effective-supply cap"
        );
        assertLt(targetMaximumElapsed, type(uint256).max / aggregate, "target uint64 time cannot reach pending cap");

        vm.warp(type(uint64).max);
        assertEq(mine.pendingEmission(), targetMaximumElapsed * aggregate);
        assertEq(mine.effectiveTotalSupply(), supply + targetMaximumElapsed * aggregate);

        // Foundry permits a larger timestamp than the pinned target client can encode. The rest of this test preserves
        // the counterfactual arithmetic boundary as defensive evidence; it is not a target-reachable finding.
        vm.warp(checkpoint + lastEffectiveSupplySecond);
        assertEq(mine.effectiveTotalSupply(), supply + lastEffectiveSupplySecond * aggregate);

        vm.warp(checkpoint + lastEffectiveSupplySecond + 1);
        vm.expectRevert(stdError.arithmeticError);
        mine.effectiveTotalSupply();

        target.mint(address(fund), 1 ether);
        vm.startPrank(ALICE);
        gbx.approve(address(fund), 1);
        vm.expectRevert(stdError.arithmeticError);
        fund.redeem(1, ALICE, _addresses(address(target)));
        vm.stopPrank();

        uint256 lastPendingSecond = type(uint256).max / aggregate;
        vm.warp(checkpoint + lastPendingSecond);
        assertEq(mine.pendingEmission(), lastPendingSecond * aggregate);

        vm.warp(checkpoint + lastPendingSecond + 1);
        vm.expectRevert(stdError.arithmeticError);
        mine.pendingEmission();

        Mine.Slot memory outgoing = mine.slot(0);
        vm.startPrank(BOB);
        vm.expectRevert(stdError.arithmeticError);
        mine.mine(BOB, 0, outgoing.epochId, block.timestamp, 0, "past horizon");
        vm.stopPrank();
    }

    function test_SignalExitWorksAtLastERC5805BlockAndFailsBeyondTheClockHorizon() external {
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 2);
        signalGBX.addSignal(address(targetStrategy), 1);
        vm.stopPrank();

        uint256 lastClockBlock = type(uint48).max;
        vm.roll(lastClockBlock);
        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 1);
        assertEq(signalGBX.balanceOf(ALICE), 0);

        vm.prank(ALICE);
        signalGBX.addSignal(address(targetStrategy), 1);
        uint256 firstInvalidBlock = lastClockBlock + 1;
        vm.roll(firstInvalidBlock);

        vm.startPrank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(SafeCast.SafeCastOverflowedUintDowncast.selector, uint8(48), firstInvalidBlock)
        );
        signalGBX.removeSignal(address(targetStrategy), 1);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 1);
        assertEq(targetBribe.signalWeightOf(ALICE), 1);
    }

    function test_BribeLifetimeCapExactHeadroomAndOneAboveBoundary() external {
        Bribe bribe = new Bribe(address(this));
        MockERC20 reward = new MockERC20("Cap Reward", "CAP", 18);
        bribe.addRewardToken(address(reward));
        uint256 maximum = bribe.MAX_LIFETIME_REWARD_AMOUNT();
        uint256 duration = bribe.REWARD_DURATION();

        reward.mint(address(this), maximum + duration);
        reward.approve(address(bribe), type(uint256).max);
        bribe.notifyReward(address(reward), maximum - duration);
        vm.warp(block.timestamp + duration);
        bribe.notifyReward(address(reward), duration);
        assertEq(bribe.lifetimeRewardNotified(address(reward)), maximum);

        vm.warp(block.timestamp + duration);
        vm.expectRevert(
            abi.encodeWithSelector(
                Bribe.RewardLifetimeCapExceeded.selector, address(reward), maximum, duration, maximum
            )
        );
        bribe.notifyReward(address(reward), duration);
        assertEq(reward.balanceOf(address(this)), duration);
    }

    function test_DuplicateBatchFailureRollsBackAndScalarFallbackFullyExits() external {
        _mintTestGBX(CAROL, 4);
        SignalGBX.Allocation[] memory additions = new SignalGBX.Allocation[](2);
        additions[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 2 });
        additions[1] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 2 });

        vm.startPrank(CAROL);
        gbx.approve(address(signalGBX), 4);
        signalGBX.addSignalMany(additions);

        SignalGBX.Allocation[] memory invalidRemoval = new SignalGBX.Allocation[](2);
        invalidRemoval[0] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 3 });
        invalidRemoval[1] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 2 });
        vm.expectRevert();
        signalGBX.removeSignalMany(invalidRemoval);
        assertEq(targetBribe.signalWeightOf(CAROL), 4, "the earlier duplicate removal must roll back");

        signalGBX.removeSignal(address(targetStrategy), 2);
        signalGBX.removeSignal(address(targetStrategy), 2);
        vm.stopPrank();

        assertEq(targetBribe.signalWeightOf(CAROL), 0);
        assertEq(signalGBX.balanceOf(CAROL), 0);
        assertEq(gbx.balanceOf(CAROL), 4);
    }

    function test_ScalarSignalExitDoesNotEnumerateGlobalStrategies() external {
        _signalDefault(ALICE, 100 ether);

        vm.expectCall(address(targetBribe), abi.encodeWithSignature("totalSignalWeight()"), 1);
        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 100 ether);

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(targetBribe.signalWeightOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
    }

    function _exerciseSixteenRewardExit(bool killed) private {
        _signalDefault(ALICE, 100 ether);
        _notifyExistingTargetReward();

        for (uint256 i; i < 14; ++i) {
            MockERC20 extra = new MockERC20("Exit Reward", "EXIT", 18);
            _registerAndNotify(extra);
        }

        BehaviorChangingToken broken = new BehaviorChangingToken(18);
        resonance.addBribeRewardToken(address(targetStrategy), address(broken));
        broken.mint(address(this), 1 ether);
        broken.approve(address(targetBribe), 1 ether);
        targetBribe.notifyReward(address(broken), 1 ether);
        assertEq(targetBribe.rewardTokens().length, 16);

        vm.warp(block.timestamp + 1 days);
        broken.setMode(BehaviorChangingToken.Mode.RevertTransfer);
        if (killed) resonance.killStrategy(address(targetStrategy));

        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 100 ether);

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        assertGt(targetBribe.rewards(ALICE, address(broken)), 0, "broken payout remains separately claimable");
    }

    function _exerciseSaturatedLifetimeCapExit(bool killed, bool maximumRegistry) private {
        _signalDefault(ALICE, 1);

        BehaviorChangingToken broken;
        if (maximumRegistry) {
            for (uint256 i; i < 14; ++i) {
                MockERC20 extra = new MockERC20("Capped Exit Reward", "CAPEXIT", 18);
                resonance.addBribeRewardToken(address(targetStrategy), address(extra));
            }
            broken = new BehaviorChangingToken(18);
            resonance.addBribeRewardToken(address(targetStrategy), address(broken));
        }

        uint256 revenueMaximum = resonance.MAX_LIFETIME_REVENUE_AMOUNT();
        usdg.mint(address(resonanceRouter), revenueMaximum);
        assertEq(resonanceRouter.route(), revenueMaximum);
        assertEq(resonance.lifetimeRevenueNotified(), revenueMaximum);

        uint256 rewardMaximum = targetBribe.MAX_LIFETIME_REWARD_AMOUNT();
        address[] memory rewardTokens = targetBribe.rewardTokens();
        assertEq(rewardTokens.length, maximumRegistry ? 16 : 1);
        for (uint256 i; i < rewardTokens.length; ++i) {
            MockERC20 reward = MockERC20(rewardTokens[i]);
            reward.mint(address(this), rewardMaximum);
            reward.approve(address(targetBribe), rewardMaximum);
            targetBribe.notifyReward(address(reward), rewardMaximum);
            assertEq(targetBribe.lifetimeRewardNotified(address(reward)), rewardMaximum);
        }

        vm.warp(block.timestamp + resonance.REWARD_DURATION() - 1);
        if (maximumRegistry) broken.setMode(BehaviorChangingToken.Mode.RevertTransfer);
        if (killed) resonance.killStrategy(address(targetStrategy));

        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 1);

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(targetBribe.signalWeightOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), 1_000 ether);
        for (uint256 i; i < rewardTokens.length; ++i) {
            assertGt(targetBribe.rewards(ALICE, rewardTokens[i]), 0, "cap-edge reward remains claimable");
        }
        if (maximumRegistry) {
            assertGt(targetBribe.rewards(ALICE, address(broken)), 0, "broken reward does not enter principal exit");
        }
    }

    function _deployIsolatedMine() private returns (GBX localGBX, RevertingToken localUSDG, Mine localMine) {
        localGBX = new GBX(address(this));
        localUSDG = new RevertingToken(6);
        Fund localFund = new Fund(localGBX);
        AuditRouterSink sink = new AuditRouterSink();
        localMine = new Mine(
            localGBX, IERC20(address(localUSDG)), address(localFund), address(sink), address(0), address(this)
        );
        localGBX.setMinter(address(localMine));
    }

    function _deployReentrantMine() private returns (GBX localGBX, ReentrantToken localUSDG, Mine localMine) {
        localGBX = new GBX(address(this));
        localUSDG = new ReentrantToken(6);
        Fund localFund = new Fund(localGBX);
        AuditRouterSink sink = new AuditRouterSink();
        localMine = new Mine(
            localGBX, IERC20(address(localUSDG)), address(localFund), address(sink), address(0), address(this)
        );
        localGBX.setMinter(address(localMine));
    }

    function _occupy(Mine localMine, MockERC20 localUSDG, address payer, address miner, uint256 slotIndex) private {
        Mine.Slot memory state = localMine.slot(slotIndex);
        uint256 price = localMine.currentPrice(slotIndex);
        localUSDG.mint(payer, price);
        vm.startPrank(payer);
        localUSDG.approve(address(localMine), price);
        localMine.mine(miner, slotIndex, state.epochId, block.timestamp, price, "audit");
        vm.stopPrank();
    }

    function _notifyExistingTargetReward() private {
        target.mint(address(this), 1 ether);
        target.approve(address(targetBribe), 1 ether);
        targetBribe.notifyReward(address(target), 1 ether);
    }

    function _registerAndNotify(MockERC20 reward) private {
        resonance.addBribeRewardToken(address(targetStrategy), address(reward));
        reward.mint(address(this), 1 ether);
        reward.approve(address(targetBribe), 1 ether);
        targetBribe.notifyReward(address(reward), 1 ether);
    }

    function _selector(bytes memory returnData) private pure returns (bytes4 value) {
        if (returnData.length < 4) return bytes4(0);
        assembly ("memory-safe") {
            value := mload(add(returnData, 0x20))
        }
    }
}
