import {
  FeesProcessed,
  PositionMigrated,
  PositionRecorded,
  SuccessorSet,
} from '../generated/LiquidityPosition/LiquidityPosition';
import { getProtocol, recordEvent } from './entities';

export function handleFeesProcessed(event: FeesProcessed): void {
  const protocol = getProtocol(event);
  protocol.liquidityGBXBurnedRaw = protocol.liquidityGBXBurnedRaw.plus(event.params.gbxBurned);
  protocol.liquidityUSDGRoutedRaw = protocol.liquidityUSDGRoutedRaw.plus(event.params.usdgRouted);
  protocol.save();

  const record = recordEvent(event, 'LIQUIDITY_FEES_PROCESSED');
  record.addresses = [event.params.caller];
  record.values = [event.params.positionTokenId, event.params.gbxBurned, event.params.usdgRouted];
  record.save();
}

export function handlePositionRecorded(event: PositionRecorded): void {
  const record = recordEvent(event, 'LIQUIDITY_POSITION_RECORDED');
  record.addresses = [event.params.previousOwner];
  record.values = [event.params.positionTokenId];
  record.bytesValues = [event.params.poolKeyHash];
  record.save();
}

export function handleLiquiditySuccessorSet(event: SuccessorSet): void {
  const protocol = getProtocol(event);
  protocol.liquidityPositionSuccessor = event.params.successor;
  protocol.save();

  const record = recordEvent(event, 'LIQUIDITY_SUCCESSOR_SET');
  record.addresses = [event.params.successor];
  record.save();
}

export function handlePositionMigrated(event: PositionMigrated): void {
  const record = recordEvent(event, 'LIQUIDITY_POSITION_MIGRATED');
  record.addresses = [event.params.caller, event.params.successor];
  record.values = [event.params.positionTokenId];
  record.save();
}
