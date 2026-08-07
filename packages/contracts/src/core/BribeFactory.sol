// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { Bribe } from "./Bribe.sol";

/// @title BribeFactory
/// @author GUM BALL 6900
/// @notice Deploys the Bribe associated with each Voter-created Strategy.
/// @dev Adapted from Liquid Signal Governance. The factory is bound to one Voter and is not publicly permissionless.
contract BribeFactory is Ownable {
    /// @notice Voter exclusively authorized to create Bribes.
    address public voter;

    /// @notice Emitted when Voter deploys a Bribe.
    /// @param bribe Address of the new Bribe.
    /// @param voter Voter authorized to maintain the Bribe's virtual balances.
    event BribeCreated(address indexed bribe, address indexed voter);
    /// @notice Emitted when the factory is permanently bound to Voter.
    /// @param voter Bound Voter address.
    event VoterSet(address indexed voter);

    error NotVoter(address caller);
    error VoterAlreadySet(address voter);
    error ZeroAddress();

    /// @notice Creates an unbound factory whose owner may set Voter exactly once.
    /// @param initialOwner Deployment-time owner responsible for binding Voter.
    constructor(address initialOwner) Ownable(initialOwner) { }

    /// @notice Binds the only Voter allowed to deploy Bribes.
    /// @param voter_ Voter address to bind permanently.
    function setVoter(address voter_) external onlyOwner {
        if (voter != address(0)) revert VoterAlreadySet(voter);
        if (voter_ == address(0) || voter_.code.length == 0) revert ZeroAddress();

        voter = voter_;

        emit VoterSet(voter_);
    }

    /// @notice Deploys a Bribe controlled by the bound Voter.
    /// @return bribe Newly deployed Bribe.
    function createBribe() external returns (Bribe bribe) {
        address configuredVoter = voter;
        if (msg.sender != configuredVoter) revert NotVoter(msg.sender);

        bribe = new Bribe(configuredVoter);

        emit BribeCreated(address(bribe), configuredVoter);
    }
}
