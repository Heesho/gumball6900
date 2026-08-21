// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { MockERC20 } from "./utils/Tokens.sol";

interface IBribeBpsCallbackGovernor {
    function setBribeBpsFromPaymentToken(uint256 newBribeBps) external;
}

/// @notice Payment token that can ask the temporary governance harness to change policy during one transfer.
contract BribeBpsCallbackToken is MockERC20 {
    IBribeBpsCallbackGovernor public callbackGovernor;
    address public callbackReceiver;
    uint256 public callbackBps;
    bool public callbackArmed;

    constructor() MockERC20("Governance Callback", "GCB", 18) { }

    function armCallback(IBribeBpsCallbackGovernor governor, address receiver, uint256 newBribeBps) external {
        callbackGovernor = governor;
        callbackReceiver = receiver;
        callbackBps = newBribeBps;
        callbackArmed = true;
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (callbackArmed && from != address(0) && to == callbackReceiver) {
            callbackArmed = false;
            callbackGovernor.setBribeBpsFromPaymentToken(callbackBps);
        }
        super._update(from, to, amount);
    }
}

/// @notice Ownable-recipient harness allowing only its designated payment token to change the global share.
contract BribeBpsCallbackGovernor is IBribeBpsCallbackGovernor {
    Resonance public immutable resonance;
    address public immutable paymentToken;

    constructor(Resonance resonance_, address paymentToken_) {
        resonance = resonance_;
        paymentToken = paymentToken_;
    }

    function setBribeBpsFromPaymentToken(uint256 newBribeBps) external {
        require(msg.sender == paymentToken, "NOT_PAYMENT_TOKEN");
        resonance.setBribeBps(newBribeBps);
    }
}

