import { Protocol, GenesisBootstrap, GenesisClaim } from '../generated/schema';
import { ClaimsBase__Claimed } from '../generated/GenesisClaims/GenesisClaims';
import { CHAIN_ID_TEXT } from './constants';
import { getDailyAccount } from './daily';
import { getAccount } from './entities';
import { eventId } from './ids';

export function handleGenesisClaimed(event: ClaimsBase__Claimed): void {
  const beneficiary = getAccount(event.params.beneficiary, event);
  beneficiary.genesisClaimedGBXRaw = beneficiary.genesisClaimedGBXRaw.plus(event.params.amount);
  beneficiary.save();
  const caller = getAccount(event.params.caller, event);
  caller.save();

  const claim = new GenesisClaim(eventId(event));
  claim.distributionId = event.params.distributionId;
  claim.beneficiary = beneficiary.id;
  claim.caller = caller.id;
  claim.amountGBXRaw = event.params.amount;
  claim.blockNumber = event.block.number;
  claim.timestamp = event.block.timestamp;
  claim.transactionHash = event.transaction.hash;
  claim.logIndex = event.logIndex;

  const protocol = Protocol.load(CHAIN_ID_TEXT);
  if (protocol != null && protocol.genesisBootstrap != null) {
    claim.bootstrap = protocol.genesisBootstrap;
    const bootstrap = GenesisBootstrap.load(protocol.genesisBootstrap!);
    if (bootstrap != null) {
      bootstrap.claimedGBXRaw = bootstrap.claimedGBXRaw.plus(event.params.amount);
      bootstrap.lastBlockNumber = event.block.number;
      bootstrap.lastTimestamp = event.block.timestamp;
      bootstrap.save();
    }
  }
  claim.save();

  const daily = getDailyAccount(event.params.beneficiary, event);
  daily.genesisClaimedGBXRaw = daily.genesisClaimedGBXRaw.plus(event.params.amount);
  daily.save();
}
