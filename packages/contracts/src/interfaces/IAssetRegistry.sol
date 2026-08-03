// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @notice Read-only surface for the bounded asset and strategy registry.
interface IAssetRegistry {
    struct AssetConfig {
        address token;
        address strategy;
        address rewards;
        bool live;
    }

    /// @notice Returns the maximum number of registered redeemable assets.
    function MAX_ASSETS() external view returns (uint256);
    /// @notice Returns the number of registered redeemable assets.
    function assetCount() external view returns (uint256);
    /// @notice Returns the registered asset at an index.
    function assetAt(uint256 index) external view returns (address);
    /// @notice Returns the number of registered strategies.
    function strategyCount() external view returns (uint256);
    /// @notice Returns the registered strategy at an index.
    function strategyAt(uint256 index) external view returns (address);
    /// @notice Returns the immutable configuration for a registered asset.
    function configFor(address token) external view returns (AssetConfig memory);
    /// @notice Returns the redeemable token associated with a strategy, if any.
    function tokenForStrategy(address strategy) external view returns (address);
    /// @notice Returns the rewards contract associated with a strategy, if any.
    function rewardsForStrategy(address strategy) external view returns (address);
    /// @notice Returns whether a token belongs to the redeemable basket.
    function isRegisteredAsset(address token) external view returns (bool);
    /// @notice Returns whether a strategy is registered and not disabled.
    function isLiveStrategy(address strategy) external view returns (bool);
}
