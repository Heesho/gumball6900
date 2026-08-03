import { Address, DataSourceContext } from '@graphprotocol/graph-ts';
import {
  AssetRegistry__AssetRegistered,
  AssetRegistry__StandaloneStrategyRegistered,
  AssetRegistry__StrategyDisabled,
} from '../generated/AssetRegistry/AssetRegistry';
import { AcquisitionStrategyTemplate, BuybackStrategyTemplate, StrategyRewardsTemplate } from '../generated/templates';
import { getProtocol, getStrategy, getVaultAsset, recordEvent } from './entities';

export function handleAssetRegistered(event: AssetRegistry__AssetRegistered): void {
  const asset = getVaultAsset(event.params.token, event);
  asset.assetIndex = event.params.assetIndex;
  asset.strategy = event.params.strategy;
  asset.rewards = event.params.rewards;
  asset.save();

  const protocol = getProtocol(event);
  protocol.assetCount = event.params.assetIndex.toI32() + 1;

  if (!event.params.strategy.equals(Address.zero())) {
    const strategy = getStrategy(event.params.strategy, event);
    strategy.kind = 'ACQUISITION';
    strategy.targetToken = event.params.token;
    strategy.rewards = event.params.rewards;
    strategy.live = true;
    strategy.save();
    protocol.strategyCount += 1;
    AcquisitionStrategyTemplate.create(event.params.strategy);
    const context = new DataSourceContext();
    context.setBytes('strategy', event.params.strategy);
    StrategyRewardsTemplate.createWithContext(event.params.rewards, context);
  }
  protocol.save();

  const record = recordEvent(event, 'ASSET_REGISTERED');
  record.addresses = [event.params.token, event.params.strategy, event.params.rewards];
  record.values = [event.params.assetIndex];
  record.save();
}

export function handleStandaloneStrategyRegistered(event: AssetRegistry__StandaloneStrategyRegistered): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.kind = 'BUYBACK';
  strategy.strategyIndex = event.params.strategyIndex;
  strategy.live = true;
  strategy.save();

  const protocol = getProtocol(event);
  protocol.strategyCount = event.params.strategyIndex.toI32() + 1;
  protocol.save();
  BuybackStrategyTemplate.create(event.params.strategy);

  const record = recordEvent(event, 'STANDALONE_STRATEGY_REGISTERED');
  record.addresses = [event.params.strategy];
  record.values = [event.params.strategyIndex];
  record.save();
}

export function handleRegistryStrategyDisabled(event: AssetRegistry__StrategyDisabled): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.live = false;
  strategy.save();

  const record = recordEvent(event, 'REGISTRY_STRATEGY_DISABLED');
  record.addresses = [event.params.strategy];
  record.save();
}
