import { render, screen } from '@testing-library/react';
import { keccak256, stringToHex } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { VaultRhjContext } from '../components/protocol/vault-rhj-context';
import { parsePublicRhjSnapshot, type PublicRhjSnapshot } from '../lib/rhj-client';
import { registryTestId } from '../lib/registry-presentation';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const symbols = ['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA'] as const;

function rawSnapshot() {
  return {
    assets: symbols.map((symbol, index) => {
      const uid = `0x${(index + 1).toString(16).padStart(64, '0')}` as const;
      return {
        address: liveRuntimeFixture.assets[symbol],
        assetId: uid,
        corporateActions:
          symbol === 'AAPL'
            ? [
                {
                  details: {},
                  processDate: { day: 2, month: 8, year: 2026 },
                  status: 'announced',
                  type: 'STOCK_SPLIT',
                },
                {
                  details: {},
                  processDate: { day: 15, month: 7, year: 2026 },
                  status: 'completed',
                  type: 'SYMBOL_CHANGE',
                },
              ]
            : [],
        currentMultiplier: '1.000000000000000000',
        currentMultiplierSource: 'onchain',
        decimals: 18,
        genesisSymbol: symbol,
        identitySource: 'signed-genesis',
        isTradingHalt: symbol === 'TSLA',
        pendingMultiplier: symbol === 'AAPL' ? '4.000000000000000000' : null,
        pendingMultiplierEffectiveTime: symbol === 'AAPL' ? '2026-08-02T00:00:00Z' : null,
        quote: null,
        registryIndex: index + 3,
        registryStatus: 'ASSET_STATUS_ACTIVE',
        symbol,
        symbolHash: keccak256(stringToHex(symbol)),
        tokenName: `${symbol} Robinhood Token`,
        tradingCapabilities: null,
        uid,
        verification: {
          assetRegistry: 'matched',
          manifestAddress: 'matched',
          manifestUid: 'matched',
          onchainUid: 'matched',
          registry: 'matched',
          tokenMetadata: 'matched',
        },
        warnings: symbol === 'TSLA' ? ['Robinhood reports an active trading halt.'] : [],
      };
    }),
    chainId: 4663,
    generatedAt: '2026-08-01T12:00:00.000Z',
    pricesAreMultiplierAdjusted: false,
    readOnly: true,
    registryBlockHash: `0x${'ab'.repeat(32)}`,
    registryBlockNumber: '8888',
    sources: {
      assets: 'fresh',
      corporateActions: 'cached',
      prices: symbols.map((symbol, index) => ({
        address: liveRuntimeFixture.assets[symbol],
        status: 'fresh',
        uid: `0x${(index + 1).toString(16).padStart(64, '0')}`,
      })),
    },
    transactionAuthoritative: false,
  };
}

function duplicateSymbolSnapshot() {
  const snapshot = rawSnapshot();
  const uid = `0x${'99'.repeat(32)}` as const;
  snapshot.assets.push({
    ...snapshot.assets[0]!,
    address: fixtureAddress(999),
    assetId: uid,
    corporateActions: [],
    genesisSymbol: null,
    identitySource: 'registered-post-launch',
    registryIndex: 15,
    uid,
    verification: {
      ...snapshot.assets[0]!.verification,
      manifestAddress: 'not-applicable',
      manifestUid: 'not-applicable',
    },
  } as unknown as (typeof snapshot.assets)[number]);
  snapshot.sources.prices.push({ address: fixtureAddress(999), status: 'unavailable', uid });
  return snapshot;
}

const mocked = vi.hoisted(() => ({ data: undefined as PublicRhjSnapshot | undefined }));

vi.mock('../hooks/use-rhj-metadata', () => ({
  useRhjMetadata: () => ({
    data: mocked.data,
    isFetching: false,
    refetch: vi.fn(async () => undefined),
    source: mocked.data === undefined ? 'unavailable' : 'live',
  }),
}));

