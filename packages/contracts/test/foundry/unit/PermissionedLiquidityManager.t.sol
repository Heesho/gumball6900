// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";

import {
    IAdapterVerificationEscrow,
    IUniswapPermissionsAdapter,
    IUniswapPermissionsAdapterFactory
} from "../../../src/interfaces/IUniswapPermissionedPools.sol";
import { AdapterVerificationEscrow } from "../../../src/liquidity/AdapterVerificationEscrow.sol";
import { GenesisLiquidityCalculator } from "../../../src/liquidity/GenesisLiquidityCalculator.sol";
import { LiquidityManager } from "../../../src/liquidity/LiquidityManager.sol";
import { PermissionedLiquidityManager } from "../../../src/liquidity/PermissionedLiquidityManager.sol";
import {
    GumBallPermissionedHookHarness,
    PermissionedPoolManagerCaller,
    PermissionedPositionManagerBoundaryMock,
    PermissionsAdapterFactoryMock,
    PermissionsAdapterMock,
    PermissionedTokenMock
} from "../mocks/PermissionedPoolMocks.sol";

contract PermissionedLiquidityManagerHarness is PermissionedLiquidityManager {
    constructor(
        Dependencies memory dependencies,
        LadderConfig memory ladder,
        IUniswapPermissionsAdapterFactory factory,
        IUniswapPermissionsAdapter adapter,
        IAdapterVerificationEscrow escrow
    ) PermissionedLiquidityManager(dependencies, ladder, factory, adapter, escrow) { }

    function preparePermissionedGraph() external {
        _beforeGenesisPoolInitialization();
    }
}

