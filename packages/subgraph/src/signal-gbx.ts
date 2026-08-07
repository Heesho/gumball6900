import { Staked, Unstaked, VoterSet } from '../generated/SignalGBX/SignalGBX';
import { getAccount, getProtocol, recordEvent } from './entities';

export function handleStaked(event: Staked): void {
  const protocol = getProtocol(event);
  protocol.stakedGBXRaw = protocol.stakedGBXRaw.plus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.account, event);
  account.stakedGBXRaw = account.stakedGBXRaw.plus(event.params.amount);
  account.save();

  const record = recordEvent(event, 'SIGNAL_GBX_STAKED');
  record.addresses = [event.params.account];
  record.values = [event.params.amount];
  record.save();
}

export function handleUnstaked(event: Unstaked): void {
  const protocol = getProtocol(event);
  protocol.stakedGBXRaw = protocol.stakedGBXRaw.minus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.account, event);
  account.stakedGBXRaw = account.stakedGBXRaw.minus(event.params.amount);
  account.save();

  const record = recordEvent(event, 'SIGNAL_GBX_UNSTAKED');
  record.addresses = [event.params.account];
  record.values = [event.params.amount];
  record.save();
}

export function handleSignalVoterSet(event: VoterSet): void {
  const protocol = getProtocol(event);
  protocol.signalVoter = event.params.voter;
  protocol.save();

  const record = recordEvent(event, 'SIGNAL_GBX_VOTER_SET');
  record.addresses = [event.params.voter];
  record.save();
}
