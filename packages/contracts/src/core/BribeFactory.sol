// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { Bribe } from "./Bribe.sol";

/// @title BribeFactory
/// @author GUM BALL 6900
/// @notice Deploys the Bribe associated with each Resonance-created Strategy.
/// @dev Adapted from Liquid Signal Governance. The factory is bound to one Resonance and is not publicly permissionless.
contract BribeFactory is Ownable {
    /// @notice Resonance exclusively authorized to create Bribes.
    address public resonance;

    /// @notice Emitted when Resonance deploys a Bribe.
    /// @param bribe Address of the new Bribe.
    /// @param resonance Resonance authorized to maintain the Bribe's virtual balances.
    event BribeCreated(address indexed bribe, address indexed resonance);
    /// @notice Emitted when the factory is permanently bound to Resonance.
    /// @param resonance Bound Resonance address.
    event ResonanceSet(address indexed resonance);

    error NotResonance(address caller);
    error ResonanceAlreadySet(address resonance);
    error ZeroAddress();

    /// @notice Creates an unbound factory whose owner may set Resonance exactly once.
    /// @param initialOwner Deployment-time owner responsible for binding Resonance.
    constructor(address initialOwner) Ownable(initialOwner) { }

    /// @notice Binds the only Resonance allowed to deploy Bribes.
    /// @param resonance_ Resonance address to bind permanently.
    function setResonance(address resonance_) external onlyOwner {
        if (resonance != address(0)) revert ResonanceAlreadySet(resonance);
        if (resonance_ == address(0) || resonance_.code.length == 0) revert ZeroAddress();

        resonance = resonance_;

        emit ResonanceSet(resonance_);
    }

    /// @notice Deploys a Bribe controlled by the bound Resonance.
    /// @return bribe Newly deployed Bribe.
    function createBribe() external returns (Bribe bribe) {
        address configuredResonance = resonance;
        if (msg.sender != configuredResonance) revert NotResonance(msg.sender);

        bribe = new Bribe(configuredResonance);

        emit BribeCreated(address(bribe), configuredResonance);
    }
}
