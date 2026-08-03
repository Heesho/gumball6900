// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {
    IAdapterVerificationEscrow,
    IGumBallPermissionedHook,
    IUniswapAllowlistChecker,
    IUniswapPermissionedPositionManager,
    IUniswapPermissionsAdapter,
    IUniswapPermissionsAdapterFactory
} from "../interfaces/IUniswapPermissionedPools.sol";

/// @title PermissionedPoolController
/// @notice Typed, non-upgradeable owner of the canonical GBX Uniswap Permissions Adapter.
/// @dev It creates the adapter itself, so the adapter never has an EOA owner. It cannot move protocol or user assets.
contract PermissionedPoolController {
    /// @notice Canonical fee tier for the GBX/USDG permissioned pool.
    uint24 public constant POOL_FEE = 3_000;
    /// @notice Canonical tick spacing for the GBX/USDG permissioned pool.
    int24 public constant TICK_SPACING = 60;

    struct Dependencies {
        address protocolTimelock;
        address emergencyGuardian;
        address dependencyInitializer;
        address gbx;
        address usdG;
        address permissionsAdapterFactory;
        address permissionedPositionManager;
        address universalRouter;
        address v4Quoter;
        address mixedRouteQuoterV2;
        address allowListChecker;
    }

    /// @notice Protocol timelock authorized for typed maintenance actions.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Emergency guardian authorized only for stop actions.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice One-time deployment dependency initializer.
    address public immutable DEPENDENCY_INITIALIZER;
    /// @notice Canonical underlying GBX token.
    address public immutable GBX;
    /// @notice Canonical USDG token paired with the permissions adapter.
    address public immutable USDG;
    /// @notice Canonical Uniswap permissions-adapter factory.
    IUniswapPermissionsAdapterFactory public immutable PERMISSIONS_ADAPTER_FACTORY;
    /// @notice Canonical permissioned PositionManager.
    IUniswapPermissionedPositionManager public immutable PERMISSIONED_POSITION_MANAGER;
    /// @notice Canonical identity-reporting Universal Router wrapper.
    address public immutable UNIVERSAL_ROUTER;
    /// @notice Canonical identity-reporting v4 quoter wrapper.
    address public immutable V4_QUOTER;
    /// @notice Canonical identity-reporting mixed-route quoter wrapper.
    address public immutable MIXED_ROUTE_QUOTER_V2;
    /// @notice Eligibility checker installed when the adapter is created.
    IUniswapAllowlistChecker public immutable INITIAL_ALLOWLIST_CHECKER;

    /// @notice Canonical GBX permissions adapter created by this controller.
    IUniswapPermissionsAdapter public PERMISSIONS_ADAPTER;
    /// @notice Canonical permissioned hook after graph initialization.
    address public PERMISSIONED_HOOK;
    /// @notice One-purpose adapter verification escrow after graph initialization.
    address public VERIFICATION_ESCROW;
    /// @notice Whether the complete canonical successor graph was initialized.
    bool public graphInitialized;
    /// @notice Whether the one-shot permissionless post-genesis swap enable was consumed.
    bool public bootstrapSwapEnableConsumed;

    error PermissionedPoolController__AdapterAlreadyCreated();
    error PermissionedPoolController__AdapterFactoryMismatch(address expected, address actual);
    error PermissionedPoolController__AdapterNotCreated();
    error PermissionedPoolController__AdapterOwnerMismatch(address expected, address actual);
    error PermissionedPoolController__AddressHasNoCode(address account);
    error PermissionedPoolController__BootstrapEnableAlreadyConsumed();
    error PermissionedPoolController__CanonicalPoolNotInitialized();
    error PermissionedPoolController__GraphAlreadyInitialized();
    error PermissionedPoolController__GraphMismatch();
    error PermissionedPoolController__InvalidWrapper(address wrapper);
    error PermissionedPoolController__NotEmergencyGuardian(address caller);
    error PermissionedPoolController__NotProtocolTimelock(address caller);
    error PermissionedPoolController__SwappingAlreadyEnabled();
    error PermissionedPoolController__UnauthorizedDependencyInitializer(address caller);
    error PermissionedPoolController__UnverifiedAdapter(address adapter);
    error PermissionedPoolController__ZeroAddress();

    event PermissionedPoolController__AdapterCreated(address indexed adapter, address indexed gbx, address checker);
    event PermissionedPoolController__AllowlistCheckerUpdated(
        address indexed previousChecker, address indexed newChecker
    );
    event PermissionedPoolController__CanonicalHookAllowanceSet(address indexed hook, bool allowed);
    event PermissionedPoolController__EmergencyLiquidityDisabled(address indexed hook);
    event PermissionedPoolController__EmergencySwappingDisabled(address indexed adapter);
    event PermissionedPoolController__GraphInitialized(
        address indexed adapter, address indexed hook, address indexed verificationEscrow
    );
    event PermissionedPoolController__SwappingSet(bool enabled);
    event PermissionedPoolController__WrapperSet(address indexed wrapper, bool allowed);

    modifier onlyDependencyInitializer() {
        if (msg.sender != DEPENDENCY_INITIALIZER) {
            revert PermissionedPoolController__UnauthorizedDependencyInitializer(msg.sender);
        }
        _;
    }

    modifier onlyProtocolTimelock() {
        if (msg.sender != PROTOCOL_TIMELOCK) revert PermissionedPoolController__NotProtocolTimelock(msg.sender);
        _;
    }

    /// @notice Constructs the purpose-limited owner for one canonical permissioned-pool successor graph.
    /// @param dependencies Exact immutable protocol and official Uniswap dependencies for the graph.
    constructor(Dependencies memory dependencies) {
        if (
            dependencies.protocolTimelock == address(0) || dependencies.emergencyGuardian == address(0)
                || dependencies.dependencyInitializer == address(0) || dependencies.gbx == address(0)
                || dependencies.usdG == address(0) || dependencies.permissionsAdapterFactory == address(0)
                || dependencies.permissionedPositionManager == address(0) || dependencies.universalRouter == address(0)
                || dependencies.v4Quoter == address(0) || dependencies.mixedRouteQuoterV2 == address(0)
                || dependencies.allowListChecker == address(0)
        ) revert PermissionedPoolController__ZeroAddress();

        _requireCode(dependencies.protocolTimelock);
        _requireCode(dependencies.emergencyGuardian);
        _requireCode(dependencies.gbx);
        _requireCode(dependencies.usdG);
        _requireCode(dependencies.permissionsAdapterFactory);
        _requireCode(dependencies.permissionedPositionManager);
        _requireCode(dependencies.universalRouter);
        _requireCode(dependencies.v4Quoter);
        _requireCode(dependencies.mixedRouteQuoterV2);
        _requireCode(dependencies.allowListChecker);

        PROTOCOL_TIMELOCK = dependencies.protocolTimelock;
        EMERGENCY_GUARDIAN = dependencies.emergencyGuardian;
        DEPENDENCY_INITIALIZER = dependencies.dependencyInitializer;
        GBX = dependencies.gbx;
        USDG = dependencies.usdG;
        PERMISSIONS_ADAPTER_FACTORY = IUniswapPermissionsAdapterFactory(dependencies.permissionsAdapterFactory);
        PERMISSIONED_POSITION_MANAGER = IUniswapPermissionedPositionManager(dependencies.permissionedPositionManager);
        UNIVERSAL_ROUTER = dependencies.universalRouter;
        V4_QUOTER = dependencies.v4Quoter;
        MIXED_ROUTE_QUOTER_V2 = dependencies.mixedRouteQuoterV2;
        INITIAL_ALLOWLIST_CHECKER = IUniswapAllowlistChecker(dependencies.allowListChecker);

        address poolManager = PERMISSIONS_ADAPTER_FACTORY.POOL_MANAGER();
        if (poolManager == address(0) || poolManager.code.length == 0) {
            revert PermissionedPoolController__AddressHasNoCode(poolManager);
        }
        address positionManagerFactory = address(PERMISSIONED_POSITION_MANAGER.PERMISSIONS_ADAPTER_FACTORY());
        if (positionManagerFactory != dependencies.permissionsAdapterFactory) {
            revert PermissionedPoolController__AdapterFactoryMismatch(
                dependencies.permissionsAdapterFactory, positionManagerFactory
            );
        }
    }

    /// @notice Creates the only GBX adapter with this purpose-limited controller as its owner from birth.
    function createAdapter() external onlyDependencyInitializer returns (address adapterAddress) {
        if (address(PERMISSIONS_ADAPTER) != address(0)) revert PermissionedPoolController__AdapterAlreadyCreated();
        adapterAddress = PERMISSIONS_ADAPTER_FACTORY.createPermissionsAdapter(
            IERC20(GBX), address(this), INITIAL_ALLOWLIST_CHECKER
        );
        _requireCode(adapterAddress);
        IUniswapPermissionsAdapter adapter = IUniswapPermissionsAdapter(adapterAddress);
        if (
            adapter.owner() != address(this) || address(adapter.PERMISSIONED_TOKEN()) != GBX
                || adapter.POOL_MANAGER() != PERMISSIONS_ADAPTER_FACTORY.POOL_MANAGER()
                || address(adapter.allowListChecker()) != address(INITIAL_ALLOWLIST_CHECKER)
                || PERMISSIONS_ADAPTER_FACTORY.permissionsAdapterOf(adapterAddress) != GBX
                || PERMISSIONS_ADAPTER_FACTORY.verifiedPermissionsAdapterOf(adapterAddress) != address(0)
                || adapter.swappingEnabled()
        ) revert PermissionedPoolController__GraphMismatch();
        PERMISSIONS_ADAPTER = adapter;
        emit PermissionedPoolController__AdapterCreated(adapterAddress, GBX, address(INITIAL_ALLOWLIST_CHECKER));
    }

    /// @notice Binds and configures the canonical hook and one-purpose verification escrow exactly once.
    function initializeGraph(address permissionedHook, address verificationEscrow) external onlyDependencyInitializer {
        if (graphInitialized) revert PermissionedPoolController__GraphAlreadyInitialized();
        IUniswapPermissionsAdapter adapter = PERMISSIONS_ADAPTER;
        if (address(adapter) == address(0)) revert PermissionedPoolController__AdapterNotCreated();
        _requireCode(permissionedHook);
        _requireCode(verificationEscrow);

        IGumBallPermissionedHook hook = IGumBallPermissionedHook(permissionedHook);
        IAdapterVerificationEscrow escrow = IAdapterVerificationEscrow(verificationEscrow);
        (address expected0, address expected1) =
            address(adapter) < USDG ? (address(adapter), USDG) : (USDG, address(adapter));
        if (
            adapter.owner() != address(this)
                || address(hook.PERMISSIONS_ADAPTER_FACTORY()) != address(PERMISSIONS_ADAPTER_FACTORY)
                || hook.DEPENDENCY_INITIALIZER() != DEPENDENCY_INITIALIZER || hook.TOKEN0() != expected0
                || hook.TOKEN1() != expected1 || hook.POOL_FEE() != POOL_FEE || hook.TICK_SPACING() != TICK_SPACING
                || hook.liquidityManager() != address(0) || hook.canonicalPoolInitialized()
                || escrow.POOL_MANAGER() != PERMISSIONS_ADAPTER_FACTORY.POOL_MANAGER()
                || address(escrow.PERMISSIONS_ADAPTER()) != address(adapter)
                || address(escrow.PERMISSIONS_ADAPTER_FACTORY()) != address(PERMISSIONS_ADAPTER_FACTORY)
                || escrow.POSITION_MANAGER() != address(PERMISSIONED_POSITION_MANAGER)
                || escrow.PERMISSIONED_HOOK() != permissionedHook
                || escrow.DEPENDENCY_INITIALIZER() != DEPENDENCY_INITIALIZER || escrow.LIQUIDITY_MANAGER() != address(0)
        ) revert PermissionedPoolController__GraphMismatch();

        _setWrapper(address(PERMISSIONED_POSITION_MANAGER), true);
        _setWrapper(UNIVERSAL_ROUTER, true);
        _setWrapper(V4_QUOTER, true);
        _setWrapper(MIXED_ROUTE_QUOTER_V2, true);
        adapter.updateAllowedWrapper(verificationEscrow, true);
        PERMISSIONED_POSITION_MANAGER.setAllowedHook(address(adapter), permissionedHook, true);

        if (
            !adapter.allowedWrappers(verificationEscrow)
                || !PERMISSIONED_POSITION_MANAGER.isAllowedHooks(address(adapter), permissionedHook)
                || adapter.swappingEnabled()
        ) revert PermissionedPoolController__GraphMismatch();

        PERMISSIONED_HOOK = permissionedHook;
        VERIFICATION_ESCROW = verificationEscrow;
        graphInitialized = true;
        emit PermissionedPoolController__GraphInitialized(address(adapter), permissionedHook, verificationEscrow);
    }

    /// @notice Permissionlessly enables swaps once, only after atomic canonical genesis has completed.
    function enableSwappingAfterGenesis() external {
        if (bootstrapSwapEnableConsumed) revert PermissionedPoolController__BootstrapEnableAlreadyConsumed();
        _requireLiveCanonicalGraph();
        if (!IGumBallPermissionedHook(PERMISSIONED_HOOK).canonicalPoolInitialized()) {
            revert PermissionedPoolController__CanonicalPoolNotInitialized();
        }
        if (PERMISSIONS_ADAPTER.swappingEnabled()) revert PermissionedPoolController__SwappingAlreadyEnabled();
        bootstrapSwapEnableConsumed = true;
        PERMISSIONS_ADAPTER.updateSwappingEnabled(true);
        emit PermissionedPoolController__SwappingSet(true);
    }

    /// @notice Timelocked swap-state recovery after the one-shot bootstrap enable has been consumed.
    function setSwappingEnabled(bool enabled) external onlyProtocolTimelock {
        _requireLiveCanonicalGraph();
        if (enabled && !IGumBallPermissionedHook(PERMISSIONED_HOOK).canonicalPoolInitialized()) {
            revert PermissionedPoolController__CanonicalPoolNotInitialized();
        }
        PERMISSIONS_ADAPTER.updateSwappingEnabled(enabled);
        emit PermissionedPoolController__SwappingSet(enabled);
    }

    /// @notice Timelocked checker replacement; the adapter independently enforces ERC-165 compatibility.
    function updateAllowListChecker(IUniswapAllowlistChecker newChecker) external onlyProtocolTimelock {
        _requireCode(address(newChecker));
        address previous = address(PERMISSIONS_ADAPTER.allowListChecker());
        PERMISSIONS_ADAPTER.updateAllowListChecker(newChecker);
        emit PermissionedPoolController__AllowlistCheckerUpdated(previous, address(newChecker));
    }

    /// @notice Timelocked toggle for one of the four fixed official identity-reporting wrappers.
    function setAllowedWrapper(address wrapper, bool allowed) external onlyProtocolTimelock {
        if (!_isCanonicalWrapper(wrapper)) revert PermissionedPoolController__InvalidWrapper(wrapper);
        _setWrapper(wrapper, allowed);
    }

    /// @notice Timelocked canonical hook toggle. No arbitrary replacement hook can be selected.
    function setCanonicalHookAllowed(bool allowed) external onlyProtocolTimelock {
        _requireLiveCanonicalGraph();
        PERMISSIONED_POSITION_MANAGER.setAllowedHook(address(PERMISSIONS_ADAPTER), PERMISSIONED_HOOK, allowed);
        emit PermissionedPoolController__CanonicalHookAllowanceSet(PERMISSIONED_HOOK, allowed);
    }

    /// @notice Stop-only guardian action for permissioned swaps.
    function emergencyDisableSwapping() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert PermissionedPoolController__NotEmergencyGuardian(msg.sender);
        _requireLiveCanonicalGraph();
        PERMISSIONS_ADAPTER.updateSwappingEnabled(false);
        emit PermissionedPoolController__EmergencySwappingDisabled(address(PERMISSIONS_ADAPTER));
    }

    /// @notice Stop-only guardian action for future permissioned liquidity additions.
    function emergencyDisableLiquidity() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert PermissionedPoolController__NotEmergencyGuardian(msg.sender);
        _requireLiveCanonicalGraph();
        PERMISSIONED_POSITION_MANAGER.setAllowedHook(address(PERMISSIONS_ADAPTER), PERMISSIONED_HOOK, false);
        emit PermissionedPoolController__EmergencyLiquidityDisabled(PERMISSIONED_HOOK);
    }

    function _setWrapper(address wrapper, bool allowed) private {
        PERMISSIONS_ADAPTER.updateAllowedWrapper(wrapper, allowed);
        emit PermissionedPoolController__WrapperSet(wrapper, allowed);
    }

    function _isCanonicalWrapper(address wrapper) private view returns (bool) {
        return wrapper == address(PERMISSIONED_POSITION_MANAGER) || wrapper == UNIVERSAL_ROUTER || wrapper == V4_QUOTER
            || wrapper == MIXED_ROUTE_QUOTER_V2;
    }

    function _requireLiveCanonicalGraph() private view {
        if (!graphInitialized) revert PermissionedPoolController__GraphMismatch();
        address adapter = address(PERMISSIONS_ADAPTER);
        if (PERMISSIONS_ADAPTER_FACTORY.verifiedPermissionsAdapterOf(adapter) != GBX) {
            revert PermissionedPoolController__UnverifiedAdapter(adapter);
        }
        if (PERMISSIONS_ADAPTER.owner() != address(this)) {
            revert PermissionedPoolController__AdapterOwnerMismatch(address(this), PERMISSIONS_ADAPTER.owner());
        }
    }

    function _requireCode(address account) private view {
        if (account.code.length == 0) revert PermissionedPoolController__AddressHasNoCode(account);
    }
}
