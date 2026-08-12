import { ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
import { Burned, Minted } from '../generated/GBX/GBX';
import { FeesHarvested } from '../generated/LiquidityPosition/LiquidityPosition';
import { Claimed, EmissionCheckpointed, Mined, MinerPaymentAccrued } from '../generated/Mine/Mine';
import {
  FundRevenueAccrued,
  FundRevenuePaid,
  RevenueSynced,
  SignalAdded,
  SignalRemoved,
  StrategyAdded,
} from '../generated/Resonance/Resonance';
import { handleBurned, handleMinted } from '../src/gbx';
import { eventId } from '../src/ids';
import { handleFeesHarvested } from '../src/liquidity-position';
import { handleClaimed, handleEmissionCheckpointed, handleMined, handleMinerPaymentAccrued } from '../src/mine';
import {
  handleFundRevenueAccrued,
  handleFundRevenuePaid,
  handleRevenueSynced,
  handleSignalAdded,
  handleSignalRemoved,
  handleStrategyAdded,
} from '../src/resonance';
import { ASSET, CONTRACT, REWARDS, STRATEGY, USER, USER_TWO, addressParam, configureEvent, uintParam } from './helpers';

export {
  handleBurned,
  handleClaimed,
  handleEmissionCheckpointed,
  handleFeesHarvested,
  handleMined,
  handleMinerPaymentAccrued,
  handleMinted,
  handleStrategyAdded,
  handleRevenueSynced,
  handleFundRevenueAccrued,
  handleFundRevenuePaid,
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
    mined.parameters.push(uintParam('ups', 4));
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

    const slotId = '4663-' + CONTRACT.toHexString() + '-slot-0';
    assert.fieldEquals('MiningSlot', slotId, 'epoch', '8');
    assert.fieldEquals('MiningSlot', slotId, 'currentMiner', USER_TWO.toHexString());
    assert.fieldEquals('MiningSlot', slotId, 'upsRaw', '4');
    assert.fieldEquals('ProtocolState', '4663', 'miningPaymentsRaw', '50');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'miningPaymentAccruedRaw', '40');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'miningUSDGClaimedRaw', '40');
  });

  test('tracks mining checkpoints and fixed-principal fee harvesting', () => {
    const checkpoint = changetype<EmissionCheckpointed>(newMockEvent());
    configureEvent(checkpoint, CONTRACT, 1);
    checkpoint.parameters = new Array<ethereum.EventParam>();
    checkpoint.parameters.push(addressParam('miner', USER));
    checkpoint.parameters.push(uintParam('index', 0));
    checkpoint.parameters.push(uintParam('epochId', 7));
    checkpoint.parameters.push(uintParam('amount', 80));
    handleEmissionCheckpointed(checkpoint);

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

    const removed = changetype<SignalRemoved>(newMockEvent());
    configureEvent(removed, CONTRACT, 3);
    removed.parameters = new Array<ethereum.EventParam>();
    removed.parameters.push(addressParam('account', USER));
    removed.parameters.push(addressParam('strategy', STRATEGY));
    removed.parameters.push(uintParam('amount', 100));
    handleSignalRemoved(removed);

    const strategyId = '4663-' + STRATEGY.toHexString();
    assert.fieldEquals('ProtocolState', '4663', 'strategyCount', '1');
    assert.fieldEquals('Strategy', strategyId, 'paymentToken', ASSET.toHexString());
    assert.fieldEquals('Strategy', strategyId, 'totalSignalWeightRaw', '0');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'signalWeightRaw', '0');
  });

  test('tracks synchronized revenue and the retryable fixed Fund liability', () => {
    const synced = changetype<RevenueSynced>(newMockEvent());
    configureEvent(synced, CONTRACT, 1);
    synced.parameters = new Array<ethereum.EventParam>();
    synced.parameters.push(addressParam('caller', USER));
    synced.parameters.push(uintParam('amount', 100));
    handleRevenueSynced(synced);

    const accrued = changetype<FundRevenueAccrued>(newMockEvent());
    configureEvent(accrued, CONTRACT, 2);
    accrued.parameters = new Array<ethereum.EventParam>();
    accrued.parameters.push(uintParam('amount', 40));
    accrued.parameters.push(uintParam('totalLiability', 40));
    handleFundRevenueAccrued(accrued);

    const paid = changetype<FundRevenuePaid>(newMockEvent());
    configureEvent(paid, CONTRACT, 3);
    paid.parameters = new Array<ethereum.EventParam>();
    paid.parameters.push(addressParam('caller', USER));
    paid.parameters.push(addressParam('fund', ASSET));
    paid.parameters.push(uintParam('amount', 40));
    handleFundRevenuePaid(paid);

    assert.fieldEquals('ProtocolState', '4663', 'syncedRevenueRaw', '100');
    assert.fieldEquals('ProtocolState', '4663', 'fundRevenueAccruedRaw', '40');
    assert.fieldEquals('ProtocolState', '4663', 'fundRevenuePaidRaw', '40');
    assert.fieldEquals('ProtocolState', '4663', 'pendingFundRevenueRaw', '0');
  });
});
