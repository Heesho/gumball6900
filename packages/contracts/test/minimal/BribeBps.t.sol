// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { MockERC20 } from "./utils/Tokens.sol";

interface IBribeBpsCallbackGovernor {
    function setBribeBpsFromPaymentToken(uint256 newBribeBps) external;
}

/// @notice Standard ERC-20 test token that can ask the governance harness to change policy during one transfer.
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

    function acceptResonanceOwnership() external {
        resonance.acceptOwnership();
    }

    function setBribeBpsFromPaymentToken(uint256 newBribeBps) external {
        require(msg.sender == paymentToken, "NOT_PAYMENT_TOKEN");
        resonance.setBribeBps(newBribeBps);
    }
}

/// @title Governed global Bribe-share transition tests
/// @notice Proves prospective, per-purchase floored Strategy splitting across the bounded global policy range.
contract BribeBpsTransitionTest is ProtocolFixture {
    event BribeBpsSet(uint256 previousBribeBps, uint256 newBribeBps);

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
        _assertTargetBalances(9 ether, 1 ether);

        resonance.setBribeBps(0);
        uint256 secondPayment = _fillTargetAuction(BOB);
        assertEq(secondPayment, 15 ether);
        _assertTargetBalances(24 ether, 1 ether);

        resonance.setBribeBps(500);
        uint256 thirdPayment = _fillTargetAuction(CAROL);
        assertEq(thirdPayment, 22.5 ether);
        _assertTargetBalances(45.375 ether, 2.125 ether);

        resonance.setBribeBps(2_000);
        uint256 fourthPayment = _fillTargetAuction(DAVE);
        assertEq(fourthPayment, 33.75 ether);
        _assertTargetBalances(72.375 ether, 8.875 ether);

        resonance.setBribeBps(0);
        assertEq(targetRouter.route(), 8.875 ether);
        assertEq(target.balanceOf(address(fund)), 72.375 ether);
        assertEq(target.balanceOf(address(targetRouter)), 0);
        assertEq(target.balanceOf(address(targetBribe)), 8.875 ether);
    }

    function test_EachPurchaseFloorsItsOwnBribeShareWithoutCarry() external {
        Strategy.Config memory config = Strategy.Config({
            initialPrice: 1_000_009, epochDuration: 1 days, priceMultiplier: 1.1e18, minimumPrice: 1e6
        });
        (address strategyAddress,, address routerAddress) = resonance.addStrategy(IERC20(address(target)), config);
        Strategy strategy = Strategy(strategyAddress);

        uint256 fundBefore = target.balanceOf(address(fund));
        usdg.mint(strategyAddress, 1);
        uint256 firstPayment = _buyTarget(ALICE, strategy, target);
        usdg.mint(strategyAddress, 1);
        uint256 secondPayment = _buyTarget(BOB, strategy, target);

        assertEq(firstPayment, 1_000_009);
        assertEq(secondPayment, 1_100_009);
        uint256 perPurchaseBribe = firstPayment / 10 + secondPayment / 10;
        assertEq(perPurchaseBribe, 210_000);
        assertEq((firstPayment + secondPayment) / 10, perPurchaseBribe + 1, "no fractional carry crosses purchases");
        assertEq(target.balanceOf(routerAddress), perPurchaseBribe);
        assertEq(target.balanceOf(address(fund)) - fundBefore, firstPayment + secondPayment - perPurchaseBribe);
    }

    function test_ChangingPolicyCannotRepriceAnOldBufferedShareOrInterruptItsStream() external {
        _signalDefault(ALICE, 100 ether);
        uint256 firstPayment = _fillTargetAuction(BOB);
        assertEq(firstPayment, 10 ether);
        _assertTargetBalances(9 ether, 1 ether);

        resonance.setBribeBps(0);
        uint256 secondPayment = _fillTargetAuction(CAROL);
        assertEq(secondPayment, 15 ether);
        _assertTargetBalances(24 ether, 1 ether);

        assertEq(targetRouter.route(), 1 ether, "the pre-change buffered share stays distributable");
        assertEq(targetBribe.lifetimeRewardNotified(address(target)), 1 ether);

        vm.warp(block.timestamp + 1 days);
        uint256 releasedAfterOneDay = 1 days * (uint256(1 ether) / targetBribe.REWARD_DURATION());
        assertEq(targetBribe.earned(ALICE, address(target)), releasedAfterOneDay);

        resonance.setBribeBps(500);
        resonance.setBribeBps(2_000);
        assertEq(targetBribe.earned(ALICE, address(target)), releasedAfterOneDay, "policy changes do not checkpoint");

        vm.warp(block.timestamp + 6 days);
        uint256 scheduled = targetBribe.REWARD_DURATION() * (uint256(1 ether) / targetBribe.REWARD_DURATION());
        vm.prank(ALICE);
        assertEq(targetBribe.claimReward(ALICE, address(target)), scheduled);
        assertEq(target.balanceOf(ALICE), scheduled);
        assertEq(target.balanceOf(address(fund)), 24 ether);
    }

    function test_ZeroShareDoesNotBrickSignalReallocationOrRemoval() external {
        resonance.setBribeBps(0);
        _signalDefault(ALICE, 100 ether);

        vm.startPrank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 40 ether);
        gbx.approve(address(signalGBX), 40 ether);
        signalGBX.addSignal(address(gbxStrategy), 40 ether);
        signalGBX.removeSignal(address(targetStrategy), 10 ether);
        signalGBX.removeSignal(address(gbxStrategy), 15 ether);
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 75 ether);
        assertEq(gbx.balanceOf(ALICE), 25 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 75 ether);
        assertEq(_accountSignalWeight(ALICE, address(targetStrategy)), 50 ether);
        assertEq(_accountSignalWeight(ALICE, address(gbxStrategy)), 25 ether);
        assertEq(resonance.totalSignalWeight(), 75 ether);

        _removeAllSignals(ALICE);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    function test_ZeroSharePreservesRemoveAndReaddFromAKilledStrategy() external {
        resonance.setBribeBps(0);
        _signalDefault(ALICE, 100 ether);
        resonance.killStrategy(address(targetStrategy));

        vm.startPrank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 40 ether);
        gbx.approve(address(signalGBX), 40 ether);
        signalGBX.addSignal(address(gbxStrategy), 40 ether);
        signalGBX.removeSignal(address(targetStrategy), 60 ether);
        signalGBX.removeSignal(address(gbxStrategy), 40 ether);
        vm.stopPrank();

        assertFalse(resonance.isStrategyLive(address(targetStrategy)));
        assertEq(targetBribe.signalWeightOf(ALICE), 0);
        assertEq(gbxBribe.signalWeightOf(ALICE), 0);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(signalGBX.totalSupply(), 0);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), 0);
        assertEq(resonance.totalSignalWeight(), 0);
    }

    function test_ZeroAutomaticShareStillAllowsIndependentlyFundedBribeRewards() external {
        resonance.setBribeBps(0);
        _signalDefault(ALICE, 100 ether);
        resonance.addBribeRewardToken(address(targetStrategy), address(secondAsset));

        uint256 payment = _fillTargetAuction(BOB);
        assertEq(target.balanceOf(address(fund)), payment);
        assertEq(target.balanceOf(address(targetRouter)), 0);
        assertEq(targetRouter.route(), 0);

        secondAsset.mint(DAVE, 7 ether);
        vm.startPrank(DAVE);
        secondAsset.approve(address(targetBribe), 7 ether);
        targetBribe.notifyReward(address(secondAsset), 7 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + targetBribe.REWARD_DURATION());
        uint256 scheduled = targetBribe.REWARD_DURATION() * (uint256(7 ether) / targetBribe.REWARD_DURATION());
        vm.prank(ALICE);
        assertEq(targetBribe.claimReward(ALICE, address(secondAsset)), scheduled);
        assertEq(secondAsset.balanceOf(ALICE), scheduled);
    }

    function test_PaymentTokenCallbackCannotRetroactivelyChangeTheCurrentPaymentsSnapshot() external {
        BribeBpsCallbackToken callbackToken = new BribeBpsCallbackToken();
        (address strategyAddress,, address routerAddress) =
            resonance.addStrategy(IERC20(address(callbackToken)), defaultConfig());
        Strategy callbackStrategy = Strategy(strategyAddress);

        BribeBpsCallbackGovernor callbackGovernor = new BribeBpsCallbackGovernor(resonance, address(callbackToken));
        resonance.transferOwnership(address(callbackGovernor));
        callbackGovernor.acceptResonanceOwnership();
        callbackToken.armCallback(callbackGovernor, strategyAddress, 2_000);

        uint256 firstPayment = _buyCallbackPayment(callbackToken, callbackStrategy, ALICE);
        assertEq(firstPayment, 10 ether);
        assertEq(resonance.bribeBps(), 2_000, "the callback changes policy for later payments");
        assertEq(callbackToken.balanceOf(address(fund)), 9 ether);
        assertEq(callbackToken.balanceOf(routerAddress), 1 ether, "the in-flight payment retains its entry snapshot");

        uint256 secondPayment = _buyCallbackPayment(callbackToken, callbackStrategy, BOB);
        assertEq(secondPayment, 15 ether);
        assertEq(callbackToken.balanceOf(address(fund)), 21 ether);
        assertEq(callbackToken.balanceOf(routerAddress), 4 ether, "the next payment observes the new policy");
    }

    function testFuzz_OnePurchaseUsesTheCurrentRateAndFloorsItsShare(uint96 rawPrice, uint16 rawRate) external {
        uint256 price = bound(uint256(rawPrice), 1e6, 1e30);
        uint256 rate = bound(uint256(rawRate), 0, resonance.MAX_BRIBE_BPS());
        resonance.setBribeBps(rate);

        Strategy.Config memory config =
            Strategy.Config({ initialPrice: price, epochDuration: 1 days, priceMultiplier: 1.1e18, minimumPrice: 1e6 });
        (address strategyAddress,, address routerAddress) = resonance.addStrategy(IERC20(address(target)), config);
        Strategy strategy = Strategy(strategyAddress);

        uint256 fundBefore = target.balanceOf(address(fund));
        usdg.mint(strategyAddress, 1);
        uint256 paid = _buyTarget(ALICE, strategy, target);
        uint256 expectedBribe = (price * rate) / resonance.BPS();

        assertEq(paid, price);
        assertEq(target.balanceOf(routerAddress), expectedBribe);
        assertEq(target.balanceOf(address(fund)) - fundBefore, price - expectedBribe);
        assertEq(target.balanceOf(strategyAddress), 0);
    }

    function _fillTargetAuction(address buyer) private returns (uint256 payment) {
        usdg.mint(address(targetStrategy), 1);
        payment = _buyTarget(buyer, targetStrategy, target);
    }

    function _buyCallbackPayment(BribeBpsCallbackToken token, Strategy strategy, address buyer)
        private
        returns (uint256 paid)
    {
        usdg.mint(address(strategy), 1);
        uint256 price = strategy.currentPrice();
        token.mint(buyer, price);

        vm.startPrank(buyer);
        token.approve(address(strategy), price);
        paid = strategy.buy(buyer, strategy.epochId(), block.timestamp, price);
        vm.stopPrank();
    }

    function _assertTargetBalances(uint256 expectedFund, uint256 expectedBufferedBribe) private view {
        assertEq(target.balanceOf(address(fund)), expectedFund);
        assertEq(target.balanceOf(address(targetRouter)), expectedBufferedBribe);
        assertEq(target.balanceOf(address(targetStrategy)), 0);
    }
}
