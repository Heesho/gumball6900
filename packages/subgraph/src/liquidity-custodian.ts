import {
  LiquidityCustodian__FeesCollected,
  LiquidityCustodian__PositionRecorded,
  LiquidityCustodian__PositionTransferred,
} from '../generated/LiquidityCustodian/LiquidityCustodian';
import { LiquidityPosition } from '../generated/schema';
import { getLiquidityPosition, getProtocol, recordEvent } from './entities';
import { positionId } from './ids';

export function handleFeesCollected(event: LiquidityCustodian__FeesCollected): void {
  const position = LiquidityPosition.load(positionId(event.address, event.params.positionId));
  if (position != null) {
    position.gbxFeesBurnedRaw = position.gbxFeesBurnedRaw.plus(event.params.gbxBurned);
    position.usdgFeesToVaultRaw = position.usdgFeesToVaultRaw.plus(event.params.usdGToVault);
    position.lastBlockNumber = event.block.number;
    position.lastTimestamp = event.block.timestamp;
    position.save();
  }

  const protocol = getProtocol(event);
  protocol.liquidityFeesBurnedGBXRaw = protocol.liquidityFeesBurnedGBXRaw.plus(event.params.gbxBurned);
  protocol.liquidityFeesToVaultUSDGRaw = protocol.liquidityFeesToVaultUSDGRaw.plus(event.params.usdGToVault);
  protocol.save();

  const record = recordEvent(event, 'LIQUIDITY_FEES_COLLECTED');
  record.addresses = [event.params.caller];
  record.values = [event.params.positionId, event.params.gbxBurned, event.params.usdGToVault];
  record.save();
}

export function handlePositionRecorded(event: LiquidityCustodian__PositionRecorded): void {
  const position = getLiquidityPosition(
    event.address,
    event.params.positionId,
    event.params.poolKeyHash,
    event.params.previousOwner,
    event,
  );
  position.save();

  const record = recordEvent(event, 'LIQUIDITY_POSITION_RECORDED');
  record.addresses = [event.params.previousOwner];
  record.values = [event.params.positionId];
  record.bytesValues = [event.params.poolKeyHash];
  record.save();
}

export function handlePositionTransferred(event: LiquidityCustodian__PositionTransferred): void {
  const position = LiquidityPosition.load(positionId(event.address, event.params.positionId));
  if (position != null) {
    position.inCustody = false;
    position.transferredTo = event.params.recipient;
    position.lastBlockNumber = event.block.number;
    position.lastTimestamp = event.block.timestamp;
    position.save();
  }

  const record = recordEvent(event, 'LIQUIDITY_POSITION_TRANSFERRED');
  record.addresses = [event.params.recipient];
  record.values = [event.params.positionId];
  record.save();
}
