// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Bribe } from "../../../src/core/Bribe.sol";
import { Mine } from "../../../src/core/Mine.sol";
import { Strategy } from "../../../src/core/Strategy.sol";
import { ProtocolFixture } from "../utils/ProtocolFixture.sol";
import { MockERC20 } from "../utils/Tokens.sol";

/// @title ExitabilityReferenceModel
/// @notice Stateless arithmetic oracle deliberately built without OpenZeppelin Math or production contract calls.
contract ExitabilityReferenceModel {
    function decayingPrice(uint256 initial, uint256 elapsed, uint256 duration) external pure returns (uint256) {
        if (elapsed >= duration) return 0;
        uint256 numerator = initial * (duration - elapsed);
        uint256 quotient = numerator / duration;
        return quotient + (numerator % duration == 0 ? 0 : 1);
    }

    function scheduledRate(uint256 fresh, uint256 remaining, uint256 duration) external pure returns (uint256) {
        return (fresh + remaining) / duration;
    }

    function scaledIndexDelta(uint256 elapsed, uint256 rate, uint256 precision, uint256 weight)
        external
        pure
        returns (uint256)
    {
        uint256 emitted = elapsed * rate;
        uint256 whole = emitted / weight;
        uint256 remainder = emitted % weight;
        return whole * precision + (remainder * precision) / weight;
    }

    function entitlement(uint256 weight, uint256 indexDelta, uint256 precision) external pure returns (uint256) {
        uint256 whole = indexDelta / precision;
        uint256 remainder = indexDelta % precision;
        return weight * whole + (weight * remainder) / precision;
    }

    function bpsSplit(uint256 payment, uint256 bps, uint256 denominator)
        external
        pure
        returns (uint256 bribeAmount, uint256 fundAmount)
    {
        bribeAmount = (payment / denominator) * bps + ((payment % denominator) * bps) / denominator;
        fundAmount = payment - bribeAmount;
    }

    function nextStrategyPrice(uint256 paid, uint256 multiplier, uint256 scale, uint256 minimum, uint256 maximum)
        external
        pure
        returns (uint256)
    {
        uint256 next = (paid / scale) * multiplier + ((paid % scale) * multiplier) / scale;
        if (next > maximum) return maximum;
        if (next < minimum) return minimum;
        return next;
    }

    function proRata(uint256 balance, uint256 burned, uint256 supply) external pure returns (uint256) {
        return (balance / supply) * burned + ((balance % supply) * burned) / supply;
    }

    function admitLifetimeRevenue(uint256 alreadyNotified, uint256 fresh, uint256 precision)
        external
        pure
        returns (bool accepted, uint256 nextNotified)
    {
        uint256 maximum = type(uint256).max / precision;
        if (fresh > maximum - alreadyNotified) return (false, alreadyNotified);
        return (true, alreadyNotified + fresh);
    }
}

