import { MiningContribution } from '../generated/schema';
import {
  MiningPool__Contribution,
  MiningPool__EpochExtended,
  MiningPool__EpochSettled,
} from '../generated/MiningPool/MiningPool';
import { getDailyAccount, getDailyProtocol, syncDailyProtocol } from './daily';
import { getAccount, getMiningEpoch, getProtocol } from './entities';
import { eventId } from './ids';

export function handleMiningContribution(event: MiningPool__Contribution): void {
  const epoch = getMiningEpoch(event.address, event.params.epochId, event);
  epoch.totalContributedUSDGRaw = event.params.epochTotalAfter;
  epoch.save();

  const payer = getAccount(event.params.payer, event);
  payer.save();
  const beneficiary = getAccount(event.params.beneficiary, event);
  beneficiary.miningContributedRaw = beneficiary.miningContributedRaw.plus(event.params.receivedAmount);
  beneficiary.save();

  const contribution = new MiningContribution(eventId(event));
  contribution.epoch = epoch.id;
  contribution.payer = payer.id;
  contribution.beneficiary = beneficiary.id;
  contribution.requestedUSDGRaw = event.params.requestedAmount;
  contribution.receivedUSDGRaw = event.params.receivedAmount;
  contribution.epochTotalAfterRaw = event.params.epochTotalAfter;
  contribution.blockNumber = event.block.number;
  contribution.timestamp = event.block.timestamp;
  contribution.transactionHash = event.transaction.hash;
  contribution.logIndex = event.logIndex;
  contribution.save();

  const protocol = getProtocol(event);
  protocol.miningPool = event.address;
  protocol.miningContributedRaw = protocol.miningContributedRaw.plus(event.params.receivedAmount);
  protocol.save();

  const daily = getDailyProtocol(event);
  daily.miningContributedUSDGRaw = daily.miningContributedUSDGRaw.plus(event.params.receivedAmount);
  syncDailyProtocol(daily, protocol);
  daily.save();

  const accountDaily = getDailyAccount(event.params.beneficiary, event);
  accountDaily.miningContributedUSDGRaw = accountDaily.miningContributedUSDGRaw.plus(event.params.receivedAmount);
  accountDaily.save();
}

export function handleEpochExtended(event: MiningPool__EpochExtended): void {
  const protocol = getProtocol(event);
  protocol.miningPool = event.address;
  protocol.save();
  const epoch = getMiningEpoch(event.address, event.params.epochId, event);
  epoch.endTime = event.params.newEndTime;
  epoch.extensionUsed = event.params.extensionUsed;
  epoch.save();
}

export function handleEpochSettled(event: MiningPool__EpochSettled): void {
  const protocol = getProtocol(event);
  protocol.miningPool = event.address;
  protocol.save();
  const epoch = getMiningEpoch(event.address, event.params.epochId, event);
  epoch.totalContributedUSDGRaw = event.params.totalContributed;
  epoch.settled = true;
  epoch.scheduledEmissionGBXRaw = event.params.scheduledEmission;
  epoch.actualEmissionGBXRaw = event.params.actualEmission;
  epoch.clearingPrice = event.params.clearingPrice;
  epoch.nextReferencePrice = event.params.nextReferencePrice;
  epoch.save();
}
