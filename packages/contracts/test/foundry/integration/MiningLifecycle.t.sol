// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { IMiningAllocationVoter } from "../../../src/interfaces/IMiningAllocationVoter.sol";
import { ClaimsBase } from "../../../src/mining/ClaimsBase.sol";
import { EmissionController } from "../../../src/mining/EmissionController.sol";
import { GenesisBootstrap } from "../../../src/mining/GenesisBootstrap.sol";
import { GenesisClaims } from "../../../src/mining/GenesisClaims.sol";
import { MiningClaims } from "../../../src/mining/MiningClaims.sol";
import { MiningPool } from "../../../src/mining/MiningPool.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { ConfigurableEligibilityModuleMock } from "../mocks/ConfigurableEligibilityModuleMock.sol";
import {
    GenesisLiquidityManagerMock,
    MiningAllocationVoterMock,
    MiningUSDGMock,
    MiningVaultMock
} from "../mocks/MiningTestMocks.sol";

abstract contract MiningLifecycleFixture is Test {
    uint256 internal constant USD_UNIT = 1e6;
    uint256 internal constant BOOTSTRAP_MINIMUM = 10_000_000 * USD_UNIT;
    uint256 internal constant BOOTSTRAP_CAP = 80_000_000 * USD_UNIT;
    uint256 internal constant MAX_SPONSOR = 20_000_000 * USD_UNIT;
    uint256 internal constant DAILY_DECAY = 999_525_354_337_060_160;
    uint160 internal constant GENESIS_SQRT_PRICE_X96 = 1 << 96;

    address internal _alice;
    address internal _bob;
    address internal _backer;
    address internal _guardian;
    address internal _protocolTimelock;
    address internal _stranger;

    MiningUSDGMock internal _usdG;
    MiningVaultMock internal _vault;
    MiningAllocationVoterMock internal _voter;
    GBXToken internal _gbx;
    EmissionController internal _controller;
    GenesisClaims internal _genesisClaims;
    MiningClaims internal _miningClaims;
    MiningPool internal _miningPool;
    GenesisBootstrap internal _bootstrap;
    GenesisLiquidityManagerMock internal _liquidityManager;

    function setUp() public virtual {
        vm.warp(1_000_000);
        _alice = makeAddr("alice");
        _bob = makeAddr("bob");
        _backer = makeAddr("genesisLiquidityBacker");
        _guardian = makeAddr("emergencyGuardian");
        _protocolTimelock = makeAddr("protocolTimelock");
        _stranger = makeAddr("claimCaller");

        _usdG = new MiningUSDGMock(6);
        _vault = new MiningVaultMock();
        _voter = new MiningAllocationVoterMock();
        _gbx = new GBXToken(address(this), _deployEligibilityModule());
        _controller = new EmissionController(_gbx, address(this));
        _genesisClaims = new GenesisClaims(_gbx, address(this));
        _miningClaims = new MiningClaims(_gbx, address(this));

        _miningPool = new MiningPool(
            MiningPool.Dependencies({
                usdG: address(_usdG),
                gumBallVault: address(_vault),
                allocationVoter: address(_voter),
                emissionController: address(_controller),
                miningClaims: address(_miningClaims),
                emergencyGuardian: _guardian,
                protocolTimelock: _protocolTimelock,
                dependencyInitializer: address(this)
            })
        );

        _bootstrap = new GenesisBootstrap(
            GenesisBootstrap.Dependencies({
                usdG: address(_usdG),
                gumBallVault: address(_vault),
                allocationVoter: address(_voter),
                emissionController: address(_controller),
                genesisClaims: address(_genesisClaims),
                miningPool: address(_miningPool),
                genesisLiquidityBacker: _backer,
                dependencyInitializer: address(this)
            }),
            BOOTSTRAP_MINIMUM,
            BOOTSTRAP_CAP
        );
        _liquidityManager = new GenesisLiquidityManagerMock();

        _gbx.initializeEmissionController(address(_controller));
        _controller.initializeCallers(address(_bootstrap), address(_miningPool));
        _genesisClaims.initializeSource(address(_bootstrap));
        _miningClaims.initializeSource(address(_miningPool));
        _miningPool.initializeGenesisBootstrap(address(_bootstrap));
        _bootstrap.initializeLiquidityManager(address(_liquidityManager));

        _usdG.mint(_backer, 100_000_000 * USD_UNIT);
        _usdG.mint(_alice, 250_000_000 * USD_UNIT);
        _usdG.mint(_bob, 250_000_000 * USD_UNIT);

        vm.prank(_backer);
        _usdG.approve(address(_bootstrap), type(uint256).max);
        vm.startPrank(_alice);
        _usdG.approve(address(_bootstrap), type(uint256).max);
        _usdG.approve(address(_miningPool), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(_bob);
        _usdG.approve(address(_bootstrap), type(uint256).max);
        _usdG.approve(address(_miningPool), type(uint256).max);
        vm.stopPrank();
    }

    function _fundSponsor(uint256 amount) internal {
        vm.prank(_backer);
        _bootstrap.fundSponsor(amount);
    }

    function _contributeGenesis(address payer, address beneficiary, uint256 amount) internal {
        vm.prank(payer);
        _bootstrap.contribute(beneficiary, amount);
    }

    function _closeBootstrap() internal {
        vm.warp(_bootstrap.contributionEnd());
        _bootstrap.close();
    }

    function _launchForMining() internal {
        _fundSponsor(MAX_SPONSOR);
        _bootstrap.openContributions();
        _contributeGenesis(_alice, _alice, 20_000_000 * USD_UNIT);
        _contributeGenesis(_bob, _bob, 60_000_000 * USD_UNIT);
        _closeBootstrap();
        _bootstrap.settle(GENESIS_SQRT_PRICE_X96);
    }

    function _contributeMining(address payer, address beneficiary, uint256 amount) internal returns (uint256 received) {
        vm.prank(payer);
        return _miningPool.contribute(beneficiary, amount);
    }

    function _epoch(uint256 epochId) internal view returns (MiningPool.Epoch memory snapshot) {
        return _miningPool.getEpoch(epochId);
    }

    function _deployEligibilityModule() internal virtual returns (IEligibilityModule) {
        return IEligibilityModule(address(0));
    }
}

contract GenesisBootstrapLifecycleTest is MiningLifecycleFixture {
    function test_SettlementPreservesBackingMintsExactAllocationsAndClaimsToBeneficiary() external {
        uint256 backerBalanceBefore = _usdG.balanceOf(_backer);
        _fundSponsor(MAX_SPONSOR);
        _bootstrap.openContributions();
        _contributeGenesis(_alice, _alice, 10_000_000 * USD_UNIT);
        _contributeGenesis(_bob, _bob, 30_000_000 * USD_UNIT);
        _closeBootstrap();

        uint160 sqrtPriceX96 = _bootstrap.settle(GENESIS_SQRT_PRICE_X96);

        assertEq(uint256(_bootstrap.state()), uint256(GenesisBootstrap.State.SETTLED));
        assertEq(_bootstrap.requiredSponsorUSDG(), 10_000_000 * USD_UNIT);
        assertEq(_usdG.balanceOf(address(_vault)), 50_000_000 * USD_UNIT);
        assertEq(_usdG.balanceOf(_backer), backerBalanceBefore - 10_000_000 * USD_UNIT);
        assertEq(_gbx.balanceOf(address(_genesisClaims)), 80_000_000 ether);
        assertEq(_gbx.balanceOf(address(_liquidityManager)), 20_000_000 ether);
        assertEq(_gbx.totalSupply(), 100_000_000 ether);
        assertEq(_bootstrap.genesisPriceWad(), 0.5 ether);
        assertEq(_miningPool.referenceMiningPrice(), 0.5 ether);
        assertEq(_liquidityManager.communityUSDG(), 40_000_000 * USD_UNIT);
        assertEq(sqrtPriceX96, _liquidityManager.SQRT_PRICE_X96());
        assertEq(_voter.totalNotified(), 50_000_000 * USD_UNIT);
        assertEq(uint256(_voter.lastSource()), uint256(IMiningAllocationVoter.RevenueSource.GenesisBootstrap));

        vm.prank(_stranger);
        uint256 claimed = _genesisClaims.claim(_alice);
        assertEq(claimed, 20_000_000 ether);
        assertEq(_gbx.balanceOf(_alice), claimed);
        assertEq(_gbx.balanceOf(_stranger), 0);
    }

    function test_SponsorRequirementRoundsUpAndFailedLaunchRefundsRemainPermissionless() external {
        uint256 aliceBefore = _usdG.balanceOf(_alice);
        uint256 backerBefore = _usdG.balanceOf(_backer);
        _fundSponsor(26);
        _bootstrap.openContributions();
        _contributeGenesis(_alice, _alice, 101);
        _closeBootstrap();

        assertEq(_bootstrap.requiredSponsorUSDG(), 26);
        assertEq(uint256(_bootstrap.state()), uint256(GenesisBootstrap.State.REFUNDABLE));

        vm.prank(_stranger);
        assertEq(_bootstrap.refund(_alice), 101);
        vm.prank(_stranger);
        assertEq(_bootstrap.refundSponsor(), 26);
        assertEq(_usdG.balanceOf(_alice), aliceBefore);
        assertEq(_usdG.balanceOf(_backer), backerBefore);
    }

    function test_UnderfundedSponsorMakesSuccessfulRaiseRefundable() external {
        _fundSponsor(1_000_000 * USD_UNIT);
        _bootstrap.openContributions();
        _contributeGenesis(_alice, _alice, 20_000_000 * USD_UNIT);
        _closeBootstrap();

        assertEq(_bootstrap.requiredSponsorUSDG(), 5_000_000 * USD_UNIT);
        assertEq(uint256(_bootstrap.state()), uint256(GenesisBootstrap.State.REFUNDABLE));
        assertFalse(_controller.genesisMinted());
    }

    function test_ContributionUsesObservedFeeOnTransferDelta() external {
        _fundSponsor(MAX_SPONSOR);
        _bootstrap.openContributions();
        _usdG.setFeeBps(100);

        uint256 received = _contributeGenesisAndReturn(_alice, _alice, 10_000_000 * USD_UNIT);

        assertEq(received, 9_900_000 * USD_UNIT);
        assertEq(_bootstrap.communityUSDG(), received);
        assertEq(_bootstrap.communityContribution(_alice), received);
    }

    function test_ContributionCapRejectsOneRawUnitOverObservedMaximum() external {
        _fundSponsor(MAX_SPONSOR);
        _bootstrap.openContributions();
        _contributeGenesis(_alice, _alice, BOOTSTRAP_CAP);

        vm.prank(_bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                GenesisBootstrap.GenesisBootstrap__ContributionCapExceeded.selector, BOOTSTRAP_CAP + 1, BOOTSTRAP_CAP
            )
        );
        _bootstrap.contribute(_bob, 1);

        assertEq(_bootstrap.communityUSDG(), BOOTSTRAP_CAP);
        assertEq(_usdG.balanceOf(address(_bootstrap)), BOOTSTRAP_CAP + MAX_SPONSOR);
    }

    function test_ClaimsSourceCannotBePreinitializedOrReplaced() external {
        GenesisClaims pendingClaims = new GenesisClaims(_gbx, address(this));

        vm.prank(_stranger);
        vm.expectRevert(
            abi.encodeWithSelector(ClaimsBase.ClaimsBase__UnauthorizedSourceInitializer.selector, _stranger)
        );
        pendingClaims.initializeSource(address(_bootstrap));

        pendingClaims.initializeSource(address(_bootstrap));
        vm.expectRevert(ClaimsBase.ClaimsBase__SourceAlreadyInitialized.selector);
        pendingClaims.initializeSource(address(_bootstrap));
        assertEq(address(pendingClaims.source()), address(_bootstrap));
    }

    function test_AtomicLiquidityFailureRollsBackCustodyMintsAndState() external {
        _fundSponsor(MAX_SPONSOR);
        _bootstrap.openContributions();
        _contributeGenesis(_alice, _alice, BOOTSTRAP_CAP);
        _closeBootstrap();
        _liquidityManager.setShouldRevert(true);

        vm.expectRevert("liquidity failure");
        _bootstrap.settle(GENESIS_SQRT_PRICE_X96);

        assertEq(uint256(_bootstrap.state()), uint256(GenesisBootstrap.State.AWAITING_SETTLEMENT));
        assertEq(_usdG.balanceOf(address(_bootstrap)), BOOTSTRAP_CAP + MAX_SPONSOR);
        assertEq(_usdG.balanceOf(address(_vault)), 0);
        assertEq(_gbx.cumulativeMinted(), 0);
        assertFalse(_controller.genesisMinted());
        assertFalse(_miningPool.referencePriceInitialized());
        assertFalse(_liquidityManager.initialized());
    }

    function test_InvalidSqrtPriceWitnessRollsBackAndCannotBlockCorrectPermissionlessSettlement() external {
        _fundSponsor(MAX_SPONSOR);
        _bootstrap.openContributions();
        _contributeGenesis(_alice, _alice, BOOTSTRAP_CAP);
        _closeBootstrap();

        vm.expectRevert("sqrt price");
        _bootstrap.settle(GENESIS_SQRT_PRICE_X96 + 1);

        assertEq(uint256(_bootstrap.state()), uint256(GenesisBootstrap.State.AWAITING_SETTLEMENT));
        assertEq(_usdG.balanceOf(address(_bootstrap)), BOOTSTRAP_CAP + MAX_SPONSOR);
        assertEq(_usdG.balanceOf(address(_vault)), 0);
        assertEq(_gbx.cumulativeMinted(), 0);
        assertFalse(_liquidityManager.initialized());

        vm.prank(_stranger);
        assertEq(_bootstrap.settle(GENESIS_SQRT_PRICE_X96), GENESIS_SQRT_PRICE_X96);
        assertEq(uint256(_bootstrap.state()), uint256(GenesisBootstrap.State.SETTLED));
        assertTrue(_liquidityManager.initialized());
    }

    function test_MissedSettlementDeadlineActivatesRefunds() external {
        _fundSponsor(MAX_SPONSOR);
        _bootstrap.openContributions();
        _contributeGenesis(_alice, _alice, BOOTSTRAP_CAP);
        _closeBootstrap();
        vm.warp(_bootstrap.settlementDeadline() + 1);

        vm.prank(_stranger);
        _bootstrap.activateRefunds();

        assertEq(uint256(_bootstrap.state()), uint256(GenesisBootstrap.State.REFUNDABLE));
        assertEq(_bootstrap.refund(_alice), BOOTSTRAP_CAP);
        assertEq(_bootstrap.refundSponsor(), MAX_SPONSOR);
    }

    function test_TwoYearGenesisExpiryBurnsOnlyUnclaimedRemainder() external {
        _launchForMining();
        vm.prank(_stranger);
        assertEq(_genesisClaims.claim(_alice), 20_000_000 ether);

        vm.warp(_bootstrap.settledAt() + _genesisClaims.CLAIM_EXPIRY());
        vm.expectRevert(abi.encodeWithSelector(ClaimsBase.ClaimsBase__DistributionAlreadyExpired.selector, 0));
        _genesisClaims.claim(_bob);

        vm.prank(_stranger);
        uint256 burned = _genesisClaims.burnExpired();
        assertEq(burned, 60_000_000 ether);
        assertEq(_gbx.cumulativeBurned(), burned);
        assertEq(_gbx.balanceOf(address(_genesisClaims)), 0);
        assertEq(_gbx.totalSupply(), 40_000_000 ether);
    }

    function _contributeGenesisAndReturn(address payer, address beneficiary, uint256 amount)
        private
        returns (uint256 received)
    {
        vm.prank(payer);
        return _bootstrap.contribute(beneficiary, amount);
    }
}

