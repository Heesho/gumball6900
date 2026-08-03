import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import {
  Account,
  GBXToken,
  GenesisBootstrap,
  LiquidityPool,
  LiquidityPosition,
  MiningEpoch,
  Protocol,
  SignalAccount,
  Strategy,
  StrategyBudget,
  VaultAsset,
} from '../generated/schema';
import { CHAIN_ID, CHAIN_ID_TEXT, ZERO } from './constants';
import { addressId, epochId, positionId } from './ids';

export function getProtocol(event: ethereum.Event): Protocol {
  let protocol = Protocol.load(CHAIN_ID_TEXT);
  if (protocol == null) {
    protocol = new Protocol(CHAIN_ID_TEXT);
    protocol.chainId = CHAIN_ID;
    protocol.cumulativeMintedRaw = ZERO;
    protocol.cumulativeBurnedRaw = ZERO;
    protocol.totalSupplyRaw = ZERO;
    protocol.genesisContributedRaw = ZERO;
    protocol.miningContributedRaw = ZERO;
    protocol.revenueNotifiedUSDGRaw = ZERO;
    protocol.strategySpentUSDGRaw = ZERO;
    protocol.redeemedSharesRaw = ZERO;
    protocol.buybackSpentUSDGRaw = ZERO;
    protocol.buybackBurnedGBXRaw = ZERO;
    protocol.liquidityGBXFeesBurnedRaw = ZERO;
    protocol.liquidityUSDGFeesToVaultRaw = ZERO;
    protocol.stakedGBXRaw = ZERO;
    protocol.assetCount = 0;
    protocol.strategyCount = 0;
    protocol.redemptionCount = 0;
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
    account.genesisContributedRaw = ZERO;
    account.miningContributedRaw = ZERO;
    account.genesisClaimedGBXRaw = ZERO;
    account.miningClaimedGBXRaw = ZERO;
    account.gbxMintedRaw = ZERO;
    account.gbxBurnedRaw = ZERO;
    account.stakedGBXRaw = ZERO;
    account.redeemedSharesRaw = ZERO;
    account.buybackSoldGBXRaw = ZERO;
    account.managerRewardClaimCount = 0;
    account.signalEventCount = 0;
  }
  account.lastBlockNumber = event.block.number;
  account.lastTimestamp = event.block.timestamp;
  return account;
}

export function getGBXToken(address: Address, event: ethereum.Event): GBXToken {
  const id = addressId(address);
  let token = GBXToken.load(id);
  if (token == null) {
    token = new GBXToken(id);
    token.address = address;
    token.cumulativeMintedRaw = ZERO;
    token.cumulativeBurnedRaw = ZERO;
    token.totalSupplyRaw = ZERO;
  }
  token.lastBlockNumber = event.block.number;
  token.lastTimestamp = event.block.timestamp;
  return token;
}

export function getGenesisBootstrap(address: Address, event: ethereum.Event): GenesisBootstrap {
  const id = addressId(address);
  let bootstrap = GenesisBootstrap.load(id);
  if (bootstrap == null) {
    bootstrap = new GenesisBootstrap(id);
    bootstrap.address = address;
    bootstrap.settled = false;
    bootstrap.communityUSDGRaw = ZERO;
    bootstrap.sponsorUSDGRaw = ZERO;
    bootstrap.vaultUSDGRaw = ZERO;
    bootstrap.sponsorRefundUSDGRaw = ZERO;
    bootstrap.claimedGBXRaw = ZERO;
  }
  bootstrap.lastBlockNumber = event.block.number;
  bootstrap.lastTimestamp = event.block.timestamp;
  return bootstrap;
}

export function getMiningEpoch(pool: Address, epoch: BigInt, event: ethereum.Event): MiningEpoch {
  const id = epochId(pool, epoch);
  let entity = MiningEpoch.load(id);
  if (entity == null) {
    entity = new MiningEpoch(id);
    entity.pool = pool;
    entity.epochId = epoch;
    entity.extensionUsed = ZERO;
    entity.totalContributedUSDGRaw = ZERO;
    entity.settled = false;
    entity.scheduledEmissionGBXRaw = ZERO;
    entity.actualEmissionGBXRaw = ZERO;
  }
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  return entity;
}

