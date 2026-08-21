import { dataSource } from '@graphprotocol/graph-ts';
import {
  BribePaymentAccrued,
  BribeRewardNotified,
  FundPaymentAccrued,
  FundPaymentPaid,
  PaymentRouted,
} from '../generated/templates/BribeRouterTemplate/BribeRouter';
import { Strategy } from '../generated/schema';
import { recordEvent } from './entities';

function strategy(): Strategy {
  const entity = Strategy.load(dataSource.context().getString('strategyId'));
  assert(entity != null, 'BribeRouter template has no Strategy context');
  return entity!;
}

export function handleRouterPaymentRouted(event: PaymentRouted): void {
  const entity = strategy();
  entity.routerPaymentRoutedRaw = entity.routerPaymentRoutedRaw.plus(event.params.amount);
  entity.latestRouterPaymentBribeBps = event.params.bribeBps;
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_ROUTER_PAYMENT_ROUTED');
  record.addresses = [event.params.strategy];
  record.values = [event.params.amount, event.params.bribeBps];
  record.save();
}

export function handleRouterFundPaymentAccrued(event: FundPaymentAccrued): void {
  const entity = strategy();
  entity.routerFundPaymentAccruedRaw = entity.routerFundPaymentAccruedRaw.plus(event.params.amount);
  entity.pendingRouterFundPaymentRaw = event.params.totalLiability;
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_ROUTER_FUND_PAYMENT_ACCRUED');
  record.addresses = [event.params.fund, event.params.paymentToken];
  record.values = [event.params.amount, event.params.totalLiability];
  record.save();
}

export function handleRouterFundPaymentPaid(event: FundPaymentPaid): void {
  const entity = strategy();
  entity.routerFundPaymentPaidRaw = entity.routerFundPaymentPaidRaw.plus(event.params.amount);
  entity.pendingRouterFundPaymentRaw = entity.pendingRouterFundPaymentRaw.minus(event.params.amount);
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_ROUTER_FUND_PAYMENT_PAID');
  record.addresses = [event.params.caller, event.params.fund, event.params.paymentToken];
  record.values = [event.params.amount];
  record.save();
}

export function handleRouterBribePaymentAccrued(event: BribePaymentAccrued): void {
  const entity = strategy();
  entity.routerBribePaymentAccruedRaw = entity.routerBribePaymentAccruedRaw.plus(event.params.amount);
  entity.pendingRouterBribePaymentRaw = event.params.totalLiability;
  entity.routerSplitRemainderRaw = event.params.remainder;
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_ROUTER_BRIBE_PAYMENT_ACCRUED');
  record.addresses = [event.params.bribe, event.params.paymentToken];
  record.values = [event.params.amount, event.params.totalLiability, event.params.remainder];
  record.save();
}

export function handleRouterBribeRewardNotified(event: BribeRewardNotified): void {
  const entity = strategy();
  entity.routerBribePaymentNotifiedRaw = entity.routerBribePaymentNotifiedRaw.plus(event.params.amount);
  entity.pendingRouterBribePaymentRaw = entity.pendingRouterBribePaymentRaw.minus(event.params.amount);
  entity.lastBlockNumber = event.block.number;
  entity.lastTimestamp = event.block.timestamp;
  entity.save();

  const record = recordEvent(event, 'BRIBE_ROUTER_BRIBE_REWARD_NOTIFIED');
  record.addresses = [event.params.caller, event.params.bribe, event.params.paymentToken];
  record.values = [event.params.amount];
  record.save();
}
