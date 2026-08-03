import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchProtocolActivityPage,
  parseProtocolActivityResponse,
  PROTOCOL_ACTIVITY_CURSOR_QUERY,
  PROTOCOL_ACTIVITY_HEAD_QUERY,
  PROTOCOL_ACTIVITY_META_QUERY,
  PROTOCOL_ACTIVITY_QUERY,
  type ProtocolActivityCursor,
} from '../lib/subgraph-activity';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const STRATEGY = '0x2222222222222222222222222222222222222222';
const SNAPSHOT_HASH = `0x${'cd'.repeat(32)}` as `0x${string}`;

function eventHash(blockNumber: number, logIndex: number) {
  return `0x${(blockNumber * 1_000 + logIndex).toString(16).padStart(64, '0')}`;
}

function coordinate(blockNumber: number, logIndex: number, timestamp = 500) {
  const transactionHash = eventHash(blockNumber, logIndex);
  return {
    blockNumber: blockNumber.toString(),
    id: `4663-${transactionHash}-${logIndex.toString()}`,
    logIndex: logIndex.toString(),
    timestamp: timestamp.toString(),
    transactionHash,
  };
}

function strategyFill(blockNumber: number, logIndex: number, auctionId: number) {
  return {
    ...coordinate(blockNumber, logIndex),
    auctionId: auctionId.toString(),
    managerAmountRaw: '4',
    strategy: { address: STRATEGY },
    taker: { address: ACCOUNT },
    targetReceivedRaw: '200',
    usdgAmountRaw: '100',
    usdgReceiver: ACCOUNT,
    vaultAmountRaw: '196',
  };
}

function burn(blockNumber: number, logIndex: number) {
  return {
    ...coordinate(blockNumber, logIndex),
    account: { address: ACCOUNT },
    amountGBXRaw: '45',
    operator: { address: ACCOUNT },
  };
}

function emptyResponseData(blockNumber = '2000', blockHash = SNAPSHOT_HASH) {
  return {
    _meta: { block: { hash: blockHash, number: blockNumber }, hasIndexingErrors: false },
    genesisContributions: [] as Array<Record<string, unknown>>,
    miningContributions: [] as Array<Record<string, unknown>>,
    genesisClaims: [] as Array<Record<string, unknown>>,
    miningClaims: [] as Array<Record<string, unknown>>,
    pendingSignals: [] as Array<Record<string, unknown>>,
    strategyFills: [] as Array<Record<string, unknown>>,
    managerRewardNotifications: [] as Array<Record<string, unknown>>,
    managerRewardClaims: [] as Array<Record<string, unknown>>,
    redemptions: [] as Array<Record<string, unknown>>,
    buybacks: [] as Array<Record<string, unknown>>,
    burns: [] as Array<Record<string, unknown>>,
    revenueNotifications: [] as Array<Record<string, unknown>>,
    liquidityEvents: [] as Array<Record<string, unknown>>,
  };
}

function responseData() {
  const data = emptyResponseData();
  data.miningContributions = [
    {
      ...coordinate(1_101, 0),
      beneficiary: { address: ACCOUNT },
      epoch: { epochId: '7' },
      payer: { address: ACCOUNT },
      receivedUSDGRaw: '1250000',
    },
  ];
  data.strategyFills = [strategyFill(1_103, 2, 9), strategyFill(1_100, 1, 8)];
  data.burns = [burn(1_102, 3)];
  return data;
}

function metaResponse(blockNumber = '2000', blockHash = SNAPSHOT_HASH) {
  return {
    data: { _meta: { block: { hash: blockHash, number: blockNumber }, hasIndexingErrors: false } },
  };
}

function requestBody(init: RequestInit) {
  return JSON.parse(String(init.body)) as {
    query: string;
    variables: Record<string, unknown>;
  };
}

