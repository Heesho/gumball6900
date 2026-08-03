import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import {
  AllocationVoter,
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
import { PendingSignal, RevenueNotification, SignalAllocation, VaultAsset } from '../generated/schema';
import { getDailyAccount, getDailyProtocol, syncDailyProtocol } from './daily';
import { getAccount, getProtocol, getSignalAccount, getStrategy, getStrategyBudget } from './entities';
import { allocationId, eventId } from './ids';
import { applyVaultDelta } from './vault-accounting';

function recordSignalAction(
  event: ethereum.Event,
  user: Address,
  action: string,
  activationTime: BigInt | null,
  activatedAt: BigInt | null,
): void {
  const account = getAccount(user, event);
  account.signalEventCount += 1;
  account.save();
  const signal = getSignalAccount(user, event);
  signal.save();

  const record = new PendingSignal(eventId(event));
  record.account = signal.id;
  record.action = action;
  record.activationTime = activationTime;
  record.activatedAt = activatedAt;
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;
  record.logIndex = event.logIndex;
  record.save();

  const daily = getDailyAccount(user, event);
  daily.signalEventCount += 1;
  daily.save();
}

export function handleRevenueNotified(event: AllocationVoter__RevenueNotified): void {
  const notification = new RevenueNotification(eventId(event));
  notification.kind = 'ALLOCATION_ACCOUNTING';
  notification.source = event.params.source;
  notification.sourceType = event.params.sourceType;
  notification.amountUSDGRaw = event.params.amount;
  notification.indexDelta = event.params.indexDelta;
  notification.remainder = event.params.remainder;
  notification.blockNumber = event.block.number;
  notification.timestamp = event.block.timestamp;
  notification.transactionHash = event.transaction.hash;
  notification.logIndex = event.logIndex;
  notification.save();

  const protocol = getProtocol(event);
  protocol.revenueNotifiedUSDGRaw = protocol.revenueNotifiedUSDGRaw.plus(event.params.amount);
  const usdgAssetId = protocol.usdgAsset;
  protocol.save();

  if (usdgAssetId != null) {
    const asset = VaultAsset.load(usdgAssetId!);
    if (asset != null) applyVaultDelta(asset, event.params.amount, 'REVENUE_NOTIFIED', event);
  }

  const daily = getDailyProtocol(event);
  daily.revenueNotifiedUSDGRaw = daily.revenueNotifiedUSDGRaw.plus(event.params.amount);
  syncDailyProtocol(daily, protocol);
  daily.save();
}

export function handleSignalsPending(event: AllocationVoter__SignalsPending): void {
  recordSignalAction(event, event.params.user, 'PENDING', event.params.activationTime, null);
}

export function handleSignalsActivated(event: AllocationVoter__SignalsActivated): void {
  const signal = getSignalAccount(event.params.user, event);
  signal.lastActivatedAt = event.params.activatedAt;
  signal.save();
  recordSignalAction(event, event.params.user, 'ACTIVATED', null, event.params.activatedAt);
}

export function handleSignalsReset(event: AllocationVoter__SignalsReset): void {
  recordSignalAction(event, event.params.user, 'RESET', null, null);
}

export function handlePendingSignalsCancelled(event: AllocationVoter__PendingSignalsCancelled): void {
  recordSignalAction(event, event.params.user, 'CANCELLED', null, null);
}

export function handleStrategyBudgetCheckpointed(event: AllocationVoter__StrategyBudgetCheckpointed): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.save();
  const budget = getStrategyBudget(event.params.strategy, event);
  budget.budgetUSDGRaw = event.params.budget;
  budget.scaledRemainder = AllocationVoter.bind(event.address).strategyScaledRemainder(event.params.strategy);
  budget.globalIndex = event.params.globalIndex;
  budget.save();
}

export function handleStrategyBudgetConsumed(event: AllocationVoter__StrategyBudgetConsumed): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.save();
  const budget = getStrategyBudget(event.params.strategy, event);
  budget.budgetUSDGRaw = event.params.budgetRemaining;
  budget.totalConsumedUSDGRaw = budget.totalConsumedUSDGRaw.plus(event.params.amount);
  budget.save();
}

export function handleStrategyBudgetScaled(event: AllocationVoter__StrategyBudgetScaled): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.save();
  const budget = getStrategyBudget(event.params.strategy, event);
  budget.budgetUSDGRaw = event.params.budgetAfter;
  budget.scaledRemainder = event.params.scaledRemainderAfter;
  budget.save();
}

export function handleStrategyDisabled(event: AllocationVoter__StrategyDisabled): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.enabled = false;
  strategy.generation = event.params.newGeneration;
  strategy.save();
  const budget = getStrategyBudget(event.params.strategy, event);
  budget.budgetUSDGRaw = BigInt.fromI32(0);
  budget.scaledRemainder = BigInt.fromI32(0);
  budget.returnedToIdleUSDGRaw = budget.returnedToIdleUSDGRaw.plus(event.params.budgetReturnedToIdle);
  budget.save();
}

export function handleStrategyReactivated(event: AllocationVoter__StrategyReactivated): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.enabled = true;
  strategy.generation = event.params.generation;
  strategy.save();
}

export function handleUserWeightUpdated(event: AllocationVoter__UserWeightUpdated): void {
  const account = getAccount(event.params.user, event);
  account.signalEventCount += 1;
  account.save();
  const signal = getSignalAccount(event.params.user, event);
  signal.save();
  const strategy = getStrategy(event.params.strategy, event);
  strategy.save();

  const id = allocationId(event.params.user, event.params.strategy);
  let allocation = SignalAllocation.load(id);
  if (allocation == null) {
    allocation = new SignalAllocation(id);
    allocation.account = signal.id;
    allocation.strategy = strategy.id;
  }
  allocation.recordedWeightRaw = event.params.newWeight;
  allocation.generation = strategy.generation;
  allocation.lastBlockNumber = event.block.number;
  allocation.lastTimestamp = event.block.timestamp;
  allocation.save();

  const daily = getDailyAccount(event.params.user, event);
  daily.signalEventCount += 1;
  daily.save();
}
