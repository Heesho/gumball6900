import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keccak256, stringToHex, zeroAddress } from 'viem';

import { LiveVaultBacking } from '../components/protocol/live-protocol-overview';
import { LiveStrategyFillHistory } from '../components/protocol/protocol-activity';
import { RedemptionBasketPreview } from '../components/protocol/redemption-actions';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { basketAssetSymbols } from '../lib/live-protocol-overview';
import { registryTestId } from '../lib/registry-presentation';
import { parsePublicRhjSnapshot, type PublicRhjSnapshot } from '../lib/rhj-client';
import { strategySymbols, type LiveRuntimeDeployment } from '../lib/runtime-types';
import type { ProtocolActivityEvent } from '../lib/subgraph-activity';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const stockSymbols = ['QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL'] as const;

const runtime = {
  ...liveRuntimeFixture,
  assetMetadata: Object.fromEntries(
    Object.entries(liveRuntimeFixture.assetMetadata).map(([symbol, metadata]) => [
      symbol,
      stockSymbols.includes(symbol as (typeof stockSymbols)[number])
        ? { ...metadata, registryStatus: 'ASSET_STATUS_ACTIVE' as const, uid: keccak256(stringToHex(symbol)) }
        : metadata,
    ]),
  ) as LiveRuntimeDeployment['assetMetadata'],
} as const satisfies LiveRuntimeDeployment;

const mocked = vi.hoisted(() => ({
  activity: {} as Record<string, unknown>,
  activityCalls: [] as Readonly<{ cursor: unknown; filter: string; pageSize: number }>[],
  overview: {} as Record<string, unknown>,
  rhjData: undefined as PublicRhjSnapshot | undefined,
  rhjSource: 'live' as 'live' | 'loading' | 'stale' | 'unavailable' | 'unsupported',
}));

vi.mock('../hooks/use-live-protocol-overview', () => ({
  useLiveProtocolOverview: () => mocked.overview,
}));

vi.mock('../hooks/use-rhj-metadata', () => ({
  useRhjMetadata: () => ({
    data: mocked.rhjData,
    error: mocked.rhjSource === 'stale' || mocked.rhjSource === 'unavailable' ? new Error('refresh failed') : null,
    isFetching: false,
    refetch: vi.fn(async () => undefined),
    source: mocked.rhjSource,
  }),
}));

vi.mock('../hooks/use-protocol-activity', () => ({
  useProtocolActivity: (filter: string, cursor: unknown, pageSize: number) => {
    mocked.activityCalls.push({ cursor, filter, pageSize });
    return mocked.activity;
  },
}));

function rhjSnapshot(): PublicRhjSnapshot {
  return parsePublicRhjSnapshot({
    assets: stockSymbols.map((symbol, index) => ({
      address: runtime.assets[symbol],
      assetId: `0x${(index + 1).toString(16).padStart(64, '0')}`,
      corporateActions: [],
      currentMultiplier: symbol === 'NVDA' ? '2.500000000000000000' : '1.000000000000000000',
      currentMultiplierSource: 'onchain',
      decimals: 18,
      genesisSymbol: symbol,
      identitySource: 'signed-genesis',
      isTradingHalt: false,
      pendingMultiplier: null,
      pendingMultiplierEffectiveTime: null,
      registryIndex: index + 3,
      registryStatus: 'ASSET_STATUS_ACTIVE',
      symbol,
      symbolHash: keccak256(stringToHex(symbol)),
      tokenName: `${symbol} Robinhood Token`,
      uid: `0x${(index + 1).toString(16).padStart(64, '0')}`,
      verification: {
        assetRegistry: 'matched',
        manifestAddress: 'matched',
        manifestUid: 'matched',
        onchainUid: 'matched',
        registry: 'matched',
        tokenMetadata: 'matched',
      },
      warnings: [],
    })),
    chainId: 4663,
    generatedAt: '2026-08-01T12:00:00.000Z',
    pricesAreMultiplierAdjusted: false,
    readOnly: true,
    registryBlockHash: `0x${'ab'.repeat(32)}`,
    registryBlockNumber: '8888',
    sources: {
      assets: 'fresh',
      corporateActions: 'fresh',
      prices: stockSymbols.map((symbol, index) => ({
        address: runtime.assets[symbol],
        status: 'fresh',
        uid: `0x${(index + 1).toString(16).padStart(64, '0')}`,
      })),
    },
    transactionAuthoritative: false,
  });
}

