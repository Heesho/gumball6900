// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Governor } from "@openzeppelin/contracts/governance/Governor.sol";
import { IGovernor } from "@openzeppelin/contracts/governance/IGovernor.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { IVotes } from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import { Vm } from "forge-std/Vm.sol";

import { Mine } from "../../src/core/Mine.sol";
import { Resonance } from "../../src/core/Resonance.sol";
import { Strategy } from "../../src/core/Strategy.sol";
import { ProtocolGovernor } from "../../src/governance/ProtocolGovernor.sol";
import { ProtocolGovernanceFixture } from "./utils/ProtocolGovernanceFixture.sol";

/// @title ProtocolGovernorTest
/// @notice Focused coverage of SignalGBX voting, bounded proposal authority, and seven-day Timelock execution.
contract ProtocolGovernorTest is ProtocolGovernanceFixture {
    function setUp() external {
        _deployGovernedProtocol();
    }

    function test_DeploymentFixesDependenciesSettingsAndRoleClosure() external view {
        assertEq(protocolGovernor.name(), "GumBall6900 Protocol Governor");
        assertEq(address(protocolGovernor.token()), address(signalGBX));
        assertEq(protocolGovernor.timelock(), address(protocolTimelock));
        assertEq(address(protocolGovernor.resonance()), address(resonance));
        assertEq(address(protocolGovernor.mine()), address(mine));
        assertEq(protocolGovernor.votingDelay(), TEST_VOTING_DELAY);
        assertEq(protocolGovernor.votingPeriod(), TEST_VOTING_PERIOD);
        assertEq(protocolGovernor.proposalThreshold(), TEST_PROPOSAL_THRESHOLD);
        assertEq(protocolGovernor.quorumNumerator(), TEST_QUORUM_NUMERATOR);
        assertEq(protocolGovernor.quorumDenominator(), 100);
        assertEq(protocolTimelock.getMinDelay(), TEST_TIMELOCK_DELAY);

        assertEq(resonance.owner(), address(protocolTimelock));
        assertEq(mine.owner(), address(protocolTimelock));
        assertTrue(protocolTimelock.hasRole(protocolTimelock.PROPOSER_ROLE(), address(protocolGovernor)));
        assertTrue(protocolTimelock.hasRole(protocolTimelock.CANCELLER_ROLE(), address(protocolGovernor)));
        assertTrue(protocolTimelock.hasRole(protocolTimelock.EXECUTOR_ROLE(), address(0)));
        assertFalse(protocolTimelock.hasRole(protocolTimelock.DEFAULT_ADMIN_ROLE(), address(this)));
        assertTrue(protocolTimelock.hasRole(protocolTimelock.DEFAULT_ADMIN_ROLE(), address(protocolTimelock)));
        assertFalse(protocolTimelock.hasRole(protocolTimelock.PROPOSER_ROLE(), address(this)));
        assertFalse(protocolTimelock.hasRole(protocolTimelock.CANCELLER_ROLE(), address(this)));
    }

    function test_ConstructorRejectsMismatchedTokenAndInvalidVotingParameters() external {
        vm.expectRevert(abi.encodeWithSelector(ProtocolGovernor.InvalidDependency.selector, address(0)));
        new ProtocolGovernor(IVotes(address(0)), protocolTimelock, resonance, mine, 1, 10, 0, TEST_QUORUM_NUMERATOR);

        vm.expectRevert(abi.encodeWithSelector(ProtocolGovernor.InvalidDependency.selector, address(gbx)));
        new ProtocolGovernor(IVotes(address(gbx)), protocolTimelock, resonance, mine, 1, 10, 0, TEST_QUORUM_NUMERATOR);

        vm.expectRevert(ProtocolGovernor.InvalidGovernanceParameter.selector);
        new ProtocolGovernor(IVotes(address(signalGBX)), protocolTimelock, resonance, mine, 1, 0, 0, 4);

        vm.expectRevert(ProtocolGovernor.InvalidGovernanceParameter.selector);
        new ProtocolGovernor(IVotes(address(signalGBX)), protocolTimelock, resonance, mine, 1, 10, 0, 0);

        vm.expectRevert(ProtocolGovernor.InvalidGovernanceParameter.selector);
        new ProtocolGovernor(IVotes(address(signalGBX)), protocolTimelock, resonance, mine, 1, 10, 0, 101);
    }

    function test_OnlyTheFourExactZeroValueCallsCanBeProposed() external {
        bytes memory addStrategy =
            abi.encodeCall(Resonance.addStrategy, (IERC20(address(secondAsset)), defaultConfig()));
        bytes memory kill = abi.encodeCall(Resonance.killStrategy, (address(targetStrategy)));
        bytes memory addBribeReward =
            abi.encodeCall(Resonance.addBribeReward, (address(targetStrategy), address(secondAsset)));
        bytes memory increaseCapacity = abi.encodeCall(Mine.increaseCapacity, (2));

        _assertProposalAccepted(address(resonance), addStrategy, "ADD");
        _assertProposalAccepted(address(resonance), kill, "KILL");
        _assertProposalAccepted(address(resonance), addBribeReward, "BRIBE");
        _assertProposalAccepted(address(mine), increaseCapacity, "CAPACITY");

        _expectUnsupported(ALICE, 0, kill);
        _expectUnsupported(address(mine), 0, kill);
        _expectUnsupported(address(resonance), 1, kill);
        _expectUnsupported(address(resonance), 0, abi.encodeWithSignature("transferOwnership(address)", ALICE));
        _expectUnsupported(address(protocolTimelock), 0, abi.encodeCall(TimelockController.updateDelay, (1 days)));
        _expectUnsupported(address(resonance), 0, hex"1234");

        _assertMalformedLengthsRejected(address(resonance), addStrategy);
        _assertMalformedLengthsRejected(address(resonance), kill);
        _assertMalformedLengthsRejected(address(resonance), addBribeReward);
        _assertMalformedLengthsRejected(address(mine), increaseCapacity);
    }

    function test_ProposalLengthValidationAndPendingCancellation() external {
        address[] memory emptyTargets = new address[](0);
        uint256[] memory emptyValues = new uint256[](0);
        bytes[] memory emptyPayloads = new bytes[](0);
        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorInvalidProposalLength.selector, 0, 0, 0));
        protocolGovernor.propose(emptyTargets, emptyValues, emptyPayloads, "EMPTY");

        address[] memory targets = _addresses(address(resonance));
        uint256[] memory values = _uints(0);
        bytes[] memory payloads = new bytes[](1);
        payloads[0] = abi.encodeCall(Resonance.killStrategy, (address(targetStrategy)));
        string memory description = "CANCEL WHILE PENDING";
        bytes32 descriptionHash = keccak256(bytes(description));

        vm.prank(ALICE);
        uint256 proposalId = protocolGovernor.propose(targets, values, payloads, description);
        assertTrue(protocolGovernor.proposalNeedsQueuing(proposalId));

        vm.prank(ALICE);
        assertEq(protocolGovernor.cancel(targets, values, payloads, descriptionHash), proposalId);
        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Canceled));
    }

    function test_DirectOwnerAndTimelockSchedulingBypassIsClosed() external {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this)));
        resonance.killStrategy(address(targetStrategy));

        uint256 minimumDelay = protocolTimelock.getMinDelay();
        vm.expectRevert();
        protocolTimelock.schedule(
            address(resonance),
            0,
            abi.encodeCall(Resonance.killStrategy, (address(targetStrategy))),
            bytes32(0),
            keccak256("BYPASS"),
            minimumDelay
        );

        vm.expectRevert(ProtocolGovernor.ImmutableGovernanceSurface.selector);
        protocolGovernor.relay(address(resonance), 0, abi.encodeCall(Resonance.killStrategy, (address(targetStrategy))));

        vm.deal(address(this), 1);
        (bool success, bytes memory returndata) = address(protocolGovernor).call{ value: 1 }("");
        assertFalse(success);
        assertEq(returndata, abi.encodeWithSelector(ProtocolGovernor.ImmutableGovernanceSurface.selector));

        address[] memory targets = _addresses(address(resonance));
        uint256[] memory values = _uints(0);
        bytes[] memory payloads = new bytes[](1);
        payloads[0] = abi.encodeCall(Resonance.killStrategy, (address(targetStrategy)));
        vm.expectRevert(ProtocolGovernor.ImmutableGovernanceSurface.selector);
        protocolGovernor.execute{ value: 1 }(targets, values, payloads, keccak256("NO STRANDED ETH"));
        assertEq(address(protocolGovernor).balance, 0);
        assertEq(address(protocolTimelock).balance, 0);

        vm.expectRevert(ProtocolGovernor.ImmutableGovernanceSurface.selector);
        protocolGovernor.updateTimelock(protocolTimelock);
    }

    function test_ApprovedBatchExecutesAllBoundedAdministrationAfterTheTimelock() external {
        _stake(ALICE, 100 ether);
        (address[] memory targets, uint256[] memory values, bytes[] memory payloads) = _completeAdministrationBatch();
        string memory description = "ADD KILL BRIBE AND CAPACITY";
        bytes32 descriptionHash = keccak256(bytes(description));

        vm.prank(ALICE);
        uint256 proposalId = protocolGovernor.propose(targets, values, payloads, description);
        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Pending));

        vm.roll(protocolGovernor.proposalSnapshot(proposalId) + 1);
        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Active));
        vm.prank(ALICE);
        assertEq(protocolGovernor.castVote(proposalId, 1), 100 ether);

        vm.roll(protocolGovernor.proposalDeadline(proposalId) + 1);
        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Succeeded));
        protocolGovernor.queue(targets, values, payloads, descriptionHash);
        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Queued));

        vm.expectRevert();
        protocolGovernor.execute(targets, values, payloads, descriptionHash);

        vm.warp(block.timestamp + protocolTimelock.getMinDelay());
        vm.recordLogs();
        vm.prank(CAROL);
        protocolGovernor.execute(targets, values, payloads, descriptionHash);

        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Executed));
        assertFalse(resonance.isStrategyAlive(address(gbxStrategy)));
        assertTrue(targetBribe.isRewardToken(address(secondAsset)));
        assertEq(mine.capacity(), 2);
        assertTrue(_findAddedStrategy() != address(0));
    }

    function test_RevertingLateBatchCallRollsBackEarlierCallsAndRemainsQueued() external {
        _stake(ALICE, 100 ether);

        address[] memory targets = new address[](2);
        uint256[] memory values = new uint256[](2);
        bytes[] memory payloads = new bytes[](2);
        targets[0] = address(mine);
        targets[1] = address(mine);
        payloads[0] = abi.encodeCall(Mine.increaseCapacity, (2));
        payloads[1] = abi.encodeCall(Mine.increaseCapacity, (2));
        string memory description = "ATOMIC REVERTING CAPACITY BATCH";
        bytes32 descriptionHash = keccak256(bytes(description));

        vm.prank(ALICE);
        uint256 proposalId = protocolGovernor.propose(targets, values, payloads, description);
        vm.roll(protocolGovernor.proposalSnapshot(proposalId) + 1);
        vm.prank(ALICE);
        protocolGovernor.castVote(proposalId, 1);
        vm.roll(protocolGovernor.proposalDeadline(proposalId) + 1);
        protocolGovernor.queue(targets, values, payloads, descriptionHash);
        vm.warp(block.timestamp + protocolTimelock.getMinDelay());

        vm.expectRevert(abi.encodeWithSelector(Mine.CapacityNotIncreased.selector, 2, 2));
        protocolGovernor.execute(targets, values, payloads, descriptionHash);

        assertEq(mine.capacity(), 1, "the earlier capacity increase must roll back");
        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Queued));

        vm.expectRevert(abi.encodeWithSelector(Mine.CapacityNotIncreased.selector, 2, 2));
        protocolGovernor.execute(targets, values, payloads, descriptionHash);
        assertEq(mine.capacity(), 1);
        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Queued));
    }

    function test_QueuedProposalCannotBeCancelled() external {
        _stake(ALICE, 100 ether);
        address[] memory targets = _addresses(address(resonance));
        uint256[] memory values = _uints(0);
        bytes[] memory payloads = new bytes[](1);
        payloads[0] = abi.encodeCall(Resonance.killStrategy, (address(targetStrategy)));
        string memory description = "IRREVOCABLE ONCE QUEUED";
        bytes32 descriptionHash = keccak256(bytes(description));

        vm.prank(ALICE);
        uint256 proposalId = protocolGovernor.propose(targets, values, payloads, description);
        vm.roll(protocolGovernor.proposalSnapshot(proposalId) + 1);
        vm.prank(ALICE);
        protocolGovernor.castVote(proposalId, 1);
        vm.roll(protocolGovernor.proposalDeadline(proposalId) + 1);
        protocolGovernor.queue(targets, values, payloads, descriptionHash);

        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorUnableToCancel.selector, proposalId, ALICE));
        vm.prank(ALICE);
        protocolGovernor.cancel(targets, values, payloads, descriptionHash);

        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Queued));
    }

    function test_QuorumUsesSnapshotSupplyAndVotingDoesNotLockSignalGBX() external {
        _stake(ALICE, 100 ether);
        address[] memory targets = _addresses(address(resonance));
        uint256[] memory values = _uints(0);
        bytes[] memory payloads = new bytes[](1);
        payloads[0] = abi.encodeCall(Resonance.killStrategy, (address(targetStrategy)));
        string memory description = "SNAPSHOT EXIT RISK";

        vm.prank(ALICE);
        uint256 proposalId = protocolGovernor.propose(targets, values, payloads, description);
        uint256 snapshot = protocolGovernor.proposalSnapshot(proposalId);
        vm.roll(snapshot + 1);

        assertEq(protocolGovernor.quorum(snapshot), 4 ether);
        vm.prank(ALICE);
        signalGBX.unstake(100 ether);
        assertEq(signalGBX.balanceOf(ALICE), 0);

        vm.prank(ALICE);
        assertEq(protocolGovernor.castVote(proposalId, 1), 100 ether);
    }

    function test_NonzeroProposalThresholdRejectsAnUnderweightProposer() external {
        ProtocolGovernor thresholdGovernor = new ProtocolGovernor(
            IVotes(address(signalGBX)),
            protocolTimelock,
            resonance,
            mine,
            TEST_VOTING_DELAY,
            TEST_VOTING_PERIOD,
            100 ether,
            TEST_QUORUM_NUMERATOR
        );
        _stake(ALICE, 99 ether);
        vm.roll(block.number + 1);

        address[] memory targets = _addresses(address(resonance));
        uint256[] memory values = _uints(0);
        bytes[] memory payloads = new bytes[](1);
        payloads[0] = abi.encodeCall(Resonance.killStrategy, (address(targetStrategy)));

        vm.startPrank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(IGovernor.GovernorInsufficientProposerVotes.selector, ALICE, 99 ether, 100 ether)
        );
        thresholdGovernor.propose(targets, values, payloads, "THRESHOLD");
        vm.stopPrank();
    }

    function test_ProposalWithWinningVotesButNoQuorumIsDefeated() external {
        _stake(ALICE, 1 ether);
        _stake(BOB, 99 ether);

        address[] memory targets = _addresses(address(resonance));
        uint256[] memory values = _uints(0);
        bytes[] memory payloads = new bytes[](1);
        payloads[0] = abi.encodeCall(Resonance.killStrategy, (address(targetStrategy)));

        vm.prank(ALICE);
        uint256 proposalId = protocolGovernor.propose(targets, values, payloads, "NO QUORUM");
        uint256 snapshot = protocolGovernor.proposalSnapshot(proposalId);
        vm.roll(snapshot + 1);

        assertEq(protocolGovernor.quorum(snapshot), 4 ether);
        vm.prank(ALICE);
        assertEq(protocolGovernor.castVote(proposalId, 1), 1 ether);

        vm.roll(protocolGovernor.proposalDeadline(proposalId) + 1);
        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Defeated));
    }

    function _assertProposalAccepted(address target_, bytes memory payload, string memory description) private {
        address[] memory targets = _addresses(target_);
        uint256[] memory values = _uints(0);
        bytes[] memory payloads = new bytes[](1);
        payloads[0] = payload;

        uint256 proposalId = protocolGovernor.propose(targets, values, payloads, description);
        assertEq(uint256(protocolGovernor.state(proposalId)), uint256(IGovernor.ProposalState.Pending));
    }

    function _expectUnsupported(address target_, uint256 value, bytes memory payload) private {
        address[] memory targets = _addresses(target_);
        uint256[] memory values = _uints(value);
        bytes[] memory payloads = new bytes[](1);
        payloads[0] = payload;

        bytes4 selector;
        if (payload.length >= 4) {
            assembly ("memory-safe") {
                selector := mload(add(payload, 0x20))
            }
        }
        vm.expectRevert(
            abi.encodeWithSelector(
                ProtocolGovernor.UnsupportedProposalCall.selector, target_, value, selector, payload.length
            )
        );
        protocolGovernor.propose(targets, values, payloads, "REJECT");
    }

    function _assertMalformedLengthsRejected(address target_, bytes memory payload) private {
        uint256 exactLength = payload.length;
        _expectUnsupported(target_, 0, _resizePayload(payload, exactLength - 32));
        _expectUnsupported(target_, 0, _resizePayload(payload, exactLength - 1));
        _expectUnsupported(target_, 0, _resizePayload(payload, exactLength + 1));
        _expectUnsupported(target_, 0, _resizePayload(payload, exactLength + 32));
    }

    function _resizePayload(bytes memory payload, uint256 length) private pure returns (bytes memory resized) {
        resized = new bytes(length);
        uint256 copied = length < payload.length ? length : payload.length;
        for (uint256 i; i < copied; ++i) {
            resized[i] = payload[i];
        }
    }

    function _completeAdministrationBatch()
        private
        view
        returns (address[] memory targets, uint256[] memory values, bytes[] memory payloads)
    {
        targets = new address[](4);
        values = new uint256[](4);
        payloads = new bytes[](4);

        targets[0] = address(resonance);
        payloads[0] = abi.encodeCall(Resonance.addStrategy, (IERC20(address(secondAsset)), defaultConfig()));
        targets[1] = address(resonance);
        payloads[1] = abi.encodeCall(Resonance.killStrategy, (address(gbxStrategy)));
        targets[2] = address(resonance);
        payloads[2] = abi.encodeCall(Resonance.addBribeReward, (address(targetStrategy), address(secondAsset)));
        targets[3] = address(mine);
        payloads[3] = abi.encodeCall(Mine.increaseCapacity, (2));
    }

    function _findAddedStrategy() private returns (address strategy) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 strategyAdded = keccak256("StrategyAdded(address,address,address,address)");
        for (uint256 i; i < logs.length; ++i) {
            if (
                logs[i].emitter == address(resonance) && logs[i].topics.length != 0
                    && logs[i].topics[0] == strategyAdded
            ) {
                address paymentToken = abi.decode(logs[i].data, (address));
                if (paymentToken == address(secondAsset)) {
                    strategy = address(uint160(uint256(logs[i].topics[1])));
                    break;
                }
            }
        }
        if (strategy != address(0)) assertTrue(resonance.isStrategy(strategy));
    }
}
