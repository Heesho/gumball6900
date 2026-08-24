import { dataSource } from '@graphprotocol/graph-ts';
import { RewardRouted } from '../generated/templates/BribeRouterTemplate/BribeRouter';
import { Strategy } from '../generated/schema';
import { recordEvent } from './entities';

function strategy(): Strategy {
  const entity = Strategy.load(dataSource.context().getString('strategyId'));
  assert(entity != null, 'BribeRouter template has no Strategy context');
  return entity!;
}

export function handleRouterRewardRouted(event: RewardRouted): void {
  const entity = strategy();
  entity.routerRewardsRoutedRaw = entity.routerRewardsRoutedRaw.plus(event.params.amount);
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_ROUTER_REWARD_ROUTED');
  record.addresses = [event.params.bribe, event.params.rewardToken];
  record.values = [event.params.amount];
  record.save();
}
