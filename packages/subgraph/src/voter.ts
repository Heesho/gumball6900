import { BigInt } from '@graphprotocol/graph-ts';
import {
  BribeBpsSet,
  BribeRewardAdded,
  RevenueDistributed,
  RevenueNotified,
  StrategyAdded,
  StrategyKilled,
  VoteCast,
  VoteReset,
  VoterRouterSet,
} from '../generated/Voter/Voter';
import { getAccount, getProtocol, getStrategy, recordEvent } from './entities';

export function handleBribeBpsSet(event: BribeBpsSet): void {
  const protocol = getProtocol(event);
  protocol.bribeBps = event.params.newBps;
  protocol.save();

  const record = recordEvent(event, 'VOTER_BRIBE_BPS_SET');
  record.values = [event.params.previousBps, event.params.newBps];
  record.save();
}

export function handleBribeRewardAdded(event: BribeRewardAdded): void {
  const record = recordEvent(event, 'VOTER_BRIBE_REWARD_ADDED');
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

  const record = recordEvent(event, 'VOTER_REVENUE_DISTRIBUTED');
  record.addresses = [event.params.caller, event.params.strategy];
  record.values = [event.params.amount];
  record.save();
}

export function handleRevenueNotified(event: RevenueNotified): void {
  const protocol = getProtocol(event);
  protocol.notifiedRevenueRaw = protocol.notifiedRevenueRaw.plus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'VOTER_REVENUE_NOTIFIED');
  record.addresses = [event.params.voterRouter];
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
  strategy.kind = event.params.kind;
  strategy.live = true;
  strategy.save();

  const record = recordEvent(event, 'VOTER_STRATEGY_ADDED');
  record.addresses = [event.params.strategy, event.params.bribe, event.params.bribeRouter, event.params.paymentToken];
  record.values = [BigInt.fromI32(event.params.kind)];
  record.save();
}

export function handleStrategyKilled(event: StrategyKilled): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.live = false;
  strategy.save();

  const record = recordEvent(event, 'VOTER_STRATEGY_KILLED');
  record.addresses = [event.params.strategy];
  record.save();
}

export function handleVoteCast(event: VoteCast): void {
  const account = getAccount(event.params.account, event);
  account.votingWeightRaw = account.votingWeightRaw.plus(event.params.weight);
  account.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.totalWeightRaw = strategy.totalWeightRaw.plus(event.params.weight);
  strategy.save();

  const record = recordEvent(event, 'VOTER_VOTE_CAST');
  record.addresses = [event.params.account, event.params.strategy];
  record.values = [event.params.weight];
  record.save();
}

export function handleVoteReset(event: VoteReset): void {
  const account = getAccount(event.params.account, event);
  account.votingWeightRaw = account.votingWeightRaw.minus(event.params.weight);
  account.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.totalWeightRaw = strategy.totalWeightRaw.minus(event.params.weight);
  strategy.save();

  const record = recordEvent(event, 'VOTER_VOTE_RESET');
  record.addresses = [event.params.account, event.params.strategy];
  record.values = [event.params.weight];
  record.save();
}

export function handleVoterRouterSet(event: VoterRouterSet): void {
  const protocol = getProtocol(event);
  protocol.voterRouter = event.params.voterRouter;
  protocol.save();

  const record = recordEvent(event, 'VOTER_ROUTER_SET');
  record.addresses = [event.params.voterRouter];
  record.save();
}
