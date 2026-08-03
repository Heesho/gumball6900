import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
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
import {
  handleCanonicalPoolSeeded,
  handleCompletedRangeSwept,
  handleFeesCollected,
  handleMigrationCompleted,
  handleMigrationPauseSet,
  handleMigrationPositionAfter,
  handleMigrationPositionBefore,
  handleMigrationStarted,
  handlePositionRecorded,
} from '../src/liquidity-manager';
import { eventId } from '../src/ids';
import { CONTRACT, HASH, boolParam, bytesParam, configureEvent, intParam, integer, uintParam } from './helpers';

export {
  handleCanonicalPoolSeeded,
  handleCompletedRangeSwept,
  handleFeesCollected,
  handleMigrationCompleted,
  handleMigrationPauseSet,
  handleMigrationPositionAfter,
  handleMigrationPositionBefore,
  handleMigrationStarted,
  handlePositionRecorded,
};

describe('liquidity mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('indexes v4 position mint, pool seed, fees, and completed range sweep', () => {
    const position = changetype<LiquidityManager__PositionRecorded>(newMockEvent());
    configureEvent(position, CONTRACT, 1);
    position.parameters = new Array<ethereum.EventParam>();
    position.parameters.push(uintParam('positionId', 11));
    position.parameters.push(intParam('tickLower', -100));
    position.parameters.push(intParam('tickUpper', 100));
    position.parameters.push(uintParam('liquidity', 1000));
    position.parameters.push(uintParam('gbxPrincipal', 500));
    handlePositionRecorded(position);

    const seeded = changetype<LiquidityManager__CanonicalPoolSeeded>(newMockEvent());
    configureEvent(seeded, CONTRACT, 2);
    seeded.parameters = new Array<ethereum.EventParam>();
    seeded.parameters.push(bytesParam('poolKeyHash', HASH));
    seeded.parameters.push(uintParam('sqrtPriceX96', 100));
    seeded.parameters.push(intParam('initialTick', 0));
    seeded.parameters.push(uintParam('firstPositionId', 11));
    seeded.parameters.push(uintParam('gbxPrincipal', 500));
    seeded.parameters.push(uintParam('gbxResidual', 7));
    handleCanonicalPoolSeeded(seeded);

    const fees = changetype<LiquidityManager__FeesCollected>(newMockEvent());
    configureEvent(fees, CONTRACT, 3);
    fees.parameters = new Array<ethereum.EventParam>();
    fees.parameters.push(uintParam('positionId', 11));
    fees.parameters.push(uintParam('gbxBurned', 2));
    fees.parameters.push(uintParam('usdGToVault', 3));
    handleFeesCollected(fees);

    const swept = changetype<LiquidityManager__CompletedRangeSwept>(newMockEvent());
    configureEvent(swept, CONTRACT, 4);
    swept.parameters = new Array<ethereum.EventParam>();
    swept.parameters.push(uintParam('positionId', 11));
    swept.parameters.push(intParam('currentTick', 101));
    swept.parameters.push(uintParam('gbxDustBurned', 1));
    swept.parameters.push(uintParam('usdGPrincipalAndFeesToVault', 400));
    handleCompletedRangeSwept(swept);

    const poolId = '4663-' + CONTRACT.toHexString();
    const positionId = poolId + '-position-11';
    assert.entityCount('LiquidityEvent', 4);
    assert.fieldEquals('LiquidityPool', poolId, 'activePositionCount', '0');
    assert.fieldEquals('LiquidityPool', poolId, 'gbxGenesisAllocationRaw', '507');
    assert.fieldEquals('LiquidityPool', poolId, 'gbxPrincipalRaw', '500');
    assert.fieldEquals('LiquidityPool', poolId, 'gbxResidualRaw', '7');
    assert.fieldEquals('LiquidityPool', poolId, 'usdgToVaultRaw', '403');
    assert.fieldEquals('Protocol', '4663', 'liquidityGBXFeesBurnedRaw', '2');
    assert.fieldEquals('Protocol', '4663', 'liquidityUSDGFeesToVaultRaw', '3');
    assert.fieldEquals('LiquidityPosition', positionId, 'active', 'false');
    assert.fieldEquals('LiquidityPosition', positionId, 'gbxPrincipalRaw', '500');
    assert.fieldEquals('LiquidityPosition', positionId, 'gbxFeesBurnedRaw', '3');
    assert.fieldEquals('LiquidityEvent', eventId(seeded), 'gbxResidualRaw', '7');
  });

  test('indexes the complete liquidity migration and pause lifecycle', () => {
    const position = changetype<LiquidityManager__PositionRecorded>(newMockEvent());
    configureEvent(position, CONTRACT, 1);
    position.parameters = new Array<ethereum.EventParam>();
    position.parameters.push(uintParam('positionId', 11));
    position.parameters.push(intParam('tickLower', -100));
    position.parameters.push(intParam('tickUpper', 100));
    position.parameters.push(uintParam('liquidity', 1000));
    position.parameters.push(uintParam('gbxPrincipal', 500));
    handlePositionRecorded(position);

    const secondPosition = changetype<LiquidityManager__PositionRecorded>(newMockEvent());
    configureEvent(secondPosition, CONTRACT, 2);
    secondPosition.parameters = new Array<ethereum.EventParam>();
    secondPosition.parameters.push(uintParam('positionId', 12));
    secondPosition.parameters.push(intParam('tickLower', 100));
    secondPosition.parameters.push(intParam('tickUpper', 200));
    secondPosition.parameters.push(uintParam('liquidity', 800));
    secondPosition.parameters.push(uintParam('gbxPrincipal', 400));
    handlePositionRecorded(secondPosition);

    const destinationHash = Bytes.fromHexString('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    const started = changetype<LiquidityManager__MigrationStarted>(newMockEvent());
    configureEvent(started, CONTRACT, 3);
    started.parameters = new Array<ethereum.EventParam>();
    started.parameters.push(bytesParam('planHash', HASH));
    started.parameters.push(bytesParam('destinationPoolKeyHash', destinationHash));
    started.parameters.push(uintParam('removalCount', 2));
    started.parameters.push(uintParam('replacementCount', 1));
    started.parameters.push(uintParam('deadline', 2000000000));
    handleMigrationStarted(started);

    const before = changetype<LiquidityManager__MigrationPositionBefore>(newMockEvent());
    configureEvent(before, CONTRACT, 4);
    before.parameters = new Array<ethereum.EventParam>();
    before.parameters.push(bytesParam('planHash', HASH));
    before.parameters.push(uintParam('positionId', 11));
    before.parameters.push(intParam('tickLower', -100));
    before.parameters.push(intParam('tickUpper', 100));
    before.parameters.push(uintParam('liquidity', 1000));
    before.parameters.push(uintParam('amount0Min', 400));
    before.parameters.push(uintParam('amount1Min', 0));
    handleMigrationPositionBefore(before);

    const secondBefore = changetype<LiquidityManager__MigrationPositionBefore>(newMockEvent());
    configureEvent(secondBefore, CONTRACT, 5);
    secondBefore.parameters = new Array<ethereum.EventParam>();
    secondBefore.parameters.push(bytesParam('planHash', HASH));
    secondBefore.parameters.push(uintParam('positionId', 12));
    secondBefore.parameters.push(intParam('tickLower', 100));
    secondBefore.parameters.push(intParam('tickUpper', 200));
    secondBefore.parameters.push(uintParam('liquidity', 800));
    secondBefore.parameters.push(uintParam('amount0Min', 300));
    secondBefore.parameters.push(uintParam('amount1Min', 0));
    handleMigrationPositionBefore(secondBefore);

    const after = changetype<LiquidityManager__MigrationPositionAfter>(newMockEvent());
    configureEvent(after, CONTRACT, 6);
    after.parameters = new Array<ethereum.EventParam>();
    after.parameters.push(bytesParam('planHash', HASH));
    after.parameters.push(uintParam('positionId', 21));
    after.parameters.push(intParam('tickLower', -200));
    after.parameters.push(intParam('tickUpper', 200));
    after.parameters.push(uintParam('liquidity', 900));
    after.parameters.push(uintParam('amount0Max', 0));
    after.parameters.push(uintParam('amount1Max', 500));
    handleMigrationPositionAfter(after);

    const removedPositionIds = new Array<BigInt>();
    removedPositionIds.push(integer(11));
    removedPositionIds.push(integer(12));
    const replacementPositionIds = new Array<BigInt>();
    replacementPositionIds.push(integer(21));
    const completed = changetype<LiquidityManager__MigrationCompleted>(newMockEvent());
    configureEvent(completed, CONTRACT, 7);
    completed.parameters = new Array<ethereum.EventParam>();
    completed.parameters.push(bytesParam('planHash', HASH));
    completed.parameters.push(bytesParam('destinationPoolKeyHash', destinationHash));
    completed.parameters.push(
      new ethereum.EventParam('removedPositionIds', ethereum.Value.fromUnsignedBigIntArray(removedPositionIds)),
    );
    completed.parameters.push(
      new ethereum.EventParam('replacementPositionIds', ethereum.Value.fromUnsignedBigIntArray(replacementPositionIds)),
    );
    completed.parameters.push(uintParam('gbxResidualBurned', 2));
    completed.parameters.push(uintParam('usdGResidualToVault', 3));
    handleMigrationCompleted(completed);

    const paused = changetype<LiquidityManager__MigrationPauseSet>(newMockEvent());
    configureEvent(paused, CONTRACT, 8);
    paused.parameters = new Array<ethereum.EventParam>();
    paused.parameters.push(boolParam('paused', true));
    handleMigrationPauseSet(paused);

    const poolId = '4663-' + CONTRACT.toHexString();
    const oldPositionId = poolId + '-position-11';
    const secondOldPositionId = poolId + '-position-12';
    const newPositionId = poolId + '-position-21';
    assert.entityCount('LiquidityEvent', 8);
    assert.fieldEquals('LiquidityPool', poolId, 'activePositionCount', '1');
    assert.fieldEquals('LiquidityPool', poolId, 'migrationCount', '1');
    assert.fieldEquals('LiquidityPool', poolId, 'migrationsPaused', 'true');
    assert.fieldEquals('LiquidityPool', poolId, 'lastMigrationPlanHash', HASH.toHexString());
    assert.fieldEquals('LiquidityPool', poolId, 'gbxMigrationResidualBurnedRaw', '2');
    assert.fieldEquals('LiquidityPool', poolId, 'usdgToVaultRaw', '3');
    assert.fieldEquals('LiquidityPool', poolId, 'lastBlockNumber', '108');
    assert.fieldEquals('LiquidityPosition', oldPositionId, 'active', 'false');
    assert.fieldEquals('LiquidityPosition', secondOldPositionId, 'active', 'false');
    assert.fieldEquals('LiquidityPosition', newPositionId, 'active', 'true');
    assert.fieldEquals('LiquidityPosition', newPositionId, 'liquidity', '900');
    assert.fieldEquals('LiquidityPosition', newPositionId, 'gbxPrincipalKnown', 'false');
    assert.fieldEquals('LiquidityPosition', newPositionId, 'lastBlockNumber', '106');
    assert.fieldEquals('LiquidityEvent', eventId(started), 'kind', 'MIGRATION_STARTED');
    assert.fieldEquals('LiquidityEvent', eventId(before), 'kind', 'MIGRATION_POSITION_REMOVED');
    assert.fieldEquals('LiquidityEvent', eventId(secondBefore), 'kind', 'MIGRATION_POSITION_REMOVED');
    assert.fieldEquals('LiquidityEvent', eventId(after), 'kind', 'MIGRATION_POSITION_ADDED');
    assert.fieldEquals('LiquidityEvent', eventId(completed), 'kind', 'MIGRATION_COMPLETED');
    assert.fieldEquals('LiquidityEvent', eventId(completed), 'gbxResidualRaw', '2');
    assert.fieldEquals('LiquidityEvent', eventId(completed), 'usdgAmountRaw', '3');
    assert.fieldEquals('LiquidityEvent', eventId(completed), 'removedPositionIds', '[11, 12]');
    assert.fieldEquals('LiquidityEvent', eventId(completed), 'replacementPositionIds', '[21]');
    assert.fieldEquals('LiquidityEvent', eventId(completed), 'blockNumber', '107');
    assert.fieldEquals('LiquidityEvent', eventId(completed), 'timestamp', '1700000007');
    assert.fieldEquals(
      'LiquidityEvent',
      eventId(completed),
      'transactionHash',
      completed.transaction.hash.toHexString(),
    );
    assert.fieldEquals('LiquidityEvent', eventId(completed), 'logIndex', '7');
    assert.fieldEquals('LiquidityEvent', eventId(paused), 'kind', 'MIGRATION_PAUSE_SET');
    assert.fieldEquals('LiquidityEvent', eventId(paused), 'paused', 'true');
  });
});
