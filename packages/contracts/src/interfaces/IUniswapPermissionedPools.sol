// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @notice ABI-compatible permission flag used by Uniswap v4 permissioned pools.
type PermissionFlag is bytes2;

/// @notice Permission bits defined by the pinned Uniswap permissioned-pools implementation.
library PermissionFlags {
    PermissionFlag internal constant NONE = PermissionFlag.wrap(0x0000);
    PermissionFlag internal constant SWAP_ALLOWED = PermissionFlag.wrap(0x0001);
    PermissionFlag internal constant LIQUIDITY_ALLOWED = PermissionFlag.wrap(0x0002);
}

/// @notice ABI-compatible allowlist boundary used by the pinned Uniswap permissioned-pools implementation.
interface IUniswapAllowlistChecker is IERC165 {
    /// @notice Returns the permission flags granted to an account for one permissioned token.
    /// @param account Account whose permissions are queried.
    /// @param tokenAddress Underlying permissioned token being queried.
    /// @return permissions Permission flags granted to the account.
    function checkAllowlist(address account, address tokenAddress) external view returns (PermissionFlag);
}

/// @notice Minimal verified-adapter factory boundary needed by the protocol.
interface IUniswapPermissionsAdapterFactory {
    /// @notice Returns the bound v4 PoolManager.
    /// @return poolManager Canonical v4 PoolManager address.
    function POOL_MANAGER() external view returns (address);

    /// @notice Creates a fresh adapter whose owner and checker are fixed by the caller.
    /// @param permissionedToken Underlying token represented by the new adapter.
    /// @param initialOwner Initial adapter administrator.
    /// @param allowListChecker Checker used to resolve account permissions.
    /// @return permissionsAdapter Address of the newly created permissions adapter.
    function createPermissionsAdapter(
        IERC20 permissionedToken,
        address initialOwner,
        IUniswapAllowlistChecker allowListChecker
    ) external returns (address permissionsAdapter);

    /// @notice Returns the underlying token recorded for an adapter created by this factory.
    /// @param permissionsAdapter Adapter whose recorded token is queried.
    /// @return permissionedToken Underlying token, or zero for an unknown adapter.
    function permissionsAdapterOf(address permissionsAdapter) external view returns (address permissionedToken);

    /// @notice Returns the underlying token for a verified adapter, or zero before verification.
    /// @param permissionsAdapter Adapter whose verification state is queried.
    /// @return permissionedToken Verified underlying token, or zero before verification.
    function verifiedPermissionsAdapterOf(address permissionsAdapter) external view returns (address permissionedToken);

    /// @notice Verifies an adapter after it holds a nonzero amount of its underlying token.
    /// @param permissionsAdapter Adapter to verify.
    function verifyPermissionsAdapter(address permissionsAdapter) external;
}

/// @notice Minimal permissioned-token adapter boundary needed by the protocol.
interface IUniswapPermissionsAdapter is IERC20 {
    /// @notice Returns the bound v4 PoolManager.
    /// @return poolManager Canonical v4 PoolManager address.
    function POOL_MANAGER() external view returns (address);

    /// @notice Returns the permissioned underlying token.
    /// @return permissionedToken Underlying token represented by this adapter.
    function PERMISSIONED_TOKEN() external view returns (IERC20);

    /// @notice Returns whether a wrapper may report user identity and wrap underlying tokens.
    /// @param wrapper Wrapper address being queried.
    /// @return allowed Whether the wrapper is authorized.
    function allowedWrappers(address wrapper) external view returns (bool);

    /// @notice Returns the checker currently used for account permissions.
    /// @return checker Active allowlist checker.
    function allowListChecker() external view returns (IUniswapAllowlistChecker);

    /// @notice Deposits underlying tokens used by the factory's one-time verification check.
    /// @param amount Underlying-token amount to deposit.
    function depositForVerification(uint256 amount) external;

    /// @notice Returns whether an account has the requested permission flags.
    /// @param account Account whose permissions are queried.
    /// @param permission Permission flags required by the caller.
    /// @return allowed Whether every requested permission is granted.
    function isAllowed(address account, PermissionFlag permission) external view returns (bool);

    /// @notice Returns the adapter administrator.
    /// @return adapterOwner Current adapter owner.
    function owner() external view returns (address);

    /// @notice Returns whether permissioned swaps are enabled.
    /// @return enabled Whether swaps are enabled.
    function swappingEnabled() external view returns (bool);

    /// @notice Replaces the account-permission checker. Only the adapter owner may call this.
    /// @param newAllowListChecker Replacement ERC-165-compatible checker.
    function updateAllowListChecker(IUniswapAllowlistChecker newAllowListChecker) external;

    /// @notice Changes one wrapper authorization. Only the adapter owner may call this.
    /// @param wrapper Wrapper whose authorization changes.
    /// @param allowed Whether the wrapper should be authorized.
    function updateAllowedWrapper(address wrapper, bool allowed) external;

