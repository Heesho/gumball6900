// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { IGumBallVault } from "../interfaces/IGumBallVault.sol";

/// @title GumBallVault
/// @notice Passive bounded raw-balance basket with unpausable pre-burn-denominator redemption.
contract GumBallVault is IGumBallVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical USDG basket asset and strategy funding token.
    IERC20 public immutable USDG;
    /// @notice Redeemable share token burned during in-kind exits.
    IGBXToken public immutable GBX;
    /// @notice Bounded registry defining the raw redemption basket.
    IAssetRegistry public immutable ASSET_REGISTRY;
    /// @notice Virtual USDG allocation ledger debited by releases and scaled by redemptions.
    IAllocationVoter public immutable ALLOCATION_VOTER;

    error GumBallVault__InexactTransfer(address token, uint256 expected, uint256 debit, uint256 receipt);
    error GumBallVault__InsufficientShares(uint256 requested, uint256 balance);
    error GumBallVault__StrategyNotLive(address strategy);
    error GumBallVault__ZeroAddress();
    error GumBallVault__ZeroAmount();

    event GumBallVault__Redeemed(
        address indexed owner, address indexed receiver, uint256 shares, uint256 supplyBefore, uint256[] amounts
    );
    event GumBallVault__USDGReleased(address indexed strategy, address indexed receiver, uint256 amount);

    /// @notice Configures the share token, basket registry, USDG, and allocation ledger.
    constructor(IGBXToken gbx, address usdG, IAssetRegistry assetRegistry, IAllocationVoter allocationVoter) {
        if (
            address(gbx) == address(0) || usdG == address(0) || address(assetRegistry) == address(0)
                || address(allocationVoter) == address(0)
        ) revert GumBallVault__ZeroAddress();
        if (
            address(gbx).code.length == 0 || usdG.code.length == 0 || address(assetRegistry).code.length == 0
                || address(allocationVoter).code.length == 0
        ) revert GumBallVault__ZeroAddress();
        GBX = gbx;
        USDG = IERC20(usdG);
        ASSET_REGISTRY = assetRegistry;
        ALLOCATION_VOTER = allocationVoter;
    }

    /// @notice Burns shares and atomically transfers their raw fraction of every registered balance.
    function redeem(uint256 shares, address receiver)
        external
        override
        nonReentrant
        returns (uint256[] memory amounts)
    {
        if (shares == 0) revert GumBallVault__ZeroAmount();
        if (receiver == address(0) || receiver == address(this)) revert GumBallVault__ZeroAddress();
        uint256 userBalance = GBX.balanceOf(msg.sender);
        if (shares > userBalance) revert GumBallVault__InsufficientShares(shares, userBalance);

        uint256 supplyBefore = GBX.totalSupply();
        uint256 count = ASSET_REGISTRY.assetCount();
        amounts = new uint256[](count);
        for (uint256 index; index < count; ++index) {
            address asset = ASSET_REGISTRY.assetAt(index);
            amounts[index] = Math.mulDiv(IERC20(asset).balanceOf(address(this)), shares, supplyBefore);
        }

        GBX.burnFrom(msg.sender, shares);
        ALLOCATION_VOTER.scaleBudgetsAfterRedemption(shares, supplyBefore);

        for (uint256 index; index < count; ++index) {
            uint256 amount = amounts[index];
            if (amount != 0) _transferExact(IERC20(ASSET_REGISTRY.assetAt(index)), receiver, amount);
        }

        emit GumBallVault__Redeemed(msg.sender, receiver, shares, supplyBefore, amounts);
    }

    /// @notice Releases a live caller strategy's already allocated fixed USDG lot.
    function releaseUSDG(address receiver, uint256 amount) external override nonReentrant {
        if (!ASSET_REGISTRY.isLiveStrategy(msg.sender)) revert GumBallVault__StrategyNotLive(msg.sender);
        if (receiver == address(0)) revert GumBallVault__ZeroAddress();
        if (amount == 0) revert GumBallVault__ZeroAmount();

        ALLOCATION_VOTER.consumeStrategyBudget(msg.sender, amount);
        _transferExact(USDG, receiver, amount);
        emit GumBallVault__USDGReleased(msg.sender, receiver, amount);
    }

    function _transferExact(IERC20 token, address receiver, uint256 amount) private {
        uint256 senderBefore = token.balanceOf(address(this));
        uint256 receiverBefore = token.balanceOf(receiver);
        token.safeTransfer(receiver, amount);
        uint256 senderAfter = token.balanceOf(address(this));
        uint256 receiverAfter = token.balanceOf(receiver);
        uint256 debit = senderBefore > senderAfter ? senderBefore - senderAfter : 0;
        uint256 receipt = receiverAfter > receiverBefore ? receiverAfter - receiverBefore : 0;
        if (debit != amount || receipt != amount) {
            revert GumBallVault__InexactTransfer(address(token), amount, debit, receipt);
        }
    }
}
