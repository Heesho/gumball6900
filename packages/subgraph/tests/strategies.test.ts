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
import {
  BuybackBurnStrategy__AuctionStarted,
  BuybackBurnStrategy__GBXBoughtAndBurned,
} from '../generated/BuybackBurnStrategy/BuybackBurnStrategy';
import { RevenueRouter__RevenueRouted } from '../generated/RevenueRouter/RevenueRouter';
import {
  AcquisitionStrategy__AuctionStarted,
  AcquisitionStrategy__Filled,
} from '../generated/templates/AcquisitionStrategy/AcquisitionStrategy';
import {
  ManagerRewards__Claimed,
  ManagerRewards__Notified,
  ManagerRewards__RedirectedToVault,
  ManagerRewards__TerminalDustQueued,
  ManagerRewards__TerminalDustSettled,
} from '../generated/templates/ManagerRewards/ManagerRewards';
import { handleAcquisitionAuctionStarted, handleAcquisitionFilled } from '../src/acquisition-strategy';
import { handleBuybackAuctionStarted, handleGBXBoughtAndBurned } from '../src/buyback-burn-strategy';
import {
  handleManagerRewardClaimed,
  handleManagerRewardNotified,
  handleManagerRewardRedirectedToVault,
  handleManagerRewardTerminalDustQueued,
  handleManagerRewardTerminalDustSettled,
} from '../src/manager-rewards';
import { handleRevenueRouted } from '../src/revenue-router';
import { getStrategy, getVaultAsset } from '../src/entities';
import {
  ASSET,
  CONTRACT,
  HASH,
  REWARDS,
  STRATEGY,
  USER,
  USER_TWO,
  addressParam,
  bytesParam,
  configureEvent,
  uintParam,
} from './helpers';

export {
  handleAcquisitionAuctionStarted,
  handleAcquisitionFilled,
  handleBuybackAuctionStarted,
  handleGBXBoughtAndBurned,
  handleManagerRewardClaimed,
  handleManagerRewardNotified,
  handleManagerRewardRedirectedToVault,
  handleManagerRewardTerminalDustQueued,
  handleManagerRewardTerminalDustSettled,
  handleRevenueRouted,
};

