// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Bribe } from "./Bribe.sol";

/**
 * @title GumBall6900 Strategy Payment Router
 * @author Heesho
 * @notice Records one Strategy's complete payment as an immutable Fund liability.
 * @dev Deferred delivery keeps an auction fill live when a supported token temporarily rejects Fund. Bribe is retained
 *      as the immutable graph pairing only; auction payments never fund rewards.
 * @custom:version 1.0.0
 */
contract BribeRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Strategy exclusively authorized to supply completed auction payments.
    address public immutable strategy;
    /// @notice Independently fundable Bribe paired with the Strategy.
    Bribe public immutable bribe;
    /// @notice Strategy payment token routed by this contract.
    IERC20 public immutable paymentToken;
    /// @notice Immutable treasury destination for every completed payment.
    address public immutable fund;

    /// @notice Complete payment-token amount irrevocably owed to Fund and payable by any caller.
    uint256 public fundPaymentLiability;
    /// @notice Exact payment-token balance pulled from Strategy minus completed Fund payouts.
    uint256 public accountedPaymentBalance;

    /// @notice Emitted when Strategy supplies a completed auction payment.
    /// @param strategy Strategy that supplied the payment.
    /// @param amount Exact amount pulled and made Fund-bound.
    event PaymentRouted(address indexed strategy, uint256 amount);
    /// @notice Emitted when a completed payment creates a fixed Fund entitlement.
    /// @param fund Immutable Fund destination.
    /// @param paymentToken Strategy payment token owed.
    /// @param amount Newly accrued amount.
    /// @param totalLiability Complete liability after accrual.
    event FundPaymentAccrued(
        address indexed fund, address indexed paymentToken, uint256 amount, uint256 totalLiability
    );
    /// @notice Emitted when a permissionless caller pays the fixed Fund entitlement.
    /// @param caller Account that triggered payment.
    /// @param fund Immutable Fund receiver.
    /// @param paymentToken Strategy payment token paid.
    /// @param amount Exact amount paid.
    event FundPaymentPaid(address indexed caller, address indexed fund, address indexed paymentToken, uint256 amount);

    /// @notice Raised when an incoming or outgoing supported-token delta is not exact.
    /// @param expected Requested amount.
    /// @param senderDebit Observed sender debit.
    /// @param receiverCredit Observed receiver credit.
    error InexactTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
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

    /// @notice Creates the fixed route between one Strategy, payment token, Bribe, and Fund.
    /// @param strategy_ Strategy exclusively allowed to route payments.
    /// @param bribe_ Independently fundable Bribe paired with the Strategy.
    /// @param paymentToken_ Strategy payment token.
    /// @param fund_ Treasury receiving every completed payment.
    constructor(address strategy_, Bribe bribe_, IERC20 paymentToken_, address fund_) {
        if (
            strategy_ == address(0) || address(bribe_) == address(0) || address(paymentToken_) == address(0)
                || fund_ == address(0) || strategy_.code.length == 0 || address(bribe_).code.length == 0
                || address(paymentToken_).code.length == 0 || fund_.code.length == 0
        ) revert ZeroAddress();

        strategy = strategy_;
        bribe = bribe_;
        paymentToken = paymentToken_;
        fund = fund_;
    }

    /// @notice Pulls one complete auction payment and records it as a fixed Fund liability.
    /// @param amount Exact payment-token amount to pull.
    function routePayment(uint256 amount) external nonReentrant {
        if (msg.sender != strategy) revert NotStrategy(msg.sender);
        if (amount == 0) revert ZeroAmount();

        uint256 senderBefore = paymentToken.balanceOf(msg.sender);
        uint256 receiverBefore = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 senderDebit = senderBefore - paymentToken.balanceOf(msg.sender);
        uint256 receiverCredit = paymentToken.balanceOf(address(this)) - receiverBefore;
        if (senderDebit != amount || receiverCredit != amount) {
            revert InexactTransfer(amount, senderDebit, receiverCredit);
        }

        accountedPaymentBalance += amount;
        fundPaymentLiability += amount;

        emit PaymentRouted(msg.sender, amount);
        emit FundPaymentAccrued(fund, address(paymentToken), amount, fundPaymentLiability);
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
