// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IStrategyDeployer } from "../interfaces/IStrategyDeployer.sol";

interface IStockTokenIdentity is IERC20Metadata {
    /// @notice Returns the shared issuer access-control registry used by this proxy.
    function ACCESS_CONTROLLED_REGISTRY() external view returns (address);
    /// @notice Returns whether the shared issuer control plane pauses all token transfers.
    function paused() external view returns (bool);
    /// @notice Returns whether transfers for this individual token are paused.
    function tokenPaused() external view returns (bool);
    /// @notice Returns whether oracle-driven corporate-action updates for this token are paused.
    function oraclePaused() external view returns (bool);
    /// @notice Returns the stock-token UID recorded by the canonical issuer registry.
    function uid() external view returns (bytes32);
    /// @notice Returns the issuer-defined 18-decimal UI multiplier.
    function uiMultiplier() external view returns (uint256);
}

interface IStockTokenBeacon {
    /// @notice Returns the implementation currently selected by the shared stock-token beacon.
    function implementation() external view returns (address);
    /// @notice Returns whether the issuer has globally paused the stock-token system.
    function paused() external view returns (bool);
    /// @notice Returns whether the issuer blocks an account from stock-token transfers.
    function isBlocked(address account) external view returns (bool);
}

interface IAcquisitionRegistrationIdentity {
    /// @notice Returns the acquisition strategy's immutable target token.
    function TARGET_TOKEN() external view returns (address);
    /// @notice Returns the strategy-specific ManagerRewards accumulator.
    function managerRewards() external view returns (address);
    /// @notice Returns the USDG decimals cached by the strategy at deployment.
    function USDG_DECIMALS() external view returns (uint8);
    /// @notice Returns the target-token decimals cached by the strategy at deployment.
    function TARGET_DECIMALS() external view returns (uint8);
}

interface IManagerRewardsRegistrationIdentity {
    /// @notice Returns the immutable token distributed by ManagerRewards.
    function REWARD_TOKEN() external view returns (address);
    /// @notice Returns the immutable acquisition strategy authorized to notify rewards.
    function STRATEGY() external view returns (address);
}

interface IBuybackRegistrationIdentity {
    /// @notice Returns the USDG decimals cached by the buyback at deployment.
    function USDG_DECIMALS() external view returns (uint8);
    /// @notice Returns the GBX decimals cached by the buyback at deployment.
    function GBX_DECIMALS() external view returns (uint8);
}

