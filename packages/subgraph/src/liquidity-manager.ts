import {
  LiquidityManager__CanonicalPoolSeeded,
  LiquidityManager__CompletedRangeSwept,
  LiquidityManager__FeesCollected,
  LiquidityManager__MigrationCompleted,
  LiquidityManager__MigrationPauseSet,
  LiquidityManager__MigrationPositionAfter,
  LiquidityManager__MigrationPositionBefore,
  LiquidityManager__MigrationStarted,
  LiquidityManager__PositionRecorded,
} from '../generated/LiquidityManager/LiquidityManager';
import { LiquidityEvent } from '../generated/schema';
import { ZERO } from './constants';
import { getLiquidityPool, getLiquidityPosition, getProtocol } from './entities';
import { eventId } from './ids';

export function handleCanonicalPoolSeeded(event: LiquidityManager__CanonicalPoolSeeded): void {
  const pool = getLiquidityPool(event.address, event);
  pool.poolKeyHash = event.params.poolKeyHash;
  pool.seeded = true;
  pool.sqrtPriceX96 = event.params.sqrtPriceX96;
  pool.initialTick = event.params.initialTick;
  pool.firstPositionId = event.params.firstPositionId;
  pool.gbxPrincipalRaw = event.params.gbxPrincipal;
  pool.gbxResidualRaw = event.params.gbxResidual;
  pool.gbxGenesisAllocationRaw = event.params.gbxPrincipal.plus(event.params.gbxResidual);
  pool.save();

  const record = new LiquidityEvent(eventId(event));
  record.pool = pool.id;
  record.kind = 'POOL_SEEDED';
  record.gbxAmountRaw = event.params.gbxPrincipal;
  record.gbxResidualRaw = event.params.gbxResidual;
  record.usdgAmountRaw = ZERO;
  record.currentTick = event.params.initialTick;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();
}

export function handlePositionRecorded(event: LiquidityManager__PositionRecorded): void {
  const pool = getLiquidityPool(event.address, event);
  pool.activePositionCount += 1;
  pool.save();
  const position = getLiquidityPosition(event.address, event.params.positionId, event);
  position.tickLower = event.params.tickLower;
  position.tickUpper = event.params.tickUpper;
  position.liquidity = event.params.liquidity;
  position.gbxPrincipalRaw = event.params.gbxPrincipal;
  position.gbxPrincipalKnown = true;
  position.active = true;
  position.save();

  const record = new LiquidityEvent(eventId(event));
  record.pool = pool.id;
  record.position = position.id;
  record.kind = 'POSITION_MINTED';
  record.gbxAmountRaw = event.params.gbxPrincipal;
  record.gbxResidualRaw = ZERO;
  record.usdgAmountRaw = ZERO;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();
}

export function handleFeesCollected(event: LiquidityManager__FeesCollected): void {
  const protocol = getProtocol(event);
  protocol.liquidityGBXFeesBurnedRaw = protocol.liquidityGBXFeesBurnedRaw.plus(event.params.gbxBurned);
  protocol.liquidityUSDGFeesToVaultRaw = protocol.liquidityUSDGFeesToVaultRaw.plus(event.params.usdGToVault);
  protocol.save();
  const pool = getLiquidityPool(event.address, event);
  pool.gbxFeesBurnedRaw = pool.gbxFeesBurnedRaw.plus(event.params.gbxBurned);
  pool.usdgToVaultRaw = pool.usdgToVaultRaw.plus(event.params.usdGToVault);
  pool.save();
  const position = getLiquidityPosition(event.address, event.params.positionId, event);
  position.gbxFeesBurnedRaw = position.gbxFeesBurnedRaw.plus(event.params.gbxBurned);
  position.usdgCollectedRaw = position.usdgCollectedRaw.plus(event.params.usdGToVault);
  position.save();

  const record = new LiquidityEvent(eventId(event));
  record.pool = pool.id;
  record.position = position.id;
  record.kind = 'FEES_COLLECTED';
  record.gbxAmountRaw = event.params.gbxBurned;
  record.gbxResidualRaw = ZERO;
  record.usdgAmountRaw = event.params.usdGToVault;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();
}

export function handleCompletedRangeSwept(event: LiquidityManager__CompletedRangeSwept): void {
  const pool = getLiquidityPool(event.address, event);
  pool.gbxFeesBurnedRaw = pool.gbxFeesBurnedRaw.plus(event.params.gbxDustBurned);
  pool.usdgToVaultRaw = pool.usdgToVaultRaw.plus(event.params.usdGPrincipalAndFeesToVault);
  pool.activePositionCount -= 1;
  pool.save();
  const position = getLiquidityPosition(event.address, event.params.positionId, event);
  position.active = false;
  position.gbxFeesBurnedRaw = position.gbxFeesBurnedRaw.plus(event.params.gbxDustBurned);
  position.usdgCollectedRaw = position.usdgCollectedRaw.plus(event.params.usdGPrincipalAndFeesToVault);
  position.save();

  const record = new LiquidityEvent(eventId(event));
  record.pool = pool.id;
  record.position = position.id;
  record.kind = 'RANGE_SWEPT';
  record.gbxAmountRaw = event.params.gbxDustBurned;
  record.gbxResidualRaw = ZERO;
  record.usdgAmountRaw = event.params.usdGPrincipalAndFeesToVault;
  record.currentTick = event.params.currentTick;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();
}

