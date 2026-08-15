import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
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

export function governanceProposalId(governor: Address, proposalId: BigInt): string {
  return addressId(governor) + '-proposal-' + proposalId.toString();
}

export function timelockRoleMembershipId(timelock: Address, role: Bytes, account: Address): string {
  return addressId(timelock) + '-role-' + role.toHexString() + '-account-' + account.toHexString();
}
