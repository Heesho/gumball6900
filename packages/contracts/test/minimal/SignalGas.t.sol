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

    function test_ScalarSignalEntryAndExitRemainCheapInTheShippedConfiguration() external {
        (uint256 addGas, uint256 removeGas) = _measureAddAndRemove(0);

        console.log("addSignal gas, one reward token", addGas);
        console.log("withdrawSignal gas, one reward token", removeGas);
        assertLt(addGas, 400_000, "atomic custody-and-signal entry gas changed materially");
        assertLt(removeGas, 300_000, "scalar exit gas changed materially");
        assertLe(removeGas, addGas + 75_000, "exit overhead changed materially");
    }

    function test_RewardTokenGasSlopeIsRecordedAndBounded() external {
        (uint256 addOne, uint256 removeOne) = _measureAddAndRemove(0);
        (uint256 addFour, uint256 removeFour) = _measureAddAndRemove(3);

        uint256 addSlope = (addFour - addOne) / 3;
        uint256 removeSlope = (removeFour - removeOne) / 3;
        console.log("addSignal gas per additional reward token", addSlope);
        console.log("withdrawSignal gas per additional reward token", removeSlope);

        assertGt(addSlope, 10_000, "the measurement must keep observing the reward-token loop");
        assertLt(addSlope, 35_000, "entry slope changed materially");
        assertGt(removeSlope, 40_000, "the measurement must keep observing exit checkpoint writes");
        assertLt(removeSlope, 200_000, "exit slope changed materially");
    }

    function test_MaximumRewardTokenGasStaysFarBelowABlock() external {
        uint256 addGas = _measureMaximumAdd();
        uint256 removeGas = _measureMaximumRemove();
        uint256 scalarClaimGas = _measureMaximumScalarClaims(false);
        uint256 allScalarClaimsGas = _measureMaximumScalarClaims(true);
        uint256 claimGas = _measureMaximumClaim();
        uint256 buyGas = _measureMaximumBuy();

        console.log("addSignal gas at MAX_REWARD_TOKENS", addGas);
        console.log("withdrawSignal gas at MAX_REWARD_TOKENS", removeGas);
        console.log("claimReward gas with MAX_REWARD_TOKENS registered", scalarClaimGas);
        console.log("sequential scalar claimReward gas at MAX_REWARD_TOKENS", allScalarClaimsGas);
        console.log("claimRewards gas at MAX_REWARD_TOKENS", claimGas);
        console.log("Strategy.buy gas at MAX_REWARD_TOKENS", buyGas);

        assertLt(addGas, 3_000_000, "entry must retain at least 10x headroom under a 30M block");
        assertLt(removeGas, 3_000_000, "removal must retain at least 10x headroom under a 30M block");
        assertLt(scalarClaimGas, 3_000_000, "scalar claims must retain at least 10x headroom under a 30M block");
        assertLt(
            allScalarClaimsGas,
            3_000_000,
            "sequential scalar claims must retain at least 10x headroom under a 30M block"
        );
        assertLt(claimGas, 3_000_000, "claiming must retain at least 10x headroom under a 30M block");
        assertLt(buyGas, 3_000_000, "settlement must retain at least 10x headroom under a 30M block");
    }

    function test_ComposedMoveAtMaximumRewardTokensOnBothBribesStaysFarBelowABlock() external {
        _deployProtocol();
        _signalDefault(ALICE, 100 ether);
        _signalDefault(BOB, 100 ether);
        _signalOne(BOB, address(gbxStrategy));

        _addRewardTokens(address(targetStrategy), targetBribe.MAX_REWARD_TOKENS() - 1);
        _addRewardTokens(address(gbxStrategy), gbxBribe.MAX_REWARD_TOKENS() - 1);
        assertEq(targetBribe.rewardTokens().length, targetBribe.MAX_REWARD_TOKENS());
        assertEq(gbxBribe.rewardTokens().length, gbxBribe.MAX_REWARD_TOKENS());

        _startEveryRewardStream(targetBribe);
        _startEveryRewardStream(gbxBribe);
        vm.warp(block.timestamp + 1 days);

        uint256 receiptSupplyBefore = signalGBX.totalSupply();
        uint256 aliceVotesBefore = signalGBX.getVotes(ALICE);
        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        signalGBX.moveSignal(address(targetStrategy), address(gbxStrategy), 100 ether);
        uint256 moveGas = gasBefore - gasleft();
        vm.stopPrank();

        console.log("composed move gas with MAX_REWARD_TOKENS on both Bribes", moveGas);
        assertLt(moveGas, 3_000_000, "composed move must retain at least 10x headroom under a 30M block");
        assertEq(targetBribe.balanceOf(ALICE), 0);
        assertEq(gbxBribe.balanceOf(ALICE), 100 ether);
        assertEq(resonance.strategySignalWeight(address(targetStrategy)), 0);
        assertEq(resonance.strategySignalWeight(address(gbxStrategy)), 200 ether);
        assertEq(resonance.totalSignalWeight(), 200 ether);
        assertEq(signalGBX.totalSupply(), receiptSupplyBefore);
        assertEq(signalGBX.getVotes(ALICE), aliceVotesBefore);
    }

    function test_BufferDistributionAndGovernanceGasIsRecorded() external {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 2);

        MockERC20 sixteenth = new MockERC20("Sixteenth Reward", "SIXTEENTH", 18);
        uint256 gasBefore = gasleft();
        resonance.addBribeReward(address(targetStrategy), address(sixteenth));
        uint256 addSixteenthGas = gasBefore - gasleft();

        MockERC20 seventeenth = new MockERC20("Seventeenth Reward", "SEVENTEENTH", 18);
        gasBefore = gasleft();
        (bool seventeenthSucceeded,) = address(resonance)
            .call(abi.encodeCall(resonance.addBribeReward, (address(targetStrategy), address(seventeenth))));
        uint256 rejectSeventeenthGas = gasBefore - gasleft();
        assertFalse(seventeenthSucceeded);

        usdg.mint(address(targetStrategy), 100_000_000);
        uint256 price = targetStrategy.currentPrice();
        target.mint(CAROL, price);
        vm.startPrank(CAROL);
        target.approve(address(targetStrategy), price);
        targetStrategy.buy(CAROL, targetStrategy.epochId(), block.timestamp, price);
        vm.stopPrank();

        BribeRouter router = targetRouter;
        gasBefore = gasleft();
        router.distribute();
        uint256 bufferDistributionGas = gasBefore - gasleft();

        gasBefore = gasleft();
        resonance.killStrategy(address(targetStrategy));
        uint256 killGas = gasBefore - gasleft();

        console.log("addBribeReward token sixteen gas", addSixteenthGas);
        console.log("rejected token seventeen gas", rejectSeventeenthGas);
        console.log("buffered Bribe distribution gas", bufferDistributionGas);
        console.log("killStrategy gas", killGas);
    }

    function _measureAddAndRemove(uint256 extraRewardTokens) private returns (uint256 addGas, uint256 removeGas) {
        _deployProtocol();
        _addRewardTokens(extraRewardTokens);
        _mintTestGBX(ALICE, 100 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        uint256 gasBefore = gasleft();
        signalGBX.signal(address(targetStrategy), 100 ether);
        addGas = gasBefore - gasleft();
        vm.stopPrank();

        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);

        vm.startPrank(ALICE);
        gasBefore = gasleft();
        signalGBX.withdrawSignal(address(targetStrategy), 100 ether);
        removeGas = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumRemove() private returns (uint256 gasUsed) {
        _deployProtocol();
        _signalDefault(ALICE, 100 ether);
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);
        resonance.killStrategy(address(targetStrategy));

        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        signalGBX.withdrawSignal(address(targetStrategy), 100 ether);
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumAdd() private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _mintTestGBX(ALICE, 100 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 100 ether);
        uint256 gasBefore = gasleft();
        signalGBX.signal(address(targetStrategy), 100 ether);
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureMaximumScalarClaims(bool allTokens) private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _signalDefault(ALICE, 100 ether);
        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);

        address[] memory tokens = targetBribe.rewardTokens();
        uint256 gasBefore = gasleft();
        if (allTokens) {
            for (uint256 i; i < tokens.length; ++i) {
                targetBribe.claimReward(ALICE, tokens[i]);
            }
        } else {
            targetBribe.claimReward(ALICE, tokens[0]);
        }
        gasUsed = gasBefore - gasleft();
    }

    function _measureMaximumClaim() private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _signalDefault(ALICE, 100 ether);
        _startEveryRewardStream();
        vm.warp(block.timestamp + 1 days);

        uint256 gasBefore = gasleft();
        targetBribe.claimRewards(ALICE);
        gasUsed = gasBefore - gasleft();
    }

    function _measureMaximumBuy() private returns (uint256 gasUsed) {
        _deployProtocol();
        _addRewardTokens(targetBribe.MAX_REWARD_TOKENS() - 1);
        _signalDefault(ALICE, 100 ether);
        usdg.mint(address(targetStrategy), 100_000_000);

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
        _addRewardTokens(address(targetStrategy), count);
    }

    function _addRewardTokens(address strategy, uint256 count) private {
        for (uint256 i; i < count; ++i) {
            MockERC20 extra = new MockERC20("Extra Reward", "XTRA", 18);
            resonance.addBribeReward(strategy, address(extra));
        }
    }

    function _startEveryRewardStream() private {
        _startEveryRewardStream(targetBribe);
    }

    function _startEveryRewardStream(Bribe bribe) private {
        address[] memory tokens = bribe.rewardTokens();
        for (uint256 i; i < tokens.length; ++i) {
            MockERC20 token = MockERC20(tokens[i]);
            if (address(token) == address(gbx)) {
                _mintTestGBX(address(this), STREAM_AMOUNT);
            } else {
                token.mint(address(this), STREAM_AMOUNT);
            }
            token.approve(address(bribe), STREAM_AMOUNT);
            bribe.notifyRewardAmount(address(token), STREAM_AMOUNT);
        }
    }
}
