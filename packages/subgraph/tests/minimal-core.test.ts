import { ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
import { Claimed, Contributed, EpochSettled } from '../generated/Fundraiser/Fundraiser';
import { Burned, Minted } from '../generated/GBX/GBX';
import { FeesProcessed } from '../generated/LiquidityPosition/LiquidityPosition';
import { StrategyAdded, VoteCast, VoteReset } from '../generated/Voter/Voter';
import { handleClaimed, handleContributed, handleEpochSettled } from '../src/fundraiser';
import { handleBurned, handleMinted } from '../src/gbx';
import { eventId } from '../src/ids';
import { handleFeesProcessed } from '../src/liquidity-position';
import { handleStrategyAdded, handleVoteCast, handleVoteReset } from '../src/voter';
import { ASSET, CONTRACT, REWARDS, STRATEGY, USER, USER_TWO, addressParam, configureEvent, uintParam } from './helpers';

export {
  handleBurned,
  handleClaimed,
  handleContributed,
  handleEpochSettled,
  handleFeesProcessed,
  handleMinted,
  handleStrategyAdded,
  handleVoteCast,
  handleVoteReset,
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

  test('tracks sequential Fundraiser settlement and liquidity fee processing', () => {
    const settlement = changetype<EpochSettled>(newMockEvent());
    configureEvent(settlement, CONTRACT, 1);
    settlement.parameters = new Array<ethereum.EventParam>();
    settlement.parameters.push(uintParam('epoch', 7));
    settlement.parameters.push(uintParam('scheduledEmission', 100));
    settlement.parameters.push(uintParam('contributorEmission', 80));
    settlement.parameters.push(uintParam('nextScheduledEmission', 90));
    handleEpochSettled(settlement);

    const fees = changetype<FeesProcessed>(newMockEvent());
    configureEvent(fees, CONTRACT, 2);
    fees.parameters = new Array<ethereum.EventParam>();
    fees.parameters.push(uintParam('positionTokenId', 11));
    fees.parameters.push(addressParam('caller', USER));
    fees.parameters.push(uintParam('gbxBurned', 10));
    fees.parameters.push(uintParam('usdgRouted', 20));
    handleFeesProcessed(fees);

    const fundraiserEpochId = '4663-' + CONTRACT.toHexString() + '-epoch-7';
    assert.fieldEquals('FundraiserEpoch', fundraiserEpochId, 'settled', 'true');
    assert.fieldEquals('FundraiserEpoch', fundraiserEpochId, 'scheduledEmissionRaw', '100');
    assert.fieldEquals('FundraiserEpoch', fundraiserEpochId, 'contributorEmissionRaw', '80');
    assert.fieldEquals('ProtocolState', '4663', 'liquidityGBXBurnedRaw', '10');
    assert.fieldEquals('ProtocolState', '4663', 'liquidityUSDGRoutedRaw', '20');
    assert.fieldEquals('ProtocolEvent', eventId(fees), 'eventType', 'LIQUIDITY_FEES_PROCESSED');
  });

  test('tracks Strategy creation and unrestricted vote replacement events', () => {
    const added = changetype<StrategyAdded>(newMockEvent());
    configureEvent(added, CONTRACT, 1);
    added.parameters = new Array<ethereum.EventParam>();
    added.parameters.push(addressParam('strategy', STRATEGY));
    added.parameters.push(addressParam('bribe', REWARDS));
    added.parameters.push(addressParam('bribeRouter', USER_TWO));
    added.parameters.push(addressParam('paymentToken', ASSET));
    added.parameters.push(uintParam('kind', 0));
    handleStrategyAdded(added);

    const cast = changetype<VoteCast>(newMockEvent());
    configureEvent(cast, CONTRACT, 2);
    cast.parameters = new Array<ethereum.EventParam>();
    cast.parameters.push(addressParam('account', USER));
    cast.parameters.push(addressParam('strategy', STRATEGY));
    cast.parameters.push(uintParam('weight', 100));
    handleVoteCast(cast);

    const reset = changetype<VoteReset>(newMockEvent());
    configureEvent(reset, CONTRACT, 3);
    reset.parameters = new Array<ethereum.EventParam>();
    reset.parameters.push(addressParam('account', USER));
    reset.parameters.push(addressParam('strategy', STRATEGY));
    reset.parameters.push(uintParam('weight', 100));
    handleVoteReset(reset);

    const strategyId = '4663-' + STRATEGY.toHexString();
    assert.fieldEquals('ProtocolState', '4663', 'strategyCount', '1');
    assert.fieldEquals('Strategy', strategyId, 'paymentToken', ASSET.toHexString());
    assert.fieldEquals('Strategy', strategyId, 'totalWeightRaw', '0');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'votingWeightRaw', '0');
  });
});
