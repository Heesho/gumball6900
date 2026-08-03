import { MiningClaim } from '../generated/schema';
import { ClaimsBase__Claimed } from '../generated/MiningClaims/MiningClaims';
import { getDailyAccount } from './daily';
import { getAccount } from './entities';
import { eventId } from './ids';

export function handleMiningClaimed(event: ClaimsBase__Claimed): void {
  const beneficiary = getAccount(event.params.beneficiary, event);
  beneficiary.miningClaimedGBXRaw = beneficiary.miningClaimedGBXRaw.plus(event.params.amount);
  beneficiary.save();
  const caller = getAccount(event.params.caller, event);
  caller.save();

  const claim = new MiningClaim(eventId(event));
  claim.distributionId = event.params.distributionId;
  claim.beneficiary = beneficiary.id;
  claim.caller = caller.id;
  claim.amountGBXRaw = event.params.amount;
  claim.blockNumber = event.block.number;
  claim.timestamp = event.block.timestamp;
  claim.transactionHash = event.transaction.hash;
  claim.logIndex = event.logIndex;
  claim.save();

  const daily = getDailyAccount(event.params.beneficiary, event);
  daily.miningClaimedGBXRaw = daily.miningClaimedGBXRaw.plus(event.params.amount);
  daily.save();
}
