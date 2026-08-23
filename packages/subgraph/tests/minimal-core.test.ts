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
import { FeesHarvested } from '../generated/LiquidityPosition/LiquidityPosition';
import { Claimed, EmissionSettled, Mined, MinerPaymentAccrued, RevenueDeposited } from '../generated/Mine/Mine';
import { RewardsDistributed } from '../generated/templates/BribeRouterTemplate/BribeRouter';
import {
  BribeBpsSet,
  RevenueDistributed,
  RevenueNotified,
  SignalAdded,
  SignalRemoved,
  StrategyAdded,
  StrategyKilled,
} from '../generated/Resonance/Resonance';
import { handleRouterRewardsDistributed } from '../src/bribe-router';
import { handleBurned, handleMinted } from '../src/gbx';
import { eventId } from '../src/ids';
import { handleFeesHarvested } from '../src/liquidity-position';
import {
  handleClaimed,
  handleEmissionSettled,
  handleMined,
  handleMinerPaymentAccrued,
  handleMiningRevenueDeposited,
} from '../src/mine';
import {
  handleBribeBpsSet,
  handleRevenueDistributed,
  handleRevenueNotified,
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
  handleClaimed,
  handleEmissionSettled,
  handleFeesHarvested,
  handleMined,
  handleMinerPaymentAccrued,
  handleMiningRevenueDeposited,
  handleMinted,
  handleRevenueDistributed,
  handleRevenueNotified,
  handleRouterRewardsDistributed,
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

  test('tracks genesis, mining issuance, and burning', () => {
    const allocation = changetype<Minted>(newMockEvent());
    configureEvent(allocation, CONTRACT, 1);
    allocation.parameters = new Array<ethereum.EventParam>();
    allocation.parameters.push(addressParam('account', USER));
    allocation.parameters.push(uintParam('amount', 100));
    handleMinted(allocation);

    const miningMint = changetype<Minted>(newMockEvent());
    configureEvent(miningMint, CONTRACT, 2);
    miningMint.parameters = new Array<ethereum.EventParam>();
    miningMint.parameters.push(addressParam('account', USER_TWO));
    miningMint.parameters.push(uintParam('amount', 50));
    handleMinted(miningMint);

    const burned = changetype<Burned>(newMockEvent());
    configureEvent(burned, CONTRACT, 3);
    burned.parameters = new Array<ethereum.EventParam>();
    burned.parameters.push(addressParam('account', USER));
    burned.parameters.push(uintParam('amount', 25));
    handleBurned(burned);

    assert.fieldEquals('ProtocolState', '4663', 'initialSupplyRaw', '100');
    assert.fieldEquals('ProtocolState', '4663', 'lifetimeMintedRaw', '150');
    assert.fieldEquals('ProtocolState', '4663', 'lifetimeBurnedRaw', '25');
    assert.fieldEquals('ProtocolState', '4663', 'totalSupplyRaw', '125');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'gbxInitialAllocationRaw', '100');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'gbxBurnedRaw', '25');
    assert.fieldEquals('ProtocolEvent', eventId(burned), 'eventType', 'GBX_BURNED');
  });

  test('tracks Mine slot handoffs and displaced-miner USDG claims', () => {
    const mined = changetype<Mined>(newMockEvent());
    configureEvent(mined, CONTRACT, 1);
    mined.parameters = new Array<ethereum.EventParam>();
    mined.parameters.push(addressParam('payer', USER));
    mined.parameters.push(addressParam('miner', USER_TWO));
    mined.parameters.push(uintParam('index', 0));
    mined.parameters.push(uintParam('epochId', 7));
    mined.parameters.push(addressParam('previousMiner', USER));
    mined.parameters.push(uintParam('price', 50));
    mined.parameters.push(uintParam('initialPrice', 100));
    mined.parameters.push(uintParam('tps', 4));
    mined.parameters.push(stringParam('message', 'hello from the mine'));
    handleMined(mined);

    const accrued = changetype<MinerPaymentAccrued>(newMockEvent());
    configureEvent(accrued, CONTRACT, 2);
    accrued.parameters = new Array<ethereum.EventParam>();
    accrued.parameters.push(addressParam('miner', USER));
    accrued.parameters.push(uintParam('index', 0));
    accrued.parameters.push(uintParam('epochId', 7));
    accrued.parameters.push(uintParam('amount', 40));
    handleMinerPaymentAccrued(accrued);

    const claim = changetype<Claimed>(newMockEvent());
    configureEvent(claim, CONTRACT, 3);
    claim.parameters = new Array<ethereum.EventParam>();
    claim.parameters.push(addressParam('account', USER));
    claim.parameters.push(uintParam('amount', 40));
    handleClaimed(claim);

    const deposited = changetype<RevenueDeposited>(newMockEvent());
    configureEvent(deposited, CONTRACT, 4);
    deposited.parameters = new Array<ethereum.EventParam>();
    deposited.parameters.push(uintParam('index', 0));
    deposited.parameters.push(uintParam('epochId', 7));
    deposited.parameters.push(uintParam('amount', 10));
    handleMiningRevenueDeposited(deposited);

    const slotId = '4663-' + CONTRACT.toHexString() + '-slot-0';
    assert.fieldEquals('MiningSlot', slotId, 'epoch', '8');
    assert.fieldEquals('MiningSlot', slotId, 'currentMiner', USER_TWO.toHexString());
    assert.fieldEquals('MiningSlot', slotId, 'currentMessage', 'hello from the mine');
    assert.fieldEquals('MiningSlot', slotId, 'tpsRaw', '4');
    assert.fieldEquals('ProtocolState', '4663', 'miningPaymentsRaw', '50');
    assert.fieldEquals('ProtocolState', '4663', 'miningRevenueDepositedRaw', '10');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'miningPaymentAccruedRaw', '40');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'miningUSDGClaimedRaw', '40');
    assert.fieldEquals('ProtocolEvent', eventId(deposited), 'eventType', 'MINE_REVENUE_DEPOSITED');
  });

  test('tracks target-slot mining settlement and fixed-principal fee harvesting', () => {
    const settled = changetype<EmissionSettled>(newMockEvent());
    configureEvent(settled, CONTRACT, 1);
    settled.parameters = new Array<ethereum.EventParam>();
    settled.parameters.push(addressParam('miner', USER));
    settled.parameters.push(uintParam('index', 0));
    settled.parameters.push(uintParam('epochId', 7));
    settled.parameters.push(uintParam('amount', 80));
    handleEmissionSettled(settled);

    const harvested = changetype<FeesHarvested>(newMockEvent());
    configureEvent(harvested, CONTRACT, 2);
    harvested.parameters = new Array<ethereum.EventParam>();
    harvested.parameters.push(uintParam('positionTokenId', 11));
    harvested.parameters.push(addressParam('caller', USER));
    harvested.parameters.push(uintParam('principalLiquidity', 5000));
    harvested.parameters.push(uintParam('usdgRouted', 20));
    harvested.parameters.push(uintParam('gbxBurned', 30));
    handleFeesHarvested(harvested);

    const miningSlotId = '4663-' + CONTRACT.toHexString() + '-slot-0';
    assert.fieldEquals('MiningSlot', miningSlotId, 'totalMinedRaw', '80');
    assert.fieldEquals('ProtocolState', '4663', 'minedGBXRaw', '80');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'gbxMinedRaw', '80');
    assert.fieldEquals('ProtocolState', '4663', 'liquidityPrincipalRaw', '5000');
    assert.fieldEquals('ProtocolState', '4663', 'liquidityFeeHarvestCount', '1');
    assert.fieldEquals('ProtocolState', '4663', 'liquidityUSDGRoutedRaw', '20');
    assert.fieldEquals('ProtocolState', '4663', 'liquidityGBXBurnedRaw', '30');
    assert.fieldEquals('ProtocolEvent', eventId(harvested), 'eventType', 'LIQUIDITY_FEES_HARVESTED');
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
    assert.fieldEquals('Strategy', strategyId, 'live', 'false');
    assert.fieldEquals('Strategy', strategyId, 'totalSignalWeightRaw', '100');

    const removed = changetype<SignalRemoved>(newMockEvent());
    configureEvent(removed, CONTRACT, 4);
    removed.parameters = new Array<ethereum.EventParam>();
    removed.parameters.push(addressParam('account', USER));
    removed.parameters.push(addressParam('strategy', STRATEGY));
    removed.parameters.push(uintParam('amount', 100));
    handleSignalRemoved(removed);

    assert.fieldEquals('ProtocolState', '4663', 'strategyCount', '1');
    assert.fieldEquals('ProtocolState', '4663', 'liveStrategyCount', '0');
    assert.fieldEquals('Strategy', strategyId, 'paymentToken', ASSET.toHexString());
    assert.fieldEquals('Strategy', strategyId, 'totalSignalWeightRaw', '0');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'signalWeightRaw', '0');
  });

  test('tracks atomic SignalGBX deposits and strategy-scoped withdrawals', () => {
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

  test('tracks permissionless distribution from the minimal BribeRouter buffer', () => {
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

    const distributed = changetype<RewardsDistributed>(newMockEvent());
    configureEvent(distributed, USER_TWO, 2);
    distributed.parameters = new Array<ethereum.EventParam>();
    distributed.parameters.push(addressParam('bribe', REWARDS));
    distributed.parameters.push(addressParam('rewardToken', ASSET));
    distributed.parameters.push(uintParam('amount', 1));
    handleRouterRewardsDistributed(distributed);

    const strategyId = '4663-' + STRATEGY.toHexString();
    assert.fieldEquals('Strategy', strategyId, 'routerRewardsDistributedRaw', '1');
    assert.fieldEquals('ProtocolEvent', eventId(distributed), 'eventType', 'BRIBE_ROUTER_REWARDS_DISTRIBUTED');
    assert.fieldEquals('ProtocolEvent', eventId(distributed), 'values', '[1]');
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
    disabled.parameters.push(uintParam('previousBps', 1_000));
    disabled.parameters.push(uintParam('newBps', 0));
    handleBribeBpsSet(disabled);

    const restored = changetype<BribeBpsSet>(newMockEvent());
    configureEvent(restored, CONTRACT, 3);
    restored.parameters = new Array<ethereum.EventParam>();
    restored.parameters.push(uintParam('previousBps', 0));
    restored.parameters.push(uintParam('newBps', 500));
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
