import {
  MiningPool__Contribution,
  MiningPool__ContributionsPauseSet,
  MiningPool__EpochSettled,
  MiningPool__MiningStarted,
  MiningPool__TeamAddressSet,
} from '../generated/MiningPool/MiningPool';
import { getAccount, getMiningEpoch, getProtocol, recordEvent } from './entities';

export function handleMiningStarted(event: MiningPool__MiningStarted): void {
  const epoch = getMiningEpoch(event.address, event.params.epochId, event);
  epoch.startTime = event.params.startTime;
  epoch.endTime = event.params.endTime;
  epoch.save();

  const protocol = getProtocol(event);
  protocol.miningPool = event.address;
  protocol.save();

  const record = recordEvent(event, 'MINING_STARTED');
  record.values = [event.params.epochId, event.params.startTime, event.params.endTime];
  record.save();
}

export function handleMiningContribution(event: MiningPool__Contribution): void {
  const epoch = getMiningEpoch(event.address, event.params.epochId, event);
  epoch.totalContributedUSDGRaw = event.params.epochTotalAfter;
  epoch.save();

  const protocol = getProtocol(event);
  protocol.miningContributedUSDGRaw = protocol.miningContributedUSDGRaw.plus(event.params.receivedAmount);
  protocol.save();

  const beneficiary = getAccount(event.params.beneficiary, event);
  beneficiary.miningContributedUSDGRaw = beneficiary.miningContributedUSDGRaw.plus(event.params.receivedAmount);
  beneficiary.save();

  const record = recordEvent(event, 'MINING_CONTRIBUTION');
  record.addresses = [event.params.payer, event.params.beneficiary];
  record.values = [
    event.params.epochId,
    event.params.requestedAmount,
    event.params.receivedAmount,
    event.params.epochTotalAfter,
  ];
  record.save();
}

export function handleMiningEpochSettled(event: MiningPool__EpochSettled): void {
  const epoch = getMiningEpoch(event.address, event.params.epochId, event);
  epoch.totalContributedUSDGRaw = event.params.totalContributed;
  epoch.teamFeeUSDGRaw = event.params.teamFee;
  epoch.vaultRevenueUSDGRaw = event.params.vaultRevenue;
  epoch.emissionGBXRaw = event.params.emission;
  epoch.nonEmpty = !event.params.totalContributed.isZero();
  epoch.settled = true;
  epoch.save();

  const record = recordEvent(event, 'MINING_EPOCH_SETTLED');
  record.values = [
    event.params.epochId,
    event.params.totalContributed,
    event.params.teamFee,
    event.params.vaultRevenue,
    event.params.emission,
  ];
  record.save();
}

export function handleContributionPauseSet(event: MiningPool__ContributionsPauseSet): void {
  const record = recordEvent(event, 'MINING_CONTRIBUTIONS_PAUSE_SET');
  record.flag = event.params.paused;
  record.save();
}

export function handleTeamAddressSet(event: MiningPool__TeamAddressSet): void {
  const record = recordEvent(event, 'MINING_TEAM_ADDRESS_SET');
  record.addresses = [event.params.previousTeam, event.params.newTeam];
  record.save();
}
