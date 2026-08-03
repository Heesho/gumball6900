import { BigInt, dataSource, ethereum } from '@graphprotocol/graph-ts';
import {
  ManagerRewards__Claimed,
  ManagerRewards__Notified,
  ManagerRewards__RedirectedToVault,
  ManagerRewards__TerminalDustQueued,
  ManagerRewards__TerminalDustSettled,
} from '../generated/templates/ManagerRewards/ManagerRewards';
import {
  ManagerRewardClaim,
  ManagerRewardNotification,
  ManagerRewardTerminalDust,
  Strategy,
  VaultAsset,
} from '../generated/schema';
import { CHAIN_ID_TEXT, ZERO } from './constants';
import { getDailyAccount } from './daily';
import { getAccount } from './entities';
import { eventId } from './ids';
import { applyVaultDelta } from './vault-accounting';

export function handleManagerRewardNotified(event: ManagerRewards__Notified): void {
  const context = dataSource.context();
  const strategyId = context.getString('strategyId');
  const assetId = context.getString('assetId');
  const notification = new ManagerRewardNotification(eventId(event));
  notification.rewardsContract = event.address;
  notification.strategy = strategyId;
  notification.rewardAsset = assetId;
  notification.amountRaw = event.params.amount;
  notification.strategyWeightRaw = event.params.strategyWeight;
  notification.rewardPerWeightDelta = event.params.rewardPerWeightDelta;
  notification.remainder = event.params.remainder;
  notification.redirectedToVault = false;
  notification.blockNumber = event.block.number;
  notification.timestamp = event.block.timestamp;
  notification.transactionHash = event.transaction.hash;
  notification.logIndex = event.logIndex;
  notification.save();
}

export function handleManagerRewardRedirectedToVault(event: ManagerRewards__RedirectedToVault): void {
  indexVaultRedirect(event, event.params.amount, 'MANAGER_ZERO_WEIGHT_REDIRECT');
}

function terminalDustId(event: ethereum.Event, generation: BigInt, remainderCycle: BigInt): string {
  return (
    CHAIN_ID_TEXT + '-' + event.address.toHexString() + '-' + generation.toString() + '-' + remainderCycle.toString()
  );
}

export function handleManagerRewardTerminalDustQueued(event: ManagerRewards__TerminalDustQueued): void {
  const context = dataSource.context();
  const strategyId = context.getString('strategyId');
  const assetId = context.getString('assetId');
  const dust = new ManagerRewardTerminalDust(
    terminalDustId(event, event.params.generation, event.params.remainderCycle),
  );
  dust.rewardsContract = event.address;
  dust.strategy = strategyId;
  dust.rewardAsset = assetId;
  dust.generation = event.params.generation;
  dust.remainderCycle = event.params.remainderCycle;
  dust.amountRaw = event.params.amount;
  // A zero-amount terminal cycle has no onchain sweep path. Index it as already
  // settled so consumers never surface an impossible keeper action.
  dust.settled = event.params.amount.equals(ZERO);
  dust.queuedBlockNumber = event.block.number;
  dust.queuedTimestamp = event.block.timestamp;
  dust.queuedTransactionHash = event.transaction.hash;
  dust.queuedLogIndex = event.logIndex;
  dust.save();

  const strategy = Strategy.load(strategyId);
  if (strategy != null) {
    strategy.pendingManagerRewardDustRaw = event.params.totalPendingAfter;
    strategy.lastBlockNumber = event.block.number;
    strategy.lastTimestamp = event.block.timestamp;
    strategy.save();
  }
}

export function handleManagerRewardTerminalDustSettled(event: ManagerRewards__TerminalDustSettled): void {
  const context = dataSource.context();
  const strategyId = context.getString('strategyId');
  const dust = ManagerRewardTerminalDust.load(
    terminalDustId(event, event.params.generation, event.params.remainderCycle),
  );
  if (dust != null) {
    dust.settled = true;
    dust.settledBlockNumber = event.block.number;
    dust.settledTimestamp = event.block.timestamp;
    dust.settledTransactionHash = event.transaction.hash;
    dust.settledLogIndex = event.logIndex;
    dust.save();
  }
  const strategy = Strategy.load(strategyId);
  if (strategy != null) {
    strategy.pendingManagerRewardDustRaw = strategy.pendingManagerRewardDustRaw.minus(event.params.amount);
    strategy.lastBlockNumber = event.block.number;
    strategy.lastTimestamp = event.block.timestamp;
    strategy.save();
  }
  indexVaultRedirect(event, event.params.amount, 'MANAGER_TERMINAL_DUST');
}

function indexVaultRedirect(event: ethereum.Event, amount: BigInt, reason: string): void {
  const context = dataSource.context();
  const strategyId = context.getString('strategyId');
  const assetId = context.getString('assetId');
  const notification = new ManagerRewardNotification(eventId(event));
  notification.rewardsContract = event.address;
  notification.strategy = strategyId;
  notification.rewardAsset = assetId;
  notification.amountRaw = amount;
  notification.strategyWeightRaw = ZERO;
  notification.rewardPerWeightDelta = ZERO;
  notification.remainder = ZERO;
  notification.redirectedToVault = true;
  notification.blockNumber = event.block.number;
  notification.timestamp = event.block.timestamp;
  notification.transactionHash = event.transaction.hash;
  notification.logIndex = event.logIndex;
  notification.save();

  const asset = VaultAsset.load(assetId);
  if (asset == null || amount.equals(ZERO)) return;
  asset.acquiredByStrategiesRaw = asset.acquiredByStrategiesRaw.plus(amount);
  applyVaultDelta(asset, amount, reason, event);
}

export function handleManagerRewardClaimed(event: ManagerRewards__Claimed): void {
  const context = dataSource.context();
  const strategyId = context.getString('strategyId');
  const assetId = context.getString('assetId');
  const user = getAccount(event.params.user, event);
  user.managerRewardClaimCount += 1;
  user.save();
  const receiver = getAccount(event.params.receiver, event);
  receiver.save();

  const claim = new ManagerRewardClaim(eventId(event));
  claim.rewardsContract = event.address;
  claim.strategy = strategyId;
  claim.rewardAsset = assetId;
  claim.user = user.id;
  claim.receiver = receiver.id;
  claim.amountRaw = event.params.amount;
  claim.blockNumber = event.block.number;
  claim.timestamp = event.block.timestamp;
  claim.transactionHash = event.transaction.hash;
  claim.logIndex = event.logIndex;
  claim.save();

  const daily = getDailyAccount(event.params.user, event);
  daily.managerRewardClaimCount += 1;
  daily.save();
}
