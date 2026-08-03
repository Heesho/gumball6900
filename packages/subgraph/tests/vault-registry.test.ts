import { ethereum } from '@graphprotocol/graph-ts';
import {
  assert,
  beforeEach,
  clearStore,
  createMockedFunction,
  describe,
  newMockEvent,
  test,
} from 'matchstick-as/assembly/index';
import {
  AssetRegistry__AcquisitionStatusSet,
  AssetRegistry__AssetRegistered,
  AssetRegistry__RedemptionStatusSet,
  AssetRegistry__StandaloneStrategyRegistered,
} from '../generated/AssetRegistry/AssetRegistry';
import {
  GumBallVault__AssetRedeemed,
  GumBallVault__Redeemed,
  GumBallVault__USDGReleased,
} from '../generated/GumBallVault/GumBallVault';
import { UIMultiplierUpdated } from '../generated/templates/StockToken/StockToken';
import {
  handleAcquisitionStatusSet,
  handleAssetRegistered,
  handleRedemptionStatusSet,
  handleStandaloneStrategyRegistered,
} from '../src/asset-registry';
import { handleAssetRedeemed, handleRedeemed, handleUSDGReleased } from '../src/gumball-vault';
import { handleUIMultiplierUpdated } from '../src/stock-token';
import {
  ASSET,
  CONTRACT,
  HASH,
  REWARDS,
  STRATEGY,
  USER,
  USER_TWO,
  ZERO_ADDRESS,
  addressParam,
  boolParam,
  bytesParam,
  configureEvent,
  integer,
  uintParam,
} from './helpers';

export {
  handleAcquisitionStatusSet,
  handleAssetRedeemed,
  handleAssetRegistered,
  handleRedeemed,
  handleRedemptionStatusSet,
  handleStandaloneStrategyRegistered,
  handleUIMultiplierUpdated,
  handleUSDGReleased,
};

function mockCurrentAcquisitionAuction(): void {
  createMockedFunction(STRATEGY, 'auctionId', 'auctionId():(uint64)').returns([
    ethereum.Value.fromUnsignedBigInt(integer(7)),
  ]);
  createMockedFunction(STRATEGY, 'referenceRate', 'referenceRate():(uint256)').returns([
    ethereum.Value.fromUnsignedBigInt(integer(100)),
  ]);
  createMockedFunction(STRATEGY, 'startRate', 'startRate():(uint256)').returns([
    ethereum.Value.fromUnsignedBigInt(integer(125)),
  ]);
  createMockedFunction(STRATEGY, 'floorRate', 'floorRate():(uint256)').returns([
    ethereum.Value.fromUnsignedBigInt(integer(80)),
  ]);
  createMockedFunction(STRATEGY, 'auctionStartTime', 'auctionStartTime():(uint64)').returns([
    ethereum.Value.fromUnsignedBigInt(integer(1_699_999_999)),
  ]);
}