function overviewData() {
  return {
    assets: basketAssetSymbols.map((symbol, index) => ({
      acquisitionEnabled: true,
      assetId: keccak256(stringToHex(`asset:${symbol}`)),
      decimals: runtime.assetMetadata[symbol].decimals,
      genesisSymbol: symbol,
      isStockToken: runtime.assetMetadata[symbol].registryStatus === 'ASSET_STATUS_ACTIVE',
      redemptionEnabled: true,
      rewards: symbol === 'USDG' ? zeroAddress : runtime.rewards[symbol],
      registryIndex: index,
      strategy: runtime.strategies[symbol],
      symbol,
      symbolHash: keccak256(stringToHex(symbol)),
      token: runtime.assets[symbol],
      vaultBalance:
        symbol === 'NVDA'
          ? 3_000_000_000_000_000_001n
          : BigInt(index + 1) * 10n ** BigInt(runtime.assetMetadata[symbol].decimals),
    })),
    blockNumber: 777n,
    strategies: strategySymbols.map((symbol, index) => ({
      activeWeight: BigInt(index + 1) * 10n ** 18n,
      genesisSymbol: symbol,
      kind:
        symbol === 'USDG'
          ? ('hold-usdg' as const)
          : symbol === 'BURN'
            ? ('buyback' as const)
            : ('acquisition' as const),
      live: true,
      registryIndex: index,
      strategy: runtime.strategies[symbol],
      symbol,
      token: symbol === 'BURN' ? zeroAddress : runtime.assets[symbol],
      virtualUSDGBudget: BigInt(index + 1) * 1_000_000n,
      voterDisabled: false,
    })),
    supply: {
      cumulativeBurned: 0n,
      cumulativeMinted: 1_000n * 10n ** 18n,
      remainingMintCapacity: 999_999_000n * 10n ** 18n,
      totalSupply: 1_000n * 10n ** 18n,
    },
  };
}

const fill: ProtocolActivityEvent = {
  action: null,
  actorAddress: runtime.admin.guardianOperator,
  amountRaw: 42_000_000n,
  assetAddress: null,
  auctionId: 9n,
  blockNumber: 1234n,
  category: 'Asset purchases',
  epochId: null,
  id: '4663:fill:1',
  logIndex: 4n,
  managerAmountRaw: 200_000_000_000_000_000n,
  receiverAddress: runtime.admin.guardianOperator,
  redirectedToVault: null,
  strategyAddress: runtime.strategies.NVDA,
  supplyBeforeRaw: null,
  targetAmountRaw: 10_000_000_000_000_000_000n,
  timestamp: 1_754_000_000n,
  transactionHash: `0x${'ab'.repeat(32)}`,
  type: 'strategy-fill',
  vaultAmountRaw: 9_800_000_000_000_000_000n,
};

function renderLive(children: React.ReactNode) {
  return render(<RuntimeDeploymentProvider runtime={runtime}>{children}</RuntimeDeploymentProvider>);
}

