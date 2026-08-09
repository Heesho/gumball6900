// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { console } from "forge-std/console.sol";

import { Bribe } from "../../src/core/Bribe.sol";
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
        assertLt(removeSlope, 85_000, "exit slope changed materially");
    }

    function test_MaximumRewardTokenGasStaysFarBelowABlock() external {
        uint256 removeGas = _measureMaximumRemove();
        uint256 claimGas = _measureMaximumClaim();
        uint256 buyGas = _measureMaximumBuy();

        console.log("removeSignal gas at MAX_REWARD_TOKENS", removeGas);
        console.log("claimRewards gas at MAX_REWARD_TOKENS", claimGas);
        console.log("Strategy.buy gas at MAX_REWARD_TOKENS", buyGas);

        assertLt(removeGas, 3_000_000, "removal must retain at least 10x headroom under a 30M block");
        assertLt(claimGas, 3_000_000, "claiming must retain at least 10x headroom under a 30M block");
        assertLt(buyGas, 3_000_000, "settlement must retain at least 10x headroom under a 30M block");
    }

    function _measureAddAndRemove(uint256 extraRewardTokens) private returns (uint256 addGas, uint256 removeGas) {
        _deployProtocol();
        _addRewardTokens(extraRewardTokens);
        _stake(ALICE, 100 ether);

        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        resonance.addSignal(address(acquisitionStrategy), 100 ether);
        addGas = gasBefore - gasleft();
        vm.stopPrank();

        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);

        vm.startPrank(ALICE);
        gasBefore = gasleft();
        resonance.removeSignal(address(acquisitionStrategy), 100 ether);
        removeGas = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumRemove() private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(acquisitionBribe.MAX_REWARD_TOKENS() - 1);
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(acquisitionStrategy), 100 ether);
        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);

        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        resonance.removeSignal(address(acquisitionStrategy), 100 ether);
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumClaim() private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(acquisitionBribe.MAX_REWARD_TOKENS() - 1);
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(acquisitionStrategy), 100 ether);
        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);

        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        resonance.claimRewards(_addresses(address(acquisitionStrategy)));
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumBuy() private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(acquisitionBribe.MAX_REWARD_TOKENS() - 1);
        _stake(ALICE, 100 ether);
        vm.prank(ALICE);
        resonance.addSignal(address(acquisitionStrategy), 100 ether);
        _routeRevenue(100_000_000);
        resonance.distribute(address(acquisitionStrategy));

        uint256 price = acquisitionStrategy.currentPrice();
        target.mint(CAROL, price);
        vm.startPrank(CAROL);
        target.approve(address(acquisitionStrategy), price);
        uint256 gasBefore = gasleft();
        acquisitionStrategy.buy(CAROL, acquisitionStrategy.epochId(), block.timestamp, price);
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _addRewardTokens(uint256 count) private {
        for (uint256 i; i < count; ++i) {
            MockERC20 extra = new MockERC20("Extra Reward", "XTRA", 18);
            resonance.addBribeReward(address(acquisitionStrategy), address(extra));
        }
    }

    function _startEveryRewardStream() private {
        address[] memory tokens = acquisitionBribe.rewardTokens();
        for (uint256 i; i < tokens.length; ++i) {
            MockERC20 token = MockERC20(tokens[i]);
            token.mint(address(this), STREAM_AMOUNT);
            token.approve(address(acquisitionBribe), STREAM_AMOUNT);
            acquisitionBribe.notifyRewardAmount(address(token), STREAM_AMOUNT);
        }
    }
}
