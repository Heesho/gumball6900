import { GenesisContribution } from '../generated/schema';
import {
  GenesisBootstrap__CommunityContribution,
  GenesisBootstrap__ContributionsOpened,
  GenesisBootstrap__LaunchSettled,
} from '../generated/GenesisBootstrap/GenesisBootstrap';
import { getDailyAccount, getDailyProtocol, syncDailyProtocol } from './daily';
import { getAccount, getGenesisBootstrap, getProtocol } from './entities';
import { eventId } from './ids';

export function handleCommunityContribution(event: GenesisBootstrap__CommunityContribution): void {
  const bootstrap = getGenesisBootstrap(event.address, event);
  bootstrap.communityUSDGRaw = event.params.communityUSDGAfter;
  bootstrap.save();

  const payer = getAccount(event.params.payer, event);
  payer.save();
  const beneficiary = getAccount(event.params.beneficiary, event);
  beneficiary.genesisContributedRaw = beneficiary.genesisContributedRaw.plus(event.params.receivedAmount);
  beneficiary.save();

  const contribution = new GenesisContribution(eventId(event));
  contribution.bootstrap = bootstrap.id;
  contribution.payer = payer.id;
  contribution.beneficiary = beneficiary.id;
  contribution.requestedUSDGRaw = event.params.requestedAmount;
  contribution.receivedUSDGRaw = event.params.receivedAmount;
  contribution.communityUSDGAfterRaw = event.params.communityUSDGAfter;
  contribution.blockNumber = event.block.number;
  contribution.timestamp = event.block.timestamp;
  contribution.transactionHash = event.transaction.hash;
  contribution.logIndex = event.logIndex;
  contribution.save();

  const protocol = getProtocol(event);
  protocol.genesisBootstrap = bootstrap.id;
  protocol.genesisContributedRaw = protocol.genesisContributedRaw.plus(event.params.receivedAmount);
  protocol.save();

  const daily = getDailyProtocol(event);
  daily.genesisContributedUSDGRaw = daily.genesisContributedUSDGRaw.plus(event.params.receivedAmount);
  syncDailyProtocol(daily, protocol);
  daily.save();

  const accountDaily = getDailyAccount(event.params.beneficiary, event);
  accountDaily.genesisContributedUSDGRaw = accountDaily.genesisContributedUSDGRaw.plus(event.params.receivedAmount);
  accountDaily.save();
}

export function handleContributionsOpened(event: GenesisBootstrap__ContributionsOpened): void {
  const bootstrap = getGenesisBootstrap(event.address, event);
  bootstrap.contributionStart = event.params.startTime;
  bootstrap.contributionEnd = event.params.endTime;
  bootstrap.save();

  const protocol = getProtocol(event);
  protocol.genesisBootstrap = bootstrap.id;
  protocol.save();
}

export function handleLaunchSettled(event: GenesisBootstrap__LaunchSettled): void {
  const bootstrap = getGenesisBootstrap(event.address, event);
  bootstrap.settled = true;
  bootstrap.communityUSDGRaw = event.params.communityUSDG;
  bootstrap.sponsorUSDGRaw = event.params.sponsorUSDG;
  bootstrap.vaultUSDGRaw = event.params.vaultUSDG;
  bootstrap.sponsorRefundUSDGRaw = event.params.sponsorRefund;
  bootstrap.genesisPriceWad = event.params.genesisPriceWad;
  bootstrap.sqrtPriceX96 = event.params.sqrtPriceX96;
  bootstrap.save();

  const protocol = getProtocol(event);
  protocol.genesisBootstrap = bootstrap.id;
  protocol.save();
}