describe('live Vault and Redeem adjusted exposure', () => {
  beforeEach(() => {
    mocked.activity = {
      data: {
        cursor: { before: null, indexedBlock: 1300n, indexedBlockHash: `0x${'cd'.repeat(32)}` },
        events: [fill],
        hasNextPage: false,
        indexedBlock: 1300n,
        indexedBlockHash: `0x${'cd'.repeat(32)}`,
        nextCursor: null,
        pageSize: 8,
      },
      error: null,
      isFetching: false,
      refetch: vi.fn(async () => undefined),
      source: 'live',
    };
    mocked.activityCalls.length = 0;
    mocked.overview = {
      data: overviewData(),
      error: null,
      isFetching: false,
      refetch: vi.fn(async () => undefined),
      source: 'live',
    };
    mocked.rhjData = rhjSnapshot();
    mocked.rhjSource = 'live';
  });

  it('renders exact address-bound bigint exposure while keeping raw Vault units authoritative', () => {
    renderLive(<LiveVaultBacking />);

    const nvda = screen.getByTestId(registryTestId('live-vault-asset-row', runtime.assets.NVDA));
    expect(nvda.textContent).toContain('3.000000000000000001 NVDA');
    expect(screen.getByTestId(registryTestId('live-vault-adjusted', runtime.assets.NVDA)).getAttribute('title')).toBe(
      '7.500000000000000002 underlying-share units',
    );
    expect(nvda.textContent).toContain('2.5× onchain');
    expect(screen.getByTestId(registryTestId('live-vault-raw-unit-share', runtime.assets.NVDA))).toBeDefined();
    expect(screen.getByText('Raw-unit percentages are not value weights')).toBeDefined();
    expect(screen.getByText(/not basket composition, economic exposure, backing value, or NAV/iu)).toBeDefined();
  });

  it('uses the same verified multiplier for the live redemption preview and never changes its raw output', () => {
    renderLive(
      <RedemptionBasketPreview
        outputs={[
          { amount: 1_000_000n, decimals: 6, isStockToken: false, symbol: 'USDG', token: runtime.assets.USDG },
          {
            amount: 3_000_000_000_000_000_001n,
            decimals: 18,
            isStockToken: true,
            symbol: 'NVDA',
            token: runtime.assets.NVDA,
          },
        ]}
        source="live"
      />,
    );

    const nvda = screen.getByTestId(registryTestId('redemption-preview', runtime.assets.NVDA));
    expect(nvda.textContent).toContain('3');
    expect(screen.getByTestId(registryTestId('redemption-adjusted', runtime.assets.NVDA)).getAttribute('title')).toBe(
      '7.500000000000000002 underlying-share units',
    );
    expect(screen.getByTestId(registryTestId('redemption-preview', runtime.assets.USDG)).textContent).toContain(
      'multiplier not applicable',
    );
  });

  it('keeps raw Vault and redemption amounts visible when verified multipliers are unavailable', () => {
    mocked.rhjData = undefined;
    mocked.rhjSource = 'unavailable';
    renderLive(
      <>
        <LiveVaultBacking />
        <RedemptionBasketPreview
          outputs={[
            {
              amount: 3_000_000_000_000_000_001n,
              decimals: 18,
              isStockToken: true,
              symbol: 'NVDA',
              token: runtime.assets.NVDA,
            },
          ]}
          source="live"
        />
      </>,
    );

    expect(screen.getByText('Adjusted stock exposure unavailable')).toBeDefined();
    expect(screen.getByTestId(registryTestId('live-vault-asset-row', runtime.assets.NVDA)).textContent).toContain(
      '3.000000000000000001 NVDA',
    );
    expect(screen.getByTestId(registryTestId('redemption-preview', runtime.assets.NVDA)).textContent).toContain(
      'UI-adjusted display unavailable',
    );
    expect(screen.queryByTestId(registryTestId('live-vault-adjusted', runtime.assets.NVDA))).toBeNull();
    expect(screen.queryByTestId(registryTestId('redemption-adjusted', runtime.assets.NVDA))).toBeNull();
  });

  it('keeps both adjusted exposure and fill rows pending while their validated sources load', () => {
    mocked.rhjData = undefined;
    mocked.rhjSource = 'loading';
    mocked.activity = {
      data: undefined,
      error: null,
      isFetching: true,
      refetch: vi.fn(async () => undefined),
      source: 'loading',
    };
    renderLive(
      <>
        <LiveVaultBacking />
        <RedemptionBasketPreview
          outputs={[
            {
              amount: 3n * 10n ** 18n,
              decimals: 18,
              isStockToken: true,
              symbol: 'NVDA',
              token: runtime.assets.NVDA,
            },
          ]}
          source="live"
        />
        <LiveStrategyFillHistory />
      </>,
    );

    expect(screen.getByText('Adjusted stock exposure loading')).toBeDefined();
    expect(screen.getByTestId(registryTestId('redemption-preview', runtime.assets.NVDA)).textContent).toContain(
      'UI-adjusted display loading',
    );
    expect(screen.getByText('Loading strategy fills…')).toBeDefined();
    expect(screen.queryByTestId(registryTestId('live-vault-adjusted', runtime.assets.NVDA))).toBeNull();
    expect(screen.queryByTestId('live-strategy-fill')).toBeNull();
  });

  it('labels retained multiplier and bounded fill data stale instead of presenting it as current', () => {
    mocked.rhjSource = 'stale';
    mocked.activity = { ...mocked.activity, error: new Error('refresh failed'), source: 'stale' };
    renderLive(
      <>
        <LiveVaultBacking />
        <RedemptionBasketPreview
          outputs={[
            {
              amount: 2n * 10n ** 18n,
              decimals: 18,
              isStockToken: true,
              symbol: 'NVDA',
              token: runtime.assets.NVDA,
            },
          ]}
          source="live"
        />
        <LiveStrategyFillHistory />
      </>,
    );

    expect(screen.getByText('Adjusted stock exposure uses an older verified snapshot')).toBeDefined();
    expect(screen.getByText('Adjusted preview uses an older verified multiplier snapshot')).toBeDefined();
    expect(screen.getByText('Showing the last validated fill page')).toBeDefined();
    expect(screen.getByTestId('live-strategy-fill')).toBeDefined();
    expect(mocked.activityCalls).toEqual([{ cursor: null, filter: 'Asset purchases', pageSize: 8 }]);
  });

  it('resolves duplicate-symbol post-launch fills by strategy address with exact registered decimals', () => {
    const firstToken = fixtureAddress(900);
    const firstStrategy = fixtureAddress(901);
    const secondToken = fixtureAddress(902);
    const secondStrategy = fixtureAddress(903);
    const baseOverview = overviewData();
    const dynamicAsset = (
      token: typeof firstToken,
      strategy: typeof firstStrategy,
      decimals: number,
      index: number,
    ) => ({
      acquisitionEnabled: true,
      assetId: keccak256(stringToHex(`asset:${token}`)),
      decimals,
      genesisSymbol: null,
      isStockToken: false,
      redemptionEnabled: true,
      registryIndex: index,
      rewards: fixtureAddress(950 + index),
      strategy,
      symbol: 'LINK',
      symbolHash: keccak256(stringToHex('LINK')),
      token,
      vaultBalance: 1n,
    });
    const dynamicStrategy = (token: typeof firstToken, strategy: typeof firstStrategy, index: number) => ({
      activeWeight: 1n,
      genesisSymbol: null,
      kind: 'acquisition' as const,
      live: true,
      registryIndex: index,
      strategy,
      symbol: 'LINK',
      token,
      virtualUSDGBudget: 1n,
      voterDisabled: false,
    });
    mocked.overview = {
      data: {
        ...baseOverview,
        assets: [
          ...baseOverview.assets,
          dynamicAsset(firstToken, firstStrategy, 18, 8),
          dynamicAsset(secondToken, secondStrategy, 8, 9),
        ],
        strategies: [
          ...baseOverview.strategies,
          dynamicStrategy(firstToken, firstStrategy, 9),
          dynamicStrategy(secondToken, secondStrategy, 10),
        ],
      },
      error: null,
      isFetching: false,
      refetch: vi.fn(async () => undefined),
      source: 'live',
    };
    mocked.activity = {
      ...mocked.activity,
      data: {
        ...(mocked.activity.data as Record<string, unknown>),
        events: [
          {
            ...fill,
            amountRaw: 10_000n * 10n ** 6n,
            id: '4663:fill:post-launch',
            managerAmountRaw: 1n * 10n ** 8n,
            strategyAddress: secondStrategy,
            targetAmountRaw: 50n * 10n ** 8n,
            vaultAmountRaw: 49n * 10n ** 8n,
          },
        ],
      },
    };

    renderLive(<LiveStrategyFillHistory />);

    const row = screen.getByTestId('live-strategy-fill');
    expect(row.getAttribute('data-strategy-address')).toBe(secondStrategy.toLowerCase());
    expect(row.textContent).toContain('LINK');
    expect(row.textContent).toContain('10K USDG');
    expect(row.textContent).toContain('50 LINK');
    expect(row.textContent).toContain('49 LINK');
    expect(row.textContent).toContain('1 LINK');
    expect(row.textContent).not.toContain('Unknown');
    expect(row.textContent).not.toContain('Unavailable');
  });

  it('withholds unregistered dynamic fill identity when the validated overview is unavailable', () => {
    mocked.overview = {
      data: undefined,
      error: new Error('registry unavailable'),
      isFetching: false,
      refetch: vi.fn(async () => undefined),
      source: 'rpc-fallback',
    };
    mocked.activity = {
      ...mocked.activity,
      data: {
        ...(mocked.activity.data as Record<string, unknown>),
        events: [{ ...fill, strategyAddress: fixtureAddress(903) }],
      },
    };

    renderLive(<LiveStrategyFillHistory />);

    expect(screen.getByText('Fill metadata unavailable')).toBeDefined();
    const row = screen.getByTestId('live-strategy-fill');
    expect(row.textContent).toContain('Unknown');
    expect(row.textContent).toContain('Unavailable');
    expect(row.textContent).not.toContain('LINK');
  });

  it('shows an unavailable fill state without substituting demo settlements', () => {
    mocked.activity = {
      data: undefined,
      error: new Error('indexer unavailable'),
      isFetching: false,
      refetch: vi.fn(async () => undefined),
      source: 'unavailable',
    };
    renderLive(<LiveStrategyFillHistory />);

    expect(screen.getByText('Fill history unavailable')).toBeDefined();
    expect(screen.queryByTestId('live-strategy-fill')).toBeNull();
  });
});
