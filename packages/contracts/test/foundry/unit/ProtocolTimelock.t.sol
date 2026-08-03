// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";

import { ProtocolTimelock } from "../../../src/access/ProtocolTimelock.sol";
import { IAssetRegistry } from "../../../src/interfaces/IAssetRegistry.sol";
import { AssetRegistry } from "../../../src/vault/AssetRegistry.sol";
import {
    TimelockGuardianMock,
    TimelockLiquidityManagerMock,
    TimelockMiningPoolMock,
    TimelockPermissionedPoolControllerMock,
    TimelockRegistryMock,
    TimelockStrategyMock,
    TimelockVaultMock,
    TimelockVoterMock
} from "../mocks/ProtocolTimelockMocks.sol";
import { VaultTestToken } from "../mocks/VaultTestMocks.sol";
import { StrategyDeployerTestMock } from "../mocks/StrategyDeployerTestMock.sol";

contract ProtocolTimelockTest is Test {
    address private constant OUTSIDER = address(0xBAD);
    bytes32 private constant SALT = keccak256("GUM_BALL_6900_TEST_OPERATION");

    ProtocolTimelock private timelock;
    VaultTestToken private usdG;
    TimelockGuardianMock private guardian;
    TimelockVoterMock private voter;
    TimelockMiningPoolMock private miningPool;
    TimelockLiquidityManagerMock private liquidityManager;
    TimelockVaultMock private vault;
    AssetRegistry private registry;
    StrategyDeployerTestMock private strategyDeployer;

    function setUp() public {
        timelock = new ProtocolTimelock(address(this), address(this));
        usdG = new VaultTestToken("Global Dollar", "USDG", 6);
        guardian = new TimelockGuardianMock();
        voter = new TimelockVoterMock();
        miningPool = new TimelockMiningPoolMock();
        liquidityManager = new TimelockLiquidityManagerMock();
        vault = new TimelockVaultMock();
        strategyDeployer = new StrategyDeployerTestMock(address(timelock), address(guardian), address(usdG));
        registry = new AssetRegistry(address(usdG), address(timelock), address(guardian), address(strategyDeployer));
        strategyDeployer.configureGraph(address(registry), address(voter), address(vault), address(this));
        timelock.initializeTargets(
            address(registry),
            address(guardian),
            address(voter),
            address(miningPool),
            address(liquidityManager),
            address(strategyDeployer)
        );
        assertEq(guardian.assetRegistry(), address(registry));
        assertEq(guardian.allocationVoter(), address(voter));
    }

    function test_EnforcesSevenDaysForRegistryConfigurationAndExecutesPermissionlessly() public {
        bytes memory data = abi.encodeCall(AssetRegistry.configureVault, (address(vault)));
        bytes32 operationId = timelock.schedule(address(registry), data, SALT);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__NotReady.selector, operationId, block.timestamp + 7 days
            )
        );
        timelock.execute(address(registry), data, SALT);

        vm.warp(block.timestamp + 7 days);
        vm.prank(OUTSIDER);
        timelock.execute(address(registry), data, SALT);
        assertEq(registry.vault(), address(vault));
        assertEq(timelock.operationReadyAt(operationId), 0);
    }

    function test_RegistersValidatedAssetThroughCriticalDelay() public {
        _configureVault();
        IAssetRegistry.AssetConfig memory config = IAssetRegistry.AssetConfig({
            token: address(usdG),
            assetId: keccak256("USDG"),
            symbolHash: keccak256("USDG"),
            decimals: 6,
            strategy: strategyDeployer.canonicalHoldUSDGStrategy(),
            rewards: address(0),
            isStockToken: false,
            acquisitionEnabled: false,
            redemptionEnabled: true
        });
        bytes memory data = abi.encodeCall(AssetRegistry.registerAsset, (config));

        assertEq(timelock.requiredDelay(address(registry), data), 7 days);
        bytes32 salt = keccak256("REGISTER_USDG");
        timelock.schedule(address(registry), data, salt);
        vm.warp(block.timestamp + 7 days);
        timelock.execute(address(registry), data, salt);

        assertTrue(registry.isRegisteredAsset(address(usdG)));
        assertEq(registry.assetCount(), 1);
    }

    function test_RejectsSchedulingUSDGRegistrationWithoutCanonicalHold() public {
        IAssetRegistry.AssetConfig memory config = IAssetRegistry.AssetConfig({
            token: address(usdG),
            assetId: keccak256("USDG"),
            symbolHash: keccak256("USDG"),
            decimals: 6,
            strategy: address(0),
            rewards: address(0),
            isStockToken: false,
            acquisitionEnabled: false,
            redemptionEnabled: true
        });
        bytes memory data = abi.encodeCall(AssetRegistry.registerAsset, (config));
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__InvalidStrategyRegistrationProvenance.selector, address(0)
            )
        );
        timelock.schedule(address(registry), data, keccak256("MISSING_HOLD"));
    }

    function test_RejectsSchedulingPassiveNonUSDGRegistrationWithoutCanonicalPair() public {
        IAssetRegistry.AssetConfig memory config = IAssetRegistry.AssetConfig({
            token: address(0xA55E7),
            assetId: keccak256("PASSIVE"),
            symbolHash: keccak256("PASSIVE"),
            decimals: 18,
            strategy: address(0),
            rewards: address(0),
            isStockToken: false,
            acquisitionEnabled: false,
            redemptionEnabled: true
        });
        bytes memory data = abi.encodeCall(AssetRegistry.registerAsset, (config));
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__InvalidStrategyRegistrationProvenance.selector, address(0)
            )
        );
        timelock.schedule(address(registry), data, keccak256("PASSIVE_WITHOUT_PAIR"));
    }

    function test_RegisterStockAssetSelectorRequiresExactStaticCalldataLength() public {
        TimelockStrategyMock stockStrategy = new TimelockStrategyMock();
        TimelockStrategyMock stockRewards = new TimelockStrategyMock();
        IAssetRegistry.AssetConfig memory config = IAssetRegistry.AssetConfig({
            token: address(0xA55E7),
            assetId: keccak256("STOCK"),
            symbolHash: keccak256("STOCK"),
            decimals: 18,
            strategy: address(stockStrategy),
            rewards: address(stockRewards),
            isStockToken: true,
            acquisitionEnabled: true,
            redemptionEnabled: true
        });
        strategyDeployer.attestAcquisition(address(stockStrategy), config.token, address(stockRewards));
        IAssetRegistry.StockTokenDependency memory dependency = IAssetRegistry.StockTokenDependency({
            tokenRuntimeCodeHash: keccak256("TOKEN_CODE"),
            beacon: address(0xBEAC0),
            beaconRuntimeCodeHash: keccak256("BEACON_CODE"),
            implementation: address(0x1A1),
            implementationRuntimeCodeHash: keccak256("IMPLEMENTATION_CODE"),
            uiMultiplier: 1e18
        });
        bytes memory data = abi.encodeCall(AssetRegistry.registerStockAsset, (config, dependency));
        assertEq(data.length, 484);
        assertEq(timelock.requiredDelay(address(registry), data), 7 days);

        bytes memory extended = bytes.concat(data, hex"00");
        bytes memory truncated = data;
        assembly ("memory-safe") {
            mstore(truncated, sub(mload(truncated), 1))
        }
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__DataLengthMismatch.selector,
                AssetRegistry.registerStockAsset.selector,
                483
            )
        );
        timelock.requiredDelay(address(registry), truncated);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__DataLengthMismatch.selector,
                AssetRegistry.registerStockAsset.selector,
                485
            )
        );
        timelock.requiredDelay(address(registry), extended);
    }

    function test_BoundedMaintenanceUsesFortyEightHours() public {
        address nextOperator = address(0x6900);
        bytes memory rotation = abi.encodeCall(TimelockGuardianMock.rotateOperator, (nextOperator));
        assertEq(timelock.requiredDelay(address(guardian), rotation), 48 hours);

        timelock.schedule(address(guardian), rotation, SALT);
        vm.warp(block.timestamp + 48 hours);
        timelock.execute(address(guardian), rotation, SALT);
        assertEq(guardian.operator(), nextOperator);

        bytes memory reopen = abi.encodeCall(TimelockVoterMock.unpauseSignalActivations, ());
        timelock.schedule(address(voter), reopen, SALT);
        vm.warp(block.timestamp + 48 hours);
        timelock.execute(address(voter), reopen, SALT);
        assertFalse(voter.activationsPaused());

        bytes memory unpauseMigration = abi.encodeCall(TimelockLiquidityManagerMock.unpauseMigrations, ());
        assertEq(timelock.requiredDelay(address(liquidityManager), unpauseMigration), 48 hours);
    }

    function test_MigrationRequiresSevenDaysAndCommitsTheCompletePlanCalldata() public {
        TimelockLiquidityManagerMock.MigrationPlan memory plan = _migrationPlan(6_900, 120);
        bytes memory data = abi.encodeCall(TimelockLiquidityManagerMock.migrateLiquidity, (plan));
        assertEq(timelock.requiredDelay(address(liquidityManager), data), 7 days);
        timelock.schedule(address(liquidityManager), data, SALT);

        TimelockLiquidityManagerMock.MigrationPlan memory changedPlan = _migrationPlan(6_900, 180);
        bytes memory changedData = abi.encodeCall(TimelockLiquidityManagerMock.migrateLiquidity, (changedPlan));
        vm.warp(block.timestamp + 7 days);
        bytes32 changedOperationId = timelock.hashOperation(address(liquidityManager), changedData, SALT);
        vm.expectRevert(
            abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__NotScheduled.selector, changedOperationId)
        );
        timelock.execute(address(liquidityManager), changedData, SALT);

        timelock.execute(address(liquidityManager), data, SALT);
        assertEq(liquidityManager.executedPlanHash(), keccak256(abi.encode(plan)));
    }

    function test_MigrationSelectorRejectsTruncatedCalldata() public {
        bytes memory truncated = abi.encodePacked(TimelockLiquidityManagerMock.migrateLiquidity.selector);
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__DataLengthMismatch.selector,
                TimelockLiquidityManagerMock.migrateLiquidity.selector,
                4
            )
        );
        timelock.schedule(address(liquidityManager), truncated, SALT);
    }

    function test_MigrationSchedulingRejectsNoncanonicalCalldataWrongPoolAndUnboundedArrays() public {
        TimelockLiquidityManagerMock.MigrationPlan memory plan = _migrationPlan(6_900, 120);
        bytes memory data = abi.encodeCall(TimelockLiquidityManagerMock.migrateLiquidity, (plan));
        bytes memory trailingData = bytes.concat(data, hex"00");
        vm.expectRevert(ProtocolTimelock.ProtocolTimelock__InvalidMigrationCalldata.selector);
        timelock.schedule(address(liquidityManager), trailingData, SALT);

        plan.destinationPoolKey.fee += 1;
        data = abi.encodeCall(TimelockLiquidityManagerMock.migrateLiquidity, (plan));
        bytes32 expectedHash = keccak256(abi.encode(liquidityManager.poolKey()));
        bytes32 actualHash = keccak256(abi.encode(plan.destinationPoolKey));
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__InvalidMigrationPoolKey.selector, expectedHash, actualHash
            )
        );
        timelock.schedule(address(liquidityManager), data, SALT);

        plan = _migrationPlan(6_900, 120);
        plan.removals = new TimelockLiquidityManagerMock.MigrationRemoval[](17);
        data = abi.encodeCall(TimelockLiquidityManagerMock.migrateLiquidity, (plan));
        vm.expectRevert(ProtocolTimelock.ProtocolTimelock__InvalidMigrationCalldata.selector);
        timelock.schedule(address(liquidityManager), data, SALT);
    }

    function test_MigrationCalldataBoundAcceptsExactlySixteenRemovalsAndReplacements() public view {
        TimelockLiquidityManagerMock.MigrationPlan memory plan = _migrationPlan(6_900, 120);
        plan.removals = new TimelockLiquidityManagerMock.MigrationRemoval[](16);
        plan.replacements = new TimelockLiquidityManagerMock.MigrationReplacement[](16);
        bytes memory data = abi.encodeCall(TimelockLiquidityManagerMock.migrateLiquidity, (plan));

        assertEq(data.length, 4_452);
        assertEq(timelock.requiredDelay(address(liquidityManager), data), 7 days);
    }

    function test_CannotTargetVaultTokenOrUnsupportedSelectors() public {
        bytes memory arbitraryVaultCall = abi.encodeWithSignature("execute(address,bytes)", address(usdG), bytes(""));
        vm.expectRevert(
            abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, address(vault))
        );
        timelock.schedule(address(vault), arbitraryVaultCall, SALT);

        bytes memory transferCall = abi.encodeWithSignature("transfer(address,uint256)", OUTSIDER, 1);
        vm.expectRevert(
            abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, address(usdG))
        );
        timelock.schedule(address(usdG), transferCall, SALT);
    }

    function test_RejectsNonAtomicStrategyDisableOperations() public {
        bytes memory disableAsset = abi.encodeCall(AssetRegistry.disableAcquisition, (address(usdG)));
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__UnsupportedOperation.selector,
                address(0),
                AssetRegistry.disableAcquisition.selector
            )
        );
        timelock.schedule(address(registry), disableAsset, keccak256("NON_ATOMIC_ASSET_DISABLE"));

        bytes memory disableStandalone =
            abi.encodeCall(AssetRegistry.disableStandaloneStrategy, (address(liquidityManager)));
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__UnsupportedOperation.selector,
                address(0),
                AssetRegistry.disableStandaloneStrategy.selector
            )
        );
        timelock.schedule(address(registry), disableStandalone, keccak256("NON_ATOMIC_STANDALONE_DISABLE"));

        bytes memory voterOnlyCleanup = abi.encodeCall(TimelockVoterMock.disableStrategy, (address(liquidityManager)));
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__UnsupportedOperation.selector,
                address(voter),
                TimelockVoterMock.disableStrategy.selector
            )
        );
        timelock.schedule(address(voter), voterOnlyCleanup, keccak256("VOTER_ONLY_DISABLE"));
    }

    function test_InitializeTargetsRejectsEveryZeroAndCodeLessTarget() public {
        ProtocolTimelock fresh = new ProtocolTimelock(address(this), address(this));
        StrategyDeployerTestMock freshDeployer =
            new StrategyDeployerTestMock(address(fresh), address(guardian), address(usdG));
        freshDeployer.configureGraph(address(registry), address(voter), address(vault), address(this));
        address[6] memory targets = [
            address(registry),
            address(guardian),
            address(voter),
            address(miningPool),
            address(liquidityManager),
            address(freshDeployer)
        ];

        for (uint256 index; index < targets.length; ++index) {
            address validTarget = targets[index];

            targets[index] = address(0);
            vm.expectRevert(ProtocolTimelock.ProtocolTimelock__ZeroAddress.selector);
            _initializeTargets(fresh, targets);
            assertFalse(fresh.targetsInitialized());

            targets[index] = OUTSIDER;
            vm.expectRevert(abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__InvalidTarget.selector, OUTSIDER));
            _initializeTargets(fresh, targets);
            assertFalse(fresh.targetsInitialized());

            targets[index] = validTarget;
        }

        _initializeTargets(fresh, targets);
        assertTrue(fresh.targetsInitialized());
    }

    function test_InitializeTargetsGuardianFailureRollsBackAndCanRetry() public {
        ProtocolTimelock fresh = new ProtocolTimelock(address(this), address(this));
        TimelockGuardianMock revertingGuardian = new TimelockGuardianMock();
        StrategyDeployerTestMock freshDeployer =
            new StrategyDeployerTestMock(address(fresh), address(revertingGuardian), address(usdG));
        freshDeployer.configureGraph(address(registry), address(voter), address(vault), address(this));
        address[6] memory targets = [
            address(registry),
            address(revertingGuardian),
            address(voter),
            address(miningPool),
            address(liquidityManager),
            address(freshDeployer)
        ];
        revertingGuardian.setRevertsOnInitialize(true);

        vm.expectRevert(TimelockGuardianMock.TimelockGuardianMock__InitializeReverted.selector);
        _initializeTargets(fresh, targets);

        assertFalse(fresh.targetsInitialized());
        assertEq(address(fresh.assetRegistry()), address(0));
        assertEq(fresh.emergencyGuardian(), address(0));
        assertEq(fresh.allocationVoter(), address(0));
        assertEq(fresh.miningPool(), address(0));
        assertEq(fresh.liquidityManager(), address(0));

        revertingGuardian.setRevertsOnInitialize(false);
        _initializeTargets(fresh, targets);

        assertTrue(fresh.targetsInitialized());
        assertEq(address(fresh.assetRegistry()), address(registry));
        assertEq(fresh.emergencyGuardian(), address(revertingGuardian));
        assertEq(fresh.allocationVoter(), address(voter));
        assertEq(fresh.miningPool(), address(miningPool));
        assertEq(fresh.liquidityManager(), address(liquidityManager));
        assertEq(revertingGuardian.assetRegistry(), address(registry));
        assertEq(revertingGuardian.allocationVoter(), address(voter));
    }

    function test_OnlyMultisigSchedulesOrCancelsAndExpiredOperationCannotExecute() public {
        bytes memory rotation = abi.encodeCall(TimelockGuardianMock.rotateOperator, (address(0x6900)));
        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__UnauthorizedProposer.selector, OUTSIDER)
        );
        timelock.schedule(address(guardian), rotation, SALT);

        bytes32 operationId = timelock.schedule(address(guardian), rotation, SALT);
        timelock.cancel(operationId);
        assertEq(timelock.operationReadyAt(operationId), 0);

        bytes32 nextSalt = keccak256("EXPIRED");
        operationId = timelock.schedule(address(guardian), rotation, nextSalt);
        uint256 expiresAt = block.timestamp + 48 hours + 30 days;
        vm.warp(expiresAt + 1);
        vm.expectRevert(
            abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__ExecutionExpired.selector, operationId, expiresAt)
        );
        timelock.execute(address(guardian), rotation, nextSalt);
    }

    function test_PermissionedPoolControllerIsOneShotBoundAndEveryTypedChangeRequiresSevenDays() public {
        TimelockPermissionedPoolControllerMock controller = new TimelockPermissionedPoolControllerMock(
            address(timelock), address(guardian), address(vault), address(liquidityManager)
        );
        timelock.finalizePermissionedPoolController(address(controller));
        assertEq(address(timelock.permissionedPoolController()), address(controller));
        assertEq(guardian.permissionedPoolController(), address(controller));

        bytes[] memory calls = new bytes[](4);
        calls[0] = abi.encodeCall(controller.setSwappingEnabled, (true));
        calls[1] = abi.encodeCall(controller.updateAllowListChecker, (address(vault)));
        calls[2] = abi.encodeCall(controller.setAllowedWrapper, (address(miningPool), true));
        calls[3] = abi.encodeCall(controller.setCanonicalHookAllowed, (true));
        for (uint256 index; index < calls.length; ++index) {
            bytes32 salt = bytes32(index + 100);
            assertEq(timelock.requiredDelay(address(controller), calls[index]), 7 days);
            timelock.schedule(address(controller), calls[index], salt);
        }

        vm.warp(block.timestamp + 7 days);
        for (uint256 index; index < calls.length; ++index) {
            timelock.execute(address(controller), calls[index], bytes32(index + 100));
        }
        assertTrue(controller.swappingEnabled());
        assertEq(controller.allowListChecker(), address(vault));
        assertEq(controller.wrapper(), address(miningPool));
        assertTrue(controller.wrapperAllowed());
        assertTrue(controller.canonicalHookAllowed());

        vm.expectRevert(ProtocolTimelock.ProtocolTimelock__PermissionedPoolControllerAlreadyFinalized.selector);
        timelock.finalizePermissionedPoolController(address(0));
    }

    function test_StrategyBootstrapCannotFinalizeWhilePermissionedControllerSlotRemainsOpen() public {
        vm.expectRevert(ProtocolTimelock.ProtocolTimelock__PermissionedPoolControllerNotFinalized.selector);
        timelock.finalizeStrategyBootstrap(new address[](0));
    }

    function _configureVault() private {
        bytes memory data = abi.encodeCall(AssetRegistry.configureVault, (address(vault)));
        bytes32 salt = keccak256("CONFIGURE_VAULT");
        timelock.schedule(address(registry), data, salt);
        vm.warp(block.timestamp + 7 days);
        timelock.execute(address(registry), data, salt);
    }

    function _initializeTargets(ProtocolTimelock targetTimelock, address[6] memory targets) private {
        targetTimelock.initializeTargets(targets[0], targets[1], targets[2], targets[3], targets[4], targets[5]);
    }

    function _migrationPlan(uint256 positionId, int24 tickUpper)
        private
        view
        returns (TimelockLiquidityManagerMock.MigrationPlan memory plan)
    {
        plan.destinationPoolKey = PoolKey({
            currency0: Currency.wrap(address(0x1000)),
            currency1: Currency.wrap(address(0x2000)),
            fee: 3_000,
            tickSpacing: 60,
            hooks: IHooks(address(0x3000))
        });
        plan.removals = new TimelockLiquidityManagerMock.MigrationRemoval[](1);
        plan.removals[0] =
            TimelockLiquidityManagerMock.MigrationRemoval({ positionId: positionId, amount0Min: 1, amount1Min: 1 });
        plan.replacements = new TimelockLiquidityManagerMock.MigrationReplacement[](1);
        plan.replacements[0] = TimelockLiquidityManagerMock.MigrationReplacement({
            tickLower: 60, tickUpper: tickUpper, liquidity: 1 ether, amount0Max: 2 ether, amount1Max: 3 ether
        });
        plan.deadline = block.timestamp + 30 days;
    }
}

