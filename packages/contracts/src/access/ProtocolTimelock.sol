// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IEmergencyGuardianTargetInitializer } from "../interfaces/IEmergencyGuardianTargetInitializer.sol";
import { IPermissionedPoolController } from "../interfaces/IPermissionedPoolController.sol";
import { IStrategyDeployer } from "../interfaces/IStrategyDeployer.sol";
import { LiquidityManager } from "../liquidity/LiquidityManager.sol";
import { AssetRegistry } from "../vault/AssetRegistry.sol";

/// @title ProtocolTimelock
/// @notice Purpose-limited delayed maintenance executor controlled by one immutable multisig.
/// @dev Unlike a generic timelock, target classes and selectors are hard-coded. It cannot target GBX, claims,
///      GumBallVault, EmissionController, user balances, or an arbitrary external contract.
contract ProtocolTimelock is ReentrancyGuard {
    /// @notice Delay for bounded maintenance operations such as unpausing or rate reset.
    uint256 public constant BOUNDED_MAINTENANCE_DELAY = 48 hours;
    /// @notice Delay for asset registration and canonical liquidity migration.
    uint256 public constant CRITICAL_CHANGE_DELAY = 7 days;
    /// @notice Window after maturity during which a scheduled operation remains executable.
    uint256 public constant EXECUTION_GRACE_PERIOD = 30 days;
    uint256 private constant _MAX_MIGRATION_CALLDATA_LENGTH = 4_452;
    uint256 private constant _MAX_MIGRATION_POSITIONS = 16;

    bytes4 private constant _CONFIGURE_VAULT_SELECTOR = bytes4(keccak256("configureVault(address)"));
    bytes4 private constant _REGISTER_ASSET_SELECTOR = AssetRegistry.registerAsset.selector;
    bytes4 private constant _REGISTER_STOCK_ASSET_SELECTOR = AssetRegistry.registerStockAsset.selector;
    bytes4 private constant _REGISTER_STANDALONE_SELECTOR = bytes4(keccak256("registerStandaloneStrategy(address)"));
    bytes4 private constant _ENABLE_ACQUISITION_SELECTOR = bytes4(keccak256("enableAcquisition(address)"));
    bytes4 private constant _SET_REDEMPTION_SELECTOR = bytes4(keccak256("setRedemptionEnabled(address,bool)"));
    bytes4 private constant _ENABLE_STANDALONE_SELECTOR = bytes4(keccak256("enableStandaloneStrategy(address)"));
    bytes4 private constant _RESET_REFERENCE_SELECTOR = bytes4(keccak256("resetReferenceRate(uint256,uint256)"));
    bytes4 private constant _UNPAUSE_FILLS_SELECTOR = bytes4(keccak256("unpauseFills()"));
    bytes4 private constant _REACTIVATE_STRATEGY_SELECTOR = bytes4(keccak256("reactivateStrategy(address)"));
    bytes4 private constant _UNPAUSE_SIGNALS_SELECTOR = bytes4(keccak256("unpauseSignalActivations()"));
    bytes4 private constant _UNPAUSE_MINING_SELECTOR = bytes4(keccak256("unpauseContributions()"));
    bytes4 private constant _ROTATE_GUARDIAN_SELECTOR = bytes4(keccak256("rotateOperator(address)"));
    bytes4 private constant _MIGRATE_LIQUIDITY_SELECTOR = LiquidityManager.migrateLiquidity.selector;
    bytes4 private constant _UNPAUSE_MIGRATIONS_SELECTOR = LiquidityManager.unpauseMigrations.selector;
    bytes4 private constant _DEPLOY_ACQUISITION_SELECTOR = IStrategyDeployer.deployAcquisition.selector;
    bytes4 private constant _SET_PERMISSIONED_SWAPPING_SELECTOR = bytes4(keccak256("setSwappingEnabled(bool)"));
    bytes4 private constant _UPDATE_PERMISSIONED_CHECKER_SELECTOR =
        bytes4(keccak256("updateAllowListChecker(address)"));
    bytes4 private constant _SET_PERMISSIONED_WRAPPER_SELECTOR = bytes4(keccak256("setAllowedWrapper(address,bool)"));
    bytes4 private constant _SET_PERMISSIONED_HOOK_SELECTOR = bytes4(keccak256("setCanonicalHookAllowed(bool)"));

    /// @notice Immutable multisig permitted to schedule and cancel maintenance operations.
    address public immutable PROPOSER_MULTISIG;
    /// @notice One-use prelaunch account permitted to bind the canonical target graph.
    address public immutable DEPLOYMENT_INITIALIZER;

    /// @notice Canonical bounded asset and strategy registry after target initialization.
    IAssetRegistry public assetRegistry;
    /// @notice Canonical stop-only guardian after target initialization.
    address public emergencyGuardian;
    /// @notice Canonical allocation voter after target initialization.
    address public allocationVoter;
    /// @notice Canonical recurring mining pool after target initialization.
    address public miningPool;
    /// @notice Canonical protocol-owned v4 liquidity manager after target initialization.
    address public liquidityManager;
    /// @notice Canonical typed exact-bytecode strategy deployer after target initialization.
    IStrategyDeployer public strategyDeployer;
    /// @notice Optional typed permissioned-pool maintenance target.
    IPermissionedPoolController public permissionedPoolController;
    /// @notice Whether every fixed maintenance target has been bound exactly once.
    bool public targetsInitialized;
    /// @notice Whether the optional permissioned-pool target has been permanently declared.
    bool public permissionedPoolControllerFinalized;
    /// @notice Whether the one-use prelaunch strategy deployment window has been permanently closed.
    bool public strategyBootstrapFinalized;

    /// @notice Maturity timestamp for each scheduled operation ID, or zero when unscheduled.
    mapping(bytes32 operationId => uint64 readyAt) public operationReadyAt;

    error ProtocolTimelock__AlreadyScheduled(bytes32 operationId);
    error ProtocolTimelock__DataLengthMismatch(bytes4 selector, uint256 actualLength);
    error ProtocolTimelock__ExecutionExpired(bytes32 operationId, uint256 expiresAt);
    error ProtocolTimelock__ExecutionFailed(bytes32 operationId, bytes reason);
    error ProtocolTimelock__InvalidTarget(address target);
    error ProtocolTimelock__InvalidMigrationCalldata();
    error ProtocolTimelock__InvalidMigrationPoolKey(bytes32 expected, bytes32 actual);
    error ProtocolTimelock__InvalidStrategyDeploymentCalldata();
    error ProtocolTimelock__InvalidStrategyRegistrationProvenance(address strategy);
    error ProtocolTimelock__ReferenceRateBaselineMismatch(address strategy, uint256 expected, uint256 actual);
    error ProtocolTimelock__NotReady(bytes32 operationId, uint256 readyAt);
    error ProtocolTimelock__NotScheduled(bytes32 operationId);
    error ProtocolTimelock__PermissionedPoolControllerAlreadyFinalized();
    error ProtocolTimelock__PermissionedPoolControllerNotFinalized();
    error ProtocolTimelock__TargetsAlreadyInitialized();
    error ProtocolTimelock__TargetsNotInitialized();
    error ProtocolTimelock__StrategyBootstrapAlreadyFinalized();
    error ProtocolTimelock__StrategyBootstrapIncomplete();
    error ProtocolTimelock__StrategyBootstrapNotFinalized();
    error ProtocolTimelock__UnauthorizedInitializer(address caller);
    error ProtocolTimelock__UnauthorizedProposer(address caller);
    error ProtocolTimelock__UnsupportedOperation(address target, bytes4 selector);
    error ProtocolTimelock__ZeroAddress();

    event ProtocolTimelock__OperationCancelled(bytes32 indexed operationId);
    event ProtocolTimelock__OperationExecuted(
        bytes32 indexed operationId, address indexed target, bytes4 indexed selector, bytes32 dataHash, bytes32 salt
    );
    event ProtocolTimelock__OperationScheduled(
        bytes32 indexed operationId,
        address indexed target,
        bytes4 indexed selector,
        bytes32 dataHash,
        bytes32 salt,
        uint256 readyAt,
        uint256 delay
    );
    event ProtocolTimelock__PermissionedPoolControllerFinalized(address indexed controller);
    event ProtocolTimelock__TargetsInitialized(
        address indexed assetRegistry,
        address indexed emergencyGuardian,
        address indexed allocationVoter,
        address miningPool,
        address liquidityManager,
        address strategyDeployer
    );
    event ProtocolTimelock__StrategyBootstrapFinalized(address indexed holdUSDG, address indexed buybackBurn);

    /// @notice Sets immutable scheduling authority and a one-use prelaunch target initializer.
    /// @param proposerMultisig The only account permitted to schedule or cancel operations.
    /// @param deploymentInitializer The one-use account permitted to bind protocol targets before launch.
    constructor(address proposerMultisig, address deploymentInitializer) {
        if (proposerMultisig == address(0) || deploymentInitializer == address(0)) {
            revert ProtocolTimelock__ZeroAddress();
        }
        PROPOSER_MULTISIG = proposerMultisig;
        DEPLOYMENT_INITIALIZER = deploymentInitializer;
    }

    /// @notice Fixes the complete set of non-strategy maintenance targets exactly once before launch.
    /// @param assetRegistryAddress The canonical AssetRegistry contract.
    /// @param emergencyGuardianAddress The canonical EmergencyGuardian contract.
    /// @param allocationVoterAddress The canonical AllocationVoter contract.
    /// @param miningPoolAddress The canonical MiningPool contract.
    /// @param liquidityManagerAddress The canonical LiquidityManager contract.
    /// @param strategyDeployerAddress The canonical typed exact-bytecode StrategyDeployer contract.
    function initializeTargets(
        address assetRegistryAddress,
        address emergencyGuardianAddress,
        address allocationVoterAddress,
        address miningPoolAddress,
        address liquidityManagerAddress,
        address strategyDeployerAddress
    ) external {
        if (msg.sender != DEPLOYMENT_INITIALIZER) {
            revert ProtocolTimelock__UnauthorizedInitializer(msg.sender);
        }
        if (targetsInitialized) revert ProtocolTimelock__TargetsAlreadyInitialized();
        _requireContract(assetRegistryAddress);
        _requireContract(emergencyGuardianAddress);
        _requireContract(allocationVoterAddress);
        _requireContract(miningPoolAddress);
        _requireContract(liquidityManagerAddress);
        _requireContract(strategyDeployerAddress);

        IStrategyDeployer deployer = IStrategyDeployer(strategyDeployerAddress);
        _requireStrategyDeployerGraph(deployer, assetRegistryAddress, allocationVoterAddress, emergencyGuardianAddress);

        assetRegistry = IAssetRegistry(assetRegistryAddress);
        emergencyGuardian = emergencyGuardianAddress;
        allocationVoter = allocationVoterAddress;
        miningPool = miningPoolAddress;
        liquidityManager = liquidityManagerAddress;
        strategyDeployer = deployer;
        targetsInitialized = true;
        IEmergencyGuardianTargetInitializer(emergencyGuardianAddress)
            .initializeTargets(assetRegistryAddress, allocationVoterAddress);

        emit ProtocolTimelock__TargetsInitialized(
            assetRegistryAddress,
            emergencyGuardianAddress,
            allocationVoterAddress,
            miningPoolAddress,
            liquidityManagerAddress,
            strategyDeployerAddress
        );
    }

    /// @notice Permanently binds the optional permissioned-pool controller, or commits to unrestricted test mode.
    /// @dev Closing this slot before strategy-bootstrap finalization makes DEPLOYMENT_INITIALIZER irrelevant afterward.
    function finalizePermissionedPoolController(address controller) external {
        if (msg.sender != DEPLOYMENT_INITIALIZER) {
            revert ProtocolTimelock__UnauthorizedInitializer(msg.sender);
        }
        if (!targetsInitialized) revert ProtocolTimelock__TargetsNotInitialized();
        if (permissionedPoolControllerFinalized) {
            revert ProtocolTimelock__PermissionedPoolControllerAlreadyFinalized();
        }
        if (controller != address(0)) {
            _requireContract(controller);
            IPermissionedPoolController target = IPermissionedPoolController(controller);
            if (
                target.PROTOCOL_TIMELOCK() != address(this) || target.EMERGENCY_GUARDIAN() != emergencyGuardian
                    || !target.graphInitialized() || target.PERMISSIONS_ADAPTER().code.length == 0
                    || target.PERMISSIONED_HOOK().code.length == 0
            ) revert ProtocolTimelock__InvalidTarget(controller);
            permissionedPoolController = target;
        }
        IEmergencyGuardianTargetInitializer(emergencyGuardian).finalizePermissionedPoolController(controller);
        permissionedPoolControllerFinalized = true;
        emit ProtocolTimelock__PermissionedPoolControllerFinalized(controller);
    }

    /// @notice Prelaunch-only typed deployment of the one inert USDG-hold signal target.
    /// @dev Only the immutable deployment initializer may use this path, and only before bootstrap finalization.
    ///      StrategyDeployer authenticates the exact compiler creation bytecode and rejects a second singleton.
    /// @param creationCode Exact committed HoldUSDGStrategy compiler creation bytecode.
    /// @return strategy The directly deployed canonical HoldUSDGStrategy address.
    function bootstrapDeployHoldUSDG(bytes calldata creationCode) external nonReentrant returns (address strategy) {
        _requireStrategyBootstrapInitializer();
        strategy = strategyDeployer.deployHoldUSDG(creationCode);
    }

    /// @notice Prelaunch-only typed deployment of one exact acquisition/reward pair.
    /// @dev Only the immutable deployment initializer may use this path, and only before bootstrap finalization.
    ///      StrategyDeployer authenticates both creation-code commitments and permanently binds the returned pair.
    /// @param strategyCreationCode Exact committed AcquisitionStrategy compiler creation bytecode.
    /// @param rewardsCreationCode Exact committed ManagerRewards compiler creation bytecode.
    /// @param targetToken Canonical target asset for the new acquisition strategy.
    /// @param minimumLotUSDG Smallest USDG lot the strategy may release in one fill.
    /// @param maximumLotUSDG Largest USDG lot the strategy may release in one fill.
    /// @param initialReferenceRate Initial target-token-units-per-USDG auction reference rate.
    /// @return strategy The directly deployed AcquisitionStrategy address.
    /// @return rewards The directly deployed and reciprocally bound ManagerRewards address.
    function bootstrapDeployAcquisition(
        bytes calldata strategyCreationCode,
        bytes calldata rewardsCreationCode,
        address targetToken,
        uint256 minimumLotUSDG,
        uint256 maximumLotUSDG,
        uint256 initialReferenceRate
    ) external nonReentrant returns (address strategy, address rewards) {
        _requireStrategyBootstrapInitializer();
        return strategyDeployer.deployAcquisition(
            strategyCreationCode, rewardsCreationCode, targetToken, minimumLotUSDG, maximumLotUSDG, initialReferenceRate
        );
    }

    /// @notice Prelaunch-only typed deployment of the one canonical GBX buyback-and-burn strategy.
    /// @dev Only the immutable deployment initializer may use this path, and only before bootstrap finalization.
    ///      StrategyDeployer authenticates the exact compiler creation bytecode and rejects a second singleton.
    /// @param creationCode Exact committed BuybackBurnStrategy compiler creation bytecode.
    /// @param minimumLotUSDG Smallest USDG lot the strategy may release in one fill.
    /// @param maximumLotUSDG Largest USDG lot the strategy may release in one fill.
    /// @param initialReferenceRate Initial GBX-units-per-USDG auction reference rate.
    /// @return strategy The directly deployed canonical BuybackBurnStrategy address.
    function bootstrapDeployBuyback(
        bytes calldata creationCode,
        uint256 minimumLotUSDG,
        uint256 maximumLotUSDG,
        uint256 initialReferenceRate
    ) external nonReentrant returns (address strategy) {
        _requireStrategyBootstrapInitializer();
        strategy = strategyDeployer.deployBuyback(creationCode, minimumLotUSDG, maximumLotUSDG, initialReferenceRate);
    }

    /// @notice Permanently closes the prelaunch deployment window after both singleton strategies exist.
    /// @dev Revalidates the singleton runtime hashes and complete dependency graph before closing both the
    ///      ProtocolTimelock and StrategyDeployer bootstrap paths. The transition is irreversible.
    /// @param expectedAcquisitionTargets Exact reviewed acquisition-target list in deployment order.
    function finalizeStrategyBootstrap(address[] calldata expectedAcquisitionTargets) external nonReentrant {
        _requireStrategyBootstrapInitializer();
        if (!permissionedPoolControllerFinalized) {
            revert ProtocolTimelock__PermissionedPoolControllerNotFinalized();
        }
        address holdUSDG = strategyDeployer.canonicalHoldUSDGStrategy();
        address buybackBurn = strategyDeployer.canonicalBuybackBurnStrategy();
        if (holdUSDG.code.length == 0 || buybackBurn.code.length == 0) {
            revert ProtocolTimelock__StrategyBootstrapIncomplete();
        }
        _requireStrategyDeployerGraph(strategyDeployer, address(assetRegistry), allocationVoter, emergencyGuardian);
        IStrategyDeployer.BuybackDeployment memory buyback = strategyDeployer.canonicalBuybackDeployment();
        if (
            holdUSDG.codehash != strategyDeployer.canonicalHoldUSDGRuntimeCodeHash()
                || buybackBurn.codehash != buyback.runtimeCodeHash || buyback.gbx != strategyDeployer.GBX()
                || buyback.gumBallVault != strategyDeployer.GUM_BALL_VAULT()
                || buyback.allocationVoter != allocationVoter || buyback.assetRegistry != address(assetRegistry)
                || buyback.protocolTimelock != address(this) || buyback.emergencyGuardian != emergencyGuardian
        ) revert ProtocolTimelock__StrategyBootstrapIncomplete();
        strategyDeployer.finalizeBootstrap(expectedAcquisitionTargets);
        strategyBootstrapFinalized = true;
        emit ProtocolTimelock__StrategyBootstrapFinalized(holdUSDG, buybackBurn);
    }

    /// @notice Queues one hard-coded maintenance operation under its enforced minimum delay.
    /// @param target The canonical protocol contract that will receive the operation.
    /// @param data The complete selector and ABI-encoded arguments committed by the schedule.
    /// @param salt A caller-selected value that distinguishes otherwise identical operations.
    /// @return operationId The chain- and timelock-bound identifier for the scheduled operation.
    function schedule(address target, bytes calldata data, bytes32 salt) external returns (bytes32 operationId) {
        if (msg.sender != PROPOSER_MULTISIG) revert ProtocolTimelock__UnauthorizedProposer(msg.sender);
        uint256 delay = _requiredDelay(target, data, true);
        operationId = hashOperation(target, data, salt);
        if (operationReadyAt[operationId] != 0) revert ProtocolTimelock__AlreadyScheduled(operationId);
        uint256 readyAt = block.timestamp + delay;
        operationReadyAt[operationId] = SafeCast.toUint64(readyAt);
        emit ProtocolTimelock__OperationScheduled(
            operationId, target, _selector(data), keccak256(data), salt, readyAt, delay
        );
    }

    /// @notice Cancels a queued operation through the same immutable multisig.
    /// @param operationId The identifier returned by `schedule` or `hashOperation`.
    function cancel(bytes32 operationId) external {
        if (msg.sender != PROPOSER_MULTISIG) revert ProtocolTimelock__UnauthorizedProposer(msg.sender);
        if (operationReadyAt[operationId] == 0) revert ProtocolTimelock__NotScheduled(operationId);
        delete operationReadyAt[operationId];
        emit ProtocolTimelock__OperationCancelled(operationId);
    }

    /// @notice Permissionlessly executes one mature, non-expired, still-authorized maintenance operation.
    /// @param target The exact target committed when the operation was scheduled.
    /// @param data The exact calldata committed when the operation was scheduled.
    /// @param salt The exact salt committed when the operation was scheduled.
    /// @return returnData The raw bytes returned by the target call.
    function execute(address target, bytes calldata data, bytes32 salt)
        external
        nonReentrant
        returns (bytes memory returnData)
    {
        _requiredDelay(target, data, false);
        bytes32 operationId = hashOperation(target, data, salt);
        uint256 readyAt = operationReadyAt[operationId];
        if (readyAt == 0) revert ProtocolTimelock__NotScheduled(operationId);
        if (block.timestamp < readyAt) revert ProtocolTimelock__NotReady(operationId, readyAt);
        uint256 expiresAt = readyAt + EXECUTION_GRACE_PERIOD;
        if (block.timestamp > expiresAt) revert ProtocolTimelock__ExecutionExpired(operationId, expiresAt);

        delete operationReadyAt[operationId];
        (bool success, bytes memory result) = target.call(data);
        if (!success) revert ProtocolTimelock__ExecutionFailed(operationId, result);
        emit ProtocolTimelock__OperationExecuted(operationId, target, _selector(data), keccak256(data), salt);
        return result;
    }

    /// @notice Returns the chain-bound operation identifier.
    /// @param target The intended operation target.
    /// @param data The complete selector and ABI-encoded arguments.
    /// @param salt A caller-selected operation discriminator.
    /// @return operationId The deterministic chain- and timelock-bound identifier.
    function hashOperation(address target, bytes calldata data, bytes32 salt)
        public
        view
        returns (bytes32 operationId)
    {
        operationId = keccak256(abi.encode(block.chainid, address(this), target, keccak256(data), salt));
    }

    /// @notice Returns the enforced delay for an operation, reverting if the target or selector is unsupported.
    /// @param target The proposed canonical protocol target.
    /// @param data The proposed complete operation calldata.
    /// @return delay The minimum number of seconds the operation must remain queued.
    function requiredDelay(address target, bytes calldata data) external view returns (uint256 delay) {
        delay = _requiredDelay(target, data, true);
    }

    /// @dev `validateSchedulingState` is deliberately false at execution. A reset commits the reviewed reference-rate
    ///      baseline when it is scheduled, but fills or permissionless restarts may legitimately change the live rate
    ///      during the delay. Rechecking that equality at execution would let anyone censor a mature reset.
    function _requiredDelay(address target, bytes calldata data, bool validateSchedulingState)
        private
        view
        returns (uint256)
    {
        if (!targetsInitialized) revert ProtocolTimelock__TargetsNotInitialized();
        if (data.length < 4) revert ProtocolTimelock__DataLengthMismatch(bytes4(0), data.length);
        bytes4 selector = _selector(data);

        if (target == address(assetRegistry)) return _registryDelay(selector, data);
        if (target == address(strategyDeployer)) return _strategyDeployerDelay(selector, data);
        if (target == emergencyGuardian) {
            _requireLength(selector, data.length, 36);
            if (selector == _ROTATE_GUARDIAN_SELECTOR) return BOUNDED_MAINTENANCE_DELAY;
        } else if (target == allocationVoter) {
            if (selector == _UNPAUSE_SIGNALS_SELECTOR) {
                _requireLength(selector, data.length, 4);
                return BOUNDED_MAINTENANCE_DELAY;
            }
            if (selector == _REACTIVATE_STRATEGY_SELECTOR) {
                _requireLength(selector, data.length, 36);
                return BOUNDED_MAINTENANCE_DELAY;
            }
        } else if (target == miningPool) {
            if (selector == _UNPAUSE_MINING_SELECTOR) {
                _requireLength(selector, data.length, 4);
                return BOUNDED_MAINTENANCE_DELAY;
            }
        } else if (target == liquidityManager) {
            if (selector == _MIGRATE_LIQUIDITY_SELECTOR) {
                return _migrationDelay(selector, data);
            }
            if (selector == _UNPAUSE_MIGRATIONS_SELECTOR) {
                _requireLength(selector, data.length, 4);
                return BOUNDED_MAINTENANCE_DELAY;
            }
        } else if (target == address(permissionedPoolController) && target != address(0)) {
            return _permissionedPoolControllerDelay(selector, data);
        } else if (_isRegisteredStrategy(target)) {
            if (selector == _RESET_REFERENCE_SELECTOR) {
                _requireLength(selector, data.length, 68);
                (uint256 expectedReferenceRate,) = abi.decode(data[4:], (uint256, uint256));
                if (validateSchedulingState) {
                    uint256 actualReferenceRate = IReferenceRateStrategy(target).referenceRate();
                    if (expectedReferenceRate != actualReferenceRate) {
                        revert ProtocolTimelock__ReferenceRateBaselineMismatch(
                            target, expectedReferenceRate, actualReferenceRate
                        );
                    }
                }
                return BOUNDED_MAINTENANCE_DELAY;
            }
            if (selector == _UNPAUSE_FILLS_SELECTOR) {
                _requireLength(selector, data.length, 4);
                return BOUNDED_MAINTENANCE_DELAY;
            }
        } else {
            revert ProtocolTimelock__InvalidTarget(target);
        }

        revert ProtocolTimelock__UnsupportedOperation(target, selector);
    }

    function _permissionedPoolControllerDelay(bytes4 selector, bytes calldata data) private view returns (uint256) {
        if (!permissionedPoolControllerFinalized || address(permissionedPoolController) == address(0)) {
            revert ProtocolTimelock__InvalidTarget(address(permissionedPoolController));
        }
        if (selector == _SET_PERMISSIONED_SWAPPING_SELECTOR || selector == _SET_PERMISSIONED_HOOK_SELECTOR) {
            _requireLength(selector, data.length, 36);
            bool enabled = abi.decode(data[4:], (bool));
            if (keccak256(data) != keccak256(abi.encodeWithSelector(selector, enabled))) {
                revert ProtocolTimelock__DataLengthMismatch(selector, data.length);
            }
            return CRITICAL_CHANGE_DELAY;
        }
        if (selector == _UPDATE_PERMISSIONED_CHECKER_SELECTOR) {
            _requireLength(selector, data.length, 36);
            address checker = abi.decode(data[4:], (address));
            _requireContract(checker);
            if (keccak256(data) != keccak256(abi.encodeWithSelector(selector, checker))) {
                revert ProtocolTimelock__DataLengthMismatch(selector, data.length);
            }
            return CRITICAL_CHANGE_DELAY;
        }
        if (selector == _SET_PERMISSIONED_WRAPPER_SELECTOR) {
            _requireLength(selector, data.length, 68);
            (address wrapper, bool allowed) = abi.decode(data[4:], (address, bool));
            if (keccak256(data) != keccak256(abi.encodeWithSelector(selector, wrapper, allowed))) {
                revert ProtocolTimelock__DataLengthMismatch(selector, data.length);
            }
            return CRITICAL_CHANGE_DELAY;
        }
        revert ProtocolTimelock__UnsupportedOperation(address(permissionedPoolController), selector);
    }

    function _strategyDeployerDelay(bytes4 selector, bytes calldata data) private view returns (uint256) {
        if (!strategyBootstrapFinalized) revert ProtocolTimelock__StrategyBootstrapNotFinalized();
        if (selector != _DEPLOY_ACQUISITION_SELECTOR) {
            revert ProtocolTimelock__UnsupportedOperation(address(strategyDeployer), selector);
        }
        (
            bytes memory strategyCreationCode,
            bytes memory rewardsCreationCode,
            address targetToken,
            uint256 minimumLotUSDG,
            uint256 maximumLotUSDG,
            uint256 initialReferenceRate
        ) = abi.decode(data[4:], (bytes, bytes, address, uint256, uint256, uint256));
        if (
            keccak256(data)
                    != keccak256(
                        abi.encodeWithSelector(
                            selector,
                            strategyCreationCode,
                            rewardsCreationCode,
                            targetToken,
                            minimumLotUSDG,
                            maximumLotUSDG,
                            initialReferenceRate
                        )
                    ) || keccak256(strategyCreationCode) != strategyDeployer.ACQUISITION_STRATEGY_CREATION_CODE_HASH()
                || keccak256(rewardsCreationCode) != strategyDeployer.MANAGER_REWARDS_CREATION_CODE_HASH()
                || strategyCreationCode.length != strategyDeployer.ACQUISITION_STRATEGY_CREATION_CODE_LENGTH()
                || rewardsCreationCode.length != strategyDeployer.MANAGER_REWARDS_CREATION_CODE_LENGTH()
                || targetToken == address(0) || minimumLotUSDG == 0 || maximumLotUSDG < minimumLotUSDG
                || initialReferenceRate == 0
        ) revert ProtocolTimelock__InvalidStrategyDeploymentCalldata();
        return CRITICAL_CHANGE_DELAY;
    }

    function _requireStrategyBootstrapInitializer() private view {
        if (msg.sender != DEPLOYMENT_INITIALIZER) {
            revert ProtocolTimelock__UnauthorizedInitializer(msg.sender);
        }
        if (!targetsInitialized) revert ProtocolTimelock__TargetsNotInitialized();
        if (strategyBootstrapFinalized) revert ProtocolTimelock__StrategyBootstrapAlreadyFinalized();
    }

    function _requireStrategyDeployerGraph(
        IStrategyDeployer deployer,
        address registry,
        address voter,
        address guardian
    ) private view {
        if (
            !deployer.dependenciesConfigured() || deployer.PROTOCOL_TIMELOCK() != address(this)
                || deployer.ASSET_REGISTRY() != registry || deployer.ALLOCATION_VOTER() != voter
                || deployer.EMERGENCY_GUARDIAN() != guardian || deployer.GUM_BALL_VAULT().code.length == 0
                || deployer.GBX().code.length == 0 || deployer.ELIGIBILITY_MODULE().code.length == 0
        ) revert ProtocolTimelock__InvalidTarget(address(deployer));
    }

    function _registryDelay(bytes4 selector, bytes calldata data) private view returns (uint256) {
        uint256 dataLength = data.length;
        if (selector == _CONFIGURE_VAULT_SELECTOR) {
            _requireLength(selector, dataLength, 36);
            address proposedVault = abi.decode(data[4:], (address));
            if (
                proposedVault != strategyDeployer.GUM_BALL_VAULT()
                    || keccak256(data) != keccak256(abi.encodeWithSelector(selector, proposedVault))
            ) revert ProtocolTimelock__InvalidTarget(proposedVault);
            return CRITICAL_CHANGE_DELAY;
        }
        if (selector == _REGISTER_ASSET_SELECTOR) {
            _requireLength(selector, dataLength, 292);
            IAssetRegistry.AssetConfig memory config = abi.decode(data[4:], (IAssetRegistry.AssetConfig));
            _requireExistingStrategyProvenance(config);
            return CRITICAL_CHANGE_DELAY;
        }
        if (selector == _REGISTER_STOCK_ASSET_SELECTOR) {
            _requireLength(selector, dataLength, 484);
            (IAssetRegistry.AssetConfig memory config,) =
                abi.decode(data[4:], (IAssetRegistry.AssetConfig, IAssetRegistry.StockTokenDependency));
            _requireExistingStrategyProvenance(config);
            return CRITICAL_CHANGE_DELAY;
        }
        if (selector == _REGISTER_STANDALONE_SELECTOR) {
            _requireLength(selector, dataLength, 36);
            address strategy = abi.decode(data[4:], (address));
            IStrategyDeployer.BuybackDeployment memory deployment = strategyDeployer.canonicalBuybackDeployment();
            if (
                strategy == address(0) || strategy != strategyDeployer.canonicalBuybackBurnStrategy()
                    || deployment.runtimeCodeHash == bytes32(0)
            ) revert ProtocolTimelock__InvalidStrategyRegistrationProvenance(strategy);
            return CRITICAL_CHANGE_DELAY;
        }
        if (selector == _ENABLE_ACQUISITION_SELECTOR || selector == _ENABLE_STANDALONE_SELECTOR) {
            _requireLength(selector, dataLength, 36);
            return BOUNDED_MAINTENANCE_DELAY;
        }
        if (selector == _SET_REDEMPTION_SELECTOR) {
            _requireLength(selector, dataLength, 68);
            return BOUNDED_MAINTENANCE_DELAY;
        }
        revert ProtocolTimelock__UnsupportedOperation(address(0), selector);
    }

    /// @dev Registration scheduling must happen after CREATE provenance exists. This deliberately makes strategy
    ///      deployment and registry admission two serial seven-day reviews even when CREATE addresses are predictable.
    function _requireExistingStrategyProvenance(IAssetRegistry.AssetConfig memory config) private view {
        address strategy = config.strategy;
        if (config.token == strategyDeployer.USDG()) {
            bytes32 runtimeCodeHash = strategyDeployer.canonicalHoldUSDGRuntimeCodeHash();
            if (
                strategy == address(0) || strategy != strategyDeployer.canonicalHoldUSDGStrategy()
                    || runtimeCodeHash == bytes32(0) || strategy.code.length == 0
                    || strategy.codehash != runtimeCodeHash || config.rewards != address(0)
            ) revert ProtocolTimelock__InvalidStrategyRegistrationProvenance(strategy);
            return;
        }
        if (strategy == address(0)) {
            revert ProtocolTimelock__InvalidStrategyRegistrationProvenance(strategy);
        }

        IStrategyDeployer.AcquisitionPair memory pair = strategyDeployer.acquisitionPair(strategy);
        if (
            strategyDeployer.acquisitionStrategyForToken(config.token) != strategy || pair.targetToken != config.token
                || pair.managerRewards != config.rewards || pair.strategyRuntimeCodeHash == bytes32(0)
                || pair.rewardsRuntimeCodeHash == bytes32(0)
        ) revert ProtocolTimelock__InvalidStrategyRegistrationProvenance(strategy);
    }

    function _isRegisteredStrategy(address candidate) private view returns (bool) {
        uint256 count = assetRegistry.strategyCount();
        for (uint256 index; index < count; ++index) {
            if (assetRegistry.strategyAt(index) == candidate) return true;
        }
        return false;
    }

    function _migrationDelay(bytes4 selector, bytes calldata data) private view returns (uint256) {
        _requireMinimumLength(selector, data.length, 36);
        if (data.length > _MAX_MIGRATION_CALLDATA_LENGTH) revert ProtocolTimelock__InvalidMigrationCalldata();

        LiquidityManager.MigrationPlan memory plan = abi.decode(data[4:], (LiquidityManager.MigrationPlan));
        if (keccak256(data) != keccak256(abi.encodeWithSelector(selector, plan))) {
            revert ProtocolTimelock__InvalidMigrationCalldata();
        }
        uint256 removalCount = plan.removals.length;
        uint256 replacementCount = plan.replacements.length;
        if (
            removalCount == 0 || removalCount > _MAX_MIGRATION_POSITIONS || replacementCount == 0
                || replacementCount > _MAX_MIGRATION_POSITIONS
        ) revert ProtocolTimelock__InvalidMigrationCalldata();

        bytes32 expectedPoolKeyHash = keccak256(abi.encode(LiquidityManager(liquidityManager).poolKey()));
        bytes32 actualPoolKeyHash = keccak256(abi.encode(plan.destinationPoolKey));
        if (actualPoolKeyHash != expectedPoolKeyHash) {
            revert ProtocolTimelock__InvalidMigrationPoolKey(expectedPoolKeyHash, actualPoolKeyHash);
        }
        return CRITICAL_CHANGE_DELAY;
    }

    function _selector(bytes calldata data) private pure returns (bytes4) {
        return bytes4(data[:4]);
    }

    function _requireLength(bytes4 selector, uint256 actualLength, uint256 expectedLength) private pure {
        if (actualLength != expectedLength) {
            revert ProtocolTimelock__DataLengthMismatch(selector, actualLength);
        }
    }

    function _requireMinimumLength(bytes4 selector, uint256 actualLength, uint256 minimumLength) private pure {
        if (actualLength < minimumLength) {
            revert ProtocolTimelock__DataLengthMismatch(selector, actualLength);
        }
    }

    function _requireContract(address target) private view {
        if (target == address(0)) revert ProtocolTimelock__ZeroAddress();
        if (target.code.length == 0) revert ProtocolTimelock__InvalidTarget(target);
    }
}

interface IReferenceRateStrategy {
    /// @notice Returns the live human-normalized auction reference rate committed by a reset schedule.
    /// @return rate The current reference rate scaled by 1e18.
    function referenceRate() external view returns (uint256);
}