/// @title AssetRegistry
/// @notice Bounded, timelocked registry of canonical basket assets and directly deployed strategies.
/// @dev Token holders cannot register assets. Canonical identity and behavior checks are performed by deployment tooling
///      before the timelock registers a token; this contract enforces the bounded onchain subset of those checks.
contract AssetRegistry is IAssetRegistry {
    /// @notice Maximum number of registered basket assets.
    uint256 public constant MAX_ASSETS = 16;
    /// @notice Maximum number of asset-linked plus standalone strategies.
    uint256 public constant MAX_STRATEGIES = 17;

    error AssetRegistry__AlreadyRegistered(address token);
    error AssetRegistry__AssetIdRequired();
    error AssetRegistry__AssetLimitReached();
    error AssetRegistry__BeaconIdentityMismatch(address beacon);
    error AssetRegistry__DependencyCodeHashMismatch(address dependency, bytes32 expected, bytes32 actual);
    error AssetRegistry__DecimalsMismatch(address token, uint8 expected, uint8 actual);
    error AssetRegistry__FirstAssetMustBeUSDG(address token);
    error AssetRegistry__NotGuardianOrTimelock(address caller);
    error AssetRegistry__NotProtocolTimelock(address caller);
    error AssetRegistry__InvalidStrategyGraph(address strategy);
    error AssetRegistry__InvalidStrategyProvenance(address strategy);
    error AssetRegistry__RewardsNotAllowed(address rewards);
    error AssetRegistry__RewardsRequired();
    error AssetRegistry__StandaloneStrategyNotCanonical(address strategy);
    error AssetRegistry__SymbolCallFailed(address token);
    error AssetRegistry__SymbolCharacterInvalid(address token, uint256 index, bytes1 character);
    error AssetRegistry__SymbolEncodingInvalid(address token);
    error AssetRegistry__SymbolHashMismatch(address token, bytes32 expected, bytes32 actual);
    error AssetRegistry__SymbolHashRequired();
    error AssetRegistry__SymbolLengthInvalid(address token, uint256 length);
    error AssetRegistry__StrategyAlreadyRegistered(address strategy);
    error AssetRegistry__StrategyDecimalsMismatch(
        address strategy, uint8 expectedUSDG, uint8 actualUSDG, uint8 expectedSubject, uint8 actualSubject
    );
    error AssetRegistry__StrategyHasNoCode(address strategy);
    error AssetRegistry__StrategyRequired();
    error AssetRegistry__StockIdentityMismatch(address token);
    error AssetRegistry__StockIdentityRequired(address token);
    error AssetRegistry__StockTokenPaused(address token);
    error AssetRegistry__StockTransferAccountBlocked(address token, address account);
    error AssetRegistry__TokenHasNoCode(address token);
    error AssetRegistry__UnknownAsset(address token);
    error AssetRegistry__VaultAlreadyConfigured(address vault);
    error AssetRegistry__VaultHasNoCode(address vault);
    error AssetRegistry__VaultHasTokenBalance(address token, uint256 balance);
    error AssetRegistry__VaultNotConfigured();
    error AssetRegistry__ZeroAddress();

    event AssetRegistry__AcquisitionStatusSet(address indexed token, address indexed strategy, bool enabled);
    event AssetRegistry__AssetRegistered(
        address indexed token,
        address indexed strategy,
        address indexed rewards,
        bytes32 assetId,
        bytes32 symbolHash,
        uint8 decimals,
        bool isStockToken,
        bool acquisitionEnabled,
        bool redemptionEnabled
    );
    event AssetRegistry__StockTokenDependencyValidated(
        address indexed token, address indexed beacon, address indexed implementation, uint256 uiMultiplier
    );
    event AssetRegistry__RedemptionStatusSet(address indexed token, bool enabled);
    event AssetRegistry__StandaloneStrategyRegistered(address indexed strategy);
    event AssetRegistry__VaultConfigured(address indexed vault);

    /// @notice Canonical USDG address that must occupy registry index zero.
    address public immutable USDG;
    /// @notice Purpose-limited delayed registration and maintenance authority.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Stop-only authority permitted to disable new acquisitions.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice Immutable provenance registry for exact canonical strategy deployments.
    IStrategyDeployer public immutable STRATEGY_DEPLOYER;

    /// @notice Canonical GumBallVault bound exactly once before asset registration.
    address public vault;

    address[] private _assets;
    address[] private _strategies;
    mapping(address token => AssetConfig config) private _configByToken;
    mapping(address token => StockTokenDependency dependency) private _stockTokenDependencyByToken;
    mapping(address token => bool registered) private _isRegistered;
    /// @notice Registered target token for each asset-linked strategy, or zero for a standalone strategy.
    mapping(address strategy => address token) public override tokenForStrategy;
    mapping(address strategy => bool registered) private _isRegisteredStrategy;
    mapping(address strategy => bool enabled) private _isStrategyEnabled;

    modifier onlyProtocolTimelock() {
        if (msg.sender != PROTOCOL_TIMELOCK) revert AssetRegistry__NotProtocolTimelock(msg.sender);
        _;
    }

    modifier onlyGuardianOrTimelock() {
        if (msg.sender != EMERGENCY_GUARDIAN && msg.sender != PROTOCOL_TIMELOCK) {
            revert AssetRegistry__NotGuardianOrTimelock(msg.sender);
        }
        _;
    }

    /// @notice Creates the registry with immutable maintenance authorities and canonical USDG.
    /// @param usdG_ The canonical USDG asset that must be registered first.
    /// @param protocolTimelock_ The purpose-limited delayed registration and maintenance authority.
    /// @param emergencyGuardian_ The stop-only authority permitted to disable acquisitions.
    /// @param strategyDeployer_ The immutable exact-bytecode strategy provenance registry.
    constructor(address usdG_, address protocolTimelock_, address emergencyGuardian_, address strategyDeployer_) {
        if (
            usdG_ == address(0) || protocolTimelock_ == address(0) || emergencyGuardian_ == address(0)
                || strategyDeployer_ == address(0)
        ) {
            revert AssetRegistry__ZeroAddress();
        }
        if (usdG_.code.length == 0) revert AssetRegistry__TokenHasNoCode(usdG_);
        if (strategyDeployer_.code.length == 0) revert AssetRegistry__StrategyHasNoCode(strategyDeployer_);

        USDG = usdG_;
        PROTOCOL_TIMELOCK = protocolTimelock_;
        EMERGENCY_GUARDIAN = emergencyGuardian_;
        STRATEGY_DEPLOYER = IStrategyDeployer(strategyDeployer_);
    }

    /// @notice Configures the vault exactly once to resolve constructor-order circularity.
    /// @dev Must be called by the timelock before the first asset registration.
    /// @param vault_ The deployed canonical GumBallVault contract.
    function configureVault(address vault_) external onlyProtocolTimelock {
        if (vault != address(0)) revert AssetRegistry__VaultAlreadyConfigured(vault);
        if (vault_ == address(0)) revert AssetRegistry__ZeroAddress();
        if (vault_.code.length == 0) revert AssetRegistry__VaultHasNoCode(vault_);
        if (
            !STRATEGY_DEPLOYER.dependenciesConfigured() || STRATEGY_DEPLOYER.ASSET_REGISTRY() != address(this)
                || STRATEGY_DEPLOYER.GUM_BALL_VAULT() != vault_ || STRATEGY_DEPLOYER.USDG() != USDG
        ) revert AssetRegistry__InvalidStrategyGraph(address(STRATEGY_DEPLOYER));

        vault = vault_;
        emit AssetRegistry__VaultConfigured(vault_);
    }

    /// @notice Registers a validated canonical token and its directly deployed strategy metadata.
    /// @dev The first registered token must be canonical USDG. Arrays are bounded by MAX_ASSETS.
    /// @param config The complete immutable identity and initial status record for the asset.
    function registerAsset(AssetConfig calldata config) external onlyProtocolTimelock {
        if (config.isStockToken) revert AssetRegistry__StockIdentityRequired(config.token);
        _registerAsset(config);
    }

    /// @notice Registers a stock token only while its exact reviewed beacon-proxy dependency graph is unchanged.
    /// @dev Every check executes atomically with registration, closing the seven-day timelock execution TOCTOU.
    function registerStockAsset(AssetConfig calldata config, StockTokenDependency calldata dependency)
        external
        onlyProtocolTimelock
    {
        if (!config.isStockToken) revert AssetRegistry__StockIdentityRequired(config.token);
        _assertCodeHash(config.token, dependency.tokenRuntimeCodeHash);
        _assertCodeHash(dependency.beacon, dependency.beaconRuntimeCodeHash);
        _assertCodeHash(dependency.implementation, dependency.implementationRuntimeCodeHash);
        IStockTokenBeacon beacon = IStockTokenBeacon(dependency.beacon);
        if (beacon.implementation() != dependency.implementation) {
            revert AssetRegistry__BeaconIdentityMismatch(dependency.beacon);
        }
        IStockTokenIdentity token = IStockTokenIdentity(config.token);
        if (
            token.ACCESS_CONTROLLED_REGISTRY() != dependency.beacon || token.uid() != config.assetId
                || token.uiMultiplier() != dependency.uiMultiplier
        ) revert AssetRegistry__StockIdentityMismatch(config.token);
        if (beacon.paused() || token.paused() || token.tokenPaused() || token.oraclePaused()) {
            revert AssetRegistry__StockTokenPaused(config.token);
        }
        for (uint256 index; index < 3; ++index) {
            address transferAccount = index == 0 ? vault : index == 1 ? config.strategy : config.rewards;
            if (beacon.isBlocked(transferAccount)) {
                revert AssetRegistry__StockTransferAccountBlocked(config.token, transferAccount);
            }
        }

        _stockTokenDependencyByToken[config.token] = dependency;
        _registerAsset(config);
        emit AssetRegistry__StockTokenDependencyValidated(
            config.token, dependency.beacon, dependency.implementation, dependency.uiMultiplier
        );
    }

    function _registerAsset(AssetConfig calldata config) private {
        if (vault == address(0)) revert AssetRegistry__VaultNotConfigured();
        if (config.token == address(0)) revert AssetRegistry__ZeroAddress();
        if (config.token.code.length == 0) revert AssetRegistry__TokenHasNoCode(config.token);
        if (_isRegistered[config.token]) revert AssetRegistry__AlreadyRegistered(config.token);
        if (_assets.length == MAX_ASSETS) revert AssetRegistry__AssetLimitReached();
        if (_assets.length == 0 && config.token != USDG) revert AssetRegistry__FirstAssetMustBeUSDG(config.token);
        if (config.assetId == bytes32(0)) revert AssetRegistry__AssetIdRequired();
        if (config.symbolHash == bytes32(0)) revert AssetRegistry__SymbolHashRequired();

        _validateSymbolIdentity(config.token, config.symbolHash);

        uint8 actualDecimals = IERC20Metadata(config.token).decimals();
        if (actualDecimals != config.decimals) {
            revert AssetRegistry__DecimalsMismatch(config.token, config.decimals, actualDecimals);
        }
        if (config.token != USDG && config.strategy == address(0)) revert AssetRegistry__StrategyRequired();
        if (config.strategy != address(0) && config.strategy.code.length == 0) {
            revert AssetRegistry__StrategyHasNoCode(config.strategy);
        }
        if (config.strategy != address(0) && tokenForStrategy[config.strategy] != address(0)) {
            revert AssetRegistry__StrategyAlreadyRegistered(config.strategy);
        }
        if (config.strategy != address(0) && _isRegisteredStrategy[config.strategy]) {
            revert AssetRegistry__StrategyAlreadyRegistered(config.strategy);
        }
        if (config.strategy != address(0) && _strategies.length == MAX_STRATEGIES) {
            revert AssetRegistry__AssetLimitReached();
        }
        _validateStrategyProvenance(config);

        _assets.push(config.token);
        _configByToken[config.token] = config;
        _isRegistered[config.token] = true;
        if (config.strategy != address(0)) {
            tokenForStrategy[config.strategy] = config.token;
            _isRegisteredStrategy[config.strategy] = true;
            _isStrategyEnabled[config.strategy] = config.acquisitionEnabled;
            _strategies.push(config.strategy);
        }

        emit AssetRegistry__AssetRegistered(
            config.token,
            config.strategy,
            config.rewards,
            config.assetId,
            config.symbolHash,
            config.decimals,
            config.isStockToken,
            config.acquisitionEnabled,
            config.redemptionEnabled
        );
    }

    function _assertCodeHash(address dependency, bytes32 expected) private view {
        bytes32 actual = dependency.codehash;
        if (dependency == address(0) || dependency.code.length == 0 || expected == bytes32(0) || actual != expected) {
            revert AssetRegistry__DependencyCodeHashMismatch(dependency, expected, actual);
        }
    }

    /// @dev Accepts only the canonical ABI encoding of a nonempty, printable ASCII symbol of at most 32 bytes. This
    ///      mirrors the live client's display boundary and prevents a valid registration from poisoning all reads.
    function _validateSymbolIdentity(address token, bytes32 expectedHash) private view {
        (bool success, bytes memory returnData) = token.staticcall(abi.encodeCall(IERC20Metadata.symbol, ()));
        if (!success) revert AssetRegistry__SymbolCallFailed(token);
        if (returnData.length < 64) revert AssetRegistry__SymbolEncodingInvalid(token);

        uint256 offset;
        uint256 symbolLength;
        assembly ("memory-safe") {
            offset := mload(add(returnData, 0x20))
            symbolLength := mload(add(returnData, 0x40))
        }
        if (offset != 32) revert AssetRegistry__SymbolEncodingInvalid(token);
        if (symbolLength == 0 || symbolLength > 32) {
            revert AssetRegistry__SymbolLengthInvalid(token, symbolLength);
        }
        if (returnData.length != 96) revert AssetRegistry__SymbolEncodingInvalid(token);

        for (uint256 index; index < symbolLength; ++index) {
            bytes1 character = returnData[64 + index];
            if (character < 0x21 || character > 0x7e) {
                revert AssetRegistry__SymbolCharacterInvalid(token, index, character);
            }
        }
        for (uint256 index = symbolLength; index < 32; ++index) {
            if (returnData[64 + index] != bytes1(0)) revert AssetRegistry__SymbolEncodingInvalid(token);
        }
        bytes32 actualHash;
        assembly ("memory-safe") {
            actualHash := keccak256(add(returnData, 0x60), symbolLength)
        }
        if (actualHash != expectedHash) {
            revert AssetRegistry__SymbolHashMismatch(token, expectedHash, actualHash);
        }
    }

    /// @dev A live strategy is valuable protocol authority: it can consume only its virtual voter budget, but it can
    ///      direct the corresponding USDG release. Admission therefore requires exact deployment provenance and the
    ///      complete immutable dependency graph, not merely code presence or getter-shaped behavior.
    function _validateStrategyProvenance(AssetConfig calldata config) private view {
        address strategy = config.strategy;
        if (config.token == USDG) {
            if (config.rewards != address(0)) revert AssetRegistry__RewardsNotAllowed(config.rewards);
            bytes32 expectedRuntimeCodeHash = STRATEGY_DEPLOYER.canonicalHoldUSDGRuntimeCodeHash();
            if (
                strategy == address(0) || strategy != STRATEGY_DEPLOYER.canonicalHoldUSDGStrategy()
                    || expectedRuntimeCodeHash == bytes32(0) || strategy.codehash != expectedRuntimeCodeHash
            ) revert AssetRegistry__InvalidStrategyProvenance(strategy);
            _requireCanonicalDeployerGraph(strategy);
            return;
        }

        if (strategy == address(0)) revert AssetRegistry__StrategyRequired();
        _requireCanonicalDeployerGraph(strategy);

        if (config.rewards == address(0)) revert AssetRegistry__RewardsRequired();
        IStrategyDeployer.AcquisitionPair memory pair = STRATEGY_DEPLOYER.acquisitionPair(strategy);
        if (
            STRATEGY_DEPLOYER.acquisitionStrategyForToken(config.token) != strategy || pair.targetToken != config.token
                || pair.managerRewards != config.rewards || pair.gumBallVault != vault
                || pair.allocationVoter != STRATEGY_DEPLOYER.ALLOCATION_VOTER() || pair.assetRegistry != address(this)
                || pair.protocolTimelock != PROTOCOL_TIMELOCK || pair.emergencyGuardian != EMERGENCY_GUARDIAN
                || pair.eligibilityModule != STRATEGY_DEPLOYER.ELIGIBILITY_MODULE()
        ) revert AssetRegistry__InvalidStrategyGraph(strategy);
        if (
            pair.strategyRuntimeCodeHash == bytes32(0) || pair.rewardsRuntimeCodeHash == bytes32(0)
                || strategy.codehash != pair.strategyRuntimeCodeHash || config.rewards.code.length == 0
                || config.rewards.codehash != pair.rewardsRuntimeCodeHash
        ) revert AssetRegistry__InvalidStrategyProvenance(strategy);

        IAcquisitionRegistrationIdentity acquisition = IAcquisitionRegistrationIdentity(strategy);
        IManagerRewardsRegistrationIdentity rewards = IManagerRewardsRegistrationIdentity(config.rewards);
        if (
            acquisition.TARGET_TOKEN() != config.token || acquisition.managerRewards() != config.rewards
                || rewards.REWARD_TOKEN() != config.token || rewards.STRATEGY() != strategy
        ) revert AssetRegistry__InvalidStrategyGraph(strategy);
        uint8 liveUSDGDecimals = IERC20Metadata(USDG).decimals();
        uint8 strategyUSDGDecimals = acquisition.USDG_DECIMALS();
        uint8 strategyTargetDecimals = acquisition.TARGET_DECIMALS();
        if (strategyUSDGDecimals != liveUSDGDecimals || strategyTargetDecimals != config.decimals) {
            revert AssetRegistry__StrategyDecimalsMismatch(
                strategy, liveUSDGDecimals, strategyUSDGDecimals, config.decimals, strategyTargetDecimals
            );
        }
    }

    function _requireCanonicalDeployerGraph(address strategy) private view {
        if (
            !STRATEGY_DEPLOYER.dependenciesConfigured() || STRATEGY_DEPLOYER.ASSET_REGISTRY() != address(this)
                || STRATEGY_DEPLOYER.GUM_BALL_VAULT() != vault
                || STRATEGY_DEPLOYER.PROTOCOL_TIMELOCK() != PROTOCOL_TIMELOCK
                || STRATEGY_DEPLOYER.EMERGENCY_GUARDIAN() != EMERGENCY_GUARDIAN
        ) revert AssetRegistry__InvalidStrategyGraph(strategy);
    }

    /// @notice Immediately disables new acquisition for a broken or halted asset.
    /// @dev Already-acquired balances stay registered and redeemable.
    /// @param token The registered asset whose acquisition strategy is disabled.
    function disableAcquisition(address token) external onlyGuardianOrTimelock {
        _requireRegistered(token);
        AssetConfig storage config = _configByToken[token];
        config.acquisitionEnabled = false;
        if (config.strategy != address(0)) _isStrategyEnabled[config.strategy] = false;
        emit AssetRegistry__AcquisitionStatusSet(token, config.strategy, false);
    }

    /// @notice Re-enables a directly deployed strategy after delayed protocol review.
    /// @param token The registered asset whose acquisition strategy is re-enabled.
    function enableAcquisition(address token) external onlyProtocolTimelock {
        _requireRegistered(token);
        AssetConfig storage config = _configByToken[token];
        if (config.strategy == address(0)) revert AssetRegistry__StrategyRequired();
        config.acquisitionEnabled = true;
        _isStrategyEnabled[config.strategy] = true;
        emit AssetRegistry__AcquisitionStatusSet(token, config.strategy, true);
    }

    /// @notice Updates redemption metadata only when the vault has no balance of the asset.
    /// @dev GumBallVault still includes every registered token in pro-rata redemptions, preventing donated backing from
    ///      becoming trapped. This flag is therefore an integration readiness marker rather than a pause mechanism.
    /// @param token The registered asset whose integration-readiness metadata is updated.
    /// @param enabled The new integration-readiness status; it cannot disable a nonzero vault balance.
    function setRedemptionEnabled(address token, bool enabled) external onlyProtocolTimelock {
        _requireRegistered(token);
        if (!enabled) {
            uint256 balance = IERC20(token).balanceOf(vault);
            if (balance != 0) revert AssetRegistry__VaultHasTokenBalance(token, balance);
        }
        _configByToken[token].redemptionEnabled = enabled;
        emit AssetRegistry__RedemptionStatusSet(token, enabled);
    }

    /// @inheritdoc IAssetRegistry
    function assetCount() external view returns (uint256) {
        return _assets.length;
    }

    /// @inheritdoc IAssetRegistry
    function assetAt(uint256 index) external view returns (address) {
        return _assets[index];
    }

    /// @inheritdoc IAssetRegistry
    function strategyCount() external view returns (uint256) {
        return _strategies.length;
    }

    /// @inheritdoc IAssetRegistry
    function strategyAt(uint256 index) external view returns (address) {
        return _strategies[index];
    }

    /// @notice Registers the one canonical directly deployed buyback without adding GBX to the redemption list.
    /// @param strategy The canonical BuybackBurnStrategy deployed through STRATEGY_DEPLOYER.
    function registerStandaloneStrategy(address strategy) external onlyProtocolTimelock {
        if (strategy == address(0)) revert AssetRegistry__ZeroAddress();
        if (strategy.code.length == 0) revert AssetRegistry__StrategyHasNoCode(strategy);
        if (_isRegisteredStrategy[strategy]) revert AssetRegistry__StrategyAlreadyRegistered(strategy);
        if (_strategies.length == MAX_STRATEGIES) revert AssetRegistry__AssetLimitReached();
        _requireCanonicalDeployerGraph(strategy);

        IStrategyDeployer.BuybackDeployment memory deployment = STRATEGY_DEPLOYER.canonicalBuybackDeployment();
        if (strategy != STRATEGY_DEPLOYER.canonicalBuybackBurnStrategy()) {
            revert AssetRegistry__StandaloneStrategyNotCanonical(strategy);
        }
        if (
            deployment.gbx != STRATEGY_DEPLOYER.GBX() || deployment.gumBallVault != vault
                || deployment.allocationVoter != STRATEGY_DEPLOYER.ALLOCATION_VOTER()
                || deployment.assetRegistry != address(this) || deployment.protocolTimelock != PROTOCOL_TIMELOCK
                || deployment.emergencyGuardian != EMERGENCY_GUARDIAN
        ) revert AssetRegistry__InvalidStrategyGraph(strategy);
        if (deployment.runtimeCodeHash == bytes32(0) || strategy.codehash != deployment.runtimeCodeHash) {
            revert AssetRegistry__InvalidStrategyProvenance(strategy);
        }
        IBuybackRegistrationIdentity buyback = IBuybackRegistrationIdentity(strategy);
        uint8 liveUSDGDecimals = IERC20Metadata(USDG).decimals();
        uint8 liveGBXDecimals = IERC20Metadata(STRATEGY_DEPLOYER.GBX()).decimals();
        uint8 strategyUSDGDecimals = buyback.USDG_DECIMALS();
        uint8 strategyGBXDecimals = buyback.GBX_DECIMALS();
        if (strategyUSDGDecimals != liveUSDGDecimals || strategyGBXDecimals != liveGBXDecimals) {
            revert AssetRegistry__StrategyDecimalsMismatch(
                strategy, liveUSDGDecimals, strategyUSDGDecimals, liveGBXDecimals, strategyGBXDecimals
            );
        }

        _isRegisteredStrategy[strategy] = true;
        _isStrategyEnabled[strategy] = true;
        _strategies.push(strategy);
        emit AssetRegistry__StandaloneStrategyRegistered(strategy);
    }

    /// @notice Immediately disables a standalone strategy such as buyback.
    /// @param strategy The registered non-asset strategy to disable.
    function disableStandaloneStrategy(address strategy) external onlyGuardianOrTimelock {
        if (!_isRegisteredStrategy[strategy] || tokenForStrategy[strategy] != address(0)) {
            revert AssetRegistry__UnknownAsset(strategy);
        }
        _isStrategyEnabled[strategy] = false;
        emit AssetRegistry__AcquisitionStatusSet(address(0), strategy, false);
    }

    /// @notice Re-enables a reviewed standalone strategy through the protocol timelock.
    /// @param strategy The registered non-asset strategy to re-enable.
    function enableStandaloneStrategy(address strategy) external onlyProtocolTimelock {
        if (!_isRegisteredStrategy[strategy] || tokenForStrategy[strategy] != address(0)) {
            revert AssetRegistry__UnknownAsset(strategy);
        }
        _isStrategyEnabled[strategy] = true;
        emit AssetRegistry__AcquisitionStatusSet(address(0), strategy, true);
    }

    /// @inheritdoc IAssetRegistry
    function configFor(address token) external view returns (AssetConfig memory) {
        _requireRegistered(token);
        return _configByToken[token];
    }

    /// @inheritdoc IAssetRegistry
    function stockTokenDependencyFor(address token) external view returns (StockTokenDependency memory) {
        _requireRegistered(token);
        return _stockTokenDependencyByToken[token];
    }

    /// @inheritdoc IAssetRegistry
    function isRegisteredAsset(address token) external view returns (bool) {
        return _isRegistered[token];
    }

    /// @inheritdoc IAssetRegistry
    function isLiveStrategy(address strategy) external view returns (bool) {
        return _isRegisteredStrategy[strategy] && _isStrategyEnabled[strategy];
    }

    function _requireRegistered(address token) private view {
        if (!_isRegistered[token]) revert AssetRegistry__UnknownAsset(token);
    }
}
