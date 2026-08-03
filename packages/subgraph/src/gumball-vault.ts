import { BigInt } from '@graphprotocol/graph-ts';
import { GumBallVault__Redeemed, GumBallVault__USDGReleased } from '../generated/GumBallVault/GumBallVault';
import { getAccount, getProtocol, getStrategy, recordEvent } from './entities';

export function handleRedeemed(event: GumBallVault__Redeemed): void {
  const protocol = getProtocol(event);
  protocol.redeemedGBXRaw = protocol.redeemedGBXRaw.plus(event.params.shares);
  protocol.save();

  const account = getAccount(event.params.owner, event);
  account.redeemedGBXRaw = account.redeemedGBXRaw.plus(event.params.shares);
  account.save();

  const values = new Array<BigInt>();
  values.push(event.params.shares);
  values.push(event.params.supplyBefore);
  for (let index = 0; index < event.params.amounts.length; index++) values.push(event.params.amounts[index]);
  const record = recordEvent(event, 'VAULT_REDEEMED');
  record.addresses = [event.params.owner, event.params.receiver];
  record.values = values;
  record.save();
}

export function handleUSDGReleased(event: GumBallVault__USDGReleased): void {
  const protocol = getProtocol(event);
  protocol.strategySpentUSDGRaw = protocol.strategySpentUSDGRaw.plus(event.params.amount);
  protocol.save();

  const strategy = getStrategy(event.params.strategy, event);
  strategy.totalUSDGSpentRaw = strategy.totalUSDGSpentRaw.plus(event.params.amount);
  strategy.save();

  const record = recordEvent(event, 'VAULT_USDG_RELEASED');
  record.addresses = [event.params.strategy, event.params.receiver];
  record.values = [event.params.amount];
  record.save();
}
