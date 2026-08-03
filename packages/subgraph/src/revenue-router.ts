import { RevenueRouter__RevenueRouted } from '../generated/RevenueRouter/RevenueRouter';
import { RevenueNotification } from '../generated/schema';
import { getAccount } from './entities';
import { eventId } from './ids';

export function handleRevenueRouted(event: RevenueRouter__RevenueRouted): void {
  const payer = getAccount(event.params.payer, event);
  payer.save();

  const notification = new RevenueNotification(eventId(event));
  notification.kind = 'ROUTER_TRANSFER';
  notification.source = event.address;
  notification.payer = payer.id;
  notification.sourceId = event.params.sourceId;
  notification.requestedUSDGRaw = event.params.requestedAmount;
  notification.amountUSDGRaw = event.params.vaultReceived;
  notification.blockNumber = event.block.number;
  notification.timestamp = event.block.timestamp;
  notification.transactionHash = event.transaction.hash;
  notification.logIndex = event.logIndex;
  notification.save();
}
