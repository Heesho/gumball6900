import { Burned, Minted, MinterSet } from '../generated/GBX/GBX';
import { getAccount, getProtocol, recordEvent } from './entities';

export function handleMinted(event: Minted): void {
  const protocol = getProtocol(event);
  protocol.lifetimeMintedRaw = protocol.lifetimeMintedRaw.plus(event.params.amount);
  protocol.totalSupplyRaw = protocol.totalSupplyRaw.plus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.account, event);
  account.gbxMintedRaw = account.gbxMintedRaw.plus(event.params.amount);
  account.save();

  const record = recordEvent(event, 'GBX_MINTED');
  record.addresses = [event.params.account];
  record.values = [event.params.amount];
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

export function handleMinterSet(event: MinterSet): void {
  const protocol = getProtocol(event);
  protocol.minter = event.params.newMinter;
  protocol.save();

  const record = recordEvent(event, 'GBX_MINTER_SET');
  record.addresses = [event.params.previousMinter, event.params.newMinter];
  record.save();
}
