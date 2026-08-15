import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
import {
  ProposalCanceled,
  ProposalCreated,
  ProposalExecuted,
  ProposalQueued,
  TimelockChange,
  VoteCast,
  VoteCastWithParams,
} from '../generated/ProtocolGovernor/ProtocolGovernor';
import { DelegateChanged, DelegateVotesChanged } from '../generated/SignalGBX/SignalGBX';
import { RoleGranted, RoleRevoked } from '../generated/TimelockController/TimelockController';
import {
  handleGovernorTimelockChange,
  handleProposalCanceled,
  handleProposalCreated,
  handleProposalExecuted,
  handleProposalQueued,
  handleVoteCast,
  handleVoteCastWithParams,
} from '../src/protocol-governor';
import { handleDelegateChanged, handleDelegateVotesChanged } from '../src/signal-gbx';
import { handleRoleGranted, handleRoleRevoked } from '../src/timelock-controller';
import { eventId, governanceProposalId, timelockRoleMembershipId } from '../src/ids';
import {
  CONTRACT,
  HASH,
  STRATEGY,
  USER,
  USER_TWO,
  ZERO_ADDRESS,
  addressArrayParam,
  addressParam,
  bytesArrayParam,
  bytesParam,
  configureEvent,
  integer,
  stringArrayParam,
  stringParam,
  uintArrayParam,
  uintParam,
} from './helpers';

export {
  handleDelegateChanged,
  handleDelegateVotesChanged,
  handleGovernorTimelockChange,
  handleProposalCanceled,
  handleProposalCreated,
  handleProposalExecuted,
  handleProposalQueued,
  handleRoleGranted,
  handleRoleRevoked,
  handleVoteCast,
  handleVoteCastWithParams,
};

