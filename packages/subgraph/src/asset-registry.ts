import { Address, DataSourceContext } from '@graphprotocol/graph-ts';
import {
  AssetRegistry__AcquisitionStatusSet,
  AssetRegistry__AssetRegistered,
  AssetRegistry__RedemptionStatusSet,
  AssetRegistry__StandaloneStrategyRegistered,
} from '../generated/AssetRegistry/AssetRegistry';
import { AcquisitionStrategy as AcquisitionStrategyContract } from '../generated/AssetRegistry/AcquisitionStrategy';
import { AcquisitionStrategy as AcquisitionStrategyTemplate, ManagerRewards, StockToken } from '../generated/templates';
import { getProtocol, getStrategy, getVaultAsset } from './entities';

export function handleAssetRegistered(event: AssetRegistry__AssetRegistered): void {
  const protocol = getProtocol(event);
  const isFirstAsset = protocol.assetCount == 0;
  protocol.assetCount += 1;

  const asset = getVaultAsset(event.params.token, event);
  asset.assetId = event.params.assetId;
  asset.symbolHash = event.params.symbolHash;
  asset.decimals = event.params.decimals;
  asset.isStockToken = event.params.isStockToken;
  asset.rewards = event.params.rewards;
  asset.acquisitionEnabled = event.params.acquisitionEnabled;
  asset.redemptionEnabled = event.params.redemptionEnabled;
  asset.redemptionEnabledKnown = true;
  asset.registeredBlockNumber = event.block.number;
  if (isFirstAsset) protocol.usdgAsset = asset.id;

  if (!event.params.strategy.equals(Address.zero())) {
    const strategy = getStrategy(event.params.strategy, event);
    strategy.kind = isFirstAsset ? 'HOLD_USDG' : 'ACQUISITION';
    strategy.asset = asset.id;
    strategy.rewards = event.params.rewards;
    strategy.enabled = event.params.acquisitionEnabled;
    strategy.save();
    asset.strategy = strategy.id;
    protocol.strategyCount += 1;

    if (!isFirstAsset) {
      // The strategy's constructor emitted its first AuctionStarted days before timelocked registration. A dynamic
      // data source cannot replay that prior log, so seed the exact current auction state at the registration block.
      const acquisition = AcquisitionStrategyContract.bind(event.params.strategy);
      strategy.currentAuctionId = acquisition.auctionId();
      strategy.referenceRate = acquisition.referenceRate();
      strategy.startRate = acquisition.startRate();
      strategy.floorRate = acquisition.floorRate();
      strategy.auctionStartTime = acquisition.auctionStartTime();
      strategy.save();

      const strategyContext = new DataSourceContext();
      strategyContext.setString('assetId', asset.id);
      AcquisitionStrategyTemplate.createWithContext(event.params.strategy, strategyContext);

      if (!event.params.rewards.equals(Address.zero())) {
        const rewardsContext = new DataSourceContext();
        rewardsContext.setString('strategyId', strategy.id);
        rewardsContext.setString('assetId', asset.id);
        ManagerRewards.createWithContext(event.params.rewards, rewardsContext);
      }
    }
  }

  if (event.params.isStockToken) StockToken.create(event.params.token);
  asset.save();
  protocol.save();
}

export function handleAcquisitionStatusSet(event: AssetRegistry__AcquisitionStatusSet): void {
  if (!event.params.token.equals(Address.zero())) {
    const asset = getVaultAsset(event.params.token, event);
    asset.acquisitionEnabled = event.params.enabled;
    asset.save();
  }
  if (!event.params.strategy.equals(Address.zero())) {
    const strategy = getStrategy(event.params.strategy, event);
    strategy.enabled = event.params.enabled;
    strategy.save();
  }
}

export function handleRedemptionStatusSet(event: AssetRegistry__RedemptionStatusSet): void {
  const asset = getVaultAsset(event.params.token, event);
  asset.redemptionEnabled = event.params.enabled;
  asset.redemptionEnabledKnown = true;
  asset.save();
}

export function handleStandaloneStrategyRegistered(event: AssetRegistry__StandaloneStrategyRegistered): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.enabled = true;
  strategy.save();
  const protocol = getProtocol(event);
  protocol.strategyCount += 1;
  protocol.save();
}
