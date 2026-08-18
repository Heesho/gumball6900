import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import {
  Account,
  GovernanceProposal,
  MiningSlot,
  ProtocolEvent,
  ProtocolState,
  Strategy,
  TimelockRoleMembership,
} from '../generated/schema';
import { CHAIN_ID, CHAIN_ID_TEXT, ZERO } from './constants';
import { addressId, eventId, governanceProposalId, slotId, timelockRoleMembershipId } from './ids';

export function getProtocol(event: ethereum.Event): ProtocolState {
  let protocol = ProtocolState.load(CHAIN_ID_TEXT);
  if (protocol == null) {
    protocol = new ProtocolState(CHAIN_ID_TEXT);
    protocol.chainId = CHAIN_ID;
    protocol.initialSupplyRaw = ZERO;
    protocol.lifetimeMintedRaw = ZERO;
    protocol.lifetimeBurnedRaw = ZERO;
    protocol.totalSupplyRaw = ZERO;
    protocol.minedGBXRaw = ZERO;
    protocol.miningPaymentsRaw = ZERO;
    protocol.previousMinerPaymentsRaw = ZERO;
    protocol.miningRevenueRoutedRaw = ZERO;
    protocol.miningSlotCount = BigInt.fromI32(16);
    protocol.liquidityPrincipalRaw = ZERO;
    protocol.liquidityFeeHarvestCount = ZERO;
    protocol.liquidityUSDGRoutedRaw = ZERO;
    protocol.liquidityGBXBurnedRaw = ZERO;
    protocol.routedRevenueRaw = ZERO;
    protocol.notifiedRevenueRaw = ZERO;
    protocol.revenueNotificationCount = ZERO;
    protocol.latestRevenueNotificationRaw = ZERO;
    protocol.latestRevenueNotificationAt = ZERO;
    protocol.distributedRevenueRaw = ZERO;
    protocol.signaledGBXRaw = ZERO;
    protocol.fundBurnedGBXRaw = ZERO;
    protocol.redeemedGBXRaw = ZERO;
    protocol.timelockDelay = ZERO;
    protocol.strategyCount = 0;
    protocol.liveStrategyCount = 0;
    protocol.governanceProposalCount = ZERO;
    protocol.governanceVoteCount = ZERO;
  }
  protocol.lastBlockNumber = event.block.number;
  protocol.lastTimestamp = event.block.timestamp;
  return protocol;
}

export function getAccount(address: Address, event: ethereum.Event): Account {
  const id = addressId(address);
  let account = Account.load(id);
  if (account == null) {
    account = new Account(id);
    account.address = address;
    account.gbxInitialAllocationRaw = ZERO;
    account.gbxMinedRaw = ZERO;
    account.gbxBurnedRaw = ZERO;
    account.miningPaymentAccruedRaw = ZERO;
    account.miningUSDGClaimedRaw = ZERO;
    account.signaledGBXRaw = ZERO;
    account.signalWeightRaw = ZERO;
    account.currentDelegate = Address.zero();
    account.delegatedVotesRaw = ZERO;
    account.governanceVotesCast = ZERO;
    account.redeemedGBXRaw = ZERO;
  }
  account.lastBlockNumber = event.block.number;
  account.lastTimestamp = event.block.timestamp;
  return account;
}

export function getMiningSlot(mine: Address, index: BigInt, event: ethereum.Event): MiningSlot {
  const id = slotId(mine, index);
  let entity = MiningSlot.load(id);
  if (entity == null) {
    entity = new MiningSlot(id);
    entity.mineContract = mine;
    entity.index = index;
    entity.epoch = ZERO;
    entity.currentMiner = Address.zero();
    entity.initialPriceRaw = ZERO;
    entity.auctionStartedAt = ZERO;
    entity.tpsRaw = ZERO;
    entity.totalMinedRaw = ZERO;
    entity.totalReplacementPaidRaw = ZERO;
    entity.lastPriceRaw = ZERO;
  }
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  return entity;
}

export function getStrategy(address: Address, event: ethereum.Event): Strategy {
  const id = addressId(address);
  let strategy = Strategy.load(id);
  if (strategy == null) {
    strategy = new Strategy(id);
    strategy.address = address;
    strategy.bribe = Address.zero();
    strategy.bribeRouter = Address.zero();
    strategy.paymentToken = Address.zero();
    strategy.live = true;
    strategy.totalSignalWeightRaw = ZERO;
    strategy.distributedRevenueRaw = ZERO;
    strategy.notifiedRewardRaw = ZERO;
    strategy.paidRewardRaw = ZERO;
    strategy.routerFundPaymentAccruedRaw = ZERO;
    strategy.routerFundPaymentPaidRaw = ZERO;
    strategy.pendingRouterFundPaymentRaw = ZERO;
    strategy.routerBribePaymentAccruedRaw = ZERO;
    strategy.routerBribePaymentNotifiedRaw = ZERO;
    strategy.pendingRouterBribePaymentRaw = ZERO;
    strategy.routerSplitRemainderRaw = ZERO;
    strategy.bribeFundRewardAccruedRaw = ZERO;
    strategy.bribeFundRewardPaidRaw = ZERO;
    strategy.pendingBribeFundRewardRaw = ZERO;
    strategy.createdBlockNumber = event.block.number;
  }
  strategy.lastBlockNumber = event.block.number;
  strategy.lastTimestamp = event.block.timestamp;
  return strategy;
}

export function getGovernanceProposal(
  governor: Address,
  proposalId: BigInt,
  event: ethereum.Event,
): GovernanceProposal {
  const id = governanceProposalId(governor, proposalId);
  let proposal = GovernanceProposal.load(id);
  if (proposal == null) {
    proposal = new GovernanceProposal(id);
    proposal.governor = governor;
    proposal.proposalId = proposalId;
    proposal.lastLifecycleEvent = 'UNKNOWN';
    proposal.againstVotesRaw = ZERO;
    proposal.forVotesRaw = ZERO;
    proposal.abstainVotesRaw = ZERO;
    proposal.voteCount = ZERO;
  }
  proposal.lastBlockNumber = event.block.number;
  proposal.lastTimestamp = event.block.timestamp;
  return proposal;
}

export function getTimelockRoleMembership(
  timelock: Address,
  role: Bytes,
  account: Address,
  event: ethereum.Event,
): TimelockRoleMembership {
  const id = timelockRoleMembershipId(timelock, role, account);
  let membership = TimelockRoleMembership.load(id);
  if (membership == null) {
    membership = new TimelockRoleMembership(id);
    membership.timelock = timelock;
    membership.role = role;
    membership.account = account;
    membership.granted = false;
    membership.lastSender = Address.zero();
  }
  membership.lastBlockNumber = event.block.number;
  membership.lastTimestamp = event.block.timestamp;
  membership.lastTransactionHash = event.transaction.hash;
  membership.lastLogIndex = event.logIndex;
  return membership;
}

export function recordEvent(event: ethereum.Event, eventType: string): ProtocolEvent {
  const record = new ProtocolEvent(eventId(event));
  record.eventType = eventType;
  record.contractAddress = event.address;
  record.addresses = new Array<Bytes>();
  record.values = new Array<BigInt>();
  record.bytesValues = new Array<Bytes>();
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  return record;
}