describe('public RHJ client and Vault context', () => {
  beforeEach(() => {
    mocked.data = parsePublicRhjSnapshot(rawSnapshot());
  });

  it('validates the fixed read-only trust boundary, signed subset, and bounded dynamic identities', () => {
    const parsed = parsePublicRhjSnapshot(rawSnapshot());
    expect(parsed.assets).toHaveLength(5);
    expect(parsed.assets.find(({ symbol }) => symbol === 'TSLA')?.isTradingHalt).toBe(true);
    expect(parsed.pricesAreMultiplierAdjusted).toBe(false);
    expect(parsed.transactionAuthoritative).toBe(false);

    expect(() => parsePublicRhjSnapshot({ ...rawSnapshot(), transactionAuthoritative: true })).toThrow(
      'trust-boundary',
    );
    const missing = rawSnapshot();
    missing.assets.pop();
    missing.sources.prices.pop();
    expect(() => parsePublicRhjSnapshot(missing)).toThrow('every signed stock');
    const conflicting = rawSnapshot();
    conflicting.assets[0]!.address = fixtureAddress(999);
    expect(() => parsePublicRhjSnapshot(conflicting)).toThrow('price sources do not uniquely match');

    const malformedMultiplier = rawSnapshot();
    malformedMultiplier.assets[0]!.currentMultiplier = '1.5';
    expect(() => parsePublicRhjSnapshot(malformedMultiplier)).toThrow('exactly 18 decimal places');

    const invalidActionDate = rawSnapshot();
    invalidActionDate.assets[0]!.corporateActions[0]!.processDate!.month = 13;
    expect(() => parsePublicRhjSnapshot(invalidActionDate)).toThrow('date is out of bounds');

    const duplicateUid = rawSnapshot();
    duplicateUid.assets[1]!.uid = duplicateUid.assets[0]!.uid;
    duplicateUid.assets[1]!.assetId = duplicateUid.assets[0]!.uid;
    expect(() => parsePublicRhjSnapshot(duplicateUid)).toThrow('duplicate address, UID, or registry index');

    const parsedDynamic = parsePublicRhjSnapshot(duplicateSymbolSnapshot());
    expect(parsedDynamic.assets.filter(({ symbol }) => symbol === 'AAPL')).toHaveLength(2);
  });

  it('renders duplicate symbols as distinct address-keyed Vault rows', () => {
    mocked.data = parsePublicRhjSnapshot(duplicateSymbolSnapshot());
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <VaultRhjContext />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getByTestId(registryTestId('rhj-asset', liveRuntimeFixture.assets.AAPL))).toBeDefined();
    expect(screen.getByTestId(registryTestId('rhj-asset', fixtureAddress(999)))).toBeDefined();
  });

  it('renders registry status, halt, multiplier, corporate action, and identity context in the live Vault', () => {
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <VaultRhjContext />
      </RuntimeDeploymentProvider>,
    );

    expect(screen.getByText('Stock-token registry, halts, and actions')).toBeDefined();
    for (const symbol of symbols) {
      expect(screen.getByTestId(registryTestId('rhj-asset', liveRuntimeFixture.assets[symbol]))).toBeDefined();
    }
    expect(screen.getByText('Halted')).toBeDefined();
    expect(screen.getByText(/stock split · announced · 2026-08-02/iu)).toBeDefined();
    expect(screen.getByText(/symbol change · completed · 2026-07-15/iu)).toBeDefined();
    expect(screen.getByRole('list', { name: 'AAPL corporate-action history' }).children).toHaveLength(2);
    expect(screen.getByText('2 stock-token context alerts')).toBeDefined();
    expect(screen.getAllByText('Manifest + chain + registry')).toHaveLength(5);
  });

  it('fails closed in the Vault when the same-origin endpoint is unavailable', () => {
    mocked.data = undefined;
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <VaultRhjContext />
      </RuntimeDeploymentProvider>,
    );
    expect(screen.getByText('Verified stock-token metadata unavailable')).toBeDefined();
    expect(screen.queryByTestId(registryTestId('rhj-asset', liveRuntimeFixture.assets.AAPL))).toBeNull();
  });
});
