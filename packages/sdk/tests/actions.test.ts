import { decodeFunctionData, getAddress } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  CANONICAL_USDG_DECIMALS,
  acquisitionStrategyAbi,
  allocationVoterAbi,
  buildAcquisitionFill,
  buildMiningClaimBatch,
  buildRedemption,
  buildSignal,
  canonicalPoolKey,
  formatTokenAmountRaw,
  gumBallVaultAbi,
  miningClaimsAbi,
  parseTokenAmountRaw,
  uiAdjustedStockTokenBalance,
} from '../src/index.js';

const A = '0x0000000000000000000000000000000000000001';
const B = '0x0000000000000000000000000000000000000002';
const C = '0x0000000000000000000000000000000000000003';

describe('typed transaction builders', () => {
  it('encodes bounded mining claim batches', () => {
    const transaction = buildMiningClaimBatch(A, B, [1n, 4n, 9n]);
    const decoded = decodeFunctionData({ abi: miningClaimsAbi, data: transaction.data });
    expect(decoded.functionName).toBe('claimBatch');
    expect(decoded.args).toEqual([B, [1n, 4n, 9n]]);
  });

  it('rejects duplicate signal strategies before encoding', () => {
    expect(() => buildSignal(A, [B, B], [1n, 1n])).toThrow('duplicate strategy');
    const transaction = buildSignal(A, [B, C], [3n, 7n]);
    expect(decodeFunctionData({ abi: allocationVoterAbi, data: transaction.data }).functionName).toBe('signal');
  });

  it('normalizes each signal strategy without treating its array index as a chain id', () => {
    const strategies = [
      '0x59b670e9fa9d0a427751af201d676719a970857b',
      '0x09635f643e140090a9a8dcd712ed6285858cebef',
      '0x851356ae760d987e095750cceb3bc6014560891c',
      '0x99bba657f2bbc93c02d617f8ba121cb8fc104acf',
    ] as const;
    const transaction = buildSignal(A, strategies, [3n, 3n, 2n, 2n]);
    const decoded = decodeFunctionData({ abi: allocationVoterAbi, data: transaction.data });
    expect(decoded.args?.[0]).toEqual(strategies.map((strategy) => getAddress(strategy)));
  });

  it('encodes redemption with no recipient ambiguity', () => {
    const transaction = buildRedemption(A, 50n, B);
    const decoded = decodeFunctionData({ abi: gumBallVaultAbi, data: transaction.data });
    expect(decoded.args).toEqual([50n, B]);
  });

  it('encodes explicitly named raw auction amounts', () => {
    const decoded = decodeFunctionData({
      abi: acquisitionStrategyAbi,
      data: buildAcquisitionFill({
        deadline: 1_000n,
        expectedAuctionId: 7n,
        maximumTargetAmountRaw: 42n * 10n ** 18n,
        strategy: A,
        usdGAmountRaw: 10_000n * 10n ** 6n,
        usdGReceiver: B,
      }).data,
    });
    expect(decoded.args).toEqual([7n, 10_000n * 10n ** 6n, 42n * 10n ** 18n, B, 1_000n]);
  });
});

describe('protocol metadata helpers', () => {
  it('sorts the canonical pool key by raw address', () => {
    expect(canonicalPoolKey(C, A, B, { chainId: 4663, gbxDecimals: 18, usdGDecimals: 6 })).toEqual({
      currency0: A,
      currency1: C,
      fee: 3_000,
      tickSpacing: 60,
      hooks: B,
    });
  });

  it('applies a stock-token UI multiplier without changing raw units', () => {
    expect(uiAdjustedStockTokenBalance(4n * 10n ** 18n, 15n * 10n ** 17n)).toBe(6n * 10n ** 18n);
  });

  it('parses and formats canonical USDG without floating point', () => {
    expect(CANONICAL_USDG_DECIMALS).toBe(6);
    const raw = parseTokenAmountRaw('123.450001', { decimals: CANONICAL_USDG_DECIMALS, symbol: 'USDG' });
    expect(raw).toBe(123_450_001n);
    expect(formatTokenAmountRaw(raw, { decimals: CANONICAL_USDG_DECIMALS, symbol: 'USDG' })).toBe('123.450001');
    expect(() => parseTokenAmountRaw('1.0000001', { decimals: CANONICAL_USDG_DECIMALS })).toThrow(
      'exceeds 6 decimal places',
    );
  });
});
