// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { console } from "forge-std/console.sol";

import { Bribe } from "../../src/core/Bribe.sol";
import { BribeRouter } from "../../src/core/BribeRouter.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { MockERC20 } from "./utils/Tokens.sol";

/// @title SignalGasTest
/// @notice Measured gas regressions for every reward-token loop on a signaler's exit and a Strategy's settlement.
contract SignalGasTest is ProtocolFixture {
    uint256 private constant STREAM_AMOUNT = 10 ether;

    function test_RemoveSignalCostsNoMoreThanAddSignalInTheShippedConfiguration() external {
        (uint256 addGas, uint256 removeGas) = _measureAddAndRemove(0);

        console.log("addSignal gas, one reward token", addGas);
        console.log("removeSignal gas, one reward token", removeGas);
        assertLe(removeGas, addGas, "the shipped exit must not cost more than entry");
    }

    function test_RewardTokenGasSlopeIsRecordedAndBounded() external {
        (uint256 addOne, uint256 removeOne) = _measureAddAndRemove(0);
        (uint256 addFour, uint256 removeFour) = _measureAddAndRemove(3);

        uint256 addSlope = (addFour - addOne) / 3;
        uint256 removeSlope = (removeFour - removeOne) / 3;
        console.log("addSignal gas per additional reward token", addSlope);
        console.log("removeSignal gas per additional reward token", removeSlope);

        assertGt(addSlope, 10_000, "the measurement must keep observing the reward-token loop");
        assertLt(addSlope, 35_000, "entry slope changed materially");
        assertGt(removeSlope, 40_000, "the measurement must keep observing exit checkpoint writes");
        assertLt(removeSlope, 200_000, "exit slope changed materially");
    }

    function test_MaximumRewardTokenGasStaysFarBelowABlock() external {
        uint256 addGas = _measureMaximumAdd();
        uint256 removeGas = _measureMaximumRemove();
        uint256 scalarClaimGas = _measureMaximumSelectiveClaim(false);
        uint256 selectiveClaimGas = _measureMaximumSelectiveClaim(true);
        uint256 claimGas = _measureMaximumClaim();
        uint256 buyGas = _measureMaximumBuy();

        console.log("addSignal gas at MAX_REWARD_TOKENS", addGas);
        console.log("removeSignal gas at MAX_REWARD_TOKENS", removeGas);
        console.log("claimReward gas with MAX_REWARD_TOKENS registered", scalarClaimGas);
        console.log("selective eight-token claim gas", selectiveClaimGas);
        console.log("claimRewards gas at MAX_REWARD_TOKENS", claimGas);
        console.log("Strategy.buy gas at MAX_REWARD_TOKENS", buyGas);

        assertLt(addGas, 3_000_000, "entry must retain at least 10x headroom under a 30M block");
        assertLt(removeGas, 3_000_000, "removal must retain at least 10x headroom under a 30M block");
        assertLt(scalarClaimGas, 3_000_000, "scalar claims must retain at least 10x headroom under a 30M block");
        assertLt(selectiveClaimGas, 3_000_000, "selective claims must retain at least 10x headroom under a 30M block");
        assertLt(claimGas, 3_000_000, "claiming must retain at least 10x headroom under a 30M block");
        assertLt(buyGas, 3_000_000, "settlement must retain at least 10x headroom under a 30M block");
    }

    function test_FixedLiabilityAndGovernanceGasIsRecorded() external {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 2);

        MockERC20 eighth = new MockERC20("Eighth Reward", "EIGHT", 18);
        uint256 gasBefore = gasleft();
        resonance.addBribeReward(address(targetStrategy), address(eighth));
        uint256 addEighthGas = gasBefore - gasleft();

        MockERC20 ninth = new MockERC20("Ninth Reward", "NINTH", 18);
        gasBefore = gasleft();
        (bool ninthSucceeded,) =
            address(resonance).call(abi.encodeCall(resonance.addBribeReward, (address(targetStrategy), address(ninth))));
        uint256 rejectNinthGas = gasBefore - gasleft();
        assertFalse(ninthSucceeded);

        usdg.mint(address(targetStrategy), 100_000_000);
        uint256 price = targetStrategy.currentPrice();
        target.mint(CAROL, price);
        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), price);
        targetStrategy.buy(CAROL, targetStrategy.epochId(), block.timestamp, price);
        vm.stopPrank();

        BribeRouter router = targetRouter;
        gasBefore = gasleft();
        router.payFundPayment();
        uint256 fundPayoutGas = gasBefore - gasleft();

        gasBefore = gasleft();
        resonance.killStrategy(address(targetStrategy));
        uint256 killGas = gasBefore - gasleft();

        console.log("addBribeReward token eight gas", addEighthGas);
        console.log("rejected token nine gas", rejectNinthGas);
        console.log("Fund-bound reward payout gas", fundPayoutGas);
        console.log("killStrategy gas", killGas);
    }

    function _measureAddAndRemove(uint256 extraRewardTokens) private returns (uint256 addGas, uint256 removeGas) {
        _deployProtocol();
        _addRewardTokens(extraRewardTokens);
        _stake(ALICE, 100 ether);

        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        resonance.addSignal(address(targetStrategy), 100 ether);
        addGas = gasBefore - gasleft();
        vm.stopPrank();

        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);

        vm.startPrank(ALICE);
        gasBefore = gasleft();
        resonance.removeSignal(address(targetStrategy), 100 ether);
        removeGas = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumRemove() private returns (uint256 gasUsed) {
        _deployProtocol();
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(targetStrategy), 100 ether);
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);
        resonance.killStrategy(address(targetStrategy));

        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        resonance.removeSignal(address(targetStrategy), 100 ether);
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumAdd() private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _stake(ALICE, 100 ether);

        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        resonance.addSignal(address(targetStrategy), 100 ether);
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumSelectiveClaim(bool allTokens) private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(targetStrategy), 100 ether);
        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);

        address[] memory tokens = targetBribe.rewardTokens();
        uint256 gasBefore = gasleft();
        if (allTokens) {
            targetBribe.claimRewards(ALICE, tokens);
        } else {
            targetBribe.claimReward(ALICE, tokens[0]);
        }
        gasUsed = gasBefore - gasleft();
    }

    function _measureMaximumClaim() private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(targetStrategy), 100 ether);
        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);

        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        resonance.claimRewards(_addresses(address(targetStrategy)));
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumBuy() private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(targetStrategy), 100 ether);
        _routeRevenue(100_000_000);
        resonance.distribute(address(targetStrategy));

        uint256 price = targetStrategy.currentPrice();
        target.mint(CAROL, price);
        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), price);
        uint256 gasBefore = gasleft();
        targetStrategy.buy(CAROL, targetStrategy.epochId(), block.timestamp, price);
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _addRewardTokens(uint256 count) private {
        for (uint256 i; i < count; ++i) {
            MockERC20 extra = new MockERC20("Extra Reward", "XTRA", 18);
            resonance.addBribeReward(address(targetStrategy), address(extra));
        }
    }

    function _startEveryRewardStream() private {
        address[] memory tokens = targetBribe.rewardTokens();
        for (uint256 i; i < tokens.length; ++i) {
            MockERC20 token = MockERC20(tokens[i]);
            token.mint(address(this), STREAM_AMOUNT);
            token.approve(address(targetBribe), STREAM_AMOUNT);
            targetBribe.notifyRewardAmount(address(token), STREAM_AMOUNT);
        }
    }
}
