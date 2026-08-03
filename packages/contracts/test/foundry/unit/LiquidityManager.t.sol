// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";

import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { SqrtPriceMath } from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";

import { IEligibilityModule } from "../../../src/interfaces/IEligibilityModule.sol";
import { GBXToken } from "../../../src/token/GBXToken.sol";
import { GenesisLiquidityCalculator } from "../../../src/liquidity/GenesisLiquidityCalculator.sol";
import { LiquidityManager } from "../../../src/liquidity/LiquidityManager.sol";
import { GenesisPriceMath } from "../../../src/libraries/GenesisPriceMath.sol";
import { AllocationVoter } from "../../../src/signal/AllocationVoter.sol";
import { GBXTokenMinterMock } from "../mocks/GBXTokenMinterMock.sol";
import { AdversarialToken } from "../mocks/AdversarialTokenMocks.sol";
import {
    EmptyLaunchGuardHookMock,
    GenesisBootstrapCallerMock,
    LiquidityAllocationVoterMock,
    LiquidityPoolManagerMock,
    Permit2Mock,
    PositionManagerMock
} from "../mocks/LiquidityManagerMocks.sol";
import { GenesisPriceTestMath } from "../mocks/GenesisPriceTestMath.sol";

contract LiquidityManagerTest is Test {
    uint256 private constant COMMUNITY_USDG = 40_000_000 ether;
    uint256 private constant GENESIS_LP_GBX = 20_000_000 ether;
    address private constant GUARDIAN = address(0x6911);
    address private constant OUTSIDER = address(0xBAD);
    bytes32 private constant MIGRATION_STARTED_SIGNATURE =
        keccak256("LiquidityManager__MigrationStarted(bytes32,bytes32,uint256,uint256,uint256)");
    bytes32 private constant MIGRATION_BEFORE_SIGNATURE =
        keccak256("LiquidityManager__MigrationPositionBefore(bytes32,uint256,int24,int24,uint128,uint128,uint128)");
    bytes32 private constant MIGRATION_AFTER_SIGNATURE =
        keccak256("LiquidityManager__MigrationPositionAfter(bytes32,uint256,int24,int24,uint128,uint128,uint128)");
    bytes32 private constant MIGRATION_COMPLETED_SIGNATURE =
        keccak256("LiquidityManager__MigrationCompleted(bytes32,bytes32,uint256[],uint256[],uint256,uint256)");

    GBXToken private gbx;
    AdversarialToken private usdG;
    GBXTokenMinterMock private minter;
    Permit2Mock private permit2;
    PositionManagerMock private positionManager;
    LiquidityPoolManagerMock private poolManager;
    LiquidityAllocationVoterMock private voter;
    GenesisBootstrapCallerMock private genesis;
    EmptyLaunchGuardHookMock private hook;
    GenesisLiquidityCalculator private calculator;
    LiquidityManager private manager;
    address private vault = address(0xB011);

    function setUp() public {
        minter = new GBXTokenMinterMock();
        gbx = new GBXToken(address(this), IEligibilityModule(address(0)));
        gbx.initializeEmissionController(address(minter));
        usdG = new AdversarialToken("Global Dollar", "USDG", 18);
        permit2 = new Permit2Mock();
        positionManager = new PositionManagerMock(gbx, usdG, permit2);
        poolManager = new LiquidityPoolManagerMock();
        voter = new LiquidityAllocationVoterMock();
        genesis = new GenesisBootstrapCallerMock();
        hook = new EmptyLaunchGuardHookMock();
        calculator = new GenesisLiquidityCalculator();

        manager = new LiquidityManager(_dependencies(), _validLadder());
        minter.mint(gbx, address(manager), GENESIS_LP_GBX);
    }

    function test_ConstructorRejectsInvalidLadderSpacingAllocationsAndDeltas() public {
        LiquidityManager.LadderConfig memory ladder = _validLadder();
        ladder.tickSpacing = 0;
        vm.expectRevert(LiquidityManager.LiquidityManager__InvalidRange.selector);
        new LiquidityManager(_dependencies(), ladder);

        ladder = _validLadder();
        ladder.tickSpacing = -60;
        vm.expectRevert(LiquidityManager.LiquidityManager__InvalidRange.selector);
        new LiquidityManager(_dependencies(), ladder);

        ladder = _validLadder();
        ladder.allocationBps[0] = 0;
        vm.expectRevert(LiquidityManager.LiquidityManager__InvalidRange.selector);
        new LiquidityManager(_dependencies(), ladder);

        ladder = _validLadder();
        ladder.cumulativeTickDeltas[1] = ladder.cumulativeTickDeltas[0];
        vm.expectRevert(LiquidityManager.LiquidityManager__InvalidRange.selector);
        new LiquidityManager(_dependencies(), ladder);

        ladder = _validLadder();
        ladder.cumulativeTickDeltas[0] += 1;
        vm.expectRevert(LiquidityManager.LiquidityManager__InvalidRange.selector);
        new LiquidityManager(_dependencies(), ladder);

        ladder = _validLadder();
        ladder.allocationBps[3] -= 1;
        vm.expectRevert(LiquidityManager.LiquidityManager__InvalidAllocation.selector);
        new LiquidityManager(_dependencies(), ladder);
    }

    function test_AtomicallyInitializesCanonicalPoolAndConservesTwentyMillionGBX() public {
        uint160 sqrtPriceX96 = genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint256 principal = manager.genesisLiquidityPrincipal();
        uint256 residual = manager.genesisLiquidityResidual();

        assertTrue(manager.genesisSeeded());
        assertTrue(poolManager.initialized());
        assertEq(poolManager.initializer(), address(manager));
        assertEq(poolManager.initializedSqrtPriceX96(), sqrtPriceX96);
        assertEq(principal + residual, GENESIS_LP_GBX);
        assertEq(gbx.balanceOf(address(manager)), residual);
        assertEq(gbx.balanceOf(address(positionManager)), principal);
        assertEq(permit2.approvedOwner(), address(manager));
        assertEq(permit2.approvedToken(), address(gbx));
        assertEq(permit2.approvedSpender(), address(positionManager));
        assertEq(permit2.approvedAmount(), 0);
        assertEq(uint256(permit2.approvedExpiration()), block.timestamp);
        assertEq(gbx.allowance(address(manager), address(permit2)), 0);
        assertEq(positionManager.nextTokenId(), 6_904);
        assertEq(manager.activePositionCount(), manager.POSITION_COUNT());
    }

    function test_InvalidSDKWitnessDoesNotConsumeGenesisAndCorrectWitnessCanRetry() public {
        uint160 correct =
            GenesisPriceTestMath.sqrtPriceX96(address(gbx), address(usdG), COMMUNITY_USDG, 80_000_000 ether);
        uint160 wrong = correct + 1;
        vm.expectRevert(
            abi.encodeWithSelector(GenesisPriceMath.GenesisPriceMath__PriceDoesNotMatchAmounts.selector, wrong)
        );
        genesis.initializeAndSeedWithPrice(manager, COMMUNITY_USDG, wrong);

        assertFalse(manager.genesisSeeded());
        assertFalse(poolManager.initialized());
        assertEq(gbx.balanceOf(address(manager)), GENESIS_LP_GBX);

        assertEq(genesis.initializeAndSeedWithPrice(manager, COMMUNITY_USDG, correct), correct);
        assertTrue(manager.genesisSeeded());
        assertTrue(poolManager.initialized());
    }

    function test_CreatesFourOrderedOneSidedPositionsOwnedByManager() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        bool gbxIsToken0 = address(gbx) < address(usdG);
        uint256[4] memory expectedAllocations =
            [uint256(10_000_000 ether), 6_000_000 ether, 3_000_000 ether, 1_000_000 ether];
        uint256 totalPrincipal;

        int24 previousLower = type(int24).min;
        int24 previousUpper = type(int24).min;
        for (uint256 index; index < 4; ++index) {
            (int24 lower, int24 upper, uint256 principal) =
                _assertGenesisPosition(index, gbxIsToken0, expectedAllocations[index]);
            assertGe(lower, previousLower);
            assertGe(upper, previousUpper);
            previousLower = lower;
            previousUpper = upper;
            totalPrincipal += principal;
        }
        assertEq(totalPrincipal, manager.genesisLiquidityPrincipal());
        assertEq(totalPrincipal + manager.genesisLiquidityResidual(), GENESIS_LP_GBX);
    }

    function test_AlignedToken0GenesisTickAdvancesWhenPriceIsStrictlyInsideTick() public {
        assertTrue(address(gbx) < address(usdG));
        uint256 alignedTickReproductionUSDG = 79_716_728_409_744;

        uint160 sqrtPriceX96 = genesis.initializeAndSeed(manager, alignedTickReproductionUSDG);
        PositionManagerMock.CapturedMint memory first = positionManager.capturedMint(0);

        assertEq(manager.genesisTick(), -276_360);
        assertGt(sqrtPriceX96, TickMath.getSqrtPriceAtTick(-276_360));
        assertEq(first.tickLower, -276_300);
        assertGe(TickMath.getSqrtPriceAtTick(first.tickLower), sqrtPriceX96);
        assertEq(first.amount1Max, 0);
    }

    function test_ExactAlignedToken0GenesisPriceKeepsSafeBoundary() public {
        assertTrue(address(gbx) < address(usdG));

        uint160 sqrtPriceX96 = genesis.initializeAndSeed(manager, 80_000_000 ether);
        PositionManagerMock.CapturedMint memory first = positionManager.capturedMint(0);

        assertEq(sqrtPriceX96, uint160(1 << 96));
        assertEq(manager.genesisTick(), 0);
        assertEq(first.tickLower, 0);
        assertEq(TickMath.getSqrtPriceAtTick(first.tickLower), sqrtPriceX96);
        assertEq(first.amount1Max, 0);
    }

    function test_InitialRawPriceAccountsForCurrencyOrdering() public {
        uint160 actual = genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint160 expected =
            GenesisPriceTestMath.sqrtPriceX96(address(gbx), address(usdG), COMMUNITY_USDG, 80_000_000 ether);
        assertEq(actual, expected);
    }

    function test_CollectFeesBurnsGBXAndRoutesUSDGOnlyToVault() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint256 genesisResidual = manager.genesisLiquidityResidual();
        uint256 gbxFees = 50 ether;
        uint256 usdGFees = 125 ether;
        minter.mint(gbx, address(positionManager), gbxFees);
        usdG.mint(address(positionManager), usdGFees);
        positionManager.setPendingFees(gbxFees, usdGFees);
        uint256 supplyBefore = gbx.totalSupply();

        (uint256 gbxBurned, uint256 usdGToVault) = manager.collectFees(6_900);

        assertEq(gbxBurned, gbxFees);
        assertEq(usdGToVault, usdGFees);
        assertEq(gbx.totalSupply(), supplyBefore - gbxFees);
        assertEq(gbx.cumulativeBurned(), gbxFees);
        assertEq(usdG.balanceOf(vault), usdGFees);
        assertEq(voter.notifiedAmount(), usdGFees);
        assertEq(uint8(voter.notifiedSource()), uint8(AllocationVoter.RevenueSource.LiquidityManager));
        assertEq(voter.notifier(), address(manager));
        assertEq(gbx.balanceOf(address(manager)), genesisResidual);
        assertEq(usdG.balanceOf(address(manager)), 0);
    }

    function test_CollectFeesNotifiesOnlyObservedVaultReceiptDespiteTransferFeesAndDonation() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint256 donation = 37 ether;
        uint256 usdGFees = 100 ether;
        usdG.mint(vault, donation);
        usdG.mint(address(positionManager), usdGFees);
        usdG.setFeeBps(1_000);
        positionManager.setPendingFees(0, usdGFees);

        uint256 vaultBalanceBefore = usdG.balanceOf(vault);
        (, uint256 usdGToVault) = manager.collectFees(6_900);
        uint256 vaultReceived = usdG.balanceOf(vault) - vaultBalanceBefore;

        assertEq(vaultReceived, 81 ether);
        assertEq(usdGToVault, vaultReceived);
        assertEq(voter.notifiedAmount(), vaultReceived);
        assertEq(usdG.balanceOf(vault), donation + vaultReceived);
        assertEq(usdG.balanceOf(address(manager)), 0);
    }

    function test_RejectsUnauthorizedOrRepeatedGenesisAndUnknownPosition() public {
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.LiquidityManager__NotGenesisBootstrap.selector, address(this))
        );
        manager.initializeAndSeed(COMMUNITY_USDG, 0);

        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        vm.expectRevert(LiquidityManager.LiquidityManager__AlreadySeeded.selector);
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);

        vm.expectRevert(abi.encodeWithSelector(LiquidityManager.LiquidityManager__UnknownPosition.selector, 1));
        manager.collectFees(1);
    }

    function test_RejectsUnexpectedGenesisBalanceRatherThanMisclassifyingDonations() public {
        minter.mint(gbx, address(manager), 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityManager.LiquidityManager__GenesisBalanceMismatch.selector, GENESIS_LP_GBX, GENESIS_LP_GBX + 1
            )
        );
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
    }

    function test_PermissionlessCompletedRangeSweepRoutesUSDGAndBurnsGBXDust() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint256 genesisResidual = manager.genesisLiquidityResidual();
        (int24 tickLower, int24 tickUpper,,,) = _position(6_900);
        bool gbxIsToken0 = address(gbx) < address(usdG);
        poolManager.setCurrentTick(gbxIsToken0 ? tickUpper : tickLower);

        uint256 gbxDust = 2 ether;
        uint256 usdGPrincipalAndFees = 9_500_000 ether;
        minter.mint(gbx, address(positionManager), gbxDust);
        usdG.mint(address(positionManager), usdGPrincipalAndFees);
        positionManager.setPendingFees(gbxDust, usdGPrincipalAndFees);
        uint256 supplyBefore = gbx.totalSupply();

        vm.prank(address(0xCA11));
        (uint256 burned, uint256 routed) = manager.sweepCompletedRange(6_900);

        assertEq(burned, gbxDust);
        assertEq(routed, usdGPrincipalAndFees);
        assertEq(gbx.totalSupply(), supplyBefore - gbxDust);
        assertEq(usdG.balanceOf(vault), usdGPrincipalAndFees);
        assertEq(voter.notifiedAmount(), usdGPrincipalAndFees);
        assertEq(gbx.balanceOf(address(manager)), genesisResidual);
        (,,,, bool exists) = _position(6_900);
        assertFalse(exists);
        assertEq(manager.activePositionCount(), manager.POSITION_COUNT() - 1);

        vm.expectRevert(abi.encodeWithSelector(LiquidityManager.LiquidityManager__UnknownPosition.selector, 6_900));
        manager.sweepCompletedRange(6_900);
    }

    function test_CompletedRangeSweepReturnsAndNotifiesOnlyObservedVaultReceipt() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        (int24 tickLower, int24 tickUpper,,,) = _position(6_900);
        poolManager.setCurrentTick(address(gbx) < address(usdG) ? tickUpper : tickLower);

        uint256 usdGPrincipalAndFees = 100 ether;
        usdG.mint(address(positionManager), usdGPrincipalAndFees);
        usdG.setFeeBps(1_000);
        positionManager.setPendingFees(0, usdGPrincipalAndFees);

        uint256 vaultBalanceBefore = usdG.balanceOf(vault);
        (, uint256 routed) = manager.sweepCompletedRange(6_900);
        uint256 vaultReceived = usdG.balanceOf(vault) - vaultBalanceBefore;

        assertEq(vaultReceived, 81 ether);
        assertEq(routed, vaultReceived);
        assertEq(voter.notifiedAmount(), vaultReceived);
        assertEq(usdG.balanceOf(address(manager)), 0);
    }

    function test_RejectsRangeSweepUntilTerminalTickIsCrossed() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        (int24 tickLower, int24 tickUpper,,,) = _position(6_900);
        bool gbxIsToken0 = address(gbx) < address(usdG);
        int24 incompleteTick = gbxIsToken0 ? tickUpper - 1 : tickLower + 1;
        poolManager.setCurrentTick(incompleteTick);

        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.LiquidityManager__RangeNotCompleted.selector, 6_900, incompleteTick)
        );
        manager.sweepCompletedRange(6_900);
    }

    function test_Token0RangeCompletionUsesActualPriceAtUpperBoundary() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        (, int24 tickUpper,,,) = _position(6_900);
        uint160 upperSqrtPriceX96 = TickMath.getSqrtPriceAtTick(tickUpper);
        int24 boundaryAdjacentTick = tickUpper - 1;

        poolManager.setSlot0(upperSqrtPriceX96 - 1, boundaryAdjacentTick);
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityManager.LiquidityManager__RangeNotCompleted.selector, 6_900, boundaryAdjacentTick
            )
        );
        manager.sweepCompletedRange(6_900);

        poolManager.setSlot0(upperSqrtPriceX96, boundaryAdjacentTick);
        manager.sweepCompletedRange(6_900);
        (,,,, bool exists) = _position(6_900);
        assertFalse(exists);
    }

    function test_Token1RangeCannotSweepInsideLowerTickButCanAtExactBoundary() public {
        (
            LiquidityManager token1Manager,
            LiquidityPoolManagerMock token1Pool,
            GenesisBootstrapCallerMock token1Genesis
        ) = _deployToken1GBXManager();
        token1Genesis.initializeAndSeed(token1Manager, COMMUNITY_USDG);
        (int24 tickLower,,,,) = token1Manager.positionRecord(6_900);
        uint160 lowerSqrtPriceX96 = TickMath.getSqrtPriceAtTick(tickLower);

        token1Pool.setSlot0(lowerSqrtPriceX96 + 1, tickLower);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.LiquidityManager__RangeNotCompleted.selector, 6_900, tickLower)
        );
        token1Manager.sweepCompletedRange(6_900);

        token1Pool.setSlot0(lowerSqrtPriceX96, tickLower);
        token1Manager.sweepCompletedRange(6_900);
        (,,,, bool exists) = token1Manager.positionRecord(6_900);
        assertFalse(exists);
    }

    function test_TimelockedMigrationBurnsOldNFTMintsCanonicalReplacementAndRoutesEveryResidual() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint256 genesisResidual = manager.genesisLiquidityResidual();
        uint256 gbxRemoved = 10_000_000 ether;
        uint256 usdGRemoved = 1_000_000 ether;
        uint256 gbxDeposited = 8_000_000 ether;
        uint256 usdGDeposited = 750_000 ether;
        uint256 strayGBX = 7 ether;
        uint256 strayUSDG = 11 ether;
        minter.mint(gbx, address(manager), strayGBX);
        usdG.mint(address(manager), strayUSDG);
        usdG.mint(address(positionManager), usdGRemoved);
        positionManager.setMigrationAmounts(gbxRemoved, usdGRemoved, gbxDeposited, usdGDeposited);
        LiquidityManager.MigrationPlan memory plan = _migrationPlan(6_900, gbxDeposited, usdGDeposited);
        uint256 supplyBefore = gbx.totalSupply();
        vm.recordLogs();

        (uint256[] memory replacements, uint256 gbxBurned, uint256 usdGToVault) = manager.migrateLiquidity(plan);
        _assertCompleteMigrationEvents(vm.getRecordedLogs(), plan, gbxBurned, usdGToVault);

        assertEq(replacements.length, 1);
        assertEq(replacements[0], 6_904);
        assertEq(gbxBurned, gbxRemoved - gbxDeposited + strayGBX + genesisResidual);
        assertEq(usdGToVault, usdGRemoved - usdGDeposited + strayUSDG);
        assertEq(gbx.totalSupply(), supplyBefore - gbxBurned);
        assertEq(gbx.balanceOf(address(manager)), 0);
        assertEq(usdG.balanceOf(address(manager)), 0);
        assertEq(usdG.balanceOf(vault), usdGToVault);
        assertEq(voter.notifiedAmount(), usdGToVault);
        assertEq(positionManager.ownerOf(6_900), address(0));
        assertEq(positionManager.ownerOf(6_904), address(manager));
        assertEq(positionManager.nextTokenId(), 6_905);
        assertEq(positionManager.lastMigrationPoolKeyHash(), keccak256(abi.encode(manager.poolKey())));
        bytes memory migrationActions = positionManager.lastActions();
        assertEq(uint8(migrationActions[0]), uint8(Actions.BURN_POSITION));
        assertEq(uint8(migrationActions[1]), uint8(Actions.MINT_POSITION));
        assertEq(uint8(migrationActions[2]), uint8(Actions.TAKE_PAIR));
        assertEq(positionManager.lastBurnAmount0Min(), 1);
        assertEq(positionManager.lastBurnAmount1Min(), 1);
        assertEq(
            address(gbx) < address(usdG) ? positionManager.lastMintAmount0Max() : positionManager.lastMintAmount1Max(),
            gbxDeposited
        );
        assertEq(manager.migrationCount(), 1);
        assertEq(manager.lastMigrationPlanHash(), keccak256(abi.encode(plan)));
        assertEq(manager.activePositionCount(), manager.POSITION_COUNT());
        (,,,, bool oldExists) = _position(6_900);
        (int24 lower, int24 upper, uint128 liquidity,, bool replacementExists) = _position(6_904);
        assertFalse(oldExists);
        assertTrue(replacementExists);
        assertEq(lower, plan.replacements[0].tickLower);
        assertEq(upper, plan.replacements[0].tickUpper);
        assertEq(liquidity, plan.replacements[0].liquidity);
    }

    function test_MigrationExecutesSixteenRemovalAndReplacementMaximum() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint256[] memory positionsToRemove = _expandGenesisPositionsToMaximum();
        LiquidityManager.MigrationPlan memory plan =
            _migrationPlanWithCounts(positionsToRemove[0], 16, 16, -30_000, 10_000);
        bytes32 expectedPlanHash = keccak256(abi.encode(plan));

        (uint256[] memory replacementPositionIds, uint256 gbxBurned, uint256 usdGToVault) =
            manager.migrateLiquidity(plan);

        assertEq(gbxBurned, 0);
        assertEq(usdGToVault, 0);
        _assertMaximumMigrationExecution(positionsToRemove, replacementPositionIds, plan, expectedPlanHash);
        assertEq(manager.activePositionCount(), manager.MAX_ACTIVE_POSITIONS());
    }

    function test_MigrationRejectsCumulativeActivePositionOverflow() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint256[] memory activePositions = _expandGenesisPositionsToMaximum();
        LiquidityManager.MigrationPlan memory plan = _migrationPlanWithCounts(activePositions[0], 1, 2, -30_000, 10_000);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityManager.LiquidityManager__ActivePositionLimitExceeded.selector,
                manager.MAX_ACTIVE_POSITIONS(),
                1,
                2,
                manager.MAX_ACTIVE_POSITIONS()
            )
        );
        manager.migrateLiquidity(plan);

        assertEq(manager.activePositionCount(), manager.MAX_ACTIVE_POSITIONS());
        assertEq(positionManager.ownerOf(activePositions[0]), address(manager));
        (,,,, bool exists) = _position(activePositions[0]);
        assertTrue(exists);
    }

    function test_CompletedSweepReleasesExactlyOneSlotUnderGlobalPositionBound() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint256[] memory activePositions = _expandGenesisPositionsToMaximum();
        (int24 tickLower, int24 tickUpper,,,) = _position(activePositions[0]);
        poolManager.setCurrentTick(address(gbx) < address(usdG) ? tickUpper : tickLower);

        manager.sweepCompletedRange(activePositions[0]);
        assertEq(manager.activePositionCount(), manager.MAX_ACTIVE_POSITIONS() - 1);

        LiquidityManager.MigrationPlan memory refill =
            _migrationPlanWithCounts(activePositions[1], 1, 2, -30_000, 10_000);
        manager.migrateLiquidity(refill);

        assertEq(manager.activePositionCount(), manager.MAX_ACTIVE_POSITIONS());
    }

    function test_MigrationReturnsAndNotifiesOnlyObservedVaultResidualReceipt() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        uint256 usdGRemoved = 100 ether;
        usdG.mint(address(positionManager), usdGRemoved);
        usdG.setFeeBps(1_000);
        positionManager.setMigrationAmounts(1 ether, usdGRemoved, 1 ether, 0);
        LiquidityManager.MigrationPlan memory plan = _migrationPlan(6_900, 1 ether, 1);

        uint256 vaultBalanceBefore = usdG.balanceOf(vault);
        (, uint256 gbxBurned, uint256 usdGToVault) = manager.migrateLiquidity(plan);
        uint256 vaultReceived = usdG.balanceOf(vault) - vaultBalanceBefore;

        assertEq(gbxBurned, manager.genesisLiquidityResidual());
        assertEq(vaultReceived, 81 ether);
        assertEq(usdGToVault, vaultReceived);
        assertEq(voter.notifiedAmount(), vaultReceived);
        assertEq(usdG.balanceOf(address(manager)), 0);
    }

    function test_MigrationIsTimelockOnlyDeadlineBoundAndCanonicalPoolOnly() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        LiquidityManager.MigrationPlan memory plan = _migrationPlan(6_900, 1 ether, 1 ether);

        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.LiquidityManager__NotProtocolTimelock.selector, OUTSIDER)
        );
        manager.migrateLiquidity(plan);

        plan.deadline = block.timestamp - 1;
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.LiquidityManager__DeadlineExpired.selector, plan.deadline)
        );
        manager.migrateLiquidity(plan);

        plan.deadline = block.timestamp + 1 days;
        plan.destinationPoolKey.fee += 1;
        bytes32 expectedHash = keccak256(abi.encode(manager.poolKey()));
        bytes32 actualHash = keccak256(abi.encode(plan.destinationPoolKey));
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityManager.LiquidityManager__InvalidDestinationPoolKey.selector, expectedHash, actualHash
            )
        );
        manager.migrateLiquidity(plan);
        assertEq(positionManager.ownerOf(6_900), address(manager));
    }

    function test_MigrationRejectsDuplicatesUnboundedCountsMissingSlippageAndInvalidRanges() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        LiquidityManager.MigrationPlan memory plan = _migrationPlan(6_900, 1 ether, 1 ether);
        plan.removals = new LiquidityManager.MigrationRemoval[](2);
        plan.removals[0] = LiquidityManager.MigrationRemoval({ positionId: 6_900, amount0Min: 1, amount1Min: 1 });
        plan.removals[1] = LiquidityManager.MigrationRemoval({ positionId: 6_900, amount0Min: 1, amount1Min: 1 });
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.LiquidityManager__DuplicateMigrationPosition.selector, 6_900)
        );
        manager.migrateLiquidity(plan);
        assertEq(positionManager.ownerOf(6_900), address(manager));

        plan = _migrationPlan(6_900, 1 ether, 1 ether);
        plan.removals[0].amount0Min = 0;
        plan.removals[0].amount1Min = 0;
        vm.expectRevert(LiquidityManager.LiquidityManager__InvalidMigrationSlippage.selector);
        manager.migrateLiquidity(plan);

        plan = _migrationPlan(6_900, 1 ether, 1 ether);
        plan.replacements[0].tickUpper += 1;
        vm.expectRevert(LiquidityManager.LiquidityManager__InvalidRange.selector);
        manager.migrateLiquidity(plan);

        plan = _migrationPlan(6_900, 1 ether, 1 ether);
        plan.replacements = new LiquidityManager.MigrationReplacement[](17);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.LiquidityManager__InvalidMigrationLength.selector, 1, 17)
        );
        manager.migrateLiquidity(plan);
    }

    function test_GuardianPausesMigrationsAndOnlyTimelockCanUnpause() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        LiquidityManager.MigrationPlan memory plan = _migrationPlan(6_900, 1 ether, 1 ether);

        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.LiquidityManager__NotEmergencyGuardian.selector, OUTSIDER)
        );
        manager.pauseMigrations();

        vm.prank(GUARDIAN);
        manager.pauseMigrations();
        assertTrue(manager.migrationsPaused());
        vm.expectRevert(LiquidityManager.LiquidityManager__MigrationsPaused.selector);
        manager.migrateLiquidity(plan);

        uint256 gbxFees = 1 ether;
        uint256 usdGFees = 2 ether;
        minter.mint(gbx, address(positionManager), gbxFees);
        usdG.mint(address(positionManager), usdGFees);
        positionManager.setPendingFees(gbxFees, usdGFees);
        manager.collectFees(6_900);
        assertEq(usdG.balanceOf(vault), usdGFees);

        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityManager.LiquidityManager__NotProtocolTimelock.selector, OUTSIDER)
        );
        manager.unpauseMigrations();
        manager.unpauseMigrations();
        assertFalse(manager.migrationsPaused());
    }

    function test_MigrationCannotPullAdditionalPrincipalWhenReviewedReplacementIsUnderfunded() public {
        genesis.initializeAndSeed(manager, COMMUNITY_USDG);
        positionManager.setMigrationAmounts(1 ether, 1 ether, 2 ether, 1 ether);
        LiquidityManager.MigrationPlan memory plan = _migrationPlan(6_900, 2 ether, 1 ether);

        vm.expectRevert(bytes("GBX_DEBT"));
        manager.migrateLiquidity(plan);

        assertEq(manager.migrationCount(), 0);
        assertEq(manager.lastMigrationPlanHash(), bytes32(0));
        assertEq(manager.activePositionCount(), manager.POSITION_COUNT());
        assertEq(positionManager.ownerOf(6_900), address(manager));
        (,,,, bool exists) = _position(6_900);
        assertTrue(exists);
    }

    function _migrationPlan(uint256 oldPositionId, uint256 gbxMax, uint256 usdGMax)
        private
        view
        returns (LiquidityManager.MigrationPlan memory plan)
    {
        (int24 oldLower, int24 oldUpper, uint128 oldLiquidity,,) = _position(oldPositionId);
        plan.destinationPoolKey = manager.poolKey();
        plan.removals = new LiquidityManager.MigrationRemoval[](1);
        plan.removals[0] =
            LiquidityManager.MigrationRemoval({ positionId: oldPositionId, amount0Min: 1, amount1Min: 1 });
        plan.replacements = new LiquidityManager.MigrationReplacement[](1);
        plan.replacements[0] = LiquidityManager.MigrationReplacement({
            tickLower: oldLower,
            tickUpper: oldUpper,
            liquidity: oldLiquidity / 2,
            amount0Max: address(gbx) < address(usdG) ? uint128(gbxMax) : uint128(usdGMax),
            amount1Max: address(gbx) < address(usdG) ? uint128(usdGMax) : uint128(gbxMax)
        });
        plan.deadline = block.timestamp + 1 days;
    }

    function _expandGenesisPositionsToMaximum() private returns (uint256[] memory replacementPositionIds) {
        LiquidityManager.MigrationPlan memory expansion = _migrationPlanWithCounts(6_900, 4, 16, -60_000, 1_000);
        (replacementPositionIds,,) = manager.migrateLiquidity(expansion);

        assertEq(replacementPositionIds.length, manager.MAX_MIGRATION_POSITIONS());
        assertEq(manager.migrationCount(), 1);
        assertEq(manager.activePositionCount(), manager.MAX_ACTIVE_POSITIONS());
        for (uint256 index; index < replacementPositionIds.length; ++index) {
            assertEq(replacementPositionIds[index], 6_904 + index);
            assertEq(positionManager.ownerOf(replacementPositionIds[index]), address(manager));
        }
    }

    function _migrationPlanWithCounts(
        uint256 firstRemovalPositionId,
        uint256 removalCount,
        uint256 replacementCount,
        int24 firstTickLower,
        uint128 firstLiquidity
    ) private view returns (LiquidityManager.MigrationPlan memory plan) {
        plan.destinationPoolKey = manager.poolKey();
        plan.removals = new LiquidityManager.MigrationRemoval[](removalCount);
        for (uint256 index; index < removalCount; ++index) {
            plan.removals[index] = LiquidityManager.MigrationRemoval({
                positionId: firstRemovalPositionId + index,
                amount0Min: uint128(index + 1),
                amount1Min: uint128(index + 101)
            });
        }

        plan.replacements = new LiquidityManager.MigrationReplacement[](replacementCount);
        for (uint256 index; index < replacementCount; ++index) {
            int24 tickLower = firstTickLower + int24(uint24(index * 120));
            plan.replacements[index] = LiquidityManager.MigrationReplacement({
                tickLower: tickLower,
                tickUpper: tickLower + 60,
                liquidity: firstLiquidity + uint128(index),
                amount0Max: uint128(index + 1),
                amount1Max: uint128(index + 101)
            });
        }
        plan.deadline = block.timestamp + 1 days;
    }

    function _assertMaximumMigrationExecution(
        uint256[] memory removedPositionIds,
        uint256[] memory replacementPositionIds,
        LiquidityManager.MigrationPlan memory plan,
        bytes32 expectedPlanHash
    ) private view {
        uint256 maximum = manager.MAX_MIGRATION_POSITIONS();
        assertEq(removedPositionIds.length, maximum);
        assertEq(replacementPositionIds.length, maximum);
        assertEq(manager.migrationCount(), 2);
        assertEq(manager.lastMigrationPlanHash(), expectedPlanHash);
        assertEq(positionManager.nextTokenId(), 6_936);
        assertEq(positionManager.lastDeadline(), plan.deadline);
        assertEq(positionManager.lastMigrationPoolKeyHash(), keccak256(abi.encode(manager.poolKey())));
        assertEq(positionManager.lastBurnAmount0Min(), 16);
        assertEq(positionManager.lastBurnAmount1Min(), 116);
        assertEq(positionManager.lastMintAmount0Max(), 16);
        assertEq(positionManager.lastMintAmount1Max(), 116);

        bytes memory actions = positionManager.lastActions();
        assertEq(actions.length, maximum * 2 + 1);
        for (uint256 index; index < maximum; ++index) {
            assertEq(uint8(actions[index]), uint8(Actions.BURN_POSITION));
            assertEq(uint8(actions[maximum + index]), uint8(Actions.MINT_POSITION));
            _assertRemovedPositionCleared(removedPositionIds[index]);
            _assertReplacementPosition(replacementPositionIds[index], plan.replacements[index], 6_920 + index);
        }
        assertEq(uint8(actions[actions.length - 1]), uint8(Actions.TAKE_PAIR));
    }

    function _assertRemovedPositionCleared(uint256 positionId) private view {
        (,,,, bool exists) = _position(positionId);
        assertFalse(exists);
        assertEq(positionManager.ownerOf(positionId), address(0));
        assertEq(positionManager.positionLiquidity(positionId), 0);
    }

    function _assertReplacementPosition(
        uint256 positionId,
        LiquidityManager.MigrationReplacement memory replacement,
        uint256 expectedPositionId
    ) private view {
        assertEq(positionId, expectedPositionId);
        assertEq(positionManager.ownerOf(positionId), address(manager));
        assertEq(positionManager.positionLiquidity(positionId), replacement.liquidity);

        (int24 lower, int24 upper, uint128 liquidity, uint256 gbxPrincipal, bool exists) = _position(positionId);
        assertTrue(exists);
        assertEq(lower, replacement.tickLower);
        assertEq(upper, replacement.tickUpper);
        assertEq(liquidity, replacement.liquidity);
        assertEq(gbxPrincipal, 0);
    }

    function _assertCompleteMigrationEvents(
        Vm.Log[] memory logs,
        LiquidityManager.MigrationPlan memory plan,
        uint256 expectedGBXBurned,
        uint256 expectedUSDGToVault
    ) private view {
        bool sawStarted;
        bool sawBefore;
        bool sawAfter;
        bool sawCompleted;

        for (uint256 index; index < logs.length; ++index) {
            if (logs[index].emitter != address(manager)) continue;
            bytes32 signature = logs[index].topics[0];
            if (signature == MIGRATION_STARTED_SIGNATURE) sawStarted = true;
            if (signature == MIGRATION_BEFORE_SIGNATURE) sawBefore = true;
            if (signature == MIGRATION_AFTER_SIGNATURE) sawAfter = true;
            if (signature == MIGRATION_COMPLETED_SIGNATURE) {
                sawCompleted = true;
                _assertCompletedMigrationEvent(logs[index], plan, expectedGBXBurned, expectedUSDGToVault);
            }
        }
        assertTrue(sawStarted);
        assertTrue(sawBefore);
        assertTrue(sawAfter);
        assertTrue(sawCompleted);
    }

    function _assertCompletedMigrationEvent(
        Vm.Log memory entry,
        LiquidityManager.MigrationPlan memory plan,
        uint256 expectedGBXBurned,
        uint256 expectedUSDGToVault
    ) private pure {
        assertEq(entry.topics[1], keccak256(abi.encode(plan)));
        assertEq(entry.topics[2], keccak256(abi.encode(plan.destinationPoolKey)));
        (
            uint256[] memory removedPositionIds,
            uint256[] memory replacementPositionIds,
            uint256 gbxBurned,
            uint256 usdGToVault
        ) = abi.decode(entry.data, (uint256[], uint256[], uint256, uint256));
        assertEq(removedPositionIds[0], plan.removals[0].positionId);
        assertEq(replacementPositionIds[0], 6_904);
        assertEq(gbxBurned, expectedGBXBurned);
        assertEq(usdGToVault, expectedUSDGToVault);
    }

    function _assertGenesisPosition(uint256 index, bool gbxIsToken0, uint256 allocationCap)
        private
        view
        returns (int24 lower, int24 upper, uint256 principal)
    {
        PositionManagerMock.CapturedMint memory captured = positionManager.capturedMint(index);
        assertEq(captured.owner, address(manager));
        assertGt(captured.liquidity, 0);
        principal = gbxIsToken0 ? captured.amount0Max : captured.amount1Max;
        assertLe(principal, allocationCap);
        assertEq(gbxIsToken0 ? captured.amount1Max : captured.amount0Max, 0);
        assertEq(captured.tickLower % 60, 0);
        assertEq(captured.tickUpper % 60, 0);
        assertLt(captured.tickLower, captured.tickUpper);

        uint128 liquidity;
        uint256 storedPrincipal;
        bool exists;
        (lower, upper, liquidity, storedPrincipal, exists) = manager.positionRecord(6_900 + index);
        assertTrue(exists);
        assertEq(lower, captured.tickLower);
        assertEq(upper, captured.tickUpper);
        assertEq(liquidity, captured.liquidity);
        assertEq(storedPrincipal, principal);

        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        uint256 officialPrincipal = gbxIsToken0
            ? SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity, true)
            : SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity, true);
        uint256 nextPrincipal = gbxIsToken0
            ? SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liquidity + 1, true)
            : SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liquidity + 1, true);
        assertEq(principal, officialPrincipal);
        assertGt(nextPrincipal, allocationCap);
    }

    function _position(uint256 positionId) private view returns (int24, int24, uint128, uint256, bool) {
        return manager.positionRecord(positionId);
    }

    function _dependencies() private view returns (LiquidityManager.Dependencies memory dependencies) {
        dependencies = LiquidityManager.Dependencies({
            gbx: address(gbx),
            usdG: address(usdG),
            gumBallVault: vault,
            allocationVoter: address(voter),
            poolManager: address(poolManager),
            positionManager: address(positionManager),
            permit2: address(permit2),
            launchGuardHook: address(hook),
            genesisBootstrap: address(genesis),
            genesisLiquidityCalculator: address(calculator),
            protocolTimelock: address(this),
            emergencyGuardian: GUARDIAN
        });
    }

    function _validLadder() private pure returns (LiquidityManager.LadderConfig memory ladder) {
        ladder = LiquidityManager.LadderConfig({
            poolFee: 3_000,
            tickSpacing: 60,
            allocationBps: [uint16(5_000), 3_000, 1_500, 500],
            cumulativeTickDeltas: [int24(4_080), 10_980, 17_940, 24_900]
        });
    }

    function _deployToken1GBXManager()
        private
        returns (LiquidityManager token1Manager, LiquidityPoolManagerMock token1Pool, GenesisBootstrapCallerMock caller)
    {
        GBXTokenMinterMock localMinter = new GBXTokenMinterMock();
        AdversarialToken localUSDG = new AdversarialToken("Global Dollar", "USDG", 18);
        GBXToken localGBX = _deployGBXOnSide(address(localUSDG), false);
        localGBX.initializeEmissionController(address(localMinter));
        assertTrue(address(localGBX) > address(localUSDG));

        Permit2Mock localPermit2 = new Permit2Mock();
        PositionManagerMock localPositionManager = new PositionManagerMock(localGBX, localUSDG, localPermit2);
        token1Pool = new LiquidityPoolManagerMock();
        LiquidityAllocationVoterMock localVoter = new LiquidityAllocationVoterMock();
        caller = new GenesisBootstrapCallerMock();
        EmptyLaunchGuardHookMock localHook = new EmptyLaunchGuardHookMock();
        GenesisLiquidityCalculator localCalculator = new GenesisLiquidityCalculator();

        LiquidityManager.Dependencies memory dependencies = LiquidityManager.Dependencies({
            gbx: address(localGBX),
            usdG: address(localUSDG),
            gumBallVault: vault,
            allocationVoter: address(localVoter),
            poolManager: address(token1Pool),
            positionManager: address(localPositionManager),
            permit2: address(localPermit2),
            launchGuardHook: address(localHook),
            genesisBootstrap: address(caller),
            genesisLiquidityCalculator: address(localCalculator),
            protocolTimelock: address(this),
            emergencyGuardian: GUARDIAN
        });
        LiquidityManager.LadderConfig memory ladder = LiquidityManager.LadderConfig({
            poolFee: 3_000,
            tickSpacing: 60,
            allocationBps: [uint16(5_000), 3_000, 1_500, 500],
            cumulativeTickDeltas: [int24(4_080), 10_980, 17_940, 24_900]
        });
        token1Manager = new LiquidityManager(dependencies, ladder);
        localMinter.mint(localGBX, address(token1Manager), GENESIS_LP_GBX);
    }

    function _deployGBXOnSide(address peer, bool gbxIsToken0) private returns (GBXToken token) {
        bytes memory initCode =
            abi.encodePacked(type(GBXToken).creationCode, abi.encode(address(this), IEligibilityModule(address(0))));
        bytes32 initCodeHash = keccak256(initCode);
        for (uint256 nonce = 1; nonce <= 256; ++nonce) {
            bytes32 salt = bytes32(nonce);
            address predicted = vm.computeCreate2Address(salt, initCodeHash, address(this));
            if ((predicted < peer) == gbxIsToken0) {
                token = new GBXToken{ salt: salt }(address(this), IEligibilityModule(address(0)));
                assertEq(address(token), predicted);
                return token;
            }
        }
        revert("CREATE2_SIDE_NOT_FOUND");
    }
}
