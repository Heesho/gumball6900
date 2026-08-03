import type { DecodedRedemptionReceipt } from '@gumball-6900/sdk';
import { describe, expect, it } from 'vitest';

import { redemptionReceiptRows, verifyRedemptionReceipt } from '../components/protocol/redemption-actions';
import { assetSymbols } from '../lib/runtime-types';
import { liveRuntimeFixture } from './live-runtime-fixture';

const OWNER = liveRuntimeFixture.admin.guardianOperator;
const redeemableSymbols = assetSymbols.filter((symbol) => symbol !== 'GBX');
const expectedOutputs = redeemableSymbols.map((symbol) => ({
  decimals: liveRuntimeFixture.assetMetadata[symbol].decimals,
  symbol,
  token: liveRuntimeFixture.assets[symbol],
}));

function decodedReceipt(): DecodedRedemptionReceipt {
  return {
    amounts: redeemableSymbols.map((symbol, index) => ({
      amountRaw: BigInt(index + 1) * 1_000n,
      token: liveRuntimeFixture.assets[symbol],
    })),
    owner: OWNER,
    receiver: OWNER,
    shares: 25n,
    supplyBefore: 1_000n,
  };
}

describe('redemption receipt UI binding', () => {
  it('binds every decoded raw amount to signed-manifest symbol and decimals', () => {
    const decoded = decodedReceipt();
    verifyRedemptionReceipt(decoded, {
      expectedAssets: redeemableSymbols.map((symbol) => liveRuntimeFixture.assets[symbol]),
      expectedOwner: OWNER,
      expectedReceiver: OWNER,
      expectedShares: 25n,
    });
    const rows = redemptionReceiptRows(decoded, expectedOutputs);
    expect(rows).toHaveLength(8);
    expect(rows.find(({ symbol }) => symbol === 'USDG')).toMatchObject({ decimals: 6, amountRaw: 1_000n });
    expect(rows.find(({ symbol }) => symbol === 'WBTC')?.decimals).toBe(8);
  });

  it('rejects an unexpected receiver, share amount, asset set, or unmanifested token', () => {
    const decoded = decodedReceipt();
    expect(() =>
      verifyRedemptionReceipt(decoded, {
        expectedAssets: redeemableSymbols.map((symbol) => liveRuntimeFixture.assets[symbol]),
        expectedOwner: OWNER,
        expectedReceiver: liveRuntimeFixture.admin.protocolTimelock,
        expectedShares: 25n,
      }),
    ).toThrow('receiver');
    expect(() =>
      verifyRedemptionReceipt(decoded, {
        expectedAssets: redeemableSymbols.slice(1).map((symbol) => liveRuntimeFixture.assets[symbol]),
        expectedOwner: OWNER,
        expectedReceiver: OWNER,
        expectedShares: 25n,
      }),
    ).toThrow('asset set');
    expect(() =>
      redemptionReceiptRows(
        { ...decoded, amounts: [{ amountRaw: 1n, token: liveRuntimeFixture.admin.protocolTimelock }] },
        expectedOutputs,
      ),
    ).toThrow('absent from the pinned asset registry');
  });
});
