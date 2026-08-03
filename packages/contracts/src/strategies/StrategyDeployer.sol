// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IStrategyDeployer } from "../interfaces/IStrategyDeployer.sol";
import { AcquisitionStrategy } from "./AcquisitionStrategy.sol";

interface IStrategyDeployerRegistryIdentity is IAssetRegistry {
    /// @notice Returns the registry's canonical USDG token.
    function USDG() external view returns (address);
    /// @notice Returns the registry's canonical protocol timelock.
    function PROTOCOL_TIMELOCK() external view returns (address);
    /// @notice Returns the registry's canonical emergency guardian.
    function EMERGENCY_GUARDIAN() external view returns (address);
    /// @notice Returns the registry's canonical typed strategy deployer.
    function STRATEGY_DEPLOYER() external view returns (address);
}

interface IStrategyDeployerVoterIdentity is IAllocationVoter {
    /// @notice Returns the voter's canonical USDG token.
    function USDG() external view returns (address);
    /// @notice Returns the voter's canonical asset registry.
    function ASSET_REGISTRY() external view returns (address);
    /// @notice Returns the voter's canonical protocol timelock.
    function PROTOCOL_TIMELOCK() external view returns (address);
    /// @notice Returns the voter's canonical emergency guardian.
    function EMERGENCY_GUARDIAN() external view returns (address);
    /// @notice Returns whether the voter's set-once dependencies are configured.
    function dependenciesConfigured() external view returns (bool);
    /// @notice Returns the canonical GumBallVault bound to the voter.
    function vault() external view returns (address);
    /// @notice Returns the canonical non-transferable staked GBX token.
    function stakedGBX() external view returns (address);
}

interface IStrategyDeployerVaultIdentity {
    /// @notice Returns the vault's canonical GBX token.
    function GBX() external view returns (address);
    /// @notice Returns the vault's canonical asset registry.
    function ASSET_REGISTRY() external view returns (address);
    /// @notice Returns the vault's canonical allocation voter.
    function ALLOCATION_VOTER() external view returns (address);
    /// @notice Returns the vault's canonical eligibility module.
    function ELIGIBILITY_MODULE() external view returns (address);
    /// @notice Returns the vault's canonical USDG token.
    function USDG() external view returns (address);
}

interface IStrategyDeployerStakedIdentity {
    /// @notice Returns the staking token's canonical GBX token.
    function GBX() external view returns (address);
    /// @notice Returns the staking token's canonical allocation voter.
    function ALLOCATION_VOTER() external view returns (address);
    /// @notice Returns the staking token's canonical eligibility module.
    function ELIGIBILITY_MODULE() external view returns (address);
}

