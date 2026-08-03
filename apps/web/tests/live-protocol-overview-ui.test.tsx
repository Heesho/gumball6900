import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keccak256, stringToHex, zeroAddress } from 'viem';

import {
  HomeBuybackStat,
  HomeVaultBalances,
  LiveAllocationComposition,
  LiveVaultBacking,
} from '../components/protocol/live-protocol-overview';
import { LiveSupplyStats } from '../components/protocol/live-supply-stats';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { basketAssetSymbols } from '../lib/live-protocol-overview';
import { formatRatioPercent } from '../lib/format';
import { registryTestId } from '../lib/registry-presentation';
import { strategySymbols } from '../lib/runtime-types';
import { fixtureAddress, liveRuntimeFixture } from './live-runtime-fixture';

const mocked = vi.hoisted(() => ({
  overview: {} as Record<string, unknown>,
  summary: {} as Record<string, unknown>,
}));

vi.mock('../hooks/use-live-protocol-overview', () => ({
  useLiveProtocolOverview: () => mocked.overview,
}));

vi.mock('../hooks/use-protocol-summary', () => ({
  useProtocolSummary: () => mocked.summary,
}));

vi.mock('../hooks/use-rhj-metadata', () => ({
  useRhjMetadata: () => ({ data: undefined, error: null, isFetching: false, refetch: vi.fn(), source: 'unsupported' }),
}));

function overviewData() {
  const minted = 1_000n * 10n ** 18n;
  const burned = 100n * 10n ** 18n;
  return {
    assets: basketAssetSymbols.map((symbol, index) => ({
      acquisitionEnabled: true,
      assetId: keccak256(stringToHex(`asset:${symbol}`)),
      decimals: liveRuntimeFixture.assetMetadata[symbol].decimals,
      genesisSymbol: symbol,
      isStockToken: liveRuntimeFixture.assetMetadata[symbol].registryStatus === 'ASSET_STATUS_ACTIVE',
      redemptionEnabled: true,
      rewards: symbol === 'USDG' ? zeroAddress : liveRuntimeFixture.rewards[symbol],
      registryIndex: index,
      strategy: liveRuntimeFixture.strategies[symbol],
      symbol,
      symbolHash: keccak256(stringToHex(symbol)),
      token: liveRuntimeFixture.assets[symbol],
      vaultBalance: BigInt(index + 1) * 10n ** BigInt(liveRuntimeFixture.assetMetadata[symbol].decimals),
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
      strategy: liveRuntimeFixture.strategies[symbol],
      symbol,
      token: symbol === 'BURN' ? zeroAddress : liveRuntimeFixture.assets[symbol],
      virtualUSDGBudget: BigInt(index + 1) * 1_000_000n,
      voterDisabled: false,
    })),
    supply: {
      cumulativeBurned: burned,
      cumulativeMinted: minted,
      remainingMintCapacity: 1_000_000_000n * 10n ** 18n - minted,
      totalSupply: minted - burned,
    },
  };
}

function renderLive(children: React.ReactNode) {
  return render(<RuntimeDeploymentProvider runtime={liveRuntimeFixture}>{children}</RuntimeDeploymentProvider>);
}

