import { DataSourceContext, ethereum } from '@graphprotocol/graph-ts';
import {
  assert,
  beforeEach,
  clearStore,
  dataSourceMock,
  describe,
  newMockEvent,
  test,
} from 'matchstick-as/assembly/index';
import { Burned, Minted } from '../generated/GBX/GBX';
import {
  EmissionSettled,
  GenesisLiquidityMinted,
  Mined,
  MinerPaymentAccrued,
  MinerPaymentClaimed,
  ResonanceRouterUpdated,
  RevenueDeposited,
} from '../generated/Mine/Mine';
import { RewardRouted } from '../generated/templates/BribeRouterTemplate/BribeRouter';
import {
  BribeBpsSet,
  ResonanceRouterSet,
  RevenueDistributed,
  RevenueNotified,
  SignalAdded,
  SignalRemoved,
  StrategyAdded,
  StrategyKilled,
} from '../generated/Resonance/Resonance';
import { handleRouterRewardRouted } from '../src/bribe-router';
import { handleBurned, handleMinted } from '../src/gbx';
import { eventId, signalPositionId } from '../src/ids';
import {
  handleEmissionSettled,
  handleGenesisLiquidityMinted,
  handleMined,
  handleMinerPaymentAccrued,
  handleMinerPaymentClaimed,
  handleMiningRevenueDeposited,
  handleResonanceRouterUpdated,
} from '../src/mine';
import {
  handleBribeBpsSet,
  handleRevenueDistributed,
  handleRevenueNotified,
  handleResonanceRouterSet,
  handleSignalAdded,
  handleSignalRemoved,
  handleStrategyAdded,
  handleStrategyKilled,
} from '../src/resonance';
import { handleSignaled, handleSignalWithdrawn } from '../src/signal-gbx';
import { Signaled, SignalWithdrawn } from '../generated/SignalGBX/SignalGBX';
import {
  ASSET,
  CONTRACT,
  REWARDS,
  STRATEGY,
  USER,
  USER_TWO,
  addressParam,
  configureEvent,
  stringParam,
  uintParam,
} from './helpers';

export {
  handleBribeBpsSet,
  handleBurned,
  handleEmissionSettled,
  handleGenesisLiquidityMinted,
  handleMined,
  handleMinerPaymentAccrued,
  handleMinerPaymentClaimed,
  handleMiningRevenueDeposited,
  handleResonanceRouterUpdated,
  handleMinted,
  handleRevenueDistributed,
  handleRevenueNotified,
  handleResonanceRouterSet,
  handleRouterRewardRouted,
  handleSignaled,
  handleSignalWithdrawn,
  handleStrategyAdded,
  handleStrategyKilled,
  handleSignalAdded,
  handleSignalRemoved,
};