describe('strategy, reward, and revenue mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('indexes every strategy, manager reward, and router handler', () => {
    const routed = changetype<RevenueRouter__RevenueRouted>(newMockEvent());
    configureEvent(routed, CONTRACT, 1);
    routed.parameters = new Array<ethereum.EventParam>();
    routed.parameters.push(addressParam('payer', USER));
    routed.parameters.push(bytesParam('sourceId', HASH));
    routed.parameters.push(uintParam('requestedAmount', 31));
    routed.parameters.push(uintParam('vaultReceived', 30));
    handleRevenueRouted(routed);

    const acquisitionAuction = changetype<AcquisitionStrategy__AuctionStarted>(newMockEvent());
    configureEvent(acquisitionAuction, STRATEGY, 2);
    acquisitionAuction.parameters = new Array<ethereum.EventParam>();
    acquisitionAuction.parameters.push(uintParam('auctionId', 1));
    acquisitionAuction.parameters.push(uintParam('referenceRate', 100));
    acquisitionAuction.parameters.push(uintParam('startRate', 125));
    acquisitionAuction.parameters.push(uintParam('floorRate', 80));
    acquisitionAuction.parameters.push(uintParam('startTime', 50));
    handleAcquisitionAuctionStarted(acquisitionAuction);

    const acquisitionFill = changetype<AcquisitionStrategy__Filled>(newMockEvent());
    configureEvent(acquisitionFill, STRATEGY, 3);
    acquisitionFill.parameters = new Array<ethereum.EventParam>();
    acquisitionFill.parameters.push(uintParam('auctionId', 1));
    acquisitionFill.parameters.push(addressParam('taker', USER));
    acquisitionFill.parameters.push(addressParam('usdGReceiver', USER_TWO));
    acquisitionFill.parameters.push(uintParam('usdGAmount', 100));
    acquisitionFill.parameters.push(uintParam('targetReceived', 50));
    acquisitionFill.parameters.push(uintParam('vaultAmount', 49));
    acquisitionFill.parameters.push(uintParam('managerAmount', 1));
    acquisitionFill.parameters.push(uintParam('clearingRate', 2));
    handleAcquisitionFilled(acquisitionFill);

    const context = new DataSourceContext();
    context.setString('strategyId', '4663-' + STRATEGY.toHexString());
    context.setString('assetId', '4663-' + ASSET.toHexString());
    dataSourceMock.setContext(context);

    const rewardAsset = getVaultAsset(ASSET, acquisitionFill);
    rewardAsset.save();

    const rewardNotification = changetype<ManagerRewards__Notified>(newMockEvent());
    configureEvent(rewardNotification, REWARDS, 4);
    rewardNotification.parameters = new Array<ethereum.EventParam>();
    rewardNotification.parameters.push(uintParam('amount', 10));
    rewardNotification.parameters.push(uintParam('strategyWeight', 20));
    rewardNotification.parameters.push(uintParam('rewardPerWeightDelta', 5));
    rewardNotification.parameters.push(uintParam('remainder', 0));
    handleManagerRewardNotified(rewardNotification);

    const rewardRedirect = changetype<ManagerRewards__RedirectedToVault>(newMockEvent());
    configureEvent(rewardRedirect, REWARDS, 5);
    rewardRedirect.parameters = new Array<ethereum.EventParam>();
    rewardRedirect.parameters.push(uintParam('amount', 1));
    handleManagerRewardRedirectedToVault(rewardRedirect);

    const terminalDustQueued = changetype<ManagerRewards__TerminalDustQueued>(newMockEvent());
    configureEvent(terminalDustQueued, REWARDS, 6);
    terminalDustQueued.parameters = new Array<ethereum.EventParam>();
    terminalDustQueued.parameters.push(uintParam('generation', 0));
    terminalDustQueued.parameters.push(uintParam('remainderCycle', 0));
    terminalDustQueued.parameters.push(uintParam('amount', 2));
    terminalDustQueued.parameters.push(uintParam('generationPendingAfter', 2));
    terminalDustQueued.parameters.push(uintParam('totalPendingAfter', 2));
    handleManagerRewardTerminalDustQueued(terminalDustQueued);

    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'pendingManagerRewardDustRaw', '2');
    assert.fieldEquals('VaultAsset', '4663-' + ASSET.toHexString(), 'trackedBalanceRaw', '1');
    assert.entityCount('VaultSnapshot', 1);

    const terminalDust = changetype<ManagerRewards__TerminalDustSettled>(newMockEvent());
    configureEvent(terminalDust, REWARDS, 7);
    terminalDust.parameters = new Array<ethereum.EventParam>();
    terminalDust.parameters.push(uintParam('generation', 0));
    terminalDust.parameters.push(uintParam('remainderCycle', 0));
    terminalDust.parameters.push(uintParam('amount', 2));
    terminalDust.parameters.push(uintParam('accountedRewardsAfter', 8));
    handleManagerRewardTerminalDustSettled(terminalDust);

    const rewardClaim = changetype<ManagerRewards__Claimed>(newMockEvent());
    configureEvent(rewardClaim, REWARDS, 8);
    rewardClaim.parameters = new Array<ethereum.EventParam>();
    rewardClaim.parameters.push(addressParam('user', USER));
    rewardClaim.parameters.push(addressParam('receiver', USER_TWO));
    rewardClaim.parameters.push(uintParam('amount', 10));
    handleManagerRewardClaimed(rewardClaim);

    const buybackAuction = changetype<BuybackBurnStrategy__AuctionStarted>(newMockEvent());
    configureEvent(buybackAuction, CONTRACT, 9);
    buybackAuction.parameters = new Array<ethereum.EventParam>();
    buybackAuction.parameters.push(uintParam('auctionId', 2));
    buybackAuction.parameters.push(uintParam('referenceRate', 100));
    buybackAuction.parameters.push(uintParam('startRate', 125));
    buybackAuction.parameters.push(uintParam('floorRate', 80));
    buybackAuction.parameters.push(uintParam('startTime', 60));
    handleBuybackAuctionStarted(buybackAuction);

    const buyback = changetype<BuybackBurnStrategy__GBXBoughtAndBurned>(newMockEvent());
    configureEvent(buyback, CONTRACT, 10);
    buyback.parameters = new Array<ethereum.EventParam>();
    buyback.parameters.push(uintParam('auctionId', 2));
    buyback.parameters.push(addressParam('taker', USER));
    buyback.parameters.push(addressParam('usdGReceiver', USER_TWO));
    buyback.parameters.push(uintParam('usdGSpent', 40));
    buyback.parameters.push(uintParam('gbxBurned', 20));
    buyback.parameters.push(uintParam('clearingRate', 2));
    buyback.parameters.push(uintParam('totalSupplyAfter', 980));
    handleGBXBoughtAndBurned(buyback);

    assert.entityCount('RevenueNotification', 1);
    assert.entityCount('StrategyFill', 1);
    assert.entityCount('ManagerRewardNotification', 3);
    assert.entityCount('ManagerRewardClaim', 1);
    assert.entityCount('ManagerRewardTerminalDust', 1);
    assert.entityCount('VaultSnapshot', 2);
    assert.entityCount('Buyback', 1);
    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'totalVaultReceivedRaw', '49');
    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'pendingManagerRewardDustRaw', '0');
    assert.fieldEquals('ManagerRewardTerminalDust', '4663-' + REWARDS.toHexString() + '-0-0', 'settled', 'true');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'managerRewardClaimCount', '1');
    assert.fieldEquals('Protocol', '4663', 'buybackBurnedGBXRaw', '20');
    assert.fieldEquals('VaultAsset', '4663-' + ASSET.toHexString(), 'trackedBalanceRaw', '3');
    assert.fieldEquals('VaultAsset', '4663-' + ASSET.toHexString(), 'acquiredByStrategiesRaw', '3');
  });

  test('marks a zero-amount terminal cycle settled because no sweep exists', () => {
    const setupEvent = newMockEvent();
    configureEvent(setupEvent, STRATEGY, 1);
    const strategy = getStrategy(STRATEGY, setupEvent);
    strategy.save();

    const context = new DataSourceContext();
    context.setString('strategyId', strategy.id);
    context.setString('assetId', '4663-' + ASSET.toHexString());
    dataSourceMock.setContext(context);

    const terminalDustQueued = changetype<ManagerRewards__TerminalDustQueued>(newMockEvent());
    configureEvent(terminalDustQueued, REWARDS, 2);
    terminalDustQueued.parameters = new Array<ethereum.EventParam>();
    terminalDustQueued.parameters.push(uintParam('generation', 0));
    terminalDustQueued.parameters.push(uintParam('remainderCycle', 0));
    terminalDustQueued.parameters.push(uintParam('amount', 0));
    terminalDustQueued.parameters.push(uintParam('generationPendingAfter', 0));
    terminalDustQueued.parameters.push(uintParam('totalPendingAfter', 0));
    handleManagerRewardTerminalDustQueued(terminalDustQueued);

    assert.fieldEquals('Strategy', strategy.id, 'pendingManagerRewardDustRaw', '0');
    assert.fieldEquals('ManagerRewardTerminalDust', '4663-' + REWARDS.toHexString() + '-0-0', 'amountRaw', '0');
    assert.fieldEquals('ManagerRewardTerminalDust', '4663-' + REWARDS.toHexString() + '-0-0', 'settled', 'true');
  });

  test('reconstructs one complete target receipt when the zero-weight redirect precedes the fill log', () => {
    const setupEvent = newMockEvent();
    configureEvent(setupEvent, STRATEGY, 1);
    const asset = getVaultAsset(ASSET, setupEvent);
    asset.save();
    const strategy = getStrategy(STRATEGY, setupEvent);
    strategy.asset = asset.id;
    strategy.save();

    const context = new DataSourceContext();
    context.setString('strategyId', strategy.id);
    context.setString('assetId', asset.id);
    dataSourceMock.setContext(context);

    const rewardRedirect = changetype<ManagerRewards__RedirectedToVault>(newMockEvent());
    configureEvent(rewardRedirect, REWARDS, 2);
    rewardRedirect.parameters = new Array<ethereum.EventParam>();
    rewardRedirect.parameters.push(uintParam('amount', 1));
    handleManagerRewardRedirectedToVault(rewardRedirect);

    const acquisitionFill = changetype<AcquisitionStrategy__Filled>(newMockEvent());
    configureEvent(acquisitionFill, STRATEGY, 3);
    acquisitionFill.parameters = new Array<ethereum.EventParam>();
    acquisitionFill.parameters.push(uintParam('auctionId', 1));
    acquisitionFill.parameters.push(addressParam('taker', USER));
    acquisitionFill.parameters.push(addressParam('usdGReceiver', USER_TWO));
    acquisitionFill.parameters.push(uintParam('usdGAmount', 100));
    acquisitionFill.parameters.push(uintParam('targetReceived', 50));
    acquisitionFill.parameters.push(uintParam('vaultAmount', 49));
    acquisitionFill.parameters.push(uintParam('managerAmount', 1));
    acquisitionFill.parameters.push(uintParam('clearingRate', 2));
    handleAcquisitionFilled(acquisitionFill);

    assert.entityCount('ManagerRewardNotification', 1);
    assert.entityCount('VaultSnapshot', 2);
    assert.fieldEquals('VaultAsset', asset.id, 'trackedBalanceRaw', '50');
    assert.fieldEquals('VaultAsset', asset.id, 'acquiredByStrategiesRaw', '50');
    assert.fieldEquals('Strategy', strategy.id, 'totalVaultReceivedRaw', '49');
    assert.fieldEquals('Strategy', strategy.id, 'totalManagerReceivedRaw', '1');
  });
});
