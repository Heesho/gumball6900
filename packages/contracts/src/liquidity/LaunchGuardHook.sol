// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { Hooks } from "@uniswap/v4-core/src/libraries/Hooks.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { BaseHook } from "@uniswap/v4-periphery/src/utils/BaseHook.sol";

/// @title LaunchGuardHook
/// @notice Minimal non-upgradeable guard that permits exactly one canonical pool initialization by LiquidityManager.
/// @dev It has no swap-time, liquidity-time, donation-time, fee, or arbitrary-call behavior.
contract LaunchGuardHook is BaseHook {
    error LaunchGuardHook__AlreadyInitialized();
    error LaunchGuardHook__LiquidityManagerAlreadyInitialized();
    error LaunchGuardHook__LiquidityManagerMustBeContract(address manager);
    error LaunchGuardHook__InvalidPoolKey();
    error LaunchGuardHook__UnauthorizedDependencyInitializer(address caller);
    error LaunchGuardHook__UnauthorizedInitializer(address sender);
    error LaunchGuardHook__ZeroAddress();

    event LaunchGuardHook__CanonicalPoolInitialized(bytes32 indexed poolKeyHash, uint160 sqrtPriceX96);
    event LaunchGuardHook__LiquidityManagerInitialized(address indexed liquidityManager);

    /// @notice One-use account permitted to bind the canonical LiquidityManager.
    address public immutable DEPENDENCY_INITIALIZER;
    /// @notice Lower-address currency of the canonical sorted GBX/USDG pair.
    address public immutable TOKEN0;
    /// @notice Higher-address currency of the canonical sorted GBX/USDG pair.
    address public immutable TOKEN1;
    /// @notice Immutable canonical v4 pool fee tier.
    uint24 public immutable POOL_FEE;
    /// @notice Immutable canonical v4 pool tick spacing.
    int24 public immutable TICK_SPACING;

    /// @notice Whether the one permitted canonical pool initialization has completed.
    bool public canonicalPoolInitialized;
    /// @notice Canonical LiquidityManager bound before pool initialization.
    address public liquidityManager;

    /// @notice Wires one PoolManager, LiquidityManager, sorted GBX/USDG pair, fee, and tick spacing.
    /// @param poolManager_ The canonical Uniswap v4 PoolManager.
    /// @param dependencyInitializer_ The one-use account permitted to bind LiquidityManager.
    /// @param gbx_ The canonical GBX token.
    /// @param usdG_ The canonical USDG token.
    /// @param poolFee_ The immutable canonical pool fee tier.
    /// @param tickSpacing_ The immutable canonical pool tick spacing.
    constructor(
        IPoolManager poolManager_,
        address dependencyInitializer_,
        address gbx_,
        address usdG_,
        uint24 poolFee_,
        int24 tickSpacing_
    ) BaseHook(poolManager_) {
        if (dependencyInitializer_ == address(0) || gbx_ == address(0) || usdG_ == address(0)) {
            revert LaunchGuardHook__ZeroAddress();
        }
        DEPENDENCY_INITIALIZER = dependencyInitializer_;
        (TOKEN0, TOKEN1) = gbx_ < usdG_ ? (gbx_, usdG_) : (usdG_, gbx_);
        POOL_FEE = poolFee_;
        TICK_SPACING = tickSpacing_;
    }

    /// @notice Resolves the hook-manager construction cycle exactly once before canonical pool initialization.
    /// @param liquidityManager_ The deployed canonical LiquidityManager contract.
    function initializeLiquidityManager(address liquidityManager_) external {
        if (msg.sender != DEPENDENCY_INITIALIZER) {
            revert LaunchGuardHook__UnauthorizedDependencyInitializer(msg.sender);
        }
        if (liquidityManager != address(0)) revert LaunchGuardHook__LiquidityManagerAlreadyInitialized();
        if (liquidityManager_ == address(0)) revert LaunchGuardHook__ZeroAddress();
        if (liquidityManager_.code.length == 0) {
            revert LaunchGuardHook__LiquidityManagerMustBeContract(liquidityManager_);
        }
        liquidityManager = liquidityManager_;
        emit LaunchGuardHook__LiquidityManagerInitialized(liquidityManager_);
    }

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory permissions) {
        permissions.beforeInitialize = true;
    }

    /// @notice Allows only LiquidityManager to initialize exactly the intended PoolKey.
    function _beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96)
        internal
        override
        returns (bytes4)
    {
        if (sender != liquidityManager) revert LaunchGuardHook__UnauthorizedInitializer(sender);
        if (canonicalPoolInitialized) revert LaunchGuardHook__AlreadyInitialized();
        if (
            Currency.unwrap(key.currency0) != TOKEN0 || Currency.unwrap(key.currency1) != TOKEN1 || key.fee != POOL_FEE
                || key.tickSpacing != TICK_SPACING || address(key.hooks) != address(this)
        ) revert LaunchGuardHook__InvalidPoolKey();

        canonicalPoolInitialized = true;
        emit LaunchGuardHook__CanonicalPoolInitialized(keccak256(abi.encode(key)), sqrtPriceX96);
        return IHooks.beforeInitialize.selector;
    }
}
