import { FeesHarvested, PositionRecorded } from '../generated/LiquidityPosition/LiquidityPosition';
import { ONE } from './constants';
import { getProtocol, recordEvent } from './entities';

export function handleFeesHarvested(event: FeesHarvested): void {
  const protocol = getProtocol(event);
  protocol.liquidityPrincipalRaw = event.params.principalLiquidity;
  protocol.liquidityFeeHarvestCount = protocol.liquidityFeeHarvestCount.plus(ONE);
  protocol.liquidityUSDGRoutedRaw = protocol.liquidityUSDGRoutedRaw.plus(event.params.usdgRouted);
  protocol.liquidityGBXBurnedRaw = protocol.liquidityGBXBurnedRaw.plus(event.params.gbxBurned);
  protocol.save();

  const record = recordEvent(event, 'LIQUIDITY_FEES_HARVESTED');
  record.addresses = [event.params.caller];
  record.values = [
    event.params.positionTokenId,
    event.params.principalLiquidity,
    event.params.usdgRouted,
    event.params.gbxBurned,
  ];
  record.save();
}

export function handlePositionRecorded(event: PositionRecorded): void {
  const record = recordEvent(event, 'LIQUIDITY_POSITION_RECORDED');
  record.addresses = [event.params.previousOwner];
  record.values = [event.params.positionTokenId];
  record.bytesValues = [event.params.poolKeyHash];
  record.save();
}
