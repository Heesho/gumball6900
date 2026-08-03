import {
  BuybackStrategy__Filled,
  BuybackStrategy__FillsPauseSet,
} from '../generated/templates/BuybackStrategyTemplate/BuybackStrategy';
import { getAccount, getProtocol, getStrategy, recordEvent } from './entities';

export function handleBuybackFilled(event: BuybackStrategy__Filled): void {
  const strategy = getStrategy(event.address, event);
  strategy.kind = 'BUYBACK';
  strategy.totalQuotedPaymentRaw = strategy.totalQuotedPaymentRaw.plus(event.params.quotedPayment);
  strategy.totalObservedPaymentRaw = strategy.totalObservedPaymentRaw.plus(event.params.gbxBurned);
  strategy.fillCount += 1;
  strategy.save();

  const account = getAccount(event.params.filler, event);
  account.buybackSoldGBXRaw = account.buybackSoldGBXRaw.plus(event.params.gbxBurned);
  account.save();

  const protocol = getProtocol(event);
  protocol.buybackBurnedGBXRaw = protocol.buybackBurnedGBXRaw.plus(event.params.gbxBurned);
  protocol.save();

  const record = recordEvent(event, 'BUYBACK_FILLED');
  record.addresses = [event.params.filler];
  record.values = [event.params.epochId, event.params.quotedPayment, event.params.gbxBurned, event.params.usdGLot];
  record.save();
}

export function handleBuybackFillsPauseSet(event: BuybackStrategy__FillsPauseSet): void {
  const strategy = getStrategy(event.address, event);
  strategy.fillsPaused = event.params.paused;
  strategy.save();

  const record = recordEvent(event, 'BUYBACK_FILLS_PAUSE_SET');
  record.flag = event.params.paused;
  record.save();
}
