// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { Bribe } from "./Bribe.sol";
import { IResonanceIdentity } from "./interfaces/IResonanceIdentity.sol";

/// @title GumBall6900 Resonance-Bound Bribe Factory
/// @author @heesho
/// @notice Deploys the dedicated Bribe associated with each Strategy created through one permanently bound Resonance.
/// @dev Adapted from Liquid Signal Governance. A temporary setup owner binds the factory once, after reciprocal
///      identity validation. Only that Resonance may subsequently deploy Bribes, and each deployment makes Resonance
///      the new Bribe's immutable signal-weight and registry authority. The inherited ownership surface remains after
///      binding but has no further custom factory action.
contract BribeFactory is Ownable {
    /// @notice Returns the Resonance exclusively authorized to create Bribes, or zero before one-time binding.
    address public resonance;

    /// @notice Emitted when the bound Resonance deploys a fresh Bribe.
    /// @param bribe Address of the newly deployed Bribe.
    /// @param resonance Bound Resonance set as the Bribe's immutable authority.
    event BribeCreated(address indexed bribe, address indexed resonance);
    /// @notice Emitted when the factory completes its one-time Resonance binding.
    /// @param resonance Permanently bound Resonance address.
    event ResonanceSet(address indexed resonance);

    /// @notice Raised when an account other than the bound Resonance attempts to deploy a Bribe.
    /// @param caller Unauthorized caller; every caller is unauthorized while the factory is unbound.
    error NotResonance(address caller);
    /// @notice Raised when a candidate fails to report this contract as its BribeFactory.
    /// @param resonance Candidate contract that reverted, lacked the identity getter, or returned another factory.
    error InvalidResonance(address resonance);
    /// @notice Raised when the owner attempts to repeat the one-time Resonance binding.
    /// @param resonance Existing bound Resonance address.
    error ResonanceAlreadySet(address resonance);
    /// @notice Raised when a candidate Resonance is zero or has no deployed code.
    error ZeroAddress();

    /// @notice Creates an unbound factory whose owner may set Resonance exactly once.
    /// @dev OpenZeppelin `Ownable` rejects a zero `initialOwner`. Transferring or renouncing ownership before binding
    ///      changes or can permanently remove the only authority able to complete setup.
    /// @param initialOwner Deployment-time owner responsible for the one-time Resonance binding.
    constructor(address initialOwner) Ownable(initialOwner) { }

    /// @notice Permanently binds the only Resonance allowed to deploy Bribes.
    /// @dev Callable only by the current owner and only while `resonance` is zero. The candidate must be a nonzero
    ///      contract whose `bribeFactory()` identity getter returns this factory; a failed call or mismatch reverts
    ///      with `InvalidResonance`. Successful binding emits `ResonanceSet` and has no replacement path.
    /// @param resonance_ Resonance contract address to validate and bind.
    function setResonance(address resonance_) external onlyOwner {
        if (resonance != address(0)) revert ResonanceAlreadySet(resonance);
        if (resonance_ == address(0) || resonance_.code.length == 0) revert ZeroAddress();
        try IResonanceIdentity(resonance_).bribeFactory() returns (address configuredFactory) {
            if (configuredFactory != address(this)) revert InvalidResonance(resonance_);
        } catch {
            revert InvalidResonance(resonance_);
        }

        resonance = resonance_;

        emit ResonanceSet(resonance_);
    }

    /// @notice Deploys a new empty Bribe whose immutable authority is the bound Resonance.
    /// @dev Callable only by `resonance`; an unbound factory therefore rejects every possible caller. Each call deploys
    ///      a distinct Bribe with an empty signal ledger and reward-token registry, then emits `BribeCreated`.
    /// @return bribe Newly deployed Bribe controlled by the bound Resonance.
    function createBribe() external returns (Bribe bribe) {
        address configuredResonance = resonance;
        if (msg.sender != configuredResonance) revert NotResonance(msg.sender);

        bribe = new Bribe(configuredResonance);

        emit BribeCreated(address(bribe), configuredResonance);
    }
}