contract ProtocolTimelockPolicyMatrixTest is Test {
    struct AllowedOperation {
        address target;
        bytes data;
        uint256 delay;
    }

    ProtocolTimelock private timelock;
    TimelockRegistryMock private registry;
    TimelockGuardianMock private guardian;
    TimelockVoterMock private voter;
    TimelockMiningPoolMock private miningPool;
    TimelockLiquidityManagerMock private liquidityManager;
    TimelockStrategyMock private strategy;
    TimelockVaultMock private vault;
    StrategyDeployerTestMock private strategyDeployer;

    function setUp() public {
        timelock = new ProtocolTimelock(address(this), address(this));
        registry = new TimelockRegistryMock();
        guardian = new TimelockGuardianMock();
        voter = new TimelockVoterMock();
        miningPool = new TimelockMiningPoolMock();
        liquidityManager = new TimelockLiquidityManagerMock();
        strategy = new TimelockStrategyMock();
        vault = new TimelockVaultMock();
        strategyDeployer = new StrategyDeployerTestMock(address(timelock), address(guardian), address(vault));
        strategyDeployer.configureGraph(address(registry), address(voter), address(vault), address(this));
        strategyDeployer.attestAcquisition(address(strategy), address(0xA55E7), address(strategy));
        strategyDeployer.attestBuyback(address(strategy));
        registry.addStrategy(address(strategy));
        timelock.initializeTargets(
            address(registry),
            address(guardian),
            address(voter),
            address(miningPool),
            address(liquidityManager),
            address(strategyDeployer)
        );
    }

    function test_AllAllowedPairsEnforceExactCalldataAndExecuteOnce() public {
        AllowedOperation[] memory operations = _allowedOperations();
        bytes32[] memory operationIds = new bytes32[](operations.length);

        for (uint256 index; index < operations.length; ++index) {
            AllowedOperation memory operation = operations[index];
            assertEq(timelock.requiredDelay(operation.target, operation.data), operation.delay);

            vm.expectRevert();
            timelock.requiredDelay(operation.target, _truncate(operation.data));
            vm.expectRevert();
            timelock.requiredDelay(operation.target, bytes.concat(operation.data, hex"00"));
            vm.expectRevert();
            timelock.requiredDelay(address(vault), operation.data);

            bytes32 salt = bytes32(index + 1);
            operationIds[index] = timelock.schedule(operation.target, operation.data, salt);
        }

        vm.warp(block.timestamp + timelock.CRITICAL_CHANGE_DELAY());
        for (uint256 index; index < operations.length; ++index) {
            AllowedOperation memory operation = operations[index];
            bytes32 salt = bytes32(index + 1);
            timelock.execute(operation.target, operation.data, salt);
            assertEq(timelock.operationReadyAt(operationIds[index]), 0);

            vm.expectRevert(
                abi.encodeWithSelector(ProtocolTimelock.ProtocolTimelock__NotScheduled.selector, operationIds[index])
            );
            timelock.execute(operation.target, operation.data, salt);
        }

        assertEq(registry.configuredVault(), address(vault));
        assertEq(registry.lastAssetToken(), address(0xA55E7));
        assertEq(registry.lastStandaloneStrategy(), address(strategy));
        assertEq(guardian.operator(), address(0x6900));
        assertFalse(voter.activationsPaused());
        assertEq(voter.reactivatedStrategy(), address(strategy));
        assertFalse(miningPool.contributionsPaused());
        assertFalse(liquidityManager.migrationsPaused());
        assertEq(strategy.referenceRate(), 1 ether);
        assertFalse(strategy.fillsPaused());
    }

    function test_ResetSchedulingPinsReviewedBaselineButLiveChangesCannotCensorExecution() public {
        bytes memory data = abi.encodeCall(TimelockStrategyMock.resetReferenceRate, (1 ether, 0.75 ether));
        bytes32 salt = keccak256("UNCENSORABLE_RESET");
        bytes32 operationId = timelock.schedule(address(strategy), data, salt);

        // A fill or permissionless restart may change this while the reviewed operation matures.
        strategy.permissionlessChangeReferenceRate(1.25 ether);
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__ReferenceRateBaselineMismatch.selector,
                address(strategy),
                1 ether,
                1.25 ether
            )
        );
        timelock.requiredDelay(address(strategy), data);

        vm.warp(block.timestamp + 48 hours);
        timelock.execute(address(strategy), data, salt);

        assertEq(strategy.referenceRate(), 0.75 ether);
        assertEq(timelock.operationReadyAt(operationId), 0);
    }

    function test_ResetSchedulingRejectsStaleBaselineAndPreventsPrequeuedCompounding() public {
        bytes memory compoundingStep = abi.encodeCall(TimelockStrategyMock.resetReferenceRate, (2 ether, 4 ether));
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolTimelock.ProtocolTimelock__ReferenceRateBaselineMismatch.selector,
                address(strategy),
                2 ether,
                1 ether
            )
        );
        timelock.schedule(address(strategy), compoundingStep, keccak256("COMPOUNDING_STEP"));

        bytes memory boundedReset = abi.encodeCall(TimelockStrategyMock.resetReferenceRate, (1 ether, 2 ether));
        bytes32[3] memory operationIds;
        for (uint256 index; index < operationIds.length; ++index) {
            operationIds[index] = timelock.schedule(address(strategy), boundedReset, bytes32(index + 100));
        }

        vm.warp(block.timestamp + 48 hours);
        for (uint256 index; index < operationIds.length; ++index) {
            timelock.execute(address(strategy), boundedReset, bytes32(index + 100));
            assertEq(timelock.operationReadyAt(operationIds[index]), 0);
        }

        // Every concurrently queued operation is bounded to the same reviewed 1e18 baseline, never 2x/4x/8x.
        assertEq(strategy.referenceRate(), 2 ether);
    }

    function test_UnsupportedSelectorIsRejectedForEveryCanonicalTargetClass() public {
        bytes memory unsupported = abi.encodeWithSignature("unsupported(address)", address(0xBAD));
        address[] memory targets = new address[](7);
        targets[0] = address(registry);
        targets[1] = address(guardian);
        targets[2] = address(voter);
        targets[3] = address(miningPool);
        targets[4] = address(liquidityManager);
        targets[5] = address(strategy);
        targets[6] = address(strategyDeployer);

        for (uint256 index; index < targets.length; ++index) {
            vm.expectRevert();
            timelock.requiredDelay(targets[index], unsupported);
        }
    }

    function _allowedOperations() private view returns (AllowedOperation[] memory operations) {
        operations = new AllowedOperation[](15);
        IAssetRegistry.AssetConfig memory config = IAssetRegistry.AssetConfig({
            token: address(0xA55E7),
            assetId: keccak256("ASSET"),
            symbolHash: keccak256("ASSET"),
            decimals: 18,
            strategy: address(strategy),
            rewards: address(strategy),
            isStockToken: false,
            acquisitionEnabled: true,
            redemptionEnabled: true
        });
        TimelockLiquidityManagerMock.MigrationPlan memory plan = _migrationPlan();
        IAssetRegistry.StockTokenDependency memory dependency = IAssetRegistry.StockTokenDependency({
            tokenRuntimeCodeHash: keccak256("TOKEN_CODE"),
            beacon: address(0xBEAC0),
            beaconRuntimeCodeHash: keccak256("BEACON_CODE"),
            implementation: address(0x1A1),
            implementationRuntimeCodeHash: keccak256("IMPLEMENTATION_CODE"),
            uiMultiplier: 1e18
        });

        operations[0] = AllowedOperation({
            target: address(registry),
            data: abi.encodeCall(TimelockRegistryMock.configureVault, (address(vault))),
            delay: 7 days
        });
        operations[1] = AllowedOperation({
            target: address(registry), data: abi.encodeCall(TimelockRegistryMock.registerAsset, (config)), delay: 7 days
        });
        operations[2] = AllowedOperation({
            target: address(registry),
            data: abi.encodeCall(TimelockRegistryMock.registerStockAsset, (config, dependency)),
            delay: 7 days
        });
        operations[3] = AllowedOperation({
            target: address(registry),
            data: abi.encodeCall(TimelockRegistryMock.registerStandaloneStrategy, (address(strategy))),
            delay: 7 days
        });
        operations[4] = AllowedOperation({
            target: address(registry),
            data: abi.encodeCall(TimelockRegistryMock.enableAcquisition, (config.token)),
            delay: 48 hours
        });
        operations[5] = AllowedOperation({
            target: address(registry),
            data: abi.encodeCall(TimelockRegistryMock.setRedemptionEnabled, (config.token, true)),
            delay: 48 hours
        });
        operations[6] = AllowedOperation({
            target: address(registry),
            data: abi.encodeCall(TimelockRegistryMock.enableStandaloneStrategy, (address(strategy))),
            delay: 48 hours
        });
        operations[7] = AllowedOperation({
            target: address(guardian),
            data: abi.encodeCall(TimelockGuardianMock.rotateOperator, (address(0x6900))),
            delay: 48 hours
        });
        operations[8] = AllowedOperation({
            target: address(voter),
            data: abi.encodeCall(TimelockVoterMock.unpauseSignalActivations, ()),
            delay: 48 hours
        });
        operations[9] = AllowedOperation({
            target: address(voter),
            data: abi.encodeCall(TimelockVoterMock.reactivateStrategy, (address(strategy))),
            delay: 48 hours
        });
        operations[10] = AllowedOperation({
            target: address(miningPool),
            data: abi.encodeCall(TimelockMiningPoolMock.unpauseContributions, ()),
            delay: 48 hours
        });
        operations[11] = AllowedOperation({
            target: address(liquidityManager),
            data: abi.encodeCall(TimelockLiquidityManagerMock.migrateLiquidity, (plan)),
            delay: 7 days
        });
        operations[12] = AllowedOperation({
            target: address(liquidityManager),
            data: abi.encodeCall(TimelockLiquidityManagerMock.unpauseMigrations, ()),
            delay: 48 hours
        });
        operations[13] = AllowedOperation({
            target: address(strategy),
            data: abi.encodeCall(TimelockStrategyMock.resetReferenceRate, (1 ether, 1 ether)),
            delay: 48 hours
        });
        operations[14] = AllowedOperation({
            target: address(strategy), data: abi.encodeCall(TimelockStrategyMock.unpauseFills, ()), delay: 48 hours
        });
    }

    function _migrationPlan() private view returns (TimelockLiquidityManagerMock.MigrationPlan memory plan) {
        plan.destinationPoolKey = liquidityManager.poolKey();
        plan.removals = new TimelockLiquidityManagerMock.MigrationRemoval[](1);
        plan.removals[0] =
            TimelockLiquidityManagerMock.MigrationRemoval({ positionId: 1, amount0Min: 1, amount1Min: 1 });
        plan.replacements = new TimelockLiquidityManagerMock.MigrationReplacement[](1);
        plan.replacements[0] = TimelockLiquidityManagerMock.MigrationReplacement({
            tickLower: 60, tickUpper: 120, liquidity: 1 ether, amount0Max: 2 ether, amount1Max: 3 ether
        });
        plan.deadline = block.timestamp + 30 days;
    }

    function _truncate(bytes memory data) private pure returns (bytes memory truncated) {
        truncated = new bytes(data.length - 1);
        for (uint256 index; index < truncated.length; ++index) {
            truncated[index] = data[index];
        }
    }
}
