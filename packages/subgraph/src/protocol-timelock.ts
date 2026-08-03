import { BigInt } from '@graphprotocol/graph-ts';
import {
  ProtocolTimelock__ControllerReplacementExecuted,
  ProtocolTimelock__ControllerReplacementScheduled,
  ProtocolTimelock__OperationExecuted,
  ProtocolTimelock__OperationScheduled,
  ProtocolTimelock__PositionTransferExecuted,
  ProtocolTimelock__PositionTransferScheduled,
} from '../generated/ProtocolTimelock/ProtocolTimelock';
import { recordEvent } from './entities';

export function handleControllerReplacementScheduled(event: ProtocolTimelock__ControllerReplacementScheduled): void {
  const record = recordEvent(event, 'TIMELOCK_CONTROLLER_REPLACEMENT_SCHEDULED');
  record.addresses = [event.params.token, event.params.controller];
  record.values = [event.params.readyAt];
  record.bytesValues = [event.params.operationId];
  record.save();
}

export function handleControllerReplacementExecuted(event: ProtocolTimelock__ControllerReplacementExecuted): void {
  const record = recordEvent(event, 'TIMELOCK_CONTROLLER_REPLACEMENT_EXECUTED');
  record.addresses = [event.params.token, event.params.controller];
  record.bytesValues = [event.params.operationId];
  record.save();
}

export function handleOperationExecuted(event: ProtocolTimelock__OperationExecuted): void {
  const record = recordEvent(event, 'TIMELOCK_OPERATION_EXECUTED');
  record.values = [BigInt.fromI32(event.params.action)];
  record.bytesValues = [event.params.operationId];
  record.save();
}

export function handleOperationScheduled(event: ProtocolTimelock__OperationScheduled): void {
  const record = recordEvent(event, 'TIMELOCK_OPERATION_SCHEDULED');
  record.values = [BigInt.fromI32(event.params.action), event.params.readyAt];
  record.bytesValues = [event.params.operationId];
  record.save();
}

export function handlePositionTransferScheduled(event: ProtocolTimelock__PositionTransferScheduled): void {
  const record = recordEvent(event, 'TIMELOCK_POSITION_TRANSFER_SCHEDULED');
  record.addresses = [event.params.custodian, event.params.recipient];
  record.values = [event.params.readyAt];
  record.bytesValues = [event.params.operationId];
  record.save();
}

export function handlePositionTransferExecuted(event: ProtocolTimelock__PositionTransferExecuted): void {
  const record = recordEvent(event, 'TIMELOCK_POSITION_TRANSFER_EXECUTED');
  record.addresses = [event.params.custodian, event.params.recipient];
  record.bytesValues = [event.params.operationId];
  record.save();
}
