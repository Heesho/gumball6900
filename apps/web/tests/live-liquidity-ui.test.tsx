import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeLiquidityStat, LiveLiquidityDashboard, LivePoolStateCard } from '../components/protocol/live-liquidity';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import { liveRuntimeFixture } from './live-runtime-fixture';

const mocked = vi.hoisted(() => ({
  fees: {} as Record<string, unknown>,
  snapshot: {} as Record<string, unknown>,
}));

vi.mock('../hooks/use-live-liquidity', () => ({
  useLiveLiquidity: () => mocked.snapshot,
}));

vi.mock('../hooks/use-protocol-summary', () => ({
  useProtocolSummary: () => mocked.fees,
}));

function snapshotData() {
  return {
    blockHash: `0x${'ab'.repeat(32)}`,
    blockNumber: 777n,
    genesis: { liquidityPrincipalRaw: 20_000_000n * 10n ** 18n, liquidityResidualRaw: 0n, seeded: true },
    managerInventory: { gbxRaw: 7n, usdGRaw: 11n },
    migration: { count: 0n, paused: false },
    positionIndex: {
      indexedBlock: 777n,
      indexedBlockHash: `0x${'ab'.repeat(32)}`,
      source: 'subgraph',
    },
    pool: {
      activeLiquidity: 99_999n,
      currentTick: -60,
      gbxPriceUSDG: { denominator: 20n, numerator: 41n },
      lpFee: 3_000,
      poolId: `0x${'12'.repeat(32)}`,
      poolKey: {
        currency0: liveRuntimeFixture.assets.GBX,
        currency1: liveRuntimeFixture.assets.USDG,
        fee: 3_000,
        hooks: liveRuntimeFixture.addresses.launchGuardHook,
        tickSpacing: 60,
      },
      positionPrincipalComposition: { gbxRaw: 12n * 10n ** 18n, usdGRaw: 34n * 10n ** 6n },
      protocolFee: 0,
      sqrtPriceX96: 79_000_000_000_000_000_000_000_000_000n,
      uncollectedFees: { gbxRaw: 2n * 10n ** 18n, usdGRaw: 3n * 10n ** 6n },
    },
    positions: [5_000, 3_000, 1_500, 500].map((allocationBps, index) => ({
      allocationBps,
      custodyOwner: liveRuntimeFixture.addresses.liquidityManager,
      exists: true,
      gbxPrincipalRaw: BigInt(allocationBps) * 2_000n * 10n ** 18n,
      hasSubscriber: false,
      index,
      liquidity: BigInt(index + 1) * 10_000n,
      positionManagerLiquidity: BigInt(index + 1) * 10_000n,
      principalComposition: {
        gbxRaw: BigInt(index + 1) * 10n ** 18n,
        usdGRaw: BigInt(index + 1) * 2n * 10n ** 6n,
      },
      tickLower: -4_080 - index * 60,
      tickUpper: -60,
      tokenId: BigInt(101 + index),
      uncollectedFees: {
        gbxRaw: BigInt(index + 1) * 10n ** 17n,
        usdGRaw: BigInt(index + 1) * 10n ** 5n,
      },
    })),
  };
}

function renderLive(children: React.ReactNode) {
  return render(<RuntimeDeploymentProvider runtime={liveRuntimeFixture}>{children}</RuntimeDeploymentProvider>);
}

