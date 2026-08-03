import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityExplorer } from '../components/protocol/protocol-activity';
import { RuntimeDeploymentProvider } from '../components/protocol/runtime-context';
import type { ProtocolActivityCursor, ProtocolActivityEvent, ProtocolActivityFilter } from '../lib/subgraph-activity';
import { liveRuntimeFixture } from './live-runtime-fixture';

const mocks = vi.hoisted(() => ({
  cursors: [] as Array<ProtocolActivityCursor | null>,
  filters: [] as ProtocolActivityFilter[],
}));
const INDEXED_BLOCK_HASH = `0x${'cd'.repeat(32)}` as `0x${string}`;
const ANCHORED_CURSOR: ProtocolActivityCursor = {
  before: null,
  indexedBlock: 1_300n,
  indexedBlockHash: INDEXED_BLOCK_HASH,
};
const NEXT_CURSOR: ProtocolActivityCursor = {
  ...ANCHORED_CURSOR,
  before: { blockNumber: 1_234n, eventId: '4663:event:1', logIndex: 4n },
};

const event: ProtocolActivityEvent = {
  id: '4663:event:1',
  type: 'strategy-fill',
  category: 'Asset purchases',
  blockNumber: 1234n,
  timestamp: 1_754_000_000n,
  transactionHash: `0x${'ab'.repeat(32)}`,
  logIndex: 4n,
  amountRaw: 42_000_000_000n,
  targetAmountRaw: 231_840_000_000_000_000_000n,
  vaultAmountRaw: 227_203_200_000_000_000_000n,
  managerAmountRaw: 4_636_800_000_000_000_000n,
  redirectedToVault: null,
  supplyBeforeRaw: null,
  auctionId: 9n,
  epochId: null,
  action: null,
  strategyAddress: liveRuntimeFixture.strategies.NVDA,
  assetAddress: null,
  actorAddress: liveRuntimeFixture.admin.guardianOperator,
  receiverAddress: liveRuntimeFixture.admin.guardianOperator,
};

vi.mock('../hooks/use-protocol-activity', () => ({
  useProtocolActivity: (filter: ProtocolActivityFilter, cursor: ProtocolActivityCursor | null) => {
    mocks.filters.push(filter);
    mocks.cursors.push(cursor);
    const currentCursor = cursor ?? ANCHORED_CURSOR;
    return {
      data: {
        cursor: currentCursor,
        events: [event],
        hasNextPage: currentCursor.before === null,
        indexedBlock: 1300n,
        indexedBlockHash: INDEXED_BLOCK_HASH,
        nextCursor: currentCursor.before === null ? NEXT_CURSOR : null,
        pageSize: 12,
      },
      isFetching: false,
      refetch: vi.fn(async () => undefined),
      source: 'live',
    };
  },
}));

vi.mock('../hooks/use-live-protocol-overview', () => ({
  useLiveProtocolOverview: () => ({
    data: undefined,
    error: null,
    isFetching: false,
    refetch: vi.fn(async () => undefined),
    source: 'rpc-fallback',
  }),
}));

vi.mock('../hooks/use-subgraph-health', () => ({
  useSubgraphHealth: () => ({
    hasIndexingErrors: false,
    headBlock: 1301n,
    indexedBlock: 1300n,
    isRefreshing: false,
    lag: 1n,
    lastUpdatedAt: 1,
    refetch: vi.fn(async () => undefined),
    source: 'live',
  }),
}));

describe('live activity explorer', () => {
  beforeEach(() => {
    mocks.cursors.length = 0;
    mocks.filters.length = 0;
  });

  it('changes the active filter and exposes exact event coordinates', async () => {
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <ActivityExplorer />
      </RuntimeDeploymentProvider>,
    );

    const all = screen.getByRole('button', { name: 'All' });
    const mining = screen.getByRole('button', { name: 'Mining' });
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(mining.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('NVDA strategy filled')).toBeDefined();
    expect(screen.getByText('1,234')).toBeDefined();
    expect(screen.getByRole('link', { name: `Open transaction 0x${'ab'.repeat(32)}` })).toBeDefined();

    await userEvent.click(mining);
    expect(mining.getAttribute('aria-pressed')).toBe('true');
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(mocks.filters.at(-1)).toBe('Mining');
  });

  it('uses pinned cursor history for next and previous pages', async () => {
    render(
      <RuntimeDeploymentProvider runtime={liveRuntimeFixture}>
        <ActivityExplorer />
      </RuntimeDeploymentProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2')).toBeDefined();
    expect(mocks.cursors.at(-1)).toEqual(NEXT_CURSOR);

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Page 1')).toBeDefined();
    expect(mocks.cursors.at(-1)).toEqual(ANCHORED_CURSOR);
  });
});
