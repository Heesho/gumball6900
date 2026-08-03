import { StakedGBX__Staked, StakedGBX__Unstaked } from '../generated/StakedGBX/StakedGBX';
import { getDailyAccount, getDailyProtocol, syncDailyProtocol } from './daily';
import { getAccount, getProtocol, getSignalAccount } from './entities';

export function handleStaked(event: StakedGBX__Staked): void {
  const account = getAccount(event.params.user, event);
  account.stakedGBXRaw = account.stakedGBXRaw.plus(event.params.receivedAmount);
  account.save();

  const signal = getSignalAccount(event.params.user, event);
  signal.stakedGBXRaw = signal.stakedGBXRaw.plus(event.params.receivedAmount);
  signal.save();

  const protocol = getProtocol(event);
  protocol.stakedGBXRaw = protocol.stakedGBXRaw.plus(event.params.receivedAmount);
  protocol.save();

  const daily = getDailyProtocol(event);
  syncDailyProtocol(daily, protocol);
  daily.save();

  const accountDaily = getDailyAccount(event.params.user, event);
  accountDaily.stakedGBXRaw = accountDaily.stakedGBXRaw.plus(event.params.receivedAmount);
  accountDaily.save();
}

export function handleUnstaked(event: StakedGBX__Unstaked): void {
  const account = getAccount(event.params.user, event);
  account.stakedGBXRaw = account.stakedGBXRaw.minus(event.params.amount);
  account.save();

  const signal = getSignalAccount(event.params.user, event);
  signal.stakedGBXRaw = signal.stakedGBXRaw.minus(event.params.amount);
  signal.save();

  const protocol = getProtocol(event);
  protocol.stakedGBXRaw = protocol.stakedGBXRaw.minus(event.params.amount);
  protocol.save();

  const daily = getDailyProtocol(event);
  syncDailyProtocol(daily, protocol);
  daily.save();

  const accountDaily = getDailyAccount(event.params.user, event);
  accountDaily.unstakedGBXRaw = accountDaily.unstakedGBXRaw.plus(event.params.amount);
  accountDaily.save();
}
