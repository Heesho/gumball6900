import { DataSourceContext } from '@graphprotocol/graph-ts';
import {
  BribeBpsSet,
  BribeRewardTokenAdded,
  RevenueDistributed,
  RevenueNotified,
  StrategyAdded,
  StrategyKilled,
  SignalAdded,
  SignalRemoved,
  ResonanceRouterSet,
} from '../generated/Resonance/Resonance';
import { BribeTemplate, BribeRouterTemplate } from '../generated/templates';
import { ONE } from './constants';
import { getAccount, getProtocol, getStrategy, recordEvent } from './entities';

export function handleBribeBpsSet(event: BribeBpsSet): void {
  const protocol = getProtocol(event);
  protocol.bribeBps = event.params.newBribeBps;
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_BRIBE_BPS_SET');
  record.values = [event.params.previousBribeBps, event.params.newBribeBps];
  record.save();
}

export function handleBribeRewardTokenAdded(event: BribeRewardTokenAdded): void {
  const record = recordEvent(event, 'RESONANCE_BRIBE_REWARD_TOKEN_ADDED');
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
  protocol.revenueNotificationCount = protocol.revenueNotificationCount.plus(ONE);
  protocol.latestRevenueNotificationRaw = event.params.amount;
  protocol.latestRevenueNotificationAt = event.block.timestamp;
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_NOTIFIED');
  record.addresses = [event.params.resonanceRouter];
  record.values = [event.params.amount];
  record.save();
}

export function handleStrategyAdded(event: StrategyAdded): void {
  const protocol = getProtocol(event);
  protocol.strategyCount += 1;
  protocol.liveStrategyCount += 1;
  protocol.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.bribe = event.params.bribe;
  strategy.bribeRouter = event.params.bribeRouter;
  strategy.paymentToken = event.params.paymentToken;
  strategy.live = true;
  strategy.save();

  const context = new DataSourceContext();
  context.setString('strategyId', strategy.id);
  BribeTemplate.createWithContext(event.params.bribe, context);
  BribeRouterTemplate.createWithContext(event.params.bribeRouter, context);

  const record = recordEvent(event, 'RESONANCE_STRATEGY_ADDED');
  record.addresses = [event.params.strategy, event.params.bribe, event.params.bribeRouter, event.params.paymentToken];
  record.save();
}

export function handleStrategyKilled(event: StrategyKilled): void {
  const protocol = getProtocol(event);
  protocol.liveStrategyCount -= 1;
  protocol.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.live = false;
  strategy.save();

  const record = recordEvent(event, 'RESONANCE_STRATEGY_KILLED');
  record.addresses = [event.params.strategy];
  record.save();
}

export function handleSignalAdded(event: SignalAdded): void {
  const account = getAccount(event.params.account, event);
  account.signalWeightRaw = account.signalWeightRaw.plus(event.params.amount);
  account.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.totalSignalWeightRaw = strategy.totalSignalWeightRaw.plus(event.params.amount);
  strategy.save();

  const record = recordEvent(event, 'RESONANCE_SIGNAL_ADDED');
  record.addresses = [event.params.account, event.params.strategy];
  record.values = [event.params.amount];
  record.save();
}

export function handleSignalRemoved(event: SignalRemoved): void {
  const account = getAccount(event.params.account, event);
  account.signalWeightRaw = account.signalWeightRaw.minus(event.params.amount);
  account.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.totalSignalWeightRaw = strategy.totalSignalWeightRaw.minus(event.params.amount);
  strategy.save();

  const record = recordEvent(event, 'RESONANCE_SIGNAL_REMOVED');
  record.addresses = [event.params.account, event.params.strategy];
  record.values = [event.params.amount];
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
