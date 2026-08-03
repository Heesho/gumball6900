import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { CHAIN_ID_TEXT, SECONDS_PER_DAY } from './constants';

export function eventId(event: ethereum.Event): string {
  return CHAIN_ID_TEXT + '-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
}

export function addressId(address: Address): string {
  return CHAIN_ID_TEXT + '-' + address.toHexString();
}

export function epochId(pool: Address, epoch: BigInt): string {
  return addressId(pool) + '-epoch-' + epoch.toString();
}

export function allocationId(account: Address, strategy: Address): string {
  return addressId(account) + '-strategy-' + strategy.toHexString();
}

export function positionId(manager: Address, position: BigInt): string {
  return addressId(manager) + '-position-' + position.toString();
}

export function dayStart(timestamp: BigInt): BigInt {
  const day = BigInt.fromI32(SECONDS_PER_DAY);
  return timestamp.div(day).times(day);
}

export function protocolDayId(timestamp: BigInt): string {
  return CHAIN_ID_TEXT + '-day-' + dayStart(timestamp).toString();
}

export function accountDayId(account: Address, timestamp: BigInt): string {
  return addressId(account) + '-day-' + dayStart(timestamp).toString();
}
