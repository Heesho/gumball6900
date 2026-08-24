// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IResonance } from "./interfaces/IResonance.sol";

/// @title GumBall6900 Reverse Dutch Strategy
/// @author heesho
/// @notice Sells the Strategy's complete accumulated USDG balance for a configured ERC-20 payment asset.
/// @dev Each permissionless reverse Dutch auction starts at `initialPrice` and decays to zero over `epochDuration`.
///      A successful fill sends the whole payment directly to Fund and the paired BribeRouter at the Resonance-wide
///      split captured before token interaction, transfers the pre-payment USDG balance to the selected receiver, and
///      starts the next epoch from the bounded, multiplied clearing payment. The auction design is adapted with credit
///      to Euler Fee Flow and Liquid Signal Governance. Core accounting assumes standard non-rebasing ERC-20 transfers.
contract Strategy is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Immutable auction parameters validated when a Strategy is deployed.
    /// @param initialPrice First epoch's starting price in raw payment-token units.
    /// @param epochDuration Seconds over which each epoch's price decays to zero.
    /// @param priceMultiplier Multiplier applied to a clearing payment, scaled by `PRICE_SCALE`.
    /// @param minimumPrice Floor in raw payment-token units for the next epoch's start, not a fill-time price floor.
    struct Config {
        uint256 initialPrice;
        uint256 epochDuration;
        uint256 priceMultiplier;
        uint256 minimumPrice;
    }

    /// @notice Shortest permitted price-decay period, in seconds.
    uint256 public constant MIN_EPOCH_DURATION = 1 hours;
    /// @notice Longest permitted price-decay period, in seconds.
    uint256 public constant MAX_EPOCH_DURATION = 365 days;
    /// @notice Smallest next-starting-price multiplier, scaled by `PRICE_SCALE`.
    uint256 public constant MIN_PRICE_MULTIPLIER = 1.1e18;
    /// @notice Largest next-starting-price multiplier, scaled by `PRICE_SCALE`.
    uint256 public constant MAX_PRICE_MULTIPLIER = 3e18;
    /// @notice Absolute lower bound for `minimumPrice`, in raw payment-token units regardless of token decimals.
    uint256 public constant ABSOLUTE_MINIMUM_PRICE = 1e6;
    /// @notice Absolute upper bound for a starting or minimum price, in raw payment-token units.
    uint256 public constant ABSOLUTE_MAXIMUM_PRICE = type(uint192).max;
    /// @notice Fixed-point scale representing a 1.0 next-starting-price multiplier.
    uint256 public constant PRICE_SCALE = 1e18;
    /// @notice Basis-point denominator used to split each acquired payment.
    uint256 public constant BPS = 10_000;
    /// @notice Immutable Resonance that releases USDG and supplies the current Bribe split and paired BribeRouter.
    address public immutable resonance;
    /// @notice Immutable USDG revenue token sold by this Strategy, accounted for in raw token units.
    IERC20 public immutable usdg;
    /// @notice Immutable ERC-20 asset required from buyers, accounted for in raw token units.
    IERC20 public immutable paymentToken;
    /// @notice Immutable treasury that receives the payment remainder after the floored Bribe share.
    address public immutable fund;
    /// @notice Immutable number of seconds over which each epoch's price declines to zero.
    uint256 public immutable epochDuration;
    /// @notice Immutable `PRICE_SCALE`-scaled multiplier applied to a completed epoch's clearing payment.
    uint256 public immutable priceMultiplier;
    /// @notice Immutable raw-payment-token floor applied only to each next epoch's starting price.
    uint256 public immutable minimumPrice;

    /// @notice Zero-based identifier of the active auction epoch, incremented after every successful fill.
    uint256 public epochId;
    /// @notice Starting price of the active epoch, in raw payment-token units.
    uint256 public initialPrice;
    /// @notice Unix timestamp at which the active epoch began.
    uint256 public epochStartedAt;

    /// @notice Emitted after a buyer atomically fills one auction epoch and the next epoch begins.
    /// @param buyer Account that supplied the payment asset or completed a free fill.
    /// @param revenueReceiver Address that received the complete snapshotted USDG balance.
    /// @param epochId Zero-based identifier of the completed auction epoch.
    /// @param revenueAmount Whole raw USDG units purchased.
    /// @param paymentAmount Whole raw payment-token units paid, possibly zero after full decay.
    event Purchased(
        address indexed buyer,
        address indexed revenueReceiver,
        uint256 indexed epochId,
        uint256 revenueAmount,
        uint256 paymentAmount
    );

    /// @notice Thrown when execution occurs after the caller-supplied purchase deadline.
    /// @param deadline Latest valid Unix timestamp supplied by the buyer.
    error DeadlinePassed(uint256 deadline);
    /// @notice Thrown when the Strategy holds no USDG after pulling its currently released Resonance revenue.
    error EmptyRevenue();
    /// @notice Thrown when the configured auction duration is outside its immutable bounds.
    /// @param duration Invalid duration in seconds.
    error EpochDurationOutOfRange(uint256 duration);
    /// @notice Thrown when the caller's expected auction epoch differs from the active epoch.
    /// @param expected Epoch identifier supplied by the buyer.
    /// @param actual Active epoch identifier at execution.
    error EpochIdMismatch(uint256 expected, uint256 actual);
    /// @notice Thrown when the configured initial price is below the configured floor or above the absolute maximum.
    /// @param price Invalid starting price in raw payment-token units.
    error InitialPriceOutOfRange(uint256 price);
    /// @notice Thrown when the current Dutch-auction payment exceeds the caller's slippage ceiling.
    /// @param payment Required raw payment-token units at execution.
    /// @param maximum Maximum raw payment-token units authorized by the buyer.
    error MaximumPaymentExceeded(uint256 payment, uint256 maximum);
    /// @notice Thrown when the configured minimum next-auction price is outside its absolute bounds.
    /// @param price Invalid floor in raw payment-token units.
    error MinimumPriceOutOfRange(uint256 price);
    /// @notice Thrown when the configured next-price multiplier is outside its immutable bounds.
    /// @param multiplier Invalid multiplier scaled by `PRICE_SCALE`.
    error PriceMultiplierOutOfRange(uint256 multiplier);
    /// @notice Thrown for a zero or codeless constructor dependency, zero revenue receiver, or missing BribeRouter.
    error ZeroAddress();

    /// @notice Creates one Strategy and starts its zero-based first auction epoch immediately.
    /// @dev All address dependencies must be nonzero deployed contracts. Configuration validation enforces duration,
    ///      multiplier, minimum-price, and absolute-price bounds; `initialPrice` must be at least `minimumPrice`.
    /// @param resonance_ Resonance that releases USDG and provides split and BribeRouter configuration.
    /// @param usdg_ USDG revenue token sold by this Strategy.
    /// @param paymentToken_ ERC-20 asset buyers pay to fill this Strategy.
    /// @param fund_ Treasury receiving the non-Bribe share of every auction payment.
    /// @param config Immutable auction configuration expressed in seconds, raw payment units, and fixed-point scale.
    constructor(address resonance_, IERC20 usdg_, IERC20 paymentToken_, address fund_, Config memory config) {
        if (
            resonance_ == address(0) || address(usdg_) == address(0) || address(paymentToken_) == address(0)
                || fund_ == address(0) || resonance_.code.length == 0 || address(usdg_).code.length == 0
                || address(paymentToken_).code.length == 0 || fund_.code.length == 0
        ) revert ZeroAddress();
        if (config.initialPrice < config.minimumPrice || config.initialPrice > ABSOLUTE_MAXIMUM_PRICE) {
            revert InitialPriceOutOfRange(config.initialPrice);
        }
        if (config.epochDuration < MIN_EPOCH_DURATION || config.epochDuration > MAX_EPOCH_DURATION) {
            revert EpochDurationOutOfRange(config.epochDuration);
        }
        if (config.priceMultiplier < MIN_PRICE_MULTIPLIER || config.priceMultiplier > MAX_PRICE_MULTIPLIER) {
            revert PriceMultiplierOutOfRange(config.priceMultiplier);
        }
        if (config.minimumPrice < ABSOLUTE_MINIMUM_PRICE || config.minimumPrice > ABSOLUTE_MAXIMUM_PRICE) {
            revert MinimumPriceOutOfRange(config.minimumPrice);
        }
        resonance = resonance_;
        usdg = usdg_;
        paymentToken = paymentToken_;
        fund = fund_;
        epochDuration = config.epochDuration;
        priceMultiplier = config.priceMultiplier;
        minimumPrice = config.minimumPrice;
        initialPrice = config.initialPrice;
        epochStartedAt = block.timestamp;
    }

    /// @notice Purchases all released and directly held Strategy USDG at the current declining price.
    /// @dev Permissionless. Snapshots Resonance's prospective Bribe share before token interaction, then checkpoints
    ///      and pulls this Strategy's released USDG. The resulting complete USDG balance is fixed before payment is
    ///      collected, which also keeps a Strategy priced in USDG from co-mingling payment with purchased revenue.
    ///      The Bribe share is `floor(paymentAmount * bribeBps / BPS)` and the Fund receives the remainder, so split
    ///      rounding favors Fund. A zero price after full decay skips payment collection, payment settlement, and
    ///      BribeRouter interaction. All transfers, auction-state updates, and the event are atomic. Reverts for a zero
    ///      receiver, expired deadline, stale epoch, empty USDG balance, payment above `maximumPayment`, a missing
    ///      BribeRouter when the floored Bribe amount is nonzero, or a failed token operation. Emits `Purchased` after
    ///      the next epoch is initialized.
    /// @param revenueReceiver Address that receives the complete snapshotted USDG balance; need not equal the buyer.
    /// @param expectedEpochId Active epoch expected by the buyer, protecting against a prior fill.
    /// @param deadline Latest valid Unix timestamp; execution exactly at this timestamp is allowed.
    /// @param maximumPayment Maximum raw payment-token units authorized by the buyer.
    /// @return paymentAmount Actual raw payment-token units required at execution, possibly zero.
    function buy(address revenueReceiver, uint256 expectedEpochId, uint256 deadline, uint256 maximumPayment)
        external
        nonReentrant
        returns (uint256 paymentAmount)
    {
        if (revenueReceiver == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert DeadlinePassed(deadline);
        if (expectedEpochId != epochId) revert EpochIdMismatch(expectedEpochId, epochId);

        // Fix the prospective split before either token can invoke a callback, including a self-priced Strategy.
        IResonance configuredResonance = IResonance(resonance);
        uint256 appliedBribeBps = configuredResonance.bribeBps();

        // Make the purchase include every USDG unit released to this Strategy through the execution timestamp.
        configuredResonance.distributeRevenue(address(this));
        uint256 revenueAmount = usdg.balanceOf(address(this));
        if (revenueAmount == 0) revert EmptyRevenue();

        paymentAmount = currentPrice();
        if (paymentAmount > maximumPayment) revert MaximumPaymentExceeded(paymentAmount, maximumPayment);

        if (paymentAmount != 0) {
            paymentToken.safeTransferFrom(msg.sender, address(this), paymentAmount);
            _settlePayment(configuredResonance, paymentAmount, appliedBribeBps);
        }

        usdg.safeTransfer(revenueReceiver, revenueAmount);

        uint256 completedEpoch = epochId;
        initialPrice = _nextInitialPrice(paymentAmount);
        epochStartedAt = block.timestamp;
        epochId = completedEpoch + 1;

        emit Purchased(msg.sender, revenueReceiver, completedEpoch, revenueAmount, paymentAmount);
    }

    /// @notice Returns the payment required to fill the active auction epoch at the current timestamp.
    /// @dev Before full decay, subtracts the floored elapsed-price fraction from `initialPrice`, which rounds the exact
    ///      remaining-fraction price up to a whole raw token unit. Returns zero at and after `epochDuration` seconds.
    /// @return paymentAmount Current price in raw payment-token units.
    function currentPrice() public view returns (uint256 paymentAmount) {
        uint256 elapsed = block.timestamp - epochStartedAt;
        if (elapsed >= epochDuration) return 0;
        return initialPrice - Math.mulDiv(initialPrice, elapsed, epochDuration);
    }

    /// @notice Splits one collected payment between Fund and the paired BribeRouter.
    /// @dev Computes the Bribe share with downward rounding and sends the exact remainder to Fund. A zero Bribe share
    ///      avoids the Router lookup and transfer. This helper does not call `BribeRouter.route`; rewards remain
    ///      buffered for a separate permissionless transaction. Any failure reverts the complete purchase atomically.
    /// @param configuredResonance Resonance used to resolve this Strategy's paired BribeRouter.
    /// @param paymentAmount Total raw payment-token units collected from the buyer.
    /// @param appliedBribeBps Global Bribe share snapshotted before either token can invoke a callback.
    function _settlePayment(IResonance configuredResonance, uint256 paymentAmount, uint256 appliedBribeBps) private {
        uint256 bribeAmount = Math.mulDiv(paymentAmount, appliedBribeBps, BPS);
        uint256 fundAmount = paymentAmount - bribeAmount;

        if (fundAmount != 0) paymentToken.safeTransfer(fund, fundAmount);
        if (bribeAmount == 0) return;

        address router = configuredResonance.bribeRouterFor(address(this));
        if (router == address(0)) revert ZeroAddress();
        paymentToken.safeTransfer(router, bribeAmount);
    }

    /// @notice Computes the next auction epoch's bounded starting price.
    /// @dev Calculates `floor(paymentAmount * priceMultiplier / PRICE_SCALE)`, then applies
    ///      `ABSOLUTE_MAXIMUM_PRICE` as a cap and `minimumPrice` as a floor. A free fill restarts at the floor.
    /// @param paymentAmount Raw payment-token units collected for the completed epoch.
    /// @return nextPrice Raw payment-token units at which the next epoch starts.
    function _nextInitialPrice(uint256 paymentAmount) private view returns (uint256 nextPrice) {
        nextPrice = Math.mulDiv(paymentAmount, priceMultiplier, PRICE_SCALE);
        if (nextPrice > ABSOLUTE_MAXIMUM_PRICE) return ABSOLUTE_MAXIMUM_PRICE;
        if (nextPrice < minimumPrice) return minimumPrice;
    }
}
