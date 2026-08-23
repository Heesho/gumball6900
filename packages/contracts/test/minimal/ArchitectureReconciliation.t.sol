// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ProtocolFixture } from "./utils/ProtocolFixture.sol";

interface IReconciledResonance {
    function liveStrategyCount() external view returns (uint256 count);
}

/// @title ArchitectureReconciliationRegressionTest
/// @notice Deterministic regressions for ADR 0031 and ADR 0032 before their production fixes are applied.
contract ArchitectureReconciliationRegressionTest is ProtocolFixture {
    function setUp() external {
        _deployProtocol();
        _mintTestGBX(ALICE, 1_000 ether);
    }

    function test_SignalAtomicallyCustodiesMintsVotesAndMirrorsThePairedBribe() external {
        uint256 amount = 100 ether;

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), amount);
        signalGBX.signal(address(targetStrategy), amount);
        vm.stopPrank();

        assertEq(gbx.balanceOf(ALICE), 900 ether);
        assertEq(gbx.balanceOf(address(signalGBX)), amount);
        assertEq(signalGBX.balanceOf(ALICE), amount);
        assertEq(signalGBX.totalSupply(), amount);
        assertEq(signalGBX.getVotes(ALICE), amount);
        assertEq(targetBribe.balanceOf(ALICE), amount);
        assertEq(targetBribe.totalSupply(), amount);
        assertEq(resonance.accountSignals(ALICE, address(targetStrategy)), amount);
        assertEq(resonance.accountSignalWeight(ALICE), amount);
        assertEq(resonance.totalSignalWeight(), amount);
    }

    function test_RemovedIdleReceiptSelectorsAreAbsentFromRuntime() external view {
        assertFalse(_hasPush4Selector(address(signalGBX), bytes4(keccak256("stake(uint256)"))));
        assertFalse(_hasPush4Selector(address(signalGBX), bytes4(keccak256("unstake(uint256)"))));
        assertFalse(_hasPush4Selector(address(signalGBX), bytes4(keccak256("stakeAndSignal(address,uint256)"))));
        assertFalse(
            _hasPush4Selector(
                address(signalGBX),
                bytes4(keccak256("stakeAndSignalWithPermit(address,uint256,uint256,uint8,bytes32,bytes32)"))
            )
        );
        assertFalse(_hasPush4Selector(address(signalGBX), bytes4(keccak256("removeSignal(address,uint256)"))));
        assertFalse(_hasPush4Selector(address(signalGBX), bytes4(keccak256("removeSignalAndUnstake(address,uint256)"))));
    }

    function test_RemovedMultiTokenResonanceSelectorsAreAbsentFromRuntime() external view {
        address target = address(resonance);

        assertFalse(_hasPush4Selector(target, bytes4(keccak256("token_RewardData(address)"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("token_IsReward(address)"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("rewardTokens(uint256)"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("getRewardTokens()"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("account_Token_RewardPerTokenPaid(address,address)"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("account_Token_Rewards(address,address)"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("lastTimeRewardApplicable(address)"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("rewardPerToken(address)"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("earned(address,address)"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("left(address)"))));
        assertFalse(_hasPush4Selector(target, bytes4(keccak256("getRewardForDuration(address)"))));
    }

    function test_RemovedResonanceMoveHookIsAbsentFromRuntime() external view {
        assertFalse(
            _hasPush4Selector(address(resonance), bytes4(keccak256("moveSignalFor(address,address,address,uint256)")))
        );
        assertTrue(_hasPush4Selector(address(signalGBX), bytes4(keccak256("moveSignal(address,address,uint256)"))));
    }

    function test_KillingTheFinalLiveStrategyRevertsAfterBootstrap() external {
        resonance.killStrategy(address(targetStrategy));
        assertEq(IReconciledResonance(address(resonance)).liveStrategyCount(), 1);

        vm.expectRevert();
        resonance.killStrategy(address(gbxStrategy));
    }

    function test_StrategySplitsPaymentInlineAndRouterOnlyDistributesTheBribeShare() external {
        usdg.mint(address(targetStrategy), 1);
        uint256 price = targetStrategy.currentPrice();
        uint256 bribeAmount = (price * resonance.bribeBps()) / resonance.BPS();
        uint256 fundAmount = price - bribeAmount;

        assertEq(_buyTarget(DAVE, targetStrategy, target), price);
        assertEq(target.balanceOf(address(fund)), fundAmount);
        assertEq(target.balanceOf(address(targetRouter)), bribeAmount);
        assertEq(target.balanceOf(address(targetStrategy)), 0);

        assertEq(targetRouter.distribute(), bribeAmount);
        assertEq(target.balanceOf(address(targetRouter)), 0);
        assertEq(target.balanceOf(address(targetBribe)), bribeAmount);
        assertEq(targetBribe.lifetimeRewardNotified(address(target)), bribeAmount);
    }

    function test_RemovedRouterLiabilityAndCarrySelectorsAreAbsentFromRuntime() external view {
        address router = address(targetRouter);
        assertFalse(_hasPush4Selector(router, bytes4(keccak256("routePayment(uint256)"))));
        assertFalse(_hasPush4Selector(router, bytes4(keccak256("payFundPayment()"))));
        assertFalse(_hasPush4Selector(router, bytes4(keccak256("notifyBribeReward()"))));
        assertFalse(_hasPush4Selector(router, bytes4(keccak256("fundPaymentLiability()"))));
        assertFalse(_hasPush4Selector(router, bytes4(keccak256("bribePaymentLiability()"))));
        assertFalse(_hasPush4Selector(router, bytes4(keccak256("splitRemainder()"))));
        assertFalse(_hasPush4Selector(router, bytes4(keccak256("accountedPaymentBalance()"))));
    }

    function _hasPush4Selector(address target, bytes4 selector) private view returns (bool found) {
        bytes memory runtime = target.code;
        uint32 expected = uint32(selector);
        for (uint256 i; i + 4 < runtime.length; ++i) {
            if (runtime[i] != bytes1(0x63)) continue;
            uint32 candidate = uint32(uint8(runtime[i + 1])) << 24 | uint32(uint8(runtime[i + 2])) << 16
                | uint32(uint8(runtime[i + 3])) << 8 | uint32(uint8(runtime[i + 4]));
            if (candidate == expected) return true;
        }
    }
}
