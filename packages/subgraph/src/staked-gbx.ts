import { StakedGBX__Staked, StakedGBX__Unstaked } from '../generated/StakedGBX/StakedGBX';
import { getAccount, getProtocol, recordEvent } from './entities';

export function handleStaked(event: StakedGBX__Staked): void {
  const account = getAccount(event.params.user, event);
  account.stakedGBXRaw = account.stakedGBXRaw.plus(event.params.amount);
  account.save();

  const protocol = getProtocol(event);
  protocol.stakedGBXRaw = protocol.stakedGBXRaw.plus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'GBX_STAKED');
  record.addresses = [event.params.user];
  record.values = [event.params.amount];
  record.save();
}

export function handleUnstaked(event: StakedGBX__Unstaked): void {
  const account = getAccount(event.params.user, event);
  account.stakedGBXRaw = account.stakedGBXRaw.minus(event.params.amount);
  account.save();

  const protocol = getProtocol(event);
  protocol.stakedGBXRaw = protocol.stakedGBXRaw.minus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'GBX_UNSTAKED');
  record.addresses = [event.params.user];
  record.values = [event.params.amount];
  record.save();
}
