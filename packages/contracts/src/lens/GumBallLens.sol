// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { AllocationVoter } from "../signal/AllocationVoter.sol";

/// @title GumBallLens
/// @notice Bounded read-only aggregation for wallets, SDKs, indexers, and the protocol web application.
/// @dev Every loop is capped by AssetRegistry's immutable asset and strategy maxima. Values are raw atomic units.
contract GumBallLens {
    struct SupplyView {
        uint256 totalSupply;
        uint256 cumulativeMinted;
        uint256 cumulativeBurned;
        uint256 remainingMintCapacity;
    }

    struct AssetView {
        address token;
        bytes32 assetId;
        bytes32 symbolHash;
        uint8 decimals;
        uint256 vaultBalance;
        address strategy;
        address rewards;
        bool isStockToken;
        bool acquisitionEnabled;
        bool redemptionEnabled;
    }

    struct StrategyView {
        address strategy;
        address token;
        uint256 activeWeight;
        uint256 virtualUSDGBudget;
        bool live;
        bool voterDisabled;
    }

    struct UserSignalView {
        address strategy;
        uint256 activeWeight;
        uint256 pendingIncrease;
    }

    error GumBallLens__InvalidShares(uint256 shares, uint256 supply);
    error GumBallLens__ZeroAddress();

    /// @notice Canonical GBX supply token queried by the lens.
    IGBXToken public immutable GBX;
    /// @notice Canonical vault whose raw basket balances are aggregated.
    address public immutable GUM_BALL_VAULT;
    /// @notice Canonical bounded asset and strategy registry queried by the lens.
    IAssetRegistry public immutable ASSET_REGISTRY;
    /// @notice Canonical allocation voter queried for weights and virtual budgets.
    AllocationVoter public immutable ALLOCATION_VOTER;
    /// @notice Canonical non-transferable sGBX token queried for user stake.
    IERC20 public immutable STAKED_GBX;

    /// @notice Wires the immutable read-only protocol graph.
    /// @param gbx The canonical GBX token.
    /// @param gumBallVault The canonical basket vault whose balances are reported.
    /// @param assetRegistry The canonical bounded asset and strategy registry.
    /// @param allocationVoter The canonical staking and allocation voter.
    /// @param stakedGBX The canonical non-transferable sGBX token.
    constructor(address gbx, address gumBallVault, address assetRegistry, address allocationVoter, address stakedGBX) {
        if (
            gbx == address(0) || gumBallVault == address(0) || assetRegistry == address(0)
                || allocationVoter == address(0) || stakedGBX == address(0)
        ) revert GumBallLens__ZeroAddress();
        GBX = IGBXToken(gbx);
        GUM_BALL_VAULT = gumBallVault;
        ASSET_REGISTRY = IAssetRegistry(assetRegistry);
        ALLOCATION_VOTER = AllocationVoter(allocationVoter);
        STAKED_GBX = IERC20(stakedGBX);
    }

    /// @notice Returns the lifetime and live GBX supply counters in one call.
    /// @return result The current supply, cumulative mint and burn, and remaining one-billion-cap values.
    function supplyView() external view returns (SupplyView memory result) {
        result.totalSupply = GBX.totalSupply();
        result.cumulativeMinted = GBX.cumulativeMinted();
        result.cumulativeBurned = GBX.cumulativeBurned();
        result.remainingMintCapacity = GBX.MAX_CUMULATIVE_MINT() - result.cumulativeMinted;
    }

    /// @notice Returns every registered basket asset and its raw vault balance.
    /// @return results One entry per bounded AssetRegistry asset, in registry order.
    function assetViews() external view returns (AssetView[] memory results) {
        uint256 count = ASSET_REGISTRY.assetCount();
        results = new AssetView[](count);
        for (uint256 index; index < count; ++index) {
            address token = ASSET_REGISTRY.assetAt(index);
            IAssetRegistry.AssetConfig memory config = ASSET_REGISTRY.configFor(token);
            results[index] = AssetView({
                token: token,
                assetId: config.assetId,
                symbolHash: config.symbolHash,
                decimals: config.decimals,
                vaultBalance: IERC20(token).balanceOf(GUM_BALL_VAULT),
                strategy: config.strategy,
                rewards: config.rewards,
                isStockToken: config.isStockToken,
                acquisitionEnabled: config.acquisitionEnabled,
                redemptionEnabled: config.redemptionEnabled
            });
        }
    }

    /// @notice Returns current allocation state for every registered strategy, including standalone buyback.
    /// @return results One entry per bounded AssetRegistry strategy, in registry order.
    function strategyViews() external view returns (StrategyView[] memory results) {
        uint256 count = ASSET_REGISTRY.strategyCount();
        results = new StrategyView[](count);
        for (uint256 index; index < count; ++index) {
            address strategy = ASSET_REGISTRY.strategyAt(index);
            results[index] = StrategyView({
                strategy: strategy,
                token: ASSET_REGISTRY.tokenForStrategy(strategy),
                activeWeight: ALLOCATION_VOTER.strategyWeight(strategy),
                virtualUSDGBudget: ALLOCATION_VOTER.previewStrategyBudget(strategy),
                live: ASSET_REGISTRY.isLiveStrategy(strategy),
                voterDisabled: ALLOCATION_VOTER.strategyDisabled(strategy)
            });
        }
    }

    /// @notice Returns the union of one user's bounded active and pending strategy lists without duplicates.
    /// @param user The wallet whose stake and strategy weights are queried.
    /// @return stakedBalance The user's raw sGBX balance.
    /// @return activationTime The timestamp when the user's queued increases become activatable.
    /// @return activationsPaused Whether new signal activations are globally paused.
    /// @return results The user's unique active and pending strategy entries.
    function userSignalViews(address user)
        external
        view
        returns (uint256 stakedBalance, uint64 activationTime, bool activationsPaused, UserSignalView[] memory results)
    {
        address[] memory active = ALLOCATION_VOTER.activeStrategies(user);
        address[] memory pending = ALLOCATION_VOTER.pendingStrategies(user);
        uint256 uniquePending;
        for (uint256 index; index < pending.length; ++index) {
            bool alreadyIncluded;
            for (uint256 prior; prior < active.length; ++prior) {
                if (active[prior] == pending[index]) {
                    alreadyIncluded = true;
                    break;
                }
            }
            if (!alreadyIncluded) uniquePending += 1;
        }
        results = new UserSignalView[](active.length + uniquePending);
        uint256 resultCount;
        for (uint256 index; index < active.length; ++index) {
            address strategy = active[index];
            results[resultCount++] = UserSignalView({
                strategy: strategy,
                activeWeight: ALLOCATION_VOTER.activeWeight(user, strategy),
                pendingIncrease: ALLOCATION_VOTER.pendingWeight(user, strategy)
            });
        }
        for (uint256 index; index < pending.length; ++index) {
            address strategy = pending[index];
            bool alreadyIncluded;
            for (uint256 prior; prior < active.length; ++prior) {
                if (active[prior] == strategy) {
                    alreadyIncluded = true;
                    break;
                }
            }
            if (alreadyIncluded) continue;
            results[resultCount++] = UserSignalView({
                strategy: strategy, activeWeight: 0, pendingIncrease: ALLOCATION_VOTER.pendingWeight(user, strategy)
            });
        }
        stakedBalance = STAKED_GBX.balanceOf(user);
        activationTime = ALLOCATION_VOTER.pendingActivationTime(user);
        activationsPaused = ALLOCATION_VOTER.signalActivationsPaused();
    }

    /// @notice Previews raw pro-rata outputs using the same floor rounding and supply denominator as GumBallVault.
    /// @param shares The raw GBX amount whose basket output is previewed.
    /// @return tokens Every registered asset address, in registry order.
    /// @return amountsOut The floor-rounded raw output for each corresponding token.
    function previewRedemption(uint256 shares)
        external
        view
        returns (address[] memory tokens, uint256[] memory amountsOut)
    {
        uint256 supply = GBX.totalSupply();
        if (shares == 0 || shares > supply) revert GumBallLens__InvalidShares(shares, supply);
        uint256 count = ASSET_REGISTRY.assetCount();
        tokens = new address[](count);
        amountsOut = new uint256[](count);
        for (uint256 index; index < count; ++index) {
            address token = ASSET_REGISTRY.assetAt(index);
            tokens[index] = token;
            amountsOut[index] = Math.mulDiv(IERC20(token).balanceOf(GUM_BALL_VAULT), shares, supply);
        }
    }
}
