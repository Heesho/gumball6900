import { MiningClaims__Claimed, MiningClaims__SourceInitialized } from '../generated/MiningClaims/MiningClaims';
import { getAccount, recordEvent } from './entities';

export function handleClaimsSourceInitialized(event: MiningClaims__SourceInitialized): void {
  const record = recordEvent(event, 'MINING_CLAIMS_SOURCE_INITIALIZED');
  record.addresses = [event.params.source];
  record.save();
}

export function handleMiningClaimed(event: MiningClaims__Claimed): void {
  const account = getAccount(event.params.beneficiary, event);
  account.miningClaimedGBXRaw = account.miningClaimedGBXRaw.plus(event.params.amount);
  account.save();

  const record = recordEvent(event, 'MINING_CLAIMED');
  record.addresses = [event.params.beneficiary, event.params.caller];
  record.values = [event.params.epochId, event.params.amount];
  record.save();
}
