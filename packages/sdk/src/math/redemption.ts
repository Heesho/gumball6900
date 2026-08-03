import { WAD } from './constants.js';
import { assertNonNegative, assertPositive, mulDiv } from './integer.js';

export interface VaultAssetBalance {
  asset: string;
  balance: bigint;
}

export interface RedemptionAssetAmount {
  asset: string;
  amount: bigint;
}

export function redemptionAmount(shares: bigint, supplyBefore: bigint, vaultBalanceBefore: bigint): bigint {
  assertNonNegative(shares, 'shares');
  assertPositive(supplyBefore, 'supplyBefore');
  assertNonNegative(vaultBalanceBefore, 'vaultBalanceBefore');
  if (shares > supplyBefore) {
    throw new RangeError('shares must not exceed supplyBefore');
  }
  return mulDiv(vaultBalanceBefore, shares, supplyBefore);
}

export function redemptionPercentageWad(shares: bigint, supplyBefore: bigint): bigint {
  assertNonNegative(shares, 'shares');
  assertPositive(supplyBefore, 'supplyBefore');
  if (shares > supplyBefore) {
    throw new RangeError('shares must not exceed supplyBefore');
  }
  return mulDiv(shares, WAD, supplyBefore);
}

export function previewRedemption(
  shares: bigint,
  supplyBefore: bigint,
  assets: readonly VaultAssetBalance[],
): RedemptionAssetAmount[] {
  return assets.map(({ asset, balance }) => ({
    asset,
    amount: redemptionAmount(shares, supplyBefore, balance),
  }));
}
