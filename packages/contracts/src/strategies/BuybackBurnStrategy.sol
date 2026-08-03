// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IBuybackAllocationVoter } from "../interfaces/IBuybackAllocationVoter.sol";
import { IGBXToken } from "../interfaces/IGBXToken.sol";
import { IGumBallVault } from "../interfaces/IGumBallVault.sol";
import { RateMath } from "../libraries/RateMath.sol";

/// @title BuybackBurnStrategy
/// @notice Oracleless bounded reverse Dutch auction that accepts GBX for USDG and performs a real supply burn.
contract BuybackBurnStrategy is ReentrancyGuard {
    using SafeERC20 for IGBXToken;

    /// @notice Human-normalized auction-rate precision.
    uint256 public constant RATE_PRECISION = 1e18;
    /// @notice Basis-point denominator used by immutable auction ratios.
    uint256 public constant BPS_DENOMINATOR = 10_000;
    /// @notice Duration of each linearly decaying reverse Dutch auction.
    uint256 public constant AUCTION_DURATION = 1 days;
    /// @notice Auction starting rate as basis points of its reference rate.
    uint256 public constant START_RATE_BPS = 12_500;
    /// @notice Auction floor rate as basis points of its reference rate.
    uint256 public constant FLOOR_RATE_BPS = 8_000;
    /// @notice Smallest timelocked reset relative to the prior reference rate.
    uint256 public constant MIN_REFERENCE_RESET_BPS = 5_000;
    /// @notice Largest timelocked reset relative to the prior reference rate.
    uint256 public constant MAX_REFERENCE_RESET_BPS = 20_000;
    /// @notice Largest reference rate accepted by any auction.
    /// @dev Keeping the live rate at or below half of uint256 leaves room for the 200% reset bound.
    uint256 public constant MAX_REFERENCE_RATE = type(uint256).max / 2;

    error BuybackBurnStrategy__AuctionExpired(uint64 auctionId);
    error BuybackBurnStrategy__AuctionNotExpired(uint64 auctionId);
    error BuybackBurnStrategy__DeadlineExpired(uint256 deadline);
    error BuybackBurnStrategy__DecimalsChanged(
        uint8 expectedUSDG, uint8 actualUSDG, uint8 expectedGBX, uint8 actualGBX
    );
    error BuybackBurnStrategy__FillsPaused();
    error BuybackBurnStrategy__InactiveStrategy();
    error BuybackBurnStrategy__InsufficientBudget(uint256 requested, uint256 available);
    error BuybackBurnStrategy__InvalidLotBounds();
    error BuybackBurnStrategy__InvalidRate();
    error BuybackBurnStrategy__UnsupportedDecimals(uint8 usdGDecimals, uint8 gbxDecimals);
    error BuybackBurnStrategy__MaxGBXExceeded(uint256 required, uint256 maximum);
    error BuybackBurnStrategy__NotEmergencyGuardian(address caller);
    error BuybackBurnStrategy__NotProtocolTimelock(address caller);
    error BuybackBurnStrategy__ReferenceResetOutOfBounds(uint256 proposed, uint256 minimum, uint256 maximum);
    error BuybackBurnStrategy__StaleAuctionId(uint64 expected, uint64 actual);
    error BuybackBurnStrategy__UnderpaidGBX(uint256 required, uint256 received);
    error BuybackBurnStrategy__ZeroAddress();
    error BuybackBurnStrategy__ZeroReceiver();

    event BuybackBurnStrategy__AuctionStarted(
        uint64 indexed auctionId, uint256 referenceRate, uint256 startRate, uint256 floorRate, uint256 startTime
    );
    event BuybackBurnStrategy__FillPauseSet(bool paused);
    event BuybackBurnStrategy__GBXBoughtAndBurned(
        uint64 indexed auctionId,
        address indexed taker,
        address indexed usdGReceiver,
        uint256 usdGSpent,
        uint256 gbxBurned,
        uint256 clearingRate,
        uint256 totalSupplyAfter
    );
    event BuybackBurnStrategy__ReferenceRateReset(uint256 previousRate, uint256 newRate, uint64 indexed auctionId);

    /// @notice Canonical GBX collected from takers and irreversibly burned before USDG release.
    IGBXToken public immutable GBX;
    /// @notice Canonical vault releasing budgeted USDG only after the GBX burn.
    IGumBallVault public immutable GUM_BALL_VAULT;
    /// @notice Canonical voter supplying this strategy's virtual USDG budget.
    IBuybackAllocationVoter public immutable ALLOCATION_VOTER;
    /// @notice Canonical registry whose live status gates every fill.
    IAssetRegistry public immutable ASSET_REGISTRY;
    /// @notice Delayed authority permitted to reset stale rates and resume fills.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Stop-only authority permitted to pause new fills.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice Smallest raw USDG amount accepted by a fill.
    uint256 public immutable MINIMUM_LOT_USDG;
    /// @notice Largest raw USDG amount accepted by a fill.
    uint256 public immutable MAXIMUM_LOT_USDG;
    /// @notice Immutable decimal count of canonical USDG.
    uint8 public immutable USDG_DECIMALS;
    /// @notice Immutable decimal count of GBX.
    uint8 public immutable GBX_DECIMALS;

    /// @notice Whether the guardian has temporarily stopped new buyback fills.
    bool public fillsPaused;
    /// @notice Monotonic identifier of the currently active buyback auction.
    uint64 public auctionId;
    /// @notice Start timestamp of the currently active buyback auction.
    uint64 public auctionStartTime;
    /// @notice Human GBX-per-USDG rate anchoring the current auction, scaled by 1e18.
    uint256 public referenceRate;
    /// @notice Human GBX-per-USDG rate at the current auction start, scaled by 1e18.
    uint256 public startRate;
    /// @notice Human GBX-per-USDG rate at and after current auction expiry, scaled by 1e18.
    uint256 public floorRate;

    /// @notice Starts the first buyback auction with immutable custody and maintenance boundaries.
    /// @param gbx_ The canonical GBX token collected and irreversibly burned on every fill.
    /// @param gumBallVault_ The canonical vault that releases budgeted USDG only after the burn.
    /// @param allocationVoter_ The canonical source of this strategy's virtual USDG budget.
    /// @param assetRegistry_ The canonical registry whose live status gates fills.
    /// @param protocolTimelock_ The delayed authority permitted to unpause fills and reset stale rates.
    /// @param emergencyGuardian_ The stop-only authority permitted to pause fills.
    /// @param minimumLotUSDG_ The smallest raw USDG fill lot.
    /// @param maximumLotUSDG_ The largest raw USDG fill lot.
    /// @param initialReferenceRate_ The initial human GBX-per-USDG reference rate scaled by 1e18.
    constructor(
        address gbx_,
        address gumBallVault_,
        address allocationVoter_,
        address assetRegistry_,
        address protocolTimelock_,
        address emergencyGuardian_,
        uint256 minimumLotUSDG_,
        uint256 maximumLotUSDG_,
        uint256 initialReferenceRate_
    ) {
        if (
            gbx_ == address(0) || gumBallVault_ == address(0) || allocationVoter_ == address(0)
                || assetRegistry_ == address(0) || protocolTimelock_ == address(0) || emergencyGuardian_ == address(0)
        ) revert BuybackBurnStrategy__ZeroAddress();
        if (minimumLotUSDG_ == 0 || maximumLotUSDG_ < minimumLotUSDG_) {
            revert BuybackBurnStrategy__InvalidLotBounds();
        }
        if (initialReferenceRate_ == 0) revert BuybackBurnStrategy__InvalidRate();

        IGumBallVault vault = IGumBallVault(gumBallVault_);
        address usdG = address(vault.USDG());
        if (usdG == address(0) || usdG.code.length == 0 || gbx_.code.length == 0) {
            revert BuybackBurnStrategy__ZeroAddress();
        }
        uint8 usdGDecimals = IERC20Metadata(usdG).decimals();
        uint8 gbxDecimals = IERC20Metadata(gbx_).decimals();
        if (usdGDecimals > 18 || gbxDecimals > 18) {
            revert BuybackBurnStrategy__UnsupportedDecimals(usdGDecimals, gbxDecimals);
        }

        GBX = IGBXToken(gbx_);
        GUM_BALL_VAULT = vault;
        ALLOCATION_VOTER = IBuybackAllocationVoter(allocationVoter_);
        ASSET_REGISTRY = IAssetRegistry(assetRegistry_);
        PROTOCOL_TIMELOCK = protocolTimelock_;
        EMERGENCY_GUARDIAN = emergencyGuardian_;
        MINIMUM_LOT_USDG = minimumLotUSDG_;
        MAXIMUM_LOT_USDG = maximumLotUSDG_;
        USDG_DECIMALS = usdGDecimals;
        GBX_DECIMALS = gbxDecimals;
        _startAuction(initialReferenceRate_);
    }

    /// @notice Fills a bounded lot, burns every observed GBX unit, and only then releases USDG.
    /// @param expectedAuctionId The current auction ID committed by the taker.
    /// @param usdGAmount The raw USDG amount requested from the strategy's virtual budget.
    /// @param maxGBXAmount The most raw GBX the taker permits the strategy to collect and burn.
    /// @param usdGReceiver The account that receives USDG after the GBX burn completes.
    /// @param deadline The final timestamp at which the taker accepts execution.
    /// @return gbxBurned The raw GBX balance increase observed and irreversibly burned.
    function fill(
        uint64 expectedAuctionId,
        uint256 usdGAmount,
        uint256 maxGBXAmount,
        address usdGReceiver,
        uint256 deadline
    ) external nonReentrant returns (uint256 gbxBurned) {
        if (fillsPaused) revert BuybackBurnStrategy__FillsPaused();
        if (!ASSET_REGISTRY.isLiveStrategy(address(this))) revert BuybackBurnStrategy__InactiveStrategy();
        if (expectedAuctionId != auctionId) {
            revert BuybackBurnStrategy__StaleAuctionId(expectedAuctionId, auctionId);
        }
        if (block.timestamp > deadline) revert BuybackBurnStrategy__DeadlineExpired(deadline);
        if (block.timestamp >= uint256(auctionStartTime) + AUCTION_DURATION) {
            revert BuybackBurnStrategy__AuctionExpired(auctionId);
        }
        if (usdGReceiver == address(0)) revert BuybackBurnStrategy__ZeroReceiver();
        if (usdGAmount < MINIMUM_LOT_USDG || usdGAmount > MAXIMUM_LOT_USDG) {
            revert BuybackBurnStrategy__InvalidLotBounds();
        }

        _requireStableDecimals();

        uint256 budget = ALLOCATION_VOTER.checkpointStrategyBudget(address(this));
        if (usdGAmount > budget) revert BuybackBurnStrategy__InsufficientBudget(usdGAmount, budget);

        uint256 rate = currentRate();
        uint256 requiredGBX = RateMath.quoteAssetAmount(usdGAmount, rate, USDG_DECIMALS, GBX_DECIMALS);
        if (requiredGBX > maxGBXAmount) revert BuybackBurnStrategy__MaxGBXExceeded(requiredGBX, maxGBXAmount);

        uint256 balanceBefore = GBX.balanceOf(address(this));
        GBX.safeTransferFrom(msg.sender, address(this), requiredGBX);
        gbxBurned = GBX.balanceOf(address(this)) - balanceBefore;
        if (gbxBurned < requiredGBX) revert BuybackBurnStrategy__UnderpaidGBX(requiredGBX, gbxBurned);

        uint64 filledAuctionId = auctionId;
        uint256 clearingRate = RateMath.clearingRateWad(gbxBurned, usdGAmount, USDG_DECIMALS, GBX_DECIMALS);
        _startAuction(clearingRate);

        GBX.burn(gbxBurned);
        GUM_BALL_VAULT.releaseUSDG(usdGReceiver, usdGAmount);
        _requireStableDecimals();

        emit BuybackBurnStrategy__GBXBoughtAndBurned(
            filledAuctionId, msg.sender, usdGReceiver, usdGAmount, gbxBurned, clearingRate, GBX.totalSupply()
        );
    }

    /// @notice Restarts an expired unfilled auction at unchanged bounds.
    function restartExpiredAuction() external {
        if (block.timestamp < uint256(auctionStartTime) + AUCTION_DURATION) {
            revert BuybackBurnStrategy__AuctionNotExpired(auctionId);
        }
        _startAuction(referenceRate);
    }

    function _requireStableDecimals() private view {
        uint8 liveUSDGDecimals = IERC20Metadata(address(GUM_BALL_VAULT.USDG())).decimals();
        uint8 liveGBXDecimals = IERC20Metadata(address(GBX)).decimals();
        if (liveUSDGDecimals != USDG_DECIMALS || liveGBXDecimals != GBX_DECIMALS) {
            revert BuybackBurnStrategy__DecimalsChanged(USDG_DECIMALS, liveUSDGDecimals, GBX_DECIMALS, liveGBXDecimals);
        }
    }

    /// @notice Resets a reference within immutable safety bounds around the timelock-reviewed baseline.
    /// @dev The current rate and auction expiry are intentionally not execution preconditions: fills and permissionless
    ///      restarts cannot censor a mature reset. Concurrent resets remain bounded to their supplied reviewed baselines.
    /// @param expectedReferenceRate The reference rate observed and committed when the operation was scheduled.
    /// @param newReferenceRate The reviewed human GBX-per-USDG reference rate scaled by 1e18.
    function resetReferenceRate(uint256 expectedReferenceRate, uint256 newReferenceRate) external nonReentrant {
        if (msg.sender != PROTOCOL_TIMELOCK) revert BuybackBurnStrategy__NotProtocolTimelock(msg.sender);
        uint256 minimum =
            Math.mulDiv(expectedReferenceRate, MIN_REFERENCE_RESET_BPS, BPS_DENOMINATOR, Math.Rounding.Ceil);
        uint256 maximum = expectedReferenceRate > MAX_REFERENCE_RATE / 2
            ? MAX_REFERENCE_RATE
            : Math.mulDiv(expectedReferenceRate, MAX_REFERENCE_RESET_BPS, BPS_DENOMINATOR);
        if (newReferenceRate < minimum || newReferenceRate > maximum) {
            revert BuybackBurnStrategy__ReferenceResetOutOfBounds(newReferenceRate, minimum, maximum);
        }
        uint256 previous = referenceRate;
        _startAuction(newReferenceRate);
        emit BuybackBurnStrategy__ReferenceRateReset(previous, newReferenceRate, auctionId);
    }

    /// @notice Pauses fills immediately without blocking burns, redemptions, claims, or unstaking elsewhere.
    function pauseFills() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert BuybackBurnStrategy__NotEmergencyGuardian(msg.sender);
        fillsPaused = true;
        emit BuybackBurnStrategy__FillPauseSet(true);
    }

    /// @notice Reopens fills only through the delayed protocol timelock.
    function unpauseFills() external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert BuybackBurnStrategy__NotProtocolTimelock(msg.sender);
        fillsPaused = false;
        emit BuybackBurnStrategy__FillPauseSet(false);
    }

    /// @notice Returns the nonzero human-normalized GBX per USDG rate, scaled by 1e18.
    /// @return rate The linearly decayed nonzero GBX-per-USDG auction rate scaled by 1e18.
    function currentRate() public view returns (uint256 rate) {
        uint256 elapsed = block.timestamp - uint256(auctionStartTime);
        if (elapsed >= AUCTION_DURATION) return floorRate;
        rate = startRate - Math.mulDiv(startRate - floorRate, elapsed, AUCTION_DURATION);
    }

    function _startAuction(uint256 newReferenceRate) private {
        if (newReferenceRate == 0 || newReferenceRate > MAX_REFERENCE_RATE) {
            revert BuybackBurnStrategy__InvalidRate();
        }
        referenceRate = newReferenceRate;
        startRate = Math.mulDiv(newReferenceRate, START_RATE_BPS, BPS_DENOMINATOR);
        floorRate = Math.mulDiv(newReferenceRate, FLOOR_RATE_BPS, BPS_DENOMINATOR);
        if (floorRate == 0) revert BuybackBurnStrategy__InvalidRate();
        auctionId += 1;
        auctionStartTime = SafeCast.toUint64(block.timestamp);
        emit BuybackBurnStrategy__AuctionStarted(auctionId, referenceRate, startRate, floorRate, block.timestamp);
    }
}
