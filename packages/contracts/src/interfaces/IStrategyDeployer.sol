// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title Canonical strategy deployment provenance
/// @notice Read-only boundary used by AssetRegistry to admit only exact protocol strategy implementations.
interface IStrategyDeployer {
    /// @notice Complete immutable graph and runtime provenance for one acquisition/reward pair.
    struct AcquisitionPair {
        address targetToken;
        address managerRewards;
        address gumBallVault;
        address allocationVoter;
        address assetRegistry;
        address protocolTimelock;
        address emergencyGuardian;
        address eligibilityModule;
        bytes32 strategyRuntimeCodeHash;
        bytes32 rewardsRuntimeCodeHash;
    }

    /// @notice Complete immutable graph and runtime provenance for the one canonical buyback.
    struct BuybackDeployment {
        address gbx;
        address gumBallVault;
        address allocationVoter;
        address assetRegistry;
        address protocolTimelock;
        address emergencyGuardian;
        bytes32 runtimeCodeHash;
    }

    /// @notice Immutable hash of the exact AcquisitionStrategy compiler creation bytecode.
    /// @return The committed creation-code hash.
    function ACQUISITION_STRATEGY_CREATION_CODE_HASH() external view returns (bytes32);
    /// @notice Immutable hash of the exact ManagerRewards compiler creation bytecode.
    /// @return The committed creation-code hash.
    function MANAGER_REWARDS_CREATION_CODE_HASH() external view returns (bytes32);
    /// @notice Immutable hash of the exact BuybackBurnStrategy compiler creation bytecode.
    /// @return The committed creation-code hash.
    function BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH() external view returns (bytes32);
    /// @notice Immutable hash of the exact HoldUSDGStrategy compiler creation bytecode.
    /// @return The committed creation-code hash.
    function HOLD_USDG_STRATEGY_CREATION_CODE_HASH() external view returns (bytes32);
    /// @notice Exact byte length of the committed AcquisitionStrategy compiler creation bytecode.
    /// @return The committed creation-code byte length.
    function ACQUISITION_STRATEGY_CREATION_CODE_LENGTH() external view returns (uint256);
    /// @notice Exact byte length of the committed ManagerRewards compiler creation bytecode.
    /// @return The committed creation-code byte length.
    function MANAGER_REWARDS_CREATION_CODE_LENGTH() external view returns (uint256);
    /// @notice Exact byte length of the committed BuybackBurnStrategy compiler creation bytecode.
    /// @return The committed creation-code byte length.
    function BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH() external view returns (uint256);
    /// @notice Exact byte length of the committed HoldUSDGStrategy compiler creation bytecode.
    /// @return The committed creation-code byte length.
    function HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH() external view returns (uint256);
    /// @notice Immutable reviewed number of acquisition targets permitted before bootstrap finalization.
    /// @return The expected bootstrap acquisition-target count.
    function EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT() external view returns (uint256);
    /// @notice Immutable hash of the exact reviewed ordered bootstrap acquisition target list.
    /// @return The expected ordered target-list hash.
    function EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH() external view returns (bytes32);

    /// @notice Canonical purpose-limited timelock and sole strategy deployment caller.
    /// @return The immutable ProtocolTimelock address.
    function PROTOCOL_TIMELOCK() external view returns (address);
    /// @notice Canonical stop-only strategy guardian.
    /// @return The immutable EmergencyGuardian address.
    function EMERGENCY_GUARDIAN() external view returns (address);
    /// @notice Canonical cumulatively capped GBX token.
    /// @return The immutable GBX token address.
    function GBX() external view returns (address);
    /// @notice Canonical quote token shared by the registry, voter, and vault graph.
    /// @return The immutable USDG token address.
    function USDG() external view returns (address);
    /// @notice Canonical raw-balance basket vault.
    /// @return The immutable GumBallVault address.
    function GUM_BALL_VAULT() external view returns (address);
    /// @notice Canonical strategy allocation voter.
    /// @return The immutable AllocationVoter address.
    function ALLOCATION_VOTER() external view returns (address);
    /// @notice Canonical bounded asset and strategy registry.
    /// @return The immutable AssetRegistry address.
    function ASSET_REGISTRY() external view returns (address);
    /// @notice Canonical manager reward receiver eligibility module.
    /// @return The immutable eligibility-module address.
    function ELIGIBILITY_MODULE() external view returns (address);
    /// @notice Whether the complete canonical dependency graph has been permanently bound.
    /// @return Whether dependency initialization has completed.
    function dependenciesConfigured() external view returns (bool);
    /// @notice Whether the reviewed prelaunch acquisition set and singleton window are permanently sealed.
    /// @return Whether strategy bootstrap has been finalized.
    function strategyBootstrapFinalized() external view returns (bool);
    /// @notice Finalized acquisition target count, permanently zero until successful bootstrap closure.
    /// @return The finalized bootstrap target count.
    function bootstrapAcquisitionTargetCount() external view returns (uint256);
    /// @notice Finalized ordered acquisition target hash, permanently zero until successful bootstrap closure.
    /// @return The finalized ordered target-list hash.
    function bootstrapAcquisitionTargetsHash() external view returns (bytes32);

