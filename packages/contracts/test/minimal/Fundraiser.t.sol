// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { Fundraiser } from "../../src/core/Fundraiser.sol";
import { GBX } from "../../src/core/GBX.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { FeeOnTransferToken } from "./utils/Tokens.sol";

/// @title FundraiserTest
/// @notice Exhaustive coverage of contribution routing, sequential emission settlement, and pro-rata claims.
contract FundraiserTest is ProtocolFixture {
    uint256 private constant DAY = 1 days;

    event Claimed(address indexed account, uint256 indexed epoch, uint256 amount);
    event Contributed(address indexed payer, address indexed beneficiary, uint256 indexed epoch, uint256 amount);
    event EpochSettled(
        uint256 indexed epoch, uint256 scheduledEmission, uint256 contributorEmission, uint256 nextScheduledEmission
    );

    function setUp() external {
        _deployProtocol();
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTION
    //////////////////////////////////////////////////////////////*/

    function test_ConstructorSeedsTheScheduleAtDeploymentTime() external view {
        assertEq(fundraiser.startedAt(), DEPLOYED_AT);
        assertEq(fundraiser.currentEpoch(), 0);
        assertEq(fundraiser.nextEpochToSettle(), 0);
        assertEq(fundraiser.currentScheduledEmission(), fundraiser.INITIAL_DAILY_EMISSION());
        assertEq(fundraiser.INITIAL_DAILY_EMISSION(), 465_152_749_681_042_811_702_004);
        assertEq(fundraiser.DAILY_DECAY(), 999_525_354_337_060_160);
        assertEq(fundraiser.DISTRIBUTION_EPOCHS(), 99_884);
        assertEq(fundraiser.DISTRIBUTION_ALLOCATION(), 980_000_000 ether);
    }

    function test_ConstructorRejectsZeroAndEOADependencies() external {
        vm.expectRevert(Fundraiser.ZeroAddress.selector);
        new Fundraiser(GBX(address(0)), IERC20(address(usdg)), address(resonanceRouter));

        vm.expectRevert(Fundraiser.ZeroAddress.selector);
        new Fundraiser(gbx, IERC20(address(0)), address(resonanceRouter));

        vm.expectRevert(Fundraiser.ZeroAddress.selector);
        new Fundraiser(gbx, IERC20(address(usdg)), address(0));

        vm.expectRevert(Fundraiser.ZeroAddress.selector);
        new Fundraiser(GBX(ALICE), IERC20(address(usdg)), address(resonanceRouter));

        vm.expectRevert(Fundraiser.ZeroAddress.selector);
        new Fundraiser(gbx, IERC20(ALICE), address(resonanceRouter));

        vm.expectRevert(Fundraiser.ZeroAddress.selector);
        new Fundraiser(gbx, IERC20(address(usdg)), ALICE);
    }

    function test_TheFundraiserAllocationMatchesTheGBXMintCeiling() external view {
        assertEq(fundraiser.DISTRIBUTION_ALLOCATION(), gbx.FUNDRAISER_ALLOCATION());
        assertEq(gbx.minter(), address(fundraiser));
        assertTrue(gbx.minterLocked());
    }

    /*//////////////////////////////////////////////////////////////
                             CONTRIBUTION
    //////////////////////////////////////////////////////////////*/

    function test_ContributeRejectsAZeroBeneficiary() external {
        usdg.mint(ALICE, 1_000_000);
        vm.prank(ALICE);
        vm.expectRevert(Fundraiser.ZeroAddress.selector);
        fundraiser.contribute(address(0), 1_000_000);
    }

    function test_ContributeEnforcesTheMinimumAtTheExactBoundary() external {
        uint256 minimum = fundraiser.MIN_CONTRIBUTION();
        usdg.mint(ALICE, minimum);

        vm.startPrank(ALICE);
        usdg.approve(address(fundraiser), minimum);
        vm.expectRevert(abi.encodeWithSelector(Fundraiser.BelowMinimumContribution.selector, minimum - 1));
        fundraiser.contribute(ALICE, minimum - 1);

        fundraiser.contribute(ALICE, minimum);
        vm.stopPrank();

        assertEq(fundraiser.accountContributions(0, ALICE), minimum);
    }

    function test_ContributeRoutesEveryUnitThroughResonanceRouter() external {
        _stake(ALICE, 100 ether);
        _signalOne(ALICE, address(targetStrategy));

        usdg.mint(BOB, 100_000_000);
        vm.startPrank(BOB);
        usdg.approve(address(fundraiser), 100_000_000);
        vm.expectEmit(true, true, true, true);
        emit Contributed(BOB, BOB, 0, 100_000_000);
        fundraiser.contribute(BOB, 100_000_000);
        vm.stopPrank();

        assertEq(usdg.balanceOf(address(fundraiser)), 0, "Fundraiser must never custody revenue");
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0, "the router must never retain revenue");
        assertEq(usdg.balanceOf(address(resonance)), 100_000_000);
        assertEq(usdg.balanceOf(address(fund)), 0);
    }

    function test_ContributeCanCreditADifferentBeneficiary() external {
        usdg.mint(ALICE, 100_000_000);
        vm.startPrank(ALICE);
        usdg.approve(address(fundraiser), 100_000_000);
        fundraiser.contribute(CAROL, 100_000_000);
        vm.stopPrank();

        assertEq(fundraiser.accountContributions(0, CAROL), 100_000_000);
        assertEq(fundraiser.accountContributions(0, ALICE), 0);
    }

    function test_ContributionsAccumulateWithinAnEpochAndSeparateAcrossEpochs() external {
        _contribute(ALICE, 60_000_000);
        _contribute(ALICE, 40_000_000);
        assertEq(fundraiser.epochContributions(0), 100_000_000);
        assertEq(fundraiser.accountContributions(0, ALICE), 100_000_000);

        vm.warp(DEPLOYED_AT + DAY);
        _contribute(BOB, 10_000_000);
        assertEq(fundraiser.currentEpoch(), 1);
        assertEq(fundraiser.epochContributions(1), 10_000_000);
        assertEq(fundraiser.epochContributions(0), 100_000_000);
    }

    function test_ContributeRejectsAFeeOnTransferRevenueToken() external {
        FeeOnTransferToken feeUsdg = new FeeOnTransferToken(6);
        Fundraiser feeFundraiser = new Fundraiser(gbx, IERC20(address(feeUsdg)), address(resonanceRouter));

        feeUsdg.mint(ALICE, 100_000_000);
        feeUsdg.setFeeBps(100);

        vm.startPrank(ALICE);
        feeUsdg.approve(address(feeFundraiser), 100_000_000);
        vm.expectRevert(abi.encodeWithSelector(Fundraiser.InexactTransfer.selector, 100_000_000, 99_000_000));
        feeFundraiser.contribute(ALICE, 100_000_000);
        vm.stopPrank();
    }

    function test_ContributeIsClosedOnceTheDistributionCompletes() external {
        vm.warp(DEPLOYED_AT + fundraiser.DISTRIBUTION_EPOCHS() * DAY);
        usdg.mint(ALICE, 100_000_000);

        vm.startPrank(ALICE);
        usdg.approve(address(fundraiser), 100_000_000);
        vm.expectRevert(Fundraiser.DistributionComplete.selector);
        fundraiser.contribute(ALICE, 100_000_000);
        vm.stopPrank();
    }

    function test_TheFinalDistributionEpochStillAcceptsContributions() external {
        vm.warp(DEPLOYED_AT + (fundraiser.DISTRIBUTION_EPOCHS() - 1) * DAY);
        _contribute(ALICE, 100_000_000);
        assertEq(fundraiser.epochContributions(fundraiser.DISTRIBUTION_EPOCHS() - 1), 100_000_000);
    }

    /*//////////////////////////////////////////////////////////////
                              SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    function test_SettleEpochsRejectsAZeroLimit() external {
        vm.expectRevert(Fundraiser.InvalidSettlementLimit.selector);
        fundraiser.settleEpochs(0);
    }

    function test_SettleEpochsIgnoresEpochsThatHaveNotEnded() external {
        _contribute(ALICE, 100_000_000);
        assertEq(fundraiser.settleEpochs(10), 0);
        assertEq(fundraiser.nextEpochToSettle(), 0);
        assertFalse(fundraiser.epochSettled(0));
    }

    function test_SettleEpochsIsPermissionlessAndEmitsTheFullSchedule() external {
        _contribute(ALICE, 100_000_000);
        vm.warp(DEPLOYED_AT + DAY);

        uint256 initial = fundraiser.INITIAL_DAILY_EMISSION();
        uint256 next = Math.mulDiv(initial, fundraiser.DAILY_DECAY(), 1e18);

        vm.prank(KEEPER);
        vm.expectEmit(true, false, false, true);
        emit EpochSettled(0, initial, initial, next);
        assertEq(fundraiser.settleEpochs(1), 1);

        assertTrue(fundraiser.epochSettled(0));
        assertEq(fundraiser.epochEmission(0), initial);
        assertEq(fundraiser.currentScheduledEmission(), next);
    }

    function test_AnEmptyEpochForfeitsItsEmissionWithoutCarry() external {
        _contribute(ALICE, 100_000_000);
        vm.warp(DEPLOYED_AT + 3 * DAY);

        uint256 initial = fundraiser.INITIAL_DAILY_EMISSION();
        fundraiser.settleEpochs(3);

        assertEq(fundraiser.epochEmission(0), initial);
        assertEq(fundraiser.epochEmission(1), 0, "an empty epoch mints nothing");
        assertEq(fundraiser.epochEmission(2), 0);

        // The schedule still advanced three steps: the forfeited emission is not carried forward.
        uint256 expected = initial;
        for (uint256 i; i < 3; ++i) {
            expected = Math.mulDiv(expected, fundraiser.DAILY_DECAY(), 1e18);
        }
        assertEq(fundraiser.currentScheduledEmission(), expected);
    }

    function test_BatchedSettlementProducesTheSameResultAsOneLargeBatch() external {
        vm.warp(DEPLOYED_AT + 40 * DAY);

        fundraiser.settleEpochs(7);
        fundraiser.settleEpochs(13);
        fundraiser.settleEpochs(20);
        uint256 batched = fundraiser.currentScheduledEmission();
        assertEq(fundraiser.nextEpochToSettle(), 40);

        uint256 expected = fundraiser.INITIAL_DAILY_EMISSION();
        for (uint256 i; i < 40; ++i) {
            expected = Math.mulDiv(expected, fundraiser.DAILY_DECAY(), 1e18);
        }
        assertEq(batched, expected, "sequential floor rounding must survive batching");
    }

    /// @notice Settlement halts permanently at the final scheduled epoch.
    /// @dev The schedule position is written directly so the terminal boundary can be reached without replaying
    ///      all 99,884 sequential steps, which costs far more than one transaction can spend.
    function test_SettlementHaltsAtTheFinalScheduledEpoch() external {
        uint256 finalEpoch = fundraiser.DISTRIBUTION_EPOCHS();
        vm.warp(DEPLOYED_AT + (finalEpoch + 500) * DAY);
        vm.store(address(fundraiser), bytes32(uint256(0)), bytes32(finalEpoch - 2));

        assertEq(fundraiser.settleEpochs(1_000), 2, "only the two remaining epochs settle");
        assertEq(fundraiser.nextEpochToSettle(), finalEpoch);
        assertEq(fundraiser.settleEpochs(1), 0, "no epoch beyond the schedule can ever be settled");
        assertTrue(fundraiser.epochSettled(finalEpoch - 1));
        assertFalse(fundraiser.epochSettled(finalEpoch));
    }

    /// @notice A long outage stays recoverable: catching up a full year of epochs fits in one transaction.
    /// @dev Records the measured per-epoch settlement cost so a regression in the loop is visible.
    function test_CatchUpAfterAYearOfInactivityIsGasBounded() external {
        vm.warp(DEPLOYED_AT + 365 * DAY);

        uint256 gasBefore = gasleft();
        uint256 settled = fundraiser.settleEpochs(365);
        uint256 gasUsed = gasBefore - gasleft();

        assertEq(settled, 365);
        assertEq(fundraiser.nextEpochToSettle(), 365);
        assertLt(gasUsed, 30_000_000, "a year of catch-up must fit inside one mainnet block");
        assertLt(gasUsed / 365, 30_000, "and cost well under one cold storage write per epoch on average");
    }

    /// @notice Very large batches are the caller's own gas problem, and the bound is enforceable.
    function test_TheSettlementLimitActuallyBoundsTheWork() external {
        vm.warp(DEPLOYED_AT + 1_000 * DAY);

        assertEq(fundraiser.settleEpochs(1), 1);
        assertEq(fundraiser.settleEpochs(9), 9);
        assertEq(fundraiser.settleEpochs(type(uint256).max), 990);
        assertEq(fundraiser.nextEpochToSettle(), 1_000);
    }

    /*//////////////////////////////////////////////////////////////
                          EMISSION SCHEDULE
    //////////////////////////////////////////////////////////////*/

    /// @notice The complete schedule can never demand more GBX than the mint ceiling reserves for it.
    /// @dev Replays all 99,884 sequential floor steps and compares the total to the Fundraiser allocation.
    function test_TheCompleteEmissionScheduleFitsInsideTheMintCeiling() external view {
        uint256 emission = fundraiser.INITIAL_DAILY_EMISSION();
        uint256 decay = fundraiser.DAILY_DECAY();
        uint256 epochs = fundraiser.DISTRIBUTION_EPOCHS();
        uint256 allocation = fundraiser.DISTRIBUTION_ALLOCATION();

        uint256 total;
        for (uint256 i; i < epochs; ++i) {
            total += emission;
            emission = Math.mulDiv(emission, decay, 1e18);
        }

        assertLe(total, allocation, "the schedule must fit inside the 980 million allocation");
        assertLe(total, gbx.remainingMintableSupply(), "and inside the remaining lifetime capacity");
        assertGt(total, (allocation * 9_990) / 10_000, "while still using at least 99.9 percent of it");
    }

    /// @notice The decay constant reproduces a four-year, 1,460-epoch half-life.
    function test_TheDecayConstantHalvesEmissionsEveryFourYears() external view {
        uint256 emission = fundraiser.INITIAL_DAILY_EMISSION();
        uint256 initial = emission;
        uint256 decay = fundraiser.DAILY_DECAY();

        for (uint256 i; i < 1_460; ++i) {
            emission = Math.mulDiv(emission, decay, 1e18);
        }

        assertApproxEqRel(emission, initial / 2, 1e15, "within 0.1 percent of an exact halving");
    }

    function test_CurrentEpochAdvancesExactlyOncePerDay() external {
        assertEq(fundraiser.currentEpoch(), 0);

        vm.warp(DEPLOYED_AT + DAY - 1);
        assertEq(fundraiser.currentEpoch(), 0);

        vm.warp(DEPLOYED_AT + DAY);
        assertEq(fundraiser.currentEpoch(), 1);

        vm.warp(DEPLOYED_AT + 365 * DAY);
        assertEq(fundraiser.currentEpoch(), 365);
    }

    /*//////////////////////////////////////////////////////////////
                                CLAIMS
    //////////////////////////////////////////////////////////////*/

    function test_ClaimRejectsDegenerateAndPrematureRequests() external {
        _contribute(ALICE, 100_000_000);

        vm.expectRevert(Fundraiser.ZeroAddress.selector);
        fundraiser.claim(address(0), 0);

        vm.expectRevert(abi.encodeWithSelector(Fundraiser.EpochNotEnded.selector, 0));
        fundraiser.claim(ALICE, 0);

        vm.warp(DEPLOYED_AT + DAY);
        vm.expectRevert(abi.encodeWithSelector(Fundraiser.EpochNotSettled.selector, 0));
        fundraiser.claim(ALICE, 0);

        fundraiser.settleEpochs(1);
        vm.expectRevert(abi.encodeWithSelector(Fundraiser.NoContribution.selector, 0, BOB));
        fundraiser.claim(BOB, 0);
    }

    function test_ClaimCannotBeRepeated() external {
        _contribute(ALICE, 100_000_000);
        vm.warp(DEPLOYED_AT + DAY);
        fundraiser.settleEpochs(1);

        fundraiser.claim(ALICE, 0);
        vm.expectRevert(abi.encodeWithSelector(Fundraiser.AlreadyClaimed.selector, 0, ALICE));
        fundraiser.claim(ALICE, 0);
    }

    function test_ClaimMintsProRataToTheContributorNotTheCaller() external {
        _contribute(ALICE, 60_000_000);
        _contribute(BOB, 40_000_000);
        vm.warp(DEPLOYED_AT + DAY);
        fundraiser.settleEpochs(1);

        uint256 emission = fundraiser.epochEmission(0);

        vm.prank(KEEPER);
        vm.expectEmit(true, true, false, true);
        emit Claimed(ALICE, 0, Math.mulDiv(60_000_000, emission, 100_000_000));
        uint256 aliceReward = fundraiser.claim(ALICE, 0);
        uint256 bobReward = fundraiser.claim(BOB, 0);

        assertEq(aliceReward, (emission * 60) / 100);
        assertEq(bobReward, (emission * 40) / 100);
        assertEq(gbx.balanceOf(ALICE), aliceReward);
        assertEq(gbx.balanceOf(BOB), bobReward);
        assertEq(gbx.balanceOf(KEEPER), 0);
        assertLe(aliceReward + bobReward, emission, "claims can never exceed the epoch emission");
    }

    function test_PendingRewardAgreesWithTheClaimAndZeroesAfterwards() external {
        _contribute(ALICE, 100_000_000);
        assertEq(fundraiser.pendingReward(0, ALICE), 0, "unsettled epochs report nothing");

        vm.warp(DEPLOYED_AT + DAY);
        fundraiser.settleEpochs(1);

        uint256 pending = fundraiser.pendingReward(0, ALICE);
        assertEq(fundraiser.claim(ALICE, 0), pending);
        assertEq(fundraiser.pendingReward(0, ALICE), 0);
        assertEq(fundraiser.pendingReward(0, BOB), 0);
    }

    function test_AClaimSurvivesAnArbitrarilyLongDelay() external {
        _contribute(ALICE, 100_000_000);
        vm.warp(DEPLOYED_AT + DAY);
        fundraiser.settleEpochs(1);

        vm.warp(DEPLOYED_AT + 5_000 * DAY);
        assertGt(fundraiser.claim(ALICE, 0), 0);
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// @notice Claims for an epoch never mint more than that epoch's settled emission.
    function testFuzz_EpochClaimsNeverExceedTheEpochEmission(uint256 first, uint256 second, uint256 third) external {
        uint256 aliceAmount = bound(first, 10_000, 1e14);
        uint256 bobAmount = bound(second, 10_000, 1e14);
        uint256 carolAmount = bound(third, 10_000, 1e14);

        _contribute(ALICE, aliceAmount);
        _contribute(BOB, bobAmount);
        _contribute(CAROL, carolAmount);

        vm.warp(DEPLOYED_AT + DAY);
        fundraiser.settleEpochs(1);

        uint256 emission = fundraiser.epochEmission(0);
        uint256 minted = fundraiser.claim(ALICE, 0) + fundraiser.claim(BOB, 0) + fundraiser.claim(CAROL, 0);

        assertLe(minted, emission, "the sum of pro-rata floors can never exceed the whole");
        assertGe(minted + 3, emission, "and loses at most one wei per claimant to rounding");
    }

    /// @notice Contribution accounting is exact regardless of how the payments are split up.
    function testFuzz_ContributionAccountingIsExact(uint256[5] calldata amounts) external {
        uint256 expected;
        for (uint256 i; i < amounts.length; ++i) {
            uint256 amount = bound(amounts[i], 10_000, 1e12);
            _contribute(ALICE, amount);
            expected += amount;
        }

        assertEq(fundraiser.epochContributions(0), expected);
        assertEq(fundraiser.accountContributions(0, ALICE), expected);
        assertEq(usdg.balanceOf(address(fundraiser)), 0);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 0);
    }

    /// @notice Settling in arbitrary batch sizes always reaches the identical schedule position.
    function testFuzz_BatchedSettlementIsPathIndependent(uint256 batchSize, uint256 epochCount) external {
        uint256 epochs = bound(epochCount, 1, 200);
        uint256 batch = bound(batchSize, 1, 50);
        vm.warp(DEPLOYED_AT + epochs * DAY);

        while (fundraiser.nextEpochToSettle() < epochs) {
            fundraiser.settleEpochs(batch);
        }

        uint256 expected = fundraiser.INITIAL_DAILY_EMISSION();
        for (uint256 i; i < epochs; ++i) {
            expected = Math.mulDiv(expected, fundraiser.DAILY_DECAY(), 1e18);
        }

        assertEq(fundraiser.nextEpochToSettle(), epochs);
        assertEq(fundraiser.currentScheduledEmission(), expected);
    }

    /// @notice The scheduled emission is strictly non-increasing at every step.
    function testFuzz_TheScheduleNeverIncreases(uint256 epochCount) external {
        uint256 epochs = bound(epochCount, 2, 500);
        vm.warp(DEPLOYED_AT + epochs * DAY);

        uint256 previous = fundraiser.currentScheduledEmission();
        for (uint256 i; i < epochs; ++i) {
            fundraiser.settleEpochs(1);
            uint256 current = fundraiser.currentScheduledEmission();
            assertLe(current, previous);
            previous = current;
        }
    }
}
