import type { Address } from 'viem';

import { parseUiMultiplierWad, UI_MULTIPLIER_SCALE, type PublicRhjAsset } from './rhj-client';

export interface UiAdjustedExposure {
  readonly amountRaw: bigint;
  readonly multiplierSource: PublicRhjAsset['currentMultiplierSource'];
  readonly multiplierWad: bigint;
}

/**
 * Joins raw contract units to already reconciled, read-only RHJ metadata by unique token address. The symbol is only
 * a checked display field, so two registered tokens may safely share a symbol without crossing identities.
 */
export function resolveUiAdjustedExposure(
  rawAmount: bigint,
  token: Address,
  symbol: string,
  metadata: readonly PublicRhjAsset[] | undefined,
): UiAdjustedExposure | null {
  if (rawAmount < 0n) throw new RangeError('rawAmount must be unsigned');
  const matches = metadata?.filter((candidate) => candidate.address.toLowerCase() === token.toLowerCase()) ?? [];
  const asset = matches.length === 1 ? matches[0] : undefined;
  if (
    asset === undefined ||
    asset.symbol !== symbol ||
    asset.currentMultiplier === null ||
    asset.currentMultiplierSource === 'unavailable'
  ) {
    return null;
  }
  const multiplierWad = parseUiMultiplierWad(asset.currentMultiplier);
  return {
    amountRaw: (rawAmount * multiplierWad) / UI_MULTIPLIER_SCALE,
    multiplierSource: asset.currentMultiplierSource,
    multiplierWad,
  };
}