/// @title Governed global Bribe-share transition tests
/// @notice Proves prospective classification, exact carry, reward continuity, and signal exits across 0%-20% policy.
contract BribeBpsTransitionTest is ProtocolFixture {
    event BribeBpsSet(uint256 previousBps, uint256 newBps);

    function setUp() external {
        _deployProtocol();
    }

    function test_DefaultBoundsAndOwnerAuthorization() external {
        assertEq(resonance.BPS(), 10_000);
        assertEq(resonance.DEFAULT_BRIBE_BPS(), 1_000);
        assertEq(resonance.MAX_BRIBE_BPS(), 2_000);
        assertEq(resonance.bribeBps(), 1_000);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        resonance.setBribeBps(0);

        vm.expectEmit(false, false, false, true, address(resonance));
        emit BribeBpsSet(1_000, 0);
        resonance.setBribeBps(0);
        assertEq(resonance.bribeBps(), 0);

        resonance.setBribeBps(500);
        assertEq(resonance.bribeBps(), 500);
        resonance.setBribeBps(2_000);
        assertEq(resonance.bribeBps(), 2_000);

        vm.expectRevert(abi.encodeWithSelector(Resonance.BribeBpsAboveMaximum.selector, uint256(2_001)));
        resonance.setBribeBps(2_001);
        assertEq(resonance.bribeBps(), 2_000, "a rejected rate cannot alter policy");
    }

    function test_FourCompletedAuctionsUseTenZeroFiveAndTwentyPercentProspectively() external {
        uint256 firstPayment = _fillTargetAuction(ALICE);
        assertEq(firstPayment, 10 ether);
        _assertTargetLiabilities(9 ether, 1 ether, firstPayment);

        resonance.setBribeBps(0);
        uint256 secondPayment = _fillTargetAuction(BOB);
        assertEq(secondPayment, 15 ether);
        _assertTargetLiabilities(24 ether, 1 ether, firstPayment + secondPayment);

        resonance.setBribeBps(500);
        uint256 thirdPayment = _fillTargetAuction(CAROL);
        assertEq(thirdPayment, 22.5 ether);
        _assertTargetLiabilities(45.375 ether, 2.125 ether, firstPayment + secondPayment + thirdPayment);

        resonance.setBribeBps(2_000);
        uint256 fourthPayment = _fillTargetAuction(DAVE);
        assertEq(fourthPayment, 33.75 ether);
        _assertTargetLiabilities(72.375 ether, 8.875 ether, firstPayment + secondPayment + thirdPayment + fourthPayment);
        assertEq(targetRouter.splitRemainder(), 0);

        resonance.setBribeBps(0);
        _assertTargetLiabilities(72.375 ether, 8.875 ether, firstPayment + secondPayment + thirdPayment + fourthPayment);
        assertEq(targetRouter.payFundPayment(), 72.375 ether);
        assertEq(targetRouter.notifyBribeReward(), 8.875 ether);
        assertEq(target.balanceOf(address(fund)), 72.375 ether);
        assertEq(target.balanceOf(address(targetBribe)), 8.875 ether);
    }

    function test_WeightedSplitRemainderSurvivesTenZeroFiveAndTwentyPercentTransitions() external {
        _routeTargetPayment(7);
        _assertTargetLiabilities(7, 0, 7);
        assertEq(targetRouter.splitRemainder(), 7_000);

        resonance.setBribeBps(0);
        _routeTargetPayment(3);
        _assertTargetLiabilities(10, 0, 10);
        assertEq(targetRouter.splitRemainder(), 7_000, "zero policy preserves existing sub-token carry");

        resonance.setBribeBps(500);
        _routeTargetPayment(4);
        _assertTargetLiabilities(14, 0, 14);
        assertEq(targetRouter.splitRemainder(), 9_000);

        resonance.setBribeBps(2_000);
        _routeTargetPayment(1);
        _assertTargetLiabilities(14, 1, 15);
        assertEq(targetRouter.splitRemainder(), 1_000);
    }

    function test_ChangingPolicyCannotRepriceOldLiabilitiesOrInterruptTheirRewardStream() external {
        _signalDefault(ALICE, 100 ether);
        _routeTargetPayment(70 ether);
        _assertTargetLiabilities(63 ether, 7 ether, 70 ether);

        resonance.setBribeBps(0);
        _assertTargetLiabilities(63 ether, 7 ether, 70 ether);
        assertEq(targetRouter.notifyBribeReward(), 7 ether, "the pre-change Bribe liability stays payable");
        assertEq(targetBribe.scheduledRewards(address(target)), 7 ether);
        assertEq(targetBribe.lifetimeRewardNotified(address(target)), 7 ether);

        _routeTargetPayment(70 ether);
        _assertTargetLiabilities(133 ether, 0, 133 ether);
        assertEq(targetRouter.notifyBribeReward(), 0, "zero-share settlement is an idempotent no-op");
        assertEq(targetBribe.scheduledRewards(address(target)), 7 ether);

        vm.warp(block.timestamp + 1 days);
        uint256 releasedAfterOneDay = 7 ether - targetBribe.left(address(target));
        assertEq(targetBribe.earned(ALICE, address(target)), releasedAfterOneDay);
        resonance.setBribeBps(500);
        resonance.setBribeBps(2_000);
        assertEq(
            targetBribe.earned(ALICE, address(target)),
            releasedAfterOneDay,
            "policy changes do not checkpoint or reprice"
        );

        vm.warp(block.timestamp + 6 days);
        assertEq(targetBribe.claimReward(ALICE, address(target)), 7 ether);
        assertEq(target.balanceOf(ALICE), 7 ether);
        assertEq(targetRouter.payFundPayment(), 133 ether);
        assertEq(target.balanceOf(address(fund)), 133 ether);
    }

    function test_ZeroShareDoesNotBrickSignalMoveOrWithdrawal() external {
        resonance.setBribeBps(0);
        _signalDefault(ALICE, 100 ether);

        vm.startPrank(ALICE);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 40 ether);
        signalGBX.withdrawSignal(address(targetStrategy), 10 ether);
        signalGBX.withdrawSignal(address(gbxStrategy), 15 ether);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 75 ether);
        assertEq(gbx.balanceOf(ALICE), 25 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 75 ether);
        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), 50 ether);
        assertEq(resonance.accountSignals(ALICE, address(gbxStrategy)), 25 ether);
        assertEq(resonance.totalSignalWeight(), 75 ether);

        _removeAllSignals(ALICE);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    function test_ZeroSharePreservesMoveAndWithdrawalFromAKilledStrategy() external {
        resonance.setBribeBps(0);
        _signalDefault(ALICE, 100 ether);
        resonance.killStrategy(address(targetStrategy));

        vm.startPrank(ALICE);
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 40 ether);
        signalGBX.withdrawSignal(address(targetStrategy), 60 ether);
        signalGBX.withdrawSignal(address(gbxStrategy), 40 ether);
        vm.stopPrank();

        assertFalse(resonance.isStrategyAlive(address(targetStrategy)));
        assertEq(targetBribe.balanceOf(ALICE), 0);
        assertEq(gbxBribe.balanceOf(ALICE), 0);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    function test_ZeroAutomaticShareStillAllowsIndependentlyFundedBribeRewards() external {
        resonance.setBribeBps(0);
        _signalDefault(ALICE, 100 ether);
        resonance.addBribeReward(address(targetStrategy), address(secondAsset));

        _routeTargetPayment(10 ether);
        assertEq(targetRouter.bribePaymentLiability(), 0);
        assertEq(targetRouter.notifyBribeReward(), 0);

        secondAsset.mint(DAVE, 7 ether);
        vm.startPrank(DAVE);
        secondAsset.approve(address(targetBribe), 7 ether);
        targetBribe.notifyRewardAmount(address(secondAsset), 7 ether);
        vm.stopPrank();

        assertEq(targetBribe.scheduledRewards(address(secondAsset)), 7 ether);
        vm.warp(block.timestamp + targetBribe.REWARD_DURATION());
        assertEq(targetBribe.claimReward(ALICE, address(secondAsset)), 7 ether);
        assertEq(secondAsset.balanceOf(ALICE), 7 ether);
    }

    function test_PaymentTokenCallbackCannotRetroactivelyChangeTheCurrentPaymentsSnapshot() external {
        BribeBpsCallbackToken callbackToken = new BribeBpsCallbackToken();
        (address strategyAddress,, address routerAddress) =
            resonance.addStrategy(IERC20(address(callbackToken)), defaultConfig());
        BribeRouter callbackRouter = BribeRouter(routerAddress);

        BribeBpsCallbackGovernor callbackGovernor = new BribeBpsCallbackGovernor(resonance, address(callbackToken));
        resonance.transferOwnership(address(callbackGovernor));
        callbackToken.armCallback(callbackGovernor, routerAddress, 2_000);

        _routeCallbackPayment(callbackToken, strategyAddress, callbackRouter, 10 ether);
        assertEq(resonance.bribeBps(), 2_000, "the callback changes policy for later payments");
        assertEq(callbackRouter.fundPaymentLiability(), 9 ether);
        assertEq(callbackRouter.bribePaymentLiability(), 1 ether, "the in-flight payment retains its entry snapshot");

        _routeCallbackPayment(callbackToken, strategyAddress, callbackRouter, 10 ether);
        assertEq(callbackRouter.fundPaymentLiability(), 17 ether);
        assertEq(callbackRouter.bribePaymentLiability(), 3 ether, "the next payment observes the new policy");
    }

    function testFuzz_ArbitraryRateTransitionsMatchTheWeightedNumeratorModel(
        uint256[4] calldata rawAmounts,
        uint16[4] calldata rawRates
    ) external {
        uint256 expectedBribe;
        uint256 expectedRemainder;
        uint256 totalRouted;

        for (uint256 i; i < rawAmounts.length; ++i) {
            uint256 amount = bound(rawAmounts[i], 1, 1e30);
            uint256 rate = bound(uint256(rawRates[i]), 0, resonance.MAX_BRIBE_BPS());
            resonance.setBribeBps(rate);
            _routeTargetPayment(amount);

            uint256 weightedNumerator = expectedRemainder + amount * rate;
            expectedBribe += weightedNumerator / resonance.BPS();
            expectedRemainder = weightedNumerator % resonance.BPS();
            totalRouted += amount;

            assertEq(targetRouter.bribePaymentLiability(), expectedBribe);
            assertEq(targetRouter.fundPaymentLiability(), totalRouted - expectedBribe);
            assertEq(targetRouter.splitRemainder(), expectedRemainder);
            assertEq(targetRouter.accountedPaymentBalance(), totalRouted);
        }
    }

    function _fillTargetAuction(address buyer) private returns (uint256 payment) {
        usdg.mint(address(targetStrategy), 1);
        payment = _buyTarget(buyer, targetStrategy, target);
    }

    function _routeTargetPayment(uint256 amount) private {
        target.mint(address(targetStrategy), amount);
        vm.startPrank(address(targetStrategy));
        target.approve(address(targetRouter), amount);
        targetRouter.routePayment(amount);
        vm.stopPrank();
    }

    function _routeCallbackPayment(
        BribeBpsCallbackToken callbackToken,
        address strategyAddress,
        BribeRouter callbackRouter,
        uint256 amount
    ) private {
        callbackToken.mint(strategyAddress, amount);
        vm.startPrank(strategyAddress);
        callbackToken.approve(address(callbackRouter), amount);
        callbackRouter.routePayment(amount);
        vm.stopPrank();
    }

    function _assertTargetLiabilities(uint256 expectedFund, uint256 expectedBribe, uint256 expectedTotal) private view {
        assertEq(targetRouter.fundPaymentLiability(), expectedFund);
        assertEq(targetRouter.bribePaymentLiability(), expectedBribe);
        assertEq(targetRouter.accountedPaymentBalance(), expectedTotal);
        assertEq(expectedFund + expectedBribe, expectedTotal);
    }
}
