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

import { ICoreVoter } from "./interfaces/ICoreVoter.sol";

/// @title SignalGBX
/// @author GUM BALL 6900
/// @notice Non-transferable voting receipt minted one-for-one when a holder stakes GBX.
/// @dev Adapted from Liquid Signal Governance. There is no time lock: a holder can reset votes and immediately unstake.
contract SignalGBX is ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Underlying GBX held one-for-one against the SignalGBX supply.
    IERC20 public immutable gbx;

    /// @notice Voter that tracks whether an account still has active allocations.
    address public voter;

    /// @notice Emitted when an account deposits GBX and receives SignalGBX.
    /// @param account Account that staked.
    /// @param amount Amount of GBX deposited and SignalGBX minted.
    event Staked(address indexed account, uint256 amount);
    /// @notice Emitted when an account burns SignalGBX and withdraws GBX.
    /// @param account Account that unstaked.
    /// @param amount Amount of SignalGBX burned and GBX returned.
    event Unstaked(address indexed account, uint256 amount);
    /// @notice Emitted when the staking receipt is permanently bound to Voter.
    /// @param voter Bound Voter address.
    event VoterSet(address indexed voter);

    error ActiveVotes(address account, uint256 usedWeight);
    error TransferDisabled();
    error VoterAlreadySet(address voter);
    error ZeroAddress();
    error ZeroAmount();

    /// @notice Creates the non-transferable staking receipt and assigns deployment-time ownership.
    /// @param gbx_ GBX token deposited by stakers.
    /// @param initialOwner Deployment-time owner responsible for binding Voter.
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

    /// @notice Burns SignalGBX and returns the underlying GBX immediately after all votes are cleared.
    /// @param amount Amount of SignalGBX to burn and GBX to withdraw.
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        address configuredVoter = voter;
        if (configuredVoter != address(0)) {
            uint256 usedWeight = ICoreVoter(configuredVoter).accountUsedWeight(msg.sender);
            if (usedWeight != 0) revert ActiveVotes(msg.sender, usedWeight);
        }

        _burn(msg.sender, amount);
        gbx.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /// @notice Binds the Voter dependency once during deployment.
    /// @param voter_ Voter address to bind permanently.
    function setVoter(address voter_) external onlyOwner {
        if (voter != address(0)) revert VoterAlreadySet(voter);
        if (voter_ == address(0) || voter_.code.length == 0) revert ZeroAddress();

        voter = voter_;

        emit VoterSet(voter_);
    }

    /// @notice Returns the current ERC-2612 permit nonce for `owner`.
    /// @param owner Account whose nonce is queried.
    /// @return nonce Current permit nonce.
    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256 nonce) {
        return super.nonces(owner);
    }

    /// @notice Applies receipt and voting-checkpoint accounting for a mint or burn.
    /// @dev Only mint and burn updates are allowed. Direct SignalGBX transfers would bypass Voter accounting.
    /// @param from Address tokens move from, or zero during minting.
    /// @param to Address tokens move to, or zero during burning.
    /// @param value Amount moved.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        if (from != address(0) && to != address(0)) revert TransferDisabled();
        super._update(from, to, value);
    }
}
