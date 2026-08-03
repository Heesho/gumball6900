// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { Hooks } from "@uniswap/v4-core/src/libraries/Hooks.sol";
import { BalanceDelta } from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import { BeforeSwapDelta, BeforeSwapDeltaLibrary } from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { ModifyLiquidityParams, SwapParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";

import { GumBallPermissionedHook } from "../../../src/liquidity/GumBallPermissionedHook.sol";
import {
    GumBallPermissionedHookHarness,
    PermissionedMsgSenderMock,
    PermissionedPoolManagerCaller,
    PermissionsAdapterFactoryMock,
    PermissionsAdapterMock,
    PermissionedTokenMock
} from "../mocks/PermissionedPoolMocks.sol";

contract GumBallPermissionedHookTest is Test {
    address private constant LIQUIDITY_MANAGER = address(0x6900);
    address private constant TRADER = address(0xA11CE);
    address private constant LP = address(0xB0B);
    uint160 private constant Q96 = 1 << 96;

    PermissionedPoolManagerCaller private poolManager;
    PermissionedTokenMock private gbx;
    PermissionedTokenMock private usdG;
    PermissionsAdapterFactoryMock private factory;
    PermissionsAdapterMock private adapter;
    PermissionedMsgSenderMock private wrapper;
    GumBallPermissionedHookHarness private hook;

    function setUp() public {
        poolManager = new PermissionedPoolManagerCaller();
        gbx = new PermissionedTokenMock("Gum Ball 6900", "GBX");
        usdG = new PermissionedTokenMock("Global Dollar", "USDG");
        factory = new PermissionsAdapterFactoryMock(address(poolManager));
        adapter = new PermissionsAdapterMock(address(poolManager), gbx);
        factory.setAdapter(address(adapter), address(gbx), true);
        wrapper = new PermissionedMsgSenderMock(TRADER);
        adapter.setAllowedWrapper(address(wrapper), true);
        adapter.setPermission(TRADER, 0x0001);
        adapter.setPermission(LP, 0x0002);
        adapter.setSwappingEnabled(true);

        hook = new GumBallPermissionedHookHarness(
            IPoolManager(address(poolManager)), factory, address(this), address(adapter), address(usdG), 3_000, 60
        );
        vm.etch(LIQUIDITY_MANAGER, hex"00");
        hook.initializeLiquidityManager(LIQUIDITY_MANAGER);
    }

    function test_PermissionBitsMatchStandardGraph() public view {
        Hooks.Permissions memory permissions = hook.getHookPermissions();
        assertTrue(permissions.beforeInitialize);
        assertTrue(permissions.beforeAddLiquidity);
        assertTrue(permissions.beforeSwap);
        assertTrue(permissions.afterSwap);
        assertFalse(permissions.afterInitialize);
        assertFalse(permissions.beforeRemoveLiquidity);
        assertFalse(permissions.afterRemoveLiquidity);
        assertFalse(permissions.beforeDonate);
        assertFalse(permissions.afterDonate);
    }

    function test_CanonicalInitializationRequiresLiquidityManagerAndVerifiedAdapter() public {
        PoolKey memory key = _canonicalKey();
        vm.expectRevert(
            abi.encodeWithSelector(
                GumBallPermissionedHook.GumBallPermissionedHook__UnauthorizedInitializer.selector, address(this)
            )
        );
        poolManager.beforeInitialize(hook, address(this), key, Q96);

        assertEq(poolManager.beforeInitialize(hook, LIQUIDITY_MANAGER, key, Q96), IHooks.beforeInitialize.selector);
        assertTrue(hook.canonicalPoolInitialized());

        vm.expectRevert(GumBallPermissionedHook.GumBallPermissionedHook__AlreadyInitialized.selector);
        poolManager.beforeInitialize(hook, LIQUIDITY_MANAGER, key, Q96);
    }

    function test_InitializationRejectsWrongKeyAndUnverifiedAdapter() public {
        PoolKey memory key = _canonicalKey();
        key.fee = 500;
        vm.expectRevert(GumBallPermissionedHook.GumBallPermissionedHook__InvalidPoolKey.selector);
        poolManager.beforeInitialize(hook, LIQUIDITY_MANAGER, key, Q96);

        key = _canonicalKey();
        factory.setAdapter(address(adapter), address(gbx), false);
        vm.expectRevert(GumBallPermissionedHook.GumBallPermissionedHook__UnverifiedAdapter.selector);
        poolManager.beforeInitialize(hook, LIQUIDITY_MANAGER, key, Q96);
    }

    function test_SwapRequiresPermissionApprovedWrapperAndEnabledTrading() public {
        SwapParams memory params =
            SwapParams({ zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: Q96 - 1 });
        (bytes4 selector, BeforeSwapDelta delta, uint24 feeOverride) =
            poolManager.beforeSwap(hook, address(wrapper), _canonicalKey(), params);
        assertEq(selector, IHooks.beforeSwap.selector);
        assertEq(BeforeSwapDelta.unwrap(delta), BeforeSwapDelta.unwrap(BeforeSwapDeltaLibrary.ZERO_DELTA));
        assertEq(feeOverride, 0);

        wrapper.setReportedSender(address(0xBAD));
        vm.expectRevert(GumBallPermissionedHook.GumBallPermissionedHook__Unauthorized.selector);
        poolManager.beforeSwap(hook, address(wrapper), _canonicalKey(), params);

        wrapper.setReportedSender(TRADER);
        adapter.setAllowedWrapper(address(wrapper), false);
        vm.expectRevert(GumBallPermissionedHook.GumBallPermissionedHook__Unauthorized.selector);
        poolManager.beforeSwap(hook, address(wrapper), _canonicalKey(), params);

        adapter.setAllowedWrapper(address(wrapper), true);
        adapter.setSwappingEnabled(false);
        vm.expectRevert(GumBallPermissionedHook.GumBallPermissionedHook__SwappingDisabled.selector);
        poolManager.beforeSwap(hook, address(wrapper), _canonicalKey(), params);
    }

    function test_AddLiquidityUsesIndependentLiquidityPermission() public {
        ModifyLiquidityParams memory params =
            ModifyLiquidityParams({ tickLower: -120, tickUpper: 120, liquidityDelta: 1 ether, salt: bytes32(0) });

        wrapper.setReportedSender(LP);
        assertEq(
            poolManager.beforeAddLiquidity(hook, address(wrapper), _canonicalKey(), params),
            IHooks.beforeAddLiquidity.selector
        );

        wrapper.setReportedSender(TRADER);
        vm.expectRevert(GumBallPermissionedHook.GumBallPermissionedHook__Unauthorized.selector);
        poolManager.beforeAddLiquidity(hook, address(wrapper), _canonicalKey(), params);
    }

    function test_LiquidityManagerBindingIsOneShotAndRequiresCode() public {
        GumBallPermissionedHookHarness fresh = new GumBallPermissionedHookHarness(
            IPoolManager(address(poolManager)), factory, address(this), address(adapter), address(usdG), 3_000, 60
        );
        address noCode = address(0xDEAD);
        vm.expectRevert(
            abi.encodeWithSelector(
                GumBallPermissionedHook.GumBallPermissionedHook__LiquidityManagerMustBeContract.selector, noCode
            )
        );
        fresh.initializeLiquidityManager(noCode);

        fresh.initializeLiquidityManager(address(poolManager));
        vm.expectRevert(GumBallPermissionedHook.GumBallPermissionedHook__LiquidityManagerAlreadyInitialized.selector);
        fresh.initializeLiquidityManager(address(poolManager));
    }

    function test_LiquidityManagerBindingRejectsUnauthorizedInitializer() public {
        GumBallPermissionedHookHarness fresh = new GumBallPermissionedHookHarness(
            IPoolManager(address(poolManager)), factory, address(this), address(adapter), address(usdG), 3_000, 60
        );
        vm.prank(address(0xBAD));
        vm.expectRevert(
            abi.encodeWithSelector(
                GumBallPermissionedHook.GumBallPermissionedHook__UnauthorizedDependencyInitializer.selector,
                address(0xBAD)
            )
        );
        fresh.initializeLiquidityManager(address(poolManager));
    }

    function test_AfterSwapUsesTheStandardCallbackReturnShape() public {
        SwapParams memory params =
            SwapParams({ zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: Q96 - 1 });
        (bytes4 selector, int128 hookDelta) =
            poolManager.afterSwap(hook, address(wrapper), _canonicalKey(), params, BalanceDelta.wrap(0));
        assertEq(selector, IHooks.afterSwap.selector);
        assertEq(hookDelta, 0);
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
}
