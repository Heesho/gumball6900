import { ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
import { GBXToken__Burned, GBXToken__Minted } from '../generated/GBXToken/GBXToken';
import {
  LiquidityCustodian__FeesCollected,
  LiquidityCustodian__PositionRecorded,
  LiquidityCustodian__PositionTransferred,
} from '../generated/LiquidityCustodian/LiquidityCustodian';
import { MiningClaims__Claimed } from '../generated/MiningClaims/MiningClaims';
import { MiningPool__Contribution, MiningPool__EpochSettled } from '../generated/MiningPool/MiningPool';
import { handleBurned, handleMinted } from '../src/gbx-token';
import { handleFeesCollected, handlePositionRecorded, handlePositionTransferred } from '../src/liquidity-custodian';
import { handleMiningClaimed } from '../src/mining-claims';
import { handleMiningContribution, handleMiningEpochSettled } from '../src/mining-pool';
import { eventId } from '../src/ids';
import { CONTRACT, HASH, USER, USER_TWO, addressParam, bytesParam, configureEvent, uintParam } from './helpers';

export {
  handleBurned,
  handleFeesCollected,
  handleMiningClaimed,
  handleMiningContribution,
  handleMiningEpochSettled,
  handleMinted,
  handlePositionRecorded,
  handlePositionTransferred,
};

describe('minimal protocol mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('tracks cumulative mint and burn state without reopening mint capacity', () => {
    const minted = changetype<GBXToken__Minted>(newMockEvent());
    configureEvent(minted, CONTRACT, 1);
    minted.parameters = new Array<ethereum.EventParam>();
    minted.parameters.push(addressParam('receiver', USER));
    minted.parameters.push(uintParam('amount', 100));
    minted.parameters.push(uintParam('cumulativeMintedAfter', 100));
    handleMinted(minted);

    const burned = changetype<GBXToken__Burned>(newMockEvent());
    configureEvent(burned, CONTRACT, 2);
    burned.parameters = new Array<ethereum.EventParam>();
    burned.parameters.push(addressParam('operator', USER_TWO));
    burned.parameters.push(addressParam('account', USER));
    burned.parameters.push(uintParam('amount', 25));
    burned.parameters.push(uintParam('cumulativeBurnedAfter', 25));
    handleBurned(burned);

    assert.fieldEquals('ProtocolState', '4663', 'cumulativeMintedRaw', '100');
    assert.fieldEquals('ProtocolState', '4663', 'cumulativeBurnedRaw', '25');
    assert.fieldEquals('ProtocolState', '4663', 'totalSupplyRaw', '75');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'gbxBurnedRaw', '25');
    assert.fieldEquals('ProtocolEvent', eventId(burned), 'eventType', 'GBX_BURNED');
  });

  test('tracks beneficiary mining contribution, settlement, and claim', () => {
    const contribution = changetype<MiningPool__Contribution>(newMockEvent());
    configureEvent(contribution, CONTRACT, 1);
    contribution.parameters = new Array<ethereum.EventParam>();
    contribution.parameters.push(uintParam('epochId', 7));
    contribution.parameters.push(addressParam('payer', USER));
    contribution.parameters.push(addressParam('beneficiary', USER_TWO));
    contribution.parameters.push(uintParam('requestedAmount', 50));
    contribution.parameters.push(uintParam('receivedAmount', 50));
    contribution.parameters.push(uintParam('epochTotalAfter', 50));
    handleMiningContribution(contribution);

    const settled = changetype<MiningPool__EpochSettled>(newMockEvent());
    configureEvent(settled, CONTRACT, 2);
    settled.parameters = new Array<ethereum.EventParam>();
    settled.parameters.push(uintParam('epochId', 7));
    settled.parameters.push(uintParam('totalContributed', 50));
    settled.parameters.push(uintParam('teamFee', 1));
    settled.parameters.push(uintParam('vaultRevenue', 49));
    settled.parameters.push(uintParam('emission', 44));
    handleMiningEpochSettled(settled);

    const claim = changetype<MiningClaims__Claimed>(newMockEvent());
    configureEvent(claim, CONTRACT, 3);
    claim.parameters = new Array<ethereum.EventParam>();
    claim.parameters.push(uintParam('epochId', 7));
    claim.parameters.push(addressParam('beneficiary', USER_TWO));
    claim.parameters.push(addressParam('caller', USER));
    claim.parameters.push(uintParam('amount', 44));
    handleMiningClaimed(claim);

    const epochId = '4663-' + CONTRACT.toHexString() + '-epoch-7';
    assert.fieldEquals('MiningEpoch', epochId, 'settled', 'true');
    assert.fieldEquals('MiningEpoch', epochId, 'teamFeeUSDGRaw', '1');
    assert.fieldEquals('MiningEpoch', epochId, 'vaultRevenueUSDGRaw', '49');
    assert.fieldEquals('MiningEpoch', epochId, 'emissionGBXRaw', '44');
    assert.fieldEquals('Account', '4663-' + USER_TWO.toHexString(), 'miningClaimedGBXRaw', '44');
  });

  test('tracks the sole position, routed fees, and terminal transfer', () => {
    const position = changetype<LiquidityCustodian__PositionRecorded>(newMockEvent());
    configureEvent(position, CONTRACT, 1);
    position.parameters = new Array<ethereum.EventParam>();
    position.parameters.push(uintParam('positionId', 11));
    position.parameters.push(addressParam('previousOwner', USER));
    position.parameters.push(bytesParam('poolKeyHash', HASH));
    handlePositionRecorded(position);

    const fees = changetype<LiquidityCustodian__FeesCollected>(newMockEvent());
    configureEvent(fees, CONTRACT, 2);
    fees.parameters = new Array<ethereum.EventParam>();
    fees.parameters.push(uintParam('positionId', 11));
    fees.parameters.push(addressParam('caller', USER_TWO));
    fees.parameters.push(uintParam('gbxBurned', 2));
    fees.parameters.push(uintParam('usdGToVault', 3));
    handleFeesCollected(fees);

    const transferred = changetype<LiquidityCustodian__PositionTransferred>(newMockEvent());
    configureEvent(transferred, CONTRACT, 3);
    transferred.parameters = new Array<ethereum.EventParam>();
    transferred.parameters.push(uintParam('positionId', 11));
    transferred.parameters.push(addressParam('recipient', USER_TWO));
    handlePositionTransferred(transferred);

    const positionId = '4663-' + CONTRACT.toHexString() + '-position-11';
    assert.fieldEquals('LiquidityPosition', positionId, 'poolKeyHash', HASH.toHexString());
    assert.fieldEquals('LiquidityPosition', positionId, 'gbxFeesBurnedRaw', '2');
    assert.fieldEquals('LiquidityPosition', positionId, 'usdgFeesToVaultRaw', '3');
    assert.fieldEquals('LiquidityPosition', positionId, 'inCustody', 'false');
    assert.fieldEquals('LiquidityPosition', positionId, 'transferredTo', USER_TWO.toHexString());
    assert.fieldEquals('ProtocolState', '4663', 'liquidityFeesBurnedGBXRaw', '2');
    assert.fieldEquals('ProtocolState', '4663', 'liquidityFeesToVaultUSDGRaw', '3');
  });
});
