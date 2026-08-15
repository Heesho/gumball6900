// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { IVotes } from "@openzeppelin/contracts/governance/utils/IVotes.sol";

import { ProtocolGovernor } from "../../../src/governance/ProtocolGovernor.sol";

import { ProtocolFixture } from "./ProtocolFixture.sol";

/// @title ProtocolGovernanceFixture
/// @notice Adds the selector-bounded Governor and final Timelock role closure to the core deployment fixture.
abstract contract ProtocolGovernanceFixture is ProtocolFixture {
    uint256 internal constant TEST_TIMELOCK_DELAY = 7 days;
    uint48 internal constant TEST_VOTING_DELAY = 1;
    uint32 internal constant TEST_VOTING_PERIOD = 10;
    uint256 internal constant TEST_PROPOSAL_THRESHOLD = 0;
    uint256 internal constant TEST_QUORUM_NUMERATOR = 4;

    TimelockController internal protocolTimelock;
    ProtocolGovernor internal protocolGovernor;

    /// @notice Deploys the core, installs token governance, closes temporary role authority, and transfers ownership.
    function _deployGovernedProtocol() internal {
        _deployProtocol();

        protocolTimelock =
            new TimelockController(TEST_TIMELOCK_DELAY, new address[](0), _addresses(address(0)), address(this));
        protocolGovernor = new ProtocolGovernor(
            IVotes(address(signalGBX)),
            protocolTimelock,
            resonance,
            mine,
            TEST_VOTING_DELAY,
            TEST_VOTING_PERIOD,
            TEST_PROPOSAL_THRESHOLD,
            TEST_QUORUM_NUMERATOR
        );

        protocolTimelock.grantRole(protocolTimelock.PROPOSER_ROLE(), address(protocolGovernor));
        protocolTimelock.grantRole(protocolTimelock.CANCELLER_ROLE(), address(protocolGovernor));

        resonance.transferOwnership(address(protocolTimelock));
        mine.transferOwnership(address(protocolTimelock));
        protocolTimelock.renounceRole(protocolTimelock.DEFAULT_ADMIN_ROLE(), address(this));

        vm.label(address(protocolGovernor), "ProtocolGovernor");
        vm.label(address(protocolTimelock), "ProtocolTimelock");
    }
}
