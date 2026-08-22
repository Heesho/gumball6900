// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { GBX } from "./GBX.sol";

/// @title GUM BALL 6900 Fixed-Slot Mine
/// @author Heesho
/// @notice Distributes GBX through sixteen independently replaceable mining slots priced by reverse Dutch auctions.
/// @dev Each slot has its own hourly reverse Dutch auction and tenure-locked GBX emission rate. Replacing an occupied
///      slot settles its accrued GBX, credits 80% of the USDG price to the displaced miner, and deposits the remainder
///      into ResonanceRouter. The first occupation of an empty slot deposits the complete payment into the Router.
/// @custom:version 1.3.0
contract Mine is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Slot {
        uint256 epochId;
        uint256 initialPrice;
        uint256 auctionStartedAt;
        uint256 lastAccruedAt;
        uint256 tps;
        address miner;
    }

    /// @notice Basis-point denominator used for replacement-payment allocation.
    uint256 public constant BPS = 10_000;
    /// @notice Share of a paid replacement price credited to the displaced miner, in basis points.
    uint256 public constant PREVIOUS_MINER_BPS = 8_000;
    /// @notice Duration over which each replacement price decays linearly to zero.
    uint256 public constant PRICE_DECAY_PERIOD = 1 hours;
    /// @notice Permanent number of independent mining slots.
    uint256 public constant SLOT_COUNT = 16;
    /// @notice Multiplier applied to each paid price to start the next auction.
    uint256 public constant PRICE_MULTIPLIER = 2;
    /// @notice Raw USDG floor for every newly started reverse Dutch auction.
    uint256 public constant MINIMUM_INITIAL_PRICE = 1e6;
    /// @notice Highest raw USDG starting price for a new auction.
    uint256 public constant MAX_INITIAL_PRICE = type(uint192).max;
    /// @notice Initial global GBX tokens-per-second rate.
    uint256 public constant INITIAL_TPS = 64 ether;
    /// @notice Provisional fixed interval between prospective global-rate halvings.
    uint256 public constant HALVING_PERIOD = 69 days;
    /// @notice Strictly positive global GBX tokens-per-second tail rate.
    uint256 public constant TAIL_TPS = 1 ether;
    /// @notice Maximum raw byte length of the event-only message attached to a mining handoff.
    uint256 public constant MAX_MESSAGE_BYTES = 280;

    /// @notice Canonical GBX token whose sole mint authority is this Mine.
    GBX public immutable gbx;
    /// @notice USDG token paid to replace mining slots.
    IERC20 public immutable usdg;
    /// @notice Router receiving the Resonance share of replacement payments.
    address public immutable resonanceRouter;
    /// @notice Timestamp anchoring the immutable time-based halving schedule.
    uint256 public immutable startTime;
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
        uint256 tps,
        string message
    );
    event MinerPaymentAccrued(address indexed miner, uint256 indexed index, uint256 indexed epochId, uint256 amount);
    /// @notice Emitted after mining revenue is deposited into ResonanceRouter for later permissionless routing.
    event RevenueDeposited(uint256 indexed index, uint256 indexed epochId, uint256 amount);

    error DeadlinePassed(uint256 deadline);
    error EpochIdMismatch(uint256 expected, uint256 actual);
    error InexactTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    error IndexOutOfBounds(uint256 index);
    error MaxPriceExceeded(uint256 price, uint256 maximumPrice);
    error MessageTooLong(uint256 length);
    error NothingToClaim(address account);
    error ZeroAddress();

    /// @notice Creates the immutable mining market with sixteen empty slots.
    constructor(GBX gbx_, IERC20 usdg_, address resonanceRouter_) {
        if (
            address(gbx_) == address(0) || address(usdg_) == address(0) || resonanceRouter_ == address(0)
                || address(gbx_).code.length == 0 || address(usdg_).code.length == 0
                || resonanceRouter_.code.length == 0
        ) revert ZeroAddress();

        gbx = gbx_;
        usdg = usdg_;
        resonanceRouter = resonanceRouter_;
        startTime = block.timestamp;
        pendingUpdatedAt = block.timestamp;

        for (uint256 i; i < SLOT_COUNT; ++i) {
            slots[i] = _emptySlot();
        }
    }

    /// @notice Replaces one slot's miner at its current linearly decaying USDG price.
    /// @dev The optional message is emitted in `Mined` and is never stored in contract state.
    function mine(
        address miner,
        uint256 index,
        uint256 epochId,
        uint256 deadline,
        uint256 maximumPrice,
        string calldata message
    ) external nonReentrant returns (uint256 paid) {
        if (miner == address(0)) revert ZeroAddress();
        if (index >= SLOT_COUNT) revert IndexOutOfBounds(index);
        if (block.timestamp > deadline) revert DeadlinePassed(deadline);
        uint256 messageLength = bytes(message).length;
        if (messageLength > MAX_MESSAGE_BYTES) revert MessageTooLong(messageLength);
        Slot memory previousSlot = slots[index];
        if (epochId != previousSlot.epochId) revert EpochIdMismatch(epochId, previousSlot.epochId);

        paid = _price(previousSlot);
        if (paid > maximumPrice) revert MaxPriceExceeded(paid, maximumPrice);

        _accruePendingEmission();
        _settleSlot(index);

        uint256 revenueAmount = _allocatePayment(previousSlot.miner, index, epochId, paid);
        Slot memory nextSlot = Slot({
            epochId: epochId + 1,
            initialPrice: _nextInitialPrice(paid),
            auctionStartedAt: block.timestamp,
            lastAccruedAt: block.timestamp,
            tps: _globalTps() / SLOT_COUNT,
            miner: miner
        });

        aggregateTps = aggregateTps - previousSlot.tps + nextSlot.tps;
        slots[index] = nextSlot;

        if (paid != 0) _collectAndDeposit(msg.sender, index, epochId, paid, revenueAmount);

        emit Mined(
            msg.sender, miner, index, epochId, previousSlot.miner, paid, nextSlot.initialPrice, nextSlot.tps, message
        );
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
        return _globalTps();
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

    function _collectAndDeposit(address payer, uint256 index, uint256 epochId, uint256 paid, uint256 revenueAmount)
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

        emit RevenueDeposited(index, epochId, revenueAmount);
    }

    function _nextInitialPrice(uint256 paid) private pure returns (uint256 nextInitialPrice) {
        nextInitialPrice = paid * PRICE_MULTIPLIER;
        if (nextInitialPrice > MAX_INITIAL_PRICE) return MAX_INITIAL_PRICE;
        if (nextInitialPrice < MINIMUM_INITIAL_PRICE) return MINIMUM_INITIAL_PRICE;
    }

    function _globalTps() private view returns (uint256 tps) {
        uint256 halvings = (block.timestamp - startTime) / HALVING_PERIOD;
        tps = INITIAL_TPS >> halvings;
        if (tps < TAIL_TPS) tps = TAIL_TPS;
    }

    function _price(Slot memory slot) private view returns (uint256 amount) {
        uint256 elapsed = block.timestamp - slot.auctionStartedAt;
        if (elapsed >= PRICE_DECAY_PERIOD) return 0;
        return slot.initialPrice - Math.mulDiv(slot.initialPrice, elapsed, PRICE_DECAY_PERIOD);
    }

    function _emptySlot() private view returns (Slot memory slot) {
        return Slot({
            epochId: 1,
            initialPrice: MINIMUM_INITIAL_PRICE,
            auctionStartedAt: block.timestamp,
            lastAccruedAt: block.timestamp,
            tps: 0,
            miner: address(0)
        });
    }
}
