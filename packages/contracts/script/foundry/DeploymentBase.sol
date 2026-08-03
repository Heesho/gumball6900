// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Hooks } from "@uniswap/v4-core/src/libraries/Hooks.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { HookMiner } from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import { EmergencyGuardian } from "../../src/access/EmergencyGuardian.sol";
import { NoopEligibilityModule } from "../../src/access/NoopEligibilityModule.sol";
import { ProtocolTimelock } from "../../src/access/ProtocolTimelock.sol";
import { RegistryEligibilityModule } from "../../src/access/RegistryEligibilityModule.sol";
import { IAssetRegistry } from "../../src/interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../../src/interfaces/IEligibilityModule.sol";
import { GumBallLens } from "../../src/lens/GumBallLens.sol";
import { LaunchGuardHook } from "../../src/liquidity/LaunchGuardHook.sol";
import { GenesisLiquidityCalculator } from "../../src/liquidity/GenesisLiquidityCalculator.sol";
import { LiquidityManager } from "../../src/liquidity/LiquidityManager.sol";
import { EmissionController } from "../../src/mining/EmissionController.sol";
import { GenesisBootstrap } from "../../src/mining/GenesisBootstrap.sol";
import { GenesisClaims } from "../../src/mining/GenesisClaims.sol";
import { MiningClaims } from "../../src/mining/MiningClaims.sol";
import { MiningPool } from "../../src/mining/MiningPool.sol";
import { ManagerRewards } from "../../src/rewards/ManagerRewards.sol";
import { GumBallRouter } from "../../src/router/GumBallRouter.sol";
import { AllocationVoter } from "../../src/signal/AllocationVoter.sol";
import { StakedGBX } from "../../src/signal/StakedGBX.sol";
import { AcquisitionStrategy } from "../../src/strategies/AcquisitionStrategy.sol";
import { BuybackBurnStrategy } from "../../src/strategies/BuybackBurnStrategy.sol";
import { HoldUSDGStrategy } from "../../src/strategies/HoldUSDGStrategy.sol";
import { RevenueRouter } from "../../src/strategies/RevenueRouter.sol";
import { StrategyDeployer } from "../../src/strategies/StrategyDeployer.sol";
import { GBXToken } from "../../src/token/GBXToken.sol";
import { AssetRegistry } from "../../src/vault/AssetRegistry.sol";
import { GumBallVault } from "../../src/vault/GumBallVault.sol";

