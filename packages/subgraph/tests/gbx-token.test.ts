import { ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
import { GBXToken__Burned, GBXToken__Minted } from '../generated/GBXToken/GBXToken';
import { handleBurned, handleMinted } from '../src/gbx-token';
import { eventId } from '../src/ids';
import { CONTRACT, USER, USER_TWO, addressParam, configureEvent, uintParam } from './helpers';

export { handleBurned, handleMinted };

describe('GBX token mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('indexes mint and burn supply accounting', () => {
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

    assert.entityCount('Burn', 1);
    assert.fieldEquals('Burn', eventId(burned), 'amountGBXRaw', '25');
    assert.fieldEquals('GBXToken', '4663-' + CONTRACT.toHexString(), 'totalSupplyRaw', '75');
    assert.fieldEquals('Protocol', '4663', 'cumulativeMintedRaw', '100');
    assert.fieldEquals('Protocol', '4663', 'cumulativeBurnedRaw', '25');
    assert.fieldEquals('Account', '4663-' + USER.toHexString(), 'gbxBurnedRaw', '25');
    assert.entityCount('DailyProtocolSnapshot', 1);
    assert.entityCount('DailyAccountSnapshot', 1);
  });
});