contract MiningPoolLifecycleTest is MiningLifecycleFixture {
    function setUp() public override {
        super.setUp();
        _launchForMining();
    }

    function test_FullDemandSettlesScheduleUpdatesReferenceAndClaims() external {
        uint256 contribution = 500_000 * USD_UNIT;
        uint256 scheduled = _controller.currentScheduledEmission();
        uint256 previousReference = _miningPool.referenceMiningPrice();
        _contributeMining(_alice, _alice, contribution);
        MiningPool.Epoch memory beforeSettlement = _epoch(0);
        vm.warp(beforeSettlement.endTime);

        uint256 actualEmission = _miningPool.settleCurrentEpoch();

        uint256 clearingPrice = Math.mulDiv(contribution * 1e12, 1e18, scheduled);
        uint256 expectedReference =
            Math.mulDiv(previousReference, 8_000, 10_000) + Math.mulDiv(clearingPrice, 2_000, 10_000);
        assertEq(actualEmission, scheduled);
        assertEq(_miningPool.referenceMiningPrice(), expectedReference);
        assertEq(_controller.currentScheduledEmission(), Math.mulDiv(scheduled, DAILY_DECAY, 1e18));
        assertEq(_usdG.balanceOf(address(_vault)), BOOTSTRAP_CAP + MAX_SPONSOR + contribution);
        assertEq(_gbx.balanceOf(address(_miningClaims)), scheduled);
        assertEq(_voter.lastAmount(), contribution);
        assertEq(uint256(_voter.lastSource()), uint256(IMiningAllocationVoter.RevenueSource.MiningPool));

        vm.prank(_stranger);
        assertEq(_miningPool.claim(_alice, 0), scheduled);
        assertEq(_gbx.balanceOf(_alice), scheduled);
        assertEq(_gbx.balanceOf(_stranger), 0);
    }

    function test_UnderfilledDemandUsesMinimumPriceAndMintsOnlyAffordableEmission() external {
        uint256 contribution = 95_000 * USD_UNIT;
        _contributeMining(_alice, _alice, contribution);
        vm.warp(_epoch(0).endTime);

        uint256 actualEmission = _miningPool.settleCurrentEpoch();
        MiningPool.Epoch memory settledEpoch = _epoch(0);

        assertEq(actualEmission, 100_000 ether);
        assertEq(settledEpoch.minimumMiningPrice, 0.95 ether);
        assertEq(settledEpoch.clearingPrice, 0.95 ether);
        assertEq(_miningPool.referenceMiningPrice(), 0.99 ether);
        assertLt(actualEmission, settledEpoch.scheduledEmission);
    }

    function test_HighDemandReferenceIncreaseIsClampedAtOneHundredFiftyPercent() external {
        _contributeMining(_alice, _alice, 10_000_000 * USD_UNIT);
        vm.warp(_epoch(0).endTime);

        _miningPool.settleCurrentEpoch();

        assertEq(_miningPool.referenceMiningPrice(), 1.5 ether);
        assertGt(_epoch(0).clearingPrice, 3.5 ether);
    }

    function test_EmptyEpochsAdvanceSequentialScheduleWithoutCarryover() external {
        uint256 schedule0 = _controller.currentScheduledEmission();
        vm.warp(_epoch(0).endTime);
        assertEq(_miningPool.settleCurrentEpoch(), 0);
        uint256 schedule1 = Math.mulDiv(schedule0, DAILY_DECAY, 1e18);

        assertEq(_controller.currentScheduledEmission(), schedule1);
        assertEq(_miningPool.referenceMiningPrice(), 0.95 ether);
        assertEq(_epoch(0).scheduledEmission, schedule0);
        assertEq(_epoch(0).actualEmission, 0);

        vm.warp(_epoch(1).endTime);
        assertEq(_miningPool.settleCurrentEpoch(), 0);
        assertEq(_controller.currentScheduledEmission(), Math.mulDiv(schedule1, DAILY_DECAY, 1e18));
        assertEq(_miningPool.referenceMiningPrice(), 0.9025 ether);
        assertEq(_miningPool.currentEpochId(), 2);
    }

    function test_AntiSnipingExtendsAtOnePercentAndCapsAtTwoHours() external {
        _contributeMining(_alice, _alice, 1_000 * USD_UNIT);

        for (uint256 index; index < 8; ++index) {
            MiningPool.Epoch memory epochBefore = _epoch(0);
            vm.warp(epochBefore.endTime - _miningPool.ANTI_SNIPING_WINDOW());
            uint256 materialAmount = Math.mulDiv(epochBefore.totalContributed, 1, 100, Math.Rounding.Ceil);
            _contributeMining(_alice, _alice, materialAmount);
            assertEq(_epoch(0).endTime, epochBefore.endTime + _miningPool.ANTI_SNIPING_EXTENSION());
        }

        MiningPool.Epoch memory capped = _epoch(0);
        assertEq(capped.extensionUsed, 2 hours);
        vm.warp(capped.endTime - _miningPool.ANTI_SNIPING_WINDOW());
        uint256 materialAtCap = Math.mulDiv(capped.totalContributed, 1, 100, Math.Rounding.Ceil);
        _contributeMining(_alice, _alice, materialAtCap);
        assertEq(_epoch(0).endTime, capped.endTime);
        assertEq(_epoch(0).extensionUsed, 2 hours);
    }

    function test_SubThresholdLateContributionDoesNotExtend() external {
        _contributeMining(_alice, _alice, 1_000 * USD_UNIT);
        MiningPool.Epoch memory epochBefore = _epoch(0);
        vm.warp(epochBefore.endTime - _miningPool.ANTI_SNIPING_WINDOW());

        _contributeMining(_alice, _alice, 10 * USD_UNIT - 1);

        assertEq(_epoch(0).endTime, epochBefore.endTime);
        assertEq(_epoch(0).extensionUsed, 0);
    }

    function test_GuardianCanOnlyPauseAndTimelockAloneCanReopen() external {
        vm.prank(_stranger);
        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__UnauthorizedGuardian.selector, _stranger));
        _miningPool.pauseContributions();

        vm.prank(_guardian);
        _miningPool.pauseContributions();
        assertTrue(_miningPool.contributionsPaused());

        vm.prank(_guardian);
        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__UnauthorizedProtocolTimelock.selector, _guardian));
        _miningPool.unpauseContributions();

        vm.prank(_protocolTimelock);
        _miningPool.unpauseContributions();
        assertFalse(_miningPool.contributionsPaused());
    }

    function test_InvalidatedEpochRefundRemainsLiveAfterScheduleSettlement() external {
        uint256 contribution = 100_000 * USD_UNIT;
        uint256 aliceBefore = _usdG.balanceOf(_alice);
        uint256 vaultBefore = _usdG.balanceOf(address(_vault));
        _contributeMining(_alice, _alice, contribution);

        vm.prank(_guardian);
        _miningPool.invalidateCurrentEpoch();
        vm.warp(_epoch(0).endTime);
        assertEq(_miningPool.settleCurrentEpoch(), 0);

        MiningPool.Epoch memory invalidated = _epoch(0);
        assertTrue(invalidated.settled);
        assertTrue(invalidated.invalidated);
        assertEq(invalidated.actualEmission, 0);
        assertEq(_usdG.balanceOf(address(_vault)), vaultBefore);
        assertEq(_miningPool.currentEpochId(), 1);

        vm.prank(_stranger);
        assertEq(_miningPool.refund(_alice, 0), contribution);
        assertEq(_usdG.balanceOf(_alice), aliceBefore);
        assertEq(_usdG.balanceOf(address(_miningPool)), 0);

        vm.prank(_protocolTimelock);
        _miningPool.unpauseContributions();
        assertFalse(_miningPool.contributionsPaused());
    }

    function test_FeeOnTransferContributionUsesObservedDelta() external {
        _usdG.setFeeBps(100);
        uint256 received = _contributeMining(_alice, _alice, 100_000 * USD_UNIT);
        assertEq(received, 99_000 * USD_UNIT);
        assertEq(_miningPool.contributionOf(0, _alice), received);
        assertEq(_epoch(0).totalContributed, received);

        _usdG.setFeeBps(0);
        vm.warp(_epoch(0).endTime);
        _miningPool.settleCurrentEpoch();
        assertEq(_voter.lastAmount(), received);
    }

    function test_SettlementFailureRollsBackEpochCustodyReferenceAndSchedule() external {
        uint256 contribution = 95_000 * USD_UNIT;
        uint256 vaultBefore = _usdG.balanceOf(address(_vault));
        uint256 scheduleBefore = _controller.currentScheduledEmission();
        _contributeMining(_alice, _alice, contribution);
        vm.warp(_epoch(0).endTime);
        _voter.setShouldRevert(true);

        vm.expectRevert("voter failure");
        _miningPool.settleCurrentEpoch();

        assertFalse(_epoch(0).settled);
        assertEq(_miningPool.currentEpochId(), 0);
        assertEq(_miningPool.referenceMiningPrice(), 1 ether);
        assertEq(_controller.currentScheduledEmission(), scheduleBefore);
        assertEq(_usdG.balanceOf(address(_miningPool)), contribution);
        assertEq(_usdG.balanceOf(address(_vault)), vaultBefore);

        _voter.setShouldRevert(false);
        assertEq(_miningPool.settleCurrentEpoch(), 100_000 ether);
    }

    function test_SettledEpochCannotSettleTwice() external {
        _contributeMining(_alice, _alice, 95_000 * USD_UNIT);
        vm.warp(_epoch(0).endTime);
        _miningPool.settleCurrentEpoch();
        uint64 nextEnd = _epoch(1).endTime;

        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__EpochNotEnded.selector, 1, nextEnd));
        _miningPool.settleCurrentEpoch();
        assertEq(_miningPool.currentEpochId(), 1);
    }

    function test_ContributionForBeneficiariesAndClaimRoundingNeverExceedEmission() external {
        _contributeMining(_alice, _bob, 1 * USD_UNIT);
        _contributeMining(_bob, _alice, 2 * USD_UNIT);
        vm.warp(_epoch(0).endTime);
        uint256 emission = _miningPool.settleCurrentEpoch();

        (uint256 aliceClaim,,,) = _miningPool.claimData(0, _alice);
        (uint256 bobClaim,,,) = _miningPool.claimData(0, _bob);
        assertLe(aliceClaim + bobClaim, emission);
        assertLe(emission - aliceClaim - bobClaim, 1);

        vm.prank(_stranger);
        _miningClaims.claim(_alice, 0);
        vm.prank(_stranger);
        _miningClaims.claim(_bob, 0);
        assertEq(_gbx.balanceOf(_alice), aliceClaim);
        assertEq(_gbx.balanceOf(_bob), bobClaim);

        vm.warp(uint256(_epoch(0).settledAt) + _miningClaims.CLAIM_EXPIRY());
        assertEq(_miningClaims.burnExpired(0), emission - aliceClaim - bobClaim);
    }

    function test_TwoYearMiningExpiryBurnsUnclaimedEmission() external {
        _contributeMining(_alice, _alice, 95_000 * USD_UNIT);
        vm.warp(_epoch(0).endTime);
        uint256 emission = _miningPool.settleCurrentEpoch();
        uint64 settledAt = _epoch(0).settledAt;
        uint256 supplyBefore = _gbx.totalSupply();

        vm.warp(uint256(settledAt) + _miningClaims.CLAIM_EXPIRY());
        vm.prank(_stranger);
        assertEq(_miningClaims.burnExpired(0), emission);
        assertEq(_gbx.totalSupply(), supplyBefore - emission);
        assertEq(_gbx.cumulativeBurned(), emission);
    }

    function test_BatchedClaimsAggregateSettledEpochsToRecordedBeneficiary() external {
        _contributeMining(_alice, _alice, 95_000 * USD_UNIT);
        vm.warp(_epoch(0).endTime);
        uint256 epoch0Emission = _miningPool.settleCurrentEpoch();

        _contributeMining(_alice, _alice, 94_050 * USD_UNIT);
        vm.warp(_epoch(1).endTime);
        uint256 epoch1Emission = _miningPool.settleCurrentEpoch();

        uint256[] memory epochIds = new uint256[](2);
        epochIds[0] = 0;
        epochIds[1] = 1;
        vm.prank(_stranger);
        uint256 claimed = _miningClaims.claimBatch(_alice, epochIds);
        assertEq(claimed, epoch0Emission + epoch1Emission);
        assertEq(_gbx.balanceOf(_alice), claimed);
        assertEq(_gbx.balanceOf(_stranger), 0);
    }
}

