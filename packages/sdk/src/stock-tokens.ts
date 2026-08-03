import { WAD } from './math/constants.js';
import { assertNonNegative, mulDiv } from './math/integer.js';
import { unsignedBigIntSchema } from './validation.js';

export interface StockTokenMultiplierState {
  readonly currentMultiplierWad: bigint;
  readonly pendingMultiplierWad: bigint | null;
  readonly pendingEffectiveAt: bigint | null;
}

/** Applies ERC-8056's display multiplier without changing raw custody or redemption accounting. */
export function uiAdjustedStockTokenBalance(rawBalance: bigint, uiMultiplier: bigint): bigint {
  assertNonNegative(rawBalance, 'rawBalance');
  assertNonNegative(uiMultiplier, 'uiMultiplier');
  return mulDiv(rawBalance, uiMultiplier, WAD);
}

/** Parses a base-10 API multiplier without ever passing through Number or floating point. */
export function parseStockTokenMultiplierWad(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,18}))?$/u.exec(value);
  if (match === null) throw new TypeError('multiplier must be a non-negative decimal with at most 18 places');
  const whole = BigInt(match[1]!);
  const fraction = (match[2] ?? '').padEnd(18, '0');
  return whole * WAD + BigInt(fraction === '' ? '0' : fraction);
}

/** Selects a pending ERC-8056 multiplier only after its explicit effective timestamp. */
export function effectiveStockTokenMultiplierWad(state: StockTokenMultiplierState, atTimestamp: bigint): bigint {
  unsignedBigIntSchema.parse(state.currentMultiplierWad);
  unsignedBigIntSchema.parse(atTimestamp);
  if ((state.pendingMultiplierWad === null) !== (state.pendingEffectiveAt === null)) {
    throw new TypeError('pending multiplier and effective timestamp must either both be set or both be null');
  }
  if (state.pendingMultiplierWad === null || state.pendingEffectiveAt === null) return state.currentMultiplierWad;
  unsignedBigIntSchema.parse(state.pendingMultiplierWad);
  unsignedBigIntSchema.parse(state.pendingEffectiveAt);
  return atTimestamp >= state.pendingEffectiveAt ? state.pendingMultiplierWad : state.currentMultiplierWad;
}
