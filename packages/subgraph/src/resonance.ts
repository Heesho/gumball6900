import { BigInt } from '@graphprotocol/graph-ts';
import {
  BribeBpsSet,
  BribeRewardAdded,
  RevenueDistributed,
  RevenueNotified,
  StrategyAdded,
  StrategyKilled,
  SignalAllocated,
  SignalReset,
  ResonanceRouterSet,
} from '../generated/Resonance/Resonance';
import { getAccount, getProtocol, getStrategy, recordEvent } from './entities';

export function handleBribeBpsSet(event: BribeBpsSet): void {
  const protocol = getProtocol(event);
  protocol.bribeBps = event.params.newBps;
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_BRIBE_BPS_SET');
  record.values = [event.params.previousBps, event.params.newBps];
  record.save();
}

export function handleBribeRewardAdded(event: BribeRewardAdded): void {
  const record = recordEvent(event, 'RESONANCE_BRIBE_REWARD_ADDED');
  record.addresses = [event.params.strategy, event.params.bribe, event.params.rewardToken];
  record.save();
}

export function handleRevenueDistributed(event: RevenueDistributed): void {
  const protocol = getProtocol(event);
  protocol.distributedRevenueRaw = protocol.distributedRevenueRaw.plus(event.params.amount);
  protocol.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.distributedRevenueRaw = strategy.distributedRevenueRaw.plus(event.params.amount);
  strategy.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_DISTRIBUTED');
  record.addresses = [event.params.caller, event.params.strategy];
  record.values = [event.params.amount];
  record.save();
}

export function handleRevenueNotified(event: RevenueNotified): void {
  const protocol = getProtocol(event);
  protocol.notifiedRevenueRaw = protocol.notifiedRevenueRaw.plus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_NOTIFIED');
  record.addresses = [event.params.resonanceRouter];
  record.values = [event.params.amount];
  record.save();
}

export function handleStrategyAdded(event: StrategyAdded): void {
  const protocol = getProtocol(event);
  protocol.strategyCount += 1;
  protocol.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.bribe = event.params.bribe;
  strategy.bribeRouter = event.params.bribeRouter;
  strategy.paymentToken = event.params.paymentToken;
  strategy.kind = event.params.kind;
  strategy.live = true;
  strategy.save();

  const record = recordEvent(event, 'RESONANCE_STRATEGY_ADDED');
  record.addresses = [event.params.strategy, event.params.bribe, event.params.bribeRouter, event.params.paymentToken];
  record.values = [BigInt.fromI32(event.params.kind)];
  record.save();
}

export function handleStrategyKilled(event: StrategyKilled): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.live = false;
  strategy.save();

  const record = recordEvent(event, 'RESONANCE_STRATEGY_KILLED');
  record.addresses = [event.params.strategy];
  record.save();
}

export function handleSignalAllocated(event: SignalAllocated): void {
  const account = getAccount(event.params.account, event);
  account.signalWeightRaw = account.signalWeightRaw.plus(event.params.signalWeight);
  account.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.totalSignalWeightRaw = strategy.totalSignalWeightRaw.plus(event.params.signalWeight);
  strategy.save();

  const record = recordEvent(event, 'RESONANCE_SIGNAL_ALLOCATED');
  record.addresses = [event.params.account, event.params.strategy];
  record.values = [event.params.signalWeight];
  record.save();
}

export function handleSignalReset(event: SignalReset): void {
  const account = getAccount(event.params.account, event);
  account.signalWeightRaw = account.signalWeightRaw.minus(event.params.signalWeight);
  account.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.totalSignalWeightRaw = strategy.totalSignalWeightRaw.minus(event.params.signalWeight);
  strategy.save();

  const record = recordEvent(event, 'RESONANCE_SIGNAL_RESET');
  record.addresses = [event.params.account, event.params.strategy];
  record.values = [event.params.signalWeight];
  record.save();
}

export function handleResonanceRouterSet(event: ResonanceRouterSet): void {
  const protocol = getProtocol(event);
  protocol.resonanceRouter = event.params.resonanceRouter;
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_ROUTER_SET');
  record.addresses = [event.params.resonanceRouter];
  record.save();
}
