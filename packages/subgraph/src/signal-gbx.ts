import {
  DelegateChanged,
  DelegateVotesChanged,
  Staked,
  Unstaked,
  ResonanceSet,
} from '../generated/SignalGBX/SignalGBX';
import { getAccount, getProtocol, recordEvent } from './entities';

export function handleDelegateChanged(event: DelegateChanged): void {
  const account = getAccount(event.params.delegator, event);
  account.currentDelegate = event.params.toDelegate;
  account.save();

  const record = recordEvent(event, 'SIGNAL_GBX_DELEGATE_CHANGED');
  record.addresses = [event.params.delegator, event.params.fromDelegate, event.params.toDelegate];
  record.save();
}

export function handleDelegateVotesChanged(event: DelegateVotesChanged): void {
  const account = getAccount(event.params.delegate, event);
  account.delegatedVotesRaw = event.params.newVotes;
  account.save();

  const record = recordEvent(event, 'SIGNAL_GBX_DELEGATE_VOTES_CHANGED');
  record.addresses = [event.params.delegate];
  record.values = [event.params.previousVotes, event.params.newVotes];
  record.save();
}

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

export function handleSignalResonanceSet(event: ResonanceSet): void {
  const protocol = getProtocol(event);
  protocol.resonance = event.params.resonance;
  protocol.save();

  const record = recordEvent(event, 'SIGNAL_GBX_RESONANCE_SET');
  record.addresses = [event.params.resonance];
  record.save();
}
