import {
  CallExecuted,
  CallSalt,
  CallScheduled,
  Cancelled,
  MinDelayChange,
  RoleGranted,
  RoleRevoked,
} from '../generated/TimelockController/TimelockController';
import { getProtocol, getTimelockRoleMembership, recordEvent } from './entities';

export function handleCallScheduled(event: CallScheduled): void {
  const record = recordEvent(event, 'TIMELOCK_CALL_SCHEDULED');
  record.addresses = [event.params.target];
  record.values = [event.params.index, event.params.value, event.params.delay];
  record.bytesValues = [event.params.id, event.params.data, event.params.predecessor];
  record.save();
}

export function handleCallExecuted(event: CallExecuted): void {
  const record = recordEvent(event, 'TIMELOCK_CALL_EXECUTED');
  record.addresses = [event.params.target];
  record.values = [event.params.index, event.params.value];
  record.bytesValues = [event.params.id, event.params.data];
  record.save();
}

export function handleCallSalt(event: CallSalt): void {
  const record = recordEvent(event, 'TIMELOCK_CALL_SALT');
  record.bytesValues = [event.params.id, event.params.salt];
  record.save();
}

export function handleCancelled(event: Cancelled): void {
  const record = recordEvent(event, 'TIMELOCK_CANCELLED');
  record.bytesValues = [event.params.id];
  record.save();
}

export function handleMinDelayChange(event: MinDelayChange): void {
  const protocol = getProtocol(event);
  protocol.timelockDelay = event.params.newDuration;
  protocol.save();

  const record = recordEvent(event, 'TIMELOCK_MIN_DELAY_CHANGED');
  record.values = [event.params.oldDuration, event.params.newDuration];
  record.save();
}

export function handleRoleGranted(event: RoleGranted): void {
  const membership = getTimelockRoleMembership(event.address, event.params.role, event.params.account, event);
  membership.granted = true;
  membership.lastSender = event.params.sender;
  membership.save();

  const record = recordEvent(event, 'TIMELOCK_ROLE_GRANTED');
  record.addresses = [event.params.account, event.params.sender];
  record.bytesValues = [event.params.role];
  record.save();
}

export function handleRoleRevoked(event: RoleRevoked): void {
  const membership = getTimelockRoleMembership(event.address, event.params.role, event.params.account, event);
  membership.granted = false;
  membership.lastSender = event.params.sender;
  membership.save();

  const record = recordEvent(event, 'TIMELOCK_ROLE_REVOKED');
  record.addresses = [event.params.account, event.params.sender];
  record.bytesValues = [event.params.role];
  record.save();
}
