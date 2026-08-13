import { BigInt } from '@graphprotocol/graph-ts';
import { RevenueHeld, RevenueRouted } from '../generated/ResonanceRouter/ResonanceRouter';
import { getProtocol, recordEvent } from './entities';

export function handleRevenueHeld(event: RevenueHeld): void {
  const protocol = getProtocol(event);
  protocol.heldRevenueAttemptCount = protocol.heldRevenueAttemptCount.plus(BigInt.fromI32(1));
  protocol.lastHeldRevenueRaw = event.params.amount;
  protocol.lastHeldStreamRemainingRaw = event.params.remaining;
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_HELD');
  record.addresses = [event.params.caller];
  record.values = [event.params.amount, event.params.remaining];
  record.save();
}

export function handleRevenueRouted(event: RevenueRouted): void {
  const protocol = getProtocol(event);
  protocol.routedRevenueRaw = protocol.routedRevenueRaw.plus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'RESONANCE_REVENUE_ROUTED');
  record.addresses = [event.params.caller];
  record.values = [event.params.amount];
  record.save();
}
