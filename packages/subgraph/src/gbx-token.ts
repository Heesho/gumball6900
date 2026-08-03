import { Burn } from '../generated/schema';
import { GBXToken__Burned, GBXToken__Minted } from '../generated/GBXToken/GBXToken';
import { getDailyAccount, getDailyProtocol, syncDailyProtocol } from './daily';
import { getAccount, getGBXToken, getProtocol } from './entities';
import { eventId } from './ids';

export function handleMinted(event: GBXToken__Minted): void {
  const token = getGBXToken(event.address, event);
  token.cumulativeMintedRaw = event.params.cumulativeMintedAfter;
  token.totalSupplyRaw = token.totalSupplyRaw.plus(event.params.amount);
  token.save();

  const account = getAccount(event.params.receiver, event);
  account.gbxMintedRaw = account.gbxMintedRaw.plus(event.params.amount);
  account.save();

  const protocol = getProtocol(event);
  protocol.gbxToken = token.id;
  protocol.cumulativeMintedRaw = event.params.cumulativeMintedAfter;
  protocol.totalSupplyRaw = protocol.totalSupplyRaw.plus(event.params.amount);
  protocol.save();

  const daily = getDailyProtocol(event);
  daily.mintedGBXRaw = daily.mintedGBXRaw.plus(event.params.amount);
  syncDailyProtocol(daily, protocol);
  daily.save();

  const accountDaily = getDailyAccount(event.params.receiver, event);
  accountDaily.gbxMintedRaw = accountDaily.gbxMintedRaw.plus(event.params.amount);
  accountDaily.save();
}

export function handleBurned(event: GBXToken__Burned): void {
  const token = getGBXToken(event.address, event);
  token.cumulativeBurnedRaw = event.params.cumulativeBurnedAfter;
  token.totalSupplyRaw = token.totalSupplyRaw.minus(event.params.amount);
  token.save();

  const operator = getAccount(event.params.operator, event);
  operator.save();
  const account = getAccount(event.params.account, event);
  account.gbxBurnedRaw = account.gbxBurnedRaw.plus(event.params.amount);
  account.save();

  const burn = new Burn(eventId(event));
  burn.operator = operator.id;
  burn.account = account.id;
  burn.amountGBXRaw = event.params.amount;
  burn.cumulativeBurnedAfterRaw = event.params.cumulativeBurnedAfter;
  burn.blockNumber = event.block.number;
  burn.timestamp = event.block.timestamp;
  burn.transactionHash = event.transaction.hash;
  burn.logIndex = event.logIndex;
  burn.save();

  const protocol = getProtocol(event);
  protocol.gbxToken = token.id;
  protocol.cumulativeBurnedRaw = event.params.cumulativeBurnedAfter;
  protocol.totalSupplyRaw = protocol.totalSupplyRaw.minus(event.params.amount);
  protocol.save();

  const daily = getDailyProtocol(event);
  daily.burnedGBXRaw = daily.burnedGBXRaw.plus(event.params.amount);
  syncDailyProtocol(daily, protocol);
  daily.save();

  const accountDaily = getDailyAccount(event.params.account, event);
  accountDaily.gbxBurnedRaw = accountDaily.gbxBurnedRaw.plus(event.params.amount);
  accountDaily.save();
}
