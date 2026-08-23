import { dataSource } from '@graphprotocol/graph-ts';
import { RewardNotified, RewardPaid } from '../generated/templates/BribeTemplate/Bribe';
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
