// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IStrategyRewards } from "../interfaces/IStrategyRewards.sol";

interface IAcquisitionRegistrationIdentity {
    /// @notice Returns the fixed token acquired by the strategy.
    function TARGET_TOKEN() external view returns (address);
    /// @notice Returns the fixed rewards index associated with the strategy.
    function STRATEGY_REWARDS() external view returns (address);
    /// @notice Returns the registry against which the strategy checks liveness.
    function ASSET_REGISTRY() external view returns (IAssetRegistry);
    /// @notice Starts the first auction epoch during registration.
    function activateAuction() external;
}

interface IBuybackRegistrationIdentity {
    /// @notice Returns the registry against which the strategy checks liveness.
    function ASSET_REGISTRY() external view returns (IAssetRegistry);
    /// @notice Starts the first auction epoch during registration.
    function activateAuction() external;
}

/// @title AssetRegistry
/// @notice Bounded deterministic raw-basket and terminal strategy registry.
contract AssetRegistry is IAssetRegistry {
    /// @notice Maximum number of redeemable basket assets, including USDG.
    uint256 public constant override MAX_ASSETS = 16;
    /// @notice Maximum number of allocation strategies.
    uint256 public constant MAX_STRATEGIES = 16;

    /// @notice Canonical USDG asset registered at basket index zero.
    address public immutable USDG;
    /// @notice Timelock allowed to register and disable strategies.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Stop-only guardian allowed to disable live strategies.
    address public immutable EMERGENCY_GUARDIAN;

    address[] private _assets;
    address[] private _strategies;
    mapping(address token => AssetConfig config) private _config;
    mapping(address token => bool registered) private _registeredAsset;
    /// @notice Returns the redeemable target token associated with a strategy, if any.
    mapping(address strategy => address token) public override tokenForStrategy;
    /// @notice Returns the supporter rewards contract associated with a strategy, if any.
    mapping(address strategy => address rewards) public override rewardsForStrategy;
    mapping(address strategy => bool registered) private _registeredStrategy;
    mapping(address strategy => bool live) private _liveStrategy;

    error AssetRegistry__AlreadyRegistered(address account);
    error AssetRegistry__AssetLimitReached();
    error AssetRegistry__InvalidStrategyGraph(address strategy);
    error AssetRegistry__StrategyLimitReached();
    error AssetRegistry__Unauthorized(address caller);
    error AssetRegistry__UnknownAsset(address token);
    error AssetRegistry__UnknownStrategy(address strategy);
    error AssetRegistry__ZeroAddress();

    event AssetRegistry__AssetRegistered(
        address indexed token, address indexed strategy, address indexed rewards, uint256 assetIndex
    );
    event AssetRegistry__StandaloneStrategyRegistered(address indexed strategy, uint256 strategyIndex);
    event AssetRegistry__StrategyDisabled(address indexed strategy);

    /// @notice Configures access control and registers USDG as basket asset zero.
    constructor(address usdG, address protocolTimelock, address emergencyGuardian) {
        if (usdG == address(0) || protocolTimelock == address(0) || emergencyGuardian == address(0)) {
            revert AssetRegistry__ZeroAddress();
        }
        if (usdG.code.length == 0) revert AssetRegistry__ZeroAddress();
        USDG = usdG;
        PROTOCOL_TIMELOCK = protocolTimelock;
        EMERGENCY_GUARDIAN = emergencyGuardian;

        _assets.push(usdG);
        _registeredAsset[usdG] = true;
        _config[usdG] = AssetConfig({ token: usdG, strategy: address(0), rewards: address(0), live: false });
        emit AssetRegistry__AssetRegistered(usdG, address(0), address(0), 0);
    }

    /// @notice Registers one immutable target/strategy/rewards association through the typed timelock.
    function registerAsset(address token, address strategy, address rewards) external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert AssetRegistry__Unauthorized(msg.sender);
        if (token == address(0) || strategy == address(0) || rewards == address(0)) {
            revert AssetRegistry__ZeroAddress();
        }
        if (token.code.length == 0 || strategy.code.length == 0 || rewards.code.length == 0) {
            revert AssetRegistry__InvalidStrategyGraph(strategy);
        }
        if (_registeredAsset[token]) revert AssetRegistry__AlreadyRegistered(token);
        if (_registeredStrategy[strategy]) revert AssetRegistry__AlreadyRegistered(strategy);
        if (_assets.length >= MAX_ASSETS) revert AssetRegistry__AssetLimitReached();
        if (_strategies.length >= MAX_STRATEGIES) revert AssetRegistry__StrategyLimitReached();

        IAcquisitionRegistrationIdentity acquisition = IAcquisitionRegistrationIdentity(strategy);
        if (
            acquisition.TARGET_TOKEN() != token || acquisition.STRATEGY_REWARDS() != rewards
                || address(acquisition.ASSET_REGISTRY()) != address(this)
                || IStrategyRewards(rewards).STRATEGY() != strategy || IStrategyRewards(rewards).REWARD_TOKEN() != token
        ) revert AssetRegistry__InvalidStrategyGraph(strategy);

        acquisition.activateAuction();

        _assets.push(token);
        _strategies.push(strategy);
        _registeredAsset[token] = true;
        _registeredStrategy[strategy] = true;
        _liveStrategy[strategy] = true;
        tokenForStrategy[strategy] = token;
        rewardsForStrategy[strategy] = rewards;
        _config[token] = AssetConfig({ token: token, strategy: strategy, rewards: rewards, live: true });

        emit AssetRegistry__AssetRegistered(token, strategy, rewards, _assets.length - 1);
    }

    /// @notice Registers the single buyback strategy without adding GBX to the redeemable asset basket.
    function registerStandaloneStrategy(address strategy) external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert AssetRegistry__Unauthorized(msg.sender);
        if (strategy == address(0) || strategy.code.length == 0) revert AssetRegistry__ZeroAddress();
        if (_registeredStrategy[strategy]) revert AssetRegistry__AlreadyRegistered(strategy);
        if (_strategies.length >= MAX_STRATEGIES) revert AssetRegistry__StrategyLimitReached();
        IBuybackRegistrationIdentity buyback = IBuybackRegistrationIdentity(strategy);
        if (address(buyback.ASSET_REGISTRY()) != address(this)) {
            revert AssetRegistry__InvalidStrategyGraph(strategy);
        }

        buyback.activateAuction();

        _strategies.push(strategy);
        _registeredStrategy[strategy] = true;
        _liveStrategy[strategy] = true;
        emit AssetRegistry__StandaloneStrategyRegistered(strategy, _strategies.length - 1);
    }

    /// @notice Irreversibly stops a strategy from receiving signals or releasing new USDG.
    function disableStrategy(address strategy) external {
        if (msg.sender != PROTOCOL_TIMELOCK && msg.sender != EMERGENCY_GUARDIAN) {
            revert AssetRegistry__Unauthorized(msg.sender);
        }
        if (!_registeredStrategy[strategy]) revert AssetRegistry__UnknownStrategy(strategy);
        if (!_liveStrategy[strategy]) revert AssetRegistry__UnknownStrategy(strategy);
        _liveStrategy[strategy] = false;
        address token = tokenForStrategy[strategy];
        if (token != address(0)) _config[token].live = false;
        emit AssetRegistry__StrategyDisabled(strategy);
    }

    /// @notice Returns the number of registered redeemable basket assets.
    function assetCount() external view override returns (uint256) {
        return _assets.length;
    }

    /// @notice Returns the redeemable basket asset at an index.
    function assetAt(uint256 index) external view override returns (address) {
        return _assets[index];
    }

    /// @notice Returns the number of registered allocation strategies.
    function strategyCount() external view override returns (uint256) {
        return _strategies.length;
    }

    /// @notice Returns the registered allocation strategy at an index.
    function strategyAt(uint256 index) external view override returns (address) {
        return _strategies[index];
    }

    /// @notice Returns the immutable registration graph and liveness for a basket asset.
    function configFor(address token) external view override returns (AssetConfig memory) {
        if (!_registeredAsset[token]) revert AssetRegistry__UnknownAsset(token);
        return _config[token];
    }

    /// @notice Returns whether a token belongs to the redeemable basket.
    function isRegisteredAsset(address token) external view override returns (bool) {
        return _registeredAsset[token];
    }

    /// @notice Returns whether a strategy is registered and not terminally disabled.
    function isLiveStrategy(address strategy) external view override returns (bool) {
        return _registeredStrategy[strategy] && _liveStrategy[strategy];
    }
}
