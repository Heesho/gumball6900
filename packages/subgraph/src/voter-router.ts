import { RevenueRouted } from '../generated/VoterRouter/VoterRouter';
import { getProtocol, recordEvent } from './entities';

export function handleRevenueRouted(event: RevenueRouted): void {
  const protocol = getProtocol(event);
  protocol.routedRevenueRaw = protocol.routedRevenueRaw.plus(event.params.amount);
  protocol.save();

  const record = recordEvent(event, 'VOTER_REVENUE_ROUTED');
  record.addresses = [event.params.caller];
  record.values = [event.params.amount];
  record.save();
}
