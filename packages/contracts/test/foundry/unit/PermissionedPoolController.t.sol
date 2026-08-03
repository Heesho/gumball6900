// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";

import {
    IUniswapAllowlistChecker,
    IUniswapPermissionsAdapter,
    PermissionFlag
} from "../../../src/interfaces/IUniswapPermissionedPools.sol";
import { NoopEligibilityModule } from "../../../src/access/NoopEligibilityModule.sol";
import { AdapterVerificationEscrow } from "../../../src/liquidity/AdapterVerificationEscrow.sol";
import { EligibilityAllowlistChecker } from "../../../src/liquidity/EligibilityAllowlistChecker.sol";
import { PermissionedPoolController } from "../../../src/liquidity/PermissionedPoolController.sol";
import {
    GumBallPermissionedHookHarness,
    PermissionedMsgSenderMock,
    PermissionedPoolManagerCaller,
    PermissionedPositionManagerBoundaryMock,
    PermissionsAdapterFactoryMock,
    PermissionsAdapterMock,
    PermissionedTokenMock
} from "../mocks/PermissionedPoolMocks.sol";

contract PermissionedControllerGuardianActor { }

contract PermissionedPoolControllerTest is Test {
    PermissionedPoolManagerCaller private poolManager;
    PermissionedTokenMock private gbx;
    PermissionedTokenMock private usdG;
    NoopEligibilityModule private eligibility;
    EligibilityAllowlistChecker private checker;
    PermissionsAdapterFactoryMock private factory;
    PermissionedPositionManagerBoundaryMock private positionManager;
    PermissionedMsgSenderMock private universalRouter;
    PermissionedMsgSenderMock private v4Quoter;
    PermissionedMsgSenderMock private mixedRouteQuoter;
    PermissionedControllerGuardianActor private guardian;
    PermissionedPoolController private controller;
    PermissionsAdapterMock private adapter;
    GumBallPermissionedHookHarness private hook;
    AdapterVerificationEscrow private escrow;

    function setUp() public {
        poolManager = new PermissionedPoolManagerCaller();
        gbx = new PermissionedTokenMock("Gum Ball 6900", "GBX");
        usdG = new PermissionedTokenMock("Global Dollar", "USDG");
        eligibility = new NoopEligibilityModule();
        checker = new EligibilityAllowlistChecker(address(gbx), eligibility);
        factory = new PermissionsAdapterFactoryMock(address(poolManager));
        positionManager = new PermissionedPositionManagerBoundaryMock(factory);
        universalRouter = new PermissionedMsgSenderMock(address(0xA1));
        v4Quoter = new PermissionedMsgSenderMock(address(0xA2));
        mixedRouteQuoter = new PermissionedMsgSenderMock(address(0xA3));
        guardian = new PermissionedControllerGuardianActor();

        controller = new PermissionedPoolController(
            PermissionedPoolController.Dependencies({
                protocolTimelock: address(this),
                emergencyGuardian: address(guardian),
                dependencyInitializer: address(this),
                gbx: address(gbx),
                usdG: address(usdG),
                permissionsAdapterFactory: address(factory),
                permissionedPositionManager: address(positionManager),
                universalRouter: address(universalRouter),
                v4Quoter: address(v4Quoter),
                mixedRouteQuoterV2: address(mixedRouteQuoter),
                allowListChecker: address(checker)
            })
        );
        controller.createAdapter();
        adapter = PermissionsAdapterMock(address(controller.PERMISSIONS_ADAPTER()));
        hook = new GumBallPermissionedHookHarness(
            IPoolManager(address(poolManager)), factory, address(this), address(adapter), address(usdG), 3_000, 60
        );
        escrow = new AdapterVerificationEscrow(
            IPoolManager(address(poolManager)), adapter, factory, address(positionManager), address(hook), address(this)
        );
    }

    function test_EligibilityCheckerUsesCanonicalGBXAndSupportsOfficialInterface() public view {
        assertEq(PermissionFlag.unwrap(checker.checkAllowlist(address(this), address(gbx))), bytes2(0x0003));
        assertEq(PermissionFlag.unwrap(checker.checkAllowlist(address(this), address(usdG))), bytes2(0));
        assertTrue(checker.supportsInterface(type(IUniswapAllowlistChecker).interfaceId));
        assertTrue(checker.supportsInterface(type(IERC165).interfaceId));
        assertFalse(checker.supportsInterface(bytes4(0xffffffff)));
    }

    function test_EligibilityCheckerConstructorRejectsZeroAndCodeLessDependencies() public {
        vm.expectRevert(EligibilityAllowlistChecker.EligibilityAllowlistChecker__ZeroAddress.selector);
        new EligibilityAllowlistChecker(address(0), eligibility);

        vm.expectRevert(
            abi.encodeWithSelector(
                EligibilityAllowlistChecker.EligibilityAllowlistChecker__AddressHasNoCode.selector, address(0xBEEF)
            )
        );
        new EligibilityAllowlistChecker(address(0xBEEF), eligibility);

        vm.expectRevert(
            abi.encodeWithSelector(
                EligibilityAllowlistChecker.EligibilityAllowlistChecker__AddressHasNoCode.selector, address(0xCAFE)
            )
        );
        new EligibilityAllowlistChecker(address(gbx), NoopEligibilityModule(address(0xCAFE)));
    }

    function test_ControllerConstructorRejectsZeroCodeLessPoolManagerAndFactoryMismatch() public {
        PermissionedPoolController.Dependencies memory dependencies = _dependencies(factory, positionManager);
        dependencies.gbx = address(0);
        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__ZeroAddress.selector);
        new PermissionedPoolController(dependencies);

        dependencies = _dependencies(factory, positionManager);
        dependencies.universalRouter = address(0xBEEF);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedPoolController.PermissionedPoolController__AddressHasNoCode.selector, address(0xBEEF)
            )
        );
        new PermissionedPoolController(dependencies);

        PermissionsAdapterFactoryMock codeLessPoolFactory = new PermissionsAdapterFactoryMock(address(0xCAFE));
        PermissionedPositionManagerBoundaryMock codeLessPoolPositionManager =
            new PermissionedPositionManagerBoundaryMock(codeLessPoolFactory);
        dependencies = _dependencies(codeLessPoolFactory, codeLessPoolPositionManager);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedPoolController.PermissionedPoolController__AddressHasNoCode.selector, address(0xCAFE)
            )
        );
        new PermissionedPoolController(dependencies);

        PermissionsAdapterFactoryMock otherFactory = new PermissionsAdapterFactoryMock(address(poolManager));
        PermissionedPositionManagerBoundaryMock mismatchedPositionManager =
            new PermissionedPositionManagerBoundaryMock(otherFactory);
        dependencies = _dependencies(factory, mismatchedPositionManager);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedPoolController.PermissionedPoolController__AdapterFactoryMismatch.selector,
                address(factory),
                address(otherFactory)
            )
        );
        new PermissionedPoolController(dependencies);
    }

    function test_AdapterCreationIsInitializerOnlyOneShotAndValidatesReturnedGraph() public {
        PermissionedPoolController freshController =
            new PermissionedPoolController(_dependencies(factory, positionManager));

        vm.prank(address(0xBAD));
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedPoolController.PermissionedPoolController__UnauthorizedDependencyInitializer.selector,
                address(0xBAD)
            )
        );
        freshController.createAdapter();

        freshController.createAdapter();
        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__AdapterAlreadyCreated.selector);
        freshController.createAdapter();

        PermissionsAdapterFactoryMock corruptFactory = new PermissionsAdapterFactoryMock(address(poolManager));
        PermissionedPositionManagerBoundaryMock corruptPositionManager =
            new PermissionedPositionManagerBoundaryMock(corruptFactory);
        PermissionedPoolController corruptController =
            new PermissionedPoolController(_dependencies(corruptFactory, corruptPositionManager));
        corruptFactory.setCorruptNewAdapterOwner(true);
        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__GraphMismatch.selector);
        corruptController.createAdapter();
    }

    function test_CreatesAdapterWithControllerAsOwnerAndInitializesOnlyCanonicalGraph() public {
        assertEq(adapter.owner(), address(controller));
        assertEq(address(adapter.PERMISSIONED_TOKEN()), address(gbx));
        assertEq(address(adapter.allowListChecker()), address(checker));
        assertEq(factory.permissionsAdapterOf(address(adapter)), address(gbx));
        assertEq(factory.verifiedPermissionsAdapterOf(address(adapter)), address(0));

        controller.initializeGraph(address(hook), address(escrow));

        assertTrue(controller.graphInitialized());
        assertEq(controller.PERMISSIONED_HOOK(), address(hook));
        assertEq(controller.VERIFICATION_ESCROW(), address(escrow));
        assertTrue(adapter.allowedWrappers(address(positionManager)));
        assertTrue(adapter.allowedWrappers(address(universalRouter)));
        assertTrue(adapter.allowedWrappers(address(v4Quoter)));
        assertTrue(adapter.allowedWrappers(address(mixedRouteQuoter)));
        assertTrue(adapter.allowedWrappers(address(escrow)));
        assertTrue(positionManager.isAllowedHooks(address(adapter), address(hook)));
        assertFalse(adapter.swappingEnabled());

        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__GraphAlreadyInitialized.selector);
        controller.initializeGraph(address(hook), address(escrow));
    }

    function test_InitializeGraphRejectsUnboundAndPostConfigurationMismatches() public {
        PermissionedPoolController freshController =
            new PermissionedPoolController(_dependencies(factory, positionManager));
        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__AdapterNotCreated.selector);
        freshController.initializeGraph(address(hook), address(escrow));

        adapter.setOwner(address(0xBAD));
        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__GraphMismatch.selector);
        controller.initializeGraph(address(hook), address(escrow));
        adapter.setOwner(address(controller));

        positionManager.setIgnoreHookUpdates(true);
        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__GraphMismatch.selector);
        controller.initializeGraph(address(hook), address(escrow));
        positionManager.setIgnoreHookUpdates(false);
    }

    function test_OneShotBootstrapEnableRequiresVerifiedInitializedCanonicalPool() public {
        controller.initializeGraph(address(hook), address(escrow));
        factory.setAdapter(address(adapter), address(gbx), true);

        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__CanonicalPoolNotInitialized.selector);
        controller.enableSwappingAfterGenesis();

        hook.initializeLiquidityManager(address(poolManager));
        poolManager.beforeInitialize(hook, address(poolManager), _canonicalKey(), uint160(1 << 96));
        controller.enableSwappingAfterGenesis();

        assertTrue(adapter.swappingEnabled());
        assertTrue(controller.bootstrapSwapEnableConsumed());
        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__BootstrapEnableAlreadyConsumed.selector);
        controller.enableSwappingAfterGenesis();
    }

    function test_TimelockCanOnlyToggleFixedWrappersHookAndChecker() public {
        controller.initializeGraph(address(hook), address(escrow));
        factory.setAdapter(address(adapter), address(gbx), true);

        controller.setAllowedWrapper(address(universalRouter), false);
        assertFalse(adapter.allowedWrappers(address(universalRouter)));
        controller.setAllowedWrapper(address(universalRouter), true);
        assertTrue(adapter.allowedWrappers(address(universalRouter)));

        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedPoolController.PermissionedPoolController__InvalidWrapper.selector, address(escrow)
            )
        );
        controller.setAllowedWrapper(address(escrow), false);

        controller.setCanonicalHookAllowed(false);
        assertFalse(positionManager.isAllowedHooks(address(adapter), address(hook)));
        controller.setCanonicalHookAllowed(true);
        assertTrue(positionManager.isAllowedHooks(address(adapter), address(hook)));

        EligibilityAllowlistChecker replacement = new EligibilityAllowlistChecker(address(gbx), eligibility);
        controller.updateAllowListChecker(replacement);
        assertEq(address(adapter.allowListChecker()), address(replacement));

        vm.prank(address(0xBAD));
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedPoolController.PermissionedPoolController__NotProtocolTimelock.selector, address(0xBAD)
            )
        );
        controller.setAllowedWrapper(address(universalRouter), false);
    }

    function test_TimelockedSwapRecoveryRequiresLiveVerifiedOwnedCanonicalGraph() public {
        controller.initializeGraph(address(hook), address(escrow));

        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedPoolController.PermissionedPoolController__UnverifiedAdapter.selector, address(adapter)
            )
        );
        controller.setSwappingEnabled(false);

        factory.setAdapter(address(adapter), address(gbx), true);
        adapter.setOwner(address(0xBAD));
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedPoolController.PermissionedPoolController__AdapterOwnerMismatch.selector,
                address(controller),
                address(0xBAD)
            )
        );
        controller.setSwappingEnabled(false);
        adapter.setOwner(address(controller));

        vm.expectRevert(PermissionedPoolController.PermissionedPoolController__CanonicalPoolNotInitialized.selector);
        controller.setSwappingEnabled(true);
        controller.setSwappingEnabled(false);
        assertFalse(adapter.swappingEnabled());

        hook.initializeLiquidityManager(address(poolManager));
        poolManager.beforeInitialize(hook, address(poolManager), _canonicalKey(), uint160(1 << 96));
        controller.setSwappingEnabled(true);
        assertTrue(adapter.swappingEnabled());
    }

    function test_GuardianActionsAreStopOnlyAndGuardianBound() public {
        controller.initializeGraph(address(hook), address(escrow));
        factory.setAdapter(address(adapter), address(gbx), true);
        hook.initializeLiquidityManager(address(poolManager));
        poolManager.beforeInitialize(hook, address(poolManager), _canonicalKey(), uint160(1 << 96));
        controller.enableSwappingAfterGenesis();

        vm.prank(address(guardian));
        controller.emergencyDisableSwapping();
        assertFalse(adapter.swappingEnabled());

        vm.prank(address(guardian));
        controller.emergencyDisableLiquidity();
        assertFalse(positionManager.isAllowedHooks(address(adapter), address(hook)));

        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedPoolController.PermissionedPoolController__NotEmergencyGuardian.selector, address(this)
            )
        );
        controller.emergencyDisableSwapping();
    }

    function _canonicalKey() private view returns (PoolKey memory key) {
        (address token0, address token1) =
            address(adapter) < address(usdG) ? (address(adapter), address(usdG)) : (address(usdG), address(adapter));
        key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3_000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _dependencies(
        PermissionsAdapterFactoryMock factory_,
        PermissionedPositionManagerBoundaryMock positionManager_
    ) private view returns (PermissionedPoolController.Dependencies memory dependencies) {
        dependencies = PermissionedPoolController.Dependencies({
            protocolTimelock: address(this),
            emergencyGuardian: address(guardian),
            dependencyInitializer: address(this),
            gbx: address(gbx),
            usdG: address(usdG),
            permissionsAdapterFactory: address(factory_),
            permissionedPositionManager: address(positionManager_),
            universalRouter: address(universalRouter),
            v4Quoter: address(v4Quoter),
            mixedRouteQuoterV2: address(mixedRouteQuoter),
            allowListChecker: address(checker)
        });
    }
}
