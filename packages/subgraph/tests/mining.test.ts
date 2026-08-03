import { ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
import { ClaimsBase__Claimed } from '../generated/MiningClaims/MiningClaims';
import {
  MiningPool__Contribution,
  MiningPool__EpochExtended,
  MiningPool__EpochSettled,
} from '../generated/MiningPool/MiningPool';
import { handleMiningClaimed } from '../src/mining-claims';
import { handleEpochExtended, handleEpochSettled, handleMiningContribution } from '../src/mining-pool';
import { CONTRACT, USER, USER_TWO, addressParam, configureEvent, uintParam } from './helpers';

export { handleEpochExtended, handleEpochSettled, handleMiningClaimed, handleMiningContribution };

describe('mining mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('indexes contribution, extension, settlement, and claim events', () => {
    const contribution = changetype<MiningPool__Contribution>(newMockEvent());
    configureEvent(contribution, CONTRACT, 1);
    contribution.parameters = new Array<ethereum.EventParam>();
    contribution.parameters.push(uintParam('epochId', 7));
    contribution.parameters.push(addressParam('payer', USER));
    contribution.parameters.push(addressParam('beneficiary', USER_TWO));
    contribution.parameters.push(uintParam('requestedAmount', 51));
    contribution.parameters.push(uintParam('receivedAmount', 50));
    contribution.parameters.push(uintParam('epochTotalAfter', 50));
    handleMiningContribution(contribution);

    const extended = changetype<MiningPool__EpochExtended>(newMockEvent());
    configureEvent(extended, CONTRACT, 2);
    extended.parameters = new Array<ethereum.EventParam>();
    extended.parameters.push(uintParam('epochId', 7));
    extended.parameters.push(uintParam('newEndTime', 999));
    extended.parameters.push(uintParam('extensionUsed', 12));
    handleEpochExtended(extended);

    const settled = changetype<MiningPool__EpochSettled>(newMockEvent());
    configureEvent(settled, CONTRACT, 3);
    settled.parameters = new Array<ethereum.EventParam>();
    settled.parameters.push(uintParam('epochId', 7));
    settled.parameters.push(uintParam('totalContributed', 50));
    settled.parameters.push(uintParam('scheduledEmission', 45));
    settled.parameters.push(uintParam('actualEmission', 44));
    settled.parameters.push(uintParam('clearingPrice', 2));
    settled.parameters.push(uintParam('nextReferencePrice', 3));
    handleEpochSettled(settled);

    const claim = changetype<ClaimsBase__Claimed>(newMockEvent());
    configureEvent(claim, CONTRACT, 4);
    claim.parameters = new Array<ethereum.EventParam>();
    claim.parameters.push(uintParam('distributionId', 7));
    claim.parameters.push(addressParam('beneficiary', USER_TWO));
    claim.parameters.push(addressParam('caller', USER));
    claim.parameters.push(uintParam('amount', 44));
    handleMiningClaimed(claim);

    const epochId = '4663-' + CONTRACT.toHexString() + '-epoch-7';
    assert.entityCount('MiningContribution', 1);
    assert.entityCount('MiningClaim', 1);
    assert.fieldEquals('MiningEpoch', epochId, 'settled', 'true');
    assert.fieldEquals('MiningEpoch', epochId, 'actualEmissionGBXRaw', '44');
    assert.fieldEquals('Account', '4663-' + USER_TWO.toHexString(), 'miningClaimedGBXRaw', '44');
  });
});
