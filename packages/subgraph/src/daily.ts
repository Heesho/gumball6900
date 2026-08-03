import { Address, ethereum } from '@graphprotocol/graph-ts';
import { DailyAccountSnapshot, DailyProtocolSnapshot, Protocol } from '../generated/schema';
import { ZERO } from './constants';
import { accountDayId, addressId, dayStart, protocolDayId } from './ids';

export function getDailyProtocol(event: ethereum.Event): DailyProtocolSnapshot {
  const id = protocolDayId(event.block.timestamp);
  let snapshot = DailyProtocolSnapshot.load(id);
  if (snapshot == null) {
    snapshot = new DailyProtocolSnapshot(id);
    snapshot.dayStartTimestamp = dayStart(event.block.timestamp);
    snapshot.eventCount = 0;
    snapshot.mintedGBXRaw = ZERO;
    snapshot.burnedGBXRaw = ZERO;
    snapshot.genesisContributedUSDGRaw = ZERO;
    snapshot.miningContributedUSDGRaw = ZERO;
    snapshot.revenueNotifiedUSDGRaw = ZERO;
    snapshot.strategySpentUSDGRaw = ZERO;
    snapshot.redeemedSharesGBXRaw = ZERO;
    snapshot.buybackSpentUSDGRaw = ZERO;
    snapshot.buybackBurnedGBXRaw = ZERO;
    snapshot.cumulativeMintedGBXRaw = ZERO;
    snapshot.cumulativeBurnedGBXRaw = ZERO;
    snapshot.totalSupplyGBXRaw = ZERO;
    snapshot.totalStakedGBXRaw = ZERO;
  }
  snapshot.eventCount += 1;
  snapshot.lastBlockNumber = event.block.number;
  snapshot.lastTimestamp = event.block.timestamp;
  return snapshot;
}

export function syncDailyProtocol(snapshot: DailyProtocolSnapshot, protocol: Protocol): void {
  snapshot.cumulativeMintedGBXRaw = protocol.cumulativeMintedRaw;
  snapshot.cumulativeBurnedGBXRaw = protocol.cumulativeBurnedRaw;
  snapshot.totalSupplyGBXRaw = protocol.totalSupplyRaw;
  snapshot.totalStakedGBXRaw = protocol.stakedGBXRaw;
}

export function getDailyAccount(address: Address, event: ethereum.Event): DailyAccountSnapshot {
  const id = accountDayId(address, event.block.timestamp);
  let snapshot = DailyAccountSnapshot.load(id);
  if (snapshot == null) {
    snapshot = new DailyAccountSnapshot(id);
    snapshot.account = addressId(address);
    snapshot.dayStartTimestamp = dayStart(event.block.timestamp);
    snapshot.eventCount = 0;
    snapshot.gbxMintedRaw = ZERO;
    snapshot.gbxBurnedRaw = ZERO;
    snapshot.genesisContributedUSDGRaw = ZERO;
    snapshot.miningContributedUSDGRaw = ZERO;
    snapshot.genesisClaimedGBXRaw = ZERO;
    snapshot.miningClaimedGBXRaw = ZERO;
    snapshot.stakedGBXRaw = ZERO;
    snapshot.unstakedGBXRaw = ZERO;
    snapshot.redeemedSharesGBXRaw = ZERO;
    snapshot.buybackSoldGBXRaw = ZERO;
    snapshot.managerRewardClaimCount = 0;
    snapshot.signalEventCount = 0;
  }
  snapshot.eventCount += 1;
  snapshot.lastBlockNumber = event.block.number;
  snapshot.lastTimestamp = event.block.timestamp;
  return snapshot;
}
