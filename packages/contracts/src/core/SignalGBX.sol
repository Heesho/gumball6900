// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ICoreResonance } from "./interfaces/ICoreResonance.sol";
import { IResonanceIdentity } from "./interfaces/IResonanceIdentity.sol";

/// @title GumBall6900 Non-Transferable Signal Receipt
/// @author Heesho
/// @notice Non-transferable signal receipt with ticker sGBX, minted one-for-one when a holder stakes GBX.
/// @dev Adapted from Liquid Signal Governance. There is no time lock: a holder may immediately unstake any balance not
///      currently allocated to Strategies.
/// @custom:version 1.0.0
contract SignalGBX is ERC20, ERC20Votes, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Underlying GBX that backs the SignalGBX supply at least one-for-one.
    /// @dev Direct GBX donations are stranded surplus and never mint receipts or voting power.
    IERC20 public immutable gbx;

    /// @notice Resonance that applies this coordinator's per-Strategy signal changes.
    address public resonance;

    /// @notice SignalGBX allocated by each account across all live and killed Strategies.
    mapping(address account => uint256 amount) public allocatedBalance;

    /// @notice Emitted when an account deposits GBX and receives SignalGBX.
    /// @param account Account that staked.
    /// @param amount Amount of GBX deposited and SignalGBX minted.
    event Staked(address indexed account, uint256 amount);
    /// @notice Emitted when an account burns SignalGBX and withdraws GBX.
    /// @param account Account that unstaked.
    /// @param amount Amount of SignalGBX burned and GBX returned.
    event Unstaked(address indexed account, uint256 amount);
    /// @notice Emitted when the staking receipt is permanently bound to Resonance.
    /// @param resonance Bound Resonance address.
    event ResonanceSet(address indexed resonance);

    /// @notice An unstake exceeds the account's SignalGBX not allocated in Resonance.
    error ActiveSignals(address account, uint256 signalWeight);
    /// @notice The underlying token did not move by the exact requested amount at both ends of a transfer.
    /// @param expected Requested underlying amount.
    /// @param senderDebit Amount removed from the sender.
    /// @param receiverCredit Amount credited to the receiver.
    error InexactUnderlyingTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
    /// @notice A signal removal exceeds the account's complete allocated SignalGBX balance.
    error InsufficientAllocatedSignal(uint256 available, uint256 requested);
    /// @notice A signal addition exceeds the account's unallocated SignalGBX balance.
    error InsufficientUnallocatedSignal(uint256 available, uint256 requested);
    /// @notice A candidate Resonance does not point back to this SignalGBX receipt.
    error InvalidResonance(address resonance);
    /// @notice A transfer other than minting or burning was attempted.
    error TransferDisabled();
    /// @notice The one-time Resonance binding has already completed.
    error ResonanceAlreadySet(address resonance);
    /// @notice Staking was attempted before the immutable Resonance graph was validated.
    error ResonanceNotSet();
    /// @notice A required deployment or binding address is zero.
    error ZeroAddress();
    /// @notice A stake or unstake amount is zero.
    error ZeroAmount();

    /// @notice Creates the non-transferable staking receipt and assigns deployment-time ownership.
    /// @param gbx_ GBX token deposited by stakers.
    /// @param initialOwner Deployment-time owner responsible for binding Resonance.
    constructor(IERC20 gbx_, address initialOwner)
        ERC20("Signal GUM BALL 6900", "sGBX")
        EIP712("Signal GUM BALL 6900", "1")
        Ownable(initialOwner)
    {
        if (address(gbx_) == address(0) || address(gbx_).code.length == 0) {
            revert ZeroAddress();
        }
        gbx = gbx_;
    }

    /// @notice Stakes GBX after Resonance setup and mints the same amount of non-transferable SignalGBX.
    /// @param amount Amount of GBX to stake.
    function stake(uint256 amount) external nonReentrant {
        _requireAmount(amount);
        _configuredResonance();
        _stake(msg.sender, amount);
    }

    /// @notice Atomically stakes GBX and allocates the minted SignalGBX to one live Strategy.
    /// @param strategy Live Strategy receiving signal.
    /// @param amount Amount of GBX staked and SignalGBX allocated.
    function stakeAndSignal(address strategy, uint256 amount) external nonReentrant {
        _requireAmount(amount);
        address configuredResonance = _configuredResonance();

        _stake(msg.sender, amount);
        _allocate(msg.sender, amount);
        ICoreResonance(configuredResonance).addSignalFor(msg.sender, strategy, amount);
    }

    /// @notice Attempts an underlying GBX permit, then atomically stakes and signals the requested amount.
    /// @dev A pre-consumed permit may fail harmlessly because the exact underlying transfer remains authoritative.
    /// @param strategy Live Strategy receiving signal.
    /// @param amount Amount of GBX requested, staked, and SignalGBX allocated.
    /// @param deadline Permit expiry timestamp.
    /// @param v Permit recovery identifier.
    /// @param r Permit signature `r` component.
    /// @param s Permit signature `s` component.
    function stakeAndSignalWithPermit(address strategy, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        _requireAmount(amount);
        address configuredResonance = _configuredResonance();

        // A permit is permissionless to submit and may already have been consumed by an observer. In that case the
        // allowance created by the successful permit is still sufficient for `_stake`; every other failed permit
        // remains harmless because the exact `transferFrom` below is the authorization and custody backstop.
        try IERC20Permit(address(gbx)).permit(msg.sender, address(this), amount, deadline, v, r, s) { } catch { }
        _stake(msg.sender, amount);
        _allocate(msg.sender, amount);
        ICoreResonance(configuredResonance).addSignalFor(msg.sender, strategy, amount);
    }

    /// @notice Allocates existing unallocated SignalGBX to one live Strategy.
    /// @param strategy Live Strategy receiving signal.
    /// @param amount Absolute SignalGBX delta added.
    function signal(address strategy, uint256 amount) external nonReentrant {
        _requireAmount(amount);
        address configuredResonance = _configuredResonance();

        _allocate(msg.sender, amount);
        ICoreResonance(configuredResonance).addSignalFor(msg.sender, strategy, amount);
    }

    /// @notice Removes signal from one Strategy while leaving the SignalGBX idle and immediately reusable.
    /// @param strategy Strategy losing signal; exits remain available after kill.
    /// @param amount Absolute SignalGBX delta removed.
    function removeSignal(address strategy, uint256 amount) external nonReentrant {
        _requireAmount(amount);
        address configuredResonance = _configuredResonance();

        _deallocate(msg.sender, amount);
        ICoreResonance(configuredResonance).removeSignalFor(msg.sender, strategy, amount);
    }

    /// @notice Atomically moves signal from one Strategy to another without moving GBX or minting SignalGBX.
    /// @param fromStrategy Strategy losing signal; may be killed.
    /// @param toStrategy Live Strategy receiving signal.
    /// @param amount Absolute SignalGBX delta moved.
    function moveSignal(address fromStrategy, address toStrategy, uint256 amount) external nonReentrant {
        _requireAmount(amount);
        address configuredResonance = _configuredResonance();

        ICoreResonance(configuredResonance).moveSignalFor(msg.sender, fromStrategy, toStrategy, amount);
    }

    /// @notice Atomically removes signal, burns the released SignalGBX, and returns the same amount of GBX.
    /// @param strategy Strategy losing signal; exits remain available after kill.
    /// @param amount Amount of signal removed, SignalGBX burned, and GBX returned.
    function removeSignalAndUnstake(address strategy, uint256 amount) external nonReentrant {
        _requireAmount(amount);
        address configuredResonance = _configuredResonance();

        _deallocate(msg.sender, amount);
        ICoreResonance(configuredResonance).removeSignalFor(msg.sender, strategy, amount);
        _unstake(msg.sender, amount);
    }

    /// @notice Burns unallocated SignalGBX and immediately returns the same amount of underlying GBX.
    /// @dev Active signals reserve only their absolute allocated amount; they do not block withdrawal of the remainder.
    /// @param amount Amount of SignalGBX to burn and GBX to withdraw.
    function unstake(uint256 amount) external nonReentrant {
        _requireAmount(amount);
        _unstake(msg.sender, amount);
    }

    /// @notice Binds the Resonance dependency once after reciprocal SignalGBX identity validation.
    /// @param resonance_ Resonance address to bind permanently.
    function setResonance(address resonance_) external onlyOwner {
        if (resonance != address(0)) revert ResonanceAlreadySet(resonance);
        if (resonance_ == address(0) || resonance_.code.length == 0) revert ZeroAddress();
        try IResonanceIdentity(resonance_).signalGBX() returns (address configuredSignalGBX) {
            if (configuredSignalGBX != address(this)) revert InvalidResonance(resonance_);
        } catch {
            revert InvalidResonance(resonance_);
        }

        resonance = resonance_;

        emit ResonanceSet(resonance_);
    }

    function _configuredResonance() private view returns (address configuredResonance) {
        configuredResonance = resonance;
        if (configuredResonance == address(0)) revert ResonanceNotSet();
    }

    function _requireAmount(uint256 amount) private pure {
        if (amount == 0) revert ZeroAmount();
    }

    function _stake(address account, uint256 amount) private {
        uint256 senderBalanceBefore = gbx.balanceOf(account);
        uint256 receiptBalanceBefore = gbx.balanceOf(address(this));
        gbx.safeTransferFrom(account, address(this), amount);
        uint256 senderDebit = senderBalanceBefore - gbx.balanceOf(account);
        uint256 receiverCredit = gbx.balanceOf(address(this)) - receiptBalanceBefore;
        if (senderDebit != amount || receiverCredit != amount) {
            revert InexactUnderlyingTransfer(amount, senderDebit, receiverCredit);
        }
        _mint(account, amount);

        // Any stake with no current delegate self-delegates, activating vote checkpoints without a second transaction.
        if (delegates(account) == address(0)) _delegate(account, account);

        emit Staked(account, amount);
    }

    function _unstake(address account, uint256 amount) private {
        uint256 signalWeight = allocatedBalance[account];
        uint256 balance = balanceOf(account);
        if (signalWeight != 0 && (signalWeight > balance || amount > balance - signalWeight)) {
            revert ActiveSignals(account, signalWeight);
        }

        _burn(account, amount);
        uint256 receiptBalanceBefore = gbx.balanceOf(address(this));
        uint256 receiverBalanceBefore = gbx.balanceOf(account);
        gbx.safeTransfer(account, amount);
        uint256 senderDebit = receiptBalanceBefore - gbx.balanceOf(address(this));
        uint256 receiverCredit = gbx.balanceOf(account) - receiverBalanceBefore;
        if (senderDebit != amount || receiverCredit != amount) {
            revert InexactUnderlyingTransfer(amount, senderDebit, receiverCredit);
        }

        emit Unstaked(account, amount);
    }

    function _allocate(address account, uint256 amount) private {
        uint256 allocated = allocatedBalance[account];
        uint256 balance = balanceOf(account);
        uint256 available = allocated < balance ? balance - allocated : 0;
        if (amount > available) revert InsufficientUnallocatedSignal(available, amount);
        allocatedBalance[account] = allocated + amount;
    }

    function _deallocate(address account, uint256 amount) private {
        uint256 allocated = allocatedBalance[account];
        if (amount > allocated) revert InsufficientAllocatedSignal(allocated, amount);
        allocatedBalance[account] = allocated - amount;
    }

    /// @notice Applies receipt and signal-checkpoint accounting for a mint or burn.
    /// @dev Only mint and burn updates are allowed. Direct SignalGBX transfers would bypass Resonance accounting.
    /// @param from Address tokens move from, or zero during minting.
    /// @param to Address tokens move to, or zero during burning.
    /// @param value Amount moved.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        if (from != address(0) && to != address(0)) revert TransferDisabled();
        super._update(from, to, value);
    }
}