export function getSignalAccount(address: Address, event: ethereum.Event): SignalAccount {
  const id = addressId(address);
  let signal = SignalAccount.load(id);
  if (signal == null) {
    signal = new SignalAccount(id);
    signal.account = id;
    signal.stakedGBXRaw = ZERO;
  }
  signal.lastBlockNumber = event.block.number;
  signal.lastTimestamp = event.block.timestamp;
  return signal;
}

export function getStrategy(address: Address, event: ethereum.Event): Strategy {
  const id = addressId(address);
  let strategy = Strategy.load(id);
  if (strategy == null) {
    strategy = new Strategy(id);
    strategy.address = address;
    strategy.kind = 'UNKNOWN';
    strategy.enabled = true;
    strategy.generation = ZERO;
    strategy.totalUSDGSpentRaw = ZERO;
    strategy.totalTargetReceivedRaw = ZERO;
    strategy.totalVaultReceivedRaw = ZERO;
    strategy.totalManagerReceivedRaw = ZERO;
    strategy.pendingManagerRewardDustRaw = ZERO;
    strategy.fillCount = 0;
  }
  strategy.lastBlockNumber = event.block.number;
  strategy.lastTimestamp = event.block.timestamp;
  return strategy;
}

export function getStrategyBudget(address: Address, event: ethereum.Event): StrategyBudget {
  const id = addressId(address);
  let budget = StrategyBudget.load(id);
  if (budget == null) {
    budget = new StrategyBudget(id);
    budget.strategy = id;
    budget.budgetUSDGRaw = ZERO;
    budget.scaledRemainder = ZERO;
    budget.globalIndex = ZERO;
    budget.totalConsumedUSDGRaw = ZERO;
    budget.returnedToIdleUSDGRaw = ZERO;
  }
  budget.lastBlockNumber = event.block.number;
  budget.lastTimestamp = event.block.timestamp;
  return budget;
}

export function getVaultAsset(address: Address, event: ethereum.Event): VaultAsset {
  const id = addressId(address);
  let asset = VaultAsset.load(id);
  if (asset == null) {
    asset = new VaultAsset(id);
    asset.token = address;
    asset.decimals = 0;
    asset.isStockToken = false;
    asset.acquisitionEnabled = false;
    asset.redemptionEnabled = false;
    asset.redemptionEnabledKnown = false;
    asset.trackedBalanceRaw = ZERO;
    asset.acquiredByStrategiesRaw = ZERO;
    asset.redeemedRaw = ZERO;
  }
  asset.lastBlockNumber = event.block.number;
  asset.lastTimestamp = event.block.timestamp;
  return asset;
}

export function getLiquidityPool(manager: Address, event: ethereum.Event): LiquidityPool {
  const id = addressId(manager);
  let pool = LiquidityPool.load(id);
  if (pool == null) {
    pool = new LiquidityPool(id);
    pool.manager = manager;
    pool.seeded = false;
    pool.gbxGenesisAllocationRaw = ZERO;
    pool.gbxPrincipalRaw = ZERO;
    pool.gbxResidualRaw = ZERO;
    pool.gbxFeesBurnedRaw = ZERO;
    pool.gbxMigrationResidualBurnedRaw = ZERO;
    pool.usdgToVaultRaw = ZERO;
    pool.activePositionCount = 0;
    pool.migrationCount = 0;
    pool.migrationsPaused = false;
  }
  pool.lastBlockNumber = event.block.number;
  pool.lastTimestamp = event.block.timestamp;
  return pool;
}

export function getLiquidityPosition(manager: Address, tokenId: BigInt, event: ethereum.Event): LiquidityPosition {
  const id = positionId(manager, tokenId);
  let position = LiquidityPosition.load(id);
  if (position == null) {
    position = new LiquidityPosition(id);
    position.pool = addressId(manager);
    position.positionId = tokenId;
    position.tickLower = 0;
    position.tickUpper = 0;
    position.liquidity = ZERO;
    position.gbxPrincipalKnown = false;
    position.active = true;
    position.gbxFeesBurnedRaw = ZERO;
    position.usdgCollectedRaw = ZERO;
  }
  position.lastBlockNumber = event.block.number;
  position.lastTimestamp = event.block.timestamp;
  return position;
}
