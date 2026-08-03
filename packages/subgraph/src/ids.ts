import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { CHAIN_ID_TEXT } from './constants';

export function eventId(event: ethereum.Event): string {
  return CHAIN_ID_TEXT + '-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
}

export function addressId(address: Address): string {
  return CHAIN_ID_TEXT + '-' + address.toHexString();
}

export function epochId(pool: Address, epoch: BigInt): string {
  return addressId(pool) + '-epoch-' + epoch.toString();
}

export function positionId(custodian: Address, position: BigInt): string {
  return addressId(custodian) + '-position-' + position.toString();
}
