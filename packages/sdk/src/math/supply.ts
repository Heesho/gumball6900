import { assertNonNegative } from './integer.js';

export function currentTotalSupply(lifetimeMinted: bigint, lifetimeBurned: bigint): bigint {
  assertNonNegative(lifetimeMinted, 'lifetimeMinted');
  assertNonNegative(lifetimeBurned, 'lifetimeBurned');
  if (lifetimeBurned > lifetimeMinted) throw new RangeError('lifetimeBurned must not exceed lifetimeMinted');
  return lifetimeMinted - lifetimeBurned;
}

/** Mining increases supply and burns decrease it. */
export function netSupplyChange(gbxMined: bigint, gbxBurned: bigint): bigint {
  assertNonNegative(gbxMined, 'gbxMined');
  assertNonNegative(gbxBurned, 'gbxBurned');
  return gbxMined - gbxBurned;
}

export function projectTotalSupply(currentSupply: bigint, gbxMined: bigint, gbxBurned: bigint): bigint {
  assertNonNegative(currentSupply, 'currentSupply');
  const projected = currentSupply + netSupplyChange(gbxMined, gbxBurned);
  if (projected < 0n) throw new RangeError('gbxBurned must not exceed currentSupply plus gbxMined');
  return projected;
}