contract PermissionedLiquidityManagerTest is Test {
    PermissionedPoolManagerCaller private poolManager;
    PermissionedTokenMock private gbx;
    PermissionedTokenMock private usdG;
    PermissionsAdapterFactoryMock private factory;
    PermissionsAdapterMock private adapter;
    PermissionedPositionManagerBoundaryMock private positionManager;
    GumBallPermissionedHookHarness private hook;
    GenesisLiquidityCalculator private calculator;
    AdapterVerificationEscrow private escrow;

    function setUp() public {
        poolManager = new PermissionedPoolManagerCaller();
        gbx = new PermissionedTokenMock("Gum Ball 6900", "GBX");
        usdG = new PermissionedTokenMock("Global Dollar", "USDG");
        factory = new PermissionsAdapterFactoryMock(address(poolManager));
        adapter = new PermissionsAdapterMock(address(poolManager), gbx);
        factory.setAdapter(address(adapter), address(gbx), false);
        positionManager = new PermissionedPositionManagerBoundaryMock(factory);
        adapter.setAllowedWrapper(address(positionManager), true);
        hook = new GumBallPermissionedHookHarness(
            IPoolManager(address(poolManager)), factory, address(this), address(adapter), address(usdG), 3_000, 60
        );
        positionManager.setAllowedHook(address(adapter), address(hook), true);
        escrow = new AdapterVerificationEscrow(
            IPoolManager(address(poolManager)), adapter, factory, address(positionManager), address(hook), address(this)
        );
        adapter.setAllowedWrapper(address(escrow), true);
        calculator = new GenesisLiquidityCalculator();
    }

    function test_BindsUnverifiedGraphAndUsesAdapterAsPoolCurrency() public {
        PermissionedLiquidityManager manager = _deploy();
        PoolKey memory key = manager.poolKey();
        (address token0, address token1) =
            address(adapter) < address(usdG) ? (address(adapter), address(usdG)) : (address(usdG), address(adapter));

        assertEq(Currency.unwrap(key.currency0), token0);
        assertEq(Currency.unwrap(key.currency1), token1);
        assertEq(address(key.hooks), address(hook));
        assertEq(address(manager.GBX()), address(gbx));
        assertEq(address(manager.GBX_PERMISSIONS_ADAPTER()), address(adapter));
        assertEq(address(manager.PERMISSIONS_ADAPTER_FACTORY()), address(factory));
        assertEq(address(manager.ADAPTER_VERIFICATION_ESCROW()), address(escrow));
    }

    function test_RejectsAdapterVerifiedBeforeAtomicGenesis() public {
        factory.setAdapter(address(adapter), address(gbx), true);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedLiquidityManager.PermissionedLiquidityManager__VerificationStateMismatch.selector,
                address(0),
                address(gbx)
            )
        );
        _deploy();
    }

    function test_RejectsPositionManagerThatCannotWrap() public {
        adapter.setAllowedWrapper(address(positionManager), false);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedLiquidityManager.PermissionedLiquidityManager__PositionManagerNotAllowedWrapper.selector,
                address(positionManager)
            )
        );
        _deploy();
    }

    function test_ConstructorRejectsEveryMismatchedPermissionedDependency() public {
        address bad = address(0xBAD);

        vm.mockCall(address(factory), abi.encodeWithSignature("POOL_MANAGER()"), abi.encode(bad));
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedLiquidityManager.PermissionedLiquidityManager__AdapterPoolManagerMismatch.selector,
                address(poolManager),
                bad
            )
        );
        _deploy();
        vm.clearMockedCalls();

        vm.mockCall(address(adapter), abi.encodeWithSignature("POOL_MANAGER()"), abi.encode(bad));
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedLiquidityManager.PermissionedLiquidityManager__AdapterPoolManagerMismatch.selector,
                address(poolManager),
                bad
            )
        );
        _deploy();
        vm.clearMockedCalls();

        vm.mockCall(address(adapter), abi.encodeWithSignature("PERMISSIONED_TOKEN()"), abi.encode(bad));
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedLiquidityManager.PermissionedLiquidityManager__AdapterTokenMismatch.selector,
                address(gbx),
                bad
            )
        );
        _deploy();
        vm.clearMockedCalls();

        factory.setAdapter(address(adapter), address(0), false);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedLiquidityManager.PermissionedLiquidityManager__UnverifiedAdapter.selector, address(adapter)
            )
        );
        _deploy();
        factory.setAdapter(address(adapter), address(gbx), false);

        vm.mockCall(address(positionManager), abi.encodeWithSignature("PERMISSIONS_ADAPTER_FACTORY()"), abi.encode(bad));
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedLiquidityManager.PermissionedLiquidityManager__AdapterFactoryMismatch.selector,
                address(factory),
                bad
            )
        );
        _deploy();
        vm.clearMockedCalls();

        vm.mockCall(address(hook), abi.encodeWithSignature("TOKEN0()"), abi.encode(bad));
        vm.expectRevert(PermissionedLiquidityManager.PermissionedLiquidityManager__HookConfigurationMismatch.selector);
        _deploy();
        vm.clearMockedCalls();

        vm.mockCall(address(escrow), abi.encodeWithSignature("POOL_MANAGER()"), abi.encode(bad));
        vm.expectRevert(PermissionedLiquidityManager.PermissionedLiquidityManager__VerificationEscrowMismatch.selector);
        _deploy();
        vm.clearMockedCalls();
    }

    function test_ConstructorRejectsCodeLessPermissionedDependencies() public {
        address noCode = address(0xDEAD);
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedLiquidityManager.PermissionedLiquidityManager__AddressHasNoCode.selector, noCode
            )
        );
        new PermissionedLiquidityManager(
            _dependencies(),
            _ladder(),
            IUniswapPermissionsAdapterFactory(noCode),
            adapter,
            IAdapterVerificationEscrow(address(escrow))
        );
    }

    function test_VerifiesAdapterAndRecyclesSameWeiWithoutChangingGenesisAllocation() public {
        PermissionedLiquidityManagerHarness manager = _deployHarness();
        adapter.setPermission(address(manager), 0x0002);
        escrow.initializeLiquidityManager(address(manager));
        hook.initializeLiquidityManager(address(manager));
        gbx.mint(address(manager), manager.GENESIS_LIQUIDITY_ALLOCATION());

        manager.preparePermissionedGraph();

        assertEq(factory.verifiedPermissionsAdapterOf(address(adapter)), address(gbx));
        assertEq(gbx.balanceOf(address(manager)), manager.GENESIS_LIQUIDITY_ALLOCATION());
        assertEq(gbx.balanceOf(address(adapter)), 0);
        assertEq(adapter.totalSupply(), 0);
        assertEq(adapter.balanceOf(address(poolManager)), 0);
    }

    function test_RejectsGenesisPreparationWhenTheFullAllocationIsNotRestored() public {
        PermissionedLiquidityManagerHarness manager = _deployHarness();
        adapter.setPermission(address(manager), 0x0002);
        escrow.initializeLiquidityManager(address(manager));
        hook.initializeLiquidityManager(address(manager));
        gbx.mint(address(manager), manager.GENESIS_LIQUIDITY_ALLOCATION() - 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidityManager.LiquidityManager__GenesisBalanceMismatch.selector,
                manager.GENESIS_LIQUIDITY_ALLOCATION(),
                manager.GENESIS_LIQUIDITY_ALLOCATION() - 1
            )
        );
        manager.preparePermissionedGraph();
    }

    function test_RejectsGenesisPreparationUntilHookIsBoundToManager() public {
        PermissionedLiquidityManagerHarness manager = _deployHarness();
        adapter.setPermission(address(manager), 0x0002);
        escrow.initializeLiquidityManager(address(manager));
        gbx.mint(address(manager), manager.GENESIS_LIQUIDITY_ALLOCATION());

        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedLiquidityManager.PermissionedLiquidityManager__HookLiquidityManagerMismatch.selector,
                address(manager),
                address(0)
            )
        );
        manager.preparePermissionedGraph();
    }

    function test_RejectsGenesisPreparationWithoutLiquidityPermission() public {
        PermissionedLiquidityManagerHarness manager = _deployHarness();
        escrow.initializeLiquidityManager(address(manager));
        hook.initializeLiquidityManager(address(manager));
        gbx.mint(address(manager), manager.GENESIS_LIQUIDITY_ALLOCATION());

        vm.expectRevert(
            abi.encodeWithSelector(
                AdapterVerificationEscrow.AdapterVerificationEscrow__LiquidityPermissionMissing.selector,
                address(manager)
            )
        );
        manager.preparePermissionedGraph();
    }

    function test_RejectsGenesisPreparationWithoutAllowedHook() public {
        PermissionedLiquidityManagerHarness manager = _deployHarness();
        adapter.setPermission(address(manager), 0x0002);
        escrow.initializeLiquidityManager(address(manager));
        hook.initializeLiquidityManager(address(manager));
        positionManager.setAllowedHook(address(adapter), address(hook), false);
        gbx.mint(address(manager), manager.GENESIS_LIQUIDITY_ALLOCATION());

        vm.expectRevert(
            abi.encodeWithSelector(
                AdapterVerificationEscrow.AdapterVerificationEscrow__PositionManagerHookNotAllowed.selector,
                address(hook)
            )
        );
        manager.preparePermissionedGraph();
    }

    function test_EscrowBindingAndCallbackAreStrictlyAuthorized() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(
            abi.encodeWithSelector(
                AdapterVerificationEscrow.AdapterVerificationEscrow__UnauthorizedDependencyInitializer.selector,
                address(0xBAD)
            )
        );
        escrow.initializeLiquidityManager(address(poolManager));

        vm.expectRevert(
            abi.encodeWithSelector(
                AdapterVerificationEscrow.AdapterVerificationEscrow__LiquidityManagerMustBeContract.selector,
                address(0xDEAD)
            )
        );
        escrow.initializeLiquidityManager(address(0xDEAD));

        escrow.initializeLiquidityManager(address(poolManager));
        vm.expectRevert(AdapterVerificationEscrow.AdapterVerificationEscrow__AlreadyInitialized.selector);
        escrow.initializeLiquidityManager(address(poolManager));

        vm.expectRevert(
            abi.encodeWithSelector(
                AdapterVerificationEscrow.AdapterVerificationEscrow__NotLiquidityManager.selector, address(this)
            )
        );
        escrow.recoverVerificationDeposit();

        vm.expectRevert(
            abi.encodeWithSelector(
                AdapterVerificationEscrow.AdapterVerificationEscrow__NotPoolManager.selector, address(this)
            )
        );
        escrow.unlockCallback(bytes(""));
    }

    function test_EscrowRejectsZeroDependencyAndPreverifiedAdapter() public {
        vm.expectRevert(AdapterVerificationEscrow.AdapterVerificationEscrow__ZeroAddress.selector);
        new AdapterVerificationEscrow(
            IPoolManager(address(0)), adapter, factory, address(positionManager), address(hook), address(this)
        );

        escrow.initializeLiquidityManager(address(poolManager));
        adapter.setPermission(address(poolManager), 0x0002);
        factory.setAdapter(address(adapter), address(gbx), true);
        vm.prank(address(poolManager));
        vm.expectRevert(
            abi.encodeWithSelector(
                AdapterVerificationEscrow.AdapterVerificationEscrow__VerificationStateMismatch.selector,
                address(0),
                address(gbx)
            )
        );
        escrow.recoverVerificationDeposit();
    }

    function _deploy() private returns (PermissionedLiquidityManager manager) {
        manager = new PermissionedLiquidityManager(
            _dependencies(), _ladder(), factory, adapter, IAdapterVerificationEscrow(address(escrow))
        );
    }

    function _deployHarness() private returns (PermissionedLiquidityManagerHarness manager) {
        manager = new PermissionedLiquidityManagerHarness(
            _dependencies(), _ladder(), factory, adapter, IAdapterVerificationEscrow(address(escrow))
        );
    }

    function _dependencies() private view returns (LiquidityManager.Dependencies memory dependencies) {
        dependencies = LiquidityManager.Dependencies({
            gbx: address(gbx),
            usdG: address(usdG),
            gumBallVault: address(0x1001),
            allocationVoter: address(0x1002),
            poolManager: address(poolManager),
            positionManager: address(positionManager),
            permit2: address(0x1003),
            launchGuardHook: address(hook),
            genesisBootstrap: address(0x1004),
            genesisLiquidityCalculator: address(calculator),
            protocolTimelock: address(0x1005),
            emergencyGuardian: address(0x1006)
        });
    }

    function _ladder() private pure returns (LiquidityManager.LadderConfig memory ladder) {
        ladder = LiquidityManager.LadderConfig({
            poolFee: 3_000,
            tickSpacing: 60,
            allocationBps: [uint16(5_000), 3_000, 1_500, 500],
            cumulativeTickDeltas: [int24(4_080), 10_980, 17_940, 24_900]
        });
    }
}
