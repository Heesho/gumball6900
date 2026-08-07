// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { BribeRouter } from "./BribeRouter.sol";
import { ICoreVoter } from "./interfaces/ICoreVoter.sol";
import { IFund } from "./interfaces/IFund.sol";

/// @title Strategy
/// @author GUM BALL 6900
/// @notice Reverse Dutch auction that sells accumulated USDG for a configured asset or for GBX buybacks.
/// @dev The auction design is adapted with credit to Euler Fee Flow and Liquid Signal Governance. Price falls linearly
///      to zero, then the next auction starts from the previous payment multiplied within immutable bounds.
contract Strategy is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Kind {
        Acquisition,
        Buyback
    }

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
    /// @notice Basis-point denominator used for the acquisition payment split.
    uint256 public constant BPS_SCALE = 10_000;

    /// @notice Voter that supplies the current bribe share and paired BribeRouter.
    address public immutable voter;
    /// @notice USDG sold by this Strategy.
    IERC20 public immutable revenueToken;
    /// @notice Asset required from a buyer.
    IERC20 public immutable paymentToken;
    /// @notice Treasury that receives acquisition proceeds or buyback GBX.
    address public immutable fund;
    /// @notice Whether this Strategy performs an acquisition or GBX buyback.
    Kind public immutable kind;
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

    error DeadlinePassed(uint256 deadline);
    error EmptyRevenue();
    error EpochDurationOutOfRange(uint256 duration);
    error EpochIdMismatch(uint256 expected, uint256 actual);
    error InexactPayment(uint256 expected, uint256 received);
    error InitialPriceOutOfRange(uint256 price);
    error InvalidBuybackToken(address token);
    error MaximumPaymentExceeded(uint256 payment, uint256 maximum);
    error MinimumPriceOutOfRange(uint256 price);
    error PriceMultiplierOutOfRange(uint256 multiplier);
    error ZeroAddress();

    /// @notice Creates one immutable acquisition or buyback Strategy.
    /// @param voter_ Voter that provides the reward share and paired BribeRouter.
    /// @param revenueToken_ USDG token sold by this Strategy.
    /// @param paymentToken_ Asset buyers pay to fill this Strategy.
    /// @param fund_ Treasury receiving acquisition payments or buyback GBX.
    /// @param kind_ Whether this Strategy acquires an asset or performs GBX buybacks.
    /// @param config Immutable auction configuration.
    constructor(
        address voter_,
        IERC20 revenueToken_,
        IERC20 paymentToken_,
        address fund_,
        Kind kind_,
        Config memory config
    ) {
        if (
            voter_ == address(0) || address(revenueToken_) == address(0) || address(paymentToken_) == address(0)
                || fund_ == address(0) || voter_.code.length == 0 || address(revenueToken_).code.length == 0
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
        if (kind_ == Kind.Buyback && IFund(fund_).gbx() != address(paymentToken_)) {
            revert InvalidBuybackToken(address(paymentToken_));
        }

        voter = voter_;
        revenueToken = revenueToken_;
        paymentToken = paymentToken_;
        fund = fund_;
        kind = kind_;
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

        uint256 revenueAmount = revenueToken.balanceOf(address(this));
        if (revenueAmount == 0) revert EmptyRevenue();

        paymentAmount = currentPrice();
        if (paymentAmount > maximumPayment) revert MaximumPaymentExceeded(paymentAmount, maximumPayment);

        if (paymentAmount != 0) {
            uint256 paymentBalanceBefore = paymentToken.balanceOf(address(this));
            paymentToken.safeTransferFrom(msg.sender, address(this), paymentAmount);
            uint256 received = paymentToken.balanceOf(address(this)) - paymentBalanceBefore;
            if (received != paymentAmount) revert InexactPayment(paymentAmount, received);

            if (kind == Kind.Buyback) {
                _executeBuyback(paymentAmount);
            } else {
                _settleAcquisition(paymentAmount);
            }
        }

        revenueToken.safeTransfer(revenueReceiver, revenueAmount);

        uint256 completedEpoch = epochId;
        initialPrice = _nextInitialPrice(paymentAmount);
        epochStartedAt = block.timestamp;
        unchecked {
            epochId = completedEpoch + 1;
        }

        emit Purchased(msg.sender, revenueReceiver, completedEpoch, revenueAmount, paymentAmount);
    }

    /// @notice Returns USDG currently available for purchase.
    /// @return amount USDG currently held by this Strategy.
    function availableRevenue() external view returns (uint256 amount) {
        return revenueToken.balanceOf(address(this));
    }

    /// @notice Returns the current linearly declining price.
    /// @return price Payment required to fill the active auction epoch.
    function currentPrice() public view returns (uint256 price) {
        uint256 elapsed = block.timestamp - epochStartedAt;
        if (elapsed >= epochDuration) return 0;
        return initialPrice - Math.mulDiv(initialPrice, elapsed, epochDuration);
    }

    /// @notice Settles an acquisition payment between Fund and voters.
    /// @dev Splits the payment using Voter's current governance-bounded share.
    /// @param paymentAmount Total payment collected from the buyer.
    function _settleAcquisition(uint256 paymentAmount) private {
        uint256 bribeAmount = Math.mulDiv(paymentAmount, ICoreVoter(voter).bribeBps(), BPS_SCALE);
        uint256 fundAmount = paymentAmount - bribeAmount;

        if (fundAmount != 0) paymentToken.safeTransfer(fund, fundAmount);
        if (bribeAmount == 0) return;

        address router = ICoreVoter(voter).bribeRouterFor(address(this));
        if (router == address(0)) revert ZeroAddress();

        paymentToken.forceApprove(router, bribeAmount);
        BribeRouter(router).routeRewards(bribeAmount);
        paymentToken.forceApprove(router, 0);
    }

    /// @notice Settles a buyback by sending purchased GBX to Fund and burning it.
    /// @dev Transfer and burn occur atomically in the same fill transaction.
    /// @param paymentAmount GBX collected from the buyer.
    function _executeBuyback(uint256 paymentAmount) private {
        paymentToken.safeTransfer(fund, paymentAmount);
        IFund(fund).burnGBX(paymentAmount);
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
