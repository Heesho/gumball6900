import {
  AllocationVoter__DependenciesInitialized,
  AllocationVoter__RevenueNotified,
  AllocationVoter__SignalIncreasesPauseSet,
  AllocationVoter__SignalsReset,
  AllocationVoter__SignalsSet,
  AllocationVoter__StrategyBudgetConsumed,
  AllocationVoter__StrategyBudgetScaled,
  AllocationVoter__StrategyDisabled,
  AllocationVoter__StrategyWeightSet,
} from '../generated/AllocationVoter/AllocationVoter';
import { getAccount, getProtocol, getStrategy, recordEvent } from './entities';

export function handleDependenciesInitialized(event: AllocationVoter__DependenciesInitialized): void {
  const record = recordEvent(event, 'ALLOCATION_DEPENDENCIES_INITIALIZED');
  record.addresses = [
    event.params.vault,
    event.params.stakedGBX,
    event.params.miningPool,
    event.params.liquidityCustodian,
  ];
  record.save();
}

export function handleRevenueNotified(event: AllocationVoter__RevenueNotified): void {
  const protocol = getProtocol(event);
  protocol.vaultRevenueUSDGRaw = protocol.vaultRevenueUSDGRaw.plus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'ALLOCATION_REVENUE_NOTIFIED');
  record.addresses = [event.params.source];
  record.values = [event.params.amount, event.params.indexDelta];
  record.save();
}

export function handleSignalIncreasesPauseSet(event: AllocationVoter__SignalIncreasesPauseSet): void {
  const record = recordEvent(event, 'SIGNAL_INCREASES_PAUSE_SET');
  record.flag = event.params.paused;
  record.save();
}

export function handleSignalsReset(event: AllocationVoter__SignalsReset): void {
  const account = getAccount(event.params.user, event);
  account.signalWeightRaw = account.signalWeightRaw.minus(account.signalWeightRaw);
  account.save();

  const record = recordEvent(event, 'SIGNALS_RESET');
  record.addresses = [event.params.user];
  record.save();
}

export function handleSignalsSet(event: AllocationVoter__SignalsSet): void {
  const account = getAccount(event.params.user, event);
  account.signalWeightRaw = event.params.totalWeight;
  account.save();

  const record = recordEvent(event, 'SIGNALS_SET');
  record.addresses = [event.params.user];
  record.values = [event.params.totalWeight];
  record.save();
}

export function handleStrategyBudgetConsumed(event: AllocationVoter__StrategyBudgetConsumed): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.budgetUSDGRaw = event.params.remaining;
  strategy.save();

  const record = recordEvent(event, 'STRATEGY_BUDGET_CONSUMED');
  record.addresses = [event.params.strategy];
  record.values = [event.params.amount, event.params.remaining];
  record.save();
}

export function handleStrategyBudgetScaled(event: AllocationVoter__StrategyBudgetScaled): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.budgetUSDGRaw = event.params.budgetAfter;
  strategy.save();

  const record = recordEvent(event, 'STRATEGY_BUDGET_SCALED');
  record.addresses = [event.params.strategy];
  record.values = [event.params.budgetAfter];
  record.save();
}

export function handleAllocationStrategyDisabled(event: AllocationVoter__StrategyDisabled): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.live = false;
  strategy.budgetUSDGRaw = strategy.budgetUSDGRaw.minus(strategy.budgetUSDGRaw);
  strategy.save();

  const record = recordEvent(event, 'ALLOCATION_STRATEGY_DISABLED');
  record.addresses = [event.params.strategy];
  record.values = [event.params.strandedBudget];
  record.save();
}

export function handleStrategyWeightSet(event: AllocationVoter__StrategyWeightSet): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.totalWeightRaw = event.params.newWeight;
  strategy.save();

  const record = recordEvent(event, 'STRATEGY_WEIGHT_SET');
  record.addresses = [event.params.strategy];
  record.values = [event.params.previousWeight, event.params.newWeight];
  record.save();
}
