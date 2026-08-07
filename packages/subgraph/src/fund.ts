import { GBXBurned, Redeemed, SuccessorSet, TokenMigrated } from '../generated/Fund/Fund';
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

export function handleSuccessorSet(event: SuccessorSet): void {
  const protocol = getProtocol(event);
  protocol.fundSuccessor = event.params.successor;
  protocol.save();

  const record = recordEvent(event, 'FUND_SUCCESSOR_SET');
  record.addresses = [event.params.successor];
  record.save();
}

export function handleTokenMigrated(event: TokenMigrated): void {
  const record = recordEvent(event, 'FUND_TOKEN_MIGRATED');
  record.addresses = [event.params.caller, event.params.token, event.params.successor];
  record.values = [event.params.amount];
  record.save();
}
