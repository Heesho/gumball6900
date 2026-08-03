// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IEmissionController } from "../../src/interfaces/IEmissionController.sol";
import { EmissionController } from "../../src/mining/EmissionController.sol";
import { MiningClaims } from "../../src/mining/MiningClaims.sol";
import { MiningPool } from "../../src/mining/MiningPool.sol";
import { GBXToken } from "../../src/token/GBXToken.sol";
import {
    SupplyMiningAllocationVoterMock,
    SupplyMiningClaimsSourceMock,
    SupplyMiningCodeMock,
    SupplyMiningCustodianMock,
    SupplyMiningMalformedControllerMock,
    SupplyMiningUSDGMock
} from "./mocks/SupplyMiningMocks.sol";

contract MinimalMiningPoolClaimsTest is Test {
    uint256 private constant INITIAL_DAILY_EMISSION = 465_152_749_681_042_811_702_004;

    address private constant GENESIS_RECIPIENT = address(0x6900);
    address private constant GUARDIAN = address(0x600D);
    address private constant TEAM = address(0x7EA0);
    address private constant PAYER_ONE = address(0xA11CE);
    address private constant PAYER_TWO = address(0xCA201);
    address private constant BENEFICIARY_ONE = address(0xB0B);
    address private constant BENEFICIARY_TWO = address(0xDA7E);
    address private constant PERMISSIONLESS_CALLER = address(0xCA11E2);

    SupplyMiningUSDGMock private _usdg;
    SupplyMiningCodeMock private _vault;
    SupplyMiningCodeMock private _timelock;
    SupplyMiningAllocationVoterMock private _voter;
    SupplyMiningCustodianMock private _custodian;
    GBXToken private _gbx;
    MiningClaims private _claims;
    MiningPool private _pool;
    EmissionController private _controller;

    function setUp() external {
        vm.warp(10 days);

        _usdg = new SupplyMiningUSDGMock();
        _vault = new SupplyMiningCodeMock();
        _timelock = new SupplyMiningCodeMock();
        _voter = new SupplyMiningAllocationVoterMock();
        _custodian = new SupplyMiningCustodianMock();

        _gbx = new GBXToken(GENESIS_RECIPIENT, address(this), address(_timelock));
        _claims = new MiningClaims(_gbx, address(this));
        _pool = new MiningPool(
            address(_usdg),
            address(_vault),
            _voter,
            _gbx,
            _claims,
            address(_custodian),
            GUARDIAN,
            address(_timelock),
            address(this),
            TEAM
        );
        _controller = new EmissionController(_gbx, address(_pool), 0, INITIAL_DAILY_EMISSION);

        _gbx.initializeEmissionController(address(_controller));
        _claims.initializeSource(address(_pool));

        _fundAndApprove(PAYER_ONE, 1_000_000 ether);
        _fundAndApprove(PAYER_TWO, 1_000_000 ether);
    }

    function test_StartRequiresCanonicalPositionCustodyAndCanOnlyRunOnce() external {
        vm.expectRevert(MiningPool.MiningPool__PositionNotInCustody.selector);
        _pool.start();

        _custodian.setPositionInCustody(true);
        vm.prank(PAYER_ONE);
        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__Unauthorized.selector, PAYER_ONE));
        _pool.start();

        _pool.start();
        assertTrue(_pool.started());
        assertEq(_pool.currentEpochId(), 0);
        assertEq(_epochEnd(0) - _epochStart(0), 1 days);

        vm.expectRevert(MiningPool.MiningPool__AlreadyStarted.selector);
        _pool.start();
    }

    function test_StartRejectsAControllerBoundToAnotherPoolOrAConsumedEpochZero() external {
        GBXToken wrongPoolGBX = new GBXToken(GENESIS_RECIPIENT, address(this), address(_timelock));
        MiningClaims wrongPoolClaims = new MiningClaims(wrongPoolGBX, address(this));
        MiningPool wrongPool = new MiningPool(
            address(_usdg),
            address(_vault),
            _voter,
            wrongPoolGBX,
            wrongPoolClaims,
            address(_custodian),
            GUARDIAN,
            address(_timelock),
            address(this),
            TEAM
        );
        SupplyMiningMalformedControllerMock mismatchedController =
            new SupplyMiningMalformedControllerMock(wrongPoolGBX, address(_vault), 0, 1, false, false);
        wrongPoolGBX.initializeEmissionController(address(mismatchedController));
        _custodian.setPositionInCustody(true);
        vm.expectRevert(MiningPool.MiningPool__InvalidConfiguration.selector);
        wrongPool.start();

        GBXToken advancedGBX = new GBXToken(GENESIS_RECIPIENT, address(this), address(_timelock));
        MiningClaims advancedClaims = new MiningClaims(advancedGBX, address(this));
        MiningPool advancedPool = new MiningPool(
            address(_usdg),
            address(_vault),
            _voter,
            advancedGBX,
            advancedClaims,
            address(_custodian),
            GUARDIAN,
            address(_timelock),
            address(this),
            TEAM
        );
        SupplyMiningMalformedControllerMock advancedController =
            new SupplyMiningMalformedControllerMock(advancedGBX, address(advancedPool), 1, 1, false, false);
        advancedGBX.initializeEmissionController(address(advancedController));
        vm.expectRevert(MiningPool.MiningPool__InvalidConfiguration.selector);
        advancedPool.start();
    }

    function test_ContributionAndSettlementRequireAStartedLiveEpoch() external {
        vm.prank(PAYER_ONE);
        vm.expectRevert(MiningPool.MiningPool__MiningNotStarted.selector);
        _pool.contribute(BENEFICIARY_ONE, 1);

        vm.expectRevert(MiningPool.MiningPool__MiningNotStarted.selector);
        _pool.settleCurrentEpoch();

        _startMining();

        vm.prank(PAYER_ONE);
        vm.expectRevert(MiningPool.MiningPool__ZeroAddress.selector);
        _pool.contribute(address(0), 1);

        vm.prank(PAYER_ONE);
        vm.expectRevert(MiningPool.MiningPool__ZeroAmount.selector);
        _pool.contribute(BENEFICIARY_ONE, 0);

        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__EpochNotEnded.selector, 0, _epochEnd(0)));
        _pool.settleCurrentEpoch();

        vm.warp(_epochEnd(0));
        vm.prank(PAYER_ONE);
        vm.expectRevert(
            abi.encodeWithSelector(MiningPool.MiningPool__ContributionPeriodEnded.selector, 0, _epochEnd(0))
        );
        _pool.contribute(BENEFICIARY_ONE, 1);
    }

    function test_TinyPayerAttributedContributionsReceiveCompleteEmissionAndFloorRoundedClaims() external {
        _startMining();

        vm.prank(PAYER_ONE);
        uint256 receivedOne = _pool.contribute(BENEFICIARY_ONE, 1);
        vm.prank(PAYER_TWO);
        uint256 receivedTwo = _pool.contribute(BENEFICIARY_TWO, 2);

        assertEq(receivedOne, 1);
        assertEq(receivedTwo, 2);
        assertEq(_pool.contributionOf(0, BENEFICIARY_ONE), 1);
        assertEq(_pool.contributionOf(0, BENEFICIARY_TWO), 2);
        assertEq(_claims.previewClaim(BENEFICIARY_ONE, 0), 0);

        vm.prank(PERMISSIONLESS_CALLER);
        vm.expectRevert(abi.encodeWithSelector(MiningClaims.MiningClaims__NotSettled.selector, 0));
        _claims.claim(BENEFICIARY_ONE, 0);

        vm.warp(_epochEnd(0));
        vm.prank(PERMISSIONLESS_CALLER);
        uint256 emission = _pool.settleCurrentEpoch();

        assertEq(emission, INITIAL_DAILY_EMISSION, "demand size must not scale a nonempty epoch emission");
        assertEq(_gbx.balanceOf(address(_claims)), INITIAL_DAILY_EMISSION);
        assertEq(_usdg.balanceOf(address(_vault)), 3);
        assertEq(_voter.notifiedRevenue(), 3);
        assertEq(_usdg.balanceOf(TEAM), 0, "the two-percent fee floors to zero for three wei");

        uint256 expectedOne = INITIAL_DAILY_EMISSION / 3;
        uint256 expectedTwo = (2 * INITIAL_DAILY_EMISSION) / 3;
        (uint256 claimOne, uint256 allocationOne, bool settledOne) = _pool.claimData(0, BENEFICIARY_ONE);
        (uint256 claimTwo, uint256 allocationTwo, bool settledTwo) = _pool.claimData(0, BENEFICIARY_TWO);
        assertEq(claimOne, expectedOne);
        assertEq(claimTwo, expectedTwo);
        assertEq(allocationOne, INITIAL_DAILY_EMISSION);
        assertEq(allocationTwo, INITIAL_DAILY_EMISSION);
        assertTrue(settledOne && settledTwo);
        assertEq(_claims.previewClaim(BENEFICIARY_ONE, 0), expectedOne);

        vm.prank(PERMISSIONLESS_CALLER);
        uint256 paidOne = _claims.claim(BENEFICIARY_ONE, 0);
        assertEq(paidOne, expectedOne);
        assertEq(_gbx.balanceOf(BENEFICIARY_ONE), expectedOne);
        assertEq(_gbx.balanceOf(PAYER_ONE), 0, "the payer must not receive the beneficiary's GBX");
        assertEq(_claims.previewClaim(BENEFICIARY_ONE, 0), 0);

        vm.expectRevert(abi.encodeWithSelector(MiningClaims.MiningClaims__AlreadyClaimed.selector, 0, BENEFICIARY_ONE));
        _claims.claim(BENEFICIARY_ONE, 0);

        vm.expectRevert(abi.encodeWithSelector(MiningClaims.MiningClaims__NoClaim.selector, 0, PAYER_ONE));
        _claims.claim(PAYER_ONE, 0);

        vm.prank(PERMISSIONLESS_CALLER);
        uint256 paidTwo = _claims.claim(BENEFICIARY_TWO, 0);
        assertEq(paidTwo, expectedTwo);
        assertEq(_gbx.balanceOf(BENEFICIARY_TWO), expectedTwo);
        assertEq(_gbx.balanceOf(address(_claims)), INITIAL_DAILY_EMISSION - expectedOne - expectedTwo);
    }

    function test_ContributionRejectsFeeOnTransferReceiptAndPayerSurchargeAtomically() external {
        _startMining();
        uint256 amount = 100 ether;

        _usdg.setFee(1_000, PAYER_ONE, address(_pool));
        vm.prank(PAYER_ONE);
        vm.expectRevert(
            abi.encodeWithSelector(
                MiningPool.MiningPool__InexactTransfer.selector, address(_usdg), amount, amount, 90 ether
            )
        );
        _pool.contribute(BENEFICIARY_ONE, amount);
        assertEq(_usdg.balanceOf(PAYER_ONE), 1_000_000 ether);
        assertEq(_usdg.balanceOf(address(_pool)), 0);
        assertEq(_pool.contributionOf(0, BENEFICIARY_ONE), 0);

        _usdg.setFee(0, address(0), address(0));
        _usdg.setSurcharge(1_000, PAYER_ONE, address(_pool));
        vm.prank(PAYER_ONE);
        vm.expectRevert(
            abi.encodeWithSelector(
                MiningPool.MiningPool__InexactTransfer.selector, address(_usdg), amount, 110 ether, amount
            )
        );
        _pool.contribute(BENEFICIARY_ONE, amount);
        assertEq(_usdg.balanceOf(PAYER_ONE), 1_000_000 ether);
        assertEq(_usdg.balanceOf(address(_pool)), 0);
        assertEq(_pool.contributionOf(0, BENEFICIARY_ONE), 0);
    }

    function test_ContributionRejectsBothZeroScheduleAndLifetimeCapExhaustionBeforeTakingUSDG() external {
        _startMining();
        bytes memory callData = abi.encodeCall(IEmissionController.currentScheduledEmission, ());
        vm.mockCall(address(_controller), callData, abi.encode(0));
        vm.prank(PAYER_ONE);
        vm.expectRevert(MiningPool.MiningPool__EmissionsExhausted.selector);
        _pool.contribute(BENEFICIARY_ONE, 1 ether);
        vm.clearMockedCalls();

        uint256 remainingCapacity = _gbx.remainingMintCapacity();
        vm.prank(address(_controller));
        _gbx.mintMiningEmission(BENEFICIARY_ONE, remainingCapacity);
        vm.prank(PAYER_ONE);
        vm.expectRevert(MiningPool.MiningPool__EmissionsExhausted.selector);
        _pool.contribute(BENEFICIARY_ONE, 1 ether);

        assertEq(_usdg.balanceOf(PAYER_ONE), 1_000_000 ether);
        assertEq(_usdg.balanceOf(address(_pool)), 0);
        assertEq(_pool.contributionOf(0, BENEFICIARY_ONE), 0);
    }

    function test_OutgoingReceiptMismatchRevertsSettlementAndEveryPriorTransferAtomically() external {
        _startMining();
        vm.prank(PAYER_ONE);
        _pool.contribute(BENEFICIARY_ONE, 100 ether);
        _usdg.setFee(1_000, address(_pool), address(_vault));
        vm.warp(_epochEnd(0));

        vm.expectRevert(
            abi.encodeWithSelector(MiningPool.MiningPool__ObservedReceiptMismatch.selector, 98 ether, 88.2 ether)
        );
        _pool.settleCurrentEpoch();

        assertEq(_usdg.balanceOf(address(_pool)), 100 ether);
        assertEq(_usdg.balanceOf(address(_vault)), 0);
        assertEq(_usdg.balanceOf(TEAM), 0);
        assertEq(_voter.notifiedRevenue(), 0);
        assertEq(_controller.nextMiningEpochId(), 0);
        assertEq(_pool.currentEpochId(), 0);
        (,,,,,,, bool settled) = _pool.epochs(0);
        assertFalse(settled);
    }

    function test_VoterCallbackCannotReenterEpochSettlement() external {
        _startMining();
        vm.prank(PAYER_ONE);
        _pool.contribute(BENEFICIARY_ONE, 100 ether);
        _voter.setReentry(address(_pool), true);
        vm.warp(_epochEnd(0));

        uint256 emission = _pool.settleCurrentEpoch();

        assertFalse(_voter.lastReentrySucceeded());
        assertEq(emission, INITIAL_DAILY_EMISSION);
        assertEq(_pool.currentEpochId(), 1);
        assertEq(_controller.nextMiningEpochId(), 1);
        assertEq(_usdg.balanceOf(address(_vault)), 98 ether);
        assertEq(_voter.notifiedRevenue(), 98 ether);
    }

    function test_EmptyEpochHasNoMintOrCarryAndNextTinyEpochGetsOnlyItsOwnSchedule() external {
        _startMining();
        vm.warp(_epochEnd(0));

        uint256 emptyEmission = _pool.settleCurrentEpoch();
        assertEq(emptyEmission, 0);
        assertEq(_gbx.balanceOf(address(_claims)), 0);
        assertEq(_controller.nextMiningEpochId(), 1);
        assertEq(_controller.currentScheduledEmission(), _controller.scheduledEmission(1));

        vm.prank(PAYER_ONE);
        _pool.contribute(BENEFICIARY_ONE, 1);
        vm.warp(_epochEnd(1));

        uint256 expected = _controller.scheduledEmission(1);
        uint256 emission = _pool.settleCurrentEpoch();
        assertEq(emission, expected);
        assertEq(_gbx.balanceOf(address(_claims)), expected);
        assertEq(_usdg.balanceOf(address(_vault)), 1);
        assertEq(_voter.notifiedRevenue(), 1);
    }

    function test_TeamReceivesTwoPercentAndZeroTeamReturnsTheCompleteContributionToVault() external {
        _startMining();

        vm.prank(PAYER_ONE);
        _pool.contribute(BENEFICIARY_ONE, 100 ether);
        vm.warp(_epochEnd(0));
        _pool.settleCurrentEpoch();

        assertEq(_usdg.balanceOf(TEAM), 2 ether);
        assertEq(_usdg.balanceOf(address(_vault)), 98 ether);
        assertEq(_voter.notifiedRevenue(), 98 ether);

        vm.prank(PAYER_ONE);
        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__Unauthorized.selector, PAYER_ONE));
        _pool.setTeamAddress(address(0));

        vm.prank(address(_timelock));
        _pool.setTeamAddress(address(0));
        assertEq(_pool.teamAddress(), address(0));

        vm.prank(PAYER_TWO);
        _pool.contribute(BENEFICIARY_TWO, 100 ether);
        vm.warp(_epochEnd(1));
        _pool.settleCurrentEpoch();

        assertEq(_usdg.balanceOf(TEAM), 2 ether);
        assertEq(_usdg.balanceOf(address(_vault)), 198 ether);
        assertEq(_voter.notifiedRevenue(), 198 ether);
    }

    function test_AuditProof_MiningPoolAsTeamRecipientStrandsTheTwoPercentFee() external {
        _startMining();

        vm.prank(address(_timelock));
        _pool.setTeamAddress(address(_pool));

        vm.prank(PAYER_ONE);
        _pool.contribute(BENEFICIARY_ONE, 100 ether);
        vm.warp(_epochEnd(0));
        _pool.settleCurrentEpoch();

        assertEq(_usdg.balanceOf(address(_pool)), 2 ether);
        assertEq(_usdg.balanceOf(address(_vault)), 98 ether);
        assertEq(_voter.notifiedRevenue(), 98 ether);
        (,,, uint256 totalContribution, uint256 teamFee, uint256 vaultRevenue,,) = _pool.epochs(0);
        assertEq(totalContribution, 100 ether);
        assertEq(teamFee, 2 ether);
        assertEq(vaultRevenue, 98 ether);
    }

    function test_PauseBlocksOnlyNewContributionsWhileEndedSettlementAndClaimsStayLive() external {
        _startMining();
        vm.prank(PAYER_ONE);
        _pool.contribute(BENEFICIARY_ONE, 100 ether);

        vm.prank(PAYER_ONE);
        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__Unauthorized.selector, PAYER_ONE));
        _pool.pauseContributions();

        vm.prank(GUARDIAN);
        _pool.pauseContributions();
        assertTrue(_pool.contributionsPaused());

        vm.prank(PAYER_TWO);
        vm.expectRevert(MiningPool.MiningPool__ContributionsPaused.selector);
        _pool.contribute(BENEFICIARY_TWO, 1);

        vm.warp(_epochEnd(0));
        vm.prank(PERMISSIONLESS_CALLER);
        uint256 emission = _pool.settleCurrentEpoch();
        assertEq(emission, INITIAL_DAILY_EMISSION);
        assertTrue(_pool.contributionsPaused());

        vm.prank(PERMISSIONLESS_CALLER);
        _claims.claim(BENEFICIARY_ONE, 0);
        assertEq(_gbx.balanceOf(BENEFICIARY_ONE), INITIAL_DAILY_EMISSION);

        vm.prank(GUARDIAN);
        vm.expectRevert(abi.encodeWithSelector(MiningPool.MiningPool__Unauthorized.selector, GUARDIAN));
        _pool.resumeContributions();

        vm.prank(address(_timelock));
        _pool.resumeContributions();
        assertFalse(_pool.contributionsPaused());

        vm.prank(PAYER_TWO);
        assertEq(_pool.contribute(BENEFICIARY_TWO, 1), 1);
    }

    function test_MiningClaimsSourceBindingIsInitializerOnlyValidatedAndOneTime() external {
        MiningClaims freshClaims = new MiningClaims(_gbx, address(this));
        SupplyMiningClaimsSourceMock source = new SupplyMiningClaimsSourceMock();

        vm.prank(PAYER_ONE);
        vm.expectRevert(abi.encodeWithSelector(MiningClaims.MiningClaims__Unauthorized.selector, PAYER_ONE));
        freshClaims.initializeSource(address(source));

        vm.expectRevert(MiningClaims.MiningClaims__ZeroAddress.selector);
        freshClaims.initializeSource(address(0));
        vm.expectRevert(MiningClaims.MiningClaims__ZeroAddress.selector);
        freshClaims.initializeSource(PAYER_ONE);

        freshClaims.initializeSource(address(source));
        assertEq(address(freshClaims.source()), address(source));

        vm.expectRevert(MiningClaims.MiningClaims__AlreadyInitialized.selector);
        freshClaims.initializeSource(address(source));
    }

    function test_ConstructorValidationAndZeroBeneficiaryClaimFailClosed() external {
        vm.expectRevert(MiningClaims.MiningClaims__ZeroAddress.selector);
        new MiningClaims(GBXToken(address(0)), address(this));
        vm.expectRevert(MiningClaims.MiningClaims__ZeroAddress.selector);
        new MiningClaims(GBXToken(PAYER_ONE), address(this));
        vm.expectRevert(MiningClaims.MiningClaims__ZeroAddress.selector);
        new MiningClaims(_gbx, address(0));

        vm.expectRevert(MiningClaims.MiningClaims__ZeroAddress.selector);
        _claims.claim(address(0), 0);

        vm.expectRevert(MiningPool.MiningPool__ZeroAddress.selector);
        new MiningPool(
            address(0),
            address(_vault),
            _voter,
            _gbx,
            _claims,
            address(_custodian),
            GUARDIAN,
            address(_timelock),
            address(this),
            TEAM
        );
        vm.expectRevert(MiningPool.MiningPool__InvalidConfiguration.selector);
        new MiningPool(
            PAYER_ONE,
            address(_vault),
            _voter,
            _gbx,
            _claims,
            address(_custodian),
            GUARDIAN,
            address(_timelock),
            address(this),
            TEAM
        );
    }

    function testFuzz_ProRataClaimsMatchIndependentMulDivModel(uint128 amountOne, uint128 amountTwo) external {
        uint256 first = bound(uint256(amountOne), 1, 1_000_000 ether);
        uint256 second = bound(uint256(amountTwo), 1, 1_000_000 ether);
        _startMining();
        vm.prank(PAYER_ONE);
        _pool.contribute(BENEFICIARY_ONE, first);
        vm.prank(PAYER_TWO);
        _pool.contribute(BENEFICIARY_TWO, second);
        vm.warp(_epochEnd(0));
        uint256 emission = _pool.settleCurrentEpoch();

        (uint256 claimOne,, bool settledOne) = _pool.claimData(0, BENEFICIARY_ONE);
        (uint256 claimTwo,, bool settledTwo) = _pool.claimData(0, BENEFICIARY_TWO);
        assertTrue(settledOne && settledTwo);
        assertEq(claimOne, first * emission / (first + second));
        assertEq(claimTwo, second * emission / (first + second));
        assertLe(claimOne + claimTwo, emission);
        assertLt(emission - claimOne - claimTwo, 2);
    }

    function testFuzz_TeamFeeAndVaultRevenueExactlyConserveEveryStandardTokenContribution(uint128 amountSeed)
        external
    {
        uint256 amount = bound(uint256(amountSeed), 1, 1_000_000 ether);
        _startMining();
        vm.prank(PAYER_ONE);
        _pool.contribute(BENEFICIARY_ONE, amount);
        vm.warp(_epochEnd(0));
        _pool.settleCurrentEpoch();

        uint256 expectedTeam = amount * _pool.TEAM_FEE_BPS() / _pool.BPS_DENOMINATOR();
        uint256 expectedVault = amount - expectedTeam;
        (,,, uint256 contributed, uint256 teamFee, uint256 vaultRevenue,,) = _pool.epochs(0);
        assertEq(contributed, amount);
        assertEq(teamFee, expectedTeam);
        assertEq(vaultRevenue, expectedVault);
        assertEq(teamFee + vaultRevenue, amount);
        assertEq(_usdg.balanceOf(TEAM), expectedTeam);
        assertEq(_usdg.balanceOf(address(_vault)), expectedVault);
        assertEq(_voter.notifiedRevenue(), expectedVault);
    }

    function test_RefundCancellationAndEpochInvalidationSelectorsAreAbsent() external {
        (bool refund,) = address(_pool).call(abi.encodeWithSignature("refund(uint256)", 0));
        (bool cancel,) = address(_pool).call(abi.encodeWithSignature("cancelContribution(uint256)", 0));
        (bool invalidate,) = address(_pool).call(abi.encodeWithSignature("invalidateEpoch(uint256)", 0));
        (bool withdraw,) = address(_pool).call(abi.encodeWithSignature("withdrawEscrow(address,uint256)", PAYER_ONE, 1));

        assertFalse(refund);
        assertFalse(cancel);
        assertFalse(invalidate);
        assertFalse(withdraw);
    }

    function _startMining() private {
        _custodian.setPositionInCustody(true);
        _pool.start();
    }

    function _fundAndApprove(address payer, uint256 amount) private {
        _usdg.mint(payer, amount);
        vm.prank(payer);
        _usdg.approve(address(_pool), type(uint256).max);
    }

    function _epochStart(uint256 epochId) private view returns (uint64 startTime) {
        (startTime,,,,,,,) = _pool.epochs(epochId);
    }

    function _epochEnd(uint256 epochId) private view returns (uint64 endTime) {
        (, endTime,,,,,,) = _pool.epochs(epochId);
    }
}