    /// @notice Changes swap availability. Only the adapter owner may call this.
    /// @param enabled Whether permissioned swaps should be enabled.
    function updateSwappingEnabled(bool enabled) external;

    /// @notice Mints adapter currency to PoolManager against available underlying custody.
    /// @param amount Adapter-currency amount to mint to PoolManager.
    function wrapToPoolManager(uint256 amount) external;
}

/// @notice Sender-reporting boundary required by the standard permissioned hook.
interface IUniswapPermissionedMsgSender {
    /// @notice Returns the end-user identity reported by an approved wrapper.
    /// @return sender End-user identity for the active wrapper call.
    function msgSender() external view returns (address);
}

/// @notice Minimal position-manager boundary used to bind the adapter factory.
interface IUniswapPermissionedPositionManager {
    /// @notice Returns the factory used to recognize verified permission adapters.
    /// @return permissionsAdapterFactory Bound adapter factory.
    function PERMISSIONS_ADAPTER_FACTORY() external view returns (IUniswapPermissionsAdapterFactory);

    /// @notice Returns whether a hook is approved for a permissioned currency.
    /// @param currency Permission-adapter currency.
    /// @param hooks Hook address being queried.
    /// @return allowed Whether the hook is approved for the currency.
    function isAllowedHooks(address currency, address hooks) external view returns (bool);

    /// @notice Changes the one hook allowance for a permissioned adapter currency.
    /// @param currency Permission-adapter currency.
    /// @param hooks Hook whose allowance changes.
    /// @param allowed Whether the hook should be approved.
    function setAllowedHook(address currency, address hooks, bool allowed) external;
}

/// @notice Minimal hook boundary used to bind the adapter factory and canonical pool configuration.
interface IGumBallPermissionedHook {
    /// @notice Returns whether the one canonical initialization has completed.
    /// @return initialized Whether the canonical pool was initialized.
    function canonicalPoolInitialized() external view returns (bool);

    /// @notice Returns the one-use dependency initializer.
    /// @return dependencyInitializer Address authorized for dependency initialization.
    function DEPENDENCY_INITIALIZER() external view returns (address);

    /// @notice Returns the adapter factory used by the hook.
    /// @return permissionsAdapterFactory Canonical permissions-adapter factory.
    function PERMISSIONS_ADAPTER_FACTORY() external view returns (IUniswapPermissionsAdapterFactory);

    /// @notice Returns the canonical pool fee.
    /// @return poolFee Fee tier encoded in the canonical pool key.
    function POOL_FEE() external view returns (uint24);

    /// @notice Returns the canonical pool tick spacing.
    /// @return tickSpacing Tick spacing encoded in the canonical pool key.
    function TICK_SPACING() external view returns (int24);

    /// @notice Returns the canonical sorted first currency.
    /// @return token0 Lower-address currency in the canonical pool key.
    function TOKEN0() external view returns (address);

    /// @notice Returns the canonical sorted second currency.
    /// @return token1 Higher-address currency in the canonical pool key.
    function TOKEN1() external view returns (address);

    /// @notice Returns the bound protocol liquidity manager.
    /// @return manager LiquidityManager address, or zero before dependency initialization.
    function liquidityManager() external view returns (address);
}

/// @notice Minimal one-purpose verification-deposit recycler boundary.
interface IAdapterVerificationEscrow {
    /// @notice Returns the one-use dependency initializer.
    /// @return dependencyInitializer Address authorized for dependency initialization.
    function DEPENDENCY_INITIALIZER() external view returns (address);

    /// @notice Returns the bound protocol liquidity manager.
    /// @return manager LiquidityManager address, or zero before dependency initialization.
    function LIQUIDITY_MANAGER() external view returns (address);

    /// @notice Returns the permission adapter whose verification wei is recycled.
    /// @return permissionsAdapter Canonical GBX permissions adapter.
    function PERMISSIONS_ADAPTER() external view returns (IUniswapPermissionsAdapter);

    /// @notice Returns the adapter factory used for verification.
    /// @return permissionsAdapterFactory Canonical permissions-adapter factory.
    function PERMISSIONS_ADAPTER_FACTORY() external view returns (IUniswapPermissionsAdapterFactory);

    /// @notice Returns the bound v4 PoolManager.
    /// @return poolManager Canonical v4 PoolManager address.
    function POOL_MANAGER() external view returns (address);

    /// @notice Returns the bound Permissioned Position Manager.
    /// @return positionManager Canonical permissioned Position Manager address.
    function POSITION_MANAGER() external view returns (address);

    /// @notice Returns the canonical permissioned hook.
    /// @return permissionedHook Canonical permissioned hook address.
    function PERMISSIONED_HOOK() external view returns (address);

    /// @notice Verifies the adapter and recycles the fixed verification deposit to LiquidityManager.
    function recoverVerificationDeposit() external;
}