describe('live Home and Vault read models', () => {
  beforeEach(() => {
    mocked.overview = {
      data: overviewData(),
      error: null,
      isFetching: false,
      refetch: vi.fn(),
      source: 'live',
    };
    mocked.summary = {
      data: {
        buybackBurnedGBXRaw: 50n * 10n ** 18n,
        buybackSpentUSDGRaw: 10_000n * 10n ** 6n,
        indexedBlock: 776n,
        lastProtocolBlock: 775n,
      },
      error: null,
      isFetching: false,
      refetch: vi.fn(),
      source: 'live',
    };
  });

  it('renders all signed raw assets and strategies without calculating a basket NAV', () => {
    renderLive(
      <>
        <LiveSupplyStats />
        <HomeBuybackStat />
        <HomeVaultBalances />
        <LiveAllocationComposition compact />
        <LiveVaultBacking />
      </>,
    );

    expect(screen.getAllByTestId(/^home-live-vault-asset-/u)).toHaveLength(8);
    expect(screen.getAllByTestId(/^home-live-allocation-/u)).toHaveLength(9);
    expect(screen.getAllByTestId(/^live-vault-asset-row-/u)).toHaveLength(8);
    expect(screen.getAllByTestId(/^live-vault-strategy-row-/u)).toHaveLength(9);
    expect(screen.getByText('8 registered raw balances')).toBeDefined();
    expect(screen.getByText('Live weights and strategy budgets')).toBeDefined();
    expect(screen.getByText('All-time buyback burn')).toBeDefined();
    expect(screen.getByText('Net supply change')).toBeDefined();
    expect(screen.getByText(/lifetime minted minus lifetime burned/iu)).toBeDefined();
    expect(screen.queryByText(/calculated NAV/iu)).toBeNull();
  });

  it('renders appended registry pairs with duplicate symbols using address-bound identities', () => {
    const data = overviewData();
    const token = fixtureAddress(900);
    const strategy = fixtureAddress(901);
    const secondToken = fixtureAddress(903);
    const secondStrategy = fixtureAddress(904);
    mocked.overview = {
      ...mocked.overview,
      data: {
        ...data,
        assets: [
          ...data.assets,
          {
            acquisitionEnabled: true,
            assetId: keccak256(stringToHex('asset:LINK')),
            decimals: 18,
            genesisSymbol: null,
            isStockToken: false,
            redemptionEnabled: true,
            rewards: fixtureAddress(902),
            registryIndex: 8,
            strategy,
            symbol: 'LINK',
            symbolHash: keccak256(stringToHex('LINK')),
            token,
            vaultBalance: 42n * 10n ** 18n,
          },
          {
            acquisitionEnabled: true,
            assetId: keccak256(stringToHex('asset:LINK-2')),
            decimals: 18,
            genesisSymbol: null,
            isStockToken: false,
            redemptionEnabled: true,
            rewards: fixtureAddress(905),
            registryIndex: 9,
            strategy: secondStrategy,
            symbol: 'LINK',
            symbolHash: keccak256(stringToHex('LINK')),
            token: secondToken,
            vaultBalance: 7n * 10n ** 18n,
          },
        ],
        strategies: [
          ...data.strategies,
          {
            activeWeight: 10n * 10n ** 18n,
            genesisSymbol: null,
            kind: 'acquisition',
            live: true,
            registryIndex: 9,
            strategy,
            symbol: 'LINK',
            token,
            virtualUSDGBudget: 10_000_000n,
            voterDisabled: false,
          },
          {
            activeWeight: 11n * 10n ** 18n,
            genesisSymbol: null,
            kind: 'acquisition',
            live: true,
            registryIndex: 10,
            strategy: secondStrategy,
            symbol: 'LINK',
            token: secondToken,
            virtualUSDGBudget: 11_000_000n,
            voterDisabled: false,
          },
        ],
      },
    };

    renderLive(
      <>
        <HomeVaultBalances />
        <LiveAllocationComposition compact />
        <LiveVaultBacking />
      </>,
    );

    expect(screen.getAllByTestId(/^home-live-vault-asset-/u)).toHaveLength(10);
    expect(screen.getAllByTestId(/^home-live-allocation-/u)).toHaveLength(11);
    expect(screen.getByTestId(registryTestId('home-live-vault-asset', token))).toBeDefined();
    expect(screen.getByTestId(registryTestId('home-live-vault-asset', secondToken))).toBeDefined();
    expect(screen.getByTestId(registryTestId('live-vault-asset-row', token))).toBeDefined();
    expect(screen.getByTestId(registryTestId('live-vault-asset-row', secondToken))).toBeDefined();
    expect(screen.getByTestId(registryTestId('live-vault-strategy-row', strategy))).toBeDefined();
    expect(screen.getByTestId(registryTestId('live-vault-strategy-row', secondStrategy))).toBeDefined();
    expect(screen.getByText('10 registered raw balances')).toBeDefined();
  });

  it('shows the literal per-asset share of total raw units with a dimensional caveat', () => {
    const data = overviewData();
    mocked.overview = {
      ...mocked.overview,
      data: {
        ...data,
        assets: data.assets.map((asset, index) => ({ ...asset, vaultBalance: BigInt(index + 1) })),
      },
    };

    renderLive(<LiveVaultBacking />);

    expect(screen.getAllByTestId(/^live-vault-raw-unit-share-/u)).toHaveLength(8);
    const usdGShare = screen.getByTestId(registryTestId('live-vault-raw-unit-share', liveRuntimeFixture.assets.USDG));
    const expected = formatRatioPercent(1n, 36n, 4);
    expect(usdGShare.textContent).toContain(expected);
    expect(usdGShare.getAttribute('aria-label')).toBe(
      `USDG percentage of total raw vault units, not asset value: ${expected}`,
    );
    expect(screen.getByText('Raw-unit percentages are not value weights')).toBeDefined();
    expect(screen.getByText(/not basket composition, economic exposure, backing value, or NAV/iu)).toBeDefined();
  });

  it('renders explicit unavailable states and never substitutes zero for failed live reads', () => {
    mocked.overview = {
      data: undefined,
      error: new Error('RPC unavailable'),
      isFetching: false,
      refetch: vi.fn(),
      source: 'rpc-fallback',
    };
    mocked.summary = {
      data: undefined,
      error: new Error('Indexer unavailable'),
      isFetching: false,
      refetch: vi.fn(),
      source: 'unavailable',
    };
    renderLive(
      <>
        <LiveSupplyStats />
        <HomeBuybackStat />
        <HomeVaultBalances />
        <LiveAllocationComposition compact />
        <LiveVaultBacking />
      </>,
    );

    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText('Contract snapshot unavailable').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/no zero is substituted/iu)).toBeDefined();
    expect(screen.queryByText('0 GBX')).toBeNull();
  });

  it('labels preserved data as stale after a refresh error', () => {
    mocked.overview = { ...mocked.overview, error: new Error('refresh failed'), source: 'live-stale' };
    mocked.summary = { ...mocked.summary, error: new Error('refresh failed'), source: 'stale' };
    renderLive(
      <>
        <HomeBuybackStat />
        <HomeVaultBalances />
        <LiveVaultBacking />
      </>,
    );

    expect(screen.getByText(/Stale indexed aggregate/iu)).toBeDefined();
    expect(screen.getByText('Showing the last validated block')).toBeDefined();
    expect(screen.getByText('Showing the last validated vault block')).toBeDefined();
  });
});
