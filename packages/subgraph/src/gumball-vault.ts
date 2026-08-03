import { Address } from '@graphprotocol/graph-ts';
import {
  GumBallVault__AssetRedeemed,
  GumBallVault__Redeemed,
  GumBallVault__USDGReleased,
} from '../generated/GumBallVault/GumBallVault';
import { Redemption, RedemptionAsset, VaultAsset } from '../generated/schema';
import { getDailyAccount, getDailyProtocol, syncDailyProtocol } from './daily';
import { getAccount, getProtocol, getStrategy, getVaultAsset } from './entities';
import { eventId } from './ids';
import { applyVaultDelta } from './vault-accounting';

export function handleAssetRedeemed(event: GumBallVault__AssetRedeemed): void {
  const receiver = getAccount(event.params.receiver, event);
  receiver.save();
  const asset = getVaultAsset(event.params.asset, event);
  asset.redeemedRaw = asset.redeemedRaw.plus(event.params.amount);
  applyVaultDelta(asset, event.params.amount.neg(), 'REDEMPTION', event);

  const redemptionAsset = new RedemptionAsset(eventId(event));
  redemptionAsset.receiver = receiver.id;
  redemptionAsset.asset = asset.id;
  redemptionAsset.amountRaw = event.params.amount;
  redemptionAsset.redemptionTransactionHash = event.transaction.hash;
  redemptionAsset.blockNumber = event.block.number;
  redemptionAsset.timestamp = event.block.timestamp;
  redemptionAsset.transactionHash = event.transaction.hash;
  redemptionAsset.logIndex = event.logIndex;
  redemptionAsset.save();
}

export function handleRedeemed(event: GumBallVault__Redeemed): void {
  const owner = getAccount(event.params.owner, event);
  owner.redeemedSharesRaw = owner.redeemedSharesRaw.plus(event.params.shares);
  owner.save();
  const receiver = getAccount(event.params.receiver, event);
  receiver.save();

  const redemption = new Redemption(eventId(event));
  redemption.owner = owner.id;
  redemption.receiver = receiver.id;
  redemption.sharesGBXRaw = event.params.shares;
  redemption.supplyBeforeRaw = event.params.supplyBefore;
  redemption.blockNumber = event.block.number;
  redemption.timestamp = event.block.timestamp;
  redemption.transactionHash = event.transaction.hash;
  redemption.logIndex = event.logIndex;
  redemption.save();

  const protocol = getProtocol(event);
  protocol.redeemedSharesRaw = protocol.redeemedSharesRaw.plus(event.params.shares);
  protocol.redemptionCount += 1;
  protocol.save();

  const daily = getDailyProtocol(event);
  daily.redeemedSharesGBXRaw = daily.redeemedSharesGBXRaw.plus(event.params.shares);
  syncDailyProtocol(daily, protocol);
  daily.save();

  const accountDaily = getDailyAccount(event.params.owner, event);
  accountDaily.redeemedSharesGBXRaw = accountDaily.redeemedSharesGBXRaw.plus(event.params.shares);
  accountDaily.save();
}

export function handleUSDGReleased(event: GumBallVault__USDGReleased): void {
  const strategy = getStrategy(event.params.strategy, event);
  strategy.save();
  const protocol = getProtocol(event);
  protocol.strategySpentUSDGRaw = protocol.strategySpentUSDGRaw.plus(event.params.amount);
  const usdgAssetId = protocol.usdgAsset;
  protocol.save();

  if (usdgAssetId != null) {
    const asset = VaultAsset.load(usdgAssetId!);
    if (asset != null) applyVaultDelta(asset, event.params.amount.neg(), 'STRATEGY_RELEASE', event);
  }

  const daily = getDailyProtocol(event);
  daily.strategySpentUSDGRaw = daily.strategySpentUSDGRaw.plus(event.params.amount);
  syncDailyProtocol(daily, protocol);
  daily.save();
}