describe('protocol activity subgraph client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('orders equal timestamps by immutable chain coordinates and advances with a cursor', () => {
    const data = emptyResponseData();
    data.strategyFills = [strategyFill(1_500, 2, 2), strategyFill(1_500, 9, 9)];
    data.burns = [burn(1_500, 7)];

    const first = parseProtocolActivityResponse({ data }, { cursor: null, filter: 'All', pageSize: 2 });
    expect(first.events.map(({ logIndex }) => logIndex)).toEqual([9n, 7n]);
    expect(first.hasNextPage).toBe(true);
    expect(first.indexedBlock).toBe(2_000n);
    expect(first.indexedBlockHash).toBe(SNAPSHOT_HASH);

    const second = parseProtocolActivityResponse({ data }, { cursor: first.nextCursor, filter: 'All', pageSize: 2 });
    expect(second.events.map(({ logIndex }) => logIndex)).toEqual([2n]);
    expect(second.hasNextPage).toBe(false);
    expect(second.cursor).toEqual(first.nextCursor);
  });

  it('validates, globally orders, and filters immutable event rows', () => {
    const value = { data: responseData() };
    const all = parseProtocolActivityResponse(value, { filter: 'All', pageSize: 2 });
    expect(all.events.map(({ type }) => type)).toEqual(['strategy-fill', 'burn']);
    expect(all.events[0]).toMatchObject({
      amountRaw: 100n,
      auctionId: 9n,
      blockNumber: 1_103n,
      logIndex: 2n,
      targetAmountRaw: 200n,
    });

    const mining = parseProtocolActivityResponse(value, { filter: 'Mining', pageSize: 10 });
    expect(mining.events).toHaveLength(1);
    expect(mining.events[0]).toMatchObject({ epochId: 7n, amountRaw: 1_250_000n, category: 'Mining' });
  });

  it('fails closed on indexing errors, snapshot mismatches, and malformed financial integers', () => {
    expect(() =>
      parseProtocolActivityResponse(
        { data: { ...responseData(), _meta: { ...responseData()._meta, hasIndexingErrors: true } } },
        { filter: 'All', pageSize: 12 },
      ),
    ).toThrow('indexing errors');
    expect(() =>
      parseProtocolActivityResponse(
        { data: responseData(), errors: [{ message: 'broken' }] },
        { filter: 'All', pageSize: 12 },
      ),
    ).toThrow('GraphQL errors');

    const malformed = responseData();
    malformed.strategyFills[0]!.usdgAmountRaw = '1.25';
    expect(() => parseProtocolActivityResponse({ data: malformed }, { filter: 'All', pageSize: 12 })).toThrow(
      'unsigned integer',
    );

    const mismatchedCursor: ProtocolActivityCursor = {
      before: null,
      indexedBlock: 1_999n,
      indexedBlockHash: SNAPSHOT_HASH,
    };
    expect(() =>
      parseProtocolActivityResponse(
        { data: responseData() },
        { cursor: mismatchedCursor, filter: 'All', pageSize: 12 },
      ),
    ).toThrow('pinned activity snapshot');
  });

  it('distinguishes zero-weight vault redirects from distributable manager notifications', () => {
    const data = responseData();
    data.managerRewardNotifications = [
      {
        ...coordinate(1_104, 4),
        amountRaw: '25',
        redirectedToVault: true,
        rewardAsset: { token: ACCOUNT },
        strategy: { address: STRATEGY },
      },
    ];

    const page = parseProtocolActivityResponse({ data }, { filter: 'Manager rewards', pageSize: 10 });
    expect(page.events).toHaveLength(1);
    expect(page.events[0]).toMatchObject({
      amountRaw: 25n,
      redirectedToVault: true,
      type: 'manager-reward-notification',
    });
  });

  it('pins the first page to a block hash and uses the immutable cursor as the head grows', async () => {
    const older = emptyResponseData();
    older.miningContributions = responseData().miningContributions;
    older.strategyFills = [strategyFill(1_100, 1, 8)];
    const requests: Array<{ query: string; variables: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = requestBody(init);
      requests.push(body);
      const payload =
        body.query === PROTOCOL_ACTIVITY_META_QUERY
          ? metaResponse()
          : body.query === PROTOCOL_ACTIVITY_HEAD_QUERY
            ? { data: responseData() }
            : { data: older };
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchProtocolActivityPage('https://subgraph.example/graphql', {
      filter: 'All',
      pageSize: 2,
    });
    expect(first.events.map(({ type }) => type)).toEqual(['strategy-fill', 'burn']);
    expect(first.nextCursor).not.toBeNull();

    const second = await fetchProtocolActivityPage('https://subgraph.example/graphql', {
      cursor: first.nextCursor,
      filter: 'All',
      pageSize: 2,
    });
    expect(second.events.map(({ type }) => type)).toEqual(['mining-contribution', 'strategy-fill']);
    expect(requests).toHaveLength(3);
    expect(requests[0]).toEqual({ query: PROTOCOL_ACTIVITY_META_QUERY, variables: {} });
    expect(requests[1]).toMatchObject({
      query: PROTOCOL_ACTIVITY_HEAD_QUERY,
      variables: { beforeBlock: '2000', first: 3, indexedBlockHash: SNAPSHOT_HASH },
    });
    expect(requests[2]).toMatchObject({
      query: PROTOCOL_ACTIVITY_CURSOR_QUERY,
      variables: { beforeBlock: '1102', beforeLogIndex: '3', first: 3, indexedBlockHash: SNAPSHOT_HASH },
    });
    expect(PROTOCOL_ACTIVITY_QUERY).toBe(PROTOCOL_ACTIVITY_HEAD_QUERY);
  });

  it('repairs a truncated equal-block boundary with deterministic log-index ordering', async () => {
    const truncated = emptyResponseData();
    truncated.strategyFills = [strategyFill(1_500, 1, 1), strategyFill(1_500, 5, 5), strategyFill(1_500, 3, 3)];
    const corrected = {
      _meta: truncated._meta,
      strategyFills: [strategyFill(1_500, 9, 9), strategyFill(1_500, 8, 8), strategyFill(1_500, 7, 7)],
    };
    const requests: Array<{ query: string; variables: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = requestBody(init);
      requests.push(body);
      const payload =
        body.query === PROTOCOL_ACTIVITY_META_QUERY
          ? metaResponse()
          : body.query === PROTOCOL_ACTIVITY_HEAD_QUERY
            ? { data: truncated }
            : { data: corrected };
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const page = await fetchProtocolActivityPage('https://subgraph.example/graphql', {
      filter: 'Asset purchases',
      pageSize: 2,
    });
    expect(page.events.map(({ logIndex }) => logIndex)).toEqual([9n, 8n]);
    expect(page.nextCursor?.before).toMatchObject({ blockNumber: 1_500n, logIndex: 8n });
    expect(requests).toHaveLength(3);
    expect(requests[2]!.query).toContain('orderBy: logIndex');
    expect(requests[2]!.variables).toMatchObject({
      first: 3,
      indexedBlockHash: SNAPSHOT_HASH,
      strategyFillsBlock: '1500',
      strategyFillsLogLimit: (1n << 256n).toString(),
    });
  });

  it('rejects unbounded pages and cleartext remote indexers', async () => {
    await expect(
      fetchProtocolActivityPage('https://subgraph.example/graphql', { filter: 'All', pageSize: 26 }),
    ).rejects.toThrow('between 1 and 25');
    await expect(fetchProtocolActivityPage('http://subgraph.example/graphql', { filter: 'All' })).rejects.toThrow(
      'not HTTPS',
    );
  });
});
