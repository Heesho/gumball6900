import { ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as/assembly/index';
import { DelegateChanged, DelegateVotesChanged } from '../generated/SignalGBX/SignalGBX';
import { handleDelegateChanged, handleDelegateVotesChanged } from '../src/signal-gbx';
import { eventId } from '../src/ids';
import { CONTRACT, USER, USER_TWO, ZERO_ADDRESS, addressParam, configureEvent, uintParam } from './helpers';

export { handleDelegateChanged, handleDelegateVotesChanged };

describe('SignalGBX delegation event mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('tracks delegation independently from Resonance signal allocation', () => {
    const delegateChanged = changetype<DelegateChanged>(newMockEvent());
    configureEvent(delegateChanged, CONTRACT, 1);
    delegateChanged.parameters = new Array<ethereum.EventParam>();
    delegateChanged.parameters.push(addressParam('delegator', USER));
    delegateChanged.parameters.push(addressParam('fromDelegate', ZERO_ADDRESS));
    delegateChanged.parameters.push(addressParam('toDelegate', USER_TWO));
    handleDelegateChanged(delegateChanged);

    const votesChanged = changetype<DelegateVotesChanged>(newMockEvent());
    configureEvent(votesChanged, CONTRACT, 2);
    votesChanged.parameters = new Array<ethereum.EventParam>();
    votesChanged.parameters.push(addressParam('delegate', USER_TWO));
    votesChanged.parameters.push(uintParam('previousVotes', 0));
    votesChanged.parameters.push(uintParam('newVotes', 100));
    handleDelegateVotesChanged(votesChanged);

    const delegatorId = '4663-' + USER.toHexString();
    const delegateId = '4663-' + USER_TWO.toHexString();
    assert.fieldEquals('Account', delegatorId, 'currentDelegate', USER_TWO.toHexString());
    assert.fieldEquals('Account', delegatorId, 'signalWeightRaw', '0');
    assert.fieldEquals('Account', delegateId, 'delegatedVotesRaw', '100');
    assert.fieldEquals('ProtocolEvent', eventId(votesChanged), 'eventType', 'SIGNAL_GBX_DELEGATE_VOTES_CHANGED');
  });
});
