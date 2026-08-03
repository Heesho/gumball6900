import { ethereum } from '@graphprotocol/graph-ts';
import {
  assert,
  beforeEach,
  clearStore,
  createMockedFunction,
  describe,
  newMockEvent,
  test,
} from 'matchstick-as/assembly/index';
import {
  AllocationVoter__PendingSignalsCancelled,
  AllocationVoter__RevenueNotified,
  AllocationVoter__SignalsActivated,
  AllocationVoter__SignalsPending,
  AllocationVoter__SignalsReset,
  AllocationVoter__StrategyBudgetCheckpointed,
  AllocationVoter__StrategyBudgetConsumed,
  AllocationVoter__StrategyBudgetScaled,
  AllocationVoter__StrategyDisabled,
  AllocationVoter__StrategyReactivated,
  AllocationVoter__UserWeightUpdated,
} from '../generated/AllocationVoter/AllocationVoter';
import { StakedGBX__Staked, StakedGBX__Unstaked } from '../generated/StakedGBX/StakedGBX';
import {
  handlePendingSignalsCancelled,
  handleRevenueNotified,
  handleSignalsActivated,
  handleSignalsPending,
  handleSignalsReset,
  handleStrategyBudgetCheckpointed,
  handleStrategyBudgetConsumed,
  handleStrategyBudgetScaled,
  handleStrategyDisabled,
  handleStrategyReactivated,
  handleUserWeightUpdated,
} from '../src/allocation-voter';
import { handleStaked, handleUnstaked } from '../src/staked-gbx';
import { CONTRACT, STRATEGY, USER, addressParam, configureEvent, integer, uintParam } from './helpers';

export {
  handlePendingSignalsCancelled,
  handleRevenueNotified,
  handleSignalsActivated,
  handleSignalsPending,
  handleSignalsReset,
  handleStaked,
  handleStrategyBudgetCheckpointed,
  handleStrategyBudgetConsumed,
  handleStrategyBudgetScaled,
  handleStrategyDisabled,
  handleStrategyReactivated,
  handleUnstaked,
  handleUserWeightUpdated,
};