describe('core protocol mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('tracks mining issuance and burning from zero supply', () => {
    const miningMint = changetype<Minted>(newMockEvent());
    configureEvent(miningMint, CONTRACT, 1);
    miningMint.parameters = new Array<ethereum.EventParam>();
    miningMint.parameters.push(addressParam('account', USER_TWO));
    miningMint.parameters.push(uintParam('amount', 50));
    handleMinted(miningMint);

    const burned = changetype<Burned>(newMockEvent());
    configureEvent(burned, CONTRACT, 2);
    burned.parameters = new Array<ethereum.EventParam>();
    burned.parameters.push(addressParam('account', USER_TWO));
    burned.parameters.push(uintParam('amount', 25));
    handleBurned(burned);

    assert.fieldEquals('ProtocolState', '4663', 'lifetimeMintedRaw', '50');
    assert.fieldEquals('ProtocolState', '4663', 'lifetimeBurnedRaw', '25');
    assert.fieldEquals('ProtocolState', '4663', 'totalSupplyRaw', '25');
    assert.fieldEquals('Account', '4663-' + USER_TWO.toHexString(), 'gbxBurnedRaw', '25');
    assert.fieldEquals('ProtocolEvent', eventId(miningMint), 'eventType', 'GBX_MINTED');
    assert.fieldEquals('ProtocolEvent', eventId(burned), 'eventType', 'GBX_BURNED');
  });

  test('tracks the fixed Mine-issued genesis liquidity allocation separately from slot emission', () => {
    const genesis = changetype<GenesisLiquidityMinted>(newMockEvent());
    configureEvent(genesis, CONTRACT, 1);
    genesis.parameters = new Array<ethereum.EventParam>();
    genesis.parameters.push(addressParam('recipient', ASSET));
    genesis.parameters.push(uintParam('amount', 1_000));
    handleGenesisLiquidityMinted(genesis);

    assert.fieldEquals('ProtocolState', '4663', 'genesisLiquidityGBXRaw', '1000');
    assert.fieldEquals('ProtocolState', '4663', 'genesisPair', ASSET.toHexString());
    assert.fieldEquals('ProtocolState', '4663', 'minedGBXRaw', '0');
    assert.fieldEquals('ProtocolEvent', eventId(genesis), 'eventType', 'MINE_GENESIS_LIQUIDITY_MINTED');
  });

  test('tracks Mine slot handoffs and displaced-miner USDG claims', () => {
    const mined = changetype<Mined>(newMockEvent());
    configureEvent(mined, CONTRACT, 1);
    mined.parameters = new Array<ethereum.EventParam>();
    mined.parameters.push(addressParam('payer', USER));
    mined.parameters.push(addressParam('miner', USER_TWO));
    mined.parameters.push(uintParam('slotIndex', 0));
    mined.parameters.push(uintParam('epochId', 7));
    mined.parameters.push(addressParam('previousMiner', USER));
    mined.parameters.push(uintParam('paymentAmount', 50));
    mined.parameters.push(uintParam('nextInitialPrice', 100));
    mined.parameters.push(uintParam('tps', 4));
    mined.parameters.push(stringParam('message', 'hello from the mine'));
    handleMined(mined);

    const accrued = changetype<MinerPaymentAccrued>(newMockEvent());
    configureEvent(accrued, CONTRACT, 2);
    accrued.parameters = new Array<ethereum.EventParam>();
    accrued.parameters.push(addressParam('miner', USER));
    accrued.parameters.push(uintParam('slotIndex', 0));
    accrued.parameters.push(uintParam('epochId', 7));
    accrued.parameters.push(uintParam('amount', 40));
    handleMinerPaymentAccrued(accrued);

    const claim = changetype<MinerPaymentClaimed>(newMockEvent());
    configureEvent(claim, CONTRACT, 3);
    claim.parameters = new Array<ethereum.EventParam>();
    claim.parameters.push(addressParam('account', USER));
    claim.parameters.push(uintParam('amount', 40));
    handleMinerPaymentClaimed(claim);

    const deposited = changetype<RevenueDeposited>(newMockEvent());
    configureEvent(deposited, CONTRACT, 4);
    deposited.parameters = new Array<ethereum.EventParam>();
    deposited.parameters.push(uintParam('slotIndex', 0));
    deposited.parameters.push(uintParam('epochId', 7));
    deposited.parameters.push(addressParam('resonanceRouter', REWARDS));
    deposited.parameters.push(uintParam('amount', 10));
    handleMiningRevenueDeposited(deposited);

    const slotId = '4663-' + CONTRACT.toHexString() + '-slot-0';
    assert.fieldEquals('MiningSlot', slotId, 'epoch', '8');
    assert.fieldEquals('MiningSlot', slotId, 'currentMiner', USER_TWO.toHexString());
    assert.fieldEquals('MiningSlot', slotId, 'currentMessage', 'hello from the mine');
    assert.fieldEquals('MiningSlot', slotId, 'tpsRaw', '4');
    assert.fieldEquals('ProtocolState', '4663', 'miningPaymentsRaw', '50');
    assert.fieldEquals('ProtocolState', '4663', 'miningRevenueDepositedRaw', '10');
    assert.fieldEquals('ProtocolState', '4663', 'mineRevenueRouter', REWARDS.toHexString());
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'miningPaymentAccruedRaw', '40');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'miningUSDGClaimedRaw', '40');
    assert.fieldEquals('ProtocolEvent', eventId(deposited), 'eventType', 'MINE_REVENUE_DEPOSITED');
    assert.fieldEquals('ProtocolEvent', eventId(deposited), 'addresses', `[${REWARDS.toHexString()}]`);
  });

  test('tracks Mine future-revenue Router migration without replacing the indexed Resonance graph', () => {
    const initial = changetype<ResonanceRouterSet>(newMockEvent());
    configureEvent(initial, CONTRACT, 1);
    initial.parameters = new Array<ethereum.EventParam>();
    initial.parameters.push(addressParam('resonanceRouter', USER));
    handleResonanceRouterSet(initial);

    const updated = changetype<ResonanceRouterUpdated>(newMockEvent());
    configureEvent(updated, CONTRACT, 2);
    updated.parameters = new Array<ethereum.EventParam>();
    updated.parameters.push(addressParam('previousRouter', USER));
    updated.parameters.push(addressParam('newRouter', USER_TWO));
    updated.parameters.push(addressParam('newResonance', REWARDS));
    handleResonanceRouterUpdated(updated);

    assert.fieldEquals('ProtocolState', '4663', 'mineRevenueResonance', REWARDS.toHexString());
    assert.fieldEquals('ProtocolState', '4663', 'mineRevenueRouter', USER_TWO.toHexString());
    assert.fieldEquals('ProtocolState', '4663', 'resonance', CONTRACT.toHexString());
    assert.fieldEquals('ProtocolState', '4663', 'resonanceRouter', USER.toHexString());
    assert.fieldEquals('ProtocolEvent', eventId(updated), 'eventType', 'MINE_RESONANCE_ROUTER_UPDATED');
    assert.fieldEquals(
      'ProtocolEvent',
      eventId(updated),
      'addresses',
      `[${USER.toHexString()}, ${USER_TWO.toHexString()}, ${REWARDS.toHexString()}]`,
    );
  });

  test('tracks target-slot mining settlement', () => {
    const settled = changetype<EmissionSettled>(newMockEvent());
    configureEvent(settled, CONTRACT, 1);
    settled.parameters = new Array<ethereum.EventParam>();
    settled.parameters.push(addressParam('miner', USER));
    settled.parameters.push(uintParam('slotIndex', 0));
    settled.parameters.push(uintParam('epochId', 7));
    settled.parameters.push(uintParam('amount', 80));
    handleEmissionSettled(settled);

    const miningSlotId = '4663-' + CONTRACT.toHexString() + '-slot-0';
    assert.fieldEquals('MiningSlot', miningSlotId, 'totalMinedRaw', '80');
    assert.fieldEquals('ProtocolState', '4663', 'minedGBXRaw', '80');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'gbxMinedRaw', '80');
  });

  test('tracks Strategy creation and incremental absolute signal events', () => {
    const added = changetype<StrategyAdded>(newMockEvent());
    configureEvent(added, CONTRACT, 1);
    added.parameters = new Array<ethereum.EventParam>();
    added.parameters.push(addressParam('strategy', STRATEGY));
    added.parameters.push(addressParam('bribe', REWARDS));
    added.parameters.push(addressParam('bribeRouter', USER_TWO));
    added.parameters.push(addressParam('paymentToken', ASSET));
    handleStrategyAdded(added);

    const cast = changetype<SignalAdded>(newMockEvent());
    configureEvent(cast, CONTRACT, 2);
    cast.parameters = new Array<ethereum.EventParam>();
    cast.parameters.push(addressParam('account', USER));
    cast.parameters.push(addressParam('strategy', STRATEGY));
    cast.parameters.push(uintParam('amount', 100));
    handleSignalAdded(cast);

    const killed = changetype<StrategyKilled>(newMockEvent());
    configureEvent(killed, CONTRACT, 3);
    killed.parameters = new Array<ethereum.EventParam>();
    killed.parameters.push(addressParam('strategy', STRATEGY));
    handleStrategyKilled(killed);

    const strategyId = '4663-' + STRATEGY.toHexString();
    const positionId = signalPositionId(USER, STRATEGY);
    assert.fieldEquals('Strategy', strategyId, 'live', 'false');
    assert.fieldEquals('Strategy', strategyId, 'totalSignalWeightRaw', '100');
    assert.fieldEquals('SignalPosition', positionId, 'account', '4663-' + USER.toHexString());
    assert.fieldEquals('SignalPosition', positionId, 'strategy', strategyId);
    assert.fieldEquals('SignalPosition', positionId, 'accountAddress', USER.toHexString());
    assert.fieldEquals('SignalPosition', positionId, 'strategyAddress', STRATEGY.toHexString());
    assert.fieldEquals('SignalPosition', positionId, 'amountRaw', '100');

    const removed = changetype<SignalRemoved>(newMockEvent());
    configureEvent(removed, CONTRACT, 4);
    removed.parameters = new Array<ethereum.EventParam>();
    removed.parameters.push(addressParam('account', USER));
    removed.parameters.push(addressParam('strategy', STRATEGY));
    removed.parameters.push(uintParam('amount', 40));
    handleSignalRemoved(removed);

    assert.fieldEquals('SignalPosition', positionId, 'amountRaw', '60');
    assert.fieldEquals('SignalPosition', positionId, 'lastBlockNumber', '104');

    const finalRemoval = changetype<SignalRemoved>(newMockEvent());
    configureEvent(finalRemoval, CONTRACT, 5);
    finalRemoval.parameters = new Array<ethereum.EventParam>();
    finalRemoval.parameters.push(addressParam('account', USER));
    finalRemoval.parameters.push(addressParam('strategy', STRATEGY));
    finalRemoval.parameters.push(uintParam('amount', 60));
    handleSignalRemoved(finalRemoval);

    assert.fieldEquals('ProtocolState', '4663', 'strategyCount', '1');
    assert.fieldEquals('ProtocolState', '4663', 'liveStrategyCount', '0');
    assert.fieldEquals('Strategy', strategyId, 'paymentToken', ASSET.toHexString());
    assert.fieldEquals('Strategy', strategyId, 'totalSignalWeightRaw', '0');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'signalWeightRaw', '0');
    assert.notInStore('SignalPosition', positionId);
  });

  test('tracks atomic SignalGBX deposits and strategy-scoped removals', () => {
    const signaled = changetype<Signaled>(newMockEvent());
    configureEvent(signaled, CONTRACT, 1);
    signaled.parameters = new Array<ethereum.EventParam>();
    signaled.parameters.push(addressParam('account', USER));
    signaled.parameters.push(addressParam('strategy', STRATEGY));
    signaled.parameters.push(uintParam('amount', 100));
    handleSignaled(signaled);

    const withdrawn = changetype<SignalWithdrawn>(newMockEvent());
    configureEvent(withdrawn, CONTRACT, 2);
    withdrawn.parameters = new Array<ethereum.EventParam>();
    withdrawn.parameters.push(addressParam('account', USER));
    withdrawn.parameters.push(addressParam('strategy', STRATEGY));
    withdrawn.parameters.push(uintParam('amount', 40));
    handleSignalWithdrawn(withdrawn);

    assert.fieldEquals('ProtocolState', '4663', 'signaledGBXRaw', '60');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'signaledGBXRaw', '60');
    assert.fieldEquals('ProtocolEvent', eventId(signaled), 'eventType', 'SIGNAL_GBX_SIGNALED');
    assert.fieldEquals('ProtocolEvent', eventId(withdrawn), 'eventType', 'SIGNAL_GBX_WITHDRAWN');
    assert.fieldEquals(
      'ProtocolEvent',
      eventId(withdrawn),
      'addresses',
      `[${USER.toHexString()}, ${STRATEGY.toHexString()}]`,
    );
  });

  test('tracks permissionless routing from the minimal BribeRouter buffer', () => {
    const added = changetype<StrategyAdded>(newMockEvent());
    configureEvent(added, CONTRACT, 1);
    added.parameters = new Array<ethereum.EventParam>();
    added.parameters.push(addressParam('strategy', STRATEGY));
    added.parameters.push(addressParam('bribe', REWARDS));
    added.parameters.push(addressParam('bribeRouter', USER_TWO));
    added.parameters.push(addressParam('paymentToken', ASSET));
    handleStrategyAdded(added);

    const context = new DataSourceContext();
    context.setString('strategyId', '4663-' + STRATEGY.toHexString());
    dataSourceMock.setReturnValues(USER_TWO.toHexString(), 'robinhood', context);

    const routed = changetype<RewardRouted>(newMockEvent());
    configureEvent(routed, USER_TWO, 2);
    routed.parameters = new Array<ethereum.EventParam>();
    routed.parameters.push(addressParam('bribe', REWARDS));
    routed.parameters.push(addressParam('rewardToken', ASSET));
    routed.parameters.push(uintParam('amount', 1));
    handleRouterRewardRouted(routed);

    const strategyId = '4663-' + STRATEGY.toHexString();
    assert.fieldEquals('Strategy', strategyId, 'routerRewardsRoutedRaw', '1');
    assert.fieldEquals('ProtocolEvent', eventId(routed), 'eventType', 'BRIBE_ROUTER_REWARD_ROUTED');
    assert.fieldEquals('ProtocolEvent', eventId(routed), 'values', '[1]');
  });

  test('tracks the default and owner-selected prospective Bribe rate', () => {
    const added = changetype<StrategyAdded>(newMockEvent());
    configureEvent(added, CONTRACT, 1);
    added.parameters = new Array<ethereum.EventParam>();
    added.parameters.push(addressParam('strategy', STRATEGY));
    added.parameters.push(addressParam('bribe', REWARDS));
    added.parameters.push(addressParam('bribeRouter', USER_TWO));
    added.parameters.push(addressParam('paymentToken', ASSET));
    handleStrategyAdded(added);

    assert.fieldEquals('ProtocolState', '4663', 'bribeBps', '1000');

    const disabled = changetype<BribeBpsSet>(newMockEvent());
    configureEvent(disabled, CONTRACT, 2);
    disabled.parameters = new Array<ethereum.EventParam>();
    disabled.parameters.push(uintParam('previousBribeBps', 1_000));
    disabled.parameters.push(uintParam('newBribeBps', 0));
    handleBribeBpsSet(disabled);

    const restored = changetype<BribeBpsSet>(newMockEvent());
    configureEvent(restored, CONTRACT, 3);
    restored.parameters = new Array<ethereum.EventParam>();
    restored.parameters.push(uintParam('previousBribeBps', 0));
    restored.parameters.push(uintParam('newBribeBps', 500));
    handleBribeBpsSet(restored);

    assert.fieldEquals('ProtocolState', '4663', 'bribeBps', '500');
    assert.fieldEquals('ProtocolEvent', eventId(disabled), 'eventType', 'RESONANCE_BRIBE_BPS_SET');
    assert.fieldEquals('ProtocolEvent', eventId(disabled), 'values', '[1000, 0]');
    assert.fieldEquals('ProtocolEvent', eventId(restored), 'values', '[0, 500]');
  });

  test('tracks observable Resonance resets and distributions without inferring schedule state', () => {
    const added = changetype<StrategyAdded>(newMockEvent());
    configureEvent(added, CONTRACT, 1);
    added.parameters = new Array<ethereum.EventParam>();
    added.parameters.push(addressParam('strategy', STRATEGY));
    added.parameters.push(addressParam('bribe', REWARDS));
    added.parameters.push(addressParam('bribeRouter', USER_TWO));
    added.parameters.push(addressParam('paymentToken', ASSET));
    handleStrategyAdded(added);

    const firstReset = changetype<RevenueNotified>(newMockEvent());
    configureEvent(firstReset, CONTRACT, 2);
    firstReset.parameters = new Array<ethereum.EventParam>();
    firstReset.parameters.push(addressParam('resonanceRouter', USER));
    firstReset.parameters.push(uintParam('amount', 100));
    handleRevenueNotified(firstReset);

    const secondReset = changetype<RevenueNotified>(newMockEvent());
    configureEvent(secondReset, CONTRACT, 3);
    secondReset.parameters = new Array<ethereum.EventParam>();
    secondReset.parameters.push(addressParam('resonanceRouter', USER));
    secondReset.parameters.push(uintParam('amount', 75));
    handleRevenueNotified(secondReset);

    const distributed = changetype<RevenueDistributed>(newMockEvent());
    configureEvent(distributed, CONTRACT, 4);
    distributed.parameters = new Array<ethereum.EventParam>();
    distributed.parameters.push(addressParam('caller', USER_TWO));
    distributed.parameters.push(addressParam('strategy', STRATEGY));
    distributed.parameters.push(uintParam('amount', 40));
    handleRevenueDistributed(distributed);

    const strategyId = '4663-' + STRATEGY.toHexString();
    assert.fieldEquals('ProtocolState', '4663', 'notifiedRevenueRaw', '175');
    assert.fieldEquals('ProtocolState', '4663', 'revenueNotificationCount', '2');
    assert.fieldEquals('ProtocolState', '4663', 'latestRevenueNotificationRaw', '75');
    assert.fieldEquals('ProtocolState', '4663', 'latestRevenueNotificationAt', '1700000003');
    assert.fieldEquals('ProtocolState', '4663', 'distributedRevenueRaw', '40');
    assert.fieldEquals('Strategy', strategyId, 'distributedRevenueRaw', '40');
    assert.fieldEquals('ProtocolEvent', eventId(secondReset), 'eventType', 'RESONANCE_REVENUE_NOTIFIED');
    assert.fieldEquals('ProtocolEvent', eventId(secondReset), 'values', '[75]');
    assert.fieldEquals('ProtocolEvent', eventId(distributed), 'eventType', 'RESONANCE_REVENUE_DISTRIBUTED');
  });
});
