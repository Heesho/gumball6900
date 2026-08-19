import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { CHAIN_ID_TEXT } from './constants';

export function eventId(event: ethereum.Event): string {
  return CHAIN_ID_TEXT + '-' + event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
}

export function addressId(address: Address): string {
  return CHAIN_ID_TEXT + '-' + address.toHexString();
}

export function slotId(mine: Address, index: BigInt): string {
  return addressId(mine) + '-slot-' + index.toString();
}
