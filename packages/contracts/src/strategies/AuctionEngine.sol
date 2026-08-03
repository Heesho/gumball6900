// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

/// @title AuctionEngine
/// @notice GBX-owned clean adaptation of the pinned give.fun Auction transition and rounding order.
/// @dev Legal provenance remains unresolved in NOTICE; this file does not claim upstream audit coverage.
abstract contract AuctionEngine {
    /// @notice Smallest permitted auction duration.
    uint256 public constant MIN_EPOCH_PERIOD = 1 hours;
    /// @notice Largest permitted auction duration.
    uint256 public constant MAX_EPOCH_PERIOD = 365 days;
    /// @notice Smallest permitted next-price multiplier.
    uint256 public constant MIN_PRICE_MULTIPLIER = 1.1e18;
    /// @notice Largest permitted next-price multiplier.
    uint256 public constant MAX_PRICE_MULTIPLIER = 3e18;
    /// @notice Absolute minimum permitted price floor.
    uint256 public constant ABS_MIN_INIT_PRICE = 1e6;
    /// @notice Absolute maximum permitted initial price.
    uint256 public constant ABS_MAX_INIT_PRICE = type(uint192).max;
    /// @notice Fixed-point denominator used for the next-price multiplier.
    uint256 public constant PRECISION = 1e18;

    /// @notice Fixed duration of each auction epoch.
    uint256 public immutable epochPeriod;
    /// @notice Fixed multiplier applied to a filled epoch's quoted payment.
    uint256 public immutable priceMultiplier;
    /// @notice Configured lower bound for each next initial price.
    uint256 public immutable minInitPrice;

    /// @notice Identifier of the active auction epoch.
    uint256 public epochId;
    /// @notice Starting price of the active auction epoch.
    uint256 public initPrice;
    /// @notice Timestamp at which the active auction epoch began.
    uint256 public startTime;

    error AuctionEngine__AlreadyActivated();
    error AuctionEngine__DeadlinePassed();
    error AuctionEngine__EpochIdMismatch();
    error AuctionEngine__EpochPeriodOutOfRange();
    error AuctionEngine__InitPriceOutOfRange();
    error AuctionEngine__MaxPaymentAmountExceeded();
    error AuctionEngine__MinInitPriceOutOfRange();
    error AuctionEngine__NotActivated();
    error AuctionEngine__PriceMultiplierOutOfRange();

    /// @notice Configures a bounded reverse Dutch auction for later registry-authorized activation.
    constructor(uint256 initPrice_, uint256 epochPeriod_, uint256 priceMultiplier_, uint256 minInitPrice_) {
        if (initPrice_ < minInitPrice_ || initPrice_ > ABS_MAX_INIT_PRICE) {
            revert AuctionEngine__InitPriceOutOfRange();
        }
        if (epochPeriod_ < MIN_EPOCH_PERIOD || epochPeriod_ > MAX_EPOCH_PERIOD) {
            revert AuctionEngine__EpochPeriodOutOfRange();
        }
        if (priceMultiplier_ < MIN_PRICE_MULTIPLIER || priceMultiplier_ > MAX_PRICE_MULTIPLIER) {
            revert AuctionEngine__PriceMultiplierOutOfRange();
        }
        if (minInitPrice_ < ABS_MIN_INIT_PRICE || minInitPrice_ > ABS_MAX_INIT_PRICE) {
            revert AuctionEngine__MinInitPriceOutOfRange();
        }

        initPrice = initPrice_;
        epochPeriod = epochPeriod_;
        priceMultiplier = priceMultiplier_;
        minInitPrice = minInitPrice_;
    }

    /// @notice Exact give.fun order: branch only after E; arithmetic itself yields zero at E.
    function getPrice() public view returns (uint256) {
        if (startTime == 0) revert AuctionEngine__NotActivated();
        uint256 timePassed = block.timestamp - startTime;
        if (timePassed > epochPeriod) return 0;
        return initPrice - initPrice * timePassed / epochPeriod;
    }

    function _quoteFill(uint256 expectedEpochId, uint256 deadline, uint256 maxPaymentAmount)
        internal
        view
        returns (uint256 paymentAmount)
    {
        if (block.timestamp > deadline) revert AuctionEngine__DeadlinePassed();
        if (expectedEpochId != epochId) revert AuctionEngine__EpochIdMismatch();
        paymentAmount = getPrice();
        if (paymentAmount > maxPaymentAmount) revert AuctionEngine__MaxPaymentAmountExceeded();
    }

    /// @dev Uses the quoted payment, not an observed token delta, exactly like the authoritative transition.
    function _advanceAuction(uint256 paymentAmount) internal {
        if (startTime == 0) revert AuctionEngine__NotActivated();
        uint256 newInitPrice = paymentAmount * priceMultiplier / PRECISION;
        if (newInitPrice > ABS_MAX_INIT_PRICE) {
            newInitPrice = ABS_MAX_INIT_PRICE;
        } else if (newInitPrice < minInitPrice) {
            newInitPrice = minInitPrice;
        }
        unchecked {
            ++epochId;
        }
        initPrice = newInitPrice;
        startTime = block.timestamp;
    }

    /// @dev Called once by the concrete strategy's registry-authorized activation entrypoint.
    function _activateAuction() internal {
        if (startTime != 0) revert AuctionEngine__AlreadyActivated();
        if (block.timestamp == 0) revert AuctionEngine__NotActivated();
        startTime = block.timestamp;
    }
}