/// @title StrategyDeployer
/// @notice Typed deployment provenance for exact, directly deployed, non-upgradeable protocol strategies.
/// @dev Only ProtocolTimelock can call deployment functions. Caller-supplied creation code must hash to the exact
///      compiler output pinned into this contract, so this surface cannot create arbitrary bytecode.
contract StrategyDeployer is IStrategyDeployer, ReentrancyGuard {
    uint256 private constant _MAX_BOOTSTRAP_ACQUISITION_TARGETS = 15;
    /// @notice Exact compiler creation-code hash accepted for AcquisitionStrategy deployments.
    bytes32 public immutable ACQUISITION_STRATEGY_CREATION_CODE_HASH;
    /// @notice Exact compiler creation-code hash accepted for ManagerRewards deployments.
    bytes32 public immutable MANAGER_REWARDS_CREATION_CODE_HASH;
    /// @notice Exact compiler creation-code hash accepted for the canonical BuybackBurnStrategy deployment.
    bytes32 public immutable BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH;
    /// @notice Exact compiler creation-code hash accepted for the canonical HoldUSDGStrategy deployment.
    bytes32 public immutable HOLD_USDG_STRATEGY_CREATION_CODE_HASH;
    /// @notice Exact accepted AcquisitionStrategy compiler creation-code byte length.
    uint256 public immutable ACQUISITION_STRATEGY_CREATION_CODE_LENGTH;
    /// @notice Exact accepted ManagerRewards compiler creation-code byte length.
    uint256 public immutable MANAGER_REWARDS_CREATION_CODE_LENGTH;
    /// @notice Exact accepted BuybackBurnStrategy compiler creation-code byte length.
    uint256 public immutable BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH;
    /// @notice Exact accepted HoldUSDGStrategy compiler creation-code byte length.
    uint256 public immutable HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH;
    /// @notice Reviewed acquisition-target count that bootstrap finalization must match.
    uint256 public immutable EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT;
    /// @notice Hash of the ABI-encoded ordered acquisition-target list bootstrap finalization must match.
    bytes32 public immutable EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH;

    /// @notice Canonical purpose-limited timelock and sole strategy deployment caller.
    address public immutable override PROTOCOL_TIMELOCK;
    /// @notice Canonical stop-only guardian inherited by deployed auction strategies.
    address public immutable override EMERGENCY_GUARDIAN;
    /// @notice Canonical cumulatively capped GBX token inherited by the buyback strategy.
    address public immutable override GBX;
    /// @notice One-use account permitted to bind the reciprocal protocol dependency graph.
    address public immutable DEPENDENCY_INITIALIZER;

    /// @notice Canonical USDG token fixed when the reciprocal graph is initialized.
    address public override USDG;
    /// @notice Canonical raw-balance basket vault fixed when the reciprocal graph is initialized.
    address public override GUM_BALL_VAULT;
    /// @notice Canonical allocation voter fixed when the reciprocal graph is initialized.
    address public override ALLOCATION_VOTER;
    /// @notice Canonical bounded registry fixed when the reciprocal graph is initialized.
    address public override ASSET_REGISTRY;
    /// @notice Canonical eligibility module fixed when the reciprocal graph is initialized.
    address public override ELIGIBILITY_MODULE;
    /// @notice Whether the complete reciprocal dependency graph has been bound exactly once.
    bool public override dependenciesConfigured;
    /// @notice Whether the reviewed prelaunch strategy set has been permanently finalized.
    bool public override strategyBootstrapFinalized;
    /// @notice Acquisition-target count persisted at successful bootstrap finalization.
    uint256 public override bootstrapAcquisitionTargetCount;
    /// @notice Ordered acquisition-target hash persisted at successful bootstrap finalization.
    bytes32 public override bootstrapAcquisitionTargetsHash;

    /// @notice Canonical inert hold-USDG signal strategy deployed during bootstrap.
    address public override canonicalHoldUSDGStrategy;
    /// @notice Runtime code hash recorded for the canonical hold-USDG strategy.
    bytes32 public override canonicalHoldUSDGRuntimeCodeHash;
    /// @notice Canonical GBX buyback-and-burn strategy deployed during bootstrap.
    address public override canonicalBuybackBurnStrategy;
    BuybackDeployment private _canonicalBuybackDeployment;
    mapping(address strategy => AcquisitionPair pair) private _acquisitionPair;
    /// @notice Returns the unique acquisition strategy deployed for a target token, or zero if absent.
    mapping(address targetToken => address strategy) public override acquisitionStrategyForToken;
    address[] private _acquisitionTargets;

    error StrategyDeployer__AlreadyConfigured();
    error StrategyDeployer__AlreadyDeployed(address subject);
    error StrategyDeployer__CreationCodeHashMismatch(bytes32 expected, bytes32 actual);
    error StrategyDeployer__CreationCodeLengthMismatch(uint256 expected, uint256 actual);
    error StrategyDeployer__DependenciesNotConfigured();
    error StrategyDeployer__DeploymentFailed();
    error StrategyDeployer__BootstrapAlreadyFinalized();
    error StrategyDeployer__BootstrapTargetsHashMismatch(bytes32 expected, bytes32 actual);
    error StrategyDeployer__BootstrapTargetCountMismatch(uint256 expected, uint256 actual);
    error StrategyDeployer__BootstrapTargetMismatch(uint256 index, address expected, address actual);
    error StrategyDeployer__InvalidDependencyGraph(address subject);
    error StrategyDeployer__InvalidBootstrapCommitment(uint256 count, bytes32 targetsHash);
    error StrategyDeployer__InvalidCreationCodeHash();
    error StrategyDeployer__NotProtocolTimelock(address caller);
    error StrategyDeployer__UnauthorizedInitializer(address caller);
    error StrategyDeployer__ZeroAddress();

    event StrategyDeployer__DependenciesConfigured(
        address indexed assetRegistry,
        address indexed allocationVoter,
        address indexed gumBallVault,
        address eligibilityModule
    );
    event StrategyDeployer__HoldUSDGDeployed(address indexed strategy, bytes32 runtimeCodeHash);
    event StrategyDeployer__AcquisitionPairDeployed(
        address indexed targetToken,
        address indexed strategy,
        address indexed managerRewards,
        bytes32 strategyRuntimeCodeHash,
        bytes32 rewardsRuntimeCodeHash
    );
    event StrategyDeployer__BuybackDeployed(address indexed strategy, bytes32 runtimeCodeHash);
    event StrategyDeployer__BootstrapFinalized(uint256 acquisitionTargetCount, bytes32 acquisitionTargetsHash);

    modifier onlyProtocolTimelock() {
        if (msg.sender != PROTOCOL_TIMELOCK) revert StrategyDeployer__NotProtocolTimelock(msg.sender);
        _;
    }

    modifier onlyConfigured() {
        if (!dependenciesConfigured) revert StrategyDeployer__DependenciesNotConfigured();
        _;
    }

    /// @notice Deploys the immutable typed strategy-creation authority.
    /// @param protocolTimelock Sole caller permitted to deploy or finalize strategies.
    /// @param emergencyGuardian Canonical stop-only strategy guardian.
    /// @param gbx Canonical cumulatively capped GBX token.
    /// @param dependencyInitializer One-use account permitted to close the canonical dependency graph.
    /// @param codeAndBootstrapHashes Positional commitments: 0 AcquisitionStrategy creation code, 1 ManagerRewards
    ///        creation code, 2 BuybackBurnStrategy creation code, 3 HoldUSDGStrategy creation code, and 4 the
    ///        ABI-encoded ordered bootstrap acquisition-target list.
    /// @param codeLengthsAndBootstrapCount Positional commitments: 0..3 are the exact byte lengths corresponding to
    ///        `codeAndBootstrapHashes[0..3]`; index 4 is the reviewed bootstrap acquisition-target count.
    constructor(
        address protocolTimelock,
        address emergencyGuardian,
        address gbx,
        address dependencyInitializer,
        bytes32[5] memory codeAndBootstrapHashes,
        uint256[5] memory codeLengthsAndBootstrapCount
    ) {
        if (
            protocolTimelock == address(0) || emergencyGuardian == address(0) || gbx == address(0)
                || dependencyInitializer == address(0)
        ) revert StrategyDeployer__ZeroAddress();
        if (protocolTimelock.code.length == 0 || emergencyGuardian.code.length == 0 || gbx.code.length == 0) {
            revert StrategyDeployer__InvalidDependencyGraph(address(0));
        }
        if (
            codeAndBootstrapHashes[0] == bytes32(0) || codeAndBootstrapHashes[1] == bytes32(0)
                || codeAndBootstrapHashes[2] == bytes32(0) || codeAndBootstrapHashes[3] == bytes32(0)
        ) revert StrategyDeployer__InvalidCreationCodeHash();
        if (
            codeLengthsAndBootstrapCount[0] == 0 || codeLengthsAndBootstrapCount[1] == 0
                || codeLengthsAndBootstrapCount[2] == 0 || codeLengthsAndBootstrapCount[3] == 0
        ) revert StrategyDeployer__CreationCodeLengthMismatch(1, 0);
        if (
            codeLengthsAndBootstrapCount[4] > _MAX_BOOTSTRAP_ACQUISITION_TARGETS
                || codeAndBootstrapHashes[4] == bytes32(0)
        ) {
            revert StrategyDeployer__InvalidBootstrapCommitment(
                codeLengthsAndBootstrapCount[4], codeAndBootstrapHashes[4]
            );
        }
        PROTOCOL_TIMELOCK = protocolTimelock;
        EMERGENCY_GUARDIAN = emergencyGuardian;
        GBX = gbx;
        DEPENDENCY_INITIALIZER = dependencyInitializer;
        ACQUISITION_STRATEGY_CREATION_CODE_HASH = codeAndBootstrapHashes[0];
        MANAGER_REWARDS_CREATION_CODE_HASH = codeAndBootstrapHashes[1];
        BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH = codeAndBootstrapHashes[2];
        HOLD_USDG_STRATEGY_CREATION_CODE_HASH = codeAndBootstrapHashes[3];
        ACQUISITION_STRATEGY_CREATION_CODE_LENGTH = codeLengthsAndBootstrapCount[0];
        MANAGER_REWARDS_CREATION_CODE_LENGTH = codeLengthsAndBootstrapCount[1];
        BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH = codeLengthsAndBootstrapCount[2];
        HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH = codeLengthsAndBootstrapCount[3];
        EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT = codeLengthsAndBootstrapCount[4];
        EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH = codeAndBootstrapHashes[4];
    }

    /// @notice Closes the sole construction cycle and permanently binds the canonical protocol graph.
    function initializeDependencies(
        address assetRegistry,
        address allocationVoter,
        address gumBallVault,
        address eligibilityModule
    ) external nonReentrant {
        if (msg.sender != DEPENDENCY_INITIALIZER) {
            revert StrategyDeployer__UnauthorizedInitializer(msg.sender);
        }
        if (dependenciesConfigured) revert StrategyDeployer__AlreadyConfigured();
        if (
            assetRegistry == address(0) || allocationVoter == address(0) || gumBallVault == address(0)
                || eligibilityModule == address(0)
        ) revert StrategyDeployer__ZeroAddress();
        if (
            assetRegistry.code.length == 0 || allocationVoter.code.length == 0 || gumBallVault.code.length == 0
                || eligibilityModule.code.length == 0
        ) revert StrategyDeployer__InvalidDependencyGraph(address(0));

        IStrategyDeployerRegistryIdentity registry = IStrategyDeployerRegistryIdentity(assetRegistry);
        IStrategyDeployerVoterIdentity voter = IStrategyDeployerVoterIdentity(allocationVoter);
        IStrategyDeployerVaultIdentity vault = IStrategyDeployerVaultIdentity(gumBallVault);
        if (
            registry.PROTOCOL_TIMELOCK() != PROTOCOL_TIMELOCK || registry.EMERGENCY_GUARDIAN() != EMERGENCY_GUARDIAN
                || registry.STRATEGY_DEPLOYER() != address(this)
        ) revert StrategyDeployer__InvalidDependencyGraph(assetRegistry);
        if (
            voter.ASSET_REGISTRY() != assetRegistry || voter.PROTOCOL_TIMELOCK() != PROTOCOL_TIMELOCK
                || voter.EMERGENCY_GUARDIAN() != EMERGENCY_GUARDIAN || voter.USDG() != registry.USDG()
                || !voter.dependenciesConfigured() || voter.vault() != gumBallVault
        ) revert StrategyDeployer__InvalidDependencyGraph(allocationVoter);
        if (
            vault.GBX() != GBX || vault.ASSET_REGISTRY() != assetRegistry || vault.ALLOCATION_VOTER() != allocationVoter
                || vault.ELIGIBILITY_MODULE() != eligibilityModule || vault.USDG() != registry.USDG()
        ) revert StrategyDeployer__InvalidDependencyGraph(gumBallVault);
        address stakedGBX = voter.stakedGBX();
        if (stakedGBX.code.length == 0) revert StrategyDeployer__InvalidDependencyGraph(stakedGBX);
        IStrategyDeployerStakedIdentity staked = IStrategyDeployerStakedIdentity(stakedGBX);
        if (
            staked.GBX() != GBX || staked.ALLOCATION_VOTER() != allocationVoter
                || staked.ELIGIBILITY_MODULE() != eligibilityModule
        ) revert StrategyDeployer__InvalidDependencyGraph(stakedGBX);

        ASSET_REGISTRY = assetRegistry;
        ALLOCATION_VOTER = allocationVoter;
        GUM_BALL_VAULT = gumBallVault;
        ELIGIBILITY_MODULE = eligibilityModule;
        USDG = registry.USDG();
        dependenciesConfigured = true;
        emit StrategyDeployer__DependenciesConfigured(assetRegistry, allocationVoter, gumBallVault, eligibilityModule);
    }

    function deployHoldUSDG(bytes calldata creationCode)
        external
        override
        nonReentrant
        onlyProtocolTimelock
        onlyConfigured
        returns (address strategy)
    {
        if (canonicalHoldUSDGStrategy != address(0)) {
            revert StrategyDeployer__AlreadyDeployed(canonicalHoldUSDGStrategy);
        }
        if (strategyBootstrapFinalized) revert StrategyDeployer__BootstrapAlreadyFinalized();
        _requireCreationCode(
            creationCode, HOLD_USDG_STRATEGY_CREATION_CODE_HASH, HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH
        );
        strategy = _deploy(creationCode);
        canonicalHoldUSDGStrategy = strategy;
        canonicalHoldUSDGRuntimeCodeHash = strategy.codehash;
        emit StrategyDeployer__HoldUSDGDeployed(strategy, canonicalHoldUSDGRuntimeCodeHash);
    }

    function deployAcquisition(
        bytes calldata strategyCreationCode,
        bytes calldata rewardsCreationCode,
        address targetToken,
        uint256 minimumLotUSDG,
        uint256 maximumLotUSDG,
        uint256 initialReferenceRate
    ) external override nonReentrant onlyProtocolTimelock onlyConfigured returns (address strategy, address rewards) {
        if (targetToken == address(0)) revert StrategyDeployer__ZeroAddress();
        if (acquisitionStrategyForToken[targetToken] != address(0)) {
            revert StrategyDeployer__AlreadyDeployed(targetToken);
        }
        IStrategyDeployerVaultIdentity vault = IStrategyDeployerVaultIdentity(GUM_BALL_VAULT);
        if (targetToken == vault.USDG() || targetToken == GBX) {
            revert StrategyDeployer__InvalidDependencyGraph(targetToken);
        }
        _requireCreationCode(
            strategyCreationCode, ACQUISITION_STRATEGY_CREATION_CODE_HASH, ACQUISITION_STRATEGY_CREATION_CODE_LENGTH
        );
        _requireCreationCode(
            rewardsCreationCode, MANAGER_REWARDS_CREATION_CODE_HASH, MANAGER_REWARDS_CREATION_CODE_LENGTH
        );

        strategy = _deploy(
            bytes.concat(
                strategyCreationCode,
                abi.encode(
                    targetToken,
                    GUM_BALL_VAULT,
                    ALLOCATION_VOTER,
                    ASSET_REGISTRY,
                    PROTOCOL_TIMELOCK,
                    EMERGENCY_GUARDIAN,
                    address(this),
                    minimumLotUSDG,
                    maximumLotUSDG,
                    initialReferenceRate
                )
            )
        );
        rewards = _deploy(
            bytes.concat(
                rewardsCreationCode,
                abi.encode(targetToken, strategy, ALLOCATION_VOTER, GUM_BALL_VAULT, ELIGIBILITY_MODULE)
            )
        );
        AcquisitionStrategy(strategy).initializeManagerRewards(rewards);

        bytes32 strategyRuntimeCodeHash = strategy.codehash;
        bytes32 rewardsRuntimeCodeHash = rewards.codehash;
        _acquisitionPair[strategy] = AcquisitionPair({
            targetToken: targetToken,
            managerRewards: rewards,
            gumBallVault: GUM_BALL_VAULT,
            allocationVoter: ALLOCATION_VOTER,
            assetRegistry: ASSET_REGISTRY,
            protocolTimelock: PROTOCOL_TIMELOCK,
            emergencyGuardian: EMERGENCY_GUARDIAN,
            eligibilityModule: ELIGIBILITY_MODULE,
            strategyRuntimeCodeHash: strategyRuntimeCodeHash,
            rewardsRuntimeCodeHash: rewardsRuntimeCodeHash
        });
        acquisitionStrategyForToken[targetToken] = strategy;
        _acquisitionTargets.push(targetToken);
        emit StrategyDeployer__AcquisitionPairDeployed(
            targetToken, strategy, rewards, strategyRuntimeCodeHash, rewardsRuntimeCodeHash
        );
    }

    function deployBuyback(
        bytes calldata creationCode,
        uint256 minimumLotUSDG,
        uint256 maximumLotUSDG,
        uint256 initialReferenceRate
    ) external override nonReentrant onlyProtocolTimelock onlyConfigured returns (address strategy) {
        if (canonicalBuybackBurnStrategy != address(0)) {
            revert StrategyDeployer__AlreadyDeployed(canonicalBuybackBurnStrategy);
        }
        if (strategyBootstrapFinalized) revert StrategyDeployer__BootstrapAlreadyFinalized();
        _requireCreationCode(
            creationCode, BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH, BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH
        );
        strategy = _deploy(
            bytes.concat(
                creationCode,
                abi.encode(
                    GBX,
                    GUM_BALL_VAULT,
                    ALLOCATION_VOTER,
                    ASSET_REGISTRY,
                    PROTOCOL_TIMELOCK,
                    EMERGENCY_GUARDIAN,
                    minimumLotUSDG,
                    maximumLotUSDG,
                    initialReferenceRate
                )
            )
        );
        bytes32 runtimeCodeHash = strategy.codehash;
        canonicalBuybackBurnStrategy = strategy;
        _canonicalBuybackDeployment = BuybackDeployment({
            gbx: GBX,
            gumBallVault: GUM_BALL_VAULT,
            allocationVoter: ALLOCATION_VOTER,
            assetRegistry: ASSET_REGISTRY,
            protocolTimelock: PROTOCOL_TIMELOCK,
            emergencyGuardian: EMERGENCY_GUARDIAN,
            runtimeCodeHash: runtimeCodeHash
        });
        emit StrategyDeployer__BuybackDeployed(strategy, runtimeCodeHash);
    }

    function acquisitionPair(address strategy) external view override returns (AcquisitionPair memory pair) {
        pair = _acquisitionPair[strategy];
    }

    function canonicalBuybackDeployment() external view override returns (BuybackDeployment memory deployment) {
        deployment = _canonicalBuybackDeployment;
    }

    function acquisitionTargetCount() external view override returns (uint256 count) {
        count = _acquisitionTargets.length;
    }

    function acquisitionTargetAt(uint256 index) external view override returns (address targetToken) {
        targetToken = _acquisitionTargets[index];
    }

    function finalizeBootstrap(address[] calldata expectedAcquisitionTargets)
        external
        override
        nonReentrant
        onlyProtocolTimelock
        onlyConfigured
    {
        if (strategyBootstrapFinalized) revert StrategyDeployer__BootstrapAlreadyFinalized();
        uint256 count = _acquisitionTargets.length;
        bytes32 targetsHash = keccak256(abi.encode(expectedAcquisitionTargets));
        if (expectedAcquisitionTargets.length != EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT) {
            revert StrategyDeployer__BootstrapTargetCountMismatch(
                EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT, expectedAcquisitionTargets.length
            );
        }
        if (targetsHash != EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH) {
            revert StrategyDeployer__BootstrapTargetsHashMismatch(
                EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH, targetsHash
            );
        }
        if (expectedAcquisitionTargets.length != count) {
            revert StrategyDeployer__BootstrapTargetCountMismatch(expectedAcquisitionTargets.length, count);
        }
        for (uint256 index; index < count; ++index) {
            address actual = _acquisitionTargets[index];
            address expected = expectedAcquisitionTargets[index];
            if (expected == address(0) || expected != actual) {
                revert StrategyDeployer__BootstrapTargetMismatch(index, expected, actual);
            }
        }
        bootstrapAcquisitionTargetCount = count;
        bootstrapAcquisitionTargetsHash = targetsHash;
        strategyBootstrapFinalized = true;
        emit StrategyDeployer__BootstrapFinalized(count, targetsHash);
    }

    function _requireCreationCode(bytes calldata creationCode, bytes32 expectedHash, uint256 expectedLength)
        private
        pure
    {
        if (creationCode.length != expectedLength) {
            revert StrategyDeployer__CreationCodeLengthMismatch(expectedLength, creationCode.length);
        }
        bytes32 actual = keccak256(creationCode);
        if (actual != expectedHash) revert StrategyDeployer__CreationCodeHashMismatch(expectedHash, actual);
    }

    function _deploy(bytes memory initCode) private returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
        }
        if (deployed == address(0) || deployed.code.length == 0) revert StrategyDeployer__DeploymentFailed();
    }
}
