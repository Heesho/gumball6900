// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { console } from "forge-std/console.sol";

import { Bribe } from "../../../src/core/Bribe.sol";
import { Mine } from "../../../src/core/Mine.sol";
import { Resonance } from "../../../src/core/Resonance.sol";
import { SignalGBX } from "../../../src/core/SignalGBX.sol";
import { ProtocolFixture } from "../utils/ProtocolFixture.sol";
import { MockERC20 } from "../utils/Tokens.sol";

/// @title AuditGasTest
/// @notice Exit-path gas measurements at the protocol's fixed token/slot bounds and practical batch limits.
contract AuditGasTest is ProtocolFixture {
    uint256 private constant REWARD_AMOUNT = 1 ether;
    uint256 private constant PRACTICAL_BATCH_COUNT = 26;
    uint256 private constant OVERSIZED_BATCH_COUNT = 32;
    uint256 private constant TARGET_GAS_LIMIT = 32_000_000;

    function test_Gas_FundOneAndSixteenTokenRedemptions() external {
        uint256 oneTokenGas = _measureFundRedemption(1);
        uint256 sixteenTokenGas = _measureFundRedemption(16);

        console.log("Fund.redeem gas, one selected token", oneTokenGas);
        console.log("Fund.redeem gas, sixteen selected tokens", sixteenTokenGas);
        assertLt(oneTokenGas, 1_000_000);
        assertLt(sixteenTokenGas, 5_000_000);
    }

    function test_Gas_FullyOccupiedMinePaidReplacement() external {
        _deployProtocol();
        usdg.mint(ALICE, 16 * mine.MIN_INITIAL_PRICE());
        vm.startPrank(ALICE);
        usdg.approve(address(mine), type(uint256).max);
        for (uint256 i; i < mine.SLOT_COUNT(); ++i) {
            Mine.Slot memory slotState = mine.slot(i);
            mine.mine(ALICE, i, slotState.epochId, block.timestamp, mine.MIN_INITIAL_PRICE(), "fill");
        }
        vm.stopPrank();
        assertEq(mine.aggregateTps(), mine.INITIAL_TPS());

        vm.warp(block.timestamp + mine.PRICE_DECAY_PERIOD() / 2);
        Mine.Slot memory replaced = mine.slot(0);
        uint256 price = mine.currentPrice(0);
        usdg.mint(BOB, price);
        vm.startPrank(BOB);
        usdg.approve(address(mine), price);
        uint256 gasBefore = gasleft();
        mine.mine(BOB, 0, replaced.epochId, block.timestamp, price, "full graph");
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();

        console.log("Mine.mine gas, paid replacement with all sixteen slots occupied", gasUsed);
        assertLt(gasUsed, 1_000_000);
        assertGt(mine.claimableMinerPayment(ALICE), 0);
    }

    function test_Gas_KilledMaximumRewardTokenExitAndKill() external {
        _deployProtocol();
        _signalDefault(ALICE, 100 ether);
        _fillRewardRegistryAndStartStreams();
        vm.warp(block.timestamp + 1 days);

        uint256 gasBefore = gasleft();
        resonance.killStrategy(address(targetStrategy));
        uint256 killGas = gasBefore - gasleft();

        vm.prank(ALICE);
        gasBefore = gasleft();
        signalGBX.removeSignal(address(targetStrategy), 100 ether);
        uint256 removeGas = gasBefore - gasleft();

        console.log("Resonance.killStrategy gas, sixteen reward tokens", killGas);
        console.log("removeSignal gas, killed Strategy with sixteen accrued reward tokens", removeGas);
        assertLt(killGas, 1_000_000);
        assertLt(removeGas, 3_000_000);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
    }

    function test_Gas_LiveMaximumRewardTokenExit() external {
        _deployProtocol();
        _signalDefault(ALICE, 100 ether);
        _fillRewardRegistryAndStartStreams();
        vm.warp(block.timestamp + 1 days);

        vm.prank(ALICE);
        uint256 gasBefore = gasleft();
        signalGBX.removeSignal(address(targetStrategy), 100 ether);
        uint256 removeGas = gasBefore - gasleft();

        console.log("removeSignal gas, live Strategy with sixteen accrued reward tokens", removeGas);
        assertLt(removeGas, 3_000_000);
        assertEq(gbx.balanceOf(ALICE), 100 ether);
    }

    function test_Gas_ResonanceRevenueNotification() external {
        _deployProtocol();
        uint256 amount = resonance.REWARD_DURATION();
        usdg.mint(address(resonanceRouter), amount);

        uint256 gasBefore = gasleft();
        resonanceRouter.route();
        uint256 routeGas = gasBefore - gasleft();

        console.log("ResonanceRouter.route gas, first minimum revenue notification", routeGas);
        assertLt(routeGas, 500_000);
    }

    function test_Gas_SixteenAllocationBatchWithAccruedMaximumRewardRegistry() external {
        _deployProtocol();
        _addRewardTokens(15);
        _mintTestGBX(ALICE, 16 ether);

        SignalGBX.Allocation[] memory allocations = new SignalGBX.Allocation[](16);
        for (uint256 i; i < allocations.length; ++i) {
            allocations[i] = SignalGBX.Allocation({ strategy: address(targetStrategy), amount: 1 ether });
        }

        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), 16 ether);
        uint256 gasBefore = gasleft();
        signalGBX.addSignalMany(allocations);
        uint256 addManyGas = gasBefore - gasleft();
        vm.stopPrank();

        _startEveryTargetRewardStream();
        vm.warp(block.timestamp + 1 days);

        vm.prank(ALICE);
        gasBefore = gasleft();
        signalGBX.removeSignalMany(allocations);
        uint256 removeManyGas = gasBefore - gasleft();

        console.log("addSignalMany gas, sixteen duplicate allocations at sixteen reward tokens", addManyGas);
        console.log("removeSignalMany gas, sixteen allocations after reward accrual", removeManyGas);
        assertLt(addManyGas, 30_000_000);
        assertLt(removeManyGas, 30_000_000);
        assertEq(signalGBX.balanceOf(ALICE), 0);
    }

    function test_Gas_TwentySixDistinctMaximumRewardStrategyBatch() external {
        address[] memory strategies = _setupDistinctMaximumRewardStrategies(PRACTICAL_BATCH_COUNT);
        SignalGBX.Allocation[] memory practical = _allocations(strategies, PRACTICAL_BATCH_COUNT);

        vm.prank(ALICE);
        uint256 gasBefore = gasleft();
        signalGBX.removeSignalMany(practical);
        uint256 practicalBatchGas = gasBefore - gasleft();

        console.log(
            "removeSignalMany gas, 26 distinct live Strategies with sixteen accrued rewards each", practicalBatchGas
        );
        assertLt(practicalBatchGas, 31_000_000, "the measured practical batch needs margin below the target limit");
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), PRACTICAL_BATCH_COUNT);
    }

    function test_Gas_ThirtyTwoDistinctMaximumRewardStrategyBatchRollsBackThenScalarExits() external {
        address[] memory strategies = _setupDistinctMaximumRewardStrategies(OVERSIZED_BATCH_COUNT);
        SignalGBX.Allocation[] memory oversized = _allocations(strategies, OVERSIZED_BATCH_COUNT);
        vm.prank(ALICE);
        uint256 gasBefore = gasleft();
        (bool batchSucceeded, bytes memory returnData) =
            address(signalGBX).call{ gas: TARGET_GAS_LIMIT }(abi.encodeCall(SignalGBX.removeSignalMany, (oversized)));
        uint256 cappedAttemptGas = gasBefore - gasleft();

        console.log("failed removeSignalMany gas, 32 distinct maximum-reward Strategies", cappedAttemptGas);
        assertFalse(batchSucceeded, "the deliberately oversized batch must exceed the target gas limit");
        assertEq(returnData.length, 0, "an out-of-gas failure has no revert payload");
        assertEq(signalGBX.balanceOf(ALICE), OVERSIZED_BATCH_COUNT, "the failed batch must roll back every removal");
        for (uint256 i; i < strategies.length; ++i) {
            assertEq(Bribe(resonance.bribeFor(strategies[i])).signalWeightOf(ALICE), 1);
        }

        vm.startPrank(ALICE);
        for (uint256 i; i < strategies.length; ++i) {
            signalGBX.removeSignal(strategies[i], 1);
        }
        vm.stopPrank();

        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), OVERSIZED_BATCH_COUNT, "bounded scalar exits recover all principal");
    }

    function test_Gas_BribeScalarAndAllTokenClaimsAtMaximumRegistry() external {
        uint256 scalarClaimGas = _measureClaim(false);
        uint256 allTokenClaimGas = _measureClaim(true);

        console.log("Bribe.claimReward gas, sixteen-token registry", scalarClaimGas);
        console.log("Bribe.claimRewards gas, sixteen-token registry", allTokenClaimGas);
        assertLt(scalarClaimGas, 500_000);
        assertLt(allTokenClaimGas, 3_000_000);
    }

    function test_Gas_ResonanceTwoStrategyBatchAtMaximumRewardRegistries() external {
        address[] memory strategies = _setupDistinctMaximumRewardStrategies(2);

        vm.prank(ALICE);
        uint256 gasBefore = gasleft();
        resonance.claimBribeRewards(strategies);
        uint256 batchClaimGas = gasBefore - gasleft();

        console.log("Resonance.claimBribeRewards gas, two Strategies with sixteen reward tokens each", batchClaimGas);
        assertLt(batchClaimGas, 6_000_000);
        for (uint256 i; i < strategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(strategies[i]));
            address[] memory rewardTokens = bribe.rewardTokens();
            for (uint256 j; j < rewardTokens.length; ++j) {
                assertEq(bribe.earned(ALICE, rewardTokens[j]), 0);
            }
        }
    }

    function test_Gas_ThirtyTwoStrategyClaimBatchRollsBackThenSucceedsWhenSplit() external {
        address[] memory strategies = _setupDistinctMaximumRewardStrategies(OVERSIZED_BATCH_COUNT);

        vm.prank(ALICE);
        uint256 gasBefore = gasleft();
        (bool batchSucceeded, bytes memory returnData) = address(resonance).call{ gas: TARGET_GAS_LIMIT }(
            abi.encodeCall(Resonance.claimBribeRewards, (strategies))
        );
        uint256 cappedAttemptGas = gasBefore - gasleft();

        console.log("failed Resonance.claimBribeRewards gas, 32 maximum-reward Strategies", cappedAttemptGas);
        assertFalse(batchSucceeded, "the deliberately oversized claim batch must exceed the target gas limit");
        assertEq(returnData.length, 0, "an out-of-gas failure has no revert payload");
        for (uint256 i; i < strategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(strategies[i]));
            assertGt(bribe.earned(ALICE, bribe.rewardTokens()[0]), 0, "the failed batch must preserve every claim");
        }

        address[] memory firstHalf = new address[](OVERSIZED_BATCH_COUNT / 2);
        address[] memory secondHalf = new address[](OVERSIZED_BATCH_COUNT / 2);
        for (uint256 i; i < firstHalf.length; ++i) {
            firstHalf[i] = strategies[i];
            secondHalf[i] = strategies[i + firstHalf.length];
        }

        vm.startPrank(ALICE);
        resonance.claimBribeRewards(firstHalf);
        resonance.claimBribeRewards(secondHalf);
        vm.stopPrank();

        for (uint256 i; i < strategies.length; ++i) {
            Bribe bribe = Bribe(resonance.bribeFor(strategies[i]));
            address[] memory rewardTokens = bribe.rewardTokens();
            for (uint256 j; j < rewardTokens.length; ++j) {
                assertEq(bribe.earned(ALICE, rewardTokens[j]), 0);
            }
        }
    }

    function _measureFundRedemption(uint256 tokenCount) private returns (uint256 gasUsed) {
        _deployProtocol();
        _mintTestGBX(ALICE, 100 ether);
        address[] memory selected = new address[](tokenCount);
        for (uint256 i; i < tokenCount; ++i) {
            MockERC20 asset = new MockERC20("Gas Asset", "GAS", 18);
            asset.mint(address(fund), 100 ether);
            selected[i] = address(asset);
        }

        vm.startPrank(ALICE);
        gbx.approve(address(fund), 10 ether);
        uint256 gasBefore = gasleft();
        fund.redeem(10 ether, ALICE, selected);
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _measureClaim(bool allTokens) private returns (uint256 gasUsed) {
        _deployProtocol();
        _signalDefault(ALICE, 100 ether);
        _fillRewardRegistryAndStartStreams();
        vm.warp(block.timestamp + 1 days);

        vm.startPrank(ALICE);
        uint256 gasBefore = gasleft();
        if (allTokens) {
            targetBribe.claimRewards(ALICE);
        } else {
            targetBribe.claimReward(ALICE, targetBribe.rewardTokens()[0]);
        }
        gasUsed = gasBefore - gasleft();
        vm.stopPrank();
    }

    function _setupDistinctMaximumRewardStrategies(uint256 count) private returns (address[] memory strategies) {
        _deployProtocol();

        MockERC20[] memory additionalRewards = new MockERC20[](15);
        for (uint256 i; i < additionalRewards.length; ++i) {
            additionalRewards[i] = new MockERC20("Shared Gas Reward", "SGAS", 18);
        }

        strategies = new address[](count);
        strategies[0] = address(targetStrategy);
        for (uint256 i = 1; i < count; ++i) {
            (strategies[i],,) = resonance.addStrategy(IERC20(address(target)), defaultConfig());
        }

        for (uint256 i; i < strategies.length; ++i) {
            for (uint256 j; j < additionalRewards.length; ++j) {
                resonance.addBribeRewardToken(strategies[i], address(additionalRewards[j]));
            }
        }

        _mintTestGBX(ALICE, count);
        vm.startPrank(ALICE);
        gbx.approve(address(signalGBX), type(uint256).max);
        for (uint256 i; i < strategies.length; ++i) {
            signalGBX.addSignal(strategies[i], 1);
        }
        vm.stopPrank();

        for (uint256 i; i < strategies.length; ++i) {
            _startEveryRewardStream(Bribe(resonance.bribeFor(strategies[i])));
        }
        vm.warp(block.timestamp + 1 days);
    }

    function _allocations(address[] memory strategies, uint256 count)
        private
        pure
        returns (SignalGBX.Allocation[] memory allocations)
    {
        allocations = new SignalGBX.Allocation[](count);
        for (uint256 i; i < count; ++i) {
            allocations[i] = SignalGBX.Allocation({ strategy: strategies[i], amount: 1 });
        }
    }

    function _fillRewardRegistryAndStartStreams() private {
        _addRewardTokens(15);
        _startEveryTargetRewardStream();
    }

    function _addRewardTokens(uint256 count) private {
        for (uint256 i; i < count; ++i) {
            MockERC20 extra = new MockERC20("Gas Reward", "GASR", 18);
            resonance.addBribeRewardToken(address(targetStrategy), address(extra));
        }
        assertEq(targetBribe.rewardTokens().length, targetBribe.MAX_REWARD_TOKENS());
    }

    function _startEveryTargetRewardStream() private {
        _startEveryRewardStream(targetBribe);
    }

    function _startEveryRewardStream(Bribe bribe) private {
        address[] memory rewardTokens = bribe.rewardTokens();
        for (uint256 i; i < rewardTokens.length; ++i) {
            MockERC20 reward = MockERC20(rewardTokens[i]);
            reward.mint(address(this), REWARD_AMOUNT);
            reward.approve(address(bribe), REWARD_AMOUNT);
            bribe.notifyReward(address(reward), REWARD_AMOUNT);
        }
    }
}
