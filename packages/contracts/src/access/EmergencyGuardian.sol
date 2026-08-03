// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IEmergencyAllocationVoter } from "../interfaces/IEmergencyAllocationVoter.sol";
import { IEmergencyAssetRegistry } from "../interfaces/IEmergencyAssetRegistry.sol";
import { IEmergencyLiquidityManager } from "../interfaces/IEmergencyLiquidityManager.sol";
import { IEmergencyMiningPool } from "../interfaces/IEmergencyMiningPool.sol";
import { IEmergencyPermissionedPoolController } from "../interfaces/IEmergencyPermissionedPoolController.sol";
import { IEmergencyStrategy } from "../interfaces/IEmergencyStrategy.sol";

/// @title EmergencyGuardian
/// @notice Narrow break-glass adapter that can only reduce protocol activity and never move value.
/// @dev There are deliberately no unpause, claim, burn, redemption, approval, arbitrary-call, or rescue methods.
contract EmergencyGuardian {
    /// @notice Purpose-limited timelock that binds targets and rotates the operator.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Canonical one-shot-bound asset registry.
    IEmergencyAssetRegistry public assetRegistry;
    /// @notice Canonical one-shot-bound allocation voter.
    IEmergencyAllocationVoter public allocationVoter;
    /// @notice Optional canonical permissioned-pool stop target.
    IEmergencyPermissionedPoolController public permissionedPoolController;
    /// @notice Current incident-response signer or multisig.
    address public operator;
    /// @notice Whether the canonical registry and voter have been permanently bound.
    bool public targetsInitialized;
    /// @notice Whether the optional permissioned-pool target has been permanently declared.
    bool public permissionedPoolControllerFinalized;

    error EmergencyGuardian__InvalidTargetWiring(address target);
    error EmergencyGuardian__AssetHasNoStrategy(address token);
    error EmergencyGuardian__NotOperator(address caller);
    error EmergencyGuardian__NotProtocolTimelock(address caller);
    error EmergencyGuardian__PermissionedPoolControllerAlreadyFinalized();
    error EmergencyGuardian__PermissionedPoolControllerNotConfigured();
    error EmergencyGuardian__TargetMustBeContract(address target);
    error EmergencyGuardian__TargetsAlreadyInitialized();
    error EmergencyGuardian__TargetsNotInitialized();
    error EmergencyGuardian__ZeroAddress();

    event EmergencyGuardian__AssetAcquisitionDisabled(
        address indexed registry, address indexed allocationVoter, address indexed token, address strategy
    );
    event EmergencyGuardian__MiningContributionsPaused(address indexed miningPool);
    event EmergencyGuardian__MiningEpochInvalidated(address indexed miningPool);
    event EmergencyGuardian__PermissionedPoolControllerFinalized(address indexed controller);
    event EmergencyGuardian__PermissionedPoolLiquidityDisabled(address indexed controller);
    event EmergencyGuardian__PermissionedPoolSwappingDisabled(address indexed controller);
    event EmergencyGuardian__LiquidityMigrationsPaused(address indexed liquidityManager);
    event EmergencyGuardian__OperatorRotated(address indexed previousOperator, address indexed newOperator);
    event EmergencyGuardian__SignalActivationsPaused(address indexed allocationVoter);
    event EmergencyGuardian__StandaloneStrategyDisabled(
        address indexed registry, address indexed allocationVoter, address indexed strategy
    );
    event EmergencyGuardian__StrategyFillsPaused(address indexed strategy);
    event EmergencyGuardian__TargetsInitialized(address indexed registry, address indexed allocationVoter);

    modifier onlyOperator() {
        if (msg.sender != operator) revert EmergencyGuardian__NotOperator(msg.sender);
        _;
    }

    modifier onlyConfigured() {
        if (!targetsInitialized) revert EmergencyGuardian__TargetsNotInitialized();
        _;
    }

    /// @notice Wires the purpose-limited timelock and initial incident-response signer.
    /// @param protocolTimelock The deployed ProtocolTimelock contract.
    /// @param initialOperator The initial incident-response signer or multisig.
    constructor(address protocolTimelock, address initialOperator) {
        if (protocolTimelock == address(0) || initialOperator == address(0)) {
            revert EmergencyGuardian__ZeroAddress();
        }
        _requireContract(protocolTimelock);
        _requireContract(initialOperator);
        PROTOCOL_TIMELOCK = protocolTimelock;
        operator = initialOperator;
    }

    /// @notice Binds the canonical registry and allocation voter exactly once through ProtocolTimelock setup.
    /// @dev The target contracts must identify this guardian, this timelock, and each other consistently.
    /// @param registry The canonical AssetRegistry contract.
    /// @param voter The canonical AllocationVoter contract.
    function initializeTargets(address registry, address voter) external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert EmergencyGuardian__NotProtocolTimelock(msg.sender);
        if (targetsInitialized) revert EmergencyGuardian__TargetsAlreadyInitialized();
        _requireContract(registry);
        _requireContract(voter);

        IEmergencyAssetRegistry registryTarget = IEmergencyAssetRegistry(registry);
        IEmergencyAllocationVoter voterTarget = IEmergencyAllocationVoter(voter);
        if (
            registryTarget.PROTOCOL_TIMELOCK() != PROTOCOL_TIMELOCK
                || registryTarget.EMERGENCY_GUARDIAN() != address(this)
        ) revert EmergencyGuardian__InvalidTargetWiring(registry);
        if (
            voterTarget.ASSET_REGISTRY() != registry || voterTarget.PROTOCOL_TIMELOCK() != PROTOCOL_TIMELOCK
                || voterTarget.EMERGENCY_GUARDIAN() != address(this)
        ) revert EmergencyGuardian__InvalidTargetWiring(voter);

        assetRegistry = registryTarget;
        allocationVoter = voterTarget;
        targetsInitialized = true;
        emit EmergencyGuardian__TargetsInitialized(registry, voter);
    }

    /// @notice Permanently binds the optional permissioned-pool stop target, or records unrestricted test mode.
    /// @dev Only ProtocolTimelock's one-use deployment initialization path can call this.
    function finalizePermissionedPoolController(address controller) external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert EmergencyGuardian__NotProtocolTimelock(msg.sender);
        if (permissionedPoolControllerFinalized) {
            revert EmergencyGuardian__PermissionedPoolControllerAlreadyFinalized();
        }
        if (controller != address(0)) {
            _requireContract(controller);
            IEmergencyPermissionedPoolController target = IEmergencyPermissionedPoolController(controller);
            if (target.EMERGENCY_GUARDIAN() != address(this)) {
                revert EmergencyGuardian__InvalidTargetWiring(controller);
            }
            permissionedPoolController = target;
        }
        permissionedPoolControllerFinalized = true;
        emit EmergencyGuardian__PermissionedPoolControllerFinalized(controller);
    }

    /// @notice Rotates the incident-response signer only after a ProtocolTimelock operation matures.
    /// @param newOperator The replacement incident-response signer or multisig.
    function rotateOperator(address newOperator) external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert EmergencyGuardian__NotProtocolTimelock(msg.sender);
        if (newOperator == address(0)) revert EmergencyGuardian__ZeroAddress();
        _requireContract(newOperator);
        address previousOperator = operator;
        operator = newOperator;
        emit EmergencyGuardian__OperatorRotated(previousOperator, newOperator);
    }

    /// @notice Stops new recurring mining contributions without affecting claims, refunds, or settlement.
    /// @param miningPool The canonical MiningPool contract.
    function pauseMiningContributions(address miningPool) external onlyOperator {
        _requireContract(miningPool);
        IEmergencyMiningPool(miningPool).pauseContributions();
        emit EmergencyGuardian__MiningContributionsPaused(miningPool);
    }

    /// @notice Invalidates the unsettled current epoch so every recorded contributor can refund.
    /// @param miningPool The canonical MiningPool contract.
    function invalidateMiningEpoch(address miningPool) external onlyOperator {
        _requireContract(miningPool);
        IEmergencyMiningPool(miningPool).invalidateCurrentEpoch();
        emit EmergencyGuardian__MiningEpochInvalidated(miningPool);
    }

    /// @notice Stops new fills on one directly deployed acquisition or buyback strategy.
    /// @param strategy The directly deployed strategy contract.
    function pauseStrategyFills(address strategy) external onlyOperator {
        _requireContract(strategy);
        IEmergencyStrategy(strategy).pauseFills();
        emit EmergencyGuardian__StrategyFillsPaused(strategy);
    }

    /// @notice Atomically disables future acquisition and removes the strategy from allocation accounting.
    /// @dev Voter cleanup is in the same transaction so a failed cleanup also rolls back the registry disable.
    /// @param token The registered target token whose acquisition path is disabled.
    function disableAssetAcquisition(address token) external onlyOperator onlyConfigured {
        address registry = address(assetRegistry);
        address voter = address(allocationVoter);
        address strategy = assetRegistry.configFor(token).strategy;
        if (strategy == address(0)) revert EmergencyGuardian__AssetHasNoStrategy(token);
        assetRegistry.disableAcquisition(token);
        allocationVoter.disableStrategy(strategy);
        emit EmergencyGuardian__AssetAcquisitionDisabled(registry, voter, token, strategy);
    }

    /// @notice Atomically disables a standalone strategy and removes it from allocation accounting.
    /// @dev Voter cleanup is in the same transaction so a failed cleanup also rolls back the registry disable.
    /// @param strategy The registered standalone strategy to disable.
    function disableStandaloneStrategy(address strategy) external onlyOperator onlyConfigured {
        address registry = address(assetRegistry);
        address voter = address(allocationVoter);
        assetRegistry.disableStandaloneStrategy(strategy);
        allocationVoter.disableStrategy(strategy);
        emit EmergencyGuardian__StandaloneStrategyDisabled(registry, voter, strategy);
    }

    /// @notice Stops matured signal increases; reductions, resets, and immediate unstaking stay available.
    function pauseSignalActivations() external onlyOperator onlyConfigured {
        allocationVoter.pauseSignalActivations();
        emit EmergencyGuardian__SignalActivationsPaused(address(allocationVoter));
    }

    /// @notice Stops timelocked liquidity migrations without blocking fee collection or range sweeping.
    /// @param liquidityManager The canonical LiquidityManager contract.
    function pauseLiquidityMigrations(address liquidityManager) external onlyOperator {
        _requireContract(liquidityManager);
        IEmergencyLiquidityManager(liquidityManager).pauseMigrations();
        emit EmergencyGuardian__LiquidityMigrationsPaused(liquidityManager);
    }

    /// @notice Stops canonical permissioned-pool swaps without affecting redemption or liquidity exits.
    function pausePermissionedPoolSwaps() external onlyOperator {
        IEmergencyPermissionedPoolController controller = _permissionedPoolController();
        controller.emergencyDisableSwapping();
        emit EmergencyGuardian__PermissionedPoolSwappingDisabled(address(controller));
    }

    /// @notice Stops future canonical permissioned liquidity additions without blocking position exits.
    function pausePermissionedPoolLiquidity() external onlyOperator {
        IEmergencyPermissionedPoolController controller = _permissionedPoolController();
        controller.emergencyDisableLiquidity();
        emit EmergencyGuardian__PermissionedPoolLiquidityDisabled(address(controller));
    }

    function _permissionedPoolController() private view returns (IEmergencyPermissionedPoolController controller) {
        controller = permissionedPoolController;
        if (!permissionedPoolControllerFinalized || address(controller) == address(0)) {
            revert EmergencyGuardian__PermissionedPoolControllerNotConfigured();
        }
    }

    function _requireContract(address target) private view {
        if (target == address(0) || target.code.length == 0) {
            revert EmergencyGuardian__TargetMustBeContract(target);
        }
    }
}
