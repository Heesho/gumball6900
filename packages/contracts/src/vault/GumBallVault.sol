// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IAllocationVoter } from "../interfaces/IAllocationVoter.sol";
import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IEligibilityModule } from "../interfaces/IEligibilityModule.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { IGumBallVault } from "../interfaces/IGumBallVault.sol";

/// @title GumBallVault
/// @notice Sole custody point for the redeemable multi-asset backing of GUM BALL 6900.
/// @dev The contract deliberately has no owner, pause, rescue, approval, execute, or arbitrary-call surface.
contract GumBallVault is IGumBallVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error GumBallVault__IneligibleReceiver(address receiver);
    error GumBallVault__InsufficientPhysicalUSDG(uint256 requested, uint256 available);
    error GumBallVault__NativeETHNotAccepted();
    error GumBallVault__NoSupply();
    /// @notice Reverts when a vault transfer removes more or less than the exact accounted amount.
    /// @param token The registered asset whose vault balance was observed.
    /// @param expected The pro-rata redemption amount or consumed USDG budget.
    /// @param observed The actual vault balance decrease observed during the transfer.
    error GumBallVault__ObservedDebitMismatch(address token, uint256 expected, uint256 observed);
    /// @notice Reverts when a vault transfer delivers more or less than the exact accounted amount.
    /// @param token The registered asset whose receiver delivery was observed.
    /// @param receiver The intended redemption or strategy-fill receiver.
    /// @param expected The pro-rata redemption amount or consumed USDG budget.
    /// @param observed The actual receiver balance increase observed during the transfer.
    error GumBallVault__ObservedReceiptMismatch(address token, address receiver, uint256 expected, uint256 observed);
    error GumBallVault__UnauthorizedStrategy(address strategy);
    error GumBallVault__ZeroAddress();
    error GumBallVault__ZeroAmount();
    error GumBallVault__ZeroReceiver();
    error GumBallVault__ZeroShares();

    event GumBallVault__AssetRedeemed(address indexed receiver, address indexed asset, uint256 amount);
    event GumBallVault__Redeemed(address indexed owner, address indexed receiver, uint256 shares, uint256 supplyBefore);
    event GumBallVault__USDGReleased(address indexed strategy, address indexed receiver, uint256 amount);

    /// @notice Canonical USDG held as redeemable backing and physically released for strategy fills.
    IERC20 public immutable override USDG;
    /// @notice Canonical GBX burned when holders redeem their pro-rata basket claim.
    IGBXToken public immutable GBX;
    /// @notice Canonical bounded basket-asset and live-strategy registry.
    IAssetRegistry public immutable ASSET_REGISTRY;
    /// @notice Canonical virtual USDG budget accountant.
    IAllocationVoter public immutable ALLOCATION_VOTER;
    /// @notice Immutable policy used to validate redemption receivers.
    IEligibilityModule public immutable ELIGIBILITY_MODULE;

    /// @notice Wires immutable protocol components. None can be replaced after deployment.
    /// @param usdG_ The canonical USDG token held as both backing and strategy budget custody.
    /// @param gbx_ The canonical GBX claim token burned during redemption.
    /// @param assetRegistry_ The canonical bounded list of basket assets and live strategies.
    /// @param allocationVoter_ The canonical virtual budget accountant scaled during redemption.
    /// @param eligibilityModule_ The immutable receiver eligibility policy.
    constructor(
        address usdG_,
        address gbx_,
        address assetRegistry_,
        address allocationVoter_,
        address eligibilityModule_
    ) {
        if (
            usdG_ == address(0) || gbx_ == address(0) || assetRegistry_ == address(0) || allocationVoter_ == address(0)
                || eligibilityModule_ == address(0)
        ) revert GumBallVault__ZeroAddress();

        USDG = IERC20(usdG_);
        GBX = IGBXToken(gbx_);
        ASSET_REGISTRY = IAssetRegistry(assetRegistry_);
        ALLOCATION_VOTER = IAllocationVoter(allocationVoter_);
        ELIGIBILITY_MODULE = IEligibilityModule(eligibilityModule_);
    }

    /// @inheritdoc IGumBallVault
    /// @dev Uses total supply before burning. Locked, unclaimed, LP-held, escrowed, and wallet-held GBX all remain in
    ///      the denominator. Every asset balance is snapshotted before the first external state transition.
    function redeem(uint256 shares, address receiver) external nonReentrant returns (uint256[] memory amountsOut) {
        if (shares == 0) revert GumBallVault__ZeroShares();
        if (receiver == address(0)) revert GumBallVault__ZeroReceiver();
        if (!ELIGIBILITY_MODULE.canRedeem(receiver)) revert GumBallVault__IneligibleReceiver(receiver);

        uint256 supplyBefore = GBX.totalSupply();
        if (supplyBefore == 0) revert GumBallVault__NoSupply();

        uint256 count = ASSET_REGISTRY.assetCount();
        address[] memory assets = new address[](count);
        amountsOut = new uint256[](count);

        for (uint256 index; index < count; ++index) {
            address asset = ASSET_REGISTRY.assetAt(index);
            assets[index] = asset;
            amountsOut[index] = Math.mulDiv(IERC20(asset).balanceOf(address(this)), shares, supplyBefore);
        }

        ALLOCATION_VOTER.scaleBudgetsAfterRedemption(shares, supplyBefore);
        GBX.burnFrom(msg.sender, shares);

        for (uint256 index; index < count; ++index) {
            uint256 amount = amountsOut[index];
            if (amount != 0) _transferExact(IERC20(assets[index]), receiver, amount);
            emit GumBallVault__AssetRedeemed(receiver, assets[index], amount);
        }

        emit GumBallVault__Redeemed(msg.sender, receiver, shares, supplyBefore);
    }

    /// @inheritdoc IGumBallVault
    /// @dev The directly deployed caller is the only authority selecting the fill receiver. Its virtual budget is
    ///      decremented by AllocationVoter before physical USDG leaves the vault.
    function releaseUSDG(address receiver, uint256 amount) external nonReentrant {
        if (!ASSET_REGISTRY.isLiveStrategy(msg.sender)) revert GumBallVault__UnauthorizedStrategy(msg.sender);
        if (receiver == address(0)) revert GumBallVault__ZeroReceiver();
        if (amount == 0) revert GumBallVault__ZeroAmount();

        uint256 available = USDG.balanceOf(address(this));
        if (amount > available) revert GumBallVault__InsufficientPhysicalUSDG(amount, available);

        ALLOCATION_VOTER.consumeStrategyBudget(msg.sender, amount);
        _transferExact(USDG, receiver, amount);

        emit GumBallVault__USDGReleased(msg.sender, receiver, amount);
    }

    function _transferExact(IERC20 token, address receiver, uint256 amount) private {
        uint256 senderBalanceBefore = token.balanceOf(address(this));
        uint256 receiverBalanceBefore = token.balanceOf(receiver);
        token.safeTransfer(receiver, amount);
        uint256 senderBalanceAfter = token.balanceOf(address(this));
        uint256 receiverBalanceAfter = token.balanceOf(receiver);

        uint256 observedDebit = senderBalanceBefore > senderBalanceAfter ? senderBalanceBefore - senderBalanceAfter : 0;
        if (observedDebit != amount) {
            revert GumBallVault__ObservedDebitMismatch(address(token), amount, observedDebit);
        }

        uint256 observedReceipt =
            receiverBalanceAfter > receiverBalanceBefore ? receiverBalanceAfter - receiverBalanceBefore : 0;
        if (observedReceipt != amount) {
            revert GumBallVault__ObservedReceiptMismatch(address(token), receiver, amount, observedReceipt);
        }
    }

    /// @notice Returns the raw vault balance of any token without treating unsupported tokens as backing.
    /// @param token The ERC-20 token whose physical balance is queried.
    /// @return balance The vault's raw token balance; registry support is intentionally not inferred.
    function rawBalance(address token) external view returns (uint256 balance) {
        balance = IERC20(token).balanceOf(address(this));
    }

    /// @notice Rejects normal native-ETH transfers so vault assets follow the ERC-20 redemption path.
    receive() external payable {
        revert GumBallVault__NativeETHNotAccepted();
    }
}
