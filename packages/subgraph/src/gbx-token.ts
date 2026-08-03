import {
  GBXToken__Burned,
  GBXToken__EmissionControllerInitialized,
  GBXToken__EmissionControllerReplaced,
  GBXToken__Minted,
} from '../generated/GBXToken/GBXToken';
import { getAccount, getProtocol, recordEvent } from './entities';

export function handleControllerInitialized(event: GBXToken__EmissionControllerInitialized): void {
  const protocol = getProtocol(event);
  protocol.gbxToken = event.address;
  protocol.emissionController = event.params.controller;
  protocol.save();

  const record = recordEvent(event, 'GBX_EMISSION_CONTROLLER_INITIALIZED');
  record.addresses = [event.params.controller];
  record.save();
}

export function handleControllerReplaced(event: GBXToken__EmissionControllerReplaced): void {
  const protocol = getProtocol(event);
  protocol.gbxToken = event.address;
  protocol.emissionController = event.params.newController;
  protocol.save();

  const record = recordEvent(event, 'GBX_EMISSION_CONTROLLER_REPLACED');
  record.addresses = [event.params.previousController, event.params.newController];
  record.save();
}

export function handleMinted(event: GBXToken__Minted): void {
  const protocol = getProtocol(event);
  protocol.gbxToken = event.address;
  protocol.cumulativeMintedRaw = event.params.cumulativeMintedAfter;
  protocol.totalSupplyRaw = protocol.totalSupplyRaw.plus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.receiver, event);
  account.gbxMintedRaw = account.gbxMintedRaw.plus(event.params.amount);
  account.save();

  const record = recordEvent(event, 'GBX_MINTED');
  record.addresses = [event.params.receiver];
  record.values = [event.params.amount, event.params.cumulativeMintedAfter];
  record.save();
}

export function handleBurned(event: GBXToken__Burned): void {
  const protocol = getProtocol(event);
  protocol.gbxToken = event.address;
  protocol.cumulativeBurnedRaw = event.params.cumulativeBurnedAfter;
  protocol.totalSupplyRaw = protocol.totalSupplyRaw.minus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.account, event);
  account.gbxBurnedRaw = account.gbxBurnedRaw.plus(event.params.amount);
  account.save();

  const record = recordEvent(event, 'GBX_BURNED');
  record.addresses = [event.params.operator, event.params.account];
  record.values = [event.params.amount, event.params.cumulativeBurnedAfter];
  record.save();
}
