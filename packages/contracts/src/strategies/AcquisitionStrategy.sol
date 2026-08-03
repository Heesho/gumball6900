// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IAcquisitionAllocationVoter } from "../interfaces/IAcquisitionAllocationVoter.sol";
import { IAssetRegistry } from "../interfaces/IAssetRegistry.sol";
import { IGumBallVault } from "../interfaces/IGumBallVault.sol";
import { IManagerRewards } from "../interfaces/IManagerRewards.sol";
import { RateMath } from "../libraries/RateMath.sol";

/// @title AcquisitionStrategy
/// @notice Oracleless reverse Dutch auction that exchanges bounded virtual USDG lots for one approved target asset.
/// @dev Target assets arrive and are fully distributed before GumBallVault releases any USDG.
contract AcquisitionStrategy is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Human-normalized auction-rate precision.
    uint256 public constant RATE_PRECISION = 1e18;
    /// @notice Basis-point denominator used by immutable auction and split ratios.
    uint256 public constant BPS_DENOMINATOR = 10_000;
    /// @notice Share of each observed target receipt sent to GumBallVault.
    uint256 public constant VAULT_BPS = 9_800;
    /// @notice Share of each observed target receipt sent to ManagerRewards.
    uint256 public constant MANAGER_REWARD_BPS = 200;
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

    error AcquisitionStrategy__AlreadyConfigured();
    error AcquisitionStrategy__AuctionExpired(uint64 auctionId);
    error AcquisitionStrategy__AuctionNotExpired(uint64 auctionId);
    error AcquisitionStrategy__DeadlineExpired(uint256 deadline);
    error AcquisitionStrategy__DecimalsChanged(
        uint8 expectedUSDG, uint8 actualUSDG, uint8 expectedTarget, uint8 actualTarget
    );
    error AcquisitionStrategy__FillsPaused();
    error AcquisitionStrategy__InactiveStrategy();
    error AcquisitionStrategy__InsufficientBudget(uint256 requested, uint256 available);
    error AcquisitionStrategy__InvalidLotBounds();
    error AcquisitionStrategy__InvalidRate();
    error AcquisitionStrategy__UnsupportedDecimals(uint8 usdGDecimals, uint8 targetDecimals);
    error AcquisitionStrategy__ManagerRewardsNotConfigured();
    error AcquisitionStrategy__MaxTargetExceeded(uint256 required, uint256 maximum);
    error AcquisitionStrategy__NotEmergencyGuardian(address caller);
    error AcquisitionStrategy__NotProtocolTimelock(address caller);
    /// @notice Reverts when distributing a fill removes a non-exact amount from this strategy.
    /// @param expected The observed target receipt that must leave the strategy.
    /// @param observed The strategy's actual target-token balance decrease during distribution.
    error AcquisitionStrategy__ObservedDebitMismatch(uint256 expected, uint256 observed);
    /// @notice Reverts when either observed distribution leg differs from the immutable 98/2 split.
    /// @param expectedVault The target amount the vault must receive.
    /// @param observedVault The vault's actual target-token balance increase.
    /// @param expectedManagers The target amount ManagerRewards must receive.
    /// @param observedManagers ManagerRewards' actual target-token balance increase.
    error AcquisitionStrategy__ObservedSplitMismatch(
        uint256 expectedVault, uint256 observedVault, uint256 expectedManagers, uint256 observedManagers
    );
    error AcquisitionStrategy__ReferenceResetOutOfBounds(uint256 proposed, uint256 minimum, uint256 maximum);
    error AcquisitionStrategy__StaleAuctionId(uint64 expected, uint64 actual);
    error AcquisitionStrategy__UnderpaidTarget(uint256 required, uint256 received);
    error AcquisitionStrategy__UnauthorizedInitializer(address caller);
    error AcquisitionStrategy__ZeroAddress();
    error AcquisitionStrategy__ZeroReceiver();

    event AcquisitionStrategy__AuctionStarted(
        uint64 indexed auctionId, uint256 referenceRate, uint256 startRate, uint256 floorRate, uint256 startTime
    );
    event AcquisitionStrategy__FillPauseSet(bool paused);
    event AcquisitionStrategy__Filled(
        uint64 indexed auctionId,
        address indexed taker,
        address indexed usdGReceiver,
        uint256 usdGAmount,
        uint256 targetReceived,
        uint256 vaultAmount,
        uint256 managerAmount,
        uint256 clearingRate
    );
    event AcquisitionStrategy__ManagerRewardsConfigured(address indexed managerRewards);
    event AcquisitionStrategy__ReferenceRateReset(uint256 previousRate, uint256 newRate, uint64 indexed auctionId);

    /// @notice Registered target asset delivered by takers and split between vault and managers.
    IERC20 public immutable TARGET_TOKEN;
    /// @notice Canonical vault receiving target assets and releasing budgeted USDG.
    IGumBallVault public immutable GUM_BALL_VAULT;
    /// @notice Canonical voter supplying this strategy's virtual USDG budget.
    IAcquisitionAllocationVoter public immutable ALLOCATION_VOTER;
    /// @notice Canonical registry whose live status gates every fill.
    IAssetRegistry public immutable ASSET_REGISTRY;
    /// @notice Delayed authority permitted to reset stale rates and resume fills.
    address public immutable PROTOCOL_TIMELOCK;
    /// @notice Stop-only authority permitted to pause new fills.
    address public immutable EMERGENCY_GUARDIAN;
    /// @notice One-use account permitted to bind this strategy's ManagerRewards contract.
    address public immutable DEPENDENCY_INITIALIZER;
    /// @notice Smallest raw USDG amount accepted by a fill.
    uint256 public immutable MINIMUM_LOT_USDG;
    /// @notice Largest raw USDG amount accepted by a fill.
    uint256 public immutable MAXIMUM_LOT_USDG;
    /// @notice Immutable decimal count of canonical USDG.
    uint8 public immutable USDG_DECIMALS;
    /// @notice Immutable decimal count of the target asset.
    uint8 public immutable TARGET_DECIMALS;

    /// @notice Strategy-specific accumulator receiving the 2% manager share.
    IManagerRewards public managerRewards;
    /// @notice Whether the guardian has temporarily stopped new auction fills.
    bool public fillsPaused;
    /// @notice Monotonic identifier of the currently active auction.
    uint64 public auctionId;
    /// @notice Start timestamp of the currently active auction.
    uint64 public auctionStartTime;
    /// @notice Human target-per-USDG rate anchoring the current auction, scaled by 1e18.
    uint256 public referenceRate;
    /// @notice Human target-per-USDG rate at the current auction start, scaled by 1e18.
    uint256 public startRate;
    /// @notice Human target-per-USDG rate at and after current auction expiry, scaled by 1e18.
    uint256 public floorRate;

    /// @notice Creates one strategy for one canonical target asset and starts its first nonzero auction.
    /// @param targetToken_ The registered target asset accepted from auction takers.
    /// @param gumBallVault_ The canonical vault receiving 98% of each observed fill and releasing USDG.
    /// @param allocationVoter_ The canonical source of this strategy's virtual USDG budget.
    /// @param assetRegistry_ The canonical registry whose live status gates fills.
    /// @param protocolTimelock_ The delayed authority permitted to unpause fills and reset stale rates.
    /// @param emergencyGuardian_ The stop-only authority permitted to pause fills.
    /// @param dependencyInitializer_ The one-use account permitted to bind ManagerRewards.
    /// @param minimumLotUSDG_ The smallest raw USDG fill lot.
    /// @param maximumLotUSDG_ The largest raw USDG fill lot.
    /// @param initialReferenceRate_ The initial human target-per-USDG reference rate scaled by 1e18.
    constructor(
        address targetToken_,
        address gumBallVault_,
        address allocationVoter_,
        address assetRegistry_,
        address protocolTimelock_,
        address emergencyGuardian_,
        address dependencyInitializer_,
        uint256 minimumLotUSDG_,
        uint256 maximumLotUSDG_,
        uint256 initialReferenceRate_
    ) {
        if (
            targetToken_ == address(0) || gumBallVault_ == address(0) || allocationVoter_ == address(0)
                || assetRegistry_ == address(0) || protocolTimelock_ == address(0) || emergencyGuardian_ == address(0)
                || dependencyInitializer_ == address(0)
        ) revert AcquisitionStrategy__ZeroAddress();
        if (minimumLotUSDG_ == 0 || maximumLotUSDG_ < minimumLotUSDG_) {
            revert AcquisitionStrategy__InvalidLotBounds();
        }
        if (initialReferenceRate_ == 0) revert AcquisitionStrategy__InvalidRate();

        IGumBallVault vault = IGumBallVault(gumBallVault_);
        address usdG = address(vault.USDG());
        if (usdG == address(0) || usdG.code.length == 0 || targetToken_.code.length == 0) {
            revert AcquisitionStrategy__ZeroAddress();
        }
        uint8 usdGDecimals = IERC20Metadata(usdG).decimals();
        uint8 targetDecimals = IERC20Metadata(targetToken_).decimals();
        if (usdGDecimals > 18 || targetDecimals > 18) {
            revert AcquisitionStrategy__UnsupportedDecimals(usdGDecimals, targetDecimals);
        }

        TARGET_TOKEN = IERC20(targetToken_);
        GUM_BALL_VAULT = vault;
        ALLOCATION_VOTER = IAcquisitionAllocationVoter(allocationVoter_);
        ASSET_REGISTRY = IAssetRegistry(assetRegistry_);
        PROTOCOL_TIMELOCK = protocolTimelock_;
        EMERGENCY_GUARDIAN = emergencyGuardian_;
        DEPENDENCY_INITIALIZER = dependencyInitializer_;
        MINIMUM_LOT_USDG = minimumLotUSDG_;
        MAXIMUM_LOT_USDG = maximumLotUSDG_;
        USDG_DECIMALS = usdGDecimals;
        TARGET_DECIMALS = targetDecimals;

        _startAuction(initialReferenceRate_);
    }

    /// @notice Wires the strategy-specific ManagerRewards accumulator exactly once.
    /// @param managerRewards_ The deployed accumulator for this strategy and target token.
    function initializeManagerRewards(address managerRewards_) external {
        if (msg.sender != DEPENDENCY_INITIALIZER) {
            revert AcquisitionStrategy__UnauthorizedInitializer(msg.sender);
        }
        if (address(managerRewards) != address(0)) revert AcquisitionStrategy__AlreadyConfigured();
        if (managerRewards_ == address(0) || managerRewards_.code.length == 0) {
            revert AcquisitionStrategy__ZeroAddress();
        }
        managerRewards = IManagerRewards(managerRewards_);
        emit AcquisitionStrategy__ManagerRewardsConfigured(managerRewards_);
    }

    /// @notice Fills a bounded USDG lot at the current linearly decaying target-token rate.
    /// @param expectedAuctionId The current auction ID committed by the taker.
    /// @param usdGAmount The raw USDG amount requested from the strategy's virtual budget.
    /// @param maxTargetAmount The most raw target tokens the taker permits the strategy to collect.
    /// @param usdGReceiver The account that receives USDG after target delivery and splitting complete.
    /// @param deadline The final timestamp at which the taker accepts execution.
    /// @return targetReceived The raw target-token balance increase observed by the strategy.
    function fill(
        uint64 expectedAuctionId,
        uint256 usdGAmount,
        uint256 maxTargetAmount,
        address usdGReceiver,
        uint256 deadline
    ) external nonReentrant returns (uint256 targetReceived) {
        uint256 requiredTarget = _validateAndQuote(
            expectedAuctionId, usdGAmount, maxTargetAmount, usdGReceiver, deadline
        );
        uint64 filledAuctionId = auctionId;
        uint256 deliveredToVault;
        uint256 deliveredToRewards;
        (targetReceived, deliveredToVault, deliveredToRewards) = _collectAndDistribute(requiredTarget, maxTargetAmount);
        _requireStableDecimals();
        uint256 clearingRate = RateMath.clearingRateWad(targetReceived, usdGAmount, USDG_DECIMALS, TARGET_DECIMALS);
        _startAuction(clearingRate);
        GUM_BALL_VAULT.releaseUSDG(usdGReceiver, usdGAmount);
        _requireStableDecimals();

        emit AcquisitionStrategy__Filled(
            filledAuctionId,
            msg.sender,
            usdGReceiver,
            usdGAmount,
            targetReceived,
            deliveredToVault,
            deliveredToRewards,
            clearingRate
        );
    }

    function _validateAndQuote(
        uint64 expectedAuctionId,
        uint256 usdGAmount,
        uint256 maxTargetAmount,
        address usdGReceiver,
        uint256 deadline
    ) private returns (uint256 requiredTarget) {
        if (fillsPaused) revert AcquisitionStrategy__FillsPaused();
        if (!ASSET_REGISTRY.isLiveStrategy(address(this))) revert AcquisitionStrategy__InactiveStrategy();
        if (address(managerRewards) == address(0)) revert AcquisitionStrategy__ManagerRewardsNotConfigured();
        if (expectedAuctionId != auctionId) {
            revert AcquisitionStrategy__StaleAuctionId(expectedAuctionId, auctionId);
        }
        if (block.timestamp > deadline) revert AcquisitionStrategy__DeadlineExpired(deadline);
        if (block.timestamp >= uint256(auctionStartTime) + AUCTION_DURATION) {
            revert AcquisitionStrategy__AuctionExpired(auctionId);
        }
        if (usdGReceiver == address(0)) revert AcquisitionStrategy__ZeroReceiver();
        if (usdGAmount < MINIMUM_LOT_USDG || usdGAmount > MAXIMUM_LOT_USDG) {
            revert AcquisitionStrategy__InvalidLotBounds();
        }

        _requireStableDecimals();

        uint256 budget = ALLOCATION_VOTER.checkpointStrategyBudget(address(this));
        if (usdGAmount > budget) revert AcquisitionStrategy__InsufficientBudget(usdGAmount, budget);

        requiredTarget = RateMath.quoteAssetAmount(usdGAmount, currentRate(), USDG_DECIMALS, TARGET_DECIMALS);
        if (requiredTarget > maxTargetAmount) {
            revert AcquisitionStrategy__MaxTargetExceeded(requiredTarget, maxTargetAmount);
        }
    }

    function _collectAndDistribute(uint256 requiredTarget, uint256 maxTargetAmount)
        private
        returns (uint256 targetReceived, uint256 deliveredToVault, uint256 deliveredToRewards)
    {
        uint256 takerBalanceBefore = TARGET_TOKEN.balanceOf(msg.sender);
        uint256 strategyBalanceBefore = TARGET_TOKEN.balanceOf(address(this));
        TARGET_TOKEN.safeTransferFrom(msg.sender, address(this), requiredTarget);
        uint256 takerBalanceAfter = TARGET_TOKEN.balanceOf(msg.sender);
        uint256 observedTakerDebit = takerBalanceBefore > takerBalanceAfter ? takerBalanceBefore - takerBalanceAfter : 0;
        if (observedTakerDebit > maxTargetAmount) {
            revert AcquisitionStrategy__MaxTargetExceeded(observedTakerDebit, maxTargetAmount);
        }
        targetReceived = TARGET_TOKEN.balanceOf(address(this)) - strategyBalanceBefore;
        if (targetReceived < requiredTarget) {
            revert AcquisitionStrategy__UnderpaidTarget(requiredTarget, targetReceived);
        }

        uint256 managerAmount = Math.mulDiv(targetReceived, MANAGER_REWARD_BPS, BPS_DENOMINATOR);
        uint256 vaultAmount = targetReceived - managerAmount;
        uint256 distributionBalanceBefore = TARGET_TOKEN.balanceOf(address(this));
        uint256 vaultBalanceBefore = TARGET_TOKEN.balanceOf(address(GUM_BALL_VAULT));
        uint256 rewardsBalanceBefore = TARGET_TOKEN.balanceOf(address(managerRewards));
        TARGET_TOKEN.safeTransfer(address(GUM_BALL_VAULT), vaultAmount);
        if (managerAmount != 0) TARGET_TOKEN.safeTransfer(address(managerRewards), managerAmount);
        uint256 distributionBalanceAfter = TARGET_TOKEN.balanceOf(address(this));
        deliveredToVault = TARGET_TOKEN.balanceOf(address(GUM_BALL_VAULT)) - vaultBalanceBefore;
        deliveredToRewards = TARGET_TOKEN.balanceOf(address(managerRewards)) - rewardsBalanceBefore;
        uint256 observedDebit = distributionBalanceBefore > distributionBalanceAfter
            ? distributionBalanceBefore - distributionBalanceAfter
            : 0;
        if (observedDebit != targetReceived) {
            revert AcquisitionStrategy__ObservedDebitMismatch(targetReceived, observedDebit);
        }
        if (deliveredToVault != vaultAmount || deliveredToRewards != managerAmount) {
            revert AcquisitionStrategy__ObservedSplitMismatch(
                vaultAmount, deliveredToVault, managerAmount, deliveredToRewards
            );
        }

        if (deliveredToRewards != 0) managerRewards.notifyReward(deliveredToRewards);
    }

    function _requireStableDecimals() private view {
        uint8 liveUSDGDecimals = IERC20Metadata(address(GUM_BALL_VAULT.USDG())).decimals();
        uint8 liveTargetDecimals = IERC20Metadata(address(TARGET_TOKEN)).decimals();
        if (liveUSDGDecimals != USDG_DECIMALS || liveTargetDecimals != TARGET_DECIMALS) {
            revert AcquisitionStrategy__DecimalsChanged(
                USDG_DECIMALS, liveUSDGDecimals, TARGET_DECIMALS, liveTargetDecimals
            );
        }
    }

    /// @notice Restarts an unfilled expired auction at the unchanged reference bounds.
    function restartExpiredAuction() external {
        if (block.timestamp < uint256(auctionStartTime) + AUCTION_DURATION) {
            revert AcquisitionStrategy__AuctionNotExpired(auctionId);
        }
        _startAuction(referenceRate);
    }

    /// @notice Resets a reference within immutable 50%-to-200% bounds around the timelock-reviewed baseline.
    /// @dev The current rate and auction expiry are intentionally not execution preconditions: fills and permissionless
    ///      restarts cannot censor a mature reset. Concurrent resets remain bounded to their supplied reviewed baselines.
    /// @param expectedReferenceRate The reference rate observed and committed when the operation was scheduled.
    /// @param newReferenceRate The reviewed human target-per-USDG reference rate scaled by 1e18.
    function resetReferenceRate(uint256 expectedReferenceRate, uint256 newReferenceRate) external nonReentrant {
        if (msg.sender != PROTOCOL_TIMELOCK) revert AcquisitionStrategy__NotProtocolTimelock(msg.sender);
        uint256 minimum =
            Math.mulDiv(expectedReferenceRate, MIN_REFERENCE_RESET_BPS, BPS_DENOMINATOR, Math.Rounding.Ceil);
        uint256 maximum = expectedReferenceRate > MAX_REFERENCE_RATE / 2
            ? MAX_REFERENCE_RATE
            : Math.mulDiv(expectedReferenceRate, MAX_REFERENCE_RESET_BPS, BPS_DENOMINATOR);
        if (newReferenceRate < minimum || newReferenceRate > maximum) {
            revert AcquisitionStrategy__ReferenceResetOutOfBounds(newReferenceRate, minimum, maximum);
        }
        uint256 previous = referenceRate;
        _startAuction(newReferenceRate);
        emit AcquisitionStrategy__ReferenceRateReset(previous, newReferenceRate, auctionId);
    }

    /// @notice Immediately pauses new fills; existing target and vault assets remain redeemable.
    function pauseFills() external {
        if (msg.sender != EMERGENCY_GUARDIAN) revert AcquisitionStrategy__NotEmergencyGuardian(msg.sender);
        fillsPaused = true;
        emit AcquisitionStrategy__FillPauseSet(true);
    }

    /// @notice Reopens fills only through the delayed protocol timelock.
    function unpauseFills() external {
        if (msg.sender != PROTOCOL_TIMELOCK) revert AcquisitionStrategy__NotProtocolTimelock(msg.sender);
        fillsPaused = false;
        emit AcquisitionStrategy__FillPauseSet(false);
    }

    /// @notice Returns the current human-normalized target tokens per USDG rate, scaled by 1e18.
    /// @return rate The linearly decayed nonzero target-per-USDG auction rate scaled by 1e18.
    function currentRate() public view returns (uint256 rate) {
        uint256 elapsed = block.timestamp - uint256(auctionStartTime);
        if (elapsed >= AUCTION_DURATION) return floorRate;
        uint256 decay = Math.mulDiv(startRate - floorRate, elapsed, AUCTION_DURATION);
        rate = startRate - decay;
    }

    function _startAuction(uint256 newReferenceRate) private {
        if (newReferenceRate == 0 || newReferenceRate > MAX_REFERENCE_RATE) {
            revert AcquisitionStrategy__InvalidRate();
        }
        referenceRate = newReferenceRate;
        startRate = Math.mulDiv(newReferenceRate, START_RATE_BPS, BPS_DENOMINATOR);
        floorRate = Math.mulDiv(newReferenceRate, FLOOR_RATE_BPS, BPS_DENOMINATOR);
        if (floorRate == 0) revert AcquisitionStrategy__InvalidRate();
        auctionId += 1;
        auctionStartTime = SafeCast.toUint64(block.timestamp);
        emit AcquisitionStrategy__AuctionStarted(auctionId, referenceRate, startRate, floorRate, block.timestamp);
    }
}
