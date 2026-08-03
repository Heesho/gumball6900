// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title IAssetRegistry
/// @notice Bounded canonical asset and strategy registry used by GumBallVault.
interface IAssetRegistry {
    /// @notice Immutable metadata and directly deployed strategy wiring for one supported asset.
    struct AssetConfig {
        address token;
        bytes32 assetId;
        bytes32 symbolHash;
        uint8 decimals;
        address strategy;
        address rewards;
        bool isStockToken;
        bool acquisitionEnabled;
        bool redemptionEnabled;
    }

    /// @notice Exact live dependency identity required when registering an upgradeable stock-token beacon proxy.
    struct StockTokenDependency {
        bytes32 tokenRuntimeCodeHash;
        address beacon;
        bytes32 beaconRuntimeCodeHash;
        address implementation;
        bytes32 implementationRuntimeCodeHash;
        uint256 uiMultiplier;
    }

    /// @notice Returns the number of registered assets.
    /// @return The bounded asset count.
    function assetCount() external view returns (uint256);

    /// @notice Returns the registered token address at a bounded index.
    /// @param index The zero-based asset index.
    /// @return The registered token address.
    function assetAt(uint256 index) external view returns (address);

    /// @notice Returns the number of directly deployed signal strategies, including standalone buyback.
    /// @return The bounded strategy count.
    function strategyCount() external view returns (uint256);

    /// @notice Returns a directly deployed strategy at a bounded index.
    /// @param index The zero-based strategy index.
    /// @return The directly deployed strategy address.
    function strategyAt(uint256 index) external view returns (address);

    /// @notice Returns the full configuration for a registered token.
    /// @param token The registered token address.
    /// @return The asset configuration.
    function configFor(address token) external view returns (AssetConfig memory);

    /// @notice Returns the immutable registration-time beacon identity for a stock token.
    /// @param token The registered stock-token proxy address.
    /// @return The registration-time token, beacon, implementation, and multiplier identity.
    function stockTokenDependencyFor(address token) external view returns (StockTokenDependency memory);

    /// @notice Returns whether the address is a registered asset token.
    /// @param token The candidate token address.
    /// @return Whether the token is registered.
    function isRegisteredAsset(address token) external view returns (bool);

    /// @notice Returns the registered asset token associated with a directly deployed strategy.
    /// @param strategy The directly deployed strategy address.
    /// @return The associated token, or zero for a standalone strategy.
    function tokenForStrategy(address strategy) external view returns (address);

    /// @notice Returns whether a directly deployed strategy is registered and acquisition-enabled.
    /// @param strategy The candidate strategy address.
    /// @return Whether the strategy is live.
    function isLiveStrategy(address strategy) external view returns (bool);
}