describe('live canonical liquidity surfaces', () => {
  beforeEach(() => {
    mocked.snapshot = {
      data: snapshotData(),
      error: null,
      isFetching: false,
      refetch: vi.fn(),
      source: 'live',
    };
    mocked.fees = {
      data: {
        buybackBurnedGBXRaw: 0n,
        buybackSpentUSDGRaw: 0n,
        indexedBlock: 776n,
        lastProtocolBlock: 775n,
        liquidityGBXFeesBurnedRaw: 5n * 10n ** 18n,
        liquidityUSDGFeesToVaultRaw: 7n * 10n ** 6n,
      },
      error: null,
      isFetching: false,
      refetch: vi.fn(),
      source: 'live',
    };
  });

  it('reuses exact StateView state on Home and Trade and renders four validated NFT records', () => {
    renderLive(
      <>
        <HomeLiquidityStat />
        <LivePoolStateCard />
        <LiveLiquidityDashboard />
      </>,
    );

    expect(screen.getAllByText('99,999').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('live-pool-state-card')).toBeDefined();
    expect(screen.getByTestId('live-liquidity-dashboard')).toBeDefined();
    expect(screen.getAllByTestId(/^live-liquidity-position-/u)).toHaveLength(4);
    expect(screen.getAllByText('LiquidityManager')).toHaveLength(4);
    expect(screen.getByText('Exact values only')).toBeDefined();
    expect(screen.getByText('12 GBX')).toBeDefined();
    expect(screen.getByText('34 USDG')).toBeDefined();
    expect(screen.getAllByText('2.05 USDG')).toHaveLength(2);
    expect(screen.getByText('5 GBX')).toBeDefined();
    expect(screen.getByText('7 USDG')).toBeDefined();
    expect(screen.getByText('Uncollected fees · GBX')).toBeDefined();
    expect(screen.getByText('Uncollected fees · USDG')).toBeDefined();
    expect(screen.getAllByText('2 GBX').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('3 USDG')).toBeDefined();
    expect(screen.getAllByText(/Subgraph active-ID index · block 777/iu).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/sqrtPriceX96/iu)).toBeNull();
    expect(screen.queryByText(/pool display value/iu)).toBeNull();
  });

  it('renders explicit loading and error states without substituting demo or zero values', () => {
    mocked.snapshot = {
      data: undefined,
      error: null,
      isFetching: true,
      refetch: vi.fn(),
      source: 'live-loading',
    };
    const loading = renderLive(<LivePoolStateCard />);
    expect(screen.getByTestId('live-liquidity-loading')).toBeDefined();
    expect(screen.getByText('Loading canonical pool state')).toBeDefined();
    loading.unmount();

    mocked.snapshot = {
      data: undefined,
      error: new Error('RPC failed'),
      isFetching: false,
      refetch: vi.fn(),
      source: 'rpc-fallback',
    };
    renderLive(
      <>
        <HomeLiquidityStat />
        <LiveLiquidityDashboard />
      </>,
    );
    expect(screen.getByText('Unavailable')).toBeDefined();
    expect(screen.getByTestId('live-liquidity-error')).toBeDefined();
    expect(screen.getByText(/No demo value or zero is substituted/iu)).toBeDefined();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('marks retained data stale after a refresh failure', () => {
    mocked.snapshot = {
      data: snapshotData(),
      error: new Error('refresh failed'),
      isFetching: false,
      refetch: vi.fn(),
      source: 'live-stale',
    };
    renderLive(<LiveLiquidityDashboard />);
    expect(screen.getByTestId('live-liquidity-stale')).toBeDefined();
    expect(screen.getByText('Showing the last validated pool block')).toBeDefined();
    expect(screen.getByText(/remain pinned to their displayed block/iu)).toBeDefined();
  });

  it('marks event-derived collected-fee totals stale while retaining block-pinned uncollected fees', () => {
    mocked.fees = {
      ...mocked.fees,
      error: new Error('subgraph refresh failed'),
      source: 'stale',
    };
    renderLive(<LiveLiquidityDashboard />);
    expect(screen.getByTestId('live-liquidity-fees-stale')).toBeDefined();
    expect(screen.getByText('Showing stale collected-fee totals')).toBeDefined();
    expect(screen.getAllByText(/fee-growth checkpoints/iu)).toHaveLength(2);
  });

  it('renders explicit fee loading and unavailable states without substituting zero', () => {
    mocked.fees = {
      data: undefined,
      error: null,
      isFetching: true,
      refetch: vi.fn(),
      source: 'loading',
    };
    const loading = renderLive(<LiveLiquidityDashboard />);
    expect(screen.getByTestId('live-liquidity-fees-loading')).toBeDefined();
    expect(screen.getAllByText('Loading…')).toHaveLength(2);
    expect(screen.getByText(/no zero value is substituted/iu)).toBeDefined();
    loading.unmount();

    mocked.fees = {
      data: undefined,
      error: new Error('subgraph unavailable'),
      isFetching: false,
      refetch: vi.fn(),
      source: 'unavailable',
    };
    renderLive(<LiveLiquidityDashboard />);
    expect(screen.getByTestId('live-liquidity-fees-unavailable')).toBeDefined();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/could not be validated/iu)).toBeDefined();
  });

  it('renders replacement positions and complete composition after migration', () => {
    const current = snapshotData();
    mocked.snapshot = {
      ...mocked.snapshot,
      data: {
        ...current,
        migration: { ...current.migration, count: 1n },
        positions: current.positions.map((position, index) =>
          index === 0 ? { ...position, allocationBps: null, tokenId: 201n } : position,
        ),
      },
    };
    renderLive(<LiveLiquidityDashboard />);
    expect(screen.getByText('Replacement')).toBeDefined();
    expect(screen.getByText('#201')).toBeDefined();
    expect(screen.getByText('12 GBX')).toBeDefined();
    expect(screen.queryByText(/cannot enumerate replacement/iu)).toBeNull();
  });

  it('labels the unmigrated genesis fallback without describing inactive historical rows as active', () => {
    const current = snapshotData();
    mocked.snapshot = {
      ...mocked.snapshot,
      data: {
        ...current,
        positionIndex: { ...current.positionIndex, source: 'genesis-fallback' },
        positions: current.positions.map((position, index) =>
          index === 0
            ? {
                ...position,
                custodyOwner: null,
                exists: false,
                positionManagerLiquidity: null,
                principalComposition: null,
                uncollectedFees: null,
              }
            : position,
        ),
      },
    };
    renderLive(<LiveLiquidityDashboard />);

    expect(screen.getByText('Genesis position records')).toBeDefined();
    expect(screen.getByText(/inactive completed ranges remain visible as historical genesis records/iu)).toBeDefined();
    expect(screen.getByText('Inactive record')).toBeDefined();
    expect(screen.queryByText('Active position records')).toBeNull();
  });

  it('renders an exact empty state when every active range has been swept', () => {
    const current = snapshotData();
    mocked.snapshot = {
      ...mocked.snapshot,
      data: {
        ...current,
        migration: { ...current.migration, count: 1n },
        pool: {
          ...current.pool,
          positionPrincipalComposition: { gbxRaw: 0n, usdGRaw: 0n },
          uncollectedFees: { gbxRaw: 0n, usdGRaw: 0n },
        },
        positions: [],
      },
    };
    renderLive(<LiveLiquidityDashboard />);

    expect(screen.getByTestId('live-liquidity-empty-positions')).toBeDefined();
    expect(screen.getByText(/zero active protocol-owned positions at block 777/iu)).toBeDefined();
    expect(screen.getAllByText('0 GBX').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('0 USDG').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryAllByTestId(/^live-liquidity-position-/u)).toHaveLength(0);
  });
});