    /// @notice One canonical inert hold-USDG signal target.
    /// @return The deployed HoldUSDGStrategy address, or zero before deployment.
    function canonicalHoldUSDGStrategy() external view returns (address);
    /// @notice Registration-time runtime code hash of the canonical hold target.
    /// @return The recorded runtime code hash, or zero before deployment.
    function canonicalHoldUSDGRuntimeCodeHash() external view returns (bytes32);
    /// @notice One canonical buyback-and-burn strategy.
    /// @return The deployed BuybackBurnStrategy address, or zero before deployment.
    function canonicalBuybackBurnStrategy() external view returns (address);
    /// @notice Returns the full immutable graph and runtime provenance for the canonical buyback.
    /// @return deployment The recorded buyback graph and runtime identity.
    function canonicalBuybackDeployment() external view returns (BuybackDeployment memory deployment);
    /// @notice Returns the full immutable graph and runtime provenance for an acquisition strategy.
    /// @param strategy The recorded AcquisitionStrategy address.
    /// @return pair The recorded reciprocal acquisition/rewards graph and runtime identities.
    function acquisitionPair(address strategy) external view returns (AcquisitionPair memory pair);
    /// @notice Returns the one deployed acquisition strategy reserved for a target token.
    /// @param targetToken The canonical target-token address.
    /// @return strategy The recorded AcquisitionStrategy address, or zero before deployment.
    function acquisitionStrategyForToken(address targetToken) external view returns (address strategy);
    /// @notice Number of target tokens for which an acquisition pair has been successfully deployed.
    /// @return count The number of deployed acquisition targets.
    function acquisitionTargetCount() external view returns (uint256 count);
    /// @notice Returns a deployed acquisition target in immutable deployment order.
    /// @param index The zero-based deployment-order index.
    /// @return targetToken The target-token address at the requested index.
    function acquisitionTargetAt(uint256 index) external view returns (address targetToken);

    /// @notice Seals the prelaunch deployment set after matching every reviewed target in deployment order.
    /// @dev This irreversible transition rejects any count, order, singleton, or dependency-graph mismatch.
    /// @param expectedAcquisitionTargets Exact reviewed target list in deployment order.
    function finalizeBootstrap(address[] calldata expectedAcquisitionTargets) external;

    /// @notice Deploys the one exact hold-USDG implementation from committed compiler creation code.
    /// @param creationCode Exact committed HoldUSDGStrategy compiler creation bytecode.
    /// @return strategy The directly deployed canonical HoldUSDGStrategy address.
    function deployHoldUSDG(bytes calldata creationCode) external returns (address strategy);

    /// @notice Deploys and binds one exact acquisition/reward pair for a target token.
    /// @param strategyCreationCode Exact committed AcquisitionStrategy compiler creation bytecode.
    /// @param rewardsCreationCode Exact committed ManagerRewards compiler creation bytecode.
    /// @param targetToken Canonical target asset for the new strategy.
    /// @param minimumLotUSDG Smallest USDG lot the strategy may release in one fill.
    /// @param maximumLotUSDG Largest USDG lot the strategy may release in one fill.
    /// @param initialReferenceRate Initial target-token-units-per-USDG auction reference rate.
    /// @return strategy The directly deployed AcquisitionStrategy address.
    /// @return rewards The directly deployed and reciprocally bound ManagerRewards address.
    function deployAcquisition(
        bytes calldata strategyCreationCode,
        bytes calldata rewardsCreationCode,
        address targetToken,
        uint256 minimumLotUSDG,
        uint256 maximumLotUSDG,
        uint256 initialReferenceRate
    ) external returns (address strategy, address rewards);

    /// @notice Deploys the one exact buyback-and-burn implementation from committed compiler creation code.
    /// @param creationCode Exact committed BuybackBurnStrategy compiler creation bytecode.
    /// @param minimumLotUSDG Smallest USDG lot the strategy may release in one fill.
    /// @param maximumLotUSDG Largest USDG lot the strategy may release in one fill.
    /// @param initialReferenceRate Initial GBX-units-per-USDG auction reference rate.
    /// @return strategy The directly deployed canonical BuybackBurnStrategy address.
    function deployBuyback(
        bytes calldata creationCode,
        uint256 minimumLotUSDG,
        uint256 maximumLotUSDG,
        uint256 initialReferenceRate
    ) external returns (address strategy);
}