/// @notice Shared, non-factory deployment graph used by phased Foundry scripts and local rehearsals.
abstract contract DeploymentBase is Script {
    address internal constant CANONICAL_CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint256 internal constant MAX_TARGET_ASSETS = 15;

    enum EligibilityMode {
        NoopTestOnly,
        RegistryAdapter,
        PredeployedModule
    }

    struct Config {
        bytes32 configHash;
        address usdG;
        address poolManager;
        address positionManager;
        address permit2;
        address protocolTimelockMultisig;
        address emergencyGuardianOperator;
        address genesisLiquidityBacker;
        address dependencyInitializer;
        uint8 usdGDecimals;
        EligibilityMode eligibilityMode;
        address eligibilityRegistry;
        address predeployedEligibilityModule;
        uint256 minimumBootstrapUSDG;
        uint256 bootstrapContributionCap;
        uint256 minimumLotUSDG;
        uint256 maximumLotUSDG;
        uint256 buybackInitialReferenceRate;
        uint24 poolFee;
        int24 tickSpacing;
        uint16[4] allocationBps;
        int24[4] cumulativeTickDeltas;
        address[] targetTokens;
        bytes32[] targetAssetIds;
        bytes32[] targetSymbolHashes;
        uint8[] targetDecimals;
        bool[] targetIsStockToken;
        bytes32[] targetRuntimeCodeHashes;
        uint256[] targetUiMultipliers;
        address stockTokenBeacon;
        bytes32 stockTokenBeaconRuntimeCodeHash;
        address stockTokenImplementation;
        bytes32 stockTokenImplementationRuntimeCodeHash;
        uint256[] targetInitialReferenceRates;
    }

    struct Deployment {
        ProtocolTimelock protocolTimelock;
        EmergencyGuardian emergencyGuardian;
        IEligibilityModule eligibilityModule;
        GBXToken gbx;
        StrategyDeployer strategyDeployer;
        EmissionController emissionController;
        GenesisClaims genesisClaims;
        MiningClaims miningClaims;
        AssetRegistry assetRegistry;
        AllocationVoter allocationVoter;
        GumBallVault gumBallVault;
        StakedGBX stakedGBX;
        GumBallRouter gumBallRouter;
        MiningPool miningPool;
        GenesisBootstrap genesisBootstrap;
        RevenueRouter revenueRouter;
        HoldUSDGStrategy holdUSDGStrategy;
        AcquisitionStrategy[] acquisitionStrategies;
        ManagerRewards[] managerRewards;
        BuybackBurnStrategy buybackBurnStrategy;
        LaunchGuardHook launchGuardHook;
        GenesisLiquidityCalculator genesisLiquidityCalculator;
        LiquidityManager liquidityManager;
        GumBallLens lens;
        bytes32 hookSalt;
    }

    struct DeploymentAddresses {
        uint256 chainId;
        bytes32 configHash;
        address dependencyInitializer;
        address protocolTimelock;
        address emergencyGuardian;
        address eligibilityModule;
        address gbx;
        address strategyDeployer;
        address emissionController;
        address genesisClaims;
        address miningClaims;
        address assetRegistry;
        address allocationVoter;
        address gumBallVault;
        address stakedGBX;
        address gumBallRouter;
        address miningPool;
        address genesisBootstrap;
        address revenueRouter;
        address holdUSDGStrategy;
        address buybackBurnStrategy;
        address launchGuardHook;
        address genesisLiquidityCalculator;
        address liquidityManager;
        address lens;
        address[] acquisitionStrategies;
        address[] managerRewards;
        string[] gbxContractHolderRoles;
        address[] gbxContractHolders;
        string[] gbxContractHolderRationales;
        bytes32 hookSalt;
    }

    error Deployment__AddressHasNoCode(address account);
    error Deployment__ArrayLengthMismatch();
    error Deployment__Create2DeployerHasNoCode(address deployer);
    error Deployment__DuplicateTarget(address token);
    error Deployment__HookAddressMismatch(address expected, address actual);
    error Deployment__IneligibleGBXContractHolder(string role, address holder);
    error Deployment__EligibilityCheckFailed(address module, address holder);
    error Deployment__InvalidConfig();
    error Deployment__NoopEligibilityForbiddenOnMainnet();
    error Deployment__FoundryBroadcastAuthorizationUnavailable();
    error Deployment__TooManyTargets(uint256 count);
    error Deployment__ZeroAddress();

    /// @dev Authorization schema v1 deliberately supports only the atomically snapshotted Hardhat runner.
    ///      Foundry scripts remain useful for local simulation, but cannot broadcast to a nonlocal chain.
    function _requireFoundryLocalRehearsal() internal view {
        if (!_foundryLocalRehearsalAllowed(block.chainid, vm.envOr("DEPLOYMENT_EXECUTION_MODE", string("")))) {
            revert Deployment__FoundryBroadcastAuthorizationUnavailable();
        }
    }

    function _foundryLocalRehearsalAllowed(uint256 chainId, string memory mode) internal pure returns (bool) {
        return chainId == 31_337 && keccak256(bytes(mode)) == keccak256("rehearsal");
    }

    function _deployPhaseOne(Config memory config, address create2Deployer)
        internal
        returns (Deployment memory deployment)
    {
        _validateConfig(config, create2Deployer);
        _deployAccessAndSupply(config, deployment);
        _deployCustodyAndMining(config, deployment);
        _deployStrategies(config, deployment);
        _deployLiquidity(config, deployment, create2Deployer);
        _wireSetOnceDependencies(config, deployment);
        deployment.lens = new GumBallLens(
            address(deployment.gbx),
            address(deployment.gumBallVault),
            address(deployment.assetRegistry),
            address(deployment.allocationVoter),
            address(deployment.stakedGBX)
        );
    }

    function _deployAccessAndSupply(Config memory config, Deployment memory deployment) private {
        deployment.protocolTimelock =
            new ProtocolTimelock(config.protocolTimelockMultisig, config.dependencyInitializer);
        deployment.emergencyGuardian =
            new EmergencyGuardian(address(deployment.protocolTimelock), config.emergencyGuardianOperator);

        if (config.eligibilityMode == EligibilityMode.NoopTestOnly) {
            deployment.eligibilityModule = IEligibilityModule(address(new NoopEligibilityModule()));
        } else if (config.eligibilityMode == EligibilityMode.RegistryAdapter) {
            deployment.eligibilityModule =
                IEligibilityModule(address(new RegistryEligibilityModule(config.eligibilityRegistry)));
        } else {
            deployment.eligibilityModule = IEligibilityModule(config.predeployedEligibilityModule);
        }

        deployment.gbx = new GBXToken(config.dependencyInitializer, deployment.eligibilityModule);
        deployment.strategyDeployer = new StrategyDeployer(
            address(deployment.protocolTimelock),
            address(deployment.emergencyGuardian),
            address(deployment.gbx),
            config.dependencyInitializer,
            [
                keccak256(type(AcquisitionStrategy).creationCode),
                keccak256(type(ManagerRewards).creationCode),
                keccak256(type(BuybackBurnStrategy).creationCode),
                keccak256(type(HoldUSDGStrategy).creationCode),
                keccak256(abi.encode(config.targetTokens))
            ],
            [
                type(AcquisitionStrategy).creationCode.length,
                type(ManagerRewards).creationCode.length,
                type(BuybackBurnStrategy).creationCode.length,
                type(HoldUSDGStrategy).creationCode.length,
                config.targetTokens.length
            ]
        );
        deployment.emissionController = new EmissionController(deployment.gbx, config.dependencyInitializer);
        deployment.genesisClaims = new GenesisClaims(deployment.gbx, config.dependencyInitializer);
        deployment.miningClaims = new MiningClaims(deployment.gbx, config.dependencyInitializer);
    }

    function _deployCustodyAndMining(Config memory config, Deployment memory deployment) private {
        deployment.assetRegistry = new AssetRegistry(
            config.usdG,
            address(deployment.protocolTimelock),
            address(deployment.emergencyGuardian),
            address(deployment.strategyDeployer)
        );
        deployment.allocationVoter = new AllocationVoter(
            config.usdG,
            address(deployment.assetRegistry),
            address(deployment.protocolTimelock),
            address(deployment.emergencyGuardian),
            config.dependencyInitializer
        );
        deployment.gumBallVault = new GumBallVault(
            config.usdG,
            address(deployment.gbx),
            address(deployment.assetRegistry),
            address(deployment.allocationVoter),
            address(deployment.eligibilityModule)
        );
        deployment.stakedGBX = new StakedGBX(address(deployment.gbx), address(deployment.allocationVoter));
        deployment.gumBallRouter =
            new GumBallRouter(address(deployment.gbx), address(deployment.stakedGBX), address(deployment.gumBallVault));
        deployment.miningPool = new MiningPool(
            MiningPool.Dependencies({
                usdG: config.usdG,
                gumBallVault: address(deployment.gumBallVault),
                allocationVoter: address(deployment.allocationVoter),
                emissionController: address(deployment.emissionController),
                miningClaims: address(deployment.miningClaims),
                emergencyGuardian: address(deployment.emergencyGuardian),
                protocolTimelock: address(deployment.protocolTimelock),
                dependencyInitializer: config.dependencyInitializer
            })
        );
        deployment.genesisBootstrap = new GenesisBootstrap(
            GenesisBootstrap.Dependencies({
                usdG: config.usdG,
                gumBallVault: address(deployment.gumBallVault),
                allocationVoter: address(deployment.allocationVoter),
                emissionController: address(deployment.emissionController),
                genesisClaims: address(deployment.genesisClaims),
                miningPool: address(deployment.miningPool),
                genesisLiquidityBacker: config.genesisLiquidityBacker,
                dependencyInitializer: config.dependencyInitializer
            }),
            config.minimumBootstrapUSDG,
            config.bootstrapContributionCap
        );
    }

    function _deployStrategies(Config memory config, Deployment memory deployment) private {
        deployment.revenueRouter =
            new RevenueRouter(config.usdG, address(deployment.gumBallVault), address(deployment.allocationVoter));
    }

    function _deployLiquidity(Config memory config, Deployment memory deployment, address create2Deployer) private {
        bytes memory constructorArguments = abi.encode(
            IPoolManager(config.poolManager),
            config.dependencyInitializer,
            address(deployment.gbx),
            config.usdG,
            config.poolFee,
            config.tickSpacing
        );
        address expectedHook;
        (expectedHook, deployment.hookSalt) = HookMiner.find(
            create2Deployer,
            uint160(Hooks.BEFORE_INITIALIZE_FLAG),
            type(LaunchGuardHook).creationCode,
            constructorArguments
        );
        deployment.launchGuardHook = new LaunchGuardHook{ salt: deployment.hookSalt }(
            IPoolManager(config.poolManager),
            config.dependencyInitializer,
            address(deployment.gbx),
            config.usdG,
            config.poolFee,
            config.tickSpacing
        );
        if (address(deployment.launchGuardHook) != expectedHook) {
            revert Deployment__HookAddressMismatch(expectedHook, address(deployment.launchGuardHook));
        }

        deployment.genesisLiquidityCalculator = new GenesisLiquidityCalculator();
        deployment.liquidityManager = new LiquidityManager(
            LiquidityManager.Dependencies({
                gbx: address(deployment.gbx),
                usdG: config.usdG,
                gumBallVault: address(deployment.gumBallVault),
                allocationVoter: address(deployment.allocationVoter),
                poolManager: config.poolManager,
                positionManager: config.positionManager,
                permit2: config.permit2,
                launchGuardHook: address(deployment.launchGuardHook),
                genesisBootstrap: address(deployment.genesisBootstrap),
                genesisLiquidityCalculator: address(deployment.genesisLiquidityCalculator),
                protocolTimelock: address(deployment.protocolTimelock),
                emergencyGuardian: address(deployment.emergencyGuardian)
            }),
            LiquidityManager.LadderConfig({
                poolFee: config.poolFee,
                tickSpacing: config.tickSpacing,
                allocationBps: config.allocationBps,
                cumulativeTickDeltas: config.cumulativeTickDeltas
            })
        );
    }

    function _wireSetOnceDependencies(Config memory config, Deployment memory deployment) private {
        deployment.launchGuardHook.initializeLiquidityManager(address(deployment.liquidityManager));
        deployment.genesisBootstrap.initializeLiquidityManager(address(deployment.liquidityManager));
        deployment.genesisClaims.initializeSource(address(deployment.genesisBootstrap));
        deployment.miningClaims.initializeSource(address(deployment.miningPool));
        deployment.miningPool.initializeGenesisBootstrap(address(deployment.genesisBootstrap));
        deployment.emissionController
            .initializeCallers(address(deployment.genesisBootstrap), address(deployment.miningPool));
        deployment.gbx.initializeEmissionController(address(deployment.emissionController));

        address[4] memory revenueSources = [
            address(deployment.genesisBootstrap),
            address(deployment.miningPool),
            address(deployment.revenueRouter),
            address(deployment.liquidityManager)
        ];
        deployment.allocationVoter
            .initializeDependencies(address(deployment.gumBallVault), address(deployment.stakedGBX), revenueSources);
        deployment.strategyDeployer
            .initializeDependencies(
                address(deployment.assetRegistry),
                address(deployment.allocationVoter),
                address(deployment.gumBallVault),
                address(deployment.eligibilityModule)
            );
        deployment.protocolTimelock
            .initializeTargets(
                address(deployment.assetRegistry),
                address(deployment.emergencyGuardian),
                address(deployment.allocationVoter),
                address(deployment.miningPool),
                address(deployment.liquidityManager),
                address(deployment.strategyDeployer)
            );
        deployment.protocolTimelock.finalizePermissionedPoolController(address(0));

        deployment.holdUSDGStrategy =
            HoldUSDGStrategy(deployment.protocolTimelock.bootstrapDeployHoldUSDG(type(HoldUSDGStrategy).creationCode));
        uint256 targetCount = config.targetTokens.length;
        deployment.acquisitionStrategies = new AcquisitionStrategy[](targetCount);
        deployment.managerRewards = new ManagerRewards[](targetCount);
        for (uint256 index; index < targetCount; ++index) {
            (address strategy, address rewards) = deployment.protocolTimelock
                .bootstrapDeployAcquisition(
                    type(AcquisitionStrategy).creationCode,
                    type(ManagerRewards).creationCode,
                    config.targetTokens[index],
                    config.minimumLotUSDG,
                    config.maximumLotUSDG,
                    config.targetInitialReferenceRates[index]
                );
            deployment.acquisitionStrategies[index] = AcquisitionStrategy(strategy);
            deployment.managerRewards[index] = ManagerRewards(rewards);
        }
        deployment.buybackBurnStrategy = BuybackBurnStrategy(
            deployment.protocolTimelock
                .bootstrapDeployBuyback(
                    type(BuybackBurnStrategy).creationCode,
                    config.minimumLotUSDG,
                    config.maximumLotUSDG,
                    config.buybackInitialReferenceRate
                )
        );
        deployment.protocolTimelock.finalizeStrategyBootstrap(config.targetTokens);
    }

    function _validateConfig(Config memory config, address create2Deployer) private view {
        if (
            config.usdG == address(0) || config.poolManager == address(0) || config.positionManager == address(0)
                || config.permit2 == address(0) || config.protocolTimelockMultisig == address(0)
                || config.emergencyGuardianOperator == address(0) || config.genesisLiquidityBacker == address(0)
                || config.dependencyInitializer == address(0)
        ) revert Deployment__ZeroAddress();
        _requireCode(config.usdG);
        _requireCode(config.poolManager);
        _requireCode(config.positionManager);
        _requireCode(config.permit2);
        if (create2Deployer.code.length == 0) revert Deployment__Create2DeployerHasNoCode(create2Deployer);
        if (config.usdGDecimals > 18 || IERC20Metadata(config.usdG).decimals() != config.usdGDecimals) {
            revert Deployment__InvalidConfig();
        }

        if (config.eligibilityMode == EligibilityMode.NoopTestOnly) {
            if (block.chainid == 4_663) revert Deployment__NoopEligibilityForbiddenOnMainnet();
        } else if (config.eligibilityMode == EligibilityMode.RegistryAdapter) {
            _requireCode(config.eligibilityRegistry);
        } else if (config.eligibilityMode == EligibilityMode.PredeployedModule) {
            _requireCode(config.predeployedEligibilityModule);
        } else {
            revert Deployment__InvalidConfig();
        }

        uint256 targetCount = config.targetTokens.length;
        if (targetCount > MAX_TARGET_ASSETS) revert Deployment__TooManyTargets(targetCount);
        if (
            targetCount != config.targetAssetIds.length || targetCount != config.targetSymbolHashes.length
                || targetCount != config.targetDecimals.length || targetCount != config.targetIsStockToken.length
                || targetCount != config.targetRuntimeCodeHashes.length
                || targetCount != config.targetUiMultipliers.length
                || targetCount != config.targetInitialReferenceRates.length
        ) revert Deployment__ArrayLengthMismatch();
        for (uint256 index; index < targetCount; ++index) {
            address token = config.targetTokens[index];
            _requireCode(token);
            if (
                token == config.usdG || config.targetAssetIds[index] == bytes32(0)
                    || config.targetSymbolHashes[index] == bytes32(0) || config.targetInitialReferenceRates[index] == 0
                    || config.targetDecimals[index] > 18
                    || IERC20Metadata(token).decimals() != config.targetDecimals[index]
                    || token.codehash != config.targetRuntimeCodeHashes[index]
            ) {
                revert Deployment__InvalidConfig();
            }
            if (config.targetIsStockToken[index]) {
                if (
                    config.targetUiMultipliers[index] == 0 || config.stockTokenBeacon == address(0)
                        || config.stockTokenImplementation == address(0)
                        || config.stockTokenBeacon.codehash != config.stockTokenBeaconRuntimeCodeHash
                        || config.stockTokenImplementation.codehash != config.stockTokenImplementationRuntimeCodeHash
                ) revert Deployment__InvalidConfig();
            } else if (config.targetUiMultipliers[index] != 0) {
                revert Deployment__InvalidConfig();
            }
            for (uint256 prior; prior < index; ++prior) {
                if (config.targetTokens[prior] == token) revert Deployment__DuplicateTarget(token);
            }
        }

        if (
            config.minimumBootstrapUSDG == 0 || config.bootstrapContributionCap < config.minimumBootstrapUSDG
                || config.minimumLotUSDG == 0 || config.maximumLotUSDG < config.minimumLotUSDG
                || config.buybackInitialReferenceRate == 0 || config.poolFee == 0 || config.poolFee > 1_000_000
                || config.tickSpacing <= 0 || config.tickSpacing > type(int16).max
        ) revert Deployment__InvalidConfig();

        uint256 totalAllocationBps;
        int24 previousDelta;
        for (uint256 index; index < 4; ++index) {
            uint16 allocation = config.allocationBps[index];
            int24 delta = config.cumulativeTickDeltas[index];
            if (allocation == 0 || delta <= previousDelta || delta > 887_272 || delta % config.tickSpacing != 0) {
                revert Deployment__InvalidConfig();
            }
            totalAllocationBps += allocation;
            previousDelta = delta;
        }
        if (totalAllocationBps != 10_000) revert Deployment__InvalidConfig();
    }

    function _requireCode(address account) private view {
        if (account == address(0) || account.code.length == 0) revert Deployment__AddressHasNoCode(account);
    }

    function _addresses(Deployment memory deployment) internal view returns (DeploymentAddresses memory addresses_) {
        addresses_.protocolTimelock = address(deployment.protocolTimelock);
        addresses_.emergencyGuardian = address(deployment.emergencyGuardian);
        addresses_.eligibilityModule = address(deployment.eligibilityModule);
        addresses_.gbx = address(deployment.gbx);
        addresses_.strategyDeployer = address(deployment.strategyDeployer);
        addresses_.emissionController = address(deployment.emissionController);
        addresses_.genesisClaims = address(deployment.genesisClaims);
        addresses_.miningClaims = address(deployment.miningClaims);
        addresses_.assetRegistry = address(deployment.assetRegistry);
        addresses_.allocationVoter = address(deployment.allocationVoter);
        addresses_.gumBallVault = address(deployment.gumBallVault);
        addresses_.stakedGBX = address(deployment.stakedGBX);
        addresses_.gumBallRouter = address(deployment.gumBallRouter);
        addresses_.miningPool = address(deployment.miningPool);
        addresses_.genesisBootstrap = address(deployment.genesisBootstrap);
        addresses_.revenueRouter = address(deployment.revenueRouter);
        addresses_.holdUSDGStrategy = address(deployment.holdUSDGStrategy);
        addresses_.buybackBurnStrategy = address(deployment.buybackBurnStrategy);
        addresses_.launchGuardHook = address(deployment.launchGuardHook);
        addresses_.genesisLiquidityCalculator = address(deployment.genesisLiquidityCalculator);
        addresses_.liquidityManager = address(deployment.liquidityManager);
        addresses_.lens = address(deployment.lens);
        addresses_.hookSalt = deployment.hookSalt;

        uint256 targetCount = deployment.acquisitionStrategies.length;
        addresses_.acquisitionStrategies = new address[](targetCount);
        addresses_.managerRewards = new address[](targetCount);
        for (uint256 index; index < targetCount; ++index) {
            addresses_.acquisitionStrategies[index] = address(deployment.acquisitionStrategies[index]);
            addresses_.managerRewards[index] = address(deployment.managerRewards[index]);
        }
        _populateGBXContractHolders(addresses_, address(deployment.liquidityManager.POOL_MANAGER()));
    }

    function _assertConfigMatches(Config memory config, DeploymentAddresses memory deployment) internal pure {
        if (
            config.configHash != deployment.configHash
                || config.targetTokens.length != deployment.acquisitionStrategies.length
                || config.targetTokens.length != deployment.managerRewards.length
        ) revert Deployment__InvalidConfig();
        _assertGBXContractHolderManifest(config, deployment);
    }

    /// @notice Fails before bootstrap funding unless every protocol GBX custodian can receive GBX.
    /// @dev This is intentionally evaluated after deployment so a production registry can review exact addresses.
    function _assertGBXContractHoldersEligible(DeploymentAddresses memory deployment) internal view {
        IEligibilityModule module = IEligibilityModule(deployment.eligibilityModule);
        for (uint256 index; index < deployment.gbxContractHolders.length; ++index) {
            address holder = deployment.gbxContractHolders[index];
            try module.canHold(holder) returns (bool allowed) {
                if (!allowed) {
                    revert Deployment__IneligibleGBXContractHolder(deployment.gbxContractHolderRoles[index], holder);
                }
            } catch {
                revert Deployment__EligibilityCheckFailed(address(module), holder);
            }
        }
    }

    function _assetConfigForUSDG(Config memory config, DeploymentAddresses memory deployment)
        internal
        pure
        returns (IAssetRegistry.AssetConfig memory)
    {
        return IAssetRegistry.AssetConfig({
            token: config.usdG,
            assetId: keccak256("USDG"),
            symbolHash: keccak256("USDG"),
            decimals: config.usdGDecimals,
            strategy: deployment.holdUSDGStrategy,
            rewards: address(0),
            isStockToken: false,
            acquisitionEnabled: true,
            redemptionEnabled: true
        });
    }

    function _assetConfigForTarget(Config memory config, DeploymentAddresses memory deployment, uint256 index)
        internal
        pure
        returns (IAssetRegistry.AssetConfig memory)
    {
        return IAssetRegistry.AssetConfig({
            token: config.targetTokens[index],
            assetId: config.targetAssetIds[index],
            symbolHash: config.targetSymbolHashes[index],
            decimals: config.targetDecimals[index],
            strategy: deployment.acquisitionStrategies[index],
            rewards: deployment.managerRewards[index],
            isStockToken: config.targetIsStockToken[index],
            acquisitionEnabled: true,
            redemptionEnabled: true
        });
    }

    function _registrationDataForTarget(Config memory config, DeploymentAddresses memory deployment, uint256 index)
        internal
        pure
        returns (bytes memory)
    {
        IAssetRegistry.AssetConfig memory assetConfig = _assetConfigForTarget(config, deployment, index);
        if (!config.targetIsStockToken[index]) return abi.encodeCall(AssetRegistry.registerAsset, (assetConfig));
        IAssetRegistry.StockTokenDependency memory dependency = IAssetRegistry.StockTokenDependency({
            tokenRuntimeCodeHash: config.targetRuntimeCodeHashes[index],
            beacon: config.stockTokenBeacon,
            beaconRuntimeCodeHash: config.stockTokenBeaconRuntimeCodeHash,
            implementation: config.stockTokenImplementation,
            implementationRuntimeCodeHash: config.stockTokenImplementationRuntimeCodeHash,
            uiMultiplier: config.targetUiMultipliers[index]
        });
        return abi.encodeCall(AssetRegistry.registerStockAsset, (assetConfig, dependency));
    }

    function _operationSalt(string memory label, address target, bytes memory data) internal view returns (bytes32) {
        return keccak256(abi.encode("GUM_BALL_6900", block.chainid, label, target, keccak256(data)));
    }

    function _readConfig(string memory path, address dependencyInitializer)
        internal
        view
        returns (Config memory config)
    {
        string memory json = vm.readFile(path);
        bytes32 expectedNetworkName;
        if (block.chainid == 4_663) {
            expectedNetworkName = keccak256("Robinhood Chain");
        } else if (block.chainid == 46_630) {
            expectedNetworkName = keccak256("Robinhood Chain Testnet");
        } else if (block.chainid == 31_337) {
            expectedNetworkName = keccak256("Hardhat Local Rehearsal");
        } else {
            revert Deployment__InvalidConfig();
        }
        if (
            keccak256(bytes(vm.parseJsonString(json, ".kind"))) != keccak256("gumball-6900-deployment-config")
                || keccak256(bytes(vm.parseJsonString(json, ".protocol"))) != keccak256("GUM BALL 6900")
                || vm.parseJsonUint(json, ".schemaVersion") != 1
                || vm.parseJsonUint(json, ".network.chainId") != block.chainid
                || keccak256(bytes(vm.parseJsonString(json, ".network.name"))) != expectedNetworkName
        ) revert Deployment__InvalidConfig();
        config.configHash = keccak256(bytes(json));
        config.usdG = vm.parseJsonAddress(json, ".usdG");
        config.poolManager = vm.parseJsonAddress(json, ".uniswapV4.poolManager");
        config.positionManager = vm.parseJsonAddress(json, ".uniswapV4.positionManager");
        config.permit2 = vm.parseJsonAddress(json, ".uniswapV4.permit2");
        config.protocolTimelockMultisig = vm.parseJsonAddress(json, ".roles.protocolTimelockMultisig");
        config.emergencyGuardianOperator = vm.parseJsonAddress(json, ".roles.emergencyGuardianOperator");
        config.genesisLiquidityBacker = vm.parseJsonAddress(json, ".roles.genesisLiquidityBacker");
        config.dependencyInitializer = dependencyInitializer;
        config.usdGDecimals = _toUint8(vm.parseJsonUint(json, ".usdGDecimals"));
        config.eligibilityMode = EligibilityMode(vm.parseJsonUint(json, ".eligibility.mode"));
        config.eligibilityRegistry = vm.parseJsonAddress(json, ".eligibility.registry");
        config.predeployedEligibilityModule = vm.parseJsonAddress(json, ".eligibility.module");
        config.minimumBootstrapUSDG = _jsonUintString(json, ".genesis.minimumBootstrapUSDG");
        config.bootstrapContributionCap = _jsonUintString(json, ".genesis.bootstrapContributionCap");
        config.minimumLotUSDG = _jsonUintString(json, ".strategies.minimumLotUSDG");
        config.maximumLotUSDG = _jsonUintString(json, ".strategies.maximumLotUSDG");
        config.buybackInitialReferenceRate = _jsonUintString(json, ".strategies.buybackInitialReferenceRate");
        config.poolFee = _toUint24(vm.parseJsonUint(json, ".liquidity.poolFee"));
        config.tickSpacing = _toInt24(vm.parseJsonInt(json, ".liquidity.tickSpacing"));
        config.allocationBps = _uint16x4(vm.parseJsonUintArray(json, ".liquidity.allocationBps"));
        config.cumulativeTickDeltas = _int24x4(vm.parseJsonIntArray(json, ".liquidity.cumulativeTickDeltas"));
        config.targetTokens = vm.parseJsonAddressArray(json, ".assets.tokens");
        config.targetAssetIds = vm.parseJsonBytes32Array(json, ".assets.assetIds");
        config.targetSymbolHashes = vm.parseJsonBytes32Array(json, ".assets.symbolHashes");
        config.targetDecimals = _uint8Array(vm.parseJsonUintArray(json, ".assets.decimals"));
        config.targetIsStockToken = vm.parseJsonBoolArray(json, ".assets.isStockToken");
        config.targetRuntimeCodeHashes = vm.parseJsonBytes32Array(json, ".assets.runtimeBytecodeHashes");
        config.targetUiMultipliers = new uint256[](config.targetTokens.length);
        bool hasStockToken;
        for (uint256 index; index < config.targetTokens.length; ++index) {
            if (!config.targetIsStockToken[index]) continue;
            hasStockToken = true;
            string memory path_ = string.concat(".assets.uiMultipliers[", vm.toString(index), "]");
            config.targetUiMultipliers[index] = vm.parseUint(vm.parseJsonString(json, path_));
        }
        if (hasStockToken) {
            config.stockTokenBeacon = vm.parseJsonAddress(json, ".stockTokenDependency.beaconAddress");
            config.stockTokenBeaconRuntimeCodeHash =
                vm.parseJsonBytes32(json, ".stockTokenDependency.beaconRuntimeBytecodeHash");
            config.stockTokenImplementation = vm.parseJsonAddress(json, ".stockTokenDependency.implementationAddress");
            config.stockTokenImplementationRuntimeCodeHash =
                vm.parseJsonBytes32(json, ".stockTokenDependency.implementationRuntimeBytecodeHash");
        }
        config.targetInitialReferenceRates =
            _uintStringArray(vm.parseJsonStringArray(json, ".assets.initialReferenceRates"));
    }

    function _uint16x4(uint256[] memory values) private pure returns (uint16[4] memory result) {
        if (values.length != 4) revert Deployment__ArrayLengthMismatch();
        for (uint256 index; index < 4; ++index) {
            if (values[index] > type(uint16).max) revert Deployment__InvalidConfig();
            result[index] = uint16(values[index]);
        }
    }

    function _int24x4(int256[] memory values) private pure returns (int24[4] memory result) {
        if (values.length != 4) revert Deployment__ArrayLengthMismatch();
        for (uint256 index; index < 4; ++index) {
            if (values[index] < type(int24).min || values[index] > type(int24).max) {
                revert Deployment__InvalidConfig();
            }
            result[index] = int24(values[index]);
        }
    }

    function _uint8Array(uint256[] memory values) private pure returns (uint8[] memory result) {
        result = new uint8[](values.length);
        for (uint256 index; index < values.length; ++index) {
            result[index] = _toUint8(values[index]);
        }
    }

    function _toUint8(uint256 value) private pure returns (uint8) {
        if (value > type(uint8).max) revert Deployment__InvalidConfig();
        return uint8(value);
    }

    function _toUint24(uint256 value) private pure returns (uint24) {
        if (value > type(uint24).max) revert Deployment__InvalidConfig();
        return uint24(value);
    }

    function _toInt24(int256 value) private pure returns (int24) {
        if (value < type(int24).min || value > type(int24).max) revert Deployment__InvalidConfig();
        return int24(value);
    }

    function _jsonUintString(string memory json, string memory key) private pure returns (uint256) {
        return vm.parseUint(vm.parseJsonString(json, key));
    }

    function _uintStringArray(string[] memory values) private pure returns (uint256[] memory result) {
        result = new uint256[](values.length);
        for (uint256 index; index < values.length; ++index) {
            result[index] = vm.parseUint(values[index]);
        }
    }

    function _readDeploymentAddresses(string memory path)
        internal
        view
        returns (DeploymentAddresses memory deployment)
    {
        string memory json = vm.readFile(path);
        deployment.chainId = vm.parseJsonUint(json, ".chainId");
        deployment.configHash = vm.parseJsonBytes32(json, ".configHash");
        deployment.dependencyInitializer = vm.parseJsonAddress(json, ".dependencyInitializer");
        if (deployment.chainId != block.chainid) revert Deployment__InvalidConfig();
        deployment.protocolTimelock = vm.parseJsonAddress(json, ".protocolTimelock");
        deployment.emergencyGuardian = vm.parseJsonAddress(json, ".emergencyGuardian");
        deployment.eligibilityModule = vm.parseJsonAddress(json, ".eligibilityModule");
        deployment.gbx = vm.parseJsonAddress(json, ".gbx");
        deployment.strategyDeployer = vm.parseJsonAddress(json, ".strategyDeployer");
        deployment.emissionController = vm.parseJsonAddress(json, ".emissionController");
        deployment.genesisClaims = vm.parseJsonAddress(json, ".genesisClaims");
        deployment.miningClaims = vm.parseJsonAddress(json, ".miningClaims");
        deployment.assetRegistry = vm.parseJsonAddress(json, ".assetRegistry");
        deployment.allocationVoter = vm.parseJsonAddress(json, ".allocationVoter");
        deployment.gumBallVault = vm.parseJsonAddress(json, ".gumBallVault");
        deployment.stakedGBX = vm.parseJsonAddress(json, ".stakedGBX");
        deployment.gumBallRouter = vm.parseJsonAddress(json, ".gumBallRouter");
        deployment.miningPool = vm.parseJsonAddress(json, ".miningPool");
        deployment.genesisBootstrap = vm.parseJsonAddress(json, ".genesisBootstrap");
        deployment.revenueRouter = vm.parseJsonAddress(json, ".revenueRouter");
        deployment.holdUSDGStrategy = vm.parseJsonAddress(json, ".holdUSDGStrategy");
        deployment.buybackBurnStrategy = vm.parseJsonAddress(json, ".buybackBurnStrategy");
        deployment.launchGuardHook = vm.parseJsonAddress(json, ".launchGuardHook");
        deployment.genesisLiquidityCalculator = vm.parseJsonAddress(json, ".genesisLiquidityCalculator");
        deployment.liquidityManager = vm.parseJsonAddress(json, ".liquidityManager");
        deployment.lens = vm.parseJsonAddress(json, ".lens");
        deployment.acquisitionStrategies = vm.parseJsonAddressArray(json, ".acquisitionStrategies");
        deployment.managerRewards = vm.parseJsonAddressArray(json, ".managerRewards");
        deployment.gbxContractHolderRoles = vm.parseJsonStringArray(json, ".gbxContractHolderRoles");
        deployment.gbxContractHolders = vm.parseJsonAddressArray(json, ".gbxContractHolders");
        deployment.gbxContractHolderRationales = vm.parseJsonStringArray(json, ".gbxContractHolderRationales");
        deployment.hookSalt = vm.parseJsonBytes32(json, ".hookSalt");
        _validateDeploymentAddresses(deployment);
    }

    function _validateDeploymentAddresses(DeploymentAddresses memory deployment) private view {
        if (deployment.dependencyInitializer == address(0)) revert Deployment__ZeroAddress();
        _requireCode(deployment.protocolTimelock);
        _requireCode(deployment.emergencyGuardian);
        _requireCode(deployment.eligibilityModule);
        _requireCode(deployment.gbx);
        _requireCode(deployment.strategyDeployer);
        _requireCode(deployment.emissionController);
        _requireCode(deployment.genesisClaims);
        _requireCode(deployment.miningClaims);
        _requireCode(deployment.assetRegistry);
        _requireCode(deployment.allocationVoter);
        _requireCode(deployment.gumBallVault);
        _requireCode(deployment.stakedGBX);
        _requireCode(deployment.gumBallRouter);
        _requireCode(deployment.miningPool);
        _requireCode(deployment.genesisBootstrap);
        _requireCode(deployment.revenueRouter);
        _requireCode(deployment.holdUSDGStrategy);
        _requireCode(deployment.buybackBurnStrategy);
        _requireCode(deployment.launchGuardHook);
        _requireCode(deployment.genesisLiquidityCalculator);
        _requireCode(deployment.liquidityManager);
        _requireCode(deployment.lens);
        if (deployment.acquisitionStrategies.length != deployment.managerRewards.length) {
            revert Deployment__ArrayLengthMismatch();
        }
        for (uint256 index; index < deployment.acquisitionStrategies.length; ++index) {
            _requireCode(deployment.acquisitionStrategies[index]);
            _requireCode(deployment.managerRewards[index]);
        }
        if (
            deployment.gbxContractHolderRoles.length != 7 || deployment.gbxContractHolders.length != 7
                || deployment.gbxContractHolderRationales.length != 7
        ) revert Deployment__ArrayLengthMismatch();
        for (uint256 index; index < deployment.gbxContractHolders.length; ++index) {
            _requireCode(deployment.gbxContractHolders[index]);
            for (uint256 prior; prior < index; ++prior) {
                if (deployment.gbxContractHolders[prior] == deployment.gbxContractHolders[index]) {
                    revert Deployment__DuplicateTarget(deployment.gbxContractHolders[index]);
                }
            }
        }
    }

    function _writeDeploymentAddresses(DeploymentAddresses memory deployment, string memory path) internal {
        string memory objectKey = "phaseOne";
        vm.serializeUint(objectKey, "chainId", block.chainid);
        vm.serializeBytes32(objectKey, "configHash", deployment.configHash);
        vm.serializeAddress(objectKey, "dependencyInitializer", deployment.dependencyInitializer);
        vm.serializeString(objectKey, "phase", "DEPLOYED_AND_WIRED");
        vm.serializeAddress(objectKey, "protocolTimelock", deployment.protocolTimelock);
        vm.serializeAddress(objectKey, "emergencyGuardian", deployment.emergencyGuardian);
        vm.serializeAddress(objectKey, "eligibilityModule", deployment.eligibilityModule);
        vm.serializeAddress(objectKey, "gbx", deployment.gbx);
        vm.serializeAddress(objectKey, "strategyDeployer", deployment.strategyDeployer);
        vm.serializeAddress(objectKey, "emissionController", deployment.emissionController);
        vm.serializeAddress(objectKey, "genesisClaims", deployment.genesisClaims);
        vm.serializeAddress(objectKey, "miningClaims", deployment.miningClaims);
        vm.serializeAddress(objectKey, "assetRegistry", deployment.assetRegistry);
        vm.serializeAddress(objectKey, "allocationVoter", deployment.allocationVoter);
        vm.serializeAddress(objectKey, "gumBallVault", deployment.gumBallVault);
        vm.serializeAddress(objectKey, "stakedGBX", deployment.stakedGBX);
        vm.serializeAddress(objectKey, "gumBallRouter", deployment.gumBallRouter);
        vm.serializeAddress(objectKey, "miningPool", deployment.miningPool);
        vm.serializeAddress(objectKey, "genesisBootstrap", deployment.genesisBootstrap);
        vm.serializeAddress(objectKey, "revenueRouter", deployment.revenueRouter);
        vm.serializeAddress(objectKey, "holdUSDGStrategy", deployment.holdUSDGStrategy);
        vm.serializeAddress(objectKey, "buybackBurnStrategy", deployment.buybackBurnStrategy);
        vm.serializeAddress(objectKey, "launchGuardHook", deployment.launchGuardHook);
        vm.serializeAddress(objectKey, "genesisLiquidityCalculator", deployment.genesisLiquidityCalculator);
        vm.serializeAddress(objectKey, "liquidityManager", deployment.liquidityManager);
        vm.serializeAddress(objectKey, "lens", deployment.lens);
        vm.serializeAddress(objectKey, "acquisitionStrategies", deployment.acquisitionStrategies);
        vm.serializeAddress(objectKey, "managerRewards", deployment.managerRewards);
        vm.serializeString(objectKey, "gbxContractHolderRoles", deployment.gbxContractHolderRoles);
        vm.serializeAddress(objectKey, "gbxContractHolders", deployment.gbxContractHolders);
        vm.serializeString(objectKey, "gbxContractHolderRationales", deployment.gbxContractHolderRationales);
        string memory json = vm.serializeBytes32(objectKey, "hookSalt", deployment.hookSalt);
        vm.writeJson(json, path);
    }

    function _populateGBXContractHolders(DeploymentAddresses memory deployment, address poolManager) private pure {
        deployment.gbxContractHolderRoles = new string[](7);
        deployment.gbxContractHolders = new address[](7);
        deployment.gbxContractHolderRationales = new string[](7);

        deployment.gbxContractHolderRoles[0] = "GenesisClaims";
        deployment.gbxContractHolders[0] = deployment.genesisClaims;
        deployment.gbxContractHolderRationales[0] = "Custodies the fixed genesis claim allocation until claims.";
        deployment.gbxContractHolderRoles[1] = "MiningClaims";
        deployment.gbxContractHolders[1] = deployment.miningClaims;
        deployment.gbxContractHolderRationales[1] = "Custodies recurring mining emissions until claims.";
        deployment.gbxContractHolderRoles[2] = "LiquidityManager";
        deployment.gbxContractHolders[2] = deployment.liquidityManager;
        deployment.gbxContractHolderRationales[2] =
        "Custodies the constrained genesis residual and transient GBX during canonical migrations.";
        deployment.gbxContractHolderRoles[3] = "StakedGBX";
        deployment.gbxContractHolders[3] = deployment.stakedGBX;
        deployment.gbxContractHolderRationales[3] = "Escrows staked GBX one-for-one while sGBX is outstanding.";
        deployment.gbxContractHolderRoles[4] = "BuybackBurnStrategy";
        deployment.gbxContractHolders[4] = deployment.buybackBurnStrategy;
        deployment.gbxContractHolderRationales[4] =
        "Temporarily receives GBX and burns it in the same buyback transaction.";
        deployment.gbxContractHolderRoles[5] = "GumBallRouter";
        deployment.gbxContractHolders[5] = deployment.gumBallRouter;
        deployment.gbxContractHolderRationales[5] =
        "Temporarily holds exact caller GBX during a typed stake or redemption.";
        deployment.gbxContractHolderRoles[6] = "UniswapV4PoolManager";
        deployment.gbxContractHolders[6] = poolManager;
        deployment.gbxContractHolderRationales[6] = "Custodies GBX settled into the canonical Uniswap v4 pool.";
    }

    function _assertGBXContractHolderManifest(Config memory config, DeploymentAddresses memory deployment)
        private
        pure
    {
        if (
            deployment.gbxContractHolderRoles.length != 7 || deployment.gbxContractHolders.length != 7
                || deployment.gbxContractHolderRationales.length != 7
        ) revert Deployment__ArrayLengthMismatch();
        address[7] memory expectedHolders = [
            deployment.genesisClaims,
            deployment.miningClaims,
            deployment.liquidityManager,
            deployment.stakedGBX,
            deployment.buybackBurnStrategy,
            deployment.gumBallRouter,
            config.poolManager
        ];
        string[7] memory expectedRoles = [
            "GenesisClaims",
            "MiningClaims",
            "LiquidityManager",
            "StakedGBX",
            "BuybackBurnStrategy",
            "GumBallRouter",
            "UniswapV4PoolManager"
        ];
        string[7] memory expectedRationales = [
            "Custodies the fixed genesis claim allocation until claims.",
            "Custodies recurring mining emissions until claims.",
            "Custodies the constrained genesis residual and transient GBX during canonical migrations.",
            "Escrows staked GBX one-for-one while sGBX is outstanding.",
            "Temporarily receives GBX and burns it in the same buyback transaction.",
            "Temporarily holds exact caller GBX during a typed stake or redemption.",
            "Custodies GBX settled into the canonical Uniswap v4 pool."
        ];
        for (uint256 index; index < expectedHolders.length; ++index) {
            if (
                deployment.gbxContractHolders[index] != expectedHolders[index]
                    || keccak256(bytes(deployment.gbxContractHolderRoles[index]))
                        != keccak256(bytes(expectedRoles[index]))
                    || keccak256(bytes(deployment.gbxContractHolderRationales[index]))
                        != keccak256(bytes(expectedRationales[index]))
            ) revert Deployment__InvalidConfig();
        }
    }
}
