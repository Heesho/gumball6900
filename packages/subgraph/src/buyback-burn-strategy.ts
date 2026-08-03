import {
  BuybackBurnStrategy__AuctionStarted,
  BuybackBurnStrategy__GBXBoughtAndBurned,
} from '../generated/BuybackBurnStrategy/BuybackBurnStrategy';
import { Buyback } from '../generated/schema';
import { getDailyAccount, getDailyProtocol, syncDailyProtocol } from './daily';
import { getAccount, getProtocol, getStrategy } from './entities';
import { eventId } from './ids';

export function handleBuybackAuctionStarted(event: BuybackBurnStrategy__AuctionStarted): void {
  const strategy = getStrategy(event.address, event);
  strategy.kind = 'BUYBACK';
  strategy.currentAuctionId = event.params.auctionId;
  strategy.referenceRate = event.params.referenceRate;
  strategy.startRate = event.params.startRate;
  strategy.floorRate = event.params.floorRate;
  strategy.auctionStartTime = event.params.startTime;
  strategy.save();
}

export function handleGBXBoughtAndBurned(event: BuybackBurnStrategy__GBXBoughtAndBurned): void {
  const strategy = getStrategy(event.address, event);
  strategy.kind = 'BUYBACK';
  strategy.totalUSDGSpentRaw = strategy.totalUSDGSpentRaw.plus(event.params.usdGSpent);
  strategy.fillCount += 1;
  strategy.save();

  const taker = getAccount(event.params.taker, event);
  taker.buybackSoldGBXRaw = taker.buybackSoldGBXRaw.plus(event.params.gbxBurned);
  taker.save();

  const buyback = new Buyback(eventId(event));
  buyback.strategy = strategy.id;
  buyback.auctionId = event.params.auctionId;
  buyback.taker = taker.id;
  buyback.usdgReceiver = event.params.usdGReceiver;
  buyback.usdgSpentRaw = event.params.usdGSpent;
  buyback.gbxBurnedRaw = event.params.gbxBurned;
  buyback.clearingRate = event.params.clearingRate;
  buyback.totalSupplyAfterRaw = event.params.totalSupplyAfter;
  buyback.blockNumber = event.block.number;
  buyback.timestamp = event.block.timestamp;
  buyback.transactionHash = event.transaction.hash;
  buyback.logIndex = event.logIndex;
  buyback.save();

  const protocol = getProtocol(event);
  protocol.buybackSpentUSDGRaw = protocol.buybackSpentUSDGRaw.plus(event.params.usdGSpent);
  protocol.buybackBurnedGBXRaw = protocol.buybackBurnedGBXRaw.plus(event.params.gbxBurned);
  protocol.save();

  const daily = getDailyProtocol(event);
  daily.buybackSpentUSDGRaw = daily.buybackSpentUSDGRaw.plus(event.params.usdGSpent);
  daily.buybackBurnedGBXRaw = daily.buybackBurnedGBXRaw.plus(event.params.gbxBurned);
  syncDailyProtocol(daily, protocol);
  daily.save();

  const accountDaily = getDailyAccount(event.params.taker, event);
  accountDaily.buybackSoldGBXRaw = accountDaily.buybackSoldGBXRaw.plus(event.params.gbxBurned);
  accountDaily.save();
}
