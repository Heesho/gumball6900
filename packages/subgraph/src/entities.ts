import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { Account, FundraiserEpoch, ProtocolEvent, ProtocolState, Strategy } from '../generated/schema';
import { CHAIN_ID, CHAIN_ID_TEXT, ZERO } from './constants';
import { addressId, epochId, eventId } from './ids';

export function getProtocol(event: ethereum.Event): ProtocolState {
  let protocol = ProtocolState.load(CHAIN_ID_TEXT);
  if (protocol == null) {
    protocol = new ProtocolState(CHAIN_ID_TEXT);
    protocol.chainId = CHAIN_ID;
    protocol.lifetimeMintedRaw = ZERO;
    protocol.lifetimeBurnedRaw = ZERO;
    protocol.totalSupplyRaw = ZERO;
    protocol.fundraiserContributionsRaw = ZERO;
    protocol.fundraiserClaimsRaw = ZERO;
    protocol.liquidityGBXBurnedRaw = ZERO;
    protocol.liquidityUSDGRoutedRaw = ZERO;
    protocol.routedRevenueRaw = ZERO;
    protocol.notifiedRevenueRaw = ZERO;
    protocol.distributedRevenueRaw = ZERO;
    protocol.stakedGBXRaw = ZERO;
    protocol.fundBurnedGBXRaw = ZERO;
    protocol.redeemedGBXRaw = ZERO;
    protocol.bribeBps = ZERO;
    protocol.timelockDelay = ZERO;
    protocol.strategyCount = 0;
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
    account.gbxMintedRaw = ZERO;
    account.gbxBurnedRaw = ZERO;
    account.contributedUSDGRaw = ZERO;
    account.claimedGBXRaw = ZERO;
    account.stakedGBXRaw = ZERO;
    account.signalWeightRaw = ZERO;
    account.redeemedGBXRaw = ZERO;
  }
  account.lastBlockNumber = event.block.number;
  account.lastTimestamp = event.block.timestamp;
  return account;
}

export function getFundraiserEpoch(fundraiser: Address, epoch: BigInt, event: ethereum.Event): FundraiserEpoch {
  const id = epochId(fundraiser, epoch);
  let entity = FundraiserEpoch.load(id);
  if (entity == null) {
    entity = new FundraiserEpoch(id);
    entity.fundraiser = fundraiser;
    entity.epoch = epoch;
    entity.totalContributionsRaw = ZERO;
    entity.totalClaimedGBXRaw = ZERO;
    entity.settled = false;
    entity.scheduledEmissionRaw = ZERO;
    entity.contributorEmissionRaw = ZERO;
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
    strategy.kind = 0;
    strategy.live = true;
    strategy.totalSignalWeightRaw = ZERO;
    strategy.distributedRevenueRaw = ZERO;
    strategy.createdBlockNumber = event.block.number;
  }
  strategy.lastBlockNumber = event.block.number;
  strategy.lastTimestamp = event.block.timestamp;
  return strategy;
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
