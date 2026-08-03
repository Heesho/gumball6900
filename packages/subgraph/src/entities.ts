import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import {
  Account,
  LiquidityPosition,
  MiningEpoch,
  ProtocolEvent,
  ProtocolState,
  Strategy,
  VaultAsset,
} from '../generated/schema';
import { CHAIN_ID, CHAIN_ID_TEXT, ZERO } from './constants';
import { addressId, epochId, eventId, positionId } from './ids';

export function getProtocol(event: ethereum.Event): ProtocolState {
  let protocol = ProtocolState.load(CHAIN_ID_TEXT);
  if (protocol == null) {
    protocol = new ProtocolState(CHAIN_ID_TEXT);
    protocol.chainId = CHAIN_ID;
    protocol.cumulativeMintedRaw = ZERO;
    protocol.cumulativeBurnedRaw = ZERO;
    protocol.totalSupplyRaw = ZERO;
    protocol.miningContributedUSDGRaw = ZERO;
    protocol.miningEmittedGBXRaw = ZERO;
    protocol.vaultRevenueUSDGRaw = ZERO;
    protocol.redeemedGBXRaw = ZERO;
    protocol.strategySpentUSDGRaw = ZERO;
    protocol.buybackBurnedGBXRaw = ZERO;
    protocol.liquidityFeesBurnedGBXRaw = ZERO;
    protocol.liquidityFeesToVaultUSDGRaw = ZERO;
    protocol.stakedGBXRaw = ZERO;
    protocol.assetCount = 0;
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
    account.miningContributedUSDGRaw = ZERO;
    account.miningClaimedGBXRaw = ZERO;
    account.stakedGBXRaw = ZERO;
    account.signalWeightRaw = ZERO;
    account.redeemedGBXRaw = ZERO;
    account.buybackSoldGBXRaw = ZERO;
  }
  account.lastBlockNumber = event.block.number;
  account.lastTimestamp = event.block.timestamp;
  return account;
}

export function getMiningEpoch(pool: Address, epoch: BigInt, event: ethereum.Event): MiningEpoch {
  const id = epochId(pool, epoch);
  let entity = MiningEpoch.load(id);
  if (entity == null) {
    entity = new MiningEpoch(id);
    entity.pool = pool;
    entity.epochId = epoch;
    entity.totalContributedUSDGRaw = ZERO;
    entity.teamFeeUSDGRaw = ZERO;
    entity.vaultRevenueUSDGRaw = ZERO;
    entity.emissionGBXRaw = ZERO;
    entity.settled = false;
  }
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  return entity;
}

export function getVaultAsset(token: Address, event: ethereum.Event): VaultAsset {
  const id = addressId(token);
  let asset = VaultAsset.load(id);
  if (asset == null) {
    asset = new VaultAsset(id);
    asset.token = token;
    asset.assetIndex = ZERO;
    asset.live = true;
    asset.registeredBlockNumber = event.block.number;
  }
  asset.lastBlockNumber = event.block.number;
  asset.lastTimestamp = event.block.timestamp;
  return asset;
}

export function getStrategy(address: Address, event: ethereum.Event): Strategy {
  const id = addressId(address);
  let strategy = Strategy.load(id);
  if (strategy == null) {
    strategy = new Strategy(id);
    strategy.address = address;
    strategy.kind = 'UNKNOWN';
    strategy.live = true;
    strategy.fillsPaused = false;
    strategy.totalWeightRaw = ZERO;
    strategy.budgetUSDGRaw = ZERO;
    strategy.totalUSDGSpentRaw = ZERO;
    strategy.totalQuotedPaymentRaw = ZERO;
    strategy.totalObservedPaymentRaw = ZERO;
    strategy.totalVaultReceivedRaw = ZERO;
    strategy.totalRewardsNotifiedRaw = ZERO;
    strategy.totalRewardsClaimedRaw = ZERO;
    strategy.fillCount = 0;
  }
  strategy.lastBlockNumber = event.block.number;
  strategy.lastTimestamp = event.block.timestamp;
  return strategy;
}

export function getLiquidityPosition(
  custodian: Address,
  tokenId: BigInt,
  poolKeyHash: Bytes,
  previousOwner: Address,
  event: ethereum.Event,
): LiquidityPosition {
  const id = positionId(custodian, tokenId);
  let position = LiquidityPosition.load(id);
  if (position == null) {
    position = new LiquidityPosition(id);
    position.custodian = custodian;
    position.positionId = tokenId;
    position.poolKeyHash = poolKeyHash;
    position.previousOwner = previousOwner;
    position.inCustody = true;
    position.gbxFeesBurnedRaw = ZERO;
    position.usdgFeesToVaultRaw = ZERO;
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
