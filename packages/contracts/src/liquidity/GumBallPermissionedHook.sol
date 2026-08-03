// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { Hooks } from "@uniswap/v4-core/src/libraries/Hooks.sol";
import { StateLibrary } from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import { BalanceDelta } from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import { BeforeSwapDelta, BeforeSwapDeltaLibrary } from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolId } from "@uniswap/v4-core/src/types/PoolId.sol";
import { ModifyLiquidityParams, SwapParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { BaseHook } from "@uniswap/v4-periphery/src/utils/BaseHook.sol";

import {
    IUniswapPermissionedMsgSender,
    IUniswapPermissionsAdapter,
    IUniswapPermissionsAdapterFactory,
    PermissionFlag,
    PermissionFlags
} from "../interfaces/IUniswapPermissionedPools.sol";

/// @title GumBallPermissionedHook
/// @notice Standard Uniswap permissioned-pool checks plus one-shot canonical GBX-adapter/USDG initialization.
/// @dev The permission logic is ABI-compatible with Uniswap v4-hooks-public at commit
///      7da5210f2c81a700820a6b4f585264233d91f349. The only protocol-specific extension is the launch guard.
contract GumBallPermissionedHook is BaseHook {
    using StateLibrary for IPoolManager;

    error GumBallPermissionedHook__AlreadyInitialized();
    error GumBallPermissionedHook__InvalidPoolKey();
    error GumBallPermissionedHook__LiquidityManagerAlreadyInitialized();
    error GumBallPermissionedHook__LiquidityManagerMustBeContract(address manager);
    error GumBallPermissionedHook__NoVerifiedAdapter();
    error GumBallPermissionedHook__SwappingDisabled();
    error GumBallPermissionedHook__Unauthorized();
    error GumBallPermissionedHook__UnauthorizedDependencyInitializer(address caller);
    error GumBallPermissionedHook__UnauthorizedInitializer(address sender);
    error GumBallPermissionedHook__UnverifiedAdapter();
    error GumBallPermissionedHook__ZeroAddress();

    event GumBallPermissionedHook__CanonicalPoolInitialized(bytes32 indexed poolKeyHash, uint160 sqrtPriceX96);
    event GumBallPermissionedHook__LiquidityManagerInitialized(address indexed liquidityManager);
    event Swap(
        PoolId indexed id,
        address indexed sender,
        int128 amount0,
        int128 amount1,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        int24 tick,
        uint24 fee
    );

    /// @notice Factory used to identify verified permission adapters.
    IUniswapPermissionsAdapterFactory public immutable PERMISSIONS_ADAPTER_FACTORY;
    /// @notice One-use account allowed to bind LiquidityManager.
    address public immutable DEPENDENCY_INITIALIZER;
    /// @notice Canonical sorted first pool currency.
    address public immutable TOKEN0;
    /// @notice Canonical sorted second pool currency.
    address public immutable TOKEN1;
    /// @notice Canonical pool fee in hundredths of a basis point.
    uint24 public immutable POOL_FEE;
    /// @notice Canonical pool tick spacing.
    int24 public immutable TICK_SPACING;

    /// @notice Whether the canonical PoolKey has completed its one permitted initialization.
    bool public canonicalPoolInitialized;
    /// @notice Protocol LiquidityManager authorized to initialize the canonical PoolKey.
    address public liquidityManager;

    /// @notice Constructs the canonical permissioned-pool hook and launch guard.
    /// @param poolManager_ Canonical v4 PoolManager.
    /// @param permissionsAdapterFactory_ Factory used to identify verified adapters.
    /// @param dependencyInitializer_ One-use account permitted to bind LiquidityManager.
    /// @param gbxPermissionsAdapter_ Pool-facing GBX permission adapter.
    /// @param usdG_ Canonical USDG currency.
    /// @param poolFee_ Canonical v4 fee.
    /// @param tickSpacing_ Canonical v4 tick spacing.
    constructor(
        IPoolManager poolManager_,
        IUniswapPermissionsAdapterFactory permissionsAdapterFactory_,
        address dependencyInitializer_,
        address gbxPermissionsAdapter_,
        address usdG_,
        uint24 poolFee_,
        int24 tickSpacing_
    ) BaseHook(poolManager_) {
        if (
            address(permissionsAdapterFactory_) == address(0) || dependencyInitializer_ == address(0)
                || gbxPermissionsAdapter_ == address(0) || usdG_ == address(0)
        ) revert GumBallPermissionedHook__ZeroAddress();
        PERMISSIONS_ADAPTER_FACTORY = permissionsAdapterFactory_;
        DEPENDENCY_INITIALIZER = dependencyInitializer_;
        (TOKEN0, TOKEN1) =
            gbxPermissionsAdapter_ < usdG_ ? (gbxPermissionsAdapter_, usdG_) : (usdG_, gbxPermissionsAdapter_);
        POOL_FEE = poolFee_;
        TICK_SPACING = tickSpacing_;
    }

    /// @notice Permanently binds the only LiquidityManager allowed to initialize the canonical pool.
    /// @param liquidityManager_ Deployed successor LiquidityManager.
    function initializeLiquidityManager(address liquidityManager_) external {
        if (msg.sender != DEPENDENCY_INITIALIZER) {
            revert GumBallPermissionedHook__UnauthorizedDependencyInitializer(msg.sender);
        }
        if (liquidityManager != address(0)) revert GumBallPermissionedHook__LiquidityManagerAlreadyInitialized();
        if (liquidityManager_ == address(0)) revert GumBallPermissionedHook__ZeroAddress();
        if (liquidityManager_.code.length == 0) {
            revert GumBallPermissionedHook__LiquidityManagerMustBeContract(liquidityManager_);
        }
        liquidityManager = liquidityManager_;
        emit GumBallPermissionedHook__LiquidityManagerInitialized(liquidityManager_);
    }

    /// @notice Returns the exact v4 callback permission set implemented by this hook.
    /// @return permissions Enabled callback flags.
    function getHookPermissions() public pure override returns (Hooks.Permissions memory permissions) {
        permissions.beforeInitialize = true;
        permissions.beforeAddLiquidity = true;
        permissions.beforeSwap = true;
        permissions.afterSwap = true;
    }

    function _beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96)
        internal
        override
        returns (bytes4)
    {
        if (sender != liquidityManager) revert GumBallPermissionedHook__UnauthorizedInitializer(sender);
        if (canonicalPoolInitialized) revert GumBallPermissionedHook__AlreadyInitialized();
        if (!_isCanonicalPoolKey(key)) revert GumBallPermissionedHook__InvalidPoolKey();
        _requireVerifiedAdapter(key);

        canonicalPoolInitialized = true;
        emit GumBallPermissionedHook__CanonicalPoolInitialized(keccak256(abi.encode(key)), sqrtPriceX96);
        return IHooks.beforeInitialize.selector;
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata, bytes calldata)
        internal
        view
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        _verifyAllowlist(IUniswapPermissionedMsgSender(sender), key, IHooks.beforeSwap.selector);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(address sender, PoolKey calldata key, SwapParams calldata, BalanceDelta delta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        PoolId id = key.toId();
        (uint160 sqrtPriceX96, int24 tick,, uint24 fee) = poolManager.getSlot0(id);
        uint128 liquidity = poolManager.getLiquidity(id);
        emit Swap(
            id,
            IUniswapPermissionedMsgSender(sender).msgSender(),
            delta.amount0(),
            delta.amount1(),
            sqrtPriceX96,
            liquidity,
            tick,
            fee
        );
        return (IHooks.afterSwap.selector, 0);
    }

    function _beforeAddLiquidity(address sender, PoolKey calldata key, ModifyLiquidityParams calldata, bytes calldata)
        internal
        view
        override
        returns (bytes4)
    {
        _verifyAllowlist(IUniswapPermissionedMsgSender(sender), key, IHooks.beforeAddLiquidity.selector);
        return IHooks.beforeAddLiquidity.selector;
    }

    function _isCanonicalPoolKey(PoolKey calldata key) private view returns (bool) {
        return Currency.unwrap(key.currency0) == TOKEN0 && Currency.unwrap(key.currency1) == TOKEN1
            && key.fee == POOL_FEE && key.tickSpacing == TICK_SPACING && address(key.hooks) == address(this);
    }

    function _requireVerifiedAdapter(PoolKey calldata key) private view {
        address currency0 = Currency.unwrap(key.currency0);
        address currency1 = Currency.unwrap(key.currency1);
        bool currency0IsAdapter = PERMISSIONS_ADAPTER_FACTORY.permissionsAdapterOf(currency0) != address(0);
        bool currency1IsAdapter = PERMISSIONS_ADAPTER_FACTORY.permissionsAdapterOf(currency1) != address(0);
        if (!currency0IsAdapter && !currency1IsAdapter) revert GumBallPermissionedHook__NoVerifiedAdapter();
        if (
            (currency0IsAdapter && PERMISSIONS_ADAPTER_FACTORY.verifiedPermissionsAdapterOf(currency0) == address(0))
                || (currency1IsAdapter
                    && PERMISSIONS_ADAPTER_FACTORY.verifiedPermissionsAdapterOf(currency1) == address(0))
        ) revert GumBallPermissionedHook__UnverifiedAdapter();
    }

    function _verifyAllowlist(IUniswapPermissionedMsgSender sender, PoolKey calldata key, bytes4 selector)
        private
        view
    {
        address account = sender.msgSender();
        _requireAllowed(Currency.unwrap(key.currency0), account, address(sender), selector);
        _requireAllowed(Currency.unwrap(key.currency1), account, address(sender), selector);
    }

    function _requireAllowed(address permissionsAdapter, address account, address wrapper, bytes4 selector)
        private
        view
    {
        if (PERMISSIONS_ADAPTER_FACTORY.verifiedPermissionsAdapterOf(permissionsAdapter) == address(0)) return;

        PermissionFlag permission = PermissionFlags.NONE;
        if (selector == IHooks.beforeSwap.selector) {
            permission = PermissionFlags.SWAP_ALLOWED;
            if (!IUniswapPermissionsAdapter(permissionsAdapter).swappingEnabled()) {
                revert GumBallPermissionedHook__SwappingDisabled();
            }
        } else if (selector == IHooks.beforeAddLiquidity.selector) {
            permission = PermissionFlags.LIQUIDITY_ALLOWED;
        }
        if (
            !IUniswapPermissionsAdapter(permissionsAdapter).isAllowed(account, permission)
                || !IUniswapPermissionsAdapter(permissionsAdapter).allowedWrappers(wrapper)
        ) revert GumBallPermissionedHook__Unauthorized();
    }
}
