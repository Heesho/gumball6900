import {
  AcquisitionStrategy__Filled,
  AcquisitionStrategy__FillsPauseSet,
} from '../generated/templates/AcquisitionStrategyTemplate/AcquisitionStrategy';
import { getStrategy, recordEvent } from './entities';

export function handleAcquisitionFilled(event: AcquisitionStrategy__Filled): void {
  const strategy = getStrategy(event.address, event);
  strategy.kind = 'ACQUISITION';
  strategy.totalQuotedPaymentRaw = strategy.totalQuotedPaymentRaw.plus(event.params.quotedPayment);
  strategy.totalObservedPaymentRaw = strategy.totalObservedPaymentRaw.plus(event.params.observedPayment);
  strategy.totalVaultReceivedRaw = strategy.totalVaultReceivedRaw.plus(event.params.vaultAmount);
  strategy.fillCount += 1;
  strategy.save();

  const record = recordEvent(event, 'ACQUISITION_FILLED');
  record.addresses = [event.params.filler];
  record.values = [
    event.params.epochId,
    event.params.quotedPayment,
    event.params.observedPayment,
    event.params.vaultAmount,
    event.params.rewardAmount,
    event.params.usdGLot,
  ];
  record.save();
}

export function handleAcquisitionFillsPauseSet(event: AcquisitionStrategy__FillsPauseSet): void {
  const strategy = getStrategy(event.address, event);
  strategy.fillsPaused = event.params.paused;
  strategy.save();

  const record = recordEvent(event, 'ACQUISITION_FILLS_PAUSE_SET');
  record.flag = event.params.paused;
  record.save();
}
