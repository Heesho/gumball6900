import { ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
import { Claimed, Contributed, EpochSettled } from '../generated/Fundraiser/Fundraiser';
import { Burned, Minted } from '../generated/GBX/GBX';
import { FeesHarvested } from '../generated/LiquidityPosition/LiquidityPosition';
import {
  FundRevenueAccrued,
  FundRevenuePaid,
  RevenueSynced,
  SignalAdded,
  SignalRemoved,
  StrategyAdded,
} from '../generated/Resonance/Resonance';
import { handleClaimed, handleContributed, handleEpochSettled } from '../src/fundraiser';
import { handleBurned, handleMinted } from '../src/gbx';
import { eventId } from '../src/ids';
import { handleFeesHarvested } from '../src/liquidity-position';
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
  handleContributed,
  handleEpochSettled,
  handleFeesHarvested,
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

  test('tracks cumulative lifetime minting and burning', () => {
    const minted = changetype<Minted>(newMockEvent());
    configureEvent(minted, CONTRACT, 1);
    minted.parameters = new Array<ethereum.EventParam>();
    minted.parameters.push(addressParam('account', USER));
    minted.parameters.push(uintParam('amount', 100));
    handleMinted(minted);

    const burned = changetype<Burned>(newMockEvent());
    configureEvent(burned, CONTRACT, 2);
    burned.parameters = new Array<ethereum.EventParam>();
    burned.parameters.push(addressParam('account', USER));
    burned.parameters.push(uintParam('amount', 25));
    handleBurned(burned);

    assert.fieldEquals('ProtocolState', '4663', 'lifetimeMintedRaw', '100');
    assert.fieldEquals('ProtocolState', '4663', 'lifetimeBurnedRaw', '25');
    assert.fieldEquals('ProtocolState', '4663', 'totalSupplyRaw', '75');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'gbxBurnedRaw', '25');
    assert.fieldEquals('ProtocolEvent', eventId(burned), 'eventType', 'GBX_BURNED');
  });

  test('tracks Fundraiser contributions and claims by beneficiary and epoch', () => {
    const contribution = changetype<Contributed>(newMockEvent());
    configureEvent(contribution, CONTRACT, 1);
    contribution.parameters = new Array<ethereum.EventParam>();
    contribution.parameters.push(addressParam('payer', USER));
    contribution.parameters.push(addressParam('beneficiary', USER_TWO));
    contribution.parameters.push(uintParam('epoch', 7));
    contribution.parameters.push(uintParam('amount', 50));
    handleContributed(contribution);

    const claim = changetype<Claimed>(newMockEvent());
    configureEvent(claim, CONTRACT, 2);
    claim.parameters = new Array<ethereum.EventParam>();
    claim.parameters.push(addressParam('account', USER_TWO));
    claim.parameters.push(uintParam('epoch', 7));
    claim.parameters.push(uintParam('amount', 40));
    handleClaimed(claim);

    const epochId = '4663-' + CONTRACT.toHexString() + '-epoch-7';
    assert.fieldEquals('FundraiserEpoch', epochId, 'totalContributionsRaw', '50');
    assert.fieldEquals('FundraiserEpoch', epochId, 'totalClaimedGBXRaw', '40');
    assert.fieldEquals('Account', '4663-' + USER_TWO.toHexString(), 'contributedUSDGRaw', '50');
    assert.fieldEquals('Account', '4663-' + USER_TWO.toHexString(), 'claimedGBXRaw', '40');
  });

  test('tracks sequential Fundraiser settlement and fixed-principal fee harvesting', () => {
    const settlement = changetype<EpochSettled>(newMockEvent());
    configureEvent(settlement, CONTRACT, 1);
    settlement.parameters = new Array<ethereum.EventParam>();
    settlement.parameters.push(uintParam('epoch', 7));
    settlement.parameters.push(uintParam('scheduledEmission', 100));
    settlement.parameters.push(uintParam('contributorEmission', 80));
    settlement.parameters.push(uintParam('nextScheduledEmission', 90));
    handleEpochSettled(settlement);

    const harvested = changetype<FeesHarvested>(newMockEvent());
    configureEvent(harvested, CONTRACT, 2);
    harvested.parameters = new Array<ethereum.EventParam>();
    harvested.parameters.push(uintParam('positionTokenId', 11));
    harvested.parameters.push(addressParam('caller', USER));
    harvested.parameters.push(uintParam('principalLiquidity', 5000));
    harvested.parameters.push(uintParam('usdgRouted', 20));
    harvested.parameters.push(uintParam('gbxBurned', 30));
    handleFeesHarvested(harvested);

    const fundraiserEpochId = '4663-' + CONTRACT.toHexString() + '-epoch-7';
    assert.fieldEquals('FundraiserEpoch', fundraiserEpochId, 'settled', 'true');
    assert.fieldEquals('FundraiserEpoch', fundraiserEpochId, 'scheduledEmissionRaw', '100');
    assert.fieldEquals('FundraiserEpoch', fundraiserEpochId, 'contributorEmissionRaw', '80');
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
