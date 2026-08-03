// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {
    IAdapterVerificationEscrow,
    IGumBallPermissionedHook,
    IUniswapPermissionedPositionManager,
    IUniswapPermissionsAdapter,
    IUniswapPermissionsAdapterFactory
} from "../interfaces/IUniswapPermissionedPools.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { LiquidityManager } from "./LiquidityManager.sol";

/// @title PermissionedLiquidityManager
/// @notice LiquidityManager variant whose pool-facing GBX currency is a verified Uniswap Permissions Adapter.
/// @dev Accounting, fee burning, and custody continue to use underlying GBX because the adapter unwraps on pool exit.
contract PermissionedLiquidityManager is LiquidityManager {
    using SafeERC20 for IERC20;

    error PermissionedLiquidityManager__AdapterFactoryMismatch(address expected, address actual);
    error PermissionedLiquidityManager__AdapterPoolManagerMismatch(address expected, address actual);
    error PermissionedLiquidityManager__AdapterTokenMismatch(address expected, address actual);
    error PermissionedLiquidityManager__AddressHasNoCode(address account);
    error PermissionedLiquidityManager__HookConfigurationMismatch();
    error PermissionedLiquidityManager__HookLiquidityManagerMismatch(address expected, address actual);
    error PermissionedLiquidityManager__PositionManagerNotAllowedWrapper(address positionManager);
    error PermissionedLiquidityManager__VerificationEscrowMismatch();
    error PermissionedLiquidityManager__VerificationStateMismatch(address expected, address actual);
    error PermissionedLiquidityManager__UnverifiedAdapter(address adapter);

    /// @notice Factory that created and verifies the GBX adapter.
    IUniswapPermissionsAdapterFactory public immutable PERMISSIONS_ADAPTER_FACTORY;
    /// @notice Pool-facing permission adapter backed one-for-one by underlying GBX.
    IUniswapPermissionsAdapter public immutable GBX_PERMISSIONS_ADAPTER;
    /// @notice Fixed-purpose contract that verifies the adapter and recycles its one-wei deposit.
    IAdapterVerificationEscrow public immutable ADAPTER_VERIFICATION_ESCROW;

    /// @notice Constructs the successor manager and validates its complete permissioned-pool graph.
    /// @param dependencies Base LiquidityManager dependency graph.
    /// @param ladder Canonical fee, spacing, allocation, and range ladder.
    /// @param permissionsAdapterFactory_ Factory that created the GBX adapter.
    /// @param gbxPermissionsAdapter_ Pool-facing GBX adapter.
    /// @param adapterVerificationEscrow_ Fixed verification-deposit recycler.
    constructor(
        Dependencies memory dependencies,
        LadderConfig memory ladder,
        IUniswapPermissionsAdapterFactory permissionsAdapterFactory_,
        IUniswapPermissionsAdapter gbxPermissionsAdapter_,
        IAdapterVerificationEscrow adapterVerificationEscrow_
    ) LiquidityManager(dependencies, ladder) {
        if (
            address(permissionsAdapterFactory_).code.length == 0 || address(gbxPermissionsAdapter_).code.length == 0
                || address(adapterVerificationEscrow_).code.length == 0 || dependencies.positionManager.code.length == 0
                || dependencies.launchGuardHook.code.length == 0
        ) {
            address missing = address(permissionsAdapterFactory_).code.length == 0
                ? address(permissionsAdapterFactory_)
                : address(gbxPermissionsAdapter_).code.length == 0
                    ? address(gbxPermissionsAdapter_)
                    : address(adapterVerificationEscrow_).code.length == 0
                        ? address(adapterVerificationEscrow_)
                        : dependencies.positionManager.code.length == 0
                            ? dependencies.positionManager
                            : dependencies.launchGuardHook;
            revert PermissionedLiquidityManager__AddressHasNoCode(missing);
        }

        address factoryPoolManager = permissionsAdapterFactory_.POOL_MANAGER();
        if (factoryPoolManager != dependencies.poolManager) {
            revert PermissionedLiquidityManager__AdapterPoolManagerMismatch(
                dependencies.poolManager, factoryPoolManager
            );
        }
        address adapterPoolManager = gbxPermissionsAdapter_.POOL_MANAGER();
        if (adapterPoolManager != dependencies.poolManager) {
            revert PermissionedLiquidityManager__AdapterPoolManagerMismatch(
                dependencies.poolManager, adapterPoolManager
            );
        }
        address permissionedToken = address(gbxPermissionsAdapter_.PERMISSIONED_TOKEN());
        if (permissionedToken != dependencies.gbx) {
            revert PermissionedLiquidityManager__AdapterTokenMismatch(dependencies.gbx, permissionedToken);
        }
        if (permissionsAdapterFactory_.permissionsAdapterOf(address(gbxPermissionsAdapter_)) != dependencies.gbx) {
            revert PermissionedLiquidityManager__UnverifiedAdapter(address(gbxPermissionsAdapter_));
        }
        address verifiedToken = permissionsAdapterFactory_.verifiedPermissionsAdapterOf(address(gbxPermissionsAdapter_));
        if (verifiedToken != address(0)) {
            revert PermissionedLiquidityManager__VerificationStateMismatch(address(0), verifiedToken);
        }

        address positionManagerFactory =
            address(IUniswapPermissionedPositionManager(dependencies.positionManager).PERMISSIONS_ADAPTER_FACTORY());
        if (positionManagerFactory != address(permissionsAdapterFactory_)) {
            revert PermissionedLiquidityManager__AdapterFactoryMismatch(
                address(permissionsAdapterFactory_), positionManagerFactory
            );
        }
        if (!gbxPermissionsAdapter_.allowedWrappers(dependencies.positionManager)) {
            revert PermissionedLiquidityManager__PositionManagerNotAllowedWrapper(dependencies.positionManager);
        }
        if (!gbxPermissionsAdapter_.allowedWrappers(address(adapterVerificationEscrow_))) {
            revert PermissionedLiquidityManager__PositionManagerNotAllowedWrapper(address(adapterVerificationEscrow_));
        }

        IGumBallPermissionedHook hook = IGumBallPermissionedHook(dependencies.launchGuardHook);
        address hookFactory = address(hook.PERMISSIONS_ADAPTER_FACTORY());
        (address expected0, address expected1) = address(gbxPermissionsAdapter_) < dependencies.usdG
            ? (address(gbxPermissionsAdapter_), dependencies.usdG)
            : (dependencies.usdG, address(gbxPermissionsAdapter_));
        if (
            hookFactory != address(permissionsAdapterFactory_) || hook.TOKEN0() != expected0
                || hook.TOKEN1() != expected1 || hook.POOL_FEE() != ladder.poolFee
                || hook.TICK_SPACING() != ladder.tickSpacing || hook.DEPENDENCY_INITIALIZER() == address(0)
                || hook.DEPENDENCY_INITIALIZER() != adapterVerificationEscrow_.DEPENDENCY_INITIALIZER()
                || hook.liquidityManager() != address(0)
        ) revert PermissionedLiquidityManager__HookConfigurationMismatch();
        if (
            adapterVerificationEscrow_.POOL_MANAGER() != dependencies.poolManager
                || address(adapterVerificationEscrow_.PERMISSIONS_ADAPTER()) != address(gbxPermissionsAdapter_)
                || address(adapterVerificationEscrow_.PERMISSIONS_ADAPTER_FACTORY())
                    != address(permissionsAdapterFactory_)
                || adapterVerificationEscrow_.POSITION_MANAGER() != dependencies.positionManager
                || adapterVerificationEscrow_.PERMISSIONED_HOOK() != dependencies.launchGuardHook
                || adapterVerificationEscrow_.LIQUIDITY_MANAGER() != address(0)
        ) revert PermissionedLiquidityManager__VerificationEscrowMismatch();

        PERMISSIONS_ADAPTER_FACTORY = permissionsAdapterFactory_;
        GBX_PERMISSIONS_ADAPTER = gbxPermissionsAdapter_;
        ADAPTER_VERIFICATION_ESCROW = adapterVerificationEscrow_;
    }

    function _poolGBXCurrency() internal view override returns (address) {
        return address(GBX_PERMISSIONS_ADAPTER);
    }

    function _beforeGenesisPoolInitialization() internal override {
        if (ADAPTER_VERIFICATION_ESCROW.LIQUIDITY_MANAGER() != address(this)) {
            revert PermissionedLiquidityManager__VerificationEscrowMismatch();
        }
        address hookLiquidityManager = IGumBallPermissionedHook(address(LAUNCH_GUARD_HOOK)).liquidityManager();
        if (hookLiquidityManager != address(this)) {
            revert PermissionedLiquidityManager__HookLiquidityManagerMismatch(address(this), hookLiquidityManager);
        }
        IERC20(address(GBX)).forceApprove(address(GBX_PERMISSIONS_ADAPTER), 1);
        GBX_PERMISSIONS_ADAPTER.depositForVerification(1);
        IERC20(address(GBX)).forceApprove(address(GBX_PERMISSIONS_ADAPTER), 0);
        ADAPTER_VERIFICATION_ESCROW.recoverVerificationDeposit();
        uint256 restoredBalance = GBX.balanceOf(address(this));
        if (restoredBalance != GENESIS_LIQUIDITY_ALLOCATION) {
            revert LiquidityManager__GenesisBalanceMismatch(GENESIS_LIQUIDITY_ALLOCATION, restoredBalance);
        }
    }
}
