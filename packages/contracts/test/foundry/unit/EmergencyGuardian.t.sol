// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { EmergencyGuardian } from "../../../src/access/EmergencyGuardian.sol";
import {
    GuardianOperatorMock,
    GuardianLiquidityManagerMock,
    GuardianMiningMock,
    GuardianPermissionedPoolControllerMock,
    GuardianRegistryMock,
    GuardianStrategyMock,
    GuardianVoterMock
} from "../mocks/EmergencyGuardianMocks.sol";

contract EmergencyGuardianTest is Test {
    address private constant OUTSIDER = address(0xBAD);
    address private constant ASSET = address(0xA11);
    address private constant ASSET_STRATEGY = address(0xA15);

    EmergencyGuardian private guardian;
    GuardianMiningMock private mining;
    GuardianStrategyMock private strategy;
    GuardianRegistryMock private registry;
    GuardianVoterMock private voter;
    GuardianLiquidityManagerMock private liquidityManager;
    GuardianOperatorMock private operator;
    GuardianOperatorMock private replacementOperator;
    GuardianPermissionedPoolControllerMock private permissionedPoolController;

    function setUp() public {
        operator = new GuardianOperatorMock();
        replacementOperator = new GuardianOperatorMock();
        guardian = new EmergencyGuardian(address(this), address(operator));
        mining = new GuardianMiningMock();
        strategy = new GuardianStrategyMock();
        registry = new GuardianRegistryMock();
        registry.setStrategyForToken(ASSET, ASSET_STRATEGY);
        voter = new GuardianVoterMock();
        registry.setWiring(address(this), address(guardian));
        voter.setWiring(address(registry), address(this), address(guardian));
        guardian.initializeTargets(address(registry), address(voter));
        liquidityManager = new GuardianLiquidityManagerMock();
        permissionedPoolController = new GuardianPermissionedPoolControllerMock(address(guardian));
    }

    function test_OperatorCanOnlyInvokeBoundedRiskReductionPaths() public {
        vm.startPrank(address(operator));
        guardian.pauseMiningContributions(address(mining));
        guardian.invalidateMiningEpoch(address(mining));
        guardian.pauseStrategyFills(address(strategy));
        guardian.disableAssetAcquisition(ASSET);
        assertEq(voter.disabledStrategy(), ASSET_STRATEGY);
        guardian.disableStandaloneStrategy(address(0xB0B));
        guardian.pauseSignalActivations();
        guardian.pauseLiquidityMigrations(address(liquidityManager));
        vm.stopPrank();

        assertTrue(mining.paused());
        assertTrue(mining.invalidated());
        assertTrue(strategy.fillsPaused());
        assertEq(registry.disabledAsset(), ASSET);
        assertEq(registry.disabledStandalone(), address(0xB0B));
        assertEq(voter.disabledStrategy(), address(0xB0B));
        assertTrue(voter.activationsPaused());
        assertTrue(liquidityManager.migrationsPaused());
    }

    function test_UnauthorizedAccountCannotUseBreakGlassPaths() public {
        vm.prank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__NotOperator.selector, OUTSIDER));
        guardian.pauseStrategyFills(address(strategy));
    }

    function test_OnlyTimelockRotatesOperator() public {
        vm.prank(address(operator));
        vm.expectRevert(
            abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__NotProtocolTimelock.selector, address(operator))
        );
        guardian.rotateOperator(address(replacementOperator));

        guardian.rotateOperator(address(replacementOperator));
        assertEq(guardian.operator(), address(replacementOperator));
    }

    function test_ConstructorAndRotationRejectCodeLessOperators() public {
        vm.expectRevert(
            abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__TargetMustBeContract.selector, OUTSIDER)
        );
        new EmergencyGuardian(address(this), OUTSIDER);

        vm.expectRevert(
            abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__TargetMustBeContract.selector, OUTSIDER)
        );
        guardian.rotateOperator(OUTSIDER);
    }

    function test_RejectsNonContractTargets() public {
        vm.prank(address(operator));
        vm.expectRevert(
            abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__TargetMustBeContract.selector, OUTSIDER)
        );
        guardian.pauseMiningContributions(OUTSIDER);
    }

    function test_DisableIsAtomicWhenVoterCleanupFails() public {
        voter.setRevertsOnDisable(true);

        vm.prank(address(operator));
        vm.expectRevert(GuardianVoterMock.GuardianVoterMock__ForcedRevert.selector);
        guardian.disableAssetAcquisition(ASSET);

        assertEq(registry.disabledAsset(), address(0));
        assertEq(voter.disabledStrategy(), address(0));
    }

    function test_AssetWithoutStrategyCannotBePartiallyDisabled() public {
        address assetWithoutStrategy = address(0xA550);

        vm.prank(address(operator));
        vm.expectRevert(
            abi.encodeWithSelector(
                EmergencyGuardian.EmergencyGuardian__AssetHasNoStrategy.selector, assetWithoutStrategy
            )
        );
        guardian.disableAssetAcquisition(assetWithoutStrategy);

        assertEq(registry.disabledAsset(), address(0));
    }

    function test_TargetBindingsAreOneShotAndTimelockOnly() public {
        vm.prank(address(operator));
        vm.expectRevert(
            abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__NotProtocolTimelock.selector, address(operator))
        );
        guardian.initializeTargets(address(registry), address(voter));

        vm.expectRevert(EmergencyGuardian.EmergencyGuardian__TargetsAlreadyInitialized.selector);
        guardian.initializeTargets(address(registry), address(voter));
    }

    function test_PermissionedPoolBindingAndStopPathsAreOneShotAndOperatorOnly() public {
        vm.prank(address(operator));
        vm.expectRevert(
            abi.encodeWithSelector(EmergencyGuardian.EmergencyGuardian__NotProtocolTimelock.selector, address(operator))
        );
        guardian.finalizePermissionedPoolController(address(permissionedPoolController));

        guardian.finalizePermissionedPoolController(address(permissionedPoolController));
        assertEq(address(guardian.permissionedPoolController()), address(permissionedPoolController));

        vm.startPrank(address(operator));
        guardian.pausePermissionedPoolSwaps();
        guardian.pausePermissionedPoolLiquidity();
        vm.stopPrank();
        assertTrue(permissionedPoolController.swappingDisabled());
        assertTrue(permissionedPoolController.liquidityDisabled());

        vm.expectRevert(EmergencyGuardian.EmergencyGuardian__PermissionedPoolControllerAlreadyFinalized.selector);
        guardian.finalizePermissionedPoolController(address(0));
    }

    function test_UnrestrictedDeclarationPermanentlyDisablesPermissionedStopPaths() public {
        guardian.finalizePermissionedPoolController(address(0));
        assertTrue(guardian.permissionedPoolControllerFinalized());

        vm.prank(address(operator));
        vm.expectRevert(EmergencyGuardian.EmergencyGuardian__PermissionedPoolControllerNotConfigured.selector);
        guardian.pausePermissionedPoolSwaps();
    }
}
