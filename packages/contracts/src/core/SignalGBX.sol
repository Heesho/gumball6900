// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ICoreResonance } from "./interfaces/ICoreResonance.sol";

/// @title SignalGBX
/// @author GUM BALL 6900
/// @notice Non-transferable signal receipt with ticker sGBX, minted one-for-one when a holder stakes GBX.
/// @dev Adapted from Liquid Signal Governance. There is no time lock: a holder may immediately unstake any balance not
///      currently allocated to Strategies.
contract SignalGBX is ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Underlying GBX held one-for-one against the SignalGBX supply.
    IERC20 public immutable gbx;

    /// @notice Resonance that tracks whether an account still has active allocations.
    address public resonance;

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

    error ActiveSignals(address account, uint256 signalWeight);
    error TransferDisabled();
    error ResonanceAlreadySet(address resonance);
    error ZeroAddress();
    error ZeroAmount();

    /// @notice Creates the non-transferable staking receipt and assigns deployment-time ownership.
    /// @param gbx_ GBX token deposited by stakers.
    /// @param initialOwner Deployment-time owner responsible for binding Resonance.
    constructor(IERC20 gbx_, address initialOwner)
        ERC20("Signal GUM BALL 6900", "sGBX")
        ERC20Permit("Signal GUM BALL 6900")
        Ownable(initialOwner)
    {
        if (address(gbx_) == address(0) || address(gbx_).code.length == 0) revert ZeroAddress();
        gbx = gbx_;
    }

    /// @notice Stakes GBX and mints the same amount of non-transferable SignalGBX.
    /// @param amount Amount of GBX to stake.
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        gbx.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);

        // Self-delegation activates ERC20Votes checkpoints without requiring a second setup transaction.
        if (delegates(msg.sender) == address(0)) _delegate(msg.sender, msg.sender);

        emit Staked(msg.sender, amount);
    }

    /// @notice Burns unallocated SignalGBX and immediately returns the same amount of underlying GBX.
    /// @dev Active signals reserve only their absolute allocated amount; they do not block withdrawal of the remainder.
    /// @param amount Amount of SignalGBX to burn and GBX to withdraw.
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        address configuredResonance = resonance;
        if (configuredResonance != address(0)) {
            uint256 signalWeight = ICoreResonance(configuredResonance).accountSignalWeight(msg.sender);
            uint256 balance = balanceOf(msg.sender);
            if (signalWeight != 0 && (signalWeight > balance || amount > balance - signalWeight)) {
                revert ActiveSignals(msg.sender, signalWeight);
            }
        }

        _burn(msg.sender, amount);
        gbx.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /// @notice Binds the Resonance dependency once during deployment.
    /// @param resonance_ Resonance address to bind permanently.
    function setResonance(address resonance_) external onlyOwner {
        if (resonance != address(0)) revert ResonanceAlreadySet(resonance);
        if (resonance_ == address(0) || resonance_.code.length == 0) revert ZeroAddress();

        resonance = resonance_;

        emit ResonanceSet(resonance_);
    }

    /// @notice Returns the current ERC-2612 permit nonce for `owner`.
    /// @param owner Account whose nonce is queried.
    /// @return nonce Current permit nonce.
    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256 nonce) {
        return super.nonces(owner);
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
