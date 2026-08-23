import { dataSource } from '@graphprotocol/graph-ts';
import { RewardsDistributed } from '../generated/templates/BribeRouterTemplate/BribeRouter';
import { Strategy } from '../generated/schema';
import { recordEvent } from './entities';

function strategy(): Strategy {
  const entity = Strategy.load(dataSource.context().getString('strategyId'));
  assert(entity != null, 'BribeRouter template has no Strategy context');
  return entity!;
}

export function handleRouterRewardsDistributed(event: RewardsDistributed): void {
  const entity = strategy();
  entity.routerRewardsDistributedRaw = entity.routerRewardsDistributedRaw.plus(event.params.amount);
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_ROUTER_REWARDS_DISTRIBUTED');
  record.addresses = [event.params.bribe, event.params.rewardToken];
  record.values = [event.params.amount];
  record.save();
}