describe('governance event mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('tracks SignalGBX delegation independently from Resonance signal allocation', () => {
    const delegateChanged = changetype<DelegateChanged>(newMockEvent());
    configureEvent(delegateChanged, CONTRACT, 1);
    delegateChanged.parameters = new Array<ethereum.EventParam>();
    delegateChanged.parameters.push(addressParam('delegator', USER));
    delegateChanged.parameters.push(addressParam('fromDelegate', ZERO_ADDRESS));
    delegateChanged.parameters.push(addressParam('toDelegate', USER_TWO));
    handleDelegateChanged(delegateChanged);

    const votesChanged = changetype<DelegateVotesChanged>(newMockEvent());
    configureEvent(votesChanged, CONTRACT, 2);
    votesChanged.parameters = new Array<ethereum.EventParam>();
    votesChanged.parameters.push(addressParam('delegate', USER_TWO));
    votesChanged.parameters.push(uintParam('previousVotes', 0));
    votesChanged.parameters.push(uintParam('newVotes', 100));
    handleDelegateVotesChanged(votesChanged);

    const delegatorId = '4663-' + USER.toHexString();
    const delegateId = '4663-' + USER_TWO.toHexString();
    assert.fieldEquals('Account', delegatorId, 'currentDelegate', USER_TWO.toHexString());
    assert.fieldEquals('Account', delegatorId, 'signalWeightRaw', '0');
    assert.fieldEquals('Account', delegateId, 'delegatedVotesRaw', '100');
    assert.fieldEquals('ProtocolEvent', eventId(votesChanged), 'eventType', 'SIGNAL_GBX_DELEGATE_VOTES_CHANGED');
  });

  test('binds ProtocolGovernor identity from its constructor TimelockChange event', () => {
    const bound = changetype<TimelockChange>(newMockEvent());
    configureEvent(bound, CONTRACT, 1);
    bound.parameters = new Array<ethereum.EventParam>();
    bound.parameters.push(addressParam('oldTimelock', ZERO_ADDRESS));
    bound.parameters.push(addressParam('newTimelock', STRATEGY));
    handleGovernorTimelockChange(bound);

    assert.fieldEquals('ProtocolState', '4663', 'protocolGovernor', CONTRACT.toHexString());
    assert.fieldEquals('ProtocolState', '4663', 'governanceProposalCount', '0');
    assert.fieldEquals('ProtocolState', '4663', 'governanceVoteCount', '0');
    assert.fieldEquals('ProtocolEvent', eventId(bound), 'eventType', 'GOVERNOR_TIMELOCK_BOUND');
    assert.fieldEquals(
      'ProtocolEvent',
      eventId(bound),
      'addresses',
      `[${ZERO_ADDRESS.toHexString()}, ${STRATEGY.toHexString()}]`,
    );
  });

  test('records proposal lifecycle and vote receipts without inferring block-driven Governor state', () => {
    const proposalId = integer(77);
    const targets = new Array<Address>();
    targets.push(STRATEGY);
    const values = new Array<BigInt>();
    values.push(integer(0));
    const signatures = new Array<string>();
    signatures.push('');
    const calldatas = new Array<Bytes>();
    calldatas.push(HASH);

    const created = changetype<ProposalCreated>(newMockEvent());
    configureEvent(created, CONTRACT, 1);
    created.parameters = new Array<ethereum.EventParam>();
    created.parameters.push(uintParam('proposalId', 77));
    created.parameters.push(addressParam('proposer', USER));
    created.parameters.push(addressArrayParam('targets', targets));
    created.parameters.push(uintArrayParam('values', values));
    created.parameters.push(stringArrayParam('signatures', signatures));
    created.parameters.push(bytesArrayParam('calldatas', calldatas));
    created.parameters.push(uintParam('voteStart', 120));
    created.parameters.push(uintParam('voteEnd', 240));
    created.parameters.push(stringParam('description', 'Raise Mine capacity'));
    handleProposalCreated(created);

    const vote = changetype<VoteCast>(newMockEvent());
    configureEvent(vote, CONTRACT, 2);
    vote.parameters = new Array<ethereum.EventParam>();
    vote.parameters.push(addressParam('voter', USER));
    vote.parameters.push(uintParam('proposalId', 77));
    vote.parameters.push(uintParam('support', 1));
    vote.parameters.push(uintParam('weight', 70));
    vote.parameters.push(stringParam('reason', 'bounded maintenance'));
    handleVoteCast(vote);

    const parameterizedVote = changetype<VoteCastWithParams>(newMockEvent());
    configureEvent(parameterizedVote, CONTRACT, 3);
    parameterizedVote.parameters = new Array<ethereum.EventParam>();
    parameterizedVote.parameters.push(addressParam('voter', USER_TWO));
    parameterizedVote.parameters.push(uintParam('proposalId', 77));
    parameterizedVote.parameters.push(uintParam('support', 2));
    parameterizedVote.parameters.push(uintParam('weight', 5));
    parameterizedVote.parameters.push(stringParam('reason', 'abstain'));
    parameterizedVote.parameters.push(bytesParam('params', HASH));
    handleVoteCastWithParams(parameterizedVote);

    const queued = changetype<ProposalQueued>(newMockEvent());
    configureEvent(queued, CONTRACT, 4);
    queued.parameters = new Array<ethereum.EventParam>();
    queued.parameters.push(uintParam('proposalId', 77));
    queued.parameters.push(uintParam('etaSeconds', 1_000));
    handleProposalQueued(queued);

    const executed = changetype<ProposalExecuted>(newMockEvent());
    configureEvent(executed, CONTRACT, 5);
    executed.parameters = new Array<ethereum.EventParam>();
    executed.parameters.push(uintParam('proposalId', 77));
    handleProposalExecuted(executed);

    const canceled = changetype<ProposalCanceled>(newMockEvent());
    configureEvent(canceled, CONTRACT, 6);
    canceled.parameters = new Array<ethereum.EventParam>();
    canceled.parameters.push(uintParam('proposalId', 78));
    handleProposalCanceled(canceled);

    const id = governanceProposalId(CONTRACT, proposalId);
    assert.fieldEquals('ProtocolState', '4663', 'protocolGovernor', CONTRACT.toHexString());
    assert.fieldEquals('ProtocolState', '4663', 'governanceProposalCount', '1');
    assert.fieldEquals('ProtocolState', '4663', 'governanceVoteCount', '2');
    assert.fieldEquals('GovernanceProposal', id, 'lastLifecycleEvent', 'EXECUTED');
    assert.fieldEquals('GovernanceProposal', id, 'etaSeconds', '1000');
    assert.fieldEquals('GovernanceProposal', id, 'forVotesRaw', '70');
    assert.fieldEquals('GovernanceProposal', id, 'abstainVotesRaw', '5');
    assert.fieldEquals('GovernanceProposal', id, 'voteCount', '2');
    assert.fieldEquals('GovernanceVote', eventId(vote), 'reason', 'bounded maintenance');
    assert.fieldEquals('GovernanceVote', eventId(parameterizedVote), 'params', HASH.toHexString());
    assert.fieldEquals(
      'GovernanceProposal',
      governanceProposalId(CONTRACT, integer(78)),
      'lastLifecycleEvent',
      'CANCELED',
    );
  });

  test('tracks Timelock role membership from explicit grant and revoke logs', () => {
    const granted = changetype<RoleGranted>(newMockEvent());
    configureEvent(granted, CONTRACT, 1);
    granted.parameters = new Array<ethereum.EventParam>();
    granted.parameters.push(bytesParam('role', HASH));
    granted.parameters.push(addressParam('account', USER));
    granted.parameters.push(addressParam('sender', USER_TWO));
    handleRoleGranted(granted);

    const membershipId = timelockRoleMembershipId(CONTRACT, HASH, USER);
    assert.fieldEquals('TimelockRoleMembership', membershipId, 'granted', 'true');

    const revoked = changetype<RoleRevoked>(newMockEvent());
    configureEvent(revoked, CONTRACT, 2);
    revoked.parameters = new Array<ethereum.EventParam>();
    revoked.parameters.push(bytesParam('role', HASH));
    revoked.parameters.push(addressParam('account', USER));
    revoked.parameters.push(addressParam('sender', USER_TWO));
    handleRoleRevoked(revoked);

    assert.fieldEquals('TimelockRoleMembership', membershipId, 'granted', 'false');
    assert.fieldEquals('TimelockRoleMembership', membershipId, 'lastSender', USER_TWO.toHexString());
    assert.fieldEquals('ProtocolEvent', eventId(revoked), 'eventType', 'TIMELOCK_ROLE_REVOKED');
  });
});
