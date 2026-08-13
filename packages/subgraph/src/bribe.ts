import { dataSource } from '@graphprotocol/graph-ts';
import {
  FundRewardAccrued,
  FundRewardPaid,
  RewardCarryFunded,
  RewardNotified,
  RewardPaid,
} from '../generated/templates/BribeTemplate/Bribe';
import { Strategy } from '../generated/schema';
import { recordEvent } from './entities';

function strategy(): Strategy {
  const entity = Strategy.load(dataSource.context().getString('strategyId'));
  assert(entity != null, 'Bribe template has no Strategy context');
  return entity!;
}

export function handleRewardNotified(event: RewardNotified): void {
  const entity = strategy();
  entity.notifiedRewardRaw = entity.notifiedRewardRaw.plus(event.params.amount);
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_REWARD_NOTIFIED');
  record.addresses = [event.params.rewardToken];
  record.values = [event.params.amount];
  record.save();
}

export function handleRewardPaid(event: RewardPaid): void {
  const entity = strategy();
  entity.paidRewardRaw = entity.paidRewardRaw.plus(event.params.amount);
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_REWARD_PAID');
  record.addresses = [event.params.account, event.params.rewardToken];
  record.values = [event.params.amount];
  record.save();
}

export function handleRewardCarryFunded(event: RewardCarryFunded): void {
  const record = recordEvent(event, 'BRIBE_REWARD_CARRY_FUNDED');
  record.addresses = [event.params.rewardToken];
  record.values = [event.params.amountScaled, event.params.remainderScaled];
  record.save();
}

export function handleBribeFundRewardAccrued(event: FundRewardAccrued): void {
  const entity = strategy();
  entity.bribeFundRewardAccruedRaw = entity.bribeFundRewardAccruedRaw.plus(event.params.amount);
  entity.pendingBribeFundRewardRaw = event.params.totalLiability;
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_FUND_REWARD_ACCRUED');
  record.addresses = [event.params.rewardToken];
  record.values = [event.params.amount, event.params.totalLiability];
  record.save();
}

export function handleBribeFundRewardPaid(event: FundRewardPaid): void {
  const entity = strategy();
  entity.bribeFundRewardPaidRaw = entity.bribeFundRewardPaidRaw.plus(event.params.amount);
  entity.pendingBribeFundRewardRaw = entity.pendingBribeFundRewardRaw.minus(event.params.amount);
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_FUND_REWARD_PAID');
  record.addresses = [event.params.caller, event.params.fund, event.params.rewardToken];
  record.values = [event.params.amount];
  record.save();
}