contract PermissionedMiningEligibilityTest is MiningLifecycleFixture {
    ConfigurableEligibilityModuleMock private _eligibility;

    function test_GenesisContributionRejectsIneligibleBeneficiaryBeforeCustodyMoves() external {
        _fundSponsor(MAX_SPONSOR);
        _bootstrap.openContributions();
        _eligibility.setHoldAllowed(false);
        uint256 payerBalanceBefore = _usdG.balanceOf(_alice);

        vm.prank(_alice);
        vm.expectRevert(abi.encodeWithSelector(GenesisBootstrap.GenesisBootstrap__IneligibleBeneficiary.selector, _bob));
        _bootstrap.contribute(_bob, 1_000 * USD_UNIT);

        assertEq(_usdG.balanceOf(_alice), payerBalanceBefore);
        assertEq(_bootstrap.communityContribution(_bob), 0);
        assertEq(_bootstrap.communityUSDG(), 0);
    }

    function test_RecurringMiningRejectsIneligibleBeneficiaryBeforeCustodyMoves() external {
        _launchForMining();
        _eligibility.setHoldAllowed(false);
        uint256 payerBalanceBefore = _usdG.balanceOf(_alice);

        vm.prank(_alice);
        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__IneligibleBeneficiary.selector, _bob));
        _miningPool.contribute(_bob, 1_000 * USD_UNIT);

        assertEq(_usdG.balanceOf(_alice), payerBalanceBefore);
        assertEq(_miningPool.contributionOf(0, _bob), 0);
        assertEq(_epoch(0).totalContributed, 0);
    }

    function test_EligibilityInfrastructureFailureClosesContributions() external {
        _fundSponsor(MAX_SPONSOR);
        _bootstrap.openContributions();
        _eligibility.setChecksRevert(true);

        vm.prank(_alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                GenesisBootstrap.GenesisBootstrap__EligibilityCheckFailed.selector, address(_eligibility)
            )
        );
        _bootstrap.contribute(_alice, 1_000 * USD_UNIT);
    }

    function _deployEligibilityModule() internal override returns (IEligibilityModule) {
        _eligibility = new ConfigurableEligibilityModuleMock();
        return _eligibility;
    }
}
