import { ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
import {
  GenesisBootstrap__CommunityContribution,
  GenesisBootstrap__ContributionsOpened,
  GenesisBootstrap__LaunchSettled,
} from '../generated/GenesisBootstrap/GenesisBootstrap';
import { ClaimsBase__Claimed } from '../generated/GenesisClaims/GenesisClaims';
import { handleCommunityContribution, handleContributionsOpened, handleLaunchSettled } from '../src/genesis-bootstrap';
import { handleGenesisClaimed } from '../src/genesis-claims';
import { CONTRACT, USER, USER_TWO, addressParam, configureEvent, uintParam } from './helpers';

export { handleCommunityContribution, handleContributionsOpened, handleGenesisClaimed, handleLaunchSettled };

describe('genesis mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('indexes contribution, opening, settlement, and claim events', () => {
    const opened = changetype<GenesisBootstrap__ContributionsOpened>(newMockEvent());
    configureEvent(opened, CONTRACT, 1);
    opened.parameters = new Array<ethereum.EventParam>();
    opened.parameters.push(uintParam('startTime', 10));
    opened.parameters.push(uintParam('endTime', 20));
    handleContributionsOpened(opened);

    const contribution = changetype<GenesisBootstrap__CommunityContribution>(newMockEvent());
    configureEvent(contribution, CONTRACT, 2);
    contribution.parameters = new Array<ethereum.EventParam>();
    contribution.parameters.push(addressParam('payer', USER));
    contribution.parameters.push(addressParam('beneficiary', USER_TWO));
    contribution.parameters.push(uintParam('requestedAmount', 101));
    contribution.parameters.push(uintParam('receivedAmount', 100));
    contribution.parameters.push(uintParam('communityUSDGAfter', 100));
    handleCommunityContribution(contribution);

    const settled = changetype<GenesisBootstrap__LaunchSettled>(newMockEvent());
    configureEvent(settled, CONTRACT, 3);
    settled.parameters = new Array<ethereum.EventParam>();
    settled.parameters.push(uintParam('communityUSDG', 100));
    settled.parameters.push(uintParam('sponsorUSDG', 25));
    settled.parameters.push(uintParam('vaultUSDG', 75));
    settled.parameters.push(uintParam('sponsorRefund', 2));
    settled.parameters.push(uintParam('genesisPriceWad', 5));
    settled.parameters.push(uintParam('sqrtPriceX96', 7));
    handleLaunchSettled(settled);

    const claim = changetype<ClaimsBase__Claimed>(newMockEvent());
    configureEvent(claim, CONTRACT, 4);
    claim.parameters = new Array<ethereum.EventParam>();
    claim.parameters.push(uintParam('distributionId', 0));
    claim.parameters.push(addressParam('beneficiary', USER_TWO));
    claim.parameters.push(addressParam('caller', USER));
    claim.parameters.push(uintParam('amount', 80));
    handleGenesisClaimed(claim);

    assert.entityCount('GenesisContribution', 1);
    assert.entityCount('GenesisClaim', 1);
    assert.fieldEquals('GenesisBootstrap', '4663-' + CONTRACT.toHexString(), 'settled', 'true');
    assert.fieldEquals('GenesisBootstrap', '4663-' + CONTRACT.toHexString(), 'claimedGBXRaw', '80');
    assert.fieldEquals('Account', '4663-' + USER_TWO.toHexString(), 'genesisContributedRaw', '100');
    assert.fieldEquals('Account', '4663-' + USER_TWO.toHexString(), 'genesisClaimedGBXRaw', '80');
  });
});
