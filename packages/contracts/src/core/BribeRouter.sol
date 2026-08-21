// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Bribe } from "./Bribe.sol";
import { ICoreResonance } from "./interfaces/ICoreResonance.sol";

/**
 * @title GumBall6900 Strategy Payment Router
 * @author Heesho
 * @notice Classifies one Strategy's acquired-asset payments into fixed Fund and Bribe liabilities at the current rate.
 * @dev Each payment snapshots Resonance's bounded global Bribe share before token interaction. Cumulative numerator
 *      carry preserves exact weighted classification across payment partitioning and governance rate changes. Deferred
 *      isolated settlement keeps an auction fill live when either immutable destination temporarily rejects the asset.
 * @custom:version 1.1.0
 */
contract BribeRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Denominator for the governance-bounded payment split.
    uint256 public constant BPS = 10_000;

    /// @notice Resonance supplying the global prospective Bribe share.
    address public immutable resonance;
    /// @notice Strategy exclusively authorized to supply completed auction payments.
    address public immutable strategy;
    /// @notice Bribe paired with the Strategy and fixed as its automatic reward destination.
    Bribe public immutable bribe;
    /// @notice Strategy payment token routed by this contract.
    IERC20 public immutable paymentToken;
    /// @notice Immutable treasury destination for the Fund-classified share.
    address public immutable fund;

    /// @notice Payment-token amount irrevocably owed to Fund and payable by any caller.
    uint256 public fundPaymentLiability;
    /// @notice Payment-token amount irrevocably owed to the paired Bribe and not yet notified.
    uint256 public bribePaymentLiability;
    /// @notice Sub-token Bribe entitlement in basis-point numerator units, always smaller than `BPS`.
    uint256 public splitRemainder;
    /// @notice Exact payment-token balance pulled from Strategy minus completed Fund and Bribe settlements.
    uint256 public accountedPaymentBalance;

    /// @notice Emitted when Strategy supplies a completed auction payment.
    /// @param strategy Strategy that supplied the payment.
    /// @param amount Exact amount pulled and classified.
    /// @param bribeBps Prospective global Bribe share captured for this payment.
    event PaymentRouted(address indexed strategy, uint256 amount, uint256 bribeBps);
    /// @notice Emitted when a completed payment creates a fixed Fund entitlement.
    /// @param fund Immutable Fund destination.
    /// @param paymentToken Strategy payment token owed.
    /// @param amount Newly accrued amount.
    /// @param totalLiability Complete liability after accrual.
    event FundPaymentAccrued(
        address indexed fund, address indexed paymentToken, uint256 amount, uint256 totalLiability
    );
    /// @notice Emitted when a completed payment creates a fixed paired-Bribe entitlement.
    event BribePaymentAccrued(
        address indexed bribe, address indexed paymentToken, uint256 amount, uint256 totalLiability, uint256 remainder
    );
    /// @notice Emitted when a permissionless caller pays the fixed Fund entitlement.
    /// @param caller Account that triggered payment.
    /// @param fund Immutable Fund receiver.
    /// @param paymentToken Strategy payment token paid.
    /// @param amount Exact amount paid.
    event FundPaymentPaid(address indexed caller, address indexed fund, address indexed paymentToken, uint256 amount);
    /// @notice Emitted when a permissionless caller notifies the fixed paired Bribe.
    event BribeRewardNotified(
        address indexed caller, address indexed bribe, address indexed paymentToken, uint256 amount
    );

    /// @notice Raised when an incoming or outgoing supported-token delta is not exact.
    /// @param expected Requested amount.
    /// @param senderDebit Observed sender debit.
    /// @param receiverCredit Observed receiver credit.
    error InexactTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    /// @notice Raised when a malformed Resonance reports a share above the basis-point denominator.
    /// @param requested Invalid share reported by Resonance.
    error BribeBpsAboveBasis(uint256 requested);
    /// @notice Raised when any caller other than the immutable Strategy tries to route a payment.
    /// @param caller Unauthorized caller.
    error NotStrategy(address caller);
    /// @notice Raised when observed token balance falls below explicit Router liabilities.
    /// @param accounted Explicit accounted balance.
    /// @param actual Observed token balance.
    error PaymentBalanceDeficit(uint256 accounted, uint256 actual);
    /// @notice Raised for a zero or code-less immutable dependency.
    error ZeroAddress();
    /// @notice Raised when Strategy attempts to route a zero payment.
    error ZeroAmount();

    /// @notice Creates the fixed route between one Resonance, Strategy, payment token, Bribe, and Fund.
    /// @param resonance_ Resonance supplying the governance-selected prospective Bribe share.
    /// @param strategy_ Strategy exclusively allowed to route payments.
    /// @param bribe_ Independently fundable Bribe paired with the Strategy.
    /// @param paymentToken_ Strategy payment token.
    /// @param fund_ Treasury receiving every Fund-classified payment share.
    constructor(address resonance_, address strategy_, Bribe bribe_, IERC20 paymentToken_, address fund_) {
        if (
            resonance_ == address(0) || strategy_ == address(0) || address(bribe_) == address(0)
                || address(paymentToken_) == address(0) || fund_ == address(0) || resonance_.code.length == 0
                || strategy_.code.length == 0 || address(bribe_).code.length == 0
                || address(paymentToken_).code.length == 0 || fund_.code.length == 0
        ) revert ZeroAddress();

        resonance = resonance_;
        strategy = strategy_;
        bribe = bribe_;
        paymentToken = paymentToken_;
        fund = fund_;
    }

    /// @notice Pulls one complete auction payment and classifies it at the current global Bribe share.
    /// @param amount Exact payment-token amount to pull.
    function routePayment(uint256 amount) external nonReentrant {
        if (msg.sender != strategy) revert NotStrategy(msg.sender);
        if (amount == 0) revert ZeroAmount();

        // Snapshot policy before the first payment-token interaction so token callbacks cannot alter this fill's split.
        uint256 appliedBribeBps = ICoreResonance(resonance).bribeBps();
        if (appliedBribeBps > BPS) revert BribeBpsAboveBasis(appliedBribeBps);

        uint256 senderBefore = paymentToken.balanceOf(msg.sender);
        uint256 receiverBefore = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 senderDebit = senderBefore - paymentToken.balanceOf(msg.sender);
        uint256 receiverCredit = paymentToken.balanceOf(address(this)) - receiverBefore;
        if (senderDebit != amount || receiverCredit != amount) {
            revert InexactTransfer(amount, senderDebit, receiverCredit);
        }

        uint256 bribeAmount = Math.mulDiv(amount, appliedBribeBps, BPS);
        uint256 accumulatedRemainder = splitRemainder + mulmod(amount, appliedBribeBps, BPS);
        bribeAmount += accumulatedRemainder / BPS;
        splitRemainder = accumulatedRemainder % BPS;
        uint256 fundAmount = amount - bribeAmount;

        accountedPaymentBalance += amount;
        fundPaymentLiability += fundAmount;
        bribePaymentLiability += bribeAmount;

        emit PaymentRouted(msg.sender, amount, appliedBribeBps);
        emit FundPaymentAccrued(fund, address(paymentToken), fundAmount, fundPaymentLiability);
        emit BribePaymentAccrued(
            address(bribe), address(paymentToken), bribeAmount, bribePaymentLiability, splitRemainder
        );
    }

    /// @notice Pays the complete fixed payment liability to the immutable Fund.
    /// @dev State clears before interaction; a failed transfer atomically restores the liability.
    /// @return amount Exact amount paid.
    function payFundPayment() external nonReentrant returns (uint256 amount) {
        amount = fundPaymentLiability;
        if (amount == 0) return 0;

        fundPaymentLiability = 0;
        accountedPaymentBalance -= amount;
        _transferExact(fund, amount);

        emit FundPaymentPaid(msg.sender, fund, address(paymentToken), amount);
    }

    /// @notice Notifies the complete paired-Bribe liability as an acquired-asset reward.
    /// @dev State clears before interaction; any failure atomically restores this leg without altering Fund liability.
    /// @return amount Exact reward amount notified.
    function notifyBribeReward() external nonReentrant returns (uint256 amount) {
        amount = bribePaymentLiability;
        if (amount == 0) return 0;

        bribePaymentLiability = 0;
        accountedPaymentBalance -= amount;

        uint256 senderBefore = paymentToken.balanceOf(address(this));
        uint256 receiverBefore = paymentToken.balanceOf(address(bribe));
        paymentToken.forceApprove(address(bribe), amount);
        bribe.notifyRewardAmount(address(paymentToken), amount);
        if (paymentToken.allowance(address(this), address(bribe)) != 0) {
            paymentToken.forceApprove(address(bribe), 0);
        }
        uint256 senderDebit = senderBefore - paymentToken.balanceOf(address(this));
        uint256 receiverCredit = paymentToken.balanceOf(address(bribe)) - receiverBefore;
        if (senderDebit != amount || receiverCredit != amount) {
            revert InexactTransfer(amount, senderDebit, receiverCredit);
        }

        emit BribeRewardNotified(msg.sender, address(bribe), address(paymentToken), amount);
    }

    /// @notice Returns direct payment-token donations outside Strategy-supplied accounting.
    /// @return amount Unaccounted direct-donation surplus.
    function paymentSurplus() external view returns (uint256 amount) {
        uint256 actual = paymentToken.balanceOf(address(this));
        uint256 accounted = accountedPaymentBalance;
        if (actual < accounted) revert PaymentBalanceDeficit(accounted, actual);
        return actual - accounted;
    }

    /// @notice Transfers the payment token only when Router debit and fixed receiver credit are exact.
    /// @param receiver Immutable Fund destination.
    /// @param amount Exact amount to transfer.
    function _transferExact(address receiver, uint256 amount) private {
        uint256 senderBefore = paymentToken.balanceOf(address(this));
        uint256 receiverBefore = paymentToken.balanceOf(receiver);
        paymentToken.safeTransfer(receiver, amount);
        uint256 senderDebit = senderBefore - paymentToken.balanceOf(address(this));
        uint256 receiverCredit = paymentToken.balanceOf(receiver) - receiverBefore;
        if (senderDebit != amount || receiverCredit != amount) {
            revert InexactTransfer(amount, senderDebit, receiverCredit);
        }
    }
}
