// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { GBX } from "./GBX.sol";

/// @title GumBall6900 Fixed-Slot Mine
/// @author @heesho
/// @notice Distributes GBX through sixteen independently replaceable mining slots priced by reverse Dutch auctions.
/// @dev Each slot has its own hourly reverse Dutch auction and tenure-locked GBX emission rate. Replacing an occupied
///      tenure settles its accrued GBX and credits 80% of the USDG price to its miner. The remainder is deposited into
///      ResonanceRouter. The first occupation of an empty slot deposits the complete payment into the Router.
///      Token calculations use raw units, and integer divisions round down unless stated otherwise.
contract Mine is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice State for one independently replaceable mining tenure.
    /// @param epochId Identifier that the next replacement must supply as `expectedEpochId`.
    /// @param initialPrice Starting price of the active auction, in raw USDG units.
    /// @param auctionStartedAt Unix timestamp at which the active auction began.
    /// @param lastAccruedAt Unix timestamp from which the current miner's unminted emission accrues.
    /// @param tps Tenure-locked emission rate, in raw GBX units per second.
    /// @param miner Account entitled to the tenure's emission, or the zero address while the slot is empty.
    struct Slot {
        uint256 epochId;
        uint256 initialPrice;
        uint256 auctionStartedAt;
        uint256 lastAccruedAt;
        uint256 tps;
        address miner;
    }

    /// @notice Basis-point denominator used for replacement-payment allocation; 10,000 represents 100%.
    uint256 public constant BPS = 10_000;
    /// @notice Share of a paid nonempty-slot replacement credited to the outgoing tenure miner, in basis points.
    /// @dev The miner share is rounded down; ResonanceRouter receives the complete remainder.
    uint256 public constant PREVIOUS_MINER_BPS = 8_000;
    /// @notice Duration in seconds over which each replacement price decays linearly to zero.
    uint256 public constant PRICE_DECAY_PERIOD = 1 hours;
    /// @notice Permanent number of independent mining slots.
    uint256 public constant SLOT_COUNT = 16;
    /// @notice Dimensionless multiplier applied to each paid price to start the next auction.
    uint256 public constant PRICE_MULTIPLIER = 2;
    /// @notice Minimum starting price for every newly opened auction, in raw USDG units.
    uint256 public constant MIN_INITIAL_PRICE = 1e6;
    /// @notice Maximum starting price for every newly opened auction, in raw USDG units.
    uint256 public constant MAX_INITIAL_PRICE = type(uint192).max;
    /// @notice Provisional initial prospective global emission rate, in raw GBX units per second.
    /// @dev Development constant pending independent economic review.
    uint256 public constant INITIAL_TPS = 64 ether;
    /// @notice Provisional fixed interval in seconds between prospective global-rate halvings.
    /// @dev Development constant pending independent economic review.
    uint256 public constant HALVING_PERIOD = 69 days;
    /// @notice Provisional strictly positive prospective global tail rate, in raw GBX units per second.
    /// @dev Development constant pending independent economic review.
    uint256 public constant TAIL_TPS = 1 ether;
    /// @notice Maximum raw byte length of the event-only message attached to a mining replacement.
    uint256 public constant MAX_MESSAGE_BYTES = 280;

    /// @notice Canonical GBX token this contract mints after the external one-time authority binding.
    GBX public immutable gbx;
    /// @notice Standard, non-rebasing USDG token paid in raw units to replace mining slots.
    IERC20 public immutable usdg;
    /// @notice Router receiving the nominal Resonance share of replacement payments for later routing.
    address public immutable resonanceRouter;
    /// @notice Unix timestamp anchoring the immutable time-based halving schedule.
    uint256 public immutable startTime;
    /// @notice Sum of all occupied slots' tenure-locked rates, in raw GBX units per second.
    /// @dev May exceed the current prospective global rate while legacy tenures retain higher pre-halving rates.
    uint256 public aggregateTps;
    /// @notice Total unminted slot emission accrued through `pendingUpdatedAt`, in raw GBX units.
    uint256 public storedPendingEmission;
    /// @notice Unix timestamp through which `storedPendingEmission` incorporates `aggregateTps`.
    uint256 public pendingUpdatedAt;
    /// @notice Cumulative raw GBX units actually minted when individual slots were replaced.
    uint256 public totalMined;
    /// @notice Total raw USDG units currently owed to outgoing tenure miners.
    uint256 public totalClaimableMinerPayments;

    /// @notice Pull-based raw USDG replacement proceeds owed to each outgoing tenure miner.
    mapping(address account => uint256 amount) public claimableMinerPayment;
    /// @notice Mining-slot state keyed by zero-based slot index.
    mapping(uint256 slotIndex => Slot slotState) private _slots;

    /// @notice Emitted after accumulated USDG replacement proceeds are paid to a miner.
    /// @param account Outgoing tenure miner that received the payment, regardless of who initiated the claim.
    /// @param amount Raw USDG amount paid.
    event MinerPaymentClaimed(address indexed account, uint256 amount);
    /// @notice Emitted after one outgoing miner's complete tenure emission is minted.
    /// @param miner Outgoing miner that received the minted GBX.
    /// @param slotIndex Zero-based index of the settled slot.
    /// @param epochId Identifier of the tenure that was settled.
    /// @param amount Raw GBX amount minted for the tenure.
    event EmissionSettled(address indexed miner, uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount);
    /// @notice Emitted after one mining slot begins a new tenure, including a possible self-replacement.
    /// @param payer Account that initiated the replacement and supplied any nonzero USDG payment.
    /// @param miner Incoming miner assigned to the slot.
    /// @param slotIndex Zero-based index of the replaced slot.
    /// @param epochId Slot epoch identifier consumed by this replacement.
    /// @param previousMiner Outgoing tenure miner, possibly equal to `miner`, or zero if the slot was empty.
    /// @param paymentAmount Raw USDG price paid at execution time.
    /// @param nextInitialPrice Raw USDG starting price assigned to the next auction.
    /// @param tps Incoming miner's tenure-locked rate, in raw GBX units per second.
    /// @param message Event-only message supplied by the caller.
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
    /// @notice Emitted after replacement proceeds become claimable by an outgoing tenure miner.
    /// @param miner Outgoing tenure miner entitled to the payment.
    /// @param slotIndex Zero-based index of the replaced slot.
    /// @param epochId Identifier of the outgoing tenure.
    /// @param amount Raw USDG amount accrued, rounded down from the configured basis-point share.
    event MinerPaymentAccrued(
        address indexed miner, uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount
    );
    /// @notice Emitted after the nominal protocol share is transferred to ResonanceRouter for later routing.
    /// @dev Under the supported standard USDG model, a successful `SafeERC20` transfer delivers `amount` to the Router.
    ///      The event does not assert that the Router subsequently forwarded the USDG to Resonance.
    /// @param slotIndex Zero-based index of the replaced slot.
    /// @param epochId Slot epoch identifier consumed by the replacement.
    /// @param amount Raw USDG amount transferred to ResonanceRouter.
    event RevenueDeposited(uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount);

    /// @notice The caller-supplied mining deadline has passed.
    /// @param deadline Latest Unix timestamp at which execution was permitted.
    error DeadlinePassed(uint256 deadline);
    /// @notice The caller's expected slot epoch differs from current state.
    /// @param expected Epoch identifier supplied by the caller.
    /// @param actual Current epoch identifier stored for the slot.
    error EpochIdMismatch(uint256 expected, uint256 actual);
    /// @notice A slot index is outside the immutable sixteen-slot range.
    /// @param slotIndex Invalid zero-based slot index supplied by the caller.
    error IndexOutOfBounds(uint256 slotIndex);
    /// @notice The current replacement payment exceeds the caller's slippage ceiling.
    /// @param paymentAmount Raw USDG price required at execution time.
    /// @param maximumPayment Maximum raw USDG amount authorized by the caller.
    error MaximumPaymentExceeded(uint256 paymentAmount, uint256 maximumPayment);
    /// @notice The event-only mining message exceeds the raw-byte limit.
    /// @param length Actual message length in raw bytes.
    error MessageTooLong(uint256 length);
    /// @notice An account has no accumulated replacement payment to claim.
    /// @param account Account whose claimable USDG balance is zero.
    error NothingToClaim(address account);
    /// @notice A required deployment dependency lacks a deployed contract or a required account is the zero address.
    error ZeroAddress();

    /// @notice Creates the immutable mining market with sixteen empty slots.
    /// @dev Requires all three dependencies to contain deployed code. Reciprocal GBX mint-authority binding and the
    ///      Router's USDG identity are deployment-time checks performed outside this constructor.
    /// @param gbx_ GBX token this Mine will mint after the one-time authority handoff.
    /// @param usdg_ Standard USDG token paid by miners in raw units.
    /// @param resonanceRouter_ Router that receives each nominal protocol payment share.
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

    /// @notice Starts a new tenure in one slot at its current linearly decaying USDG price.
    /// @dev Permissionless and non-reentrant. The caller pays for any nonzero price, while `miner` receives the tenure.
    ///      The outgoing slot is settled before its rate is replaced. For a nonempty slot, 80% of the payment rounded
    ///      down becomes a pull claim and the remainder goes to ResonanceRouter; an empty slot sends 100% to the
    ///      Router. The optional message is emitted in `Mined` and is never stored. Every success emits `Mined`; an
    ///      occupied tenure may additionally emit `EmissionSettled` and `MinerPaymentAccrued`, and any nonzero protocol
    ///      share emits `RevenueDeposited`. Execution is allowed at `deadline` exactly.
    /// @param miner Account receiving the slot and its later GBX emission.
    /// @param slotIndex Zero-based slot to replace.
    /// @param expectedEpochId Expected slot epoch, protecting against an earlier replacement.
    /// @param deadline Latest Unix timestamp at which the replacement may execute.
    /// @param maximumPayment Maximum raw USDG payment accepted by the caller.
    /// @param message Optional event-only message of at most `MAX_MESSAGE_BYTES` raw bytes.
    /// @return paymentAmount Actual raw USDG payment required at execution time.
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

    /// @notice Pays an account's complete accumulated outgoing-tenure USDG claim.
    /// @dev Permissionless and non-reentrant: the caller may trigger another account's claim, but payment always goes
    ///      directly to `account`. State is cleared before the supported standard USDG transfer is requested, and
    ///      `MinerPaymentClaimed` is emitted after payment.
    /// @param account Outgoing tenure miner receiving its complete claim in raw USDG units.
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
    /// @dev The elapsed decay component rounds down, and the returned price is zero at or after one decay period.
    /// @param slotIndex Zero-based slot to quote.
    /// @return paymentAmount Current replacement payment in raw USDG units.
    function currentPrice(uint256 slotIndex) external view returns (uint256 paymentAmount) {
        if (slotIndex >= SLOT_COUNT) revert IndexOutOfBounds(slotIndex);
        return _price(_slots[slotIndex]);
    }

    /// @notice Returns the complete state of one mining slot without accruing or settling it.
    /// @param slotIndex Zero-based slot to read.
    /// @return slotState Current slot state.
    function slot(uint256 slotIndex) external view returns (Slot memory slotState) {
        if (slotIndex >= SLOT_COUNT) revert IndexOutOfBounds(slotIndex);
        return _slots[slotIndex];
    }

    /// @notice Returns accrued unminted GBX for one slot without changing its state.
    /// @param slotIndex Zero-based slot to read.
    /// @return amount Accrued unminted GBX for the slot, in raw units; zero while the slot is empty.
    function pendingSlotEmission(uint256 slotIndex) external view returns (uint256 amount) {
        if (slotIndex >= SLOT_COUNT) revert IndexOutOfBounds(slotIndex);
        Slot memory slotState = _slots[slotIndex];
        if (slotState.miner == address(0)) return 0;
        return (block.timestamp - slotState.lastAccruedAt) * slotState.tps;
    }

    /// @notice Returns total accrued unminted GBX in constant time across all sixteen slots.
    /// @dev Combines the stored accumulator with elapsed whole-second emission at the current aggregate rate.
    /// @return amount Complete accrued unminted GBX amount in raw units.
    function pendingEmission() public view returns (uint256 amount) {
        return storedPendingEmission + (block.timestamp - pendingUpdatedAt) * aggregateTps;
    }

    /// @notice Returns current GBX total supply plus all accrued unminted mining emission.
    /// @dev This constant-time view does not mint GBX, settle a slot, or change an occupied tenure's rate.
    /// @return amount Economically effective GBX supply in raw units.
    function effectiveTotalSupply() external view returns (uint256 amount) {
        return gbx.totalSupply() + pendingEmission();
    }

    /// @notice Returns the global rate that the next replacement will divide by sixteen.
    /// @dev The rate halves at completed `HALVING_PERIOD` boundaries after deployment and never falls below `TAIL_TPS`.
    ///      A new tenure receives this rate divided by `SLOT_COUNT`, rounded down. Existing occupied slots retain their
    ///      previously assigned rates.
    /// @return tps Prospective global emission rate in raw GBX units per second.
    function nextGlobalTps() external view returns (uint256 tps) {
        return _globalTps();
    }

    /// @dev Incorporates elapsed whole-second emission at the old aggregate rate before any slot settlement or rate
    ///      mutation, then advances the accumulator timestamp to the current block timestamp.
    function _accruePendingEmission() private {
        storedPendingEmission = pendingEmission();
        pendingUpdatedAt = block.timestamp;
    }

    /// @dev Mints the selected outgoing slot's complete tenure accrual and removes that amount from global pending
    ///      supply. Empty tenures and zero-duration tenures have no effect.
    /// @param slotIndex Zero-based slot index included in the settlement event.
    /// @param previousSlot Snapshot of the outgoing tenure taken before the replacement.
    function _settleSlot(uint256 slotIndex, Slot memory previousSlot) private {
        if (previousSlot.miner == address(0)) return;

        uint256 amount = (block.timestamp - previousSlot.lastAccruedAt) * previousSlot.tps;
        if (amount == 0) return;

        storedPendingEmission -= amount;
        totalMined += amount;
        gbx.mint(previousSlot.miner, amount);
        emit EmissionSettled(previousSlot.miner, slotIndex, previousSlot.epochId, amount);
    }

    /// @dev Credits a nonempty slot's outgoing tenure miner with the floored 80% share and returns the exhaustive
    ///      remainder for ResonanceRouter. An empty slot assigns the complete payment to the Router; a zero payment
    ///      assigns zero.
    /// @param previousMiner Outgoing tenure miner, or the zero address if the slot was empty.
    /// @param slotIndex Zero-based slot index included in any accrual event.
    /// @param epochId Identifier of the tenure consumed by the replacement.
    /// @param paymentAmount Raw USDG payment to allocate.
    /// @return revenueAmount Raw USDG amount assigned to ResonanceRouter.
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

    /// @dev Pulls the complete raw USDG payment from `payer`, then requests a transfer of the nominal protocol share
    ///      to ResonanceRouter. The retained balance backs outgoing-tenure pull claims. Sender and receiver balance
    ///      deltas are not checked because USDG is assumed to be a standard, non-rebasing ERC-20.
    /// @param payer Account funding the replacement.
    /// @param slotIndex Zero-based slot index included in the revenue event.
    /// @param epochId Identifier of the tenure consumed by the replacement.
    /// @param paymentAmount Complete raw USDG amount pulled from `payer`.
    /// @param revenueAmount Raw USDG amount transferred to ResonanceRouter.
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

    /// @dev Multiplies a paid price by `PRICE_MULTIPLIER`, then clamps it inclusively between the configured raw-USDG
    ///      starting-price bounds.
    /// @param paymentAmount Raw USDG amount paid for the completed replacement.
    /// @return nextInitialPrice Raw USDG starting price for the next auction.
    function _nextInitialPrice(uint256 paymentAmount) private pure returns (uint256 nextInitialPrice) {
        nextInitialPrice = paymentAmount * PRICE_MULTIPLIER;
        if (nextInitialPrice > MAX_INITIAL_PRICE) return MAX_INITIAL_PRICE;
        if (nextInitialPrice < MIN_INITIAL_PRICE) return MIN_INITIAL_PRICE;
    }

    /// @dev Computes the prospective global rate by right-shifting `INITIAL_TPS` once per completed halving period and
    ///      applying the strict `TAIL_TPS` floor.
    /// @return tps Prospective global rate in raw GBX units per second.
    function _globalTps() private view returns (uint256 tps) {
        uint256 halvings = (block.timestamp - startTime) / HALVING_PERIOD;
        tps = INITIAL_TPS >> halvings;
        if (tps < TAIL_TPS) tps = TAIL_TPS;
    }

    /// @dev Computes an auction's current price by subtracting the floored elapsed linear-decay amount. Returns zero
    ///      once `PRICE_DECAY_PERIOD` has elapsed.
    /// @param slotState Slot snapshot whose active auction is being quoted.
    /// @return amount Current replacement price in raw USDG units.
    function _price(Slot memory slotState) private view returns (uint256 amount) {
        uint256 elapsed = block.timestamp - slotState.auctionStartedAt;
        if (elapsed >= PRICE_DECAY_PERIOD) return 0;
        return slotState.initialPrice - Math.mulDiv(slotState.initialPrice, elapsed, PRICE_DECAY_PERIOD);
    }

    /// @dev Constructs an empty slot at epoch one with the minimum auction price and timestamps anchored to this block.
    /// @return slotState Initialized empty-slot state with no miner and a zero emission rate.
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
