import { DataSourceContext } from '@graphprotocol/graph-ts';
import {
  BribeRewardAdded,
  RevenueDistributed,
  RevenueCarryFunded,
  RevenueNotified,
  RevenueQueued,
  RevenueSynced,
  RevenueStreamCheckpointed,
  RevenueStreamScheduled,
  FundRevenueAccrued,
  FundRevenuePaid,
  StrategyAdded,
  StrategyKilled,
  SignalAdded,
  SignalRemoved,
  ResonanceRouterSet,
} from '../generated/Resonance/Resonance';
import { BribeTemplate, BribeRouterTemplate } from '../generated/templates';
import { ZERO } from './constants';
import { getAccount, getProtocol, getStrategy, recordEvent } from './entities';

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

export function handleRevenueSynced(event: RevenueSynced): void {
  const protocol = getProtocol(event);
  protocol.syncedRevenueRaw = protocol.syncedRevenueRaw.plus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_SYNCED');
  record.addresses = [event.params.caller];
  record.values = [event.params.amount];
  record.save();
}

export function handleRevenueStreamCheckpointed(event: RevenueStreamCheckpointed): void {
  const protocol = getProtocol(event);
  protocol.revenueStreamReleasedScaled = protocol.revenueStreamReleasedScaled.plus(event.params.releasedScaled);
  protocol.revenueStreamRemainingScaled = event.params.remainingScaled;
  if (event.params.remainingScaled.equals(ZERO)) {
    protocol.revenueStreamRateScaled = ZERO;
    protocol.revenueStreamLastUpdate = ZERO;
    protocol.revenueStreamFinish = ZERO;
    protocol.revenueStreamRemainderFinish = ZERO;
  } else {
    protocol.revenueStreamLastUpdate = event.block.timestamp;
  }
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_STREAM_CHECKPOINTED');
  record.values = [event.params.releasedScaled, event.params.remainingScaled];
  record.save();
}

export function handleRevenueStreamScheduled(event: RevenueStreamScheduled): void {
  const protocol = getProtocol(event);
  protocol.queuedRevenueRaw = ZERO;
  protocol.revenueStreamRemainingScaled = event.params.amountScaled;
  protocol.revenueStreamRateScaled = event.params.rateScaled;
  protocol.revenueStreamLastUpdate = event.params.startedAt;
  protocol.revenueStreamFinish = event.params.finish;
  protocol.revenueStreamRemainderFinish = event.params.startedAt.plus(event.params.rateRemainder);
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_STREAM_SCHEDULED');
  record.values = [
    event.params.amount,
    event.params.amountScaled,
    event.params.startedAt,
    event.params.finish,
    event.params.rateScaled,
    event.params.rateRemainder,
  ];
  record.save();
}

export function handleRevenueQueued(event: RevenueQueued): void {
  const protocol = getProtocol(event);
  protocol.queuedRevenueRaw = event.params.totalQueued;
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_QUEUED');
  record.values = [event.params.amount, event.params.totalQueued];
  record.save();
}

export function handleRevenueCarryFunded(event: RevenueCarryFunded): void {
  const protocol = getProtocol(event);
  protocol.fundRevenueRemainderScaled = event.params.remainderScaled;
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_CARRY_FUNDED');
  record.values = [event.params.amountScaled, event.params.remainderScaled];
  record.save();
}

export function handleFundRevenueAccrued(event: FundRevenueAccrued): void {
  const protocol = getProtocol(event);
  protocol.fundRevenueAccruedRaw = protocol.fundRevenueAccruedRaw.plus(event.params.amount);
  protocol.pendingFundRevenueRaw = event.params.totalLiability;
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_FUND_REVENUE_ACCRUED');
  record.values = [event.params.amount, event.params.totalLiability];
  record.save();
}

export function handleFundRevenuePaid(event: FundRevenuePaid): void {
  const protocol = getProtocol(event);
  protocol.fundRevenuePaidRaw = protocol.fundRevenuePaidRaw.plus(event.params.amount);
  protocol.pendingFundRevenueRaw = protocol.pendingFundRevenueRaw.minus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_FUND_REVENUE_PAID');
  record.addresses = [event.params.caller, event.params.fund];
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
