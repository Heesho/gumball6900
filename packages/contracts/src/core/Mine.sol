// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { GBX } from "./GBX.sol";
import { IResonanceRouter } from "./interfaces/IResonanceRouter.sol";

/// @title GUM BALL 6900 Multislot Mine
/// @author Heesho
/// @notice Distributes GBX through independently replaceable mining slots priced by reverse Dutch auctions.
/// @dev Adapted from Farplace MineRig. A replacement pays USDG, the displaced miner accrues 80% as a pull claim,
///      and the remainder is routed into Resonance. Slot capacity starts at one and may only increase. Each occupied
///      slot keeps its assigned rate until replacement; capacity changes and mining thresholds never dilute a miner
///      mid-tenure. A newly occupied or replaced slot receives the current global rate divided by current capacity.
/// @custom:version 1.0.0
contract Mine is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Basis-point denominator used by the replacement payment split.
    uint256 public constant BPS = 10_000;
    /// @notice Share of a nonempty-slot payment owed to the displaced miner.
    uint256 public constant PREVIOUS_MINER_BPS = 8_000;
    /// @notice Fixed-point precision used by the next-price multiplier.
    uint256 public constant PRICE_PRECISION = 1e18;
    /// @notice Time over which a slot replacement price decays linearly to zero.
    uint256 public constant PRICE_DECAY_PERIOD = 1 hours;
    /// @notice Immutable upper bound on concurrently open mining slots.
    uint256 public constant MAX_CAPACITY = 16;
    /// @notice Smallest constructor-supported next-price multiplier.
    uint256 public constant MIN_PRICE_MULTIPLIER = 1.1e18;
    /// @notice Largest constructor-supported next-price multiplier.
    uint256 public constant MAX_PRICE_MULTIPLIER = 3e18;
    /// @notice Smallest constructor-supported initial USDG price.
    uint256 public constant MIN_INITIAL_PRICE = 1e6;
    /// @notice Largest supported initial USDG price.
    uint256 public constant MAX_INITIAL_PRICE = type(uint192).max;
    /// @notice Largest constructor-supported initial global GBX-per-second rate.
    uint256 public constant MAX_INITIAL_UPS = 1e24;
    /// @notice Smallest tail rate that keeps a new slot positive at maximum capacity.
    uint256 public constant MIN_TAIL_UPS = MAX_CAPACITY;
    /// @notice Smallest supported cumulative mining amount for the first halving.
    uint256 public constant MIN_HALVING_AMOUNT = 1_000 ether;
    /// @notice Largest supported cumulative mining amount for the first halving.
    uint256 public constant MAX_HALVING_AMOUNT = 1e27;

    /// @notice GBX token issued by this Mine after the permanent handoff.
    GBX public immutable gbx;
    /// @notice Exact-transfer USDG token used for replacement payments.
    IERC20 public immutable usdg;
    /// @notice Permissionless router that receives mining revenue.
    address public immutable resonanceRouter;
    /// @notice Immutable multiplier used to derive a slot's next opening price.
    uint256 public immutable priceMultiplier;
    /// @notice Immutable lower bound for every next slot opening price.
    uint256 public immutable minimumInitialPrice;
    /// @notice Initial global GBX-per-second rate offered to future handoffs.
    uint256 public immutable initialUps;
    /// @notice Cumulative mining amount at the first future-handoff rate halving.
    uint256 public immutable halvingAmount;
    /// @notice Strictly positive global GBX-per-second rate floor.
    uint256 public immutable tailUps;

    /// @notice Number of open slot indices; begins at one and only increases.
    uint256 public capacity = 1;
    /// @notice Cumulative GBX minted through slot checkpoints.
    uint256 public totalMined;
    /// @notice Total USDG currently owed to displaced miners.
    uint256 public totalClaimable;

    /// @notice Current state of each mining slot index.
    mapping(uint256 index => Slot slot) public slots;
    /// @notice USDG pull claim owed to each displaced miner.
    mapping(address account => uint256 amount) public claimable;

    struct Config {
        uint256 priceMultiplier;
        uint256 minimumInitialPrice;
        uint256 initialUps;
        uint256 halvingAmount;
        uint256 tailUps;
    }

    struct Slot {
        uint256 epochId;
        uint256 initialPrice;
        uint256 auctionStartedAt;
        uint256 lastAccruedAt;
        uint256 ups;
        address miner;
    }

    event CapacityIncreased(uint256 previousCapacity, uint256 newCapacity);
    event Claimed(address indexed account, uint256 amount);
    event EmissionCheckpointed(address indexed miner, uint256 indexed index, uint256 indexed epochId, uint256 amount);
    event Mined(
        address indexed payer,
        address indexed miner,
        uint256 indexed index,
        uint256 epochId,
        address previousMiner,
        uint256 price,
        uint256 initialPrice,
        uint256 ups
    );
    event MinerPaymentAccrued(address indexed miner, uint256 indexed index, uint256 indexed epochId, uint256 amount);
    event RevenueRouted(uint256 indexed index, uint256 indexed epochId, uint256 amount);

    error CapacityNotIncreased(uint256 currentCapacity, uint256 requestedCapacity);
    error CapacityTooHigh(uint256 requestedCapacity);
    error DeadlinePassed(uint256 deadline);
    error EpochIdMismatch(uint256 expected, uint256 actual);
    error HalvingAmountOutOfRange(uint256 amount);
    error InexactTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    error IndexOutOfBounds(uint256 index);
    error InitialPriceOutOfRange(uint256 price);
    error InitialUpsOutOfRange(uint256 ups);
    error MaxPriceExceeded(uint256 price, uint256 maximumPrice);
    error MiningAuthorityNotFinalized(address minter, bool locked);
    error NothingToClaim(address account);
    error PriceMultiplierOutOfRange(uint256 multiplier);
    error TailUpsOutOfRange(uint256 ups);
    error UnexpectedRevenueToken(address expected, address actual);
    error ZeroAddress();

    /// @notice Creates the immutable mining market with one empty slot.
    /// @param gbx_ GBX token that will permanently bind this contract as minter.
    /// @param usdg_ Exact-transfer token paid by incoming miners.
    /// @param resonanceRouter_ Router receiving the protocol share of replacement payments.
    /// @param initialOwner Timelock or setup owner allowed only to increase capacity.
    /// @param config Immutable price and future-handoff emission configuration.
    constructor(GBX gbx_, IERC20 usdg_, address resonanceRouter_, address initialOwner, Config memory config)
        Ownable(initialOwner)
    {
        if (
            address(gbx_) == address(0) || address(usdg_) == address(0) || resonanceRouter_ == address(0)
                || initialOwner == address(0) || address(gbx_).code.length == 0 || address(usdg_).code.length == 0
                || resonanceRouter_.code.length == 0
        ) revert ZeroAddress();
        if (config.priceMultiplier < MIN_PRICE_MULTIPLIER || config.priceMultiplier > MAX_PRICE_MULTIPLIER) {
            revert PriceMultiplierOutOfRange(config.priceMultiplier);
        }
        if (config.minimumInitialPrice < MIN_INITIAL_PRICE || config.minimumInitialPrice > MAX_INITIAL_PRICE) {
            revert InitialPriceOutOfRange(config.minimumInitialPrice);
        }
        if (config.initialUps == 0 || config.initialUps > MAX_INITIAL_UPS) {
            revert InitialUpsOutOfRange(config.initialUps);
        }
        if (config.tailUps < MIN_TAIL_UPS || config.tailUps > config.initialUps) {
            revert TailUpsOutOfRange(config.tailUps);
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
        initialUps = config.initialUps;
        halvingAmount = config.halvingAmount;
        tailUps = config.tailUps;

        slots[0] = _emptySlot();
    }

    /// @notice Replaces one slot's miner at its current linearly decaying USDG price.
    /// @param miner Account that receives subsequent GBX emissions for the slot.
    /// @param index Slot index below current capacity.
    /// @param epochId Expected slot epoch used for frontrun protection.
    /// @param deadline Latest timestamp at which this transaction may execute.
    /// @param maximumPrice Maximum USDG price accepted by the payer.
    /// @return paid Actual USDG price paid.
    function mine(address miner, uint256 index, uint256 epochId, uint256 deadline, uint256 maximumPrice)
        external
        nonReentrant
        returns (uint256 paid)
    {
        if (miner == address(0)) revert ZeroAddress();
        if (index >= capacity) revert IndexOutOfBounds(index);
        if (block.timestamp > deadline) revert DeadlinePassed(deadline);
        _requireMiningAuthority();

        Slot memory previousSlot = slots[index];
        if (epochId != previousSlot.epochId) revert EpochIdMismatch(epochId, previousSlot.epochId);

        paid = _price(previousSlot);
        if (paid > maximumPrice) revert MaxPriceExceeded(paid, maximumPrice);

        _checkpointAll();

        uint256 revenueAmount = _allocatePayment(previousSlot.miner, index, epochId, paid);

        uint256 nextInitialPrice = Math.mulDiv(paid, priceMultiplier, PRICE_PRECISION);
        if (nextInitialPrice > MAX_INITIAL_PRICE) {
            nextInitialPrice = MAX_INITIAL_PRICE;
        } else if (nextInitialPrice < minimumInitialPrice) {
            nextInitialPrice = minimumInitialPrice;
        }

        slots[index] = Slot({
            epochId: epochId + 1,
            initialPrice: nextInitialPrice,
            auctionStartedAt: block.timestamp,
            lastAccruedAt: block.timestamp,
            ups: _globalUps(totalMined) / capacity,
            miner: miner
        });

        if (paid != 0) _collectAndRoute(msg.sender, index, epochId, paid, revenueAmount);

        _emitMined(msg.sender, miner, index, epochId, previousSlot.miner, paid);
    }

    function _emitMined(
        address payer,
        address currentMiner,
        uint256 index,
        uint256 epochId,
        address previousMiner,
        uint256 paid
    ) private {
        Slot storage slot = slots[index];
        emit Mined(payer, currentMiner, index, epochId, previousMiner, paid, slot.initialPrice, slot.ups);
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

    /// @notice Mints every live slot's accrued GBX without changing any occupied slot's assigned rate.
    /// @dev Anyone may checkpoint. Fund calls this atomically before every redemption supply snapshot.
    function checkpointAll() external nonReentrant returns (uint256 amount) {
        _requireMiningAuthority();
        amount = _checkpointAll();
    }

    /// @notice Claims accumulated USDG replacement payments for an account.
    /// @dev Anyone may trigger a claim, but payment always goes to `account`.
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

    /// @notice Permanently opens more concurrent slots without repricing any occupied slot.
    function increaseCapacity(uint256 newCapacity) external onlyOwner nonReentrant {
        uint256 previousCapacity = capacity;
        if (newCapacity <= previousCapacity) revert CapacityNotIncreased(previousCapacity, newCapacity);
        if (newCapacity > MAX_CAPACITY) revert CapacityTooHigh(newCapacity);
        _requireMiningAuthority();

        _checkpointAll();
        capacity = newCapacity;

        for (uint256 i = previousCapacity; i < newCapacity; ++i) {
            slots[i] = _emptySlot();
        }

        emit CapacityIncreased(previousCapacity, newCapacity);
    }

    /// @notice Returns the current USDG replacement price for one slot.
    function price(uint256 index) external view returns (uint256 amount) {
        if (index >= capacity) revert IndexOutOfBounds(index);
        return _price(slots[index]);
    }

    /// @notice Returns the complete state of one current slot.
    function getSlot(uint256 index) external view returns (Slot memory slot) {
        if (index >= capacity) revert IndexOutOfBounds(index);
        return slots[index];
    }

    /// @notice Returns accrued unminted GBX for one live slot.
    function pendingEmission(uint256 index) public view returns (uint256 amount) {
        if (index >= capacity) revert IndexOutOfBounds(index);
        Slot memory slot = slots[index];
        if (slot.miner == address(0)) return 0;
        return (block.timestamp - slot.lastAccruedAt) * slot.ups;
    }

    /// @notice Returns accrued unminted GBX across every live slot.
    function pendingEmission() public view returns (uint256 amount) {
        uint256 slotCount = capacity;
        for (uint256 i; i < slotCount; ++i) {
            amount += pendingEmission(i);
        }
    }

    /// @notice Returns minted GBX supply plus all live slots' accrued unminted rewards.
    function effectiveTotalSupply() external view returns (uint256 amount) {
        return gbx.totalSupply() + pendingEmission();
    }

    /// @notice Returns the global rate that would apply immediately after a checkpoint.
    function nextGlobalUps() external view returns (uint256 ups) {
        return _globalUps(totalMined + pendingEmission());
    }

    function _checkpointAll() private returns (uint256 totalAmount) {
        uint256 slotCount = capacity;
        uint256[] memory amounts = new uint256[](slotCount);

        for (uint256 i; i < slotCount; ++i) {
            Slot storage slot = slots[i];
            if (slot.miner == address(0)) continue;

            uint256 amount = (block.timestamp - slot.lastAccruedAt) * slot.ups;
            amounts[i] = amount;
            totalAmount += amount;
            slot.lastAccruedAt = block.timestamp;
        }

        totalMined += totalAmount;

        for (uint256 i; i < slotCount; ++i) {
            uint256 amount = amounts[i];
            if (amount == 0) continue;

            Slot storage slot = slots[i];
            gbx.mint(slot.miner, amount);
            emit EmissionCheckpointed(slot.miner, i, slot.epochId, amount);
        }
    }

    function _globalUps(uint256 mined) private view returns (uint256 ups) {
        (ups,) = _rateState(mined);
    }

    function _rateState(uint256 mined) private view returns (uint256 ups, uint256 nextThreshold) {
        uint256 halvings = 0;
        nextThreshold = halvingAmount;
        while (mined >= nextThreshold) {
            ++halvings;
            ups = initialUps >> halvings;
            if (ups <= tailUps) return (tailUps, type(uint256).max);
            nextThreshold += halvingAmount >> halvings;
        }

        ups = initialUps >> halvings;
        if (ups <= tailUps) {
            ups = tailUps;
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
            ups: 0,
            miner: address(0)
        });
    }

    function _requireMiningAuthority() private view {
        address minter = gbx.minter();
        bool locked = gbx.minterLocked();
        if (!locked || minter != address(this)) revert MiningAuthorityNotFinalized(minter, locked);
    }
}

/// @notice Token identity exposed by the permissionless Resonance revenue router.
interface IRevenueRouterIdentity is IResonanceRouter {
    /// @notice Returns the exact USDG token forwarded by the router.
    function usdg() external view returns (IERC20 token);
}
