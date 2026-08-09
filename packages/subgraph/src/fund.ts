import { GBXBurned, Redeemed } from '../generated/Fund/Fund';
import { getAccount, getProtocol, recordEvent } from './entities';

export function handleFundGBXBurned(event: GBXBurned): void {
  const protocol = getProtocol(event);
  protocol.fundBurnedGBXRaw = protocol.fundBurnedGBXRaw.plus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'FUND_GBX_BURNED');
  record.addresses = [event.params.caller];
  record.values = [event.params.amount];
  record.save();
}

export function handleRedeemed(event: Redeemed): void {
  const protocol = getProtocol(event);
  protocol.redeemedGBXRaw = protocol.redeemedGBXRaw.plus(event.params.gbxAmount);
  protocol.save();

  const account = getAccount(event.params.account, event);
  account.redeemedGBXRaw = account.redeemedGBXRaw.plus(event.params.gbxAmount);
  account.save();

  const record = recordEvent(event, 'FUND_REDEEMED');
  record.addresses = [event.params.account, event.params.receiver];
  record.values = [event.params.gbxAmount, event.params.tokenCount];
  record.save();
}
