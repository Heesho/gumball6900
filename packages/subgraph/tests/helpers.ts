import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';

export const CONTRACT = Address.fromString('0x0000000000000000000000000000000000006900');
export const USER = Address.fromString('0x0000000000000000000000000000000000000001');
export const USER_TWO = Address.fromString('0x0000000000000000000000000000000000000002');
export const STRATEGY = Address.fromString('0x0000000000000000000000000000000000000003');
export const ASSET = Address.fromString('0x0000000000000000000000000000000000000004');
export const REWARDS = Address.fromString('0x0000000000000000000000000000000000000005');
export const ZERO_ADDRESS = Address.zero();
export const HASH = Bytes.fromHexString('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

export function integer(value: i32): BigInt {
  return BigInt.fromI32(value);
}

export function configureEvent(event: ethereum.Event, address: Address, logIndex: i32): void {
  event.address = address;
  event.logIndex = integer(logIndex);
  event.block.number = integer(100 + logIndex);
  event.block.timestamp = integer(1_700_000_000 + logIndex);
}

export function addressParam(name: string, value: Address): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromAddress(value));
}

export function uintParam(name: string, value: i32): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromUnsignedBigInt(integer(value)));
}

export function uintBigParam(name: string, value: BigInt): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromUnsignedBigInt(value));
}

export function intParam(name: string, value: i32): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromI32(value));
}

export function boolParam(name: string, value: boolean): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromBoolean(value));
}

export function bytesParam(name: string, value: Bytes): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromBytes(value));
}
