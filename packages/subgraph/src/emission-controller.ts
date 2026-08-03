import { EmissionController__MiningEpochSettled } from '../generated/EmissionController/EmissionController';
import { getProtocol, recordEvent } from './entities';

export function handleEmissionEpochSettled(event: EmissionController__MiningEpochSettled): void {
  const protocol = getProtocol(event);
  protocol.emissionController = event.address;
  protocol.miningEmittedGBXRaw = protocol.miningEmittedGBXRaw.plus(event.params.emission);
  protocol.save();

  const record = recordEvent(event, 'EMISSION_EPOCH_SETTLED');
  record.addresses = [event.params.claimsReceiver];
  record.values = [
    event.params.epochId,
    event.params.emission,
    event.params.scheduledEmission,
    event.params.nextScheduledEmission,
  ];
  record.flag = event.params.nonEmpty;
  record.save();
}
