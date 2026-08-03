// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { MiningMathHarness } from "../mocks/MiningTestMocks.sol";

contract MiningMathFuzzTest is Test {
    MiningMathHarness private _math;

    function setUp() external {
        _math = new MiningMathHarness();
    }

    function testFuzz_SponsorBackingIsTheSmallestSafeCeiling(uint128 communityUSDG) external view {
        uint256 required = _math.requiredSponsorUSDG(communityUSDG);
        assertGe(required * 4, communityUSDG);
        if (communityUSDG != 0) assertLt((required - 1) * 4, communityUSDG);
    }

    function testFuzz_DemandScaledEmissionNeverExceedsScheduleOrAffordability(
        uint128 rawUSDG,
        uint96 rawReference,
        uint128 rawSchedule,
        uint8 rawDecimals
    ) external view {
        uint256 usdG = bound(rawUSDG, 1, type(uint128).max);
        uint256 referencePrice = bound(rawReference, 2, type(uint96).max);
        uint256 schedule = bound(rawSchedule, 1, type(uint128).max);
        uint8 decimals = uint8(bound(rawDecimals, 0, 18));
        uint256 minimumPrice = _math.minimumMiningPrice(referencePrice);
        uint256 affordable = _math.affordableEmission(usdG, decimals, minimumPrice);
        uint256 actual = Math.min(schedule, affordable);

        assertLe(actual, schedule);
        assertLe(actual, affordable);
    }

    function testFuzz_ReferenceUpdateStaysWithinProtocolBounds(uint96 rawPrevious, uint128 rawClearing) external view {
        uint256 previous = bound(rawPrevious, 2, type(uint96).max);
        uint256 clearing = bound(rawClearing, 1, type(uint128).max);
        uint256 nextReference = _math.nextReferencePrice(previous, clearing);

        assertGe(nextReference, _math.minimumMiningPrice(previous));
        assertLe(nextReference, Math.mulDiv(previous, 15_000, 10_000));
    }

    function test_MinimumMiningPriceNeverReachesZeroAfterLongEmptyTail() external view {
        uint256 referencePrice = 1 ether;
        for (uint256 epoch; epoch < 2_000; ++epoch) {
            referencePrice = _math.minimumMiningPrice(referencePrice);
        }

        assertEq(referencePrice, 1);
        assertGt(_math.affordableEmission(1, 18, referencePrice), 0);
    }
}
