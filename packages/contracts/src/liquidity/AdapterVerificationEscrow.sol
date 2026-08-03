// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { IUnlockCallback } from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";

import {
    IUniswapPermissionedPositionManager,
    IUniswapPermissionsAdapter,
    IUniswapPermissionsAdapterFactory,
    PermissionFlags
} from "../interfaces/IUniswapPermissionedPools.sol";

/// @title AdapterVerificationEscrow
/// @notice Recycles the official factory's 1-wei adapter verification deposit back to LiquidityManager.
/// @dev It has one immutable currency, one immutable recipient, no approvals, and no arbitrary amount or call target.
contract AdapterVerificationEscrow is IUnlockCallback {
    /// @notice Exact underlying-token amount used to verify and recycle the adapter deposit.
    uint256 public constant VERIFICATION_DEPOSIT = 1;

    error AdapterVerificationEscrow__AlreadyInitialized();
    error AdapterVerificationEscrow__BalanceMismatch(uint256 expected, uint256 actual);
    error AdapterVerificationEscrow__LiquidityManagerMustBeContract(address manager);
    error AdapterVerificationEscrow__NotLiquidityManager(address caller);
    error AdapterVerificationEscrow__NotPoolManager(address caller);
    error AdapterVerificationEscrow__LiquidityPermissionMissing(address account);
    error AdapterVerificationEscrow__PositionManagerHookNotAllowed(address hook);
    error AdapterVerificationEscrow__SettlementMismatch(uint256 expected, uint256 actual);
    error AdapterVerificationEscrow__UnauthorizedDependencyInitializer(address caller);
    error AdapterVerificationEscrow__ZeroAddress();
    error AdapterVerificationEscrow__VerificationStateMismatch(address expected, address actual);

    event AdapterVerificationEscrow__LiquidityManagerInitialized(address indexed liquidityManager);
    event AdapterVerificationEscrow__VerificationDepositRecovered(address indexed liquidityManager);

    /// @notice Canonical PoolManager used for the fixed unlock sequence.
    IPoolManager public immutable POOL_MANAGER;
    /// @notice GBX permission adapter verified and unwrapped by this contract.
    IUniswapPermissionsAdapter public immutable PERMISSIONS_ADAPTER;
    /// @notice Factory that created and verifies the adapter.
    IUniswapPermissionsAdapterFactory public immutable PERMISSIONS_ADAPTER_FACTORY;
    /// @notice Permissioned Position Manager whose hook allowance is checked.
    address public immutable POSITION_MANAGER;
    /// @notice Canonical hook that the Position Manager must approve.
    address public immutable PERMISSIONED_HOOK;
    /// @notice One-use account allowed to bind LiquidityManager.
    address public immutable DEPENDENCY_INITIALIZER;

    /// @notice LiquidityManager that receives the recycled verification wei.
    address public LIQUIDITY_MANAGER;

    /// @notice Constructs a fixed verification and recycling boundary for one successor graph.
    /// @param poolManager_ Canonical v4 PoolManager.
    /// @param permissionsAdapter_ GBX permission adapter.
    /// @param permissionsAdapterFactory_ Factory that created the adapter.
    /// @param positionManager_ Permissioned Position Manager.
    /// @param permissionedHook_ Canonical GumBallPermissionedHook.
    /// @param dependencyInitializer_ One-use account permitted to bind LiquidityManager.
    constructor(
        IPoolManager poolManager_,
        IUniswapPermissionsAdapter permissionsAdapter_,
        IUniswapPermissionsAdapterFactory permissionsAdapterFactory_,
        address positionManager_,
        address permissionedHook_,
        address dependencyInitializer_
    ) {
        if (
            address(poolManager_) == address(0) || address(permissionsAdapter_) == address(0)
                || address(permissionsAdapterFactory_) == address(0) || positionManager_ == address(0)
                || permissionedHook_ == address(0) || dependencyInitializer_ == address(0)
        ) revert AdapterVerificationEscrow__ZeroAddress();
        POOL_MANAGER = poolManager_;
        PERMISSIONS_ADAPTER = permissionsAdapter_;
        PERMISSIONS_ADAPTER_FACTORY = permissionsAdapterFactory_;
        POSITION_MANAGER = positionManager_;
        PERMISSIONED_HOOK = permissionedHook_;
        DEPENDENCY_INITIALIZER = dependencyInitializer_;
    }

    /// @notice Permanently binds the only LiquidityManager allowed to trigger verification recovery.
    /// @param liquidityManager_ Deployed successor LiquidityManager.
    function initializeLiquidityManager(address liquidityManager_) external {
        if (msg.sender != DEPENDENCY_INITIALIZER) {
            revert AdapterVerificationEscrow__UnauthorizedDependencyInitializer(msg.sender);
        }
        if (LIQUIDITY_MANAGER != address(0)) revert AdapterVerificationEscrow__AlreadyInitialized();
        if (liquidityManager_ == address(0)) revert AdapterVerificationEscrow__ZeroAddress();
        if (liquidityManager_.code.length == 0) {
            revert AdapterVerificationEscrow__LiquidityManagerMustBeContract(liquidityManager_);
        }
        LIQUIDITY_MANAGER = liquidityManager_;
        emit AdapterVerificationEscrow__LiquidityManagerInitialized(liquidityManager_);
    }

    /// @notice Verifies the adapter and atomically recycles its fixed one-wei deposit.
    function recoverVerificationDeposit() external {
        if (msg.sender != LIQUIDITY_MANAGER) revert AdapterVerificationEscrow__NotLiquidityManager(msg.sender);
        address verifiedToken = PERMISSIONS_ADAPTER_FACTORY.verifiedPermissionsAdapterOf(address(PERMISSIONS_ADAPTER));
        if (verifiedToken != address(0)) {
            revert AdapterVerificationEscrow__VerificationStateMismatch(address(0), verifiedToken);
        }
        if (!PERMISSIONS_ADAPTER.isAllowed(LIQUIDITY_MANAGER, PermissionFlags.LIQUIDITY_ALLOWED)) {
            revert AdapterVerificationEscrow__LiquidityPermissionMissing(LIQUIDITY_MANAGER);
        }
        if (!IUniswapPermissionedPositionManager(POSITION_MANAGER)
                .isAllowedHooks(address(PERMISSIONS_ADAPTER), PERMISSIONED_HOOK)) {
            revert AdapterVerificationEscrow__PositionManagerHookNotAllowed(PERMISSIONED_HOOK);
        }
        uint256 balance = PERMISSIONS_ADAPTER.balanceOf(address(POOL_MANAGER));
        if (balance != 0) revert AdapterVerificationEscrow__BalanceMismatch(0, balance);
        PERMISSIONS_ADAPTER_FACTORY.verifyPermissionsAdapter(address(PERMISSIONS_ADAPTER));
        verifiedToken = PERMISSIONS_ADAPTER_FACTORY.verifiedPermissionsAdapterOf(address(PERMISSIONS_ADAPTER));
        address permissionedToken = address(PERMISSIONS_ADAPTER.PERMISSIONED_TOKEN());
        if (verifiedToken != permissionedToken) {
            revert AdapterVerificationEscrow__VerificationStateMismatch(permissionedToken, verifiedToken);
        }
        POOL_MANAGER.unlock(bytes(""));
        balance = PERMISSIONS_ADAPTER.balanceOf(address(POOL_MANAGER));
        if (balance != 0) revert AdapterVerificationEscrow__BalanceMismatch(0, balance);
        emit AdapterVerificationEscrow__VerificationDepositRecovered(LIQUIDITY_MANAGER);
    }

    /// @notice Settles and takes the one adapter wei during the fixed PoolManager unlock.
    /// @return Empty callback result.
    function unlockCallback(bytes calldata) external returns (bytes memory) {
        if (msg.sender != address(POOL_MANAGER)) revert AdapterVerificationEscrow__NotPoolManager(msg.sender);
        Currency currency = Currency.wrap(address(PERMISSIONS_ADAPTER));
        POOL_MANAGER.sync(currency);
        PERMISSIONS_ADAPTER.wrapToPoolManager(VERIFICATION_DEPOSIT);
        uint256 settled = POOL_MANAGER.settle();
        if (settled != VERIFICATION_DEPOSIT) {
            revert AdapterVerificationEscrow__SettlementMismatch(VERIFICATION_DEPOSIT, settled);
        }
        POOL_MANAGER.take(currency, LIQUIDITY_MANAGER, VERIFICATION_DEPOSIT);
        return bytes("");
    }
}
