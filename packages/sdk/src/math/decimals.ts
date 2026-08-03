import { assertTokenDecimals } from '../validation.js';
import { WAD } from './constants.js';
import { assertNonNegative } from './integer.js';

/** Protocol price math supports ERC-20 decimal counts from zero through WAD precision. */
export function assertWadCompatibleTokenDecimals(decimals: number, name = 'decimals'): void {
  assertTokenDecimals(decimals, name);
  if (decimals > 18) throw new RangeError(`${name} must not exceed 18`);
}

export function rawTokenUnit(decimals: number): bigint {
  assertWadCompatibleTokenDecimals(decimals);
  return 10n ** BigInt(decimals);
}

/** Converts raw token units to an exact 18-decimal representation without rounding. */
export function normalizeRawTokenAmountToWad(amountRaw: bigint, decimals: number, name = 'amountRaw'): bigint {
  assertNonNegative(amountRaw, name);
  assertWadCompatibleTokenDecimals(decimals);
  return amountRaw * (WAD / rawTokenUnit(decimals));
}
