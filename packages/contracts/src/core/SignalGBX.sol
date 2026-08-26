// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IResonance } from "./interfaces/IResonance.sol";
import { IResonanceIdentity } from "./interfaces/IResonanceIdentity.sol";

/// @title GumBall6900 Non-Transferable Signal Token
/// @author heesho
/// @notice Escrows GBX one-for-one as non-transferable sGBX while assigning the same raw amount to live Strategies.
/// @dev SignalGBX is the sole public signal coordinator. Idle receipts are unreachable through supported operations:
///      every mint includes one or more Resonance signal additions, and every burn includes the matching removals.
///      The receipt inherits block-number-based ERC20Votes delegation and checkpoints, but not ERC-2612 permit; ERC-20
///      approvals remain exposed while every direct receipt transfer, including a zero-value transfer, reverts. Signal
///      token transfers assume standard, non-rebasing GBX behavior. Setup ownership does not expire when Resonance is
///      bound: it retains inherited ownership transfer and renunciation until explicitly removed, although no custom
///      owner action remains after binding.
contract SignalGBX is ERC20, ERC20Votes, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice One Strategy allocation within a batched signal addition or removal.
    /// @param strategy Strategy whose signal weight changes.
    /// @param amount Nonzero raw units of GBX, sGBX, and signal weight changed.
    struct Allocation {
        address strategy;
        uint256 amount;
    }

    /// @notice Returns the immutable underlying GBX escrowed one raw unit per raw sGBX unit minted.
    /// @dev Direct GBX donations create stranded surplus: they mint no receipt, signal weight, or voting units and
    ///      provide no additional withdrawal entitlement.
    IERC20 public immutable gbx;

    /// @notice Returns the permanently bound Resonance that applies signal changes, or zero before setup completes.
    address public resonance;

    /// @notice Emitted after an account deposits GBX, receives sGBX, and assigns matching signal to a Strategy.
    /// @param account Signaler whose GBX was deposited and whose sGBX balance increased.
    /// @param strategy Live Strategy that received the signal weight.
    /// @param amount Equal raw units of GBX deposited, sGBX minted, and signal weight added.
    event Signaled(address indexed account, address indexed strategy, uint256 amount);
    /// @notice Emitted after an account removes signal, burns sGBX, and receives matching GBX.
    /// @param account Signaler whose sGBX was burned and who received the underlying GBX.
    /// @param strategy Strategy from which signal weight was removed; it may already be killed.
    /// @param amount Equal raw units of signal removed, sGBX burned, and GBX returned.
    event SignalWithdrawn(address indexed account, address indexed strategy, uint256 amount);
    /// @notice Emitted when this receipt completes its one-time Resonance binding.
    /// @param resonance Permanently bound Resonance address.
    event ResonanceSet(address indexed resonance);

    /// @notice Raised when a candidate Resonance fails to report this contract as its SignalGBX receipt.
    /// @param resonance Candidate that reverted, lacked the identity getter, or returned another receipt.
    error InvalidResonance(address resonance);
    /// @notice Raised when an inherited ERC-20 transfer attempts to move sGBX between two nonzero addresses.
    error TransferDisabled();
    /// @notice Raised when the owner attempts to repeat the one-time Resonance binding.
    /// @param resonance Existing bound Resonance address.
    error ResonanceAlreadySet(address resonance);
    /// @notice Raised when a signal addition or removal is attempted before Resonance is bound.
    error ResonanceNotSet();
    /// @notice Raised when GBX or a candidate Resonance is zero or has no deployed code.
    error ZeroAddress();
    /// @notice Raised when a signal operation has no allocations or requests zero raw units.
    error ZeroAmount();

    /// @notice Creates the `SignalGumBall6900` (`sGBX`) receipt and assigns deployment-time setup ownership.
    /// @dev Uses 18 decimals inherited from ERC-20 and EIP-712 version `1` for ERC20Votes signatures. Reverts with
    ///      `ZeroAddress` unless `gbx_` is a nonzero contract. OpenZeppelin `Ownable` rejects a zero `initialOwner`;
    ///      renouncing ownership before binding Resonance permanently prevents signaling setup from completing.
    /// @param gbx_ Standard ERC-20 GBX token deposited and returned one-for-one in raw units.
    /// @param initialOwner Deployment-time owner responsible for the one-time Resonance binding.
    constructor(IERC20 gbx_, address initialOwner)
        ERC20("SignalGumBall6900", "sGBX")
        EIP712("SignalGumBall6900", "1")
        Ownable(initialOwner)
    {
        if (address(gbx_) == address(0) || address(gbx_).code.length == 0) {
            revert ZeroAddress();
        }
        gbx = gbx_;
    }

    /// @notice Deposits GBX, mints equal sGBX, and assigns equal signal weight to one live Strategy atomically.
    /// @dev Pulls GBX from the caller using its existing allowance. If the caller has no current delegate, the newly
    ///      minted voting units self-delegate; an existing delegate is preserved. Resonance and the paired Bribe then
    ///      checkpoint prior weights before adding the signal. Any failed transfer, mint, or Resonance hook reverts the
    ///      complete transition. The function is unavailable before the one-time Resonance binding. Emits `Signaled`
    ///      after the complete transition; inherited mint and delegation events and downstream signal events also
    ///      apply.
    /// @param strategy Registered live Strategy receiving the complete new signal weight.
    /// @param amount Nonzero raw units of GBX deposited, sGBX minted, and signal weight assigned.
    function addSignal(address strategy, uint256 amount) external nonReentrant {
        _requireAmount(amount);
        IResonance configuredResonance = _configuredResonance();

        _depositAndMint(msg.sender, amount);
        _addSignal(configuredResonance, msg.sender, strategy, amount);
    }

    /// @notice Deposits GBX once, mints equal sGBX once, and assigns the total across live Strategies atomically.
    /// @dev Rejects an empty array or any zero amount. Duplicate Strategies behave like sequential scalar additions.
    ///      Amounts are summed with checked arithmetic before custody changes. After the aggregate deposit and mint,
    ///      each allocation executes the canonical Resonance hook and emits `Signaled`; any failure reverts the entire
    ///      batch, including allowance consumption, custody, supply, votes, and earlier allocations.
    /// @param allocations Nonempty list of live Strategy allocations with nonzero raw-unit amounts.
    function addSignalMany(Allocation[] calldata allocations) external nonReentrant {
        uint256 totalAmount = _totalAmount(allocations);
        IResonance configuredResonance = _configuredResonance();

        _depositAndMint(msg.sender, totalAmount);

        uint256 length = allocations.length;
        for (uint256 i; i < length; ++i) {
            Allocation calldata allocation = allocations[i];
            _addSignal(configuredResonance, msg.sender, allocation.strategy, allocation.amount);
        }
    }

    /// @notice Removes signal weight, burns equal sGBX, and returns equal GBX to the caller atomically.
    /// @dev Resonance first checkpoints revenue and the paired Bribe checkpoints rewards under the prior weight. Exits
    ///      remain available when `strategy` is killed. Burning updates ERC20Votes checkpoints before GBX is
    ///      transferred; a failed hook, burn, or transfer reverts the transition. Direct GBX donations are not part of
    ///      the one-for-one entitlement.
    ///      No cooldown, epoch restriction, or withdrawal lock applies. Emits `SignalWithdrawn` after completion;
    ///      inherited burn events and downstream removal events also apply.
    /// @param strategy Strategy losing signal weight; may already be killed.
    /// @param amount Nonzero raw units of signal removed, sGBX burned, and GBX returned.
    function removeSignal(address strategy, uint256 amount) external nonReentrant {
        _requireAmount(amount);
        IResonance configuredResonance = _configuredResonance();

        _removeSignal(configuredResonance, msg.sender, strategy, amount);
        _burnAndWithdraw(msg.sender, amount);

        emit SignalWithdrawn(msg.sender, strategy, amount);
    }

    /// @notice Removes signal from multiple Strategies, burns aggregate sGBX once, and returns aggregate GBX once.
    /// @dev Rejects an empty array or any zero amount. Duplicate Strategies behave like sequential scalar removals.
    ///      Amounts are summed with checked arithmetic before any hook runs. Each allocation executes the canonical
    ///      Resonance removal hook, including for killed Strategies. After every removal, the aggregate receipt is
    ///      burned, GBX is returned, and one `SignalWithdrawn` event is emitted per allocation. Any failure reverts the
    ///      complete batch.
    /// @param allocations Nonempty list of Strategy allocations with nonzero raw-unit amounts to remove.
    function removeSignalMany(Allocation[] calldata allocations) external nonReentrant {
        uint256 totalAmount = _totalAmount(allocations);
        IResonance configuredResonance = _configuredResonance();

        uint256 length = allocations.length;
        for (uint256 i; i < length; ++i) {
            Allocation calldata allocation = allocations[i];
            _removeSignal(configuredResonance, msg.sender, allocation.strategy, allocation.amount);
        }

        _burnAndWithdraw(msg.sender, totalAmount);

        for (uint256 i; i < length; ++i) {
            Allocation calldata allocation = allocations[i];
            emit SignalWithdrawn(msg.sender, allocation.strategy, allocation.amount);
        }
    }

    /// @notice Permanently binds the Resonance dependency after reciprocal SignalGBX identity validation.
    /// @dev Callable only by the current owner and only while `resonance` is zero. The candidate must be a nonzero
    ///      contract whose `signalGBX()` identity getter returns this receipt; a failed call or mismatch reverts with
    ///      `InvalidResonance`. Successful binding emits `ResonanceSet` and has no replacement path. It does not
    ///      automatically transfer or renounce inherited ownership.
    /// @param resonance_ Resonance contract address to validate and bind.
    function setResonance(address resonance_) external onlyOwner {
        if (resonance != address(0)) revert ResonanceAlreadySet(resonance);
        if (resonance_ == address(0) || resonance_.code.length == 0) revert ZeroAddress();
        IResonanceIdentity resonanceIdentity = IResonanceIdentity(resonance_);
        try resonanceIdentity.signalGBX() returns (address configuredSignalGBX) {
            if (configuredSignalGBX != address(this)) revert InvalidResonance(resonance_);
        } catch {
            revert InvalidResonance(resonance_);
        }

        resonance = resonance_;

        emit ResonanceSet(resonance_);
    }

    /// @dev Pulls raw GBX from `account`, mints equal sGBX, and self-delegates only when the account currently has no
    ///      delegate. The caller performs Resonance signaling after this helper so the full transaction remains atomic.
    /// @param account GBX owner, sGBX recipient, and potential self-delegate.
    /// @param amount Raw GBX units pulled and equal sGBX units minted.
    function _depositAndMint(address account, uint256 amount) private {
        gbx.safeTransferFrom(account, address(this), amount);
        _mint(account, amount);

        // An account with no current delegate self-delegates, activating vote checkpoints without a second transaction.
        if (delegates(account) == address(0)) _delegate(account, account);
    }

    /// @dev Applies one canonical Resonance addition and emits the public receipt-level event.
    function _addSignal(IResonance configuredResonance, address account, address strategy, uint256 amount) private {
        configuredResonance.addSignalFor(account, strategy, amount);
        emit Signaled(account, strategy, amount);
    }

    /// @dev Applies one canonical Resonance removal. The caller emits after aggregate custody changes complete.
    function _removeSignal(IResonance configuredResonance, address account, address strategy, uint256 amount) private {
        configuredResonance.removeSignalFor(account, strategy, amount);
    }

    /// @dev Burns raw sGBX and transfers the same raw GBX amount to `account`; transfer failure reverts the burn.
    /// @param account Account whose receipt is burned and that receives GBX.
    /// @param amount Raw sGBX units burned and equal GBX units transferred.
    function _burnAndWithdraw(address account, uint256 amount) private {
        _burn(account, amount);
        gbx.safeTransfer(account, amount);
    }

    /// @notice Applies ERC-20 and voting checkpoints only to permitted mint or burn balance changes.
    /// @dev Reverts whenever both `from` and `to` are nonzero because direct sGBX transfers would separate receipt
    ///      ownership from Resonance signal accounting. The restriction also applies to zero-value transfers.
    /// @param from Address tokens move from, or zero during minting.
    /// @param to Address tokens move to, or zero during burning.
    /// @param value Amount moved.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        if (from != address(0) && to != address(0)) revert TransferDisabled();
        super._update(from, to, value);
    }

    /// @dev Loads the one-time Resonance binding and rejects signal operations while setup is incomplete.
    /// @return configuredResonance Bound Resonance interface.
    function _configuredResonance() private view returns (IResonance configuredResonance) {
        configuredResonance = IResonance(resonance);
        if (address(configuredResonance) == address(0)) revert ResonanceNotSet();
    }

    /// @dev Reverts with `ZeroAmount` unless a signal operation uses a nonzero raw-unit amount.
    /// @param amount Signal operation amount to validate.
    function _requireAmount(uint256 amount) private pure {
        if (amount == 0) revert ZeroAmount();
    }

    /// @dev Returns the checked sum of a nonempty allocation list and rejects every zero-valued entry.
    function _totalAmount(Allocation[] calldata allocations) private pure returns (uint256 totalAmount) {
        uint256 length = allocations.length;
        if (length == 0) revert ZeroAmount();
        for (uint256 i; i < length; ++i) {
            uint256 amount = allocations[i].amount;
            _requireAmount(amount);
            totalAmount += amount;
        }
    }
}
