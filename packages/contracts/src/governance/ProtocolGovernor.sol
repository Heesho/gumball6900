// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Governor } from "@openzeppelin/contracts/governance/Governor.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { GovernorCountingSimple } from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import { GovernorTimelockControl } from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import { GovernorVotes } from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import { IVotes } from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { Mine } from "../core/Mine.sol";
import { Resonance } from "../core/Resonance.sol";

/// @title GumBall6900 Protocol Governor
/// @author Heesho
/// @notice Lets SignalGBX voting power operate the protocol's four bounded maintenance actions through a Timelock.
/// @dev Proposals may contain only zero-value calls to Resonance.addStrategy, Resonance.killStrategy,
///      Resonance.addBribeReward, or Mine.increaseCapacity at the immutable target addresses. Voting parameters,
///      quorum, targets, and Timelock dependency are fixed at construction. Deployment must make this Governor the
///      Timelock's sole proposer and sole CANCELLER_ROLE holder, open execution, and transfer Resonance and Mine
///      ownership to the Timelock. Standard Governor cancellation remains proposer-only while Pending, so there is
///      deliberately no guardian or queued-proposal veto.
/// @custom:version 1.0.0
contract ProtocolGovernor is Governor, GovernorCountingSimple, GovernorVotes, GovernorTimelockControl {
    uint256 private constant QUORUM_DENOMINATOR = 100;
    uint256 private constant ONE_ARGUMENT_CALLDATA_LENGTH = 4 + 32;
    uint256 private constant TWO_ARGUMENT_CALLDATA_LENGTH = 4 + 2 * 32;
    uint256 private constant ADD_STRATEGY_CALLDATA_LENGTH = 4 + 5 * 32;

    /// @notice The sole Resonance whose bounded maintenance calls may be proposed.
    Resonance public immutable resonance;
    /// @notice The sole Mine whose bounded capacity increase may be proposed.
    Mine public immutable mine;

    uint48 private immutable _votingDelayBlocks;
    uint32 private immutable _votingPeriodBlocks;
    uint256 private immutable _proposalThresholdVotes;
    uint256 private immutable _quorumNumerator;

    /// @notice Raised when a dependency is zero, code-less, or not the dependency required by the graph.
    error InvalidDependency(address dependency);
    /// @notice Raised when an immutable voting parameter is outside its valid range.
    error InvalidGovernanceParameter();
    /// @notice Raised when a proposal contains anything outside the four permitted protocol calls.
    error UnsupportedProposalCall(address target, uint256 value, bytes4 selector, uint256 calldataLength);
    /// @notice Raised when a caller reaches an inherited generic governance mutation disabled by this contract.
    error ImmutableGovernanceSurface();

    /// @notice Creates a selector-bounded Governor using deployed SignalGBX vote checkpoints.
    /// @param votingToken SignalGBX contract used as the immutable IVotes source.
    /// @param timelockController Timelock that will own Resonance and Mine.
    /// @param resonance_ Immutable Resonance maintenance target.
    /// @param mine_ Immutable Mine maintenance target.
    /// @param votingDelayBlocks Delay from proposal creation to snapshot in SignalGBX clock blocks.
    /// @param votingPeriodBlocks Voting duration in SignalGBX clock blocks.
    /// @param proposalThresholdVotes Historical SignalGBX votes required to submit a proposal.
    /// @param quorumNumerator_ Required participation percentage, from one through one hundred.
    constructor(
        IVotes votingToken,
        TimelockController timelockController,
        Resonance resonance_,
        Mine mine_,
        uint48 votingDelayBlocks,
        uint32 votingPeriodBlocks,
        uint256 proposalThresholdVotes,
        uint256 quorumNumerator_
    ) Governor("GumBall6900 Protocol Governor") GovernorVotes(votingToken) GovernorTimelockControl(timelockController) {
        if (
            address(votingToken) == address(0) || address(votingToken).code.length == 0
                || address(timelockController) == address(0) || address(timelockController).code.length == 0
                || address(resonance_) == address(0) || address(resonance_).code.length == 0
                || address(mine_) == address(0) || address(mine_).code.length == 0
        ) revert InvalidDependency(address(0));
        if (address(resonance_.signalGBX()) != address(votingToken)) {
            revert InvalidDependency(address(votingToken));
        }
        if (votingPeriodBlocks == 0 || quorumNumerator_ == 0 || quorumNumerator_ > QUORUM_DENOMINATOR) {
            revert InvalidGovernanceParameter();
        }

        resonance = resonance_;
        mine = mine_;
        _votingDelayBlocks = votingDelayBlocks;
        _votingPeriodBlocks = votingPeriodBlocks;
        _proposalThresholdVotes = proposalThresholdVotes;
        _quorumNumerator = quorumNumerator_;
    }

    /// @inheritdoc Governor
    function votingDelay() public view override returns (uint256) {
        return _votingDelayBlocks;
    }

    /// @inheritdoc Governor
    function votingPeriod() public view override returns (uint256) {
        return _votingPeriodBlocks;
    }

    /// @inheritdoc Governor
    function proposalThreshold() public view override returns (uint256) {
        return _proposalThresholdVotes;
    }

    /// @notice Returns the immutable quorum percentage numerator.
    function quorumNumerator() public view returns (uint256) {
        return _quorumNumerator;
    }

    /// @notice Returns the fixed quorum percentage denominator.
    function quorumDenominator() public pure returns (uint256) {
        return QUORUM_DENOMINATOR;
    }

    /// @inheritdoc Governor
    function quorum(uint256 timepoint) public view override returns (uint256) {
        return Math.mulDiv(token().getPastTotalSupply(timepoint), _quorumNumerator, QUORUM_DENOMINATOR);
    }

    /// @dev Rejects every proposal target except the four exact protocol maintenance calls.
    function _propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        address proposer
    ) internal override returns (uint256 proposalId) {
        uint256 count = targets.length;
        if (count == 0 || count != values.length || count != calldatas.length) {
            revert GovernorInvalidProposalLength(targets.length, calldatas.length, values.length);
        }

        for (uint256 i; i < count; ++i) {
            bytes memory payload = calldatas[i];
            bytes4 selector;
            if (payload.length >= 4) {
                assembly ("memory-safe") {
                    selector := mload(add(payload, 0x20))
                }
            }

            bool validResonanceCall = targets[i] == address(resonance)
                && ((selector == Resonance.addStrategy.selector && payload.length == ADD_STRATEGY_CALLDATA_LENGTH)
                    || (selector == Resonance.killStrategy.selector && payload.length == ONE_ARGUMENT_CALLDATA_LENGTH)
                    || (selector == Resonance.addBribeReward.selector
                        && payload.length == TWO_ARGUMENT_CALLDATA_LENGTH));
            bool validMineCall = targets[i] == address(mine) && selector == Mine.increaseCapacity.selector
                && payload.length == ONE_ARGUMENT_CALLDATA_LENGTH;
            if (values[i] != 0 || (!validResonanceCall && !validMineCall)) {
                revert UnsupportedProposalCall(targets[i], values[i], selector, payload.length);
            }
        }

        return super._propose(targets, values, calldatas, description, proposer);
    }

    /// @notice Executes an approved zero-value proposal without accepting native currency from the executor.
    /// @dev GovernorTimelockControl forwards `msg.value` to its Timelock independently of proposal call values.
    ///      Rejecting it here prevents accidental ETH from becoming stranded while preserving permissionless execution.
    /// @param targets Immutable-target proposal call destinations.
    /// @param values Zero-value proposal call amounts.
    /// @param calldatas Exact selector-bounded proposal payloads.
    /// @param descriptionHash Hash of the proposal description used in its identifier.
    /// @return proposalId Identifier of the executed proposal.
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable override returns (uint256 proposalId) {
        if (msg.value != 0) revert ImmutableGovernanceSurface();
        return super.execute(targets, values, calldatas, descriptionHash);
    }

    /// @dev Generic Governor relay is incompatible with the immutable four-selector surface.
    function relay(address, uint256, bytes calldata) public payable override {
        revert ImmutableGovernanceSurface();
    }

    /// @notice Rejects direct ETH because every permitted protocol maintenance call has zero native value.
    receive() external payable override {
        revert ImmutableGovernanceSurface();
    }

    /// @dev The Timelock cannot be replaced after deployment.
    function updateTimelock(TimelockController) public pure override {
        revert ImmutableGovernanceSurface();
    }

    /// @notice Returns the current OpenZeppelin lifecycle state for a proposal.
    /// @param proposalId Proposal identifier returned by propose.
    /// @return proposalState Current proposal lifecycle state.
    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState proposalState)
    {
        return super.state(proposalId);
    }

    /// @notice Returns whether a successful proposal must be queued in the immutable Timelock.
    /// @param proposalId Proposal identifier returned by propose.
    /// @return needsQueuing True when the proposal must pass through the Timelock queue before execution.
    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool needsQueuing)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
}