export function handleMigrationStarted(event: LiquidityManager__MigrationStarted): void {
  const pool = getLiquidityPool(event.address, event);
  pool.lastMigrationPlanHash = event.params.planHash;
  pool.save();

  const record = new LiquidityEvent(eventId(event));
  record.pool = pool.id;
  record.kind = 'MIGRATION_STARTED';
  record.gbxAmountRaw = ZERO;
  record.gbxResidualRaw = ZERO;
  record.usdgAmountRaw = ZERO;
  record.planHash = event.params.planHash;
  record.destinationPoolKeyHash = event.params.destinationPoolKeyHash;
  record.removalCount = event.params.removalCount;
  record.replacementCount = event.params.replacementCount;
  record.deadline = event.params.deadline;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();
}

export function handleMigrationPositionBefore(event: LiquidityManager__MigrationPositionBefore): void {
  const pool = getLiquidityPool(event.address, event);
  pool.activePositionCount -= 1;
  pool.lastMigrationPlanHash = event.params.planHash;
  pool.save();
  const position = getLiquidityPosition(event.address, event.params.positionId, event);
  position.tickLower = event.params.tickLower;
  position.tickUpper = event.params.tickUpper;
  position.liquidity = event.params.liquidity;
  position.active = false;
  position.save();

  const record = new LiquidityEvent(eventId(event));
  record.pool = pool.id;
  record.position = position.id;
  record.kind = 'MIGRATION_POSITION_REMOVED';
  record.gbxAmountRaw = ZERO;
  record.gbxResidualRaw = ZERO;
  record.usdgAmountRaw = ZERO;
  record.planHash = event.params.planHash;
  record.amount0Raw = event.params.amount0Min;
  record.amount1Raw = event.params.amount1Min;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();
}

export function handleMigrationPositionAfter(event: LiquidityManager__MigrationPositionAfter): void {
  const pool = getLiquidityPool(event.address, event);
  pool.activePositionCount += 1;
  pool.lastMigrationPlanHash = event.params.planHash;
  pool.save();
  const position = getLiquidityPosition(event.address, event.params.positionId, event);
  position.tickLower = event.params.tickLower;
  position.tickUpper = event.params.tickUpper;
  position.liquidity = event.params.liquidity;
  position.gbxPrincipalRaw = null;
  position.gbxPrincipalKnown = false;
  position.active = true;
  position.save();

  const record = new LiquidityEvent(eventId(event));
  record.pool = pool.id;
  record.position = position.id;
  record.kind = 'MIGRATION_POSITION_ADDED';
  record.gbxAmountRaw = ZERO;
  record.gbxResidualRaw = ZERO;
  record.usdgAmountRaw = ZERO;
  record.planHash = event.params.planHash;
  record.amount0Raw = event.params.amount0Max;
  record.amount1Raw = event.params.amount1Max;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();
}

export function handleMigrationCompleted(event: LiquidityManager__MigrationCompleted): void {
  const pool = getLiquidityPool(event.address, event);
  pool.migrationCount += 1;
  pool.lastMigrationPlanHash = event.params.planHash;
  pool.gbxMigrationResidualBurnedRaw = pool.gbxMigrationResidualBurnedRaw.plus(event.params.gbxResidualBurned);
  pool.usdgToVaultRaw = pool.usdgToVaultRaw.plus(event.params.usdGResidualToVault);
  pool.save();

  const record = new LiquidityEvent(eventId(event));
  record.pool = pool.id;
  record.kind = 'MIGRATION_COMPLETED';
  record.gbxAmountRaw = event.params.gbxResidualBurned;
  record.gbxResidualRaw = event.params.gbxResidualBurned;
  record.usdgAmountRaw = event.params.usdGResidualToVault;
  record.planHash = event.params.planHash;
  record.destinationPoolKeyHash = event.params.destinationPoolKeyHash;
  record.removedPositionIds = event.params.removedPositionIds;
  record.replacementPositionIds = event.params.replacementPositionIds;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();
}

export function handleMigrationPauseSet(event: LiquidityManager__MigrationPauseSet): void {
  const pool = getLiquidityPool(event.address, event);
  pool.migrationsPaused = event.params.paused;
  pool.save();

  const record = new LiquidityEvent(eventId(event));
  record.pool = pool.id;
  record.kind = 'MIGRATION_PAUSE_SET';
  record.gbxAmountRaw = ZERO;
  record.gbxResidualRaw = ZERO;
  record.usdgAmountRaw = ZERO;
  record.paused = event.params.paused;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();
}