/// @title DifferentialModelsTest
/// @notice Differential fuzzing against an independent quotient/remainder reference implementation.
contract DifferentialModelsTest is ProtocolFixture {
    struct BribeCase {
        uint256 weight;
        uint256 duration;
        uint256 first;
        uint256 firstElapsed;
        uint256 firstRate;
        uint256 remaining;
        uint256 topUp;
        uint256 secondElapsed;
        uint256 secondRate;
        uint256 expectedIndex;
    }

    ExitabilityReferenceModel private model;

    function setUp() external {
        _deployProtocol();
        _mintTestGBX(ALICE, 1_000 ether);
        _mintTestGBX(BOB, 1_000 ether);
        model = new ExitabilityReferenceModel();
    }

    function testFuzz_MinePriceAndTenureEmissionMatchIndependentModel(uint32 priceElapsedSeed, uint40 tenureSeed)
        external
    {
        uint256 priceElapsed = bound(uint256(priceElapsedSeed), 0, mine.PRICE_DECAY_PERIOD() + 1 days);
        vm.warp(DEPLOYED_AT + priceElapsed);

        Mine.Slot memory slotState = mine.slot(0);
        uint256 expectedPrice = model.decayingPrice(slotState.initialPrice, priceElapsed, mine.PRICE_DECAY_PERIOD());
        assertEq(mine.currentPrice(0), expectedPrice);

        usdg.mint(ALICE, expectedPrice);
        vm.startPrank(ALICE);
        usdg.approve(address(mine), expectedPrice);
        mine.mine(ALICE, 0, slotState.epochId, block.timestamp, expectedPrice, "model");
        vm.stopPrank();

        slotState = mine.slot(0);
        uint256 tenure = bound(uint256(tenureSeed), 0, 100 * 365 days);
        vm.warp(block.timestamp + tenure);
        uint256 expectedEmission = tenure * slotState.tps;
        assertEq(mine.pendingSlotEmission(0), expectedEmission);
        assertEq(mine.pendingEmission(), expectedEmission);

        uint256 aliceBefore = gbx.balanceOf(ALICE);
        slotState = mine.slot(0);
        uint256 replacementPrice = mine.currentPrice(0);
        usdg.mint(BOB, replacementPrice);
        vm.startPrank(BOB);
        usdg.approve(address(mine), replacementPrice);
        mine.mine(BOB, 0, slotState.epochId, block.timestamp, replacementPrice, "settle model");
        vm.stopPrank();
        assertEq(gbx.balanceOf(ALICE) - aliceBefore, expectedEmission);
    }

    function testFuzz_ResonanceScheduleIndexAndStrategyAccrualMatchIndependentModel(
        uint96 freshSeed,
        uint32 elapsedSeed,
        uint96 aliceWeightSeed,
        uint96 bobWeightSeed
    ) external {
        uint256 aliceWeight = bound(uint256(aliceWeightSeed), 1, 1e24);
        uint256 bobWeight = bound(uint256(bobWeightSeed), 1, 1e24);
        _signalDefault(ALICE, aliceWeight);
        _signalDefault(BOB, bobWeight);

        uint256 duration = resonance.REWARD_DURATION();
        uint256 fresh = bound(uint256(freshSeed), duration, 1e24);
        uint256 elapsed = bound(uint256(elapsedSeed), 0, duration);
        _routeRevenue(fresh);
        vm.warp(block.timestamp + elapsed);

        uint256 rate = model.scheduledRate(fresh, 0, duration);
        uint256 totalWeight = aliceWeight + bobWeight;
        uint256 expectedIndex = model.scaledIndexDelta(elapsed, rate, resonance.REWARD_PRECISION(), totalWeight);
        uint256 expectedStrategyRevenue = model.entitlement(totalWeight, expectedIndex, resonance.REWARD_PRECISION());

        assertEq(resonance.revenuePerSignal(), expectedIndex);
        assertEq(resonance.earnedRevenue(address(targetStrategy)), expectedStrategyRevenue);
    }

    function testFuzz_BribeTopUpScheduleAndIndexMatchIndependentModel(
        uint96 firstSeed,
        uint32 firstElapsedSeed,
        uint96 extraSeed,
        uint32 secondElapsedSeed,
        uint96 weightSeed
    ) external {
        Bribe bribe = new Bribe(address(this));
        MockERC20 reward = new MockERC20("Model Reward", "MODEL", 18);
        bribe.addRewardToken(address(reward));
        BribeCase memory c;
        c.weight = bound(uint256(weightSeed), 1, 1e24);
        bribe.addSignalWeight(ALICE, c.weight);

        c.duration = bribe.REWARD_DURATION();
        c.first = bound(uint256(firstSeed), c.duration, 1e24);
        c.firstElapsed = bound(uint256(firstElapsedSeed), 0, c.duration);
        reward.mint(address(this), type(uint128).max);
        reward.approve(address(bribe), type(uint256).max);
        bribe.notifyReward(address(reward), c.first);
        vm.warp(block.timestamp + c.firstElapsed);

        c.firstRate = model.scheduledRate(c.first, 0, c.duration);
        c.remaining = (c.duration - c.firstElapsed) * c.firstRate;
        uint256 extra = bound(uint256(extraSeed), 0, 1e24);
        c.topUp = c.remaining > c.duration ? c.remaining + extra : c.duration + extra;
        bribe.notifyReward(address(reward), c.topUp);

        c.secondElapsed = bound(uint256(secondElapsedSeed), 0, c.duration);
        vm.warp(block.timestamp + c.secondElapsed);
        c.secondRate = model.scheduledRate(c.topUp, c.remaining, c.duration);
        c.expectedIndex = model.scaledIndexDelta(c.firstElapsed, c.firstRate, bribe.REWARD_PRECISION(), c.weight);
        c.expectedIndex += model.scaledIndexDelta(c.secondElapsed, c.secondRate, bribe.REWARD_PRECISION(), c.weight);

        assertEq(bribe.rewardPerSignal(address(reward)), c.expectedIndex);
        assertEq(
            bribe.earned(ALICE, address(reward)), model.entitlement(c.weight, c.expectedIndex, bribe.REWARD_PRECISION())
        );
    }

    function testFuzz_StrategyPriceSplitAndNextEpochMatchIndependentModel(uint32 elapsedSeed) external {
        uint256 elapsed = bound(uint256(elapsedSeed), 0, targetStrategy.epochDuration());
        vm.warp(block.timestamp + elapsed);
        uint256 expectedPrice =
            model.decayingPrice(targetStrategy.initialPrice(), elapsed, targetStrategy.epochDuration());
        assertEq(targetStrategy.currentPrice(), expectedPrice);

        usdg.mint(address(targetStrategy), 10_000_000);
        target.mint(ALICE, expectedPrice);
        vm.startPrank(ALICE);
        target.approve(address(targetStrategy), expectedPrice);
        targetStrategy.buy(BOB, targetStrategy.epochId(), block.timestamp, expectedPrice);
        vm.stopPrank();

        (uint256 expectedBribe, uint256 expectedFund) =
            model.bpsSplit(expectedPrice, resonance.bribeBps(), targetStrategy.BPS());
        assertEq(target.balanceOf(address(targetRouter)), expectedBribe);
        assertEq(target.balanceOf(address(fund)), expectedFund);
        assertEq(usdg.balanceOf(BOB), 10_000_000);

        uint256 expectedNext = model.nextStrategyPrice(
            expectedPrice,
            targetStrategy.priceMultiplier(),
            targetStrategy.PRICE_SCALE(),
            targetStrategy.minimumPrice(),
            targetStrategy.ABSOLUTE_MAXIMUM_PRICE()
        );
        assertEq(targetStrategy.initialPrice(), expectedNext);
    }

    function testFuzz_FundRedemptionMatchesIndependentProRataModel(uint128 treasurySeed, uint96 burnSeed) external {
        uint256 treasury = bound(uint256(treasurySeed), 1, 1e30);
        uint256 burnAmount = bound(uint256(burnSeed), 1, 1_000 ether);
        target.mint(address(fund), treasury);
        uint256 supply = mine.effectiveTotalSupply();
        uint256 expected = model.proRata(treasury, burnAmount, supply);

        vm.startPrank(ALICE);
        gbx.approve(address(fund), burnAmount);
        fund.redeem(burnAmount, ALICE, _addresses(address(target)));
        vm.stopPrank();

        assertEq(target.balanceOf(ALICE), expected);
        assertEq(target.balanceOf(address(fund)), treasury - expected);
        assertEq(gbx.totalSupply(), supply - burnAmount);
    }

    function testFuzz_ResonanceLifetimeAdmissionMatchesIndependentModel(uint256 firstSeed, uint256 secondSeed)
        external
    {
        uint256 duration = resonance.REWARD_DURATION();
        uint256 maximum = resonance.MAX_LIFETIME_REVENUE_AMOUNT();
        uint256 first = bound(firstSeed, duration, maximum);
        uint256 second = bound(secondSeed, duration, maximum);

        _routeRevenue(first);
        vm.warp(block.timestamp + duration);
        usdg.mint(address(resonance), 1);
        assertEq(resonance.lifetimeRevenueNotified(), first, "a direct donation must not consume admission capacity");

        (bool expectedAcceptance, uint256 expectedLifetime) =
            model.admitLifetimeRevenue(first, second, resonance.REWARD_PRECISION());
        usdg.mint(address(resonanceRouter), second);
        vm.prank(KEEPER);
        (bool accepted,) = address(resonanceRouter).call(abi.encodeWithSignature("route()"));

        assertEq(accepted, expectedAcceptance);
        assertEq(resonance.lifetimeRevenueNotified(), expectedLifetime);
        if (!accepted) assertEq(usdg.balanceOf(address(resonanceRouter)), second);
    }
}
