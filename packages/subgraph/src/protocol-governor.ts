import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import {
  ProposalCanceled,
  ProposalCreated,
  ProposalExecuted,
  ProposalQueued,
  TimelockChange,
  VoteCast,
  VoteCastWithParams,
} from '../generated/ProtocolGovernor/ProtocolGovernor';
import { GovernanceVote } from '../generated/schema';
import { ONE } from './constants';
import { getAccount, getGovernanceProposal, getProtocol, recordEvent } from './entities';
import { eventId } from './ids';

export function handleGovernorTimelockChange(event: TimelockChange): void {
  const protocol = getProtocol(event);
  protocol.protocolGovernor = event.address;
  protocol.save();

  const record = recordEvent(event, 'GOVERNOR_TIMELOCK_BOUND');
  record.addresses = [event.params.oldTimelock, event.params.newTimelock];
  record.save();
}

export function handleProposalCreated(event: ProposalCreated): void {
  const protocol = getProtocol(event);
  protocol.protocolGovernor = event.address;
  protocol.governanceProposalCount = protocol.governanceProposalCount.plus(ONE);
  protocol.save();

  const proposal = getGovernanceProposal(event.address, event.params.proposalId, event);
  const targets = new Array<Bytes>();
  for (let i = 0; i < event.params.targets.length; i++) targets.push(event.params.targets[i]);
  proposal.proposer = event.params.proposer;
  proposal.targets = targets;
  proposal.values = event.params.values;
  proposal.signatures = event.params.signatures;
  proposal.calldatas = event.params.calldatas;
  proposal.voteStart = event.params.voteStart;
  proposal.voteEnd = event.params.voteEnd;
  proposal.description = event.params.description;
  proposal.lastLifecycleEvent = 'CREATED';
  proposal.createdBlockNumber = event.block.number;
  proposal.createdTimestamp = event.block.timestamp;
  proposal.save();

  const addresses = new Array<Bytes>();
  addresses.push(event.params.proposer);
  for (let i = 0; i < targets.length; i++) addresses.push(targets[i]);
  const values = [event.params.proposalId, event.params.voteStart, event.params.voteEnd];
  for (let i = 0; i < event.params.values.length; i++) values.push(event.params.values[i]);

  const record = recordEvent(event, 'GOVERNOR_PROPOSAL_CREATED');
  record.addresses = addresses;
  record.values = values;
  record.bytesValues = event.params.calldatas;
  record.save();
}

export function handleProposalQueued(event: ProposalQueued): void {
  const protocol = getProtocol(event);
  protocol.protocolGovernor = event.address;
  protocol.save();

  const proposal = getGovernanceProposal(event.address, event.params.proposalId, event);
  proposal.etaSeconds = event.params.etaSeconds;
  proposal.lastLifecycleEvent = 'QUEUED';
  proposal.save();

  const record = recordEvent(event, 'GOVERNOR_PROPOSAL_QUEUED');
  record.values = [event.params.proposalId, event.params.etaSeconds];
  record.save();
}

export function handleProposalCanceled(event: ProposalCanceled): void {
  const protocol = getProtocol(event);
  protocol.protocolGovernor = event.address;
  protocol.save();

  const proposal = getGovernanceProposal(event.address, event.params.proposalId, event);
  proposal.lastLifecycleEvent = 'CANCELED';
  proposal.save();

  const record = recordEvent(event, 'GOVERNOR_PROPOSAL_CANCELED');
  record.values = [event.params.proposalId];
  record.save();
}

export function handleProposalExecuted(event: ProposalExecuted): void {
  const protocol = getProtocol(event);
  protocol.protocolGovernor = event.address;
  protocol.save();

  const proposal = getGovernanceProposal(event.address, event.params.proposalId, event);
  proposal.lastLifecycleEvent = 'EXECUTED';
  proposal.save();

  const record = recordEvent(event, 'GOVERNOR_PROPOSAL_EXECUTED');
  record.values = [event.params.proposalId];
  record.save();
}

export function handleVoteCast(event: VoteCast): void {
  saveVote(
    event,
    event.params.voter,
    event.params.proposalId,
    event.params.support,
    event.params.weight,
    event.params.reason,
    Bytes.fromHexString('0x'),
    'GOVERNOR_VOTE_CAST',
  );
}

export function handleVoteCastWithParams(event: VoteCastWithParams): void {
  saveVote(
    event,
    event.params.voter,
    event.params.proposalId,
    event.params.support,
    event.params.weight,
    event.params.reason,
    event.params.params,
    'GOVERNOR_VOTE_CAST_WITH_PARAMS',
  );
}

function saveVote(
  event: ethereum.Event,
  voter: Address,
  proposalId: BigInt,
  support: i32,
  weight: BigInt,
  reason: string,
  params: Bytes,
  eventType: string,
): void {
  const protocol = getProtocol(event);
  protocol.protocolGovernor = event.address;
  protocol.governanceVoteCount = protocol.governanceVoteCount.plus(ONE);
  protocol.save();

  const account = getAccount(voter, event);
  account.governanceVotesCast = account.governanceVotesCast.plus(ONE);
  account.save();

  const proposal = getGovernanceProposal(event.address, proposalId, event);
  if (support == 0) {
    proposal.againstVotesRaw = proposal.againstVotesRaw.plus(weight);
  } else if (support == 1) {
    proposal.forVotesRaw = proposal.forVotesRaw.plus(weight);
  } else if (support == 2) {
    proposal.abstainVotesRaw = proposal.abstainVotesRaw.plus(weight);
  }
  proposal.voteCount = proposal.voteCount.plus(ONE);
  proposal.save();

  const vote = new GovernanceVote(eventId(event));
  vote.proposal = proposal.id;
  vote.governor = event.address;
  vote.proposalId = proposalId;
  vote.voter = voter;
  vote.support = support;
  vote.weightRaw = weight;
  vote.reason = reason;
  vote.params = params;
  vote.blockNumber = event.block.number;
  vote.timestamp = event.block.timestamp;
  vote.transactionHash = event.transaction.hash;
  vote.logIndex = event.logIndex;
  vote.save();

  const record = recordEvent(event, eventType);
  record.addresses = [voter];
  record.values = [proposalId, BigInt.fromI32(support), weight];
  record.bytesValues = [params];
  record.save();
}
