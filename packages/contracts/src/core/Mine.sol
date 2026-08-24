// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { GBX } from "./GBX.sol";

/// @title GumBall6900 Fixed-Slot Mine
/// @notice Distributes GBX through sixteen independently replaceable mining slots priced by reverse Dutch auctions.
/// @dev Each slot has its own hourly reverse Dutch auction and tenure-locked GBX emission rate. Replacing an occupied
///      slot settles its accrued GBX, credits 80% of the USDG price to the displaced miner, and deposits the remainder
///      into ResonanceRouter. The first occupation of an empty slot deposits the complete payment into the Router.
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
    uint256 public constant MIN_INITIAL_PRICE = 1e6;
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
    uint256 public totalClaimableMinerPayments;

    /// @notice Pull-based USDG replacement proceeds owed to each displaced miner.
    mapping(address account => uint256 amount) public claimableMinerPayment;
    /// @notice Mining-slot state keyed by zero-based slot index.
    mapping(uint256 slotIndex => Slot slotState) private _slots;

    /// @notice Emitted after accumulated USDG replacement proceeds are paid to a miner.
    event MinerPaymentClaimed(address indexed account, uint256 amount);
    /// @notice Emitted after one outgoing miner's complete tenure emission is minted.
    event EmissionSettled(address indexed miner, uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount);
    /// @notice Emitted after one mining slot changes hands.
    event Mined(
        address indexed payer,
        address indexed miner,
        uint256 indexed slotIndex,
        uint256 epochId,
        address previousMiner,
        uint256 paymentAmount,
        uint256 nextInitialPrice,
        uint256 tps,
        string message
    );
    /// @notice Emitted after replacement proceeds become claimable by a displaced miner.
    event MinerPaymentAccrued(
        address indexed miner, uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount
    );
    /// @notice Emitted after mining revenue is deposited into ResonanceRouter for later permissionless routing.
    event RevenueDeposited(uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount);

    /// @notice The caller-supplied mining deadline has passed.
    error DeadlinePassed(uint256 deadline);
    /// @notice The caller's expected slot epoch differs from current state.
    error EpochIdMismatch(uint256 expected, uint256 actual);
    /// @notice A slot index is outside the immutable sixteen-slot range.
    error IndexOutOfBounds(uint256 slotIndex);
    /// @notice The current replacement payment exceeds the caller's slippage ceiling.
    error MaximumPaymentExceeded(uint256 paymentAmount, uint256 maximumPayment);
    /// @notice The event-only mining message exceeds the raw-byte limit.
    error MessageTooLong(uint256 length);
    /// @notice An account has no accumulated replacement payment to claim.
    error NothingToClaim(address account);
    /// @notice A required deployment or mining address is zero.
    error ZeroAddress();

    /// @notice Creates the immutable mining market with sixteen empty slots.
    /// @param gbx_ GBX token whose sole mint authority will be this Mine.
    /// @param usdg_ USDG token paid by miners.
    /// @param resonanceRouter_ Router that receives the protocol share of each payment.
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
            _slots[i] = _emptySlot();
        }
    }

    /// @notice Replaces one slot's miner at its current linearly decaying USDG price.
    /// @dev The optional message is emitted in `Mined` and is never stored in contract state.
    /// @param miner Account receiving the slot and its later GBX emission.
    /// @param slotIndex Zero-based slot to replace.
    /// @param expectedEpochId Expected slot epoch, protecting against an earlier handoff.
    /// @param deadline Latest timestamp at which the handoff may execute.
    /// @param maximumPayment Maximum USDG payment accepted by the caller.
    /// @param message Optional event-only message of at most `MAX_MESSAGE_BYTES` raw bytes.
    /// @return paymentAmount Actual USDG payment required at execution time.
    function mine(
        address miner,
        uint256 slotIndex,
        uint256 expectedEpochId,
        uint256 deadline,
        uint256 maximumPayment,
        string calldata message
    ) external nonReentrant returns (uint256 paymentAmount) {
        if (miner == address(0)) revert ZeroAddress();
        if (slotIndex >= SLOT_COUNT) revert IndexOutOfBounds(slotIndex);
        if (block.timestamp > deadline) revert DeadlinePassed(deadline);
        uint256 messageLength = bytes(message).length;
        if (messageLength > MAX_MESSAGE_BYTES) revert MessageTooLong(messageLength);
        Slot memory previousSlot = _slots[slotIndex];
        if (expectedEpochId != previousSlot.epochId) {
            revert EpochIdMismatch(expectedEpochId, previousSlot.epochId);
        }

        paymentAmount = _price(previousSlot);
        if (paymentAmount > maximumPayment) revert MaximumPaymentExceeded(paymentAmount, maximumPayment);

        _accruePendingEmission();
        _settleSlot(slotIndex, previousSlot);

        uint256 revenueAmount = _allocatePayment(previousSlot.miner, slotIndex, expectedEpochId, paymentAmount);
        Slot memory nextSlot = Slot({
            epochId: expectedEpochId + 1,
            initialPrice: _nextInitialPrice(paymentAmount),
            auctionStartedAt: block.timestamp,
            lastAccruedAt: block.timestamp,
            tps: _globalTps() / SLOT_COUNT,
            miner: miner
        });

        aggregateTps = aggregateTps - previousSlot.tps + nextSlot.tps;
        _slots[slotIndex] = nextSlot;

        if (paymentAmount != 0) {
            _collectAndDeposit(msg.sender, slotIndex, expectedEpochId, paymentAmount, revenueAmount);
        }

        emit Mined(
            msg.sender,
            miner,
            slotIndex,
            expectedEpochId,
            previousSlot.miner,
            paymentAmount,
            nextSlot.initialPrice,
            nextSlot.tps,
            message
        );
    }

    /// @notice Claims accumulated USDG replacement payments for an account.
    /// @param account Displaced miner receiving the payment.
    function claimMinerPayment(address account) external nonReentrant {
        if (account == address(0)) revert ZeroAddress();
        uint256 amount = claimableMinerPayment[account];
        if (amount == 0) revert NothingToClaim(account);

        claimableMinerPayment[account] = 0;
        totalClaimableMinerPayments -= amount;
        usdg.safeTransfer(account, amount);

        emit MinerPaymentClaimed(account, amount);
    }

    /// @notice Returns one slot's current linearly decaying USDG replacement price.
    /// @param slotIndex Zero-based slot to quote.
    /// @return paymentAmount Current USDG replacement payment.
    function currentPrice(uint256 slotIndex) external view returns (uint256 paymentAmount) {
        if (slotIndex >= SLOT_COUNT) revert IndexOutOfBounds(slotIndex);
        return _price(_slots[slotIndex]);
    }

    /// @notice Returns the complete state of one mining slot.
    /// @param slotIndex Zero-based slot to read.
    /// @return slotState Current slot state.
    function slot(uint256 slotIndex) external view returns (Slot memory slotState) {
        if (slotIndex >= SLOT_COUNT) revert IndexOutOfBounds(slotIndex);
        return _slots[slotIndex];
    }

    /// @notice Returns accrued unminted GBX for one slot without changing its state.
    /// @param slotIndex Zero-based slot to read.
    /// @return amount Accrued unminted GBX for the slot.
    function pendingSlotEmission(uint256 slotIndex) external view returns (uint256 amount) {
        if (slotIndex >= SLOT_COUNT) revert IndexOutOfBounds(slotIndex);
        Slot memory slotState = _slots[slotIndex];
        if (slotState.miner == address(0)) return 0;
        return (block.timestamp - slotState.lastAccruedAt) * slotState.tps;
    }

    /// @notice Returns total accrued unminted GBX in constant time across all sixteen slots.
    /// @return amount Complete accrued unminted GBX amount.
    function pendingEmission() public view returns (uint256 amount) {
        return storedPendingEmission + (block.timestamp - pendingUpdatedAt) * aggregateTps;
    }

    /// @notice Returns minted GBX supply plus all accrued unminted mining emission.
    /// @return amount Economically effective GBX supply.
    function effectiveTotalSupply() external view returns (uint256 amount) {
        return gbx.totalSupply() + pendingEmission();
    }

    /// @notice Returns the global tokens-per-second rate that the next handoff will divide by sixteen.
    /// @return tps Prospective global GBX tokens-per-second rate.
    function nextGlobalTps() external view returns (uint256 tps) {
        return _globalTps();
    }

    /// @dev Incorporates elapsed emission at the old aggregate rate before any slot settlement or rate mutation.
    function _accruePendingEmission() private {
        storedPendingEmission = pendingEmission();
        pendingUpdatedAt = block.timestamp;
    }

    /// @dev Mints only the selected outgoing slot's complete tenure accrual and removes it from global pending supply.
    function _settleSlot(uint256 slotIndex, Slot memory previousSlot) private {
        if (previousSlot.miner == address(0)) return;

        uint256 amount = (block.timestamp - previousSlot.lastAccruedAt) * previousSlot.tps;
        if (amount == 0) return;

        storedPendingEmission -= amount;
        totalMined += amount;
        gbx.mint(previousSlot.miner, amount);
        emit EmissionSettled(previousSlot.miner, slotIndex, previousSlot.epochId, amount);
    }

    function _allocatePayment(address previousMiner, uint256 slotIndex, uint256 epochId, uint256 paymentAmount)
        private
        returns (uint256 revenueAmount)
    {
        if (paymentAmount == 0) return 0;
        if (previousMiner == address(0)) return paymentAmount;

        uint256 previousMinerAmount = Math.mulDiv(paymentAmount, PREVIOUS_MINER_BPS, BPS);
        revenueAmount = paymentAmount - previousMinerAmount;
        claimableMinerPayment[previousMiner] += previousMinerAmount;
        totalClaimableMinerPayments += previousMinerAmount;
        emit MinerPaymentAccrued(previousMiner, slotIndex, epochId, previousMinerAmount);
    }

    function _collectAndDeposit(
        address payer,
        uint256 slotIndex,
        uint256 epochId,
        uint256 paymentAmount,
        uint256 revenueAmount
    ) private {
        usdg.safeTransferFrom(payer, address(this), paymentAmount);
        usdg.safeTransfer(resonanceRouter, revenueAmount);

        emit RevenueDeposited(slotIndex, epochId, revenueAmount);
    }

    function _nextInitialPrice(uint256 paymentAmount) private pure returns (uint256 nextInitialPrice) {
        nextInitialPrice = paymentAmount * PRICE_MULTIPLIER;
        if (nextInitialPrice > MAX_INITIAL_PRICE) return MAX_INITIAL_PRICE;
        if (nextInitialPrice < MIN_INITIAL_PRICE) return MIN_INITIAL_PRICE;
    }

    function _globalTps() private view returns (uint256 tps) {
        uint256 halvings = (block.timestamp - startTime) / HALVING_PERIOD;
        tps = INITIAL_TPS >> halvings;
        if (tps < TAIL_TPS) tps = TAIL_TPS;
    }

    function _price(Slot memory slotState) private view returns (uint256 amount) {
        uint256 elapsed = block.timestamp - slotState.auctionStartedAt;
        if (elapsed >= PRICE_DECAY_PERIOD) return 0;
        return slotState.initialPrice - Math.mulDiv(slotState.initialPrice, elapsed, PRICE_DECAY_PERIOD);
    }

    function _emptySlot() private view returns (Slot memory slotState) {
        return Slot({
            epochId: 1,
            initialPrice: MIN_INITIAL_PRICE,
            auctionStartedAt: block.timestamp,
            lastAccruedAt: block.timestamp,
            tps: 0,
            miner: address(0)
        });
    }
}
