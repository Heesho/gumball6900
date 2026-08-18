// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { GBX } from "./GBX.sol";
import { IResonanceRouter } from "./interfaces/IResonanceRouter.sol";

/// @title GUM BALL 6900 Fixed-Slot Mine
/// @author Heesho
/// @notice Distributes GBX through sixteen independently replaceable mining slots priced by reverse Dutch auctions.
/// @dev Adapted from Farplace MineRig. A replacement pays USDG, the displaced miner accrues 80% as a pull claim,
///      and the remainder is routed into Resonance. Each occupied slot keeps its assigned tokens-per-second rate until
///      replacement. A system-wide pending-emission accumulator makes total pending supply constant-time while a
///      handoff settles only the replaced slot. There is no all-slot checkpoint or administrative surface.
/// @custom:version 1.1.0
contract Mine is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Basis-point denominator used for replacement-payment allocation.
    uint256 public constant BPS = 10_000;
    /// @notice Share of a paid replacement price credited to the displaced miner, in basis points.
    uint256 public constant PREVIOUS_MINER_BPS = 8_000;
    /// @notice Fixed-point precision used by the replacement-price multiplier.
    uint256 public constant PRICE_PRECISION = 1e18;
    /// @notice Duration over which each replacement price decays linearly to zero.
    uint256 public constant PRICE_DECAY_PERIOD = 1 hours;
    /// @notice Permanent number of independent mining slots.
    uint256 public constant SLOT_COUNT = 16;
    /// @notice Lowest accepted fixed-point replacement-price multiplier.
    uint256 public constant MIN_PRICE_MULTIPLIER = 1.1e18;
    /// @notice Highest accepted fixed-point replacement-price multiplier.
    uint256 public constant MAX_PRICE_MULTIPLIER = 3e18;
    /// @notice Lowest accepted raw USDG starting price for a new auction.
    uint256 public constant MIN_INITIAL_PRICE = 1e6;
    /// @notice Highest accepted raw USDG starting price for a new auction.
    uint256 public constant MAX_INITIAL_PRICE = type(uint192).max;
    /// @notice Highest accepted initial global raw-GBX tokens-per-second rate.
    uint256 public constant MAX_INITIAL_TPS = 1e24;
    /// @notice Lowest accepted global tail rate, preserving at least one raw unit per slot per second.
    uint256 public constant MIN_TAIL_TPS = SLOT_COUNT;
    /// @notice Lowest accepted cumulative raw-GBX interval between the first two halving thresholds.
    uint256 public constant MIN_HALVING_AMOUNT = 1_000 ether;
    /// @notice Highest accepted cumulative raw-GBX interval between the first two halving thresholds.
    uint256 public constant MAX_HALVING_AMOUNT = 1e27;

    /// @notice Canonical GBX token whose sole mint authority is this Mine.
    GBX public immutable gbx;
    /// @notice USDG token paid to replace mining slots.
    IERC20 public immutable usdg;
    /// @notice Router receiving the Resonance share of replacement payments.
    address public immutable resonanceRouter;
    /// @notice Fixed-point multiplier applied to each paid price to start the next auction.
    uint256 public immutable priceMultiplier;
    /// @notice Floor for every newly started reverse Dutch auction.
    uint256 public immutable minimumInitialPrice;
    /// @notice Initial global raw-GBX tokens-per-second rate.
    uint256 public immutable initialTps;
    /// @notice Cumulative raw-GBX interval used to derive immutable halving thresholds.
    uint256 public immutable halvingAmount;
    /// @notice Strictly positive global raw-GBX tokens-per-second tail rate.
    uint256 public immutable tailTps;

    /// @notice Sum of all occupied slots' tenure-locked tokens-per-second rates.
    uint256 public aggregateTps;
    /// @notice Total unminted slot emission accrued through `pendingUpdatedAt`.
    uint256 public storedPendingEmission;
    /// @notice Timestamp through which `storedPendingEmission` incorporates `aggregateTps`.
    uint256 public pendingUpdatedAt;
    /// @notice Cumulative GBX actually minted when individual slots were replaced.
    uint256 public totalMined;
    /// @notice Total USDG currently owed to displaced miners.
    uint256 public totalClaimable;

    /// @notice Mining-slot state by zero-based slot index.
    mapping(uint256 index => Slot slot) public slots;
    /// @notice Pull-based USDG replacement proceeds owed to each displaced miner.
    mapping(address account => uint256 amount) public claimable;

    struct Config {
        uint256 priceMultiplier;
        uint256 minimumInitialPrice;
        uint256 initialTps;
        uint256 halvingAmount;
        uint256 tailTps;
    }

    struct Slot {
        uint256 epochId;
        uint256 initialPrice;
        uint256 auctionStartedAt;
        uint256 lastAccruedAt;
        uint256 tps;
        address miner;
    }

    event Claimed(address indexed account, uint256 amount);
    event EmissionSettled(address indexed miner, uint256 indexed index, uint256 indexed epochId, uint256 amount);
    event Mined(
        address indexed payer,
        address indexed miner,
        uint256 indexed index,
        uint256 epochId,
        address previousMiner,
        uint256 price,
        uint256 initialPrice,
        uint256 tps
    );
    event MinerPaymentAccrued(address indexed miner, uint256 indexed index, uint256 indexed epochId, uint256 amount);
    event RevenueRouted(uint256 indexed index, uint256 indexed epochId, uint256 amount);

    error DeadlinePassed(uint256 deadline);
    error EpochIdMismatch(uint256 expected, uint256 actual);
    error HalvingAmountOutOfRange(uint256 amount);
    error InexactTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    error IndexOutOfBounds(uint256 index);
    error InitialPriceOutOfRange(uint256 price);
    error InitialTpsOutOfRange(uint256 tps);
    error MaxPriceExceeded(uint256 price, uint256 maximumPrice);
    error MiningAuthorityNotFinalized(address minter, bool locked);
    error NothingToClaim(address account);
    error PriceMultiplierOutOfRange(uint256 multiplier);
    error TailTpsOutOfRange(uint256 tps);
    error UnexpectedRevenueToken(address expected, address actual);
    error ZeroAddress();

    /// @notice Creates the immutable mining market with sixteen empty slots.
    constructor(GBX gbx_, IERC20 usdg_, address resonanceRouter_, Config memory config) {
        if (
            address(gbx_) == address(0) || address(usdg_) == address(0) || resonanceRouter_ == address(0)
                || address(gbx_).code.length == 0 || address(usdg_).code.length == 0
                || resonanceRouter_.code.length == 0
        ) revert ZeroAddress();
        if (config.priceMultiplier < MIN_PRICE_MULTIPLIER || config.priceMultiplier > MAX_PRICE_MULTIPLIER) {
            revert PriceMultiplierOutOfRange(config.priceMultiplier);
        }
        if (config.minimumInitialPrice < MIN_INITIAL_PRICE || config.minimumInitialPrice > MAX_INITIAL_PRICE) {
            revert InitialPriceOutOfRange(config.minimumInitialPrice);
        }
        if (config.initialTps == 0 || config.initialTps > MAX_INITIAL_TPS) {
            revert InitialTpsOutOfRange(config.initialTps);
        }
        if (config.tailTps < MIN_TAIL_TPS || config.tailTps > config.initialTps) {
            revert TailTpsOutOfRange(config.tailTps);
        }
        if (config.halvingAmount < MIN_HALVING_AMOUNT || config.halvingAmount > MAX_HALVING_AMOUNT) {
            revert HalvingAmountOutOfRange(config.halvingAmount);
        }

        address routerToken = address(IRevenueRouterIdentity(resonanceRouter_).usdg());
        if (routerToken != address(usdg_)) revert UnexpectedRevenueToken(address(usdg_), routerToken);

        gbx = gbx_;
        usdg = usdg_;
        resonanceRouter = resonanceRouter_;
        priceMultiplier = config.priceMultiplier;
        minimumInitialPrice = config.minimumInitialPrice;
        initialTps = config.initialTps;
        halvingAmount = config.halvingAmount;
        tailTps = config.tailTps;
        pendingUpdatedAt = block.timestamp;

        for (uint256 i; i < SLOT_COUNT; ++i) {
            slots[i] = _emptySlot();
        }
    }

    /// @notice Replaces one slot's miner at its current linearly decaying USDG price.
    function mine(address miner, uint256 index, uint256 epochId, uint256 deadline, uint256 maximumPrice)
        external
        nonReentrant
        returns (uint256 paid)
    {
        if (miner == address(0)) revert ZeroAddress();
        if (index >= SLOT_COUNT) revert IndexOutOfBounds(index);
        if (block.timestamp > deadline) revert DeadlinePassed(deadline);
        _requireMiningAuthority();

        Slot memory previousSlot = slots[index];
        if (epochId != previousSlot.epochId) revert EpochIdMismatch(epochId, previousSlot.epochId);

        paid = _price(previousSlot);
        if (paid > maximumPrice) revert MaxPriceExceeded(paid, maximumPrice);

        _accruePendingEmission();
        _settleSlot(index);

        uint256 revenueAmount = _allocatePayment(previousSlot.miner, index, epochId, paid);
        uint256 nextInitialPrice = _nextInitialPrice(paid);
        uint256 nextTps = _globalTps(totalMined + storedPendingEmission) / SLOT_COUNT;

        aggregateTps = aggregateTps - previousSlot.tps + nextTps;
        slots[index] = Slot({
            epochId: epochId + 1,
            initialPrice: nextInitialPrice,
            auctionStartedAt: block.timestamp,
            lastAccruedAt: block.timestamp,
            tps: nextTps,
            miner: miner
        });

        if (paid != 0) _collectAndRoute(msg.sender, index, epochId, paid, revenueAmount);

        emit Mined(msg.sender, miner, index, epochId, previousSlot.miner, paid, nextInitialPrice, nextTps);
    }

    function _nextInitialPrice(uint256 paid) private view returns (uint256 nextInitialPrice) {
        nextInitialPrice = Math.mulDiv(paid, priceMultiplier, PRICE_PRECISION);
        if (nextInitialPrice > MAX_INITIAL_PRICE) return MAX_INITIAL_PRICE;
        if (nextInitialPrice < minimumInitialPrice) return minimumInitialPrice;
    }

    function _allocatePayment(address previousMiner, uint256 index, uint256 epochId, uint256 paid)
        private
        returns (uint256 revenueAmount)
    {
        if (paid == 0) return 0;
        if (previousMiner == address(0)) return paid;

        uint256 previousMinerAmount = Math.mulDiv(paid, PREVIOUS_MINER_BPS, BPS);
        revenueAmount = paid - previousMinerAmount;
        claimable[previousMiner] += previousMinerAmount;
        totalClaimable += previousMinerAmount;
        emit MinerPaymentAccrued(previousMiner, index, epochId, previousMinerAmount);
    }

    function _collectAndRoute(address payer, uint256 index, uint256 epochId, uint256 paid, uint256 revenueAmount)
        private
    {
        uint256 payerBalanceBefore = usdg.balanceOf(payer);
        uint256 minerBalanceBefore = usdg.balanceOf(address(this));
        usdg.safeTransferFrom(payer, address(this), paid);
        uint256 payerDebit = payerBalanceBefore - usdg.balanceOf(payer);
        uint256 minerCredit = usdg.balanceOf(address(this)) - minerBalanceBefore;
        if (payerDebit != paid || minerCredit != paid) revert InexactTransfer(paid, payerDebit, minerCredit);

        uint256 routerBalanceBefore = usdg.balanceOf(resonanceRouter);
        usdg.safeTransfer(resonanceRouter, revenueAmount);
        uint256 minerDebit = minerBalanceBefore + paid - usdg.balanceOf(address(this));
        uint256 routerCredit = usdg.balanceOf(resonanceRouter) - routerBalanceBefore;
        if (minerDebit != revenueAmount || routerCredit != revenueAmount) {
            revert InexactTransfer(revenueAmount, minerDebit, routerCredit);
        }

        IResonanceRouter(resonanceRouter).route();
        emit RevenueRouted(index, epochId, revenueAmount);
    }

    /// @notice Claims accumulated USDG replacement payments for an account.
    function claim(address account) external nonReentrant {
        if (account == address(0)) revert ZeroAddress();
        uint256 amount = claimable[account];
        if (amount == 0) revert NothingToClaim(account);

        claimable[account] = 0;
        totalClaimable -= amount;

        uint256 minerBalanceBefore = usdg.balanceOf(address(this));
        uint256 accountBalanceBefore = usdg.balanceOf(account);
        usdg.safeTransfer(account, amount);
        uint256 minerDebit = minerBalanceBefore - usdg.balanceOf(address(this));
        uint256 accountCredit = usdg.balanceOf(account) - accountBalanceBefore;
        if (minerDebit != amount || accountCredit != amount) revert InexactTransfer(amount, minerDebit, accountCredit);

        emit Claimed(account, amount);
    }

    /// @notice Returns one slot's current linearly decaying USDG replacement price.
    function price(uint256 index) external view returns (uint256 amount) {
        if (index >= SLOT_COUNT) revert IndexOutOfBounds(index);
        return _price(slots[index]);
    }

    /// @notice Returns the complete state of one mining slot.
    function getSlot(uint256 index) external view returns (Slot memory slot) {
        if (index >= SLOT_COUNT) revert IndexOutOfBounds(index);
        return slots[index];
    }

    /// @notice Returns accrued unminted GBX for one slot without changing its state.
    function pendingEmission(uint256 index) public view returns (uint256 amount) {
        if (index >= SLOT_COUNT) revert IndexOutOfBounds(index);
        Slot memory slot = slots[index];
        if (slot.miner == address(0)) return 0;
        return (block.timestamp - slot.lastAccruedAt) * slot.tps;
    }

    /// @notice Returns total accrued unminted GBX in constant time across all sixteen slots.
    function pendingEmission() public view returns (uint256 amount) {
        return storedPendingEmission + (block.timestamp - pendingUpdatedAt) * aggregateTps;
    }

    /// @notice Returns minted GBX supply plus all accrued unminted mining emission.
    function effectiveTotalSupply() external view returns (uint256 amount) {
        return gbx.totalSupply() + pendingEmission();
    }

    /// @notice Returns the global tokens-per-second rate that the next handoff will divide by sixteen.
    function nextGlobalTps() external view returns (uint256 tps) {
        return _globalTps(totalMined + pendingEmission());
    }

    /// @dev Incorporates elapsed emission at the old aggregate rate before any slot settlement or rate mutation.
    function _accruePendingEmission() private {
        storedPendingEmission = pendingEmission();
        pendingUpdatedAt = block.timestamp;
    }

    /// @dev Mints only the selected outgoing slot's complete tenure accrual and removes it from global pending supply.
    function _settleSlot(uint256 index) private returns (uint256 amount) {
        Slot storage slot = slots[index];
        if (slot.miner == address(0)) return 0;

        amount = (block.timestamp - slot.lastAccruedAt) * slot.tps;
        slot.lastAccruedAt = block.timestamp;
        if (amount == 0) return 0;

        storedPendingEmission -= amount;
        totalMined += amount;
        gbx.mint(slot.miner, amount);
        emit EmissionSettled(slot.miner, index, slot.epochId, amount);
    }

    function _globalTps(uint256 economicallyMined) private view returns (uint256 tps) {
        (tps,) = _rateState(economicallyMined);
    }

    function _rateState(uint256 economicallyMined) private view returns (uint256 tps, uint256 nextThreshold) {
        uint256 halvings = 0;
        nextThreshold = halvingAmount;
        while (economicallyMined >= nextThreshold) {
            ++halvings;
            tps = initialTps >> halvings;
            if (tps <= tailTps) return (tailTps, type(uint256).max);
            nextThreshold += halvingAmount >> halvings;
        }

        tps = initialTps >> halvings;
        if (tps <= tailTps) {
            tps = tailTps;
            nextThreshold = type(uint256).max;
        }
    }

    function _price(Slot memory slot) private view returns (uint256 amount) {
        uint256 elapsed = block.timestamp - slot.auctionStartedAt;
        if (elapsed >= PRICE_DECAY_PERIOD) return 0;
        return slot.initialPrice - Math.mulDiv(slot.initialPrice, elapsed, PRICE_DECAY_PERIOD);
    }

    function _emptySlot() private view returns (Slot memory slot) {
        return Slot({
            epochId: 1,
            initialPrice: minimumInitialPrice,
            auctionStartedAt: block.timestamp,
            lastAccruedAt: block.timestamp,
            tps: 0,
            miner: address(0)
        });
    }

    function _requireMiningAuthority() private view {
        address minter = gbx.minter();
        bool locked = gbx.minterLocked();
        if (!locked || minter != address(this)) revert MiningAuthorityNotFinalized(minter, locked);
    }
}

interface IRevenueRouterIdentity is IResonanceRouter {
    /// @notice Returns the USDG token routed through Resonance.
    function usdg() external view returns (IERC20 token);
}
