import { Address, dataSource } from '@graphprotocol/graph-ts';
import {
  StrategyRewards__Claimed,
  StrategyRewards__RewardNotified,
  StrategyRewards__WeightSet,
} from '../generated/templates/StrategyRewardsTemplate/StrategyRewards';
import { getStrategy, recordEvent } from './entities';

function contextStrategy(): Address {
  return Address.fromBytes(dataSource.context().getBytes('strategy'));
}

export function handleRewardClaimed(event: StrategyRewards__Claimed): void {
  const strategy = getStrategy(contextStrategy(), event);
  strategy.totalRewardsClaimedRaw = strategy.totalRewardsClaimedRaw.plus(event.params.amount);
  strategy.save();

  const record = recordEvent(event, 'STRATEGY_REWARD_CLAIMED');
  record.addresses = [event.params.beneficiary, event.params.caller];
  record.values = [event.params.amount];
  record.save();
}

export function handleRewardNotified(event: StrategyRewards__RewardNotified): void {
  const strategy = getStrategy(contextStrategy(), event);
  strategy.totalRewardsNotifiedRaw = strategy.totalRewardsNotifiedRaw.plus(event.params.amount);
  strategy.save();

  const record = recordEvent(event, 'STRATEGY_REWARD_NOTIFIED');
  record.values = [event.params.amount, event.params.rewardPerWeightAfter];
  record.save();
}

export function handleRewardWeightSet(event: StrategyRewards__WeightSet): void {
  const record = recordEvent(event, 'STRATEGY_REWARD_WEIGHT_SET');
  record.addresses = [event.params.user];
  record.values = [event.params.previousWeight, event.params.newWeight];
  record.save();
}
