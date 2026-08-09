import { assertNonNegative } from './integer.js';

export function currentTotalSupply(cumulativeMinted: bigint, cumulativeBurned: bigint): bigint {
  assertNonNegative(cumulativeMinted, 'cumulativeMinted');
  assertNonNegative(cumulativeBurned, 'cumulativeBurned');
  if (cumulativeBurned > cumulativeMinted) {
    throw new RangeError('cumulativeBurned must not exceed cumulativeMinted');
  }
  return cumulativeMinted - cumulativeBurned;
}

/** Signed result: a later permissionless Fund burn can exceed an epoch's new GBX emission. */
export function netSupplyChange(newEmission: bigint, gbxBurned: bigint): bigint {
  assertNonNegative(newEmission, 'newEmission');
  assertNonNegative(gbxBurned, 'gbxBurned');
  return newEmission - gbxBurned;
}

export function projectTotalSupply(currentSupply: bigint, newEmission: bigint, gbxBurned: bigint): bigint {
  assertNonNegative(currentSupply, 'currentSupply');
  const change = netSupplyChange(newEmission, gbxBurned);
  const projected = currentSupply + change;
  if (projected < 0n) {
    throw new RangeError('gbxBurned must not exceed currentSupply plus newEmission');
  }
  return projected;
}
