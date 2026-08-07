import { Claimed, Contributed, EpochSettled } from '../generated/Fundraiser/Fundraiser';
import { getAccount, getFundraiserEpoch, getProtocol, recordEvent } from './entities';

export function handleContributed(event: Contributed): void {
  const protocol = getProtocol(event);
  protocol.fundraiserContributionsRaw = protocol.fundraiserContributionsRaw.plus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.beneficiary, event);
  account.contributedUSDGRaw = account.contributedUSDGRaw.plus(event.params.amount);
  account.save();

  const epoch = getFundraiserEpoch(event.address, event.params.epoch, event);
  epoch.totalContributionsRaw = epoch.totalContributionsRaw.plus(event.params.amount);
  epoch.save();

  const record = recordEvent(event, 'FUNDRAISER_CONTRIBUTED');
  record.addresses = [event.params.payer, event.params.beneficiary];
  record.values = [event.params.epoch, event.params.amount];
  record.save();
}

export function handleClaimed(event: Claimed): void {
  const protocol = getProtocol(event);
  protocol.fundraiserClaimsRaw = protocol.fundraiserClaimsRaw.plus(event.params.amount);
  protocol.save();

  const account = getAccount(event.params.account, event);
  account.claimedGBXRaw = account.claimedGBXRaw.plus(event.params.amount);
  account.save();

  const epoch = getFundraiserEpoch(event.address, event.params.epoch, event);
  epoch.totalClaimedGBXRaw = epoch.totalClaimedGBXRaw.plus(event.params.amount);
  epoch.save();

  const record = recordEvent(event, 'FUNDRAISER_CLAIMED');
  record.addresses = [event.params.account];
  record.values = [event.params.epoch, event.params.amount];
  record.save();
}

export function handleEpochSettled(event: EpochSettled): void {
  const epoch = getFundraiserEpoch(event.address, event.params.epoch, event);
  epoch.settled = true;
  epoch.scheduledEmissionRaw = event.params.scheduledEmission;
  epoch.contributorEmissionRaw = event.params.contributorEmission;
  epoch.save();

  const record = recordEvent(event, 'FUNDRAISER_EPOCH_SETTLED');
  record.values = [
    event.params.epoch,
    event.params.scheduledEmission,
    event.params.contributorEmission,
    event.params.nextScheduledEmission,
  ];
  record.save();
}