describe('asset registry, vault, and stock token mappings', () => {
  beforeEach(() => {
    clearStore();
  });

  test('indexes registration/status, redemptions, releases, and multiplier updates', () => {
    const holdUSDGStrategy = USER_TWO;
    const usdg = changetype<AssetRegistry__AssetRegistered>(newMockEvent());
    configureEvent(usdg, CONTRACT, 1);
    usdg.parameters = new Array<ethereum.EventParam>();
    usdg.parameters.push(addressParam('token', CONTRACT));
    usdg.parameters.push(addressParam('strategy', holdUSDGStrategy));
    usdg.parameters.push(addressParam('rewards', ZERO_ADDRESS));
    usdg.parameters.push(bytesParam('assetId', HASH));
    usdg.parameters.push(bytesParam('symbolHash', HASH));
    usdg.parameters.push(uintParam('decimals', 6));
    usdg.parameters.push(boolParam('isStockToken', false));
    usdg.parameters.push(boolParam('acquisitionEnabled', true));
    usdg.parameters.push(boolParam('redemptionEnabled', true));
    handleAssetRegistered(usdg);

    const registered = changetype<AssetRegistry__AssetRegistered>(newMockEvent());
    configureEvent(registered, CONTRACT, 2);
    registered.parameters = new Array<ethereum.EventParam>();
    registered.parameters.push(addressParam('token', ASSET));
    registered.parameters.push(addressParam('strategy', STRATEGY));
    registered.parameters.push(addressParam('rewards', REWARDS));
    registered.parameters.push(bytesParam('assetId', HASH));
    registered.parameters.push(bytesParam('symbolHash', HASH));
    registered.parameters.push(uintParam('decimals', 18));
    registered.parameters.push(boolParam('isStockToken', true));
    registered.parameters.push(boolParam('acquisitionEnabled', true));
    registered.parameters.push(boolParam('redemptionEnabled', false));
    mockCurrentAcquisitionAuction();
    handleAssetRegistered(registered);

    const acquisitionStatus = changetype<AssetRegistry__AcquisitionStatusSet>(newMockEvent());
    configureEvent(acquisitionStatus, CONTRACT, 3);
    acquisitionStatus.parameters = new Array<ethereum.EventParam>();
    acquisitionStatus.parameters.push(addressParam('token', ASSET));
    acquisitionStatus.parameters.push(addressParam('strategy', STRATEGY));
    acquisitionStatus.parameters.push(boolParam('enabled', false));
    handleAcquisitionStatusSet(acquisitionStatus);

    const redemptionStatus = changetype<AssetRegistry__RedemptionStatusSet>(newMockEvent());
    configureEvent(redemptionStatus, CONTRACT, 4);
    redemptionStatus.parameters = new Array<ethereum.EventParam>();
    redemptionStatus.parameters.push(addressParam('token', ASSET));
    redemptionStatus.parameters.push(boolParam('enabled', true));
    handleRedemptionStatusSet(redemptionStatus);

    const standalone = changetype<AssetRegistry__StandaloneStrategyRegistered>(newMockEvent());
    configureEvent(standalone, CONTRACT, 5);
    standalone.parameters = new Array<ethereum.EventParam>();
    standalone.parameters.push(addressParam('strategy', USER));
    handleStandaloneStrategyRegistered(standalone);

    const multiplier = changetype<UIMultiplierUpdated>(newMockEvent());
    configureEvent(multiplier, ASSET, 6);
    multiplier.parameters = new Array<ethereum.EventParam>();
    multiplier.parameters.push(uintParam('oldMultiplier', 1));
    multiplier.parameters.push(uintParam('newMultiplier', 4));
    multiplier.parameters.push(uintParam('effectiveAtTimestamp', 500));
    handleUIMultiplierUpdated(multiplier);

    const assetRedeemed = changetype<GumBallVault__AssetRedeemed>(newMockEvent());
    configureEvent(assetRedeemed, CONTRACT, 7);
    assetRedeemed.parameters = new Array<ethereum.EventParam>();
    assetRedeemed.parameters.push(addressParam('receiver', USER_TWO));
    assetRedeemed.parameters.push(addressParam('asset', ASSET));
    assetRedeemed.parameters.push(uintParam('amount', 5));
    handleAssetRedeemed(assetRedeemed);

    const released = changetype<GumBallVault__USDGReleased>(newMockEvent());
    configureEvent(released, CONTRACT, 8);
    released.parameters = new Array<ethereum.EventParam>();
    released.parameters.push(addressParam('strategy', STRATEGY));
    released.parameters.push(addressParam('receiver', USER));
    released.parameters.push(uintParam('amount', 20));
    handleUSDGReleased(released);

    const redeemed = changetype<GumBallVault__Redeemed>(newMockEvent());
    configureEvent(redeemed, CONTRACT, 9);
    redeemed.parameters = new Array<ethereum.EventParam>();
    redeemed.parameters.push(addressParam('owner', USER));
    redeemed.parameters.push(addressParam('receiver', USER_TWO));
    redeemed.parameters.push(uintParam('shares', 10));
    redeemed.parameters.push(uintParam('supplyBefore', 100));
    handleRedeemed(redeemed);

    assert.dataSourceCount('AcquisitionStrategy', 1);
    assert.dataSourceCount('ManagerRewards', 1);
    assert.dataSourceCount('StockToken', 1);
    assert.entityCount('CorporateAction', 1);
    assert.entityCount('RedemptionAsset', 1);
    assert.entityCount('Redemption', 1);
    assert.entityCount('VaultSnapshot', 2);
    assert.fieldEquals('VaultAsset', '4663-' + ASSET.toHexString(), 'currentUIMultiplierRaw', '4');
    assert.fieldEquals('VaultAsset', '4663-' + ASSET.toHexString(), 'redemptionEnabled', 'true');
    assert.fieldEquals('VaultAsset', '4663-' + ASSET.toHexString(), 'redemptionEnabledKnown', 'true');
    assert.fieldEquals('Protocol', '4663', 'strategySpentUSDGRaw', '20');
    assert.fieldEquals('Protocol', '4663', 'strategyCount', '3');
    assert.fieldEquals('Strategy', '4663-' + holdUSDGStrategy.toHexString(), 'kind', 'HOLD_USDG');
    assert.fieldEquals('Strategy', '4663-' + USER.toHexString(), 'enabled', 'true');
    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'currentAuctionId', '7');
    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'referenceRate', '100');
    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'startRate', '125');
    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'floorRate', '80');
    assert.fieldEquals('Strategy', '4663-' + STRATEGY.toHexString(), 'auctionStartTime', '1699999999');
  });

  test('keeps a future-dated UI multiplier pending instead of publishing it as current', () => {
    const registered = changetype<AssetRegistry__AssetRegistered>(newMockEvent());
    configureEvent(registered, CONTRACT, 1);
    registered.parameters = new Array<ethereum.EventParam>();
    registered.parameters.push(addressParam('token', ASSET));
    registered.parameters.push(addressParam('strategy', STRATEGY));
    registered.parameters.push(addressParam('rewards', REWARDS));
    registered.parameters.push(bytesParam('assetId', HASH));
    registered.parameters.push(bytesParam('symbolHash', HASH));
    registered.parameters.push(uintParam('decimals', 18));
    registered.parameters.push(boolParam('isStockToken', true));
    registered.parameters.push(boolParam('acquisitionEnabled', true));
    registered.parameters.push(boolParam('redemptionEnabled', true));
    mockCurrentAcquisitionAuction();
    handleAssetRegistered(registered);

    const multiplier = changetype<UIMultiplierUpdated>(newMockEvent());
    configureEvent(multiplier, ASSET, 2);
    const futureEffectiveAt = 1_700_001_000;
    multiplier.parameters = new Array<ethereum.EventParam>();
    multiplier.parameters.push(uintParam('oldMultiplier', 1));
    multiplier.parameters.push(uintParam('newMultiplier', 4));
    multiplier.parameters.push(uintParam('effectiveAtTimestamp', futureEffectiveAt));
    handleUIMultiplierUpdated(multiplier);

    const id = '4663-' + ASSET.toHexString();
    assert.fieldEquals('VaultAsset', id, 'redemptionEnabled', 'true');
    assert.fieldEquals('VaultAsset', id, 'redemptionEnabledKnown', 'true');
    assert.fieldEquals('VaultAsset', id, 'currentUIMultiplierRaw', '1');
    assert.fieldEquals('VaultAsset', id, 'pendingUIMultiplierRaw', '4');
    assert.fieldEquals('VaultAsset', id, 'multiplierEffectiveAt', futureEffectiveAt.toString());
    assert.fieldEquals(
      'CorporateAction',
      '4663-' + multiplier.transaction.hash.toHexString() + '-2',
      'newMultiplierRaw',
      '4',
    );
  });
});
