import { Compounded, PositionRecorded } from '../generated/LiquidityPosition/LiquidityPosition';
import { ONE } from './constants';
import { getProtocol, recordEvent } from './entities';

export function handleCompounded(event: Compounded): void {
  const protocol = getProtocol(event);
  protocol.liquidityAddedRaw = protocol.liquidityAddedRaw.plus(event.params.liquidityAdded);
  protocol.liquidityCompoundCount = protocol.liquidityCompoundCount.plus(ONE);
  protocol.save();

  const record = recordEvent(event, 'LIQUIDITY_COMPOUNDED');
  record.addresses = [event.params.caller];
  record.values = [
    event.params.positionTokenId,
    event.params.liquidityBefore,
    event.params.liquidityAdded,
    event.params.liquidityAfter,
    event.params.funding0,
    event.params.funding1,
    event.params.transferred0,
    event.params.transferred1,
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
