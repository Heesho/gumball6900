// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { BribeFactory } from "../../src/core/BribeFactory.sol";
import { Fund } from "../../src/core/Fund.sol";
import { GBX } from "../../src/core/GBX.sol";
import { Mine } from "../../src/core/Mine.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { ResonanceRouter } from "../../src/core/ResonanceRouter.sol";
import { SignalGBX } from "../../src/core/SignalGBX.sol";
import { StrategyFactory } from "../../src/core/StrategyFactory.sol";
import { ProtocolFixture } from "./utils/ProtocolFixture.sol";
import { MockERC20 } from "./utils/Tokens.sol";

contract MineRouterIdentityHarness {
    IERC20 public immutable usdg;

    constructor(IERC20 usdg_) {
        usdg = usdg_;
    }
}

/// @title MineTest
/// @notice Covers fixed-slot handoffs, tenure-locked TPS, payment accounting, and cached pending emissions.
contract MineTest is ProtocolFixture {
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Mined(
        address indexed payer,
        address indexed miner,
        uint256 indexed index,
        uint256 epochId,
        address previousMiner,
        uint256 price,
        uint256 nextInitialPrice,
        uint256 tps,
        string message
    );
    event RevenueDeposited(
        uint256 indexed index, uint256 indexed epochId, address indexed resonanceRouter, uint256 amount
    );
    event ResonanceRouterUpdated(
        address indexed previousRouter, address indexed newRouter, address indexed newResonance
    );
    event GenesisLiquidityMinted(address indexed recipient, uint256 amount);

    function setUp() external {
        _deployProtocol();
    }

    function test_LaunchesWithSixteenEmptySlotsAndPermanentMiningAuthority() external view {
        assertEq(mine.SLOT_COUNT(), 16);
        assertEq(mine.PRICE_MULTIPLIER(), 2);
        assertEq(mine.MIN_INITIAL_PRICE(), 1e6);
        assertEq(mine.INITIAL_TPS(), 64 ether);
        assertEq(mine.HALVING_PERIOD(), 69 days);
        assertEq(mine.TAIL_TPS(), 1 ether);
        assertEq(mine.MAX_MESSAGE_BYTES(), 280);
        assertEq(mine.startTime(), DEPLOYED_AT);
        assertEq(mine.aggregateTps(), 0);
        assertEq(mine.storedPendingEmission(), 0);
        assertEq(mine.pendingUpdatedAt(), DEPLOYED_AT);
        assertEq(gbx.totalSupply(), 0);
        assertEq(gbx.minter(), address(mine));
        assertTrue(gbx.minterLocked());
        assertEq(mine.fund(), address(fund));
        assertEq(mine.resonanceRouter(), address(resonanceRouter));
        assertEq(mine.owner(), address(this));
        assertEq(mine.pendingOwner(), address(0));
        assertEq(mine.GENESIS_LIQUIDITY_GBX(), 1_000 ether);
        assertEq(mine.genesisAuthority(), address(0));
        assertFalse(mine.genesisLiquidityMinted());

        for (uint256 i; i < mine.SLOT_COUNT(); ++i) {
            Mine.Slot memory slot = mine.slot(i);
            assertEq(slot.epochId, 1);
            assertEq(slot.initialPrice, 1e6);
            assertEq(slot.miner, address(0));
            assertEq(slot.tps, 0);
        }
    }

    function test_ConstructorRejectsInvalidDependenciesAndDefersRouterTokenVerification() external {
        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(
            GBX(address(0)),
            IERC20(address(usdg)),
            address(fund),
            address(resonanceRouter),
            address(this),
            address(this)
        );

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(gbx, IERC20(address(0)), address(fund), address(resonanceRouter), address(this), address(this));

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(gbx, IERC20(address(usdg)), address(0), address(resonanceRouter), address(this), address(this));

        vm.expectRevert(Mine.ZeroAddress.selector);
        new Mine(gbx, IERC20(address(usdg)), address(fund), address(0), address(this), address(this));

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new Mine(gbx, IERC20(address(usdg)), address(fund), address(resonanceRouter), address(this), address(0));

        GBX wrongFundGBX = new GBX(address(this));
        Fund wrongFund = new Fund(wrongFundGBX);
        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidFund.selector, address(wrongFund)));
        new Mine(gbx, IERC20(address(usdg)), address(wrongFund), address(resonanceRouter), address(this), address(this));

        MineRouterIdentityHarness wrongRouter = new MineRouterIdentityHarness(IERC20(address(target)));
        Mine mismatchedMine =
            new Mine(gbx, IERC20(address(usdg)), address(fund), address(wrongRouter), address(0), address(this));
        assertEq(address(mismatchedMine.usdg()), address(usdg));
        assertEq(mismatchedMine.fund(), address(fund));
        assertEq(mismatchedMine.resonanceRouter(), address(wrongRouter));
        assertEq(address(wrongRouter.usdg()), address(target));
        assertEq(mismatchedMine.genesisAuthority(), address(0));
    }

    function test_OwnershipTransferRequiresPendingOwnerAcceptanceAndRenunciationClearsIt() external {
        mine.transferOwnership(ALICE);

        assertEq(mine.owner(), address(this));
        assertEq(mine.pendingOwner(), ALICE);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        mine.setResonanceRouter(address(target));

        vm.prank(BOB);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, BOB));
        mine.acceptOwnership();

        vm.prank(ALICE);
        mine.acceptOwnership();
        assertEq(mine.owner(), ALICE);
        assertEq(mine.pendingOwner(), address(0));

        vm.prank(ALICE);
        mine.transferOwnership(BOB);
        assertEq(mine.owner(), ALICE);
        assertEq(mine.pendingOwner(), BOB);

        vm.prank(ALICE);
        mine.transferOwnership(address(0));
        assertEq(mine.owner(), ALICE);
        assertEq(mine.pendingOwner(), address(0));

        vm.prank(ALICE);
        mine.transferOwnership(BOB);
        vm.prank(ALICE);
        mine.renounceOwnership();
        assertEq(mine.owner(), address(0));
        assertEq(mine.pendingOwner(), address(0));
    }

    function test_SetResonanceRouterIsOwnerOnlyAndRejectsIncompleteOrMismatchedGraphs() external {
        address originalRouter = address(resonanceRouter);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE));
        mine.setResonanceRouter(address(target));

        vm.expectRevert(abi.encodeWithSelector(Mine.ResonanceRouterUnchanged.selector, originalRouter));
        mine.setResonanceRouter(originalRouter);

        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidResonanceRouter.selector, address(0)));
        mine.setResonanceRouter(address(0));

        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidResonanceRouter.selector, ALICE));
        mine.setResonanceRouter(ALICE);

        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidResonanceRouter.selector, address(target)));
        mine.setResonanceRouter(address(target));

        ResonanceRouter wrongTokenRouter = new ResonanceRouter(IERC20(address(target)), address(resonance));
        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidResonanceRouter.selector, address(wrongTokenRouter)));
        mine.setResonanceRouter(address(wrongTokenRouter));

        ResonanceRouter nonReciprocalRouter = new ResonanceRouter(IERC20(address(usdg)), address(resonance));
        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidResonanceRouter.selector, address(nonReciprocalRouter)));
        mine.setResonanceRouter(address(nonReciprocalRouter));

        Fund wrongFund = new Fund(gbx);
        (, ResonanceRouter wrongFundRouter) =
            _deployReplacementRevenueGraph(IERC20(address(gbx)), address(wrongFund), IERC20(address(usdg)));
        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidResonanceRouter.selector, address(wrongFundRouter)));
        mine.setResonanceRouter(address(wrongFundRouter));

        GBX wrongGBX = new GBX(address(this));
        (, ResonanceRouter wrongGBXRouter) =
            _deployReplacementRevenueGraph(IERC20(address(wrongGBX)), address(fund), IERC20(address(usdg)));
        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidResonanceRouter.selector, address(wrongGBXRouter)));
        mine.setResonanceRouter(address(wrongGBXRouter));

        assertEq(mine.resonanceRouter(), originalRouter);
    }

    function test_SetResonanceRouterRejectsReplacementResonanceUSDGMismatch() external {
        address originalRouter = address(resonanceRouter);
        (Resonance replacementResonance, ResonanceRouter replacementRouter) =
            _deployReplacementRevenueGraph(IERC20(address(gbx)), address(fund), IERC20(address(usdg)));

        vm.mockCall(address(replacementResonance), abi.encodeWithSignature("usdg()"), abi.encode(address(target)));
        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidResonanceRouter.selector, address(replacementRouter)));
        mine.setResonanceRouter(address(replacementRouter));

        assertEq(mine.resonanceRouter(), originalRouter);
        vm.clearMockedCalls();
    }

    function test_SetResonanceRouterRejectsCrossedSignalGBXResonanceBinding() external {
        address originalRouter = address(resonanceRouter);
        SignalGBX crossedSignalGBX = new SignalGBX(IERC20(address(gbx)), address(this));
        BribeFactory replacementBribeFactory = new BribeFactory(address(this));
        StrategyFactory replacementStrategyFactory = new StrategyFactory(address(this));
        Resonance replacementResonance = new Resonance(
            IERC20(address(crossedSignalGBX)),
            IERC20(address(usdg)),
            address(fund),
            replacementBribeFactory,
            replacementStrategyFactory,
            address(this)
        );
        Resonance otherResonance = new Resonance(
            IERC20(address(crossedSignalGBX)),
            IERC20(address(usdg)),
            address(fund),
            replacementBribeFactory,
            replacementStrategyFactory,
            address(this)
        );
        crossedSignalGBX.setResonance(address(otherResonance));
        ResonanceRouter replacementRouter = new ResonanceRouter(IERC20(address(usdg)), address(replacementResonance));
        replacementResonance.setResonanceRouter(address(replacementRouter));

        assertEq(address(replacementResonance.signalGBX()), address(crossedSignalGBX));
        assertEq(crossedSignalGBX.resonance(), address(otherResonance));
        vm.expectRevert(abi.encodeWithSelector(Mine.InvalidResonanceRouter.selector, address(replacementRouter)));
        mine.setResonanceRouter(address(replacementRouter));

        assertEq(mine.resonanceRouter(), originalRouter);
    }

    function test_SetResonanceRouterRedirectsOnlyFutureRevenueAndPreservesOldGraphAndMinerClaims() external {
        uint256 firstPayment = _mine(ALICE, 0);
        uint256 oldRouterBalance = usdg.balanceOf(address(resonanceRouter));
        Mine.Slot memory slotBefore = mine.slot(0);
        uint256 totalMinedBefore = mine.totalMined();
        uint256 pendingBefore = mine.pendingEmission();

        (Resonance replacementResonance, ResonanceRouter replacementRouter) =
            _deployReplacementRevenueGraph(IERC20(address(gbx)), address(fund), IERC20(address(usdg)));

        vm.expectEmit(true, true, true, true, address(mine));
        emit ResonanceRouterUpdated(address(resonanceRouter), address(replacementRouter), address(replacementResonance));
        mine.setResonanceRouter(address(replacementRouter));

        Mine.Slot memory slotAfter = mine.slot(0);
        assertEq(mine.resonanceRouter(), address(replacementRouter));
        assertEq(usdg.balanceOf(address(resonanceRouter)), oldRouterBalance);
        assertEq(usdg.balanceOf(address(replacementRouter)), 0);
        assertEq(slotAfter.epochId, slotBefore.epochId);
        assertEq(slotAfter.initialPrice, slotBefore.initialPrice);
        assertEq(slotAfter.auctionStartedAt, slotBefore.auctionStartedAt);
        assertEq(slotAfter.lastAccruedAt, slotBefore.lastAccruedAt);
        assertEq(slotAfter.tps, slotBefore.tps);
        assertEq(slotAfter.miner, slotBefore.miner);
        assertEq(mine.totalMined(), totalMinedBefore);
        assertEq(mine.pendingEmission(), pendingBefore);
        assertEq(mine.totalClaimableMinerPayments(), 0);

        vm.warp(block.timestamp + 30 minutes);
        uint256 replacementPayment = _mine(BOB, 0);
        uint256 outgoingMinerClaim = replacementPayment * mine.PREVIOUS_MINER_BPS() / mine.BPS();
        uint256 redirectedRevenue = replacementPayment - outgoingMinerClaim;

        assertEq(firstPayment, oldRouterBalance);
        assertEq(usdg.balanceOf(address(resonanceRouter)), oldRouterBalance, "the old buffer is untouched");
        assertEq(usdg.balanceOf(address(replacementRouter)), redirectedRevenue);
        assertEq(mine.claimableMinerPayment(ALICE), outgoingMinerClaim);
        assertEq(mine.totalClaimableMinerPayments(), outgoingMinerClaim);
        assertEq(usdg.balanceOf(address(mine)), outgoingMinerClaim);
    }

    function test_MigrationDoesNotReadBrokenOldRouterAndOldSignalRewardExitRemainsUsable() external {
        _mine(ALICE, 0);
        _signalDefault(ALICE, 10 ether);

        uint256 rewardAmount = 7 ether;
        target.mint(address(this), rewardAmount);
        target.approve(address(targetBribe), rewardAmount);
        targetBribe.notifyReward(address(target), rewardAmount);

        (Resonance replacementResonance, ResonanceRouter replacementRouter) =
            _deployReplacementRevenueGraph(IERC20(address(gbx)), address(fund), IERC20(address(usdg)));
        (address replacementStrategy,,) = replacementResonance.addStrategy(IERC20(address(target)), defaultConfig());
        SignalGBX replacementSignalGBX = SignalGBX(address(replacementResonance.signalGBX()));

        vm.etch(address(resonanceRouter), hex"fe");
        mine.setResonanceRouter(address(replacementRouter));

        vm.warp(block.timestamp + 30 minutes);
        uint256 replacementPayment = _mine(BOB, 0);
        uint256 redirectedRevenue = replacementPayment - replacementPayment * mine.PREVIOUS_MINER_BPS() / mine.BPS();
        assertEq(usdg.balanceOf(address(replacementRouter)), redirectedRevenue);
        assertEq(replacementResonance.resonanceRouter(), address(replacementRouter));

        _mine(BOB, 1);
        uint256 routedRevenue = usdg.balanceOf(address(replacementRouter));
        assertEq(replacementRouter.route(), routedRevenue);

        uint256 rewardBefore = target.balanceOf(ALICE);
        vm.prank(ALICE);
        uint256 claimed = targetBribe.claimReward(ALICE, address(target));
        assertGt(claimed, 0);
        assertEq(target.balanceOf(ALICE), rewardBefore + claimed);

        uint256 gbxBeforeExit = gbx.balanceOf(ALICE);
        vm.prank(ALICE);
        signalGBX.removeSignal(address(targetStrategy), 10 ether);
        assertEq(signalGBX.balanceOf(ALICE), 0);
        assertEq(gbx.balanceOf(ALICE), gbxBeforeExit + 10 ether);

        vm.startPrank(ALICE);
        gbx.approve(address(replacementSignalGBX), 10 ether);
        replacementSignalGBX.addSignal(replacementStrategy, 10 ether);
        vm.stopPrank();
        assertEq(replacementSignalGBX.balanceOf(ALICE), 10 ether);
        assertEq(replacementResonance.totalSignalWeight(), 10 ether);

        vm.warp(block.timestamp + 1 days);
        assertGt(replacementResonance.distributeRevenue(replacementStrategy), 0);
        assertGt(usdg.balanceOf(replacementStrategy), 0);
    }

    function test_GenesisLiquidityMintRequiresBindingAuthorityAndContractRecipient() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        (GBX isolatedGBX, Mine isolatedMine, MineRouterIdentityHarness router) = _deployIsolatedMine(payment);

        vm.expectRevert(Mine.InvalidMinterBinding.selector);
        isolatedMine.mintGenesisLiquidity(address(router));

        isolatedGBX.setMinter(address(isolatedMine));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(Mine.UnauthorizedGenesisAuthority.selector, ALICE));
        isolatedMine.mintGenesisLiquidity(address(router));

        vm.expectRevert(Mine.ZeroAddress.selector);
        isolatedMine.mintGenesisLiquidity(address(0));

        vm.expectRevert(Mine.ZeroAddress.selector);
        isolatedMine.mintGenesisLiquidity(ALICE);
    }

    function test_GenesisLiquidityMintIsFixedOneTimeAndClearsAuthority() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        (GBX isolatedGBX, Mine isolatedMine, MineRouterIdentityHarness router) = _deployIsolatedMine(payment);
        isolatedGBX.setMinter(address(isolatedMine));
        uint256 fixedAmount = isolatedMine.GENESIS_LIQUIDITY_GBX();

        vm.expectEmit(true, false, false, true, address(isolatedMine));
        emit GenesisLiquidityMinted(address(router), fixedAmount);
        isolatedMine.mintGenesisLiquidity(address(router));

        assertTrue(isolatedMine.genesisLiquidityMinted());
        assertEq(isolatedMine.genesisAuthority(), address(0));
        assertEq(isolatedGBX.balanceOf(address(router)), fixedAmount);
        assertEq(isolatedGBX.totalSupply(), fixedAmount);
        assertEq(isolatedGBX.lifetimeMinted(), fixedAmount);
        assertEq(isolatedGBX.lifetimeBurned(), 0);
        assertEq(isolatedMine.totalMined(), 0);
        assertEq(isolatedMine.pendingEmission(), 0);
        assertEq(isolatedMine.effectiveTotalSupply(), fixedAmount);

        vm.expectRevert(Mine.GenesisLiquidityAlreadyMinted.selector);
        isolatedMine.mintGenesisLiquidity(address(router));
    }

    function test_ZeroGenesisAuthorityPermanentlyDisablesTheFixedMint() external {
        vm.expectRevert(abi.encodeWithSelector(Mine.UnauthorizedGenesisAuthority.selector, address(this)));
        mine.mintGenesisLiquidity(address(resonanceRouter));

        assertFalse(mine.genesisLiquidityMinted());
        assertEq(mine.genesisAuthority(), address(0));
        assertEq(gbx.lifetimeMinted(), 0);
    }

    function test_MineAndSlotViewsRejectInvalidInputs() external {
        Mine.Slot memory slot = mine.slot(0);

        vm.expectRevert(Mine.ZeroAddress.selector);
        mine.mine(address(0), 0, slot.epochId, block.timestamp, type(uint256).max, "");

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 16));
        mine.mine(ALICE, 16, slot.epochId, block.timestamp, type(uint256).max, "");

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 16));
        mine.currentPrice(16);

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 16));
        mine.slot(16);

        vm.expectRevert(abi.encodeWithSelector(Mine.IndexOutOfBounds.selector, 16));
        mine.pendingSlotEmission(16);

        assertEq(mine.pendingSlotEmission(0), 0, "an empty slot cannot accrue emission");
    }

    function test_ClaimRejectsZeroAndAccountsWithoutLiability() external {
        vm.expectRevert(Mine.ZeroAddress.selector);
        mine.claimMinerPayment(address(0));

        vm.expectRevert(abi.encodeWithSelector(Mine.NothingToClaim.selector, ALICE));
        mine.claimMinerPayment(ALICE);
    }

    function test_NextStartingPriceCapsAtTheAbsoluteMaximum() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        (GBX cappedGBX, Mine cappedMine,) = _deployIsolatedMine(payment);
        cappedGBX.setMinter(address(cappedMine));

        while (cappedMine.slot(0).initialPrice < cappedMine.MAX_INITIAL_PRICE()) {
            _mineIsolated(cappedMine, payment, ALICE, 0);
        }

        assertEq(cappedMine.slot(0).initialPrice, cappedMine.MAX_INITIAL_PRICE());

        uint256 claimBeforeMaximumFill = cappedMine.claimableMinerPayment(ALICE);
        _mineIsolated(cappedMine, payment, ALICE, 0);
        uint256 maximumSingleTenureClaim =
            Math.mulDiv(cappedMine.MAX_INITIAL_PRICE(), cappedMine.PREVIOUS_MINER_BPS(), cappedMine.BPS());
        assertEq(
            cappedMine.claimableMinerPayment(ALICE) - claimBeforeMaximumFill,
            maximumSingleTenureClaim,
            "the maximum-priced tenure credits its exact supported claim"
        );

        uint256 completeClaim = cappedMine.claimableMinerPayment(ALICE);
        cappedMine.claimMinerPayment(ALICE);
        assertEq(payment.balanceOf(ALICE), completeClaim, "the complete accumulated maximum-boundary claim is payable");
        assertEq(cappedMine.totalClaimableMinerPayments(), 0);
    }

    function test_GlobalRateEventuallyUsesTheFixedTail() external {
        vm.warp(mine.startTime() + 6 * mine.HALVING_PERIOD() - 1);
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() >> 5);

        vm.warp(mine.startTime() + 6 * mine.HALVING_PERIOD());
        assertEq(mine.nextGlobalTps(), mine.TAIL_TPS());

        _mine(ALICE, 0);
        uint256 tailSlotTps = mine.TAIL_TPS() / mine.SLOT_COUNT();
        assertEq(mine.slot(0).tps, tailSlotTps, "a tenure opened at the tail receives the tail slot rate");

        vm.warp(block.timestamp + 1 days);
        uint256 tailAccrual = tailSlotTps * 1 days;
        assertEq(mine.pendingSlotEmission(0), tailAccrual, "the assigned tail tenure accrues at the tail slot rate");

        _mine(BOB, 0);
        assertEq(gbx.balanceOf(ALICE), tailAccrual, "replacing the tail tenure settles its exact accrual");
        assertEq(mine.totalMined(), tailAccrual);
        assertEq(mine.slot(0).tps, tailSlotTps);

        vm.warp(mine.startTime() + 1_000 * mine.HALVING_PERIOD());
        assertEq(mine.nextGlobalTps(), mine.TAIL_TPS());
    }

    function test_GlobalRateHalvesByDeploymentTimeEvenWhenEverySlotIsEmpty() external {
        vm.warp(mine.startTime() + mine.HALVING_PERIOD() - 1);
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS());

        vm.warp(mine.startTime() + mine.HALVING_PERIOD());
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() / 2);

        vm.warp(mine.startTime() + 2 * mine.HALVING_PERIOD() - 1);
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() / 2);

        vm.warp(mine.startTime() + 2 * mine.HALVING_PERIOD());
        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() / 4);
        assertEq(mine.pendingEmission(), 0);
        assertEq(mine.totalMined(), 0);
    }

    function test_DeadlineCanProtectAQuotedTpsAcrossATimeBoundary() external {
        Mine.Slot memory slot = mine.slot(0);
        uint256 boundary = mine.startTime() + mine.HALVING_PERIOD();

        vm.warp(boundary);
        vm.expectRevert(abi.encodeWithSelector(Mine.DeadlinePassed.selector, boundary - 1));
        mine.mine(ALICE, 0, slot.epochId, boundary - 1, type(uint256).max, "");

        assertEq(mine.nextGlobalTps(), mine.INITIAL_TPS() / 2);
        assertEq(mine.slot(0).miner, address(0));
    }

    function test_FirstMinerDepositsCompletePaymentAndReceivesOneSixteenthGlobalTps() external {
        Mine.Slot memory emptySlot = mine.slot(0);
        uint256 paid = mine.currentPrice(0);
        usdg.mint(ALICE, paid);

        vm.startPrank(ALICE);
        usdg.approve(address(mine), paid);
        vm.expectEmit(true, true, false, true, address(usdg));
        emit Transfer(ALICE, address(mine), paid);
        vm.expectEmit(true, true, false, true, address(usdg));
        emit Transfer(address(mine), address(resonanceRouter), paid);
        vm.expectEmit(true, true, false, true, address(mine));
        emit RevenueDeposited(0, 1, address(resonanceRouter), 1e6);
        mine.mine(ALICE, 0, emptySlot.epochId, block.timestamp, paid, "");
        vm.stopPrank();

        assertEq(paid, 1e6);
        assertEq(mine.claimableMinerPayment(ALICE), 0);
        assertEq(mine.totalClaimableMinerPayments(), 0);
        assertEq(usdg.balanceOf(address(mine)), 0);
        assertEq(usdg.balanceOf(address(resonanceRouter)), paid);
        assertEq(usdg.balanceOf(address(resonance)), 0);
        assertEq(resonance.remainingRevenue(), 0);

        Mine.Slot memory slot = mine.slot(0);
        assertEq(slot.miner, ALICE);
        assertEq(slot.epochId, 2);
        assertEq(slot.initialPrice, 2e6);
        assertEq(slot.tps, 4 ether);
        assertEq(mine.aggregateTps(), 4 ether);
    }

    function test_ReplacementAfterThirtyMinutesSettlesOnlyThatSlotAndSplitsEightyTwenty() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 30 minutes);

        uint256 paid = _mine(BOB, 0);

        assertEq(paid, 1e6);
        assertEq(gbx.balanceOf(ALICE), 7_200 ether);
        assertEq(mine.totalMined(), 7_200 ether);
        assertEq(mine.pendingEmission(), 0);
        assertEq(mine.claimableMinerPayment(ALICE), 800_000);
        assertEq(mine.totalClaimableMinerPayments(), 800_000);
        assertEq(usdg.balanceOf(address(mine)), 800_000);
        assertEq(usdg.balanceOf(address(resonanceRouter)), 1_200_000);
        assertEq(usdg.balanceOf(address(resonance)), 0);
    }

    function test_StaggeredSlotsSettleIndependentlyWhileCachedTotalRemainsExact() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 100);
        _mine(BOB, 1);
        vm.warp(block.timestamp + 200);

        assertEq(mine.pendingSlotEmission(0), 1_200 ether);
        assertEq(mine.pendingSlotEmission(1), 800 ether);
        assertEq(mine.pendingEmission(), 2_000 ether);

        _mine(CAROL, 1);

        assertEq(gbx.balanceOf(BOB), 800 ether);
        assertEq(gbx.balanceOf(ALICE), 0);
        assertEq(mine.totalMined(), 800 ether);
        assertEq(mine.pendingEmission(), 1_200 ether);
        assertEq(mine.storedPendingEmission(), 1_200 ether);
        assertEq(mine.pendingSlotEmission(0), 1_200 ether);
        assertEq(mine.pendingSlotEmission(1), 0);
    }

    function test_ClaimIsPermissionlessButAlwaysPaysTheDisplacedMiner() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 30 minutes);
        _mine(BOB, 0);

        vm.prank(CAROL);
        mine.claimMinerPayment(ALICE);

        assertEq(usdg.balanceOf(ALICE), 800_000);
        assertEq(usdg.balanceOf(CAROL), 0);
        assertEq(mine.claimableMinerPayment(ALICE), 0);
        assertEq(mine.totalClaimableMinerPayments(), 0);
    }

    function test_ZeroPriceSelfReplacementRealizesAccrualAndRestartsAtOneDollar() external {
        _mine(ALICE, 0);
        vm.warp(block.timestamp + 1 hours);

        assertEq(mine.currentPrice(0), 0);
        uint256 paid = _mine(ALICE, 0);

        assertEq(paid, 0);
        assertEq(gbx.balanceOf(ALICE), 14_400 ether);
        assertEq(mine.claimableMinerPayment(ALICE), 0);
        assertEq(mine.slot(0).initialPrice, 1e6);
        assertEq(mine.slot(0).miner, ALICE);
    }

    function test_ExpectedEpochDeadlineAndMaximumPriceProtectReplacement() external {
        Mine.Slot memory slot = mine.slot(0);

        vm.expectRevert(abi.encodeWithSelector(Mine.EpochIdMismatch.selector, slot.epochId + 1, slot.epochId));
        mine.mine(ALICE, 0, slot.epochId + 1, block.timestamp, type(uint256).max, "");

        vm.expectRevert(abi.encodeWithSelector(Mine.DeadlinePassed.selector, block.timestamp - 1));
        mine.mine(ALICE, 0, slot.epochId, block.timestamp - 1, type(uint256).max, "");

        vm.expectRevert(abi.encodeWithSelector(Mine.MaximumPaymentExceeded.selector, 1e6, 1e6 - 1));
        mine.mine(ALICE, 0, slot.epochId, block.timestamp, 1e6 - 1, "");
    }

    function test_MineEmitsTheBoundedMessageWithoutStoringIt() external {
        Mine.Slot memory slot = mine.slot(0);
        uint256 paid = mine.currentPrice(0);
        usdg.mint(ALICE, paid);

        vm.startPrank(ALICE);
        usdg.approve(address(mine), paid);
        vm.expectEmit(true, true, true, true, address(mine));
        emit Mined(ALICE, BOB, 0, slot.epochId, address(0), paid, 2e6, 4 ether, "hello from the mine");
        mine.mine(BOB, 0, slot.epochId, block.timestamp, paid, "hello from the mine");
        vm.stopPrank();

        assertEq(mine.slot(0).miner, BOB);
    }

    function test_MineMessageLimitCountsRawBytes() external {
        Mine.Slot memory slot = mine.slot(0);
        string memory tooLong = string(new bytes(281));

        vm.expectRevert(abi.encodeWithSelector(Mine.MessageTooLong.selector, 281));
        mine.mine(ALICE, 0, slot.epochId, block.timestamp, type(uint256).max, tooLong);

        uint256 paid = mine.currentPrice(0);
        usdg.mint(ALICE, paid);
        vm.startPrank(ALICE);
        usdg.approve(address(mine), paid);
        mine.mine(ALICE, 0, slot.epochId, block.timestamp, paid, string(new bytes(280)));
        vm.stopPrank();

        assertEq(mine.slot(0).miner, ALICE);
    }

    function test_EffectiveSupplyIncludesPendingEmissionWithoutMintingOrChangingSlots() external {
        _mine(ALICE, 0);
        Mine.Slot memory beforeSlot = mine.slot(0);
        uint256 supplyBefore = gbx.totalSupply();
        vm.warp(block.timestamp + 1_000);

        assertEq(mine.pendingEmission(), 4_000 ether);
        assertEq(mine.effectiveTotalSupply(), supplyBefore + 4_000 ether);
        assertEq(gbx.totalSupply(), supplyBefore);
        assertEq(mine.slot(0).lastAccruedAt, beforeSlot.lastAccruedAt);
    }

    function test_RedemptionUsesEffectiveSupplyWithoutSettlingAnyMiner() external {
        _mine(ALICE, 0);
        target.mint(address(fund), 4_000 ether);
        uint256 redeemAmount = 1_000_000 ether;
        _mintTestGBX(GENESIS, redeemAmount);
        vm.prank(GENESIS);
        gbx.approve(address(fund), redeemAmount);
        vm.warp(block.timestamp + 1_000);

        uint256 pending = 4_000 ether;
        uint256 supplyBefore = gbx.totalSupply();
        uint256 expectedPayout = Math.mulDiv(4_000 ether, redeemAmount, supplyBefore + pending);
        vm.prank(GENESIS);
        fund.redeem(redeemAmount, GENESIS, _addresses(address(target)));

        assertEq(target.balanceOf(GENESIS), expectedPayout);
        assertEq(gbx.totalSupply(), supplyBefore - redeemAmount);
        assertEq(gbx.balanceOf(ALICE), 0);
        assertEq(mine.totalMined(), 0);
        assertEq(mine.pendingEmission(), pending);
        assertEq(mine.pendingSlotEmission(0), pending);
    }

    function test_TimeBasedHalvingNeverRepricesAnIncumbent() external {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        (GBX halvingGBX, Mine halvingMine,) = _deployIsolatedMine(payment);
        halvingGBX.setMinter(address(halvingMine));

        _mineIsolated(halvingMine, payment, ALICE, 0);
        uint256 incumbentTps = halvingMine.INITIAL_TPS() / halvingMine.SLOT_COUNT();
        assertEq(halvingMine.slot(0).tps, incumbentTps);
        vm.warp(halvingMine.startTime() + halvingMine.HALVING_PERIOD());

        uint256 incumbentAccrual = halvingMine.HALVING_PERIOD() * incumbentTps;

        assertEq(halvingMine.totalMined(), 0, "settlement timing must not control the halving");
        assertEq(halvingMine.pendingEmission(), incumbentAccrual);
        assertEq(halvingMine.nextGlobalTps(), halvingMine.INITIAL_TPS() / 2);

        _mineIsolated(halvingMine, payment, BOB, 1);
        uint256 halvedSlotTps = halvingMine.INITIAL_TPS() / 2 / halvingMine.SLOT_COUNT();
        assertEq(halvingMine.slot(0).tps, incumbentTps, "occupied tenure remains locked");
        assertEq(halvingMine.slot(1).tps, halvedSlotTps, "only the new tenure gets the halved rate");
        assertEq(halvingMine.aggregateTps(), incumbentTps + halvedSlotTps);
        assertEq(halvingMine.pendingEmission(), incumbentAccrual);
        assertEq(halvingMine.totalMined(), 0);

        _mineIsolated(halvingMine, payment, CAROL, 0);
        assertEq(halvingGBX.balanceOf(ALICE), incumbentAccrual);
        assertEq(halvingMine.totalMined(), incumbentAccrual);
        assertEq(halvingMine.pendingEmission(), 0);
        assertEq(halvingMine.slot(0).tps, halvedSlotTps);
        assertEq(halvingMine.slot(1).tps, halvedSlotTps);
    }

    function testFuzz_CachedAccumulatorMatchesNaiveSlotsAndIndependentEconomicModel(uint256 seed, uint8 rawSteps)
        external
    {
        MockERC20 payment = new MockERC20("Payment", "PAY", 6);
        (GBX modelGBX, Mine modelMine,) = _deployIsolatedMine(payment);
        modelGBX.setMinter(address(modelMine));

        uint256 steps = bound(uint256(rawSteps), 16, 64);
        uint256 modelEconomicEmission;
        uint256 modelAggregateTps;
        uint256[16] memory modelSlotTps;

        for (uint256 step; step < steps; ++step) {
            seed = uint256(keccak256(abi.encode(seed, step)));
            uint256 elapsed = (seed >> 8) % (modelMine.HALVING_PERIOD() + 1);
            vm.warp(block.timestamp + elapsed);
            modelEconomicEmission += elapsed * modelAggregateTps;

            _assertMineAccounting(modelMine, modelGBX, modelEconomicEmission, modelAggregateTps);

            uint256 index = seed % 16;
            address miner = _modelMiner(seed >> 32);
            _mineIsolated(modelMine, payment, miner, index);

            uint256 elapsedHalvings = (block.timestamp - modelMine.startTime()) / modelMine.HALVING_PERIOD();
            uint256 expectedGlobalTps = modelMine.INITIAL_TPS() >> elapsedHalvings;
            if (expectedGlobalTps < modelMine.TAIL_TPS()) expectedGlobalTps = modelMine.TAIL_TPS();
            uint256 newTps = expectedGlobalTps / modelMine.SLOT_COUNT();
            assertEq(modelMine.slot(index).tps, newTps, "assigned TPS diverged from independent time model");
            modelAggregateTps = modelAggregateTps - modelSlotTps[index] + newTps;
            modelSlotTps[index] = newTps;

            _assertMineAccounting(modelMine, modelGBX, modelEconomicEmission, modelAggregateTps);
        }
    }

    function testFuzz_PaymentConservation(uint96 rawPriceTime) external {
        _mine(ALICE, 0);
        uint256 elapsed = bound(uint256(rawPriceTime), 0, 1 hours - 1);
        vm.warp(block.timestamp + elapsed);

        uint256 price = mine.currentPrice(0);
        _mine(BOB, 0);

        assertEq(
            mine.claimableMinerPayment(ALICE) + usdg.balanceOf(address(resonanceRouter))
                + usdg.balanceOf(address(resonance)),
            1e6 + price
        );
        assertEq(mine.claimableMinerPayment(ALICE), price * 8_000 / 10_000);
    }

    function _assertMineAccounting(
        Mine modelMine,
        GBX modelGBX,
        uint256 modelEconomicEmission,
        uint256 modelAggregateTps
    ) private view {
        uint256 naivePending;
        uint256 naiveAggregate;
        for (uint256 i; i < 16; ++i) {
            Mine.Slot memory slot = modelMine.slot(i);
            naivePending += modelMine.pendingSlotEmission(i);
            naiveAggregate += slot.tps;
            if (slot.miner == address(0)) assertEq(slot.tps, 0);
        }

        assertEq(modelMine.pendingEmission(), naivePending, "cached pending diverged from naive slot sum");
        assertEq(modelMine.aggregateTps(), naiveAggregate, "cached TPS diverged from naive slot sum");
        assertEq(modelMine.aggregateTps(), modelAggregateTps, "cached TPS diverged from independent model");
        assertEq(
            modelMine.totalMined() + modelMine.pendingEmission(),
            modelEconomicEmission,
            "minted plus pending diverged from exact elapsed emission"
        );
        assertEq(modelGBX.totalSupply(), modelMine.totalMined());
        assertEq(modelMine.effectiveTotalSupply(), modelGBX.totalSupply() + naivePending);
    }

    function _modelMiner(uint256 seed) private pure returns (address) {
        uint256 choice = seed % 4;
        if (choice == 0) return ALICE;
        if (choice == 1) return BOB;
        if (choice == 2) return CAROL;
        return DAVE;
    }

    function _mine(address account, uint256 index) private returns (uint256 paid) {
        Mine.Slot memory slot = mine.slot(index);
        paid = mine.currentPrice(index);
        if (paid != 0) usdg.mint(account, paid);

        vm.startPrank(account);
        if (paid != 0) usdg.approve(address(mine), paid);
        mine.mine(account, index, slot.epochId, block.timestamp, paid, "");
        vm.stopPrank();
    }

    function _deployReplacementRevenueGraph(IERC20 signalUnderlying, address graphFund, IERC20 graphUSDG)
        private
        returns (Resonance replacementResonance, ResonanceRouter replacementRouter)
    {
        SignalGBX replacementSignalGBX = new SignalGBX(signalUnderlying, address(this));
        BribeFactory replacementBribeFactory = new BribeFactory(address(this));
        StrategyFactory replacementStrategyFactory = new StrategyFactory(address(this));
        replacementResonance = new Resonance(
            IERC20(address(replacementSignalGBX)),
            graphUSDG,
            graphFund,
            replacementBribeFactory,
            replacementStrategyFactory,
            address(this)
        );

        replacementBribeFactory.setResonance(address(replacementResonance));
        replacementStrategyFactory.setResonance(address(replacementResonance));
        replacementSignalGBX.setResonance(address(replacementResonance));
        replacementRouter = new ResonanceRouter(graphUSDG, address(replacementResonance));
        replacementResonance.setResonanceRouter(address(replacementRouter));
    }

    function _deployIsolatedMine(MockERC20 payment)
        private
        returns (GBX isolatedGBX, Mine isolatedMine, MineRouterIdentityHarness router)
    {
        isolatedGBX = new GBX(address(this));
        router = new MineRouterIdentityHarness(IERC20(address(payment)));
        Fund isolatedFund = new Fund(isolatedGBX);
        isolatedMine = new Mine(
            isolatedGBX, IERC20(address(payment)), address(isolatedFund), address(router), address(this), address(this)
        );
    }

    function _mineIsolated(Mine isolatedMine, MockERC20 payment, address account, uint256 index)
        private
        returns (uint256 paid)
    {
        Mine.Slot memory slot = isolatedMine.slot(index);
        paid = isolatedMine.currentPrice(index);
        if (paid != 0) payment.mint(account, paid);

        vm.startPrank(account);
        if (paid != 0) payment.approve(address(isolatedMine), paid);
        isolatedMine.mine(account, index, slot.epochId, block.timestamp, paid, "");
        vm.stopPrank();
    }
}
