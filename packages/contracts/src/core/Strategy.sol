// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IResonance } from "./interfaces/IResonance.sol";

/// @title GumBall6900 Reverse Dutch Strategy
/// @notice Reverse Dutch auction that sells accumulated USDG for a configured payment asset.
/// @dev The auction design is adapted with credit to Euler Fee Flow and Liquid Signal Governance. Price falls linearly
///      to zero, then the next auction starts from the previous payment multiplied within immutable bounds.
contract Strategy is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Immutable auction parameters validated at Strategy creation.
    /// @param initialPrice First epoch's starting payment-token amount.
    /// @param epochDuration Seconds over which the price linearly decays to zero.
    /// @param priceMultiplier Fixed-point multiplier applied to the previous clearing payment.
    /// @param minimumPrice Floor for the next epoch's starting payment, not a fill-time price floor.
    struct Config {
        uint256 initialPrice;
        uint256 epochDuration;
        uint256 priceMultiplier;
        uint256 minimumPrice;
    }

    /// @notice Shortest permitted price-decay period.
    uint256 public constant MIN_EPOCH_DURATION = 1 hours;
    /// @notice Longest permitted price-decay period.
    uint256 public constant MAX_EPOCH_DURATION = 365 days;
    /// @notice Smallest multiplier permitted for the next starting price.
    uint256 public constant MIN_PRICE_MULTIPLIER = 1.1e18;
    /// @notice Largest multiplier permitted for the next starting price.
    uint256 public constant MAX_PRICE_MULTIPLIER = 3e18;
    /// @notice Absolute lower bound for a configured minimum price.
    uint256 public constant ABSOLUTE_MINIMUM_PRICE = 1e6;
    /// @notice Absolute upper bound for a starting or minimum price.
    uint256 public constant ABSOLUTE_MAXIMUM_PRICE = type(uint192).max;
    /// @notice Fixed-point precision for the next-price multiplier.
    uint256 public constant PRICE_SCALE = 1e18;
    /// @notice Basis-point denominator used for the acquired-payment split.
    uint256 public constant BPS = 10_000;
    /// @notice Resonance that supplies the paired BribeRouter.
    address public immutable resonance;
    /// @notice USDG sold by this Strategy.
    IERC20 public immutable usdg;
    /// @notice Asset required from a buyer.
    IERC20 public immutable paymentToken;
    /// @notice Treasury that receives the non-Bribe share of every auction payment.
    address public immutable fund;
    /// @notice Number of seconds over which price declines to zero.
    uint256 public immutable epochDuration;
    /// @notice Fixed-point multiplier applied to a completed epoch's payment.
    uint256 public immutable priceMultiplier;
    /// @notice Floor applied to the next epoch's starting price.
    uint256 public immutable minimumPrice;

    /// @notice Current auction epoch identifier.
    uint256 public epochId;
    /// @notice Price at the beginning of the active epoch.
    uint256 public initialPrice;
    /// @notice Timestamp at which the active epoch began.
    uint256 public epochStartedAt;

    /// @notice Emitted after a buyer fills one auction epoch.
    /// @param buyer Account that supplied the payment asset.
    /// @param revenueReceiver Address that received the Strategy's USDG.
    /// @param epochId Completed auction epoch.
    /// @param revenueAmount Amount of USDG purchased.
    /// @param paymentAmount Amount paid for the USDG.
    event Purchased(
        address indexed buyer,
        address indexed revenueReceiver,
        uint256 indexed epochId,
        uint256 revenueAmount,
        uint256 paymentAmount
    );

    /// @notice The caller-supplied purchase deadline has passed.
    error DeadlinePassed(uint256 deadline);
    /// @notice A purchase was attempted while the Strategy held no USDG revenue.
    error EmptyRevenue();
    /// @notice The configured auction duration is outside immutable safety bounds.
    error EpochDurationOutOfRange(uint256 duration);
    /// @notice The caller's expected auction epoch differs from current state.
    error EpochIdMismatch(uint256 expected, uint256 actual);
    /// @notice The configured initial auction price is outside immutable safety bounds.
    error InitialPriceOutOfRange(uint256 price);
    /// @notice The current Dutch-auction payment exceeds the caller's slippage ceiling.
    error MaximumPaymentExceeded(uint256 payment, uint256 maximum);
    /// @notice The configured minimum next-auction price is outside immutable safety bounds.
    error MinimumPriceOutOfRange(uint256 price);
    /// @notice The configured next-price multiplier is outside immutable safety bounds.
    error PriceMultiplierOutOfRange(uint256 multiplier);
    /// @notice A required deployment address is zero.
    error ZeroAddress();

    /// @notice Creates one immutable Strategy.
    /// @param resonance_ Resonance that provides the paired BribeRouter.
    /// @param usdg_ USDG token sold by this Strategy.
    /// @param paymentToken_ Asset buyers pay to fill this Strategy.
    /// @param fund_ Treasury that receives the non-Bribe share of every auction payment.
    /// @param config Immutable auction configuration.
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

    /// @notice Purchases the Strategy's complete USDG balance at the current declining price.
    /// @param revenueReceiver Address that receives the accumulated USDG.
    /// @param expectedEpochId Expected epoch, protecting the buyer from another fill changing the price first.
    /// @param deadline Latest timestamp at which this transaction may execute.
    /// @param maximumPayment Maximum payment accepted by the buyer.
    /// @return paymentAmount Actual payment required at execution time.
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

    /// @notice Returns the current linearly declining price.
    /// @return paymentAmount Payment required to fill the active auction epoch.
    function currentPrice() public view returns (uint256 paymentAmount) {
        uint256 elapsed = block.timestamp - epochStartedAt;
        if (elapsed >= epochDuration) return 0;
        return initialPrice - Math.mulDiv(initialPrice, elapsed, epochDuration);
    }

    /// @notice Splits one payment between Fund and the paired BribeRouter at the captured global Bribe share.
    /// @param configuredResonance Resonance that supplies the paired BribeRouter.
    /// @param paymentAmount Total payment collected from the buyer.
    /// @param appliedBribeBps Prospective global Bribe share captured before payment-token interaction.
    function _settlePayment(IResonance configuredResonance, uint256 paymentAmount, uint256 appliedBribeBps) private {
        uint256 bribeAmount = Math.mulDiv(paymentAmount, appliedBribeBps, BPS);
        uint256 fundAmount = paymentAmount - bribeAmount;

        if (fundAmount != 0) paymentToken.safeTransfer(fund, fundAmount);
        if (bribeAmount == 0) return;

        address router = configuredResonance.bribeRouterFor(address(this));
        if (router == address(0)) revert ZeroAddress();
        paymentToken.safeTransfer(router, bribeAmount);
    }

    /// @notice Computes the next auction's bounded starting price.
    /// @dev Uses the completed payment, configured multiplier, floor, and absolute cap.
    /// @param paymentAmount Payment collected for the completed epoch.
    /// @return nextPrice Starting price for the next epoch.
    function _nextInitialPrice(uint256 paymentAmount) private view returns (uint256 nextPrice) {
        nextPrice = Math.mulDiv(paymentAmount, priceMultiplier, PRICE_SCALE);
        if (nextPrice > ABSOLUTE_MAXIMUM_PRICE) return ABSOLUTE_MAXIMUM_PRICE;
        if (nextPrice < minimumPrice) return minimumPrice;
    }
}
