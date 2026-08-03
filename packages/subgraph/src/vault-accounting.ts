import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { VaultAsset, VaultSnapshot } from '../generated/schema';
import { eventId } from './ids';

export function applyVaultDelta(
  asset: VaultAsset,
  delta: BigInt,
  reason: string,
  event: ethereum.Event,
): VaultSnapshot {
  asset.trackedBalanceRaw = asset.trackedBalanceRaw.plus(delta);
  asset.lastBlockNumber = event.block.number;
  asset.lastTimestamp = event.block.timestamp;
  asset.save();

  const snapshot = new VaultSnapshot(eventId(event));
  snapshot.asset = asset.id;
  snapshot.reason = reason;
  snapshot.deltaRaw = delta;
  snapshot.trackedBalanceAfterRaw = asset.trackedBalanceRaw;
  snapshot.blockNumber = event.block.number;
  snapshot.timestamp = event.block.timestamp;
  snapshot.transactionHash = event.transaction.hash;
  snapshot.logIndex = event.logIndex;
  snapshot.save();
  return snapshot;
}