describe('staking and signaling mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('indexes every staking, signal, revenue, and strategy-budget handler', () => {
    const staked = changetype<StakedGBX__Staked>(newMockEvent());
    configureEvent(staked, CONTRACT, 1);
    staked.parameters = new Array<ethereum.EventParam>();
    staked.parameters.push(addressParam('user', USER));
    staked.parameters.push(uintParam('requestedAmount', 51));
    staked.parameters.push(uintParam('receivedAmount', 50));
    handleStaked(staked);

    const weight = changetype<AllocationVoter__UserWeightUpdated>(newMockEvent());
    configureEvent(weight, CONTRACT, 2);
    weight.parameters = new Array<ethereum.EventParam>();
    weight.parameters.push(addressParam('user', USER));
    weight.parameters.push(addressParam('strategy', STRATEGY));
    weight.parameters.push(uintParam('previousWeight', 0));
    weight.parameters.push(uintParam('newWeight', 20));
    handleUserWeightUpdated(weight);

    const pending = changetype<AllocationVoter__SignalsPending>(newMockEvent());
    configureEvent(pending, CONTRACT, 3);
    pending.parameters = new Array<ethereum.EventParam>();
    pending.parameters.push(addressParam('user', USER));
    pending.parameters.push(uintParam('activationTime', 1000));
    handleSignalsPending(pending);

    const cancelled = changetype<AllocationVoter__PendingSignalsCancelled>(newMockEvent());
    configureEvent(cancelled, CONTRACT, 4);
    cancelled.parameters = new Array<ethereum.EventParam>();
    cancelled.parameters.push(addressParam('user', USER));
    handlePendingSignalsCancelled(cancelled);

    const pendingAgain = changetype<AllocationVoter__SignalsPending>(newMockEvent());
    configureEvent(pendingAgain, CONTRACT, 5);
    pendingAgain.parameters = new Array<ethereum.EventParam>();
    pendingAgain.parameters.push(addressParam('user', USER));
    pendingAgain.parameters.push(uintParam('activationTime', 2000));
    handleSignalsPending(pendingAgain);

    const activated = changetype<AllocationVoter__SignalsActivated>(newMockEvent());
    configureEvent(activated, CONTRACT, 6);
    activated.parameters = new Array<ethereum.EventParam>();
    activated.parameters.push(addressParam('user', USER));
    activated.parameters.push(uintParam('activatedAt', 2000));
    handleSignalsActivated(activated);

    const revenue = changetype<AllocationVoter__RevenueNotified>(newMockEvent());
    configureEvent(revenue, CONTRACT, 7);
    revenue.parameters = new Array<ethereum.EventParam>();
    revenue.parameters.push(addressParam('source', USER));
    revenue.parameters.push(uintParam('sourceType', 2));
    revenue.parameters.push(uintParam('amount', 30));
    revenue.parameters.push(uintParam('indexDelta', 4));
    revenue.parameters.push(uintParam('remainder', 1));
    handleRevenueNotified(revenue);

    const checkpoint = changetype<AllocationVoter__StrategyBudgetCheckpointed>(newMockEvent());
    configureEvent(checkpoint, CONTRACT, 8);
    checkpoint.parameters = new Array<ethereum.EventParam>();
    checkpoint.parameters.push(addressParam('strategy', STRATEGY));
    checkpoint.parameters.push(uintParam('budget', 30));
    checkpoint.parameters.push(uintParam('globalIndex', 4));
    createMockedFunction(CONTRACT, 'strategyScaledRemainder', 'strategyScaledRemainder(address):(uint256)')
      .withArgs([ethereum.Value.fromAddress(STRATEGY)])
      .returns([ethereum.Value.fromUnsignedBigInt(integer(7))]);
    handleStrategyBudgetCheckpointed(checkpoint);
    assert.fieldEquals('StrategyBudget', '4663-' + STRATEGY.toHexString(), 'scaledRemainder', '7');

    const consumed = changetype<AllocationVoter__StrategyBudgetConsumed>(newMockEvent());
    configureEvent(consumed, CONTRACT, 9);
    consumed.parameters = new Array<ethereum.EventParam>();
    consumed.parameters.push(addressParam('strategy', STRATEGY));
    consumed.parameters.push(uintParam('amount', 10));
    consumed.parameters.push(uintParam('budgetRemaining', 20));
    handleStrategyBudgetConsumed(consumed);

    const scaled = changetype<AllocationVoter__StrategyBudgetScaled>(newMockEvent());
    configureEvent(scaled, CONTRACT, 10);
    scaled.parameters = new Array<ethereum.EventParam>();
    scaled.parameters.push(addressParam('strategy', STRATEGY));
    scaled.parameters.push(uintParam('budgetAfter', 15));
    scaled.parameters.push(uintParam('scaledRemainderAfter', 5));
    handleStrategyBudgetScaled(scaled);
    assert.fieldEquals('StrategyBudget', '4663-' + STRATEGY.toHexString(), 'budgetUSDGRaw', '15');
    assert.fieldEquals('StrategyBudget', '4663-' + STRATEGY.toHexString(), 'scaledRemainder', '5');

    const disabled = changetype<AllocationVoter__StrategyDisabled>(newMockEvent());
    configureEvent(disabled, CONTRACT, 11);
    disabled.parameters = new Array<ethereum.EventParam>();
    disabled.parameters.push(addressParam('strategy', STRATEGY));
    disabled.parameters.push(uintParam('newGeneration', 2));
    disabled.parameters.push(uintParam('budgetReturnedToIdle', 20));
    handleStrategyDisabled(disabled);

    const reactivated = changetype<AllocationVoter__StrategyReactivated>(newMockEvent());
    configureEvent(reactivated, CONTRACT, 12);
    reactivated.parameters = new Array<ethereum.EventParam>();
    reactivated.parameters.push(addressParam('strategy', STRATEGY));
    reactivated.parameters.push(uintParam('generation', 2));
    handleStrategyReactivated(reactivated);

    const reset = changetype<AllocationVoter__SignalsReset>(newMockEvent());
    configureEvent(reset, CONTRACT, 13);
    reset.parameters = new Array<ethereum.EventParam>();
    reset.parameters.push(addressParam('user', USER));
    handleSignalsReset(reset);

    const unstaked = changetype<StakedGBX__Unstaked>(newMockEvent());
    configureEvent(unstaked, CONTRACT, 14);
    unstaked.parameters = new Array<ethereum.EventParam>();
    unstaked.parameters.push(addressParam('user', USER));
    unstaked.parameters.push(uintParam('amount', 20));
    handleUnstaked(unstaked);

    assert.entityCount('PendingSignal', 5);
    assert.entityCount('RevenueNotification', 1);
    assert.entityCount('SignalAllocation', 1);
    assert.fieldEquals('SignalAccount', '4663-' + USER.toHexString(), 'stakedGBXRaw', '30');
    assert.fieldEquals(
      'SignalAllocation',
      '4663-' + USER.toHexString() + '-strategy-' + STRATEGY.toHexString(),
      'recordedWeightRaw',
      '20',
    );
    assert.fieldEquals(
      'SignalAllocation',
      '4663-' + USER.toHexString() + '-strategy-' + STRATEGY.toHexString(),
      'generation',
      '0',
    );
    assert.fieldEquals('StrategyBudget', '4663-' + STRATEGY.toHexString(), 'budgetUSDGRaw', '0');
    assert.fieldEquals('StrategyBudget', '4663-' + STRATEGY.toHexString(), 'scaledRemainder', '0');
    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'generation', '2');
    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'enabled', 'true');
    assert.fieldEquals('Protocol', '4663', 'revenueNotifiedUSDGRaw', '30');
  });
});
