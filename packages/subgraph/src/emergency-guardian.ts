import {
  EmergencyGuardian__MiningPaused,
  EmergencyGuardian__SignalIncreasesPaused,
  EmergencyGuardian__StrategyDisabled,
  EmergencyGuardian__StrategyFillsPaused,
  EmergencyGuardian__TargetsInitialized,
} from '../generated/EmergencyGuardian/EmergencyGuardian';
import { recordEvent } from './entities';

export function handleGuardianMiningPaused(event: EmergencyGuardian__MiningPaused): void {
  const record = recordEvent(event, 'GUARDIAN_MINING_PAUSED');
  record.addresses = [event.params.miningPool];
  record.save();
}

export function handleGuardianSignalIncreasesPaused(event: EmergencyGuardian__SignalIncreasesPaused): void {
  const record = recordEvent(event, 'GUARDIAN_SIGNAL_INCREASES_PAUSED');
  record.addresses = [event.params.voter];
  record.save();
}

export function handleGuardianStrategyDisabled(event: EmergencyGuardian__StrategyDisabled): void {
  const record = recordEvent(event, 'GUARDIAN_STRATEGY_DISABLED');
  record.addresses = [event.params.strategy];
  record.save();
}

export function handleGuardianStrategyFillsPaused(event: EmergencyGuardian__StrategyFillsPaused): void {
  const record = recordEvent(event, 'GUARDIAN_STRATEGY_FILLS_PAUSED');
  record.addresses = [event.params.strategy];
  record.save();
}

export function handleGuardianTargetsInitialized(event: EmergencyGuardian__TargetsInitialized): void {
  const record = recordEvent(event, 'GUARDIAN_TARGETS_INITIALIZED');
  record.addresses = [event.params.miningPool, event.params.allocationVoter, event.params.assetRegistry];
  record.save();
}
