import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { Account, MiningSlot, ProtocolEvent, ProtocolState, SignalPosition, Strategy } from '../generated/schema';
import { CHAIN_ID, CHAIN_ID_TEXT, DEFAULT_BRIBE_BPS, ZERO } from './constants';
import { addressId, eventId, signalPositionId, slotId } from './ids';

export function getProtocol(event: ethereum.Event): ProtocolState {
  let protocol = ProtocolState.load(CHAIN_ID_TEXT);
  if (protocol == null) {
    protocol = new ProtocolState(CHAIN_ID_TEXT);
    protocol.chainId = CHAIN_ID;
    protocol.bribeBps = DEFAULT_BRIBE_BPS;
    protocol.lifetimeMintedRaw = ZERO;
    protocol.lifetimeBurnedRaw = ZERO;
    protocol.totalSupplyRaw = ZERO;
    protocol.genesisLiquidityGBXRaw = ZERO;
    protocol.genesisPair = Address.zero();
    protocol.minedGBXRaw = ZERO;
    protocol.miningPaymentsRaw = ZERO;
    protocol.previousMinerPaymentsRaw = ZERO;
    protocol.miningRevenueDepositedRaw = ZERO;
    protocol.miningSlotCount = BigInt.fromI32(16);
    protocol.routedRevenueRaw = ZERO;
    protocol.notifiedRevenueRaw = ZERO;
    protocol.revenueNotificationCount = ZERO;
    protocol.latestRevenueNotificationRaw = ZERO;
    protocol.latestRevenueNotificationAt = ZERO;
    protocol.distributedRevenueRaw = ZERO;
    protocol.signaledGBXRaw = ZERO;
    protocol.fundBurnedGBXRaw = ZERO;
    protocol.redeemedGBXRaw = ZERO;
    protocol.strategyCount = 0;
    protocol.liveStrategyCount = 0;
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
    account.gbxMinedRaw = ZERO;
    account.gbxBurnedRaw = ZERO;
    account.miningPaymentAccruedRaw = ZERO;
    account.miningUSDGClaimedRaw = ZERO;
    account.signaledGBXRaw = ZERO;
    account.signalWeightRaw = ZERO;
    account.currentDelegate = Address.zero();
    account.delegatedVotesRaw = ZERO;
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
    entity.currentMessage = '';
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
    strategy.routerRewardsRoutedRaw = ZERO;
    strategy.createdBlockNumber = event.block.number;
  }
  strategy.lastBlockNumber = event.block.number;
  strategy.lastTimestamp = event.block.timestamp;
  return strategy;
}

export function getSignalPosition(account: Address, strategy: Address, event: ethereum.Event): SignalPosition {
  const id = signalPositionId(account, strategy);
  let position = SignalPosition.load(id);
  if (position == null) {
    position = new SignalPosition(id);
    position.account = addressId(account);
    position.strategy = addressId(strategy);
    position.accountAddress = account;
    position.strategyAddress = strategy;
    position.amountRaw = ZERO;
  }
  position.lastBlockNumber = event.block.number;
  position.lastTimestamp = event.block.timestamp;
  return position;
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
