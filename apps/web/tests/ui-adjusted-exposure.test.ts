import { describe, expect, it } from 'vitest';
import { keccak256, stringToHex } from 'viem';

import { parseUiMultiplierWad, type PublicRhjAsset } from '../lib/rhj-client';
import { resolveUiAdjustedExposure } from '../lib/ui-adjusted-exposure';
import { fixtureAddress } from './live-runtime-fixture';

const token = fixtureAddress(26);
const metadata: PublicRhjAsset = {
  address: token,
  assetId: `0x${'01'.repeat(32)}`,
  corporateActions: [],
  currentMultiplier: '2.500000000000000000',
  currentMultiplierSource: 'onchain',
  decimals: 18,
  genesisSymbol: 'NVDA',
  identitySource: 'signed-genesis',
  isTradingHalt: false,
  pendingMultiplier: null,
  pendingMultiplierEffectiveTime: null,
  registryIndex: 6,
  registryStatus: 'ASSET_STATUS_ACTIVE',
  symbol: 'NVDA',
  symbolHash: keccak256(stringToHex('NVDA')),
  tokenName: 'NVDA Robinhood Token',
  uid: `0x${'01'.repeat(32)}`,
  verification: {
    assetRegistry: 'matched',
    manifestAddress: 'matched',
    manifestUid: 'matched',
    onchainUid: 'matched',
    registry: 'matched',
    tokenMetadata: 'matched',
  },
  warnings: [],
};

describe('UI-adjusted stock-token exposure', () => {
  it('uses exact bigint WAD arithmetic and floors only at the final atomic unit', () => {
    const adjusted = resolveUiAdjustedExposure(3_000_000_000_000_000_001n, token, 'NVDA', [metadata]);
    expect(adjusted).toEqual({
      amountRaw: 7_500_000_000_000_000_002n,
      multiplierSource: 'onchain',
      multiplierWad: 2_500_000_000_000_000_000n,
    });
  });

  it('fails closed on a symbol-only match with the wrong manifest token address', () => {
    expect(resolveUiAdjustedExposure(10n ** 18n, fixtureAddress(999), 'NVDA', [metadata])).toBeNull();
    expect(resolveUiAdjustedExposure(10n ** 18n, token, 'AAPL', [metadata])).toBeNull();
  });

  it('selects by address when two registered tokens share the same display symbol', () => {
    const appended = {
      ...metadata,
      address: fixtureAddress(999),
      assetId: `0x${'02'.repeat(32)}` as const,
      currentMultiplier: '3.000000000000000000',
      genesisSymbol: null,
      identitySource: 'registered-post-launch' as const,
      registryIndex: 15,
      uid: `0x${'02'.repeat(32)}` as const,
      verification: {
        ...metadata.verification,
        manifestAddress: 'not-applicable' as const,
        manifestUid: 'not-applicable' as const,
      },
    };
    expect(resolveUiAdjustedExposure(10n ** 18n, appended.address, 'NVDA', [metadata, appended])?.amountRaw).toBe(
      3n * 10n ** 18n,
    );
  });

  it('rejects malformed and out-of-range fixed-18 multipliers', () => {
    expect(() => parseUiMultiplierWad('2.5')).toThrow('exactly 18 decimal places');
    expect(() => parseUiMultiplierWad(`${2n ** 256n}.000000000000000000`)).toThrow('exceeds uint256');
  });
});
