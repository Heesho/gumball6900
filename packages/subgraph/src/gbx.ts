import { BigInt } from '@graphprotocol/graph-ts';
import { Burned, Minted, MinterSet } from '../generated/GBX/GBX';
import { getAccount, getProtocol, recordEvent } from './entities';

/** Records both the genesis allocation and later Mine issuance from GBX's canonical mint event. */
export function handleMinted(event: Minted): void {
  const protocol = getProtocol(event);
  const isGenesis = protocol.lifetimeMintedRaw.equals(BigInt.zero());
  if (isGenesis) protocol.initialSupplyRaw = protocol.initialSupplyRaw.plus(event.params.amount);
  protocol.lifetimeMintedRaw = protocol.lifetimeMintedRaw.plus(event.params.amount);
  protocol.totalSupplyRaw = protocol.totalSupplyRaw.plus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.account, event);
  if (isGenesis) account.gbxInitialAllocationRaw = account.gbxInitialAllocationRaw.plus(event.params.amount);
  account.save();

  const record = recordEvent(event, isGenesis ? 'GBX_INITIAL_ALLOCATION' : 'GBX_MINTED');
  record.addresses = [event.params.account];
  record.values = [event.params.amount];
  record.save();
}

export function handleMinterSet(event: MinterSet): void {
  const record = recordEvent(event, 'GBX_MINTER_SET');
  record.addresses = [event.params.previousMinter, event.params.newMinter];
  record.save();
}

export function handleBurned(event: Burned): void {
  const protocol = getProtocol(event);
  protocol.lifetimeBurnedRaw = protocol.lifetimeBurnedRaw.plus(event.params.amount);
  protocol.totalSupplyRaw = protocol.totalSupplyRaw.minus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.account, event);
  account.gbxBurnedRaw = account.gbxBurnedRaw.plus(event.params.amount);
  account.save();

  const record = recordEvent(event, 'GBX_BURNED');
  record.addresses = [event.params.account];
  record.values = [event.params.amount];
  record.save();
}
