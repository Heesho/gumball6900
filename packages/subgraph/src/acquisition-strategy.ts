import { VaultAsset } from '../generated/schema';
import {
  AcquisitionStrategy__AuctionStarted,
  AcquisitionStrategy__Filled,
} from '../generated/templates/AcquisitionStrategy/AcquisitionStrategy';
import { StrategyFill } from '../generated/schema';
import { getDailyProtocol, syncDailyProtocol } from './daily';
import { getAccount, getProtocol, getStrategy } from './entities';
import { eventId } from './ids';
import { applyVaultDelta } from './vault-accounting';

export function handleAcquisitionAuctionStarted(event: AcquisitionStrategy__AuctionStarted): void {
  const strategy = getStrategy(event.address, event);
  strategy.kind = 'ACQUISITION';
  strategy.currentAuctionId = event.params.auctionId;
  strategy.referenceRate = event.params.referenceRate;
  strategy.startRate = event.params.startRate;
  strategy.floorRate = event.params.floorRate;
  strategy.auctionStartTime = event.params.startTime;
  strategy.save();
}

export function handleAcquisitionFilled(event: AcquisitionStrategy__Filled): void {
  const strategy = getStrategy(event.address, event);
  strategy.kind = 'ACQUISITION';
  strategy.totalUSDGSpentRaw = strategy.totalUSDGSpentRaw.plus(event.params.usdGAmount);
  strategy.totalTargetReceivedRaw = strategy.totalTargetReceivedRaw.plus(event.params.targetReceived);
  strategy.totalVaultReceivedRaw = strategy.totalVaultReceivedRaw.plus(event.params.vaultAmount);
  strategy.totalManagerReceivedRaw = strategy.totalManagerReceivedRaw.plus(event.params.managerAmount);
  strategy.fillCount += 1;
  strategy.save();

  const taker = getAccount(event.params.taker, event);
  taker.save();

  const fill = new StrategyFill(eventId(event));
  fill.strategy = strategy.id;
  fill.auctionId = event.params.auctionId;
  fill.taker = taker.id;
  fill.usdgReceiver = event.params.usdGReceiver;
  fill.usdgAmountRaw = event.params.usdGAmount;
  fill.targetReceivedRaw = event.params.targetReceived;
  fill.vaultAmountRaw = event.params.vaultAmount;
  fill.managerAmountRaw = event.params.managerAmount;
  fill.clearingRate = event.params.clearingRate;
  fill.blockNumber = event.block.number;
  fill.timestamp = event.block.timestamp;
  fill.transactionHash = event.transaction.hash;
  fill.logIndex = event.logIndex;
  fill.save();

  if (strategy.asset != null) {
    const asset = VaultAsset.load(strategy.asset!);
    if (asset != null) {
      asset.acquiredByStrategiesRaw = asset.acquiredByStrategiesRaw.plus(event.params.vaultAmount);
      applyVaultDelta(asset, event.params.vaultAmount, 'STRATEGY_FILL', event);
    }
  }

  const protocol = getProtocol(event);
  protocol.save();
  const daily = getDailyProtocol(event);
  syncDailyProtocol(daily, protocol);
  daily.save();
}
